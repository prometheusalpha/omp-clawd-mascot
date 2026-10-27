import { atom, read, update } from 'claude-code'
import type { ElementTable, Register } from 'claude-code'

import { MASCOT } from '../../config'
import { runs } from '../../core/runs'
import type { Frame } from '../../core/types'

// The sandbox has no `Bun` to spot Apple Terminal, so frames never ask for `unevenBlocks`.
const frame = atom({ plugin: 'omp-mascot', key: 'frame' } as const, 0)

/** Whichever surface's element table `$.ui.resolve(e)` handed this render. */
type Elements = ElementTable

/** A mascot frame as rows of text spans; dim spans use the surface's own dim style. */
function Mascot({ Box, Text, art }: { Box: Elements['Box']; Text: Elements['Text']; art: Frame }) {
  return (
    <Box flexDirection="column">
      {art.map((row, r) => (
        <Box key={String(r)}>
          <Text>
            {runs(row).map((run, i) =>
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

export const register: Register = on => {
  on('session.start', ($, e, next) => {
    // One tick drives both poses: the spinner while a turn runs, the band while idle.
    $.clock.every(MASCOT.frameMs, () => void update($, frame, n => n + 1))

    return next(e)
  })

  on('ui.render', { component: 'Spinner' }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="row" alignItems="center" marginTop={1}>
        <Mascot Box={Box} Text={Text} art={MASCOT.frame('working', await read($, frame))} />
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
        <Mascot Box={Box} Text={Text} art={MASCOT.frame('idle', await read($, frame))} />
        <Text dimColor> …</Text>
      </Box>
    )
  })
}
