import { ART } from "./mascot/art";
import { BODY_COLS, CLAWD_ANIMS, FRAME_MS, clawdFrame, type ClawdCell } from "./mascot/clawd";
import { MASCOT } from "./mascot/config";

// Mascot + speech bubble docked directly above the composer.
//
// omp's working row (`statusContainer`) is core-owned: extensions can only
// change its message text (setWorkingMessage), never its leading glyph, and
// nothing can unmount it. `setWidget(..., { placement: "aboveEditor" })` is the
// only extension surface that paints in that band, so the mascot lives there
// and mirrors the state the working row is the sole carrier of otherwise.
//
// Repaint: the widget factory's first argument is the extension UI context, not
// a TUI (no requestRender). Re-calling setWidget rebuilds the widget container
// and requests a render, which is how each animation frame gets painted.
//
// Two art systems render here, picked by `MASCOT` (mascot/config.ts, shared with
// the Claude Code plugin): a glyph grid (mascot/clawd.ts) or hand-authored pixel
// art (mascot/art.ts). For the pixel art, each terminal cell carries two art
// pixels as a half block (`▀`, foreground on top, background below). A half-block
// pixel is taller than it is wide in this terminal (~17x47 px cells), so that art
// is authored 19 columns wide to compensate instead of resampling columns at
// render time, which made the strokes uneven. Its frames are palette indices:
// `0` is transparent, `1`-`9` index PALETTE. Every frame of a given system shares
// one canvas, which keeps the widget height fixed when the state changes.

/** Puddle artwork column count; the canvas is shared by every animation. */
const ART_WIDTH = ART.cols;
/** Puddle terminal rows: two art pixels per cell. */
const ART_ROWS = Math.ceil(ART.pxRows / 2);

/** Animation per puddle state: a dozing puddle while waiting, a coffee sip while the agent works. */
const IDLE_ANIM = "idle";
const WORKING_ANIM = "working";

/** Claude swaps Clawd for eyes-only art on Apple Terminal; block glyphs render unevenly there. */
const SIMPLE_BODY = Bun.env.TERM_PROGRAM === "Apple_Terminal";

/** Clawd's palette, verbatim from Claude Code's theme (`clawd_body`, `clawd_background`). */
const CLAWD_BODY = "#d77757";
const CLAWD_BACKGROUND = "#000000";
/** Narrowest inner width; below this the mascot paints alone. */
const BUBBLE_MIN_INNER = 24;
/** Widest inner width: past this the eye has to travel farther than it reads. */
const BUBBLE_MAX_INNER = 64;
/** Core's own working-row text before any tool reports an intent. */
const DEFAULT_LABEL = "Working";

/**
 * Timer granularity, and how many ticks one animation frame lasts. Clawd's
 * playlists tick every 60 ms in Claude, so it advances every tick; the puddle's
 * 220 ms cadence keeps the coffee smoke from boiling.
 */
const TICK_MS = MASCOT === "clawd" ? FRAME_MS : 110;
const TICKS_PER_FRAME = MASCOT === "clawd" ? 1 : 2;
const DOT_FRAMES = 4;
const WIDGET_KEY = "mascot-bubble";
/**
 * How long a submitted prompt may sit before `agent_start` before the bubble
 * gives up and goes back to idle. Covers commands and `!` bash runs that the
 * `input` filter misses, and an aborted submission.
 */
const START_TIMEOUT_MS = 20_000;

type MascotState = { readonly kind: "idle" } | { readonly kind: "working"; readonly label: string };

interface ThemeLike {
	fg(color: string, text: string): string;
	getColorMode?(): string;
}

interface SessionContext {
	mode: string;
	hasUI: boolean;
	/** Subagent sessions share the process but not the composer; only the main agent paints the widget. */
	agent?: { kind?: "main" | "sub" };
	ui: {
		setWidget(
			key: string,
			factory: (tui: SessionContext["ui"], theme: ThemeLike) => MascotBubble,
			options?: { placement?: "aboveEditor" | "belowEditor" },
		): void;
	};
	setInterval(callback: () => void, ms: number): TimerHandle;
	setTimeout(callback: () => void, ms: number): TimerHandle;
	clearTimer(handle: TimerHandle): void;
}

type TimerHandle = unknown;

/** Only the events this extension consumes; the host API accepts these handlers. */
interface MascotExtensionAPI {
	on(
		event: "tool_execution_start",
		handler: (event: { toolName?: string; intent?: string }, ctx: SessionContext) => unknown,
	): void;
	on(event: "input", handler: (event: { text?: string; source?: string }, ctx: SessionContext) => unknown): void;
	on(
		event: "session_start" | "session_shutdown" | "agent_start" | "agent_end",
		handler: (event: unknown, ctx: SessionContext) => unknown,
	): void;
}

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

class MascotBubble {
	readonly #theme: ThemeLike;
	readonly #state: MascotState;
	readonly #frame: number;
	#cache: readonly string[] = [];
	#cacheWidth = -1;

	constructor(theme: ThemeLike, state: MascotState, frame: number) {
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

	/** Half-block cell: top art pixel as foreground, bottom as background. */
	#cell(top: string | null, bottom: string | null, truecolor: boolean): string {
		if (!top && !bottom) return " ";
		if (!bottom) return `${paintCodes(top, truecolor).fg}▀\x1b[39m`;
		if (!top) return `${paintCodes(bottom, truecolor).fg}▄\x1b[39m`;
		return `${paintCodes(top, truecolor).fg}${paintCodes(bottom, truecolor).bg}▀\x1b[39m\x1b[49m`;
	}

	#clawdRows(working: boolean, columns: number, truecolor: boolean): readonly string[] {
		const anim = working ? CLAWD_ANIMS.working : CLAWD_ANIMS.idle;
		return clawdFrame(anim, this.#frame, SIMPLE_BODY).map(row => this.#paintRow(row.slice(0, columns), truecolor));
	}

	#puddleRows(working: boolean, columns: number, truecolor: boolean): readonly string[] {
		const art = ART.anims[working ? WORKING_ANIM : IDLE_ANIM] ?? ART.anims[IDLE_ANIM]!;
		const grid = art.frames[this.#frame % art.frames.length]!;
		const rows: string[] = [];
		for (let row = 0; row < ART_ROWS; row++) {
			let line = "";
			for (let col = 0; col < columns; col++) {
				const topIndex = grid[row * 2]![col]!;
				const bottomIndex = grid[row * 2 + 1]?.[col] ?? "0";
				const top = topIndex === "0" ? null : (ART.palette[parseInt(topIndex, 36) - 1] ?? null);
				const bottom = bottomIndex === "0" ? null : (ART.palette[parseInt(bottomIndex, 36) - 1] ?? null);
				line += this.#cell(top, bottom, truecolor);
			}
			rows.push(line);
		}
		return rows;
	}

	/** One run of cells that share a colour pair, so a row carries a handful of escapes, not one per cell. */
	#paintRun(cells: readonly ClawdCell[], truecolor: boolean): string {
		const text = cells.map(cell => cell.glyph).join("");
		const { fg, bg } = cells[0]!;
		if (!bg && text.trim() === "") return text;
		if (fg === "inactive") return this.#theme.fg("dim", text);
		const fgCode = paintCodes(fg === "body" ? CLAWD_BODY : CLAWD_BACKGROUND, truecolor).fg;
		if (bg === null) return `${fgCode}${text}\x1b[39m`;
		const bgCode = paintCodes(bg === "body" ? CLAWD_BODY : CLAWD_BACKGROUND, truecolor).bg;
		return `${fgCode}${bgCode}${text}\x1b[39m\x1b[49m`;
	}

	#paintRow(cells: readonly ClawdCell[], truecolor: boolean): string {
		let line = "";
		let run: ClawdCell[] = [];
		const flush = () => {
			if (run.length === 0) return;
			line += this.#paintRun(run, truecolor);
			run = [];
		};
		for (const cell of cells) {
			const previous = run.at(-1);
			if (previous && previous.fg === cell.fg && previous.bg === cell.bg) run.push(cell);
			else {
				flush();
				run.push(cell);
			}
		}
		flush();
		return line;
	}

	#build(width: number): readonly string[] {
		const working = this.#state.kind === "working";
		const label = working ? this.#state.label : "";
		const truecolor = this.#theme.getColorMode?.() === "truecolor";
		const gap = "  ";
		const artWidth = MASCOT === "clawd" ? BODY_COLS : ART_WIDTH;
		// The bubble takes whatever the terminal leaves after the art, up to a readable cap.
		const available = width - artWidth - gap.length - 2;
		const roomForBubble = available >= BUBBLE_MIN_INNER;
		// Narrow terminal: the mascot alone, clipped by columns so no escape is cut.
		const artCols = roomForBubble ? artWidth : Math.min(artWidth, width);

		const artRows =
			MASCOT === "clawd"
				? this.#clawdRows(working, artCols, truecolor)
				: this.#puddleRows(working, artCols, truecolor);
		if (!roomForBubble) return artRows;

		const inner = Math.min(BUBBLE_MAX_INNER, available);
		const textWidth = inner - 2;
		// One dot per sprite frame (220 ms), so a 4-dot cycle lasts a beat.
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

export default function (pi: MascotExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		if (ctx.mode !== "tui" || !ctx.hasUI || ctx.agent?.kind === "sub") return;

		let state: MascotState = { kind: "idle" };
		let frame = 0;
		let wakeup: TimerHandle | undefined;

		const paint = () => {
			ctx.ui.setWidget(WIDGET_KEY, (_tui, theme) => new MascotBubble(theme, state, frame), {
				placement: "aboveEditor",
			});
		};

		const startWorking = () => {
			if (state.kind === "working") return;
			state = { kind: "working", label: DEFAULT_LABEL };
			frame = 0;
			paint();
		};

		const setIdle = () => {
			if (wakeup !== undefined) {
				ctx.clearTimer(wakeup);
				wakeup = undefined;
			}
			if (state.kind === "idle") return;
			state = { kind: "idle" };
			frame = 0;
			paint();
		};

		/** Enter reaches `input` seconds before `agent_start` (auth, recall and request setup run in between), so the bubble reacts to the submission, not the agent loop. */
		const armWakeupWatchdog = () => {
			if (wakeup !== undefined) ctx.clearTimer(wakeup);
			wakeup = ctx.setTimeout(() => {
				wakeup = undefined;
				setIdle();
			}, START_TIMEOUT_MS);
		};

		paint();

		let ticks = 0;
		const timer = ctx.setInterval(() => {
			ticks++;
			if (ticks % TICKS_PER_FRAME !== 0) return;
			frame++;
			paint();
		}, TICK_MS);

		pi.on("input", event => {
			// Slash commands and `!` bash mode never run a model turn; a turn that
			// stalls before `agent_start` falls back to idle via the watchdog.
			const text = event.text?.trim() ?? "";
			if (!text || text.startsWith("/") || text.startsWith("!")) return;
			startWorking();
			armWakeupWatchdog();
		});
		pi.on("agent_start", () => {
			if (wakeup !== undefined) {
				ctx.clearTimer(wakeup);
				wakeup = undefined;
			}
			startWorking();
		});
		pi.on("tool_execution_start", event => {
			// `intent` is the same string the core working row displays; the row
			// keeps it after the tool ends, so the bubble does too.
			state = { kind: "working", label: event.intent?.trim() || event.toolName || DEFAULT_LABEL };
			frame = 0;
			paint();
		});
		pi.on("agent_end", () => setIdle());
		pi.on("session_shutdown", () => {
			ctx.clearTimer(timer);
			if (wakeup !== undefined) ctx.clearTimer(wakeup);
		});
	});
}
