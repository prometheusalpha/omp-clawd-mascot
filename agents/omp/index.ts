import { MASCOT } from "../../config";
import type { ThemeLike } from "./ansi";
import { type BubbleState, MascotBubble } from "./bubble";

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
// What it draws is `MASCOT` (config.ts, shared with the Claude Code plugin);
// this file only maps omp's events onto the idle/working states and paints.

/** Core's own working-row text before any tool reports an intent. */
const DEFAULT_LABEL = "Working";

const WIDGET_KEY = "mascot-bubble";
/**
 * How long a submitted prompt may sit before `agent_start` before the bubble
 * gives up and goes back to idle. Covers commands and `!` bash runs that the
 * `input` filter misses, and an aborted submission.
 */
const START_TIMEOUT_MS = 20_000;

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

export default function (pi: MascotExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		if (ctx.mode !== "tui" || !ctx.hasUI || ctx.agent?.kind === "sub") return;

		let state: BubbleState = { kind: "idle" };
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

		const timer = ctx.setInterval(() => {
			frame++;
			paint();
		}, MASCOT.frameMs);

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
