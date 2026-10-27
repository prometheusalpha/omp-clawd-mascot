import type { Cell, Mascot } from "../../core/types";
import { AUTOPLAY, BODY_COLS, BODY_ROWS, FRAME_MS, SEQUENCES } from "./data";
import { clawdFrame, type Paint } from "./pose";

/** Clawd's palette, verbatim from Claude Code's theme (`clawd_body`, `clawd_background`). */
const HEX = { body: "#d77757", background: "#000000" } as const;

/** Playlists per state: Claude's autoplay loop, and the tapping feet it uses while busy. */
const ANIMS = { idle: AUTOPLAY, working: SEQUENCES.tap } as const;

function hex(paint: Paint): string {
	return paint === "background" ? HEX.background : HEX.body;
}

/**
 * Blank cells keep the body colour as `fg`: a space paints the same either way,
 * and this way it joins the neighbouring body glyphs into one run.
 */
export const clawd: Mascot = {
	cols: BODY_COLS,
	rows: BODY_ROWS,
	frameMs: FRAME_MS,
	frame(state, step, options) {
		// Claude swaps the whole body for eye-only art where block glyphs render unevenly.
		return clawdFrame(ANIMS[state], step, options?.unevenBlocks === true).map(row =>
			row.map((cell): Cell => {
				if (cell.fg === "inactive") return { char: cell.glyph, dim: true };
				return cell.bg === null
					? { char: cell.glyph, fg: hex(cell.fg) }
					: { char: cell.glyph, fg: hex(cell.fg), bg: hex(cell.bg) };
			}),
		);
	},
};
