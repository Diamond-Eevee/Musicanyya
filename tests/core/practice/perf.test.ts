import { it } from 'vitest';
import { buildExpectedEvents } from '../../../src/core/practice/expected.js';
import { applyInput, startSession } from '../../../src/core/practice/matcher.js';
import type { HandSelection } from '../../../src/core/practice/types.js';
import { loadFixture } from './helpers.js';

// T043: SC-011 (starting a session anywhere in a 500-measure Score begins waiting within 1 s) and the pure
// computation share of SC-002 (key press to mark <= 50 ms) - the MIDI/audio-driver portion of SC-002 needs real
// hardware and is not measured here (see quickstart.md and the implementation log).
it('measures SC-011: building expected events and starting a session over a 500-measure Score', () => {
  const selection: HandSelection = { preset: 'both', partIndex: 0, staves: [1, 2] };
  const { score, timeline } = loadFixture('large-score.musicxml');

  const buildStart = performance.now();
  const events = buildExpectedEvents(score, timeline, selection);
  const buildMs = performance.now() - buildStart;

  const startStart = performance.now();
  const session = startSession({
    scoreId: 'perf',
    selection,
    events,
    startEventIndex: Math.floor(events.length / 2), // "anywhere in the Score", not just the beginning
    loop: null,
    accompaniment: true,
    help: true,
  });
  const startMs = performance.now() - startStart;

  console.log(
    `SC-011: ${score.measures.length} measures, ${events.length} expected events, ` +
      `phase after start "${session.phase}" - buildExpectedEvents ${buildMs.toFixed(2)} ms, ` +
      `startSession ${startMs.toFixed(2)} ms, total ${(buildMs + startMs).toFixed(2)} ms (budget: 1000 ms)`,
  );
});

it('measures the pure computation share of SC-002: one applyInput call for a correct key', () => {
  const selection: HandSelection = { preset: 'both', partIndex: 0, staves: [1, 2] };
  const { score, timeline } = loadFixture('large-score.musicxml');
  const events = buildExpectedEvents(score, timeline, selection);
  const session = startSession({
    scoreId: 'perf',
    selection,
    events,
    startEventIndex: 0,
    loop: null,
    accompaniment: true,
    help: true,
  });

  const key = events[0]?.required[0]?.key;
  if (key === undefined) throw new Error('fixture has no required key at event 0');

  const start = performance.now();
  applyInput(session, { type: 'noteOn', key, velocity: 80, timeStampMs: 0 });
  const elapsedMs = performance.now() - start;

  console.log(
    `SC-002 (matcher share only, no DOM/audio): applyInput ${elapsedMs.toFixed(3)} ms (budget: 50 ms end to end)`,
  );
});
