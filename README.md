# omp-clawd-mascot

Animated mascot for [omp](https://github.com/can1357/oh-my-pi), docked directly above the composer with a speech bubble that mirrors what the agent is doing.

Two art systems are wired; `MASCOT` in `mascot-bubble.ts` picks one:

- **Clawd** (default) — the Claude Code mascot as a 9 × 3 glyph grid in Claude's orange. Idle plays Claude's autoplay loop (twelve still beats, then a look each way); working plays its foot-tapping loop. Ported from a shipped Claude Code build; see [Clawd](#clawd).
- **Puddle** — the hand-authored sprite set: idle dozes as a puddle with a drifting `z`, working holds a mug whose steam boils, blinking once and glancing at the mug per cycle.
- Either way the bubble shows `…` while idle and repeats the core working row's text (the tool intent, `Working` before any tool) with animated dots.
- Narrow terminals (under 37 columns with Clawd, 47 with the puddle) drop the bubble and keep the mascot.
- Only the main TUI session draws it; subagent sessions share the process but not the composer.

## Requirements

- omp with `ui.setWidget(..., { placement: "aboveEditor" })` — tested on `v18.12.6`.
- A terminal with ANSI colour support; truecolor is used when the theme reports it, 256-colour otherwise.
- [Bun](https://bun.sh) only if you want to regenerate the preview image.

No build step is required: `mascot/art.ts` is hand-authored and loads through Bun's normal module graph.

## Install

The extension is the single entry module `mascot-bubble.ts` plus the `mascot/` folder it imports. Pick one of the three options below.

### 1. Load from this checkout for one session

```sh
omp -e /absolute/path/to/omp-clawd-mascot/mascot-bubble.ts
```

`-e` is additive and repeatable; it does not install anything permanently.

### 2. Register it in the omp config (recommended)

Add the entry module to your agent config — `~/.omp/agent/config.yml` (or `~/.omp/profiles/<name>/agent/config.yml` for a named profile):

```yaml
extensions:
  - /absolute/path/to/omp-clawd-mascot/mascot-bubble.ts
```

Keep any existing entries: the effective `extensions` array is replaced, not concatenated, across settings layers.

### 3. Copy into the extension directory

```sh
mkdir -p ~/.omp/agent/extensions
cp -R mascot-bubble.ts mascot ~/.omp/agent/extensions/
```

omp auto-discovers `*.ts` / `*.js` modules in that directory, so this persists across sessions. Named profiles use their own `~/.omp/profiles/<name>/agent/extensions/`, so copy there too if you use them.

### Verify

Start `omp` in a terminal. The mascot appears above the composer immediately; submit a prompt and the bubble should show `Working`, then the same text as the working row as tools run. If it does not appear:

- confirm you are in the TUI (not `-p`/`--mode rpc`), where `ctx.hasUI` is true;
- check that `mascot/art.ts` sits next to `mascot-bubble.ts` (for option 3, the whole `mascot/` folder must be copied, not just the entry file);
- run with `--no-extensions` to confirm the flag is not disabling discovery.

### Uninstall

- Option 1: drop the `-e` flag.
- Option 2: remove the entry from `extensions:`.
- Option 3: delete `~/.omp/agent/extensions/mascot-bubble.ts` and `~/.omp/agent/extensions/mascot/`.

## How it works

`session_start` builds a widget factory and re-invokes `ui.setWidget` on every animation tick; re-setting the widget is what requests the repaint. The tick is 60 ms and advances the frame every tick for Clawd (Claude's own cadence), or 110 ms advancing every other tick (220 ms) for the puddle.

```text
mascot/clawd-data.ts ──> mascot/clawd.ts ──┐
                                           ├──> mascot-bubble.ts
mascot/art.ts ─────────────────────────────┘
      └── render.ts ──> mascot/preview.png
```

- Every frame shares one canvas, so the widget height never changes between states: 9 × 3 cells for Clawd, 19 × 9 art pixels for the puddle.
- Each terminal cell carries two art pixels as a half block (`▀`, foreground above, background below). A half block is taller than wide in this terminal (~17 × 47 px cells), so the artwork is authored 19 columns wide instead of resampled at render time, which kept the strokes even. The preview uses the same pixel aspect, so `preview.png` matches the TUI.
- Puddle frames are palette indices: `0` is transparent; `1`–`9` (base36) index `PALETTE` in `art.ts`.
- The puddle's working pose is a fixed body with the mug, hand and eyes on one grid; only the smoke, blink and glance frames change. The smoke is three single-cell puffs two art rows apart, and every frame swaps the arrangement for its left-right mirror, so the plume boils without ever settling. The idle pose stays a `PUDDLE` grid the whole loop, with the `z` drifting over it.

## Clawd

`mascot/clawd.ts` renders what Claude Code draws at startup, so its shapes are not invented: a frame is 3 rows of 9 block glyphs painted with one body colour, and a pose only decides which glyphs land where.

- Arm, eye and feet sprites compose the body; eye spans paint the background colour behind their glyphs, eyelid spans invert body and background, so the eyes read as holes in the silhouette rather than as strokes.
- `facing` poses (`right-12` … `left-12`) replace the whole grid with a side or back view: a body-coloured glyph row with a background-coloured window punched through it.
- Frames come from the playlists in `mascot/clawd-data.ts`. A frame may carry `offset` (bounce down, clipped), `x` (walk left, clipped), `poof` (dust at the feet) and `shadow` (ground line under a hop).
- `CLAWD_ANIMS` maps the two widget states to playlists: `idle` is Claude's 22-frame autoplay loop, `working` is its 14-frame foot tap. The other 13 one-shots (jump, peekaboo, waddle, turn, coin-hop, …) are exported and unused.
- On Apple Terminal the omp widget swaps the body for Claude's eyes-only fallback, because block glyphs render unevenly there. The Claude Code plugin runs in a sandbox without `Bun`, so it always draws the full body.
- Both hosts render it: the omp widget and the Claude Code plugin (`hooks/register.tsx`, which hooks Claude's `Spinner` and `AbovePrompt` bands) read the same tables and the same `MASCOT` switch, so they cannot drift apart.

Provenance: the glyph tables and playlists were extracted from the shipped Claude Code v2.1.311 bundle; each table in `clawd-data.ts` names the minified original it came from (`jo`, `Xe`, `Je`, `Qe`, `eo`, `Jo`, `Ju`), so a re-extraction can be diffed against it.

## Development

Edit `mascot/art.ts` directly — it is the source of truth for the puddle art. Row strings are the pixel grid; `PUDDLE` is the sleeping pose and each animation lists the frames in play order. `mascot/clawd-data.ts` is data, not hand art: change it only when the ported tables change, and keep the minified names in the comments.

To look at the puddle art outside the TUI:

```sh
bun mascot/render.ts   # art.ts -> mascot/preview.png
```

`preview.png` lays every animation out as a row of frames, scaled up with nearest-neighbour at the terminal's pixel aspect (tall half-blocks, not square pixels), so the sheet shows what the TUI shows. The PNG is written by `render.ts` with a minimal encoder, so no image tooling is required.

Which animation a state uses is chosen in `mascot-bubble.ts` by `IDLE_ANIM` and `WORKING_ANIM` (puddle) and `CLAWD_ANIMS` (Clawd). The Claude Code plugin drives the same two states from `hooks/register.tsx`.

The plugin half runs under Claude Code's own harness:

```sh
claude plugin test .        # mounts Spinner/AbovePrompt and asserts the mascot draws
claude plugin validate .     # what the engine will accept from the manifest and hooks
```

## Files

| Path | Purpose |
|---|---|
| `mascot-bubble.ts` | omp extension entry: widget rendering, animation timer, event wiring |
| `hooks/register.tsx` | Claude Code plugin entry: hooks the spinner and above-prompt bands |
| `mascot/config.ts` | `MASCOT`, the shared art switch for both hosts |
| `mascot/clawd.ts` | Clawd pose → cell renderer, palette roles, state playlists |
| `mascot/clawd-data.ts` | Clawd glyph, pose and playlist tables (extracted, not hand-authored) |
| `mascot/art.ts` | Hand-authored palette-indexed puddle frames |
| `mascot/render.ts` | Renders `art.ts` to `preview.png` |
| `mascot/preview.png` | Generated preview sheet, one row per animation |
| `tests/mascot.test.tsx` | Claude Code plugin tests over the plugin harness |
