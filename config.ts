import type { Mascot } from "./core/types";
import { MASCOTS, type MascotName } from "./mascots";

/**
 * Which mascot every agent paints: `clawd` is the ported Claude Code mascot
 * (`mascots/clawd/`), `puddle` the hand-authored half-block art
 * (`mascots/puddle/`). The omp widget and the Claude Code plugin both read
 * this, so the two agents cannot drift apart.
 */
export const MASCOT_NAME: MascotName = "clawd";

export const MASCOT: Mascot = MASCOTS[MASCOT_NAME];
