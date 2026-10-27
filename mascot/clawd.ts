import {
	ARMS,
	AUTOPLAY,
	BODY_COLS,
	BODY_ROWS,
	EYES,
	FACING,
	FEET,
	FRAME_MS,
	POSES,
	SEQUENCES,
	SIMPLE_EYES,
	type FacingPose,
	type FrameSpec,
	type Pose,
	type PoseName,
} from "./clawd-data";

// Clawd: the Claude Code mascot, ported from a shipped build (v2.1.311). Unlike
// `art.ts`, this is not pixel art — a frame is a 9x3 grid of block glyphs painted
// with one body colour, and the eye/arm/feet sprites only decide which glyphs
// land in that grid. Cells that Claude renders on its background colour (eye
// spans, eyelid spans, the side-view window) keep that background here so the
// body reads as a solid silhouette with dark holes rather than as loose strokes.
//
// Frames are described, not drawn: `buildClawdFrame` resolves a `FrameSpec` into
// cells, so every playlist in `clawd-data.ts` renders through the same path.

/** Colour role for a cell; the caller maps these to real escape codes. */
export type Paint = "body" | "background" | "inactive";

/** One terminal cell of a frame. `bg` is null when the body leaves it unpainted. */
export type ClawdCell = {
	readonly glyph: string;
	readonly fg: Paint;
	readonly bg: Paint | null;
};

/** The body box: `BODY_ROWS` rows of `BODY_COLS` cells. */
export type ClawdFrame = readonly (readonly ClawdCell[])[];

const BLANK: ClawdCell = { glyph: " ", fg: "body", bg: null };
/** Bundle `va`: the dust puffs at the feet. */
const POOF = { dot: "·", wave: "~" } as const;
/** Bundle `Ta`: the ground shadow under a hop. */
const SHADOW = { wide: { glyphs: "▁▁▁", left: 3 }, narrow: { glyphs: "▁", left: 4 } } as const;
/** The middle row is a fixed bar; only the eye row and the feet change between poses. */
const CHEST = "█████";

/**
 * Claude swaps the whole body for eye-only art on Apple Terminal, whose block
 * glyphs render unevenly. The caller decides, so this module stays free of host
 * globals: the omp widget passes `Bun.env.TERM_PROGRAM === "Apple_Terminal"`,
 * the Claude Code plugin (which runs in a sandbox without `Bun`) passes false.
 */

/** Playlists the widget drives: Claude's autoplay loop, and the tapping feet it uses while busy. */
export const CLAWD_ANIMS = { idle: AUTOPLAY, working: SEQUENCES.tap } as const;

export { BODY_COLS, BODY_ROWS, FRAME_MS };

function isFacing(pose: PoseName | Pose | FacingPose): pose is FacingPose {
	return typeof pose !== "string" && "facing" in pose;
}

function blank(): ClawdCell[][] {
	return Array.from({ length: BODY_ROWS }, () => Array.from({ length: BODY_COLS }, () => BLANK));
}

/** Write `glyphs` left to right from `column`, ignoring cells outside the box. */
function put(
	grid: ClawdCell[][],
	row: number,
	column: number,
	glyphs: string,
	fg: Paint = "body",
	bg: Paint | null = null,
): void {
	const line = grid[row];
	if (!line) return;
	Array.from(glyphs).forEach((glyph, index) => {
		const target = column + index;
		if (target < 0 || target >= BODY_COLS) return;
		line[target] = { glyph, fg, bg };
	});
}

/**
 * `offset` pushes the body down and `x` shifts it left; both clip, which is how
 * the hop and the walk off screen read in Claude.
 */
function shift(grid: ClawdCell[][], spec: FrameSpec): ClawdCell[][] {
	const down = spec.offset ?? 0;
	const left = spec.x ?? 0;
	if (down === 0 && left === 0) return grid;
	const out = blank();
	for (let row = 0; row < BODY_ROWS; row++) {
		for (let column = 0; column < BODY_COLS; column++) {
			const targetRow = row + down;
			const targetColumn = column + left;
			if (targetRow < 0 || targetRow >= BODY_ROWS) continue;
			if (targetColumn < 0 || targetColumn >= BODY_COLS) continue;
			out[targetRow]![targetColumn] = grid[row]![column]!;
		}
	}
	return out;
}

/** Dust and shadow paint over the feet row, the way Claude's later siblings do. */
function decorate(grid: ClawdCell[][], spec: FrameSpec): ClawdCell[][] {
	const row = BODY_ROWS - 1;
	if (spec.poof) {
		put(grid, row, 0, POOF[spec.poof], "inactive");
		put(grid, row, BODY_COLS - 1, POOF[spec.poof], "inactive");
	}
	if (spec.shadow) {
		const shadow = SHADOW[spec.shadow];
		put(grid, row, shadow.left, shadow.glyphs, "inactive");
	}
	return grid;
}

/** Draw the posed body: arms on the edges, eye spans from column 2, a fixed chest, then feet. */
function posed(pose: Pose): ClawdCell[][] {
	const grid = blank();
	const arms = ARMS[pose.arms];
	put(grid, 0, 0, arms.r1L);
	let column = 2;
	for (const span of EYES[pose.eyes]) {
		const lid = span.lid === true;
		put(grid, 0, column, span.glyphs, lid ? "background" : "body", lid ? "body" : "background");
		column += span.glyphs.length;
	}
	put(grid, 0, BODY_COLS - 1, arms.r1R);
	put(grid, 1, 0, arms.r2L);
	put(grid, 1, 2, CHEST, "body", "background");
	put(grid, 1, 7, arms.r2R);
	put(grid, 2, 0, FEET[pose.feet]);
	return grid;
}

/** Draw a side or back view: the glyph row itself is the body, with a background window punched through it. */
function facing(pose: FacingPose): ClawdCell[][] {
	const grid = blank();
	FACING[pose.facing].forEach((view, row) => {
		Array.from(view.glyphs).forEach((glyph, column) => {
			const window = column >= view.from && column < view.to;
			put(grid, row, column, glyph, "body", window ? "background" : null);
		});
	});
	return grid;
}

/** Eyes-only fallback: a face, a bar of body colour, and the feet. */
function simple(pose: PoseName | Pose | FacingPose, spec: FrameSpec): ClawdFrame {
	const grid = blank();
	const eyes = isFacing(pose) ? "open" : (typeof pose === "string" ? POSES[pose] : pose).eyes;
	put(grid, 0, 0, "▗");
	put(grid, 0, 1, SIMPLE_EYES[eyes], "background", "body");
	put(grid, 0, BODY_COLS - 1, "▖");
	put(grid, 1, 1, " ".repeat(BODY_COLS - 2), "body", "body");
	put(grid, 2, 1, "▘▘   ▝▝");
	// Claude's fallback ignores bounce, dust and shadow: the box is static there.
	return decorate(grid, { ...spec, offset: 0, x: 0, poof: undefined, shadow: undefined });
}

/** Resolve one authored frame into cells. */
export function buildClawdFrame(spec: FrameSpec, simpleBody = false): ClawdFrame {
	const pose = spec.pose ?? "default";
	if (simpleBody) return simple(pose, spec);
	const grid = isFacing(pose) ? facing(pose) : posed(typeof pose === "string" ? POSES[pose] : pose);
	return decorate(shift(grid, spec), spec);
}

/** Frame `step` of `anim`, looping. */
export function clawdFrame(anim: readonly FrameSpec[], step: number, simpleBody = false): ClawdFrame {
	const frame = anim[step % anim.length] ?? anim[0];
	return buildClawdFrame(frame ?? {}, simpleBody);
}
