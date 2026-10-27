import { expect, test } from 'claude-code/testing'

// The mascot is art, so these assert shape rather than pixels: the working
// spinner draws the tapping pose's body, and the idle band draws it too instead
// of deferring. `frame` starts at 0, so both are the first frame of their loop.

const SPINNER = { word: 'Thinking', message: null, suffix: '…', mode: 'thinking' } as const

test('the working spinner draws the mascot beside the turn text', async $ => {
  const ui = await $.ui.mount({ plugin: 'omp-mascot', surface: 'terminal', component: 'Spinner', props: SPINNER })

  const head = await ui.find({ type: 'Text', text: /▐▛███▛█/ })
  expect(head).toBeDefined()
  // The chest bar has to be there too, so the body is not a stray row.
  expect(await ui.find({ type: 'Text', text: /▝▜██████▀/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Thinking/ })).toBeDefined()
})

const IDLE_BAND = { hasSurvey: false, isWorking: false, maxRows: 10, scroll: { offset: 0, bodyRows: 10 } } as const

test('the idle band draws the mascot above the prompt', async $ => {
  const ui = await $.ui.mount({ plugin: 'omp-mascot', surface: 'terminal', component: 'AbovePrompt', props: IDLE_BAND })

  expect(await ui.find({ type: 'Text', text: /▐▛███▛█/ })).toBeDefined()
})
