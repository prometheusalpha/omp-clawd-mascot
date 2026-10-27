/**
 * Which art system both hosts paint. `clawd` is the ported Claude Code mascot
 * (`mascot/clawd.ts`); `puddle` is the hand-authored half-block art
 * (`mascot/art.ts`). The omp widget and the Claude Code plugin both read this,
 * so the two hosts cannot drift apart.
 */
export const MASCOT: "clawd" | "puddle" = "clawd";
