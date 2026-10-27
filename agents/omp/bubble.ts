import { MASCOT } from "../../config";
import { paintRow, type ThemeLike } from "./ansi";

/** Claude swaps Clawd for eyes-only art on Apple Terminal; block glyphs render unevenly there. */
const UNEVEN_BLOCKS = Bun.env.TERM_PROGRAM === "Apple_Terminal";

/** Narrowest inner width; below this the mascot paints alone. */
const BUBBLE_MIN_INNER = 24;
/** Widest inner width: past this the eye has to travel farther than it reads. */
const BUBBLE_MAX_INNER = 64;
const DOT_FRAMES = 4;

export type BubbleState = { readonly kind: "idle" } | { readonly kind: "working"; readonly label: string };

function truncatePlain(text: string, width: number): string {
	if (Bun.stringWidth(text) <= width) return text;
	let out = "";
	let used = 0;
	for (const char of text) {
		const w = Bun.stringWidth(char);
		if (used + w > width - 1) break;
		out += char;
		used += w;
	}
	return `${out}…`;
}

export class MascotBubble {
	readonly #theme: ThemeLike;
	readonly #state: BubbleState;
	readonly #frame: number;
	#cache: readonly string[] = [];
	#cacheWidth = -1;

	constructor(theme: ThemeLike, state: BubbleState, frame: number) {
		this.#theme = theme;
		this.#state = state;
		this.#frame = frame;
	}

	render(width: number): readonly string[] {
		if (width === this.#cacheWidth) return this.#cache;
		this.#cacheWidth = width;
		this.#cache = this.#build(width);
		return this.#cache;
	}

	invalidate(): void {
		this.#cacheWidth = -1;
	}

	#build(width: number): readonly string[] {
		const working = this.#state.kind === "working";
		const label = working ? this.#state.label : "";
		const truecolor = this.#theme.getColorMode?.() === "truecolor";
		const gap = "  ";
		// The bubble takes whatever the terminal leaves after the art, up to a readable cap.
		const available = width - MASCOT.cols - gap.length - 2;
		const roomForBubble = available >= BUBBLE_MIN_INNER;
		// Narrow terminal: the mascot alone, clipped by columns so no escape is cut.
		const artCols = roomForBubble ? MASCOT.cols : Math.min(MASCOT.cols, width);

		const artRows = MASCOT.frame(working ? "working" : "idle", this.#frame, { unevenBlocks: UNEVEN_BLOCKS }).map(row =>
			paintRow(row.slice(0, artCols), this.#theme, truecolor),
		);
		if (!roomForBubble) return artRows;

		const inner = Math.min(BUBBLE_MAX_INNER, available);
		const textWidth = inner - 2;
		// One dot per mascot frame, so a 4-dot cycle lasts a beat.
		const dots = this.#frame % DOT_FRAMES;
		// Mirrors the core working row: same text, same single line.
		const lines: readonly string[] = working
			? [`${truncatePlain(label, textWidth - 3)}${".".repeat(dots)}`]
			: ["…"];
		const border = working ? "accent" : "dim";
		const bubble = [
			this.#theme.fg(border, `╭${"─".repeat(inner)}╮`),
			...lines.map(
				line =>
					`${this.#theme.fg(border, "│")} ${this.#theme.fg(working ? "accent" : "dim", line + " ".repeat(Math.max(0, textWidth - Bun.stringWidth(line))))} ${this.#theme.fg(border, "│")}`,
			),
			this.#theme.fg(border, `╰${"─".repeat(inner)}╯`),
		];
		const top = Math.floor((artRows.length - bubble.length) / 2);

		return artRows.map((row, index) => {
			const bubbleLine = bubble[index - top];
			return bubbleLine === undefined ? row : `${row}${gap}${bubbleLine}`;
		});
	}
}
