import type { Mascot } from "../core/types";
import { clawd } from "./clawd";
import { puddle } from "./puddle";

/** Every mascot an agent can paint; `config.ts` picks one by name. */
export const MASCOTS = { clawd, puddle } satisfies Record<string, Mascot>;

export type MascotName = keyof typeof MASCOTS;
