import type { Cell } from "./types";

/** Consecutive cells that paint alike, joined into one span of text. */
export type Run = { text: string; fg?: string; bg?: string; dim: boolean };

/** Group a row so each agent emits a few spans per row instead of one per cell. */
export function runs(row: readonly Cell[]): Run[] {
	const out: Run[] = [];
	for (const cell of row) {
		const dim = cell.dim === true;
		const last = out.at(-1);
		if (last && last.fg === cell.fg && last.bg === cell.bg && last.dim === dim) last.text += cell.char;
		else out.push({ text: cell.char, fg: cell.fg, bg: cell.bg, dim });
	}
	return out;
}
