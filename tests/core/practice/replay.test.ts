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
    // 008 FR-016: the held wrong keys (the red discs on the Score) after every step, so the same input events must
    // always give the same discs at every moment
    const heldWrongKeys: [number, string][][] = [];
    for (const input of inputs) {
      const step = applyInput(session, input);
      session = step.session;
      allEffects.push(...step.effects);
      heldWrongKeys.push(Array.from(session.heldWrongKeys.entries()).sort((a, b) => a[0] - b[0]));
    }

    // Sort marks by noteId to make snapshot deterministic
    const marks = Array.from(session.marks.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    return { marks, effects: allEffects, heldWrongKeys };
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

  it('golden snapshot: wrong keys held across an event change (scale-c-major-q100, 008 FR-016)', () => {
    const inputs = buildSequence([
      'on:61@100', // C#4 at event 0: wrong pitch, held
      'on:72@120', // C5: wrong octave, held
      'off:72@140', // released: its disc goes
      'on:62@160', // D4: wrong pitch, held (the next event needs it)
      'on:60@180', // C4 correct: the cursor reaches D4 with its key already down (held over), 61 stays
      'off:62@200',
      'on:62@220', // D4 played again: accepted
      'off:61@240',
    ]);
    const result = playAll('scale-c-major-q100.musicxml', inputs);
    expect(result).toMatchSnapshot();
    // the discs at the interesting moments, spelled out so a reader need not trust the snapshot alone
    expect(result.heldWrongKeys[0]).toEqual([[61, 'wrongPitch']]);
    expect(result.heldWrongKeys[1]).toEqual([
      [61, 'wrongPitch'],
      [72, 'wrongOctave'],
    ]);
    expect(result.heldWrongKeys[2]).toEqual([[61, 'wrongPitch']]);
    expect(result.heldWrongKeys[3]).toEqual([
      [61, 'wrongPitch'],
      [62, 'wrongPitch'],
    ]);
    expect(result.heldWrongKeys[4]).toEqual([[61, 'wrongPitch']]); // 62 is required now: held over, no disc
    expect(result.heldWrongKeys[7]).toEqual([]);
  });

  it('stripping timeStampMs changes nothing', () => {
    const inputs = buildSequence(['on:60@100', 'off:60@150', 'on:61@200', 'off:61@250', 'on:62@300', 'off:62@350']);
    const inputsNoTime = stripTimestamps(inputs);

    const result1 = playAll('scale-c-major-q100.musicxml', inputs);
    const result2 = playAll('scale-c-major-q100.musicxml', inputsNoTime);

    expect(result1).toEqual(result2);
  });
});
