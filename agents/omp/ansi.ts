import { runs } from "../../core/runs";
import type { Cell } from "../../core/types";

export interface ThemeLike {
	fg(color: string, text: string): string;
	getColorMode?(): string;
}

/** Escape sequences are pure functions of (mode, hex) and repeat across frames. */
const paintCache = new Map<string, { fg: string; bg: string }>();

function paintCodes(hex: string, truecolor: boolean): { fg: string; bg: string } {
	const key = `${truecolor ? 1 : 0}${hex}`;
	const cached = paintCache.get(key);
	if (cached) return cached;
	const fg = Bun.color(hex, truecolor ? "ansi-16m" : "ansi-256") ?? "";
	const codes = { fg, bg: fg.replace("[38;", "[48;") };
	paintCache.set(key, codes);
	return codes;
}

/** One row of cells as an ANSI line; a run of cells sharing a colour pair carries one set of escapes. */
export function paintRow(cells: readonly Cell[], theme: ThemeLike, truecolor: boolean): string {
	let line = "";
	for (const { text, fg, bg, dim } of runs(cells)) {
		if (!bg && text.trim() === "") line += text;
		else if (dim) line += theme.fg("dim", text);
		else if (!fg) line += bg ? `${paintCodes(bg, truecolor).bg}${text}\x1b[49m` : text;
		else if (!bg) line += `${paintCodes(fg, truecolor).fg}${text}\x1b[39m`;
		else line += `${paintCodes(fg, truecolor).fg}${paintCodes(bg, truecolor).bg}${text}\x1b[39m\x1b[49m`;
	}
	return line;
}
