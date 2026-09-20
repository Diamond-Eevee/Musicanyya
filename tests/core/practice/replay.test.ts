import { describe, expect, it } from 'vitest';
import { buildExpectedEvents } from '../../../src/core/practice/expected.js';
import { applyInput, startSession } from '../../../src/core/practice/matcher.js';
import type { HandSelection, PracticeInput } from '../../../src/core/practice/types.js';
import { buildSequence, stripTimestamps } from '../../fakes/midi-sequence.js';
import { loadFixture } from './helpers.js';

describe('replay (snapshots)', () => {
  const selection: HandSelection = { preset: 'both', partIndex: 0, staves: [1, 2] };

  function playAll(scoreName: string, inputs: readonly PracticeInput[]) {
    const { score, timeline } = loadFixture(scoreName);
    const events = buildExpectedEvents(score, timeline, selection);
    let session = startSession({
      scoreId: 'test',
      events,
      startEventIndex: 0,
      loop: null,
      accompaniment: false,
      help: false,
    });

    const allEffects = [];
    for (const input of inputs) {
      const step = applyInput(session, input);
      session = step.session;
      allEffects.push(...step.effects);
    }

    // Sort marks by noteId to make snapshot deterministic
    const marks = Array.from(session.marks.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    return { marks, effects: allEffects };
  }

  it('golden snapshot: scale-c-major-q100', () => {
    // Just a few notes of the scale
    const inputs = buildSequence([
      'on:60@100',
      'off:60@150', // C4 correct
      'on:61@200',
      'off:61@250', // wrong Pitch
      'on:62@300',
      'off:62@350', // D4 correct
      'on:64@400',
      'off:64@450', // E4 correct
    ]);
    const result = playAll('scale-c-major-q100.musicxml', inputs);
    expect(result).toMatchSnapshot();
  });

  it('golden snapshot: chord-basic (using grand-staff)', () => {
    const inputs = buildSequence([
      'on:43@100',
      'on:48@120',
      'on:64@140',
      'on:72@160', // full chord
    ]);
    const result = playAll('grand-staff-two-voices-per-staff.musicxml', inputs);
    expect(result).toMatchSnapshot();
  });

  it('stripping timeStampMs changes nothing', () => {
    const inputs = buildSequence(['on:60@100', 'off:60@150', 'on:61@200', 'off:61@250', 'on:62@300', 'off:62@350']);
    const inputsNoTime = stripTimestamps(inputs);

    const result1 = playAll('scale-c-major-q100.musicxml', inputs);
    const result2 = playAll('scale-c-major-q100.musicxml', inputsNoTime);

    expect(result1).toEqual(result2);
  });
});
