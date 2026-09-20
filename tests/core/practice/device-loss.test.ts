import { describe, expect, it } from 'vitest';
import { loadFixture } from './helpers.js';
import { buildExpectedEvents } from '../../../src/core/practice/expected.js';
import { startSession, applyInput } from '../../../src/core/practice/matcher.js';
import { buildSequence } from '../../fakes/midi-sequence.js';
import type { HandSelection } from '../../../src/core/practice/types.js';

describe('device-loss', () => {
  const selection: HandSelection = { preset: 'both', partIndex: 0, staves: [1, 2] };

  it('deviceLost releases reported held keys, keeps index, returns to waiting on next input', () => {
    const { score, timeline } = loadFixture('scale-c-major-q100.musicxml');
    const events = buildExpectedEvents(score, timeline, selection);
    const session = startSession({ scoreId: 'test', events, startEventIndex: 0, loop: null, accompaniment: false, help: false });

    let step1 = applyInput(session, buildSequence(['on:60@100'])[0]);
    expect(step1.session.index).toBe(1);
    expect(step1.session.heldKeys.has(60)).toBe(true);

    let step2 = applyInput(step1.session, buildSequence(['lost:60@150'])[0]);
    expect(step2.session.phase).toBe('interrupted');
    expect(step2.session.index).toBe(1);
    expect(step2.session.heldKeys.has(60)).toBe(false);

    // wait, next phase is 'waiting' BEFORE advancing?
    // yes, noteOn un-interrupts before proceeding
    let step3 = applyInput(step2.session, buildSequence(['on:62@200'])[0]);
    expect(step3.session.index).toBe(2); 
    // wait, if it advanced, it was waiting. If the event length reached, it might be 'finished', but event 2 is E4 so still waiting.
    expect(step3.session.phase).toBe('waiting');
  });
});
