import type { Cell, Mascot } from "../../core/types";
import { ART } from "./art";

/** 220 ms keeps the coffee smoke from boiling. */
const FRAME_MS = 220;

function color(index: string): string | undefined {
	return index === "0" ? undefined : ART.palette[parseInt(index, 36) - 1];
}

/** Two art pixels per terminal cell, as a half block: foreground above, background below. */
function halfBlock(top: string, bottom: string): Cell {
	const fg = color(top);
	const bg = color(bottom);
	if (fg && bg) return { char: "▀", fg, bg };
	if (fg) return { char: "▀", fg };
	if (bg) return { char: "▄", fg: bg };
	return { char: " " };
}

export const puddle: Mascot = {
	cols: ART.cols,
	rows: Math.ceil(ART.pxRows / 2),
	frameMs: FRAME_MS,
	frame(state, step) {
		const { frames } = ART.anims[state]!;
		const grid = frames[step % frames.length]!;
		return Array.from({ length: this.rows }, (_, row) =>
			Array.from({ length: this.cols }, (_, col) => halfBlock(grid[row * 2]![col]!, grid[row * 2 + 1]?.[col] ?? "0")),
		);
	},
};
