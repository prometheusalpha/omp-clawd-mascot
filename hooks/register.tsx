import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

// Shared with the omp extension: `mascot/art.ts` stays the single source of art.
import { ART } from '../mascot/art'

const TICK_MS = 220
const frame = atom({ plugin: 'omp-mascot', key: 'frame' } as const, 0)

type Cell = { char: string; fg?: string; bg?: string }

/** Two art pixels per terminal cell, as a half block: foreground above, background below. */
function cellAt(top: string, bottom: string): Cell {
  const fg = top === '0' ? undefined : ART.palette[parseInt(top, 36) - 1]
  const bg = bottom === '0' ? undefined : ART.palette[parseInt(bottom, 36) - 1]
  if (fg && bg) return { char: '▀', fg, bg }
  if (fg) return { char: '▀', fg }
  if (bg) return { char: '▄', fg: bg }
  return { char: ' ' }
}

async function frameOf(name: 'idle' | 'working', $: any): Promise<readonly string[]> {
  const { frames } = ART.anims[name]!
  return frames[(await read($, frame)) % frames.length]!
}

/** The art as rows of half-block cells. */
function Sprite({ Box, Text, art }: { Box: any; Text: any; art: readonly string[] }) {
  const rows = Math.ceil(ART.pxRows / 2)

  return (
    <Box flexDirection="column">
      {Array.from({ length: rows }, (_, r) => (
        <Box key={r}>
          {Array.from({ length: ART.cols }, (_, c) => {
            const cell = cellAt(art[r * 2]![c]!, art[r * 2 + 1]?.[c] ?? '0')
            return (
              <Text key={c} color={cell.fg} backgroundColor={cell.bg}>
                {cell.char}
              </Text>
            )
          })}
        </Box>
      ))}
    </Box>
  )
}

export const register: Register = on => {
  on('session.start', ($, e, next) => {
    // One tick drives both poses: the spinner while a turn runs, the band while idle.
    $.clock.every(TICK_MS, () => void update($, frame, n => n + 1))

    return next(e)
  })

  on('ui.render', { component: 'Spinner' }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const art = await frameOf('working', $)

    return (
      <Box flexDirection="row" alignItems="center" marginTop={1}>
        <Sprite Box={Box} Text={Text} art={art} />
        <Text dimColor> {e.props.message ?? e.props.word}{e.props.suffix}</Text>
      </Box>
    )
  })

  // Idle: the spinner is gone between turns, so the dozing puddle sits above the prompt.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.props.isWorking) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const art = await frameOf('idle', $)

    return (
      <Box flexDirection="row" alignItems="center" marginTop={1}>
        <Sprite Box={Box} Text={Text} art={art} />
        <Text dimColor> …</Text>
      </Box>
    )
  })
}
