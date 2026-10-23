// Hand-authored mascot art. Row strings are the pixel grid: `0` is
// transparent, `1`-`9` index PALETTE. Every frame shares one canvas so the
// widget height never changes between states; the dozing puddle and the
// thinking steam both move within that fixed grid.

export const ART_COLS = 14;
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
	"00000000000000",
	"00000000000000",
	"00000000000000",
	"00000000000000",
	"00002222220000",
	"00251111115200",
	"02111111111120",
	"21113311331112",
	"22111111111122",
];

/** A little `z` that drifts up over the puddle while it sleeps. */
const Z = ["666", "060", "666"];

/**
 * Thinking pose: the mascot holds a mug in its right hand. The squat body sits
 * on the same baseline as the idle puddle; the smoke is overlaid per frame so
 * the column above the mug stays free for it to rise through.
 */
const THINK = [
	"00000000000000",
	"00000000000000",
	"00000000000000",
	"00022220000000",
	"00251111200000",
	"02131113120000",
	"02111111120880",
	"21111111112777",
	"21111111112770",
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
const GLANCE = THINK.map(row => row.replace("02131113120000", "02113111320000"));

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
const DOZING = overlay(PUDDLE, Z, 1, 9);

/** The `z` at the top of its drift, held for a beat. */
const DOZE = overlay(PUDDLE, Z, 0, 9);

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
				overlay(THINK, SMOKE[0]!, 0, 11),
				overlay(THINK, SMOKE[1]!, 0, 11),
				overlay(BLINK, SMOKE[0]!, 0, 11),
				overlay(GLANCE, SMOKE[1]!, 0, 11),
				overlay(GLANCE, SMOKE[0]!, 0, 11),
				overlay(GLANCE, SMOKE[1]!, 0, 11),
			],
		},
	},
};
