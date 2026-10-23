import { ART } from "./mascot/art";

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
// The mascot is hand-authored pixel art (`mascot/art.ts`). Each terminal cell
// carries two art pixels as a half block (`▀`, foreground on top, background
// below), so a square art pixel stays square in a cell that is twice as tall as
// it is wide. Frames are palette indices: `0` is transparent, `1`-`9` index
// PALETTE. Every frame shares the same 14x9 art-pixel canvas, which keeps the
// widget height fixed when the state (and so the animation) changes.

/** Artwork column count; the canvas is shared by every animation. */
const ART_WIDTH = ART.cols;
/** Terminal rows the artwork occupies: two art pixels per cell. */
const ART_ROWS = Math.ceil(ART.pxRows / 2);
/** Animation per mascot state: a dozing puddle while waiting, a coffee sip while the agent works. */
const IDLE_ANIM = "idle";
const WORKING_ANIM = "working";
/** Rows the bubble spans, vertically centred on the mascot. */
const BUBBLE_TOP = 1;
/** Fixed inner width so the frame never jitters as the label and dots change. */
const BUBBLE_INNER = 24;

/** Timer granularity: animation frames advance every other tick, i.e. 220 ms. */
const TICK_MS = 110;
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
	on(event: "tool_execution_start", handler: (event: { toolName?: string }, ctx: SessionContext) => unknown): void;
	on(event: "input", handler: (event: { text?: string; source?: string }, ctx: SessionContext) => unknown): void;
	on(
		event:
			| "session_start"
			| "session_shutdown"
			| "agent_start"
			| "tool_execution_end"
			| "agent_end",
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

	#build(width: number): readonly string[] {
		const working = this.#state.kind === "working";
		const label = working ? this.#state.label : "";
		const art = ART.anims[working ? WORKING_ANIM : IDLE_ANIM] ?? ART.anims[IDLE_ANIM]!;
		const grid = art.frames[this.#frame % art.frames.length]!;
		const truecolor = this.#theme.getColorMode?.() === "truecolor";
		const gap = "  ";
		const roomForBubble = width >= ART_WIDTH + gap.length + BUBBLE_INNER + 2;
		// Narrow terminal: the mascot alone, clipped by columns so no escape is cut.
		const artCols = roomForBubble ? ART_WIDTH : Math.min(ART_WIDTH, width);

		const artRows: string[] = [];
		for (let row = 0; row < ART_ROWS; row++) {
			let line = "";
			for (let col = 0; col < artCols; col++) {
				const topIndex = grid[row * 2]![col]!;
				const bottomIndex = grid[row * 2 + 1]?.[col] ?? "0";
				const top = topIndex === "0" ? null : (ART.palette[parseInt(topIndex, 36) - 1] ?? null);
				const bottom = bottomIndex === "0" ? null : (ART.palette[parseInt(bottomIndex, 36) - 1] ?? null);
				line += this.#cell(top, bottom, truecolor);
			}
			artRows.push(line);
		}
		if (!roomForBubble) return artRows;

		// One dot per sprite frame (220 ms), so a 4-dot cycle lasts a beat.
		const dotFrame = this.#frame % DOT_FRAMES;
		const bubbleText = working
			? `${truncatePlain(label, BUBBLE_INNER - 3)}${".".repeat(dotFrame)}`
			: "…";
		const border = working ? "accent" : "dim";
		const bubble = [
			this.#theme.fg(border, `╭${"─".repeat(BUBBLE_INNER)}╮`),
			`${this.#theme.fg(border, "│")} ${this.#theme.fg(working ? "accent" : "dim", bubbleText.padEnd(BUBBLE_INNER - 2))} ${this.#theme.fg(border, "│")}`,
			this.#theme.fg(border, `╰${"─".repeat(BUBBLE_INNER)}╯`),
		];

		return artRows.map((row, index) => {
			const bubbleLine = bubble[index - BUBBLE_TOP];
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
			state = { kind: "working", label: "Thinking" };
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
			// One frame per two ticks (220 ms): at 110 ms the coffee smoke boils
			// too fast to read as smoke, and the sleeping puddle needs even less.
			ticks++;
			if (ticks % 2 !== 0) return;
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
			state = { kind: "working", label: event.toolName ?? "Working" };
			frame = 0;
			paint();
		});
		pi.on("tool_execution_end", () => {
			state = { kind: "working", label: "Thinking" };
			paint();
		});
		pi.on("agent_end", () => setIdle());
		pi.on("session_shutdown", () => {
			ctx.clearTimer(timer);
			if (wakeup !== undefined) ctx.clearTimer(wakeup);
		});
	});
}
