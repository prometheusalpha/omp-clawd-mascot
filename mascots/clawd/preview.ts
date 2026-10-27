// Renders every Clawd playlist to `preview.png` beside it: one labelled row per
// animation, one column per frame. Unlike the puddle, Clawd is glyphs, so each
// glyph is rasterised here instead of read from a font: the quadrant blocks are
// plain 2x2 geometry, and the four others (`▁▂·~`) are drawn by hand below.
// Cells use the terminal's 17x47 aspect, as the puddle sheet does.
// `bun mascots/clawd/preview.ts`.
import type { Frame } from "../../core/types";
import { encodePng } from "../../tools/png";
import { AUTOPLAY, SEQUENCES, type FrameSpec } from "./data";
import { HEX, paint } from "./index";
import { buildClawdFrame } from "./pose";

const CELL_W = 8;
const CELL_H = Math.round((CELL_W * 47) / 17);
const PAD = 24;
const GAP_X = 12;
const GAP_Y = 24;
/** Label pixels are 3x5 font cells scaled up by this. */
const FONT_SCALE = 4;

/** Outside a frame's canvas, so each 9x3 box stands out against the terminal black inside it. */
const GUTTER = "#1c1c1c";
const LABEL = "#b0b0b0";
/** Claude draws dust and shadows in its `inactive` grey; this is close enough for a preview. */
const DIM = "#888888";

/** Idle and working first, labelled by state; then every other one-shot under its own name. */
const ROWS: readonly (readonly [string, readonly FrameSpec[]])[] = [
	["idle", AUTOPLAY],
	["working tap", SEQUENCES.tap],
	...Object.entries(SEQUENCES).filter(([name]) => name !== "tap"),
];

/** Lit quadrants as top-left, top-right, bottom-left, bottom-right. */
const QUADRANTS: Record<string, string> = {
	" ": "0000",
	"█": "1111",
	"▀": "1100",
	"▄": "0011",
	"▌": "1010",
	"▐": "0101",
	"▘": "1000",
	"▝": "0100",
	"▖": "0010",
	"▗": "0001",
	"▛": "1110",
	"▜": "1101",
	"▙": "1011",
	"▟": "0111",
	"▚": "1001",
	"▞": "0110",
};

/** Whether pixel (x, y) of a cell is ink for `glyph`. Unknown glyphs throw so new art cannot vanish silently. */
function ink(glyph: string, x: number, y: number): boolean {
	const quadrant = QUADRANTS[glyph];
	if (quadrant !== undefined) return quadrant[(y < CELL_H / 2 ? 0 : 2) + (x < CELL_W / 2 ? 0 : 1)] === "1";
	switch (glyph) {
		case "▁":
			return y >= CELL_H - CELL_H / 8;
		case "▂":
			return y >= CELL_H - CELL_H / 4;
		case "·":
			return Math.abs(x - CELL_W / 2 + 0.5) < 1.5 && Math.abs(y - CELL_H / 2) < 1.5;
		case "~": {
			const wave = CELL_H / 2 - 2 * Math.sin(((x + 0.5) / CELL_W) * 2 * Math.PI);
			return Math.abs(y - wave) < 1.5;
		}
	}
	throw new Error(`no raster for glyph ${JSON.stringify(glyph)}`);
}

// prettier-ignore
const FONT: Record<string, readonly string[]> = {
	" ": ["...", "...", "...", "...", "..."], "-": ["...", "...", "###", "...", "..."],
	a: [".#.", "#.#", "###", "#.#", "#.#"], b: ["##.", "#.#", "##.", "#.#", "##."],
	c: [".##", "#..", "#..", "#..", ".##"], d: ["##.", "#.#", "#.#", "#.#", "##."],
	e: ["###", "#..", "##.", "#..", "###"], g: [".##", "#..", "#.#", "#.#", ".##"],
	h: ["#.#", "#.#", "###", "#.#", "#.#"], i: ["###", ".#.", ".#.", ".#.", "###"],
	j: ["..#", "..#", "..#", "#.#", ".#."], k: ["#.#", "#.#", "##.", "#.#", "#.#"],
	l: ["#..", "#..", "#..", "#..", "###"], m: ["#.#", "###", "###", "#.#", "#.#"],
	n: ["##.", "#.#", "#.#", "#.#", "#.#"], o: [".#.", "#.#", "#.#", "#.#", ".#."],
	p: ["##.", "#.#", "##.", "#..", "#.."], r: ["##.", "#.#", "##.", "#.#", "#.#"],
	s: [".##", "#..", ".#.", "..#", "##."], t: ["###", ".#.", ".#.", ".#.", ".#."],
	u: ["#.#", "#.#", "#.#", "#.#", "###"], w: ["#.#", "#.#", "###", "###", "#.#"],
	y: ["#.#", "#.#", ".#.", ".#.", ".#."], z: ["###", "..#", ".#.", "#..", "###"],
};

const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

const frameW = 9 * CELL_W;
const frameH = 3 * CELL_H;
const labelW = Math.max(...ROWS.map(([label]) => label.length)) * 4 * FONT_SCALE + GAP_X;
const columns = Math.max(...ROWS.map(([, specs]) => specs.length));
const width = PAD * 2 + labelW + columns * frameW + (columns - 1) * GAP_X;
const height = PAD * 2 + ROWS.length * frameH + (ROWS.length - 1) * GAP_Y;
const rgba = new Uint8Array(width * height * 4);

function fill(x: number, y: number, w: number, h: number, hex: string): void {
	const [r, g, b] = rgb(hex);
	for (let dy = 0; dy < h; dy++) {
		let offset = ((y + dy) * width + x) * 4;
		for (let dx = 0; dx < w; dx++, offset += 4) {
			rgba[offset] = r;
			rgba[offset + 1] = g;
			rgba[offset + 2] = b;
			rgba[offset + 3] = 255;
		}
	}
}

function text(label: string, x: number, y: number): void {
	for (const [i, char] of [...label].entries()) {
		const glyph = FONT[char];
		if (!glyph) throw new Error(`no font glyph for ${JSON.stringify(char)}`);
		for (const [row, bits] of glyph.entries())
			for (let col = 0; col < 3; col++)
				if (bits[col] === "#")
					fill(x + (i * 4 + col) * FONT_SCALE, y + row * FONT_SCALE, FONT_SCALE, FONT_SCALE, LABEL);
	}
}

function drawFrame(frame: Frame, left: number, top: number): void {
	fill(left, top, frameW, frameH, HEX.background);
	for (const [row, cells] of frame.entries()) {
		for (const [col, cell] of cells.entries()) {
			const x0 = left + col * CELL_W;
			const y0 = top + row * CELL_H;
			const on = cell.dim ? DIM : cell.fg;
			for (let y = 0; y < CELL_H; y++)
				for (let x = 0; x < CELL_W; x++) {
					const color = ink(cell.char, x, y) ? on : cell.bg;
					if (color) fill(x0 + x, y0 + y, 1, 1, color);
				}
		}
	}
}

fill(0, 0, width, height, GUTTER);
for (const [index, [label, specs]] of ROWS.entries()) {
	const top = PAD + index * (frameH + GAP_Y);
	text(label, PAD, top + (frameH - 5 * FONT_SCALE) / 2);
	for (const [column, spec] of specs.entries()) {
		drawFrame(paint(buildClawdFrame(spec)), PAD + labelW + column * (frameW + GAP_X), top);
	}
}

await Bun.write(new URL("./preview.png", import.meta.url), encodePng(width, height, rgba));
console.log(`mascots/clawd/preview.png ${width}x${height}`);
