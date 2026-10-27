// The contract between the two axes: a mascot turns (state, step) into a grid
// of cells with resolved colours, and an agent paints that grid on its own
// surface. Neither side knows the other, so adding a mascot touches no agent and
// adding an agent touches no mascot.
//
// Agents run in different sandboxes (the Claude Code plugin has no `Bun`), so
// nothing under `core/` or `mascots/` may touch host globals; anything a mascot
// needs from the host arrives through `FrameOptions`.

/** One terminal cell. Colours are `#rrggbb`; a missing `fg`/`bg` leaves the terminal's own. */
export type Cell = {
	readonly char: string;
	readonly fg?: string;
	readonly bg?: string;
	/** Painted in the agent's dim style instead of a colour (dust, shadows). */
	readonly dim?: boolean;
};

/** `rows` rows of `cols` cells; every frame of a mascot shares one canvas. */
export type Frame = readonly (readonly Cell[])[];

/** The two states every agent can report. */
export type MascotState = "idle" | "working";

/** What the agent knows about its terminal that a mascot may adapt to. */
export type FrameOptions = {
	/** Block glyphs render unevenly (Apple Terminal); a mascot may swap for safer art. */
	readonly unevenBlocks?: boolean;
};

export interface Mascot {
	readonly cols: number;
	readonly rows: number;
	/** How long one step lasts; agents tick at this rate. */
	readonly frameMs: number;
	/** Step `step` of the `state` loop, wrapping. */
	frame(state: MascotState, step: number, options?: FrameOptions): Frame;
}
