import { atom, read, update } from 'claude-code'
import type { ElementTable, Register } from 'claude-code'

// Shared with the omp extension: `mascot/config.ts` picks the art, and both art
// systems live under `mascot/`.
import { ART } from '../mascot/art'
import { CLAWD_ANIMS, FRAME_MS as CLAWD_FRAME_MS, buildClawdFrame } from '../mascot/clawd'
import type { ClawdCell, ClawdFrame } from '../mascot/clawd'
import { MASCOT } from '../mascot/config'

/** Clawd ticks at Claude's own 60 ms; the puddle's smoke boils at 220 ms. */
const TICK_MS = MASCOT === 'clawd' ? CLAWD_FRAME_MS : 220
const frame = atom({ plugin: 'omp-mascot', key: 'frame' } as const, 0)

/** Clawd's palette, verbatim from Claude Code's theme (`clawd_body`, `clawd_background`). */
const HEX = { body: '#d77757', background: '#000000' } as const

/** Whichever surface's element table `$.ui.resolve(e)` handed this render. */
type Elements = ElementTable

/** One frame of the selected art, as cells the surface can draw. */
type MascotArt = { kind: 'clawd'; art: ClawdFrame } | { kind: 'puddle'; art: readonly string[] }

type Cell = { char: string; fg?: string; bg?: string }

/** A Clawd cell resolved to colours the surface can draw, or flagged dim for dust and shadows. */
type InkCell = { char: string; fg?: string; bg?: string; dim: boolean }

function inkCells(row: readonly ClawdCell[]): InkCell[] {
  return row.map(cell => {
    if (cell.fg === 'inactive') return { char: cell.glyph, dim: true }
    const fg = cell.fg === 'background' ? HEX.background : HEX.body
    const bg = cell.bg === null ? undefined : cell.bg === 'background' ? HEX.background : HEX.body
    return { char: cell.glyph, fg, bg, dim: false }
  })
}

/** Two art pixels per terminal cell, as a half block: foreground above, background below. */
function cellAt(top: string, bottom: string): Cell {
  const fg = top === '0' ? undefined : ART.palette[parseInt(top, 36) - 1]
  const bg = bottom === '0' ? undefined : ART.palette[parseInt(bottom, 36) - 1]
  if (fg && bg) return { char: '▀', fg, bg }
  if (fg) return { char: '▀', fg }
  if (bg) return { char: '▄', fg: bg }
  return { char: ' ' }
}

function artFor(name: 'idle' | 'working', step: number): MascotArt {
  if (MASCOT === 'clawd') {
    const anim = CLAWD_ANIMS[name]
    return { kind: 'clawd', art: buildClawdFrame(anim[step % anim.length]!) }
  }
  const { frames } = ART.anims[name]!
  return { kind: 'puddle', art: frames[step % frames.length]! }
}

/** The puddle art as rows of half-block cells. */
function Sprite({ Box, Text, art }: { Box: Elements['Box']; Text: Elements['Text']; art: readonly string[] }) {
  const rows = Math.ceil(ART.pxRows / 2)

  return (
    <Box flexDirection="column">
      {Array.from({ length: rows }, (_, r) => (
        <Box key={String(r)}>
          {Array.from({ length: ART.cols }, (_, c) => {
            const cell = cellAt(art[r * 2]![c]!, art[r * 2 + 1]?.[c] ?? '0')
            return (
              <Text key={String(c)} color={cell.fg} backgroundColor={cell.bg}>
                {cell.char}
              </Text>
            )
          })}
        </Box>
      ))}
    </Box>
  )
}

/** Consecutive cells that share a colour pair, so one row is a few spans, not nine. */
function runs(row: readonly InkCell[]): { text: string; fg?: string; bg?: string; dim: boolean }[] {
  const out: { text: string; fg?: string; bg?: string; dim: boolean }[] = []
  for (const cell of row) {
    const last = out.at(-1)
    if (last && last.fg === cell.fg && last.bg === cell.bg && last.dim === cell.dim) last.text += cell.char
    else out.push({ text: cell.char, fg: cell.fg, bg: cell.bg, dim: cell.dim })
  }
  return out
}

/** Clawd as rows of glyph cells; eye and eyelid cells carry their own background. */
function Clawd({ Box, Text, art }: { Box: Elements['Box']; Text: Elements['Text']; art: ClawdFrame }) {
  return (
    <Box flexDirection="column">
      {art.map((row, r) => (
        <Box key={String(r)}>
          <Text>
            {runs(inkCells(row)).map((run, i) =>
              run.dim ? (
                <Text key={String(i)} dimColor>
                  {run.text}
                </Text>
              ) : (
                <Text key={String(i)} color={run.fg} backgroundColor={run.bg}>
                  {run.text}
                </Text>
              ),
            )}
          </Text>
        </Box>
      ))}
    </Box>
  )
}

function Mascot({
  Box,
  Text,
  art,
}: {
  Box: Elements['Box']
  Text: Elements['Text']
  art: MascotArt
}) {
  if (art.kind === 'clawd') return <Clawd Box={Box} Text={Text} art={art.art} />
  return <Sprite Box={Box} Text={Text} art={art.art} />
}

export const register: Register = on => {
  on('session.start', ($, e, next) => {
    // One tick drives both poses: the spinner while a turn runs, the band while idle.
    $.clock.every(TICK_MS, () => void update($, frame, n => n + 1))

    return next(e)
  })

  on('ui.render', { component: 'Spinner' }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="row" alignItems="center" marginTop={1}>
        <Mascot Box={Box} Text={Text} art={artFor('working', await read($, frame))} />
        <Text dimColor> {e.props.message ?? e.props.word}{e.props.suffix}</Text>
      </Box>
    )
  })

  // Idle: the spinner is gone between turns, so the mascot sits above the prompt.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.props.isWorking) return next(e)

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="row" alignItems="center" marginTop={1}>
        <Mascot Box={Box} Text={Text} art={artFor('idle', await read($, frame))} />
        <Text dimColor> …</Text>
      </Box>
    )
  })
}
