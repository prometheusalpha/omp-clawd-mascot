// Clawd frame tables, extracted verbatim from Claude Code v2.1.311 (Bun
// standalone build). Provenance: the glyph tables live in the module
// `/$bunfs/root/chunk-n3hy5k9c.js` (bundle bytes 238,249,000-238,256,400); the
// playlists live in the mascot module at bundle bytes 252,065,692-252,069,076.
// Names keep the bundle's originals in comments so a re-extraction can be
// diffed: jo=POSES, Xe=ARMS, Je=EYES, Qe=FEET, Ze=SIMPLE_EYES, eo=FACING,
// Jo=SEQUENCES, Ju=AUTOPLAY.
//
// One body is 9 columns x 3 rows (So, wo) of block glyphs painted with a single
// body colour. Playlists tick every 60 ms (wa); a frame's `offset` pushes the
// body down that many rows and `x` shifts it left, both clipped to the body box.

/** Bundle `wa`: milliseconds per animated frame. */
export const FRAME_MS = 60;
/** Bundle `So`: columns in the body box. */
export const BODY_COLS = 9;
/** Bundle `wo`: rows in the body box. */
export const BODY_ROWS = 3;

export type EyeName = "open" | "left" | "right" | "closed" | "wink";
export type ArmName = "down" | "up" | "one-up";
export type FeetName = "both" | "left" | "right";
export type PoseName = "default" | "arms-up" | "look-left" | "look-right";
export type FacingName =
	| "right-12"
	| "right-30"
	| "right-55"
	| "right-75"
	| "edge"
	| "back-105"
	| "back-125"
	| "back-150"
	| "back"
	| "left-75"
	| "left-55"
	| "left-30"
	| "left-12"
;

/** A complete body: which eye, arm and feet sprites to draw. */
export type Pose = { readonly eyes: EyeName; readonly arms: ArmName; readonly feet: FeetName };
/** A side/back view, which replaces the whole pose grid instead of re-dressing it. */
export type FacingPose = { readonly facing: FacingName };

/** One span of eye pixels; `lid` inverts body and background so the eyelid reads. */
export type EyeSpan = { readonly glyphs: string; readonly lid?: true };
/** Arm quadrants: `r1*` sit on the top row, `r2*` on the middle row. */
export type Arm = { readonly r1L: string; readonly r1R: string; readonly r2L: string; readonly r2R: string };
/** A facing row: glyphs `from`..`to` are painted on the background colour. */
export type FacingRow = { readonly glyphs: string; readonly from: number; readonly to: number };

/** One animated frame. Missing fields are the pose's own defaults. */
export type FrameSpec = {
	readonly pose?: PoseName | Pose | FacingPose;
	readonly offset?: number;
	readonly x?: number;
	readonly poof?: "dot" | "wave";
	readonly shadow?: "wide" | "narrow";
};

/** Bundle `jo`. */
export const POSES = {
	default: { eyes: "open", arms: "down", feet: "both" },
	"arms-up": { eyes: "open", arms: "up", feet: "both" },
	"look-left": { eyes: "left", arms: "down", feet: "both" },
	"look-right": { eyes: "right", arms: "down", feet: "both" },
} as const;

/** Bundle `Xe`. */
export const ARMS = {
	down: { r1L: " ▐", r1R: "", r2L: "▝▜", r2R: "█▀" },
	up: { r1L: "▗▟", r1R: "▄", r2L: " ▜", r2R: "█▘" },
	"one-up": { r1L: " ▐", r1R: "▄", r2L: "▝▜", r2R: "█▘" },
} as const;

/** Bundle `Je`; the spans are laid out left to right from column 2 of the top row. */
export const EYES: Record<EyeName, readonly EyeSpan[]> = {
	open: [{ glyphs: "▛███▛█" }],
	left: [{ glyphs: "▟███▟█" }],
	right: [{ glyphs: "█▟███▟" }],
	closed: [{ glyphs: "▂", lid: true }, { glyphs: "███" }, { glyphs: "▂", lid: true }, { glyphs: "█" }],
	wink: [{ glyphs: "▛███" }, { glyphs: "▂", lid: true }, { glyphs: "█" }],
};

/** Bundle `Qe`: the third row, drawn from column 0. */
export const FEET = {
	both: " ▝▝   ▝▝ ",
	left: " ▝▝      ",
	right: "      ▝▝ ",
} as const;

/** Bundle `Ze`: the eyes-only stand-in drawn on terminals that misrender block glyphs. */
export const SIMPLE_EYES = {
	open: " ▗   ▖ ",
	left: " ▘   ▘ ",
	right: " ▝   ▝ ",
	closed: " ▂   ▂ ",
	wink: " ▗   ▂ ",
} as const;

/** Bundle `eo`: 13 views of the body, each three rows of 9 glyphs. */
export const FACING = {
	"right-12": [
		{ glyphs: " ▐█▜██▛█ ", from: 2, to: 8 },
		{ glyphs: "▝▜██████▀", from: 2, to: 7 },
		{ glyphs: " ▝▝   ▝▝ ", from: 0, to: 0 },
	],
	"right-30": [
		{ glyphs: "  █▛██▛▌ ", from: 2, to: 7 },
		{ glyphs: " ▝█████▛ ", from: 2, to: 7 },
		{ glyphs: "  ▘▘  ▘▘ ", from: 0, to: 0 },
	],
	"right-55": [
		{ glyphs: "  ▐█▛█▜  ", from: 3, to: 7 },
		{ glyphs: "  ▐████  ", from: 3, to: 7 },
		{ glyphs: "  ▝▝ ▝▝  ", from: 0, to: 0 },
	],
	"right-75": [
		{ glyphs: "   ██▛▌  ", from: 3, to: 6 },
		{ glyphs: "   ███▌  ", from: 3, to: 6 },
		{ glyphs: "   ▘  ▘  ", from: 0, to: 0 },
	],
	"edge": [
		{ glyphs: "   ▐██   ", from: 4, to: 6 },
		{ glyphs: "   ▐██   ", from: 4, to: 6 },
		{ glyphs: "   ▝ ▝   ", from: 0, to: 0 },
	],
	"back-105": [
		{ glyphs: "   ███▌  ", from: 3, to: 6 },
		{ glyphs: "   ███▌  ", from: 3, to: 6 },
		{ glyphs: "   ▘  ▘  ", from: 0, to: 0 },
	],
	"back-125": [
		{ glyphs: "  ▐████  ", from: 3, to: 7 },
		{ glyphs: "  ▐████  ", from: 3, to: 7 },
		{ glyphs: "  ▝▝ ▝▝  ", from: 0, to: 0 },
	],
	"back-150": [
		{ glyphs: "  █████▌ ", from: 2, to: 7 },
		{ glyphs: " ▝█████▛ ", from: 2, to: 7 },
		{ glyphs: "  ▘▘  ▘▘ ", from: 0, to: 0 },
	],
	"back": [
		{ glyphs: " ▐██████ ", from: 2, to: 8 },
		{ glyphs: "▝▜██████▀", from: 2, to: 7 },
		{ glyphs: " ▝▝   ▝▝ ", from: 0, to: 0 },
	],
	"left-75": [
		{ glyphs: "   ▛██▌  ", from: 3, to: 6 },
		{ glyphs: "   ███▌  ", from: 3, to: 6 },
		{ glyphs: "   ▘  ▘  ", from: 0, to: 0 },
	],
	"left-55": [
		{ glyphs: "  ▐▜▛██  ", from: 3, to: 7 },
		{ glyphs: "  ▐████  ", from: 3, to: 7 },
		{ glyphs: "  ▝▝ ▝▝  ", from: 0, to: 0 },
	],
	"left-30": [
		{ glyphs: "  ▛██▛█▌ ", from: 2, to: 7 },
		{ glyphs: " ▝█████▛ ", from: 2, to: 7 },
		{ glyphs: "  ▘▘  ▘▘ ", from: 0, to: 0 },
	],
	"left-12": [
		{ glyphs: " ▐▛███▜█ ", from: 2, to: 8 },
		{ glyphs: "▝▜██████▀", from: 2, to: 7 },
		{ glyphs: " ▝▝   ▝▝ ", from: 0, to: 0 },
	],
} as const;

/** Bundle `Jo`: every authored one-shot, in play order. */
export const SEQUENCES = {
	jump: [
		{ pose: "default", offset: 1, poof: "dot" },
		{ pose: "default", offset: 1, poof: "wave" },
		{ pose: "arms-up" },
		{ pose: "arms-up" },
		{ pose: "arms-up" },
		{ pose: "default" },
		{ pose: "default", offset: 1, poof: "dot" },
		{ pose: "default", offset: 1, poof: "wave" },
		{ pose: "arms-up" },
		{ pose: "arms-up" },
		{ pose: "arms-up" },
		{ pose: "default" },
	],
	look: [
		{ pose: "look-right" },
		{ pose: "look-right" },
		{ pose: "look-right" },
		{ pose: "look-right" },
		{ pose: "look-right" },
		{ pose: "look-left" },
		{ pose: "look-left" },
		{ pose: "look-left" },
		{ pose: "look-left" },
		{ pose: "look-left" },
		{ pose: "default" },
	],
	celebrate: [
		{ pose: "default", offset: 1, poof: "dot" },
		{ pose: "default", offset: 1, poof: "wave" },
		{ pose: "arms-up" },
		{ pose: "arms-up" },
		{ pose: "arms-up" },
		{ pose: "default" },
		{ pose: "default", offset: 1, poof: "dot" },
		{ pose: "default", offset: 1, poof: "wave" },
		{ pose: "arms-up" },
		{ pose: "arms-up" },
		{ pose: "arms-up" },
		{ pose: "default" },
		{ pose: "default", offset: 1 },
		{ pose: "default", offset: 1 },
		{ pose: "default", offset: 1 },
	],
	skip: [
		{ pose: "default", offset: 1, x: -9 },
		{ pose: "arms-up", x: -6 },
		{ pose: "arms-up", x: -6 },
		{ pose: "default", x: -6 },
		{ pose: "default", offset: 1, x: -6 },
		{ pose: "arms-up", x: -3 },
		{ pose: "arms-up", x: -3 },
		{ pose: "default", x: -3 },
		{ pose: "default", offset: 1, x: -3 },
		{ pose: "arms-up" },
		{ pose: "arms-up" },
		{ pose: "default", offset: 1, poof: "dot" },
		{ pose: "default", offset: 1, poof: "wave" },
		{ pose: "default" },
	],
	spin: [
		{ pose: "look-left" },
		{ pose: "look-left" },
		{ pose: "look-right" },
		{ pose: "look-right" },
		{ pose: "look-left" },
		{ pose: "look-left" },
		{ pose: "arms-up" },
		{ pose: "arms-up" },
		{ pose: "arms-up" },
		{ pose: "default" },
	],
	peekaboo: [
		{ pose: "default", offset: 3 },
		{ pose: "default", offset: 2 },
		{ pose: "default", offset: 2 },
		{ pose: "default", offset: 2 },
		{ pose: "look-right", offset: 2 },
		{ pose: "look-right", offset: 2 },
		{ pose: "look-right", offset: 2 },
		{ pose: "look-left", offset: 2 },
		{ pose: "look-left", offset: 2 },
		{ pose: "look-left", offset: 2 },
		{ pose: "default", offset: 2 },
		{ pose: "default", offset: 2 },
		{ pose: "default", offset: 1 },
		{ pose: "arms-up" },
		{ pose: "arms-up" },
		{ pose: "arms-up" },
		{ pose: "arms-up" },
		{ pose: "default" },
		{ pose: "default" },
		{ pose: { eyes: "closed", arms: "down", feet: "both" } },
		{ pose: "default" },
	],
	drop: [
		{ pose: "arms-up", offset: -3 },
		{ pose: "arms-up", offset: -2 },
		{ pose: "arms-up", offset: -2 },
		{ pose: "arms-up", offset: -1 },
		{ pose: "arms-up", offset: -1 },
		{ pose: "arms-up" },
		{ pose: "default", offset: 1, poof: "dot" },
		{ pose: "default", offset: 1, poof: "wave" },
		{ pose: "default" },
		{ pose: "default" },
		{ pose: "default" },
		{ pose: { eyes: "closed", arms: "down", feet: "both" } },
		{ pose: "default" },
	],
	waddle: [
		{ pose: "look-right", x: -9 },
		{ pose: { eyes: "right", arms: "down", feet: "left" }, x: -6 },
		{ pose: { eyes: "right", arms: "down", feet: "left" }, x: -6 },
		{ pose: { eyes: "right", arms: "down", feet: "right" }, x: -5 },
		{ pose: { eyes: "right", arms: "down", feet: "right" }, x: -5 },
		{ pose: { eyes: "right", arms: "down", feet: "left" }, x: -4 },
		{ pose: { eyes: "right", arms: "down", feet: "left" }, x: -4 },
		{ pose: { eyes: "right", arms: "down", feet: "right" }, x: -3 },
		{ pose: { eyes: "right", arms: "down", feet: "right" }, x: -3 },
		{ pose: { eyes: "right", arms: "down", feet: "left" }, x: -2 },
		{ pose: { eyes: "right", arms: "down", feet: "left" }, x: -2 },
		{ pose: { eyes: "right", arms: "down", feet: "right" }, x: -1 },
		{ pose: { eyes: "right", arms: "down", feet: "right" }, x: -1 },
		{ pose: "look-right" },
		{ pose: "look-right" },
		{ pose: "default" },
		{ pose: "default" },
		{ pose: { eyes: "closed", arms: "down", feet: "both" } },
		{ pose: "default" },
	],
	peek: [
		{ pose: "look-right", x: -9 },
		{ pose: "look-right", x: -6 },
		{ pose: "look-right", x: -6 },
		{ pose: "look-right", x: -6 },
		{ pose: "look-right", x: -6 },
		{ pose: "look-right", x: -6 },
		{ pose: "look-right", x: -9 },
		{ pose: "look-right", x: -9 },
		{ pose: "look-right", x: -9 },
		{ pose: "look-right", x: -5 },
		{ pose: "look-right", x: -5 },
		{ pose: "look-right", x: -5 },
		{ pose: "look-right", x: -5 },
		{ pose: "arms-up", x: -3 },
		{ pose: "arms-up", x: -3 },
		{ pose: "arms-up" },
		{ pose: "arms-up" },
		{ pose: "default", offset: 1, poof: "dot" },
		{ pose: "default", offset: 1, poof: "wave" },
		{ pose: "default" },
	],
	wink: [
		{ pose: { eyes: "wink", arms: "down", feet: "both" } },
		{ pose: { eyes: "wink", arms: "down", feet: "both" } },
		{ pose: { eyes: "wink", arms: "down", feet: "both" } },
		{ pose: { eyes: "wink", arms: "down", feet: "both" } },
		{ pose: { eyes: "wink", arms: "down", feet: "both" } },
		{ pose: "default" },
	],
	boop: [
		{ pose: { eyes: "closed", arms: "down", feet: "both" }, offset: 1, poof: "dot" },
		{ pose: { eyes: "closed", arms: "down", feet: "both" }, offset: 1, poof: "wave" },
		{ pose: { eyes: "closed", arms: "down", feet: "both" }, offset: 1, poof: "wave" },
		{ pose: "look-left" },
		{ pose: "look-left" },
		{ pose: "look-left" },
		{ pose: "look-left" },
		{ pose: "default" },
		{ pose: "default" },
		{ pose: { eyes: "closed", arms: "down", feet: "both" } },
		{ pose: "default" },
	],
	tap: [
		{ pose: { eyes: "open", arms: "down", feet: "left" } },
		{ pose: { eyes: "open", arms: "down", feet: "left" } },
		{ pose: { eyes: "open", arms: "down", feet: "right" } },
		{ pose: { eyes: "open", arms: "down", feet: "right" } },
		{ pose: { eyes: "open", arms: "down", feet: "left" } },
		{ pose: { eyes: "open", arms: "down", feet: "left" } },
		{ pose: { eyes: "open", arms: "down", feet: "right" } },
		{ pose: { eyes: "open", arms: "down", feet: "right" } },
		{ pose: { eyes: "open", arms: "down", feet: "left" } },
		{ pose: { eyes: "open", arms: "down", feet: "right" } },
		{ pose: "arms-up" },
		{ pose: "arms-up" },
		{ pose: "arms-up" },
		{ pose: "default" },
	],
	sneeze: [
		{ pose: { eyes: "closed", arms: "up", feet: "both" } },
		{ pose: { eyes: "closed", arms: "up", feet: "both" } },
		{ pose: { eyes: "closed", arms: "up", feet: "both" } },
		{ pose: { eyes: "closed", arms: "up", feet: "both" } },
		{ pose: { eyes: "closed", arms: "down", feet: "both" }, offset: 1, poof: "wave" },
		{ pose: { eyes: "closed", arms: "down", feet: "both" }, offset: 1, poof: "wave" },
		{ pose: { eyes: "closed", arms: "down", feet: "both" } },
		{ pose: { eyes: "closed", arms: "down", feet: "both" } },
		{ pose: "default" },
		{ pose: "default" },
		{ pose: { eyes: "closed", arms: "down", feet: "both" } },
		{ pose: "default" },
	],
	turn: [
		{ pose: { facing: "right-12" } },
		{ pose: { facing: "right-30" } },
		{ pose: { facing: "right-55" } },
		{ pose: { facing: "right-75" } },
		{ pose: { facing: "edge" } },
		{ pose: { facing: "back-105" } },
		{ pose: { facing: "back-125" } },
		{ pose: { facing: "back-150" } },
		{ pose: { facing: "back" } },
		{ pose: { facing: "back" } },
		{ pose: { facing: "back-150" } },
		{ pose: { facing: "back-125" } },
		{ pose: { facing: "back-105" } },
		{ pose: { facing: "edge" } },
		{ pose: { facing: "left-75" } },
		{ pose: { facing: "left-55" } },
		{ pose: { facing: "left-30" } },
		{ pose: { facing: "left-12" } },
		{ pose: "default" },
	],
	"coin-hop": [
		{ pose: "default", offset: 1 },
		{ pose: "default", offset: 1 },
		{ pose: "arms-up", shadow: "wide" },
		{ pose: { facing: "right-55" }, shadow: "narrow" },
		{ pose: { facing: "edge" }, shadow: "narrow" },
		{ pose: { facing: "back-125" }, shadow: "narrow" },
		{ pose: { facing: "back" }, shadow: "narrow" },
		{ pose: { facing: "back-125" }, shadow: "narrow" },
		{ pose: { facing: "edge" }, shadow: "narrow" },
		{ pose: { facing: "left-55" }, shadow: "narrow" },
		{ pose: "arms-up", shadow: "wide" },
		{ pose: "default", offset: 1, poof: "dot" },
		{ pose: "default", offset: 1, poof: "wave" },
		{ pose: "default" },
	],
} as const;

/** Bundle `Ju`: the autoplay loop — twelve still beats, then a look each way. */
export const AUTOPLAY: readonly FrameSpec[] = [
	{ pose: "default" },
	{ pose: "default" },
	{ pose: "default" },
	{ pose: "default" },
	{ pose: "default" },
	{ pose: "default" },
	{ pose: "default" },
	{ pose: "default" },
	{ pose: "default" },
	{ pose: "default" },
	{ pose: "default" },
	{ pose: "default" },
	{ pose: "look-right" },
	{ pose: "look-right" },
	{ pose: "look-right" },
	{ pose: "look-right" },
	{ pose: "look-right" },
	{ pose: "look-left" },
	{ pose: "look-left" },
	{ pose: "look-left" },
	{ pose: "look-left" },
	{ pose: "look-left" },
];
