# omp-clawd-mascot

Animated pixel-art mascot for [omp](https://github.com/can1357/oh-my-pi), docked directly above the composer with a speech bubble that mirrors what the agent is doing.

- **Idle** — the mascot dozes as a puddle, a little `z` drifts up, and the bubble shows `…`.
- **Working** — the mascot holds a mug while steam drifts off it, blinking once and glancing at the mug once per cycle; the bubble names the active tool (`Thinking`, `read`, `bash`, …) with animated dots.
- Narrow terminals (under 42 columns) drop the bubble and keep the mascot.
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

Start `omp` in a terminal. The mascot appears above the composer immediately; submit a prompt and the bubble should switch to `Thinking`, then to each tool name as it runs. If it does not appear:

- confirm you are in the TUI (not `-p`/`--mode rpc`), where `ctx.hasUI` is true;
- check that `mascot/art.ts` sits next to `mascot-bubble.ts` (for option 3, the whole `mascot/` folder must be copied, not just the entry file);
- run with `--no-extensions` to confirm the flag is not disabling discovery.

### Uninstall

- Option 1: drop the `-e` flag.
- Option 2: remove the entry from `extensions:`.
- Option 3: delete `~/.omp/agent/extensions/mascot-bubble.ts` and `~/.omp/agent/extensions/mascot/`.

## How it works

`session_start` builds a widget factory and re-invokes `ui.setWidget` on every animation tick; re-setting the widget is what requests the repaint. A 110 ms timer advances the frame every other tick (220 ms), for both the idle and working animations.

```text
mascot/art.ts ──> mascot-bubble.ts
      └── render.ts ──> mascot/preview.png
```

- Every frame shares the same 14 × 9 art-pixel canvas, so the widget height never changes between states.
- Each terminal cell carries two art pixels as a half block (`▀`, foreground above, background below), keeping art pixels square in cells that are twice as tall as they are wide.
- Frames are palette indices: `0` is transparent; `1`–`9` (base36) index `PALETTE` in `art.ts`.
- The working pose is a fixed body with the mug, hand and eyes on one grid; only the smoke, blink and glance frames change. The smoke is three single-cell puffs two art rows apart, and every frame swaps the arrangement for its left-right mirror, so the plume boils without ever settling. The idle pose stays a `PUDDLE` grid the whole loop, with the `z` drifting over it.

## Development

Edit `mascot/art.ts` directly — it is the source of truth. Row strings are the pixel grid; `PUDDLE` is the sleeping pose and each animation lists the frames in play order.

To look at the art outside the TUI:

```sh
bun mascot/render.ts   # art.ts -> mascot/preview.png
```

`preview.png` lays every animation out as a row of frames, scaled up with nearest-neighbour. The PNG is written by `render.ts` with a minimal encoder, so no image tooling is required.

Which animation a state uses is chosen in `mascot-bubble.ts` by `IDLE_ANIM` and `WORKING_ANIM`.

## Files

| Path | Purpose |
|---|---|
| `mascot-bubble.ts` | Extension entry: widget rendering, animation timer, event wiring |
| `mascot/art.ts` | Hand-authored palette-indexed frames |
| `mascot/render.ts` | Renders `art.ts` to `preview.png` |
| `mascot/preview.png` | Generated preview sheet, one row per animation |
