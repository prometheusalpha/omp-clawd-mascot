# omp-clawd-mascot

Animated mascot for [omp](https://github.com/can1357/oh-my-pi) and Claude Code. In omp it docks directly above the composer with a speech bubble that mirrors what the agent is doing; in Claude Code it replaces the working spinner and sits above the prompt while idle.

Two mascots are wired; `MASCOT_NAME` in `config.ts` picks one for every agent:

- **Clawd** (default) — the Claude Code mascot as a 9 × 3 glyph grid in Claude's orange. Idle plays Claude's autoplay loop (twelve still beats, then a look each way); working plays its foot-tapping loop. Ported from a shipped Claude Code build; see [Clawd](#clawd).
- **Puddle** — the hand-authored sprite set: idle dozes as a puddle with a drifting `z`, working holds a mug whose steam boils, blinking once and glancing at the mug per cycle.
- Either way the bubble shows `…` while idle and repeats the core working row's text (the tool intent, `Working` before any tool) with animated dots.
- Narrow terminals (under 37 columns with Clawd, 47 with the puddle) drop the bubble and keep the mascot.
- Only the main TUI session draws it; subagent sessions share the process but not the composer.

## Requirements

- omp with `ui.setWidget(..., { placement: "aboveEditor" })` — tested on `v18.12.6`.
- A terminal with ANSI colour support; truecolor is used when the theme reports it, 256-colour otherwise.
- [Bun](https://bun.sh) only if you want to regenerate the preview image.

No build step is required: every module is plain TypeScript that loads through the host's own module graph.

## Install

The omp extension is `agents/omp/index.ts`, and it imports `config.ts`, `core/` and `mascots/` from the same checkout. The root `package.json` declares that entry under `omp.extensions`, so omp can load the whole folder. Pick one of the three options below.

### 1. Load from this checkout for one session

```sh
omp -e /absolute/path/to/omp-clawd-mascot
```

`-e` is additive and repeatable; it does not install anything permanently.

### 2. Register it in the omp config (recommended)

Add the checkout to your agent config — `~/.omp/agent/config.yml` (or `~/.omp/profiles/<name>/agent/config.yml` for a named profile):

```yaml
extensions:
  - /absolute/path/to/omp-clawd-mascot
```

Keep any existing entries: the effective `extensions` array is replaced, not concatenated, across settings layers.

### 3. Link into the extension directory

```sh
mkdir -p ~/.omp/agent/extensions
ln -s /absolute/path/to/omp-clawd-mascot ~/.omp/agent/extensions/omp-mascot
```

omp scans one level into that directory, and a subfolder whose `package.json` declares `omp.extensions` loads just those entries, so this persists across sessions. Link the whole checkout, not single files: the entry imports its siblings by relative path. Named profiles use their own `~/.omp/profiles/<name>/agent/extensions/`, so link there too if you use them.

### Verify

Start `omp` in a terminal. The mascot appears above the composer immediately; submit a prompt and the bubble should show `Working`, then the same text as the working row as tools run. If it does not appear:

- confirm you are in the TUI (not `-p`/`--mode rpc`), where `ctx.hasUI` is true;
- check that omp is pointed at the checkout folder (or `agents/omp/index.ts` inside it) and that `package.json` is still there;
- run with `--no-extensions` to confirm the flag is not disabling discovery.

### Uninstall

- Option 1: drop the `-e` flag.
- Option 2: remove the entry from `extensions:`.
- Option 3: delete the `~/.omp/agent/extensions/omp-mascot` link.

## How it works

The repo has two axes that only meet in `core/types.ts`:

- a **mascot** (`mascots/<name>/`) turns `(state, step)` into a `Frame`: a grid of cells, each a character with resolved `#rrggbb` colours or a `dim` flag;
- an **agent** (`agents/<name>/`) maps its host's events onto the `idle` / `working` states, ticks at the mascot's `frameMs`, and paints frames on its own surface.

```text
mascots/clawd/data.ts ──> pose.ts ──> index.ts ──┐
mascots/puddle/art.ts ──────────────> index.ts ──┼──> mascots/index.ts ──> config.ts ──┬──> agents/omp/       (ANSI widget + bubble)
                    └── preview.ts ──> preview.png                                     └──> agents/claude-code/ (Ink spinner + band)
core/types.ts, core/runs.ts: the Frame contract and the run grouping both agents share
```

- Nothing under `core/` or `mascots/` touches host globals: the Claude Code plugin runs in a sandbox without `Bun`. What a mascot needs from the host arrives as `FrameOptions` (today only `unevenBlocks`, set by omp on Apple Terminal).
- Every frame of a mascot shares one canvas, so the widget height never changes between states: 9 × 3 cells for Clawd, 19 × 5 cells (19 × 9 art pixels) for the puddle.
- omp: `session_start` builds a widget factory and re-invokes `ui.setWidget` on every tick; re-setting the widget is what requests the repaint. The tick is the mascot's `frameMs`: 60 ms for Clawd (Claude's own cadence), 220 ms for the puddle.
- Puddle cells carry two art pixels each as a half block (`▀`, foreground above, background below). A half block is taller than wide in this terminal (~17 × 47 px cells), so the artwork is authored 19 columns wide instead of resampled at render time, which kept the strokes even. The preview uses the same pixel aspect, so `preview.png` matches the TUI.
- Puddle frames are palette indices: `0` is transparent; `1`–`9` (base36) index `PALETTE` in `art.ts`.
- The puddle's working pose is a fixed body with the mug, hand and eyes on one grid; only the smoke, blink and glance frames change. The smoke is three single-cell puffs two art rows apart, and every frame swaps the arrangement for its left-right mirror, so the plume boils without ever settling. The idle pose stays a `PUDDLE` grid the whole loop, with the `z` drifting over it.

## Extending

Add a mascot:

1. Create `mascots/<name>/index.ts` exporting a `Mascot` (`cols`, `rows`, `frameMs`, `frame(state, step, options)`); keep its art and data beside it.
2. Register it in `MASCOTS` (`mascots/index.ts`).
3. Point `MASCOT_NAME` in `config.ts` at it.

No agent changes: both agents paint any `Frame`.

Add an agent:

1. Create `agents/<name>/` with the host's entry module.
2. Import `MASCOT` from `config.ts`, call `MASCOT.frame(state, step, options)` every `MASCOT.frameMs`, and paint the cells; `runs()` in `core/runs.ts` groups a row into spans that share colours.
3. Register the entry with the host (a manifest beside the repo root, as `package.json` does for omp and `hooks/hooks.json` for Claude Code).

No mascot changes: every mascot draws on the new agent.

## Clawd

`mascots/clawd/` renders what Claude Code draws at startup, so its shapes are not invented: a frame is 3 rows of 9 block glyphs painted with one body colour, and a pose only decides which glyphs land where.

- Arm, eye and feet sprites compose the body; eye spans paint the background colour behind their glyphs, eyelid spans invert body and background, so the eyes read as holes in the silhouette rather than as strokes.
- `facing` poses (`right-12` … `left-12`) replace the whole grid with a side or back view: a body-coloured glyph row with a background-coloured window punched through it.
- `pose.ts` resolves a frame into colour roles (`body`, `background`, `inactive`) and `index.ts` maps them to Claude's palette. Frames come from the playlists in `data.ts`. A frame may carry `offset` (bounce down, clipped), `x` (walk left, clipped), `poof` (dust at the feet) and `shadow` (ground line under a hop).
- `ANIMS` in `index.ts` maps the two states to playlists: `idle` is Claude's 22-frame autoplay loop, `working` is its 14-frame foot tap. The other 13 one-shots (jump, peekaboo, waddle, turn, coin-hop, …) are exported and unused.
- When an agent passes `unevenBlocks` (omp on Apple Terminal), Clawd swaps the body for Claude's eyes-only fallback, because block glyphs render unevenly there. The Claude Code plugin runs in a sandbox without `Bun`, cannot tell, and always draws the full body.

Provenance: the glyph tables and playlists were extracted from the shipped Claude Code v2.1.311 bundle; each table in `data.ts` names the minified original it came from (`jo`, `Xe`, `Je`, `Qe`, `eo`, `Jo`, `Ju`), so a re-extraction can be diffed against it.

## Development

Edit `mascots/puddle/art.ts` directly — it is the source of truth for the puddle art. Row strings are the pixel grid; `PUDDLE` is the sleeping pose and each animation lists the frames in play order. `mascots/clawd/data.ts` is data, not hand art: change it only when the ported tables change, and keep the minified names in the comments.

To look at the puddle art outside the TUI:

```sh
bun mascots/puddle/preview.ts   # art.ts -> mascots/puddle/preview.png
```

`preview.png` lays every animation out as a row of frames, scaled up with nearest-neighbour at the terminal's pixel aspect (tall half-blocks, not square pixels), so the sheet shows what the TUI shows. The PNG is written by `preview.ts` with a minimal encoder, so no image tooling is required.

Which animation a state uses is chosen inside each mascot: `ART.anims` keys for the puddle, `ANIMS` in `mascots/clawd/index.ts` for Clawd.

The Claude Code agent runs under Claude Code's own harness:

```sh
claude plugin test .        # mounts Spinner/AbovePrompt and asserts the mascot draws
claude plugin validate .     # what the engine will accept from the manifest and hooks
```

## Files

| Path | Purpose |
|---|---|
| `config.ts` | `MASCOT_NAME`, the mascot every agent paints |
| `core/types.ts` | `Cell`, `Frame`, `Mascot`: the contract between mascots and agents |
| `core/runs.ts` | Groups a row into spans that share colours, for both agents |
| `mascots/index.ts` | `MASCOTS`, the registry `config.ts` picks from |
| `mascots/clawd/index.ts` | Clawd as a `Mascot`: playlists per state, palette |
| `mascots/clawd/pose.ts` | Clawd pose → cell renderer with colour roles |
| `mascots/clawd/data.ts` | Clawd glyph, pose and playlist tables (extracted, not hand-authored) |
| `mascots/puddle/index.ts` | The puddle as a `Mascot`: art pixels → half-block cells |
| `mascots/puddle/art.ts` | Hand-authored palette-indexed puddle frames |
| `mascots/puddle/preview.ts` | Renders `art.ts` to `preview.png` |
| `mascots/puddle/preview.png` | Generated preview sheet, one row per animation |
| `agents/omp/index.ts` | omp extension entry: event wiring, animation timer |
| `agents/omp/bubble.ts` | omp widget: mascot plus speech bubble |
| `agents/omp/ansi.ts` | Paints cells as ANSI escapes |
| `agents/claude-code/register.tsx` | Claude Code plugin entry: hooks the spinner and above-prompt bands |
| `package.json` | Declares the omp entry (`omp.extensions`) |
| `hooks/hooks.json` | Declares the Claude Code entry |
| `tests/mascot.test.tsx` | Claude Code plugin tests over the plugin harness |
