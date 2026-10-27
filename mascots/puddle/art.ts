// Hand-authored mascot art. Row strings are the pixel grid: `0` is
// transparent, `1`-`9` index PALETTE. Every frame shares one canvas so the
// widget height never changes between states; the dozing puddle and the
// thinking steam both move within that fixed grid.

export const ART_COLS = 19;
export const ART_PX_ROWS = 9;

/** Body colours, then the face accents, the sleeping `z`, and the thinking cup. */
export const PALETTE = [
	"#39c1fd",
	"#2278d4",
	"#0e1d36",
	"#fd739b",
	"#c8f4fd",
	"#b7b7b7",
	"#f1f1e8",
	"#653d25",
	"#757575",
] as const;

const BLANK = "0".repeat(ART_COLS);

/** Sleeping pose: a wide puddle melted out to both sides, eyes closed and low. */
const PUDDLE = [
	"0000000000000000000",
	"0000000000000000000",
	"0000000000000000000",
	"0000000000000000000",
	"0000022222222000000",
	"0002511111111152000",
	"0021111111111111200",
	"2111133311133311112",
	"2211111111111111122",
];

/**
 * A little `z` that drifts up over the puddle while it sleeps. Both inner rows
 * carry a single pixel, so the diagonal is a one-pixel staircase from the
 * top-right corner down to the bottom-left one.
 */
const Z = ["6666", "0060", "0600", "6666"];

/**
 * Thinking pose: the mascot holds a mug in its right hand. The squat body sits
 * on the same baseline as the idle puddle; the smoke is overlaid per frame so
 * the column above the mug stays free for it to rise through.
 */
const THINK = [
	"0000000000000000000",
	"0000000000000000000",
	"0000000000000000000",
	"0000222222000000000",
	"0002511111120000000",
	"0211311113112000000",
	"0211111111112008880",
	"2111111111111127777",
	"2111111111111127770",
];

/**
 * Smoke: three single-cell puffs two art rows apart, alternating upper left,
 * right and left. The second sprite is the first mirrored left-to-right, so the
 * two-frame boil reads as a plume that never settles.
 */
const SMOKE = [
	["900", "000", "009", "000", "900", "000"],
	["009", "000", "900", "000", "009", "000"],
];

/** Blink: the navy eye pixels fall back to body colour for a single frame. */
const BLINK = THINK.map(row => row.replaceAll("3", "1"));

/** Glance: both pupils shift one column toward the mug, then back. */
const GLANCE = THINK.map(row => row.replace("0211311113112000000", "0211131111312000000"));

/** Place `sprite` on `base`; the sprite's `0` cells stay transparent. */
function overlay(base: readonly string[], sprite: readonly string[], top: number, left: number): readonly string[] {
	return base.map((row, y) => {
		const spriteRow = sprite[y - top];
		if (spriteRow === undefined) return row;
		const cells = [...row];
		for (let x = 0; x < spriteRow.length; x++) {
			const index = spriteRow[x]!;
			if (index !== "0") cells[left + x] = index;
		}
		return cells.join("");
	});
}

/** The `z` drifting up into its peak over the puddle. */
const DOZING = overlay(PUDDLE, Z, 1, 14);

/** The `z` at the top of its drift, held for a beat. */
const DOZE = overlay(PUDDLE, Z, 0, 14);

export type Art = {
	readonly cols: number;
	readonly pxRows: number;
	readonly palette: readonly string[];
	readonly anims: Record<string, { readonly frames: readonly (readonly string[])[] }>;
};

export const ART: Art = {
	cols: ART_COLS,
	pxRows: ART_PX_ROWS,
	palette: PALETTE,
	anims: {
		// Asleep for the whole loop: the `z` drifts up and vanishes, then starts over.
		idle: {
			frames: [PUDDLE, PUDDLE, DOZING, DOZE, DOZE, PUDDLE, PUDDLE],
		},
		// Coffee break: the smoke boil flips side every frame, with one blink and a
		// three-frame glance at the mug so the pose never reads as a still image.
		working: {
			frames: [
				overlay(THINK, SMOKE[0]!, 0, 15),
				overlay(THINK, SMOKE[1]!, 0, 15),
				overlay(BLINK, SMOKE[0]!, 0, 15),
				overlay(GLANCE, SMOKE[1]!, 0, 15),
				overlay(GLANCE, SMOKE[0]!, 0, 15),
				overlay(GLANCE, SMOKE[1]!, 0, 15),
			],
		},
	},
};
