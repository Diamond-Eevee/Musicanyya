import { buildExpectedEvents } from '../src/core/practice/expected.js';
import { applyInput, startSession } from '../src/core/practice/matcher.js';
import { loadFixture } from '../tests/core/practice/helpers.js';
import { buildSequence } from '../tests/fakes/midi-sequence.js';

const { score, timeline } = loadFixture('chord-basic.musicxml');
const selection = { preset: 'both', partIndex: 0, staves: [1, 2] as number[] };
const events = buildExpectedEvents(score, timeline, selection);

console.log('Timeline events:');
console.dir(timeline.events, { depth: null });

console.log('Generated events:');
console.dir(events, { depth: null });

const session = startSession({
  scoreId: 'test',
  events,
  startEventIndex: 0,
  loop: null,
  accompaniment: false,
  help: false,
});

const step1 = applyInput(session, buildSequence(['on:60@100'])[0]);
console.log('Marks after on:60@100:');
console.dir(step1.session.marks, { depth: null });
