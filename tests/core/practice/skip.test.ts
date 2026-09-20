import { describe, expect, it } from 'vitest';
import { loadFixture } from './helpers.js';
import { buildExpectedEvents } from '../../../src/core/practice/expected.js';
import { startSession, applyInput } from '../../../src/core/practice/matcher.js';
import type { HandSelection, PracticeSession, PracticeEffect, PracticeInput } from '../../../src/core/practice/types.js';

function apply(session: PracticeSession, input: PracticeInput): { session: PracticeSession; effects: PracticeEffect[] } {
  return applyInput(session, input);
}

describe('skip', () => {
  const selection: HandSelection = { preset: 'both', partIndex: 0, staves: [1, 2] };

  it('skipNext marks the event\'s required notes skipped and moves the cursor on without a correct', () => {
    const { score, timeline } = loadFixture('scale-c-major-q100.musicxml');
    const events = buildExpectedEvents(score, timeline, selection);
    const session = startSession({ scoreId: 'test', events, startEventIndex: 0, loop: null, accompaniment: false, help: false });
    
    // First note is C4 (60)
    const step1 = apply(session, { type: 'skipNext', timeStampMs: 100 });
    
    // Moved to index 1
    expect(step1.session.index).toBe(1);
    
    // Marked as skipped
    const marks = Array.from(step1.session.marks.values());
    expect(marks).toContain('skipped');
    expect(marks).not.toContain('correct');
    
    // wrongAttemptsOnCurrent should not be touched (it should be 0)
    expect(step1.session.wrongAttemptsOnCurrent).toBe(0);
    
    // We can also have some wrong attempts, skip should not reset wrong attempts for the NEXT event? 
    // Wait, wrongAttemptsOnCurrent is for the *current* event. When we move to the next event, it should be 0.
    // The requirement says "neither touches wrongAttemptsOnCurrent". This probably means it doesn't increment or record it as a wrong attempt on the current event. But moving to the next event should naturally have wrongAttempts = 0.
    // Actually, "neither touches wrongAttemptsOnCurrent" probably means it just leaves the session logic to reset it upon move, or if it doesn't move (e.g. skipPrevious when already at 0).
  });

  it('skipPrevious returns to the previous event and clears its marks', () => {
    const { score, timeline } = loadFixture('scale-c-major-q100.musicxml');
    const events = buildExpectedEvents(score, timeline, selection);
    const session = startSession({ scoreId: 'test', events, startEventIndex: 1, loop: null, accompaniment: false, help: false });
    
    // Put a mark on event 0 just to see if it clears
    const sessionWithMark = {
      ...session,
      marks: new Map([[events[0].required[0].noteIds[0], 'correct']])
    } as unknown as PracticeSession;

    const step1 = apply(sessionWithMark, { type: 'skipPrevious', timeStampMs: 100 });
    
    // Moved to index 0
    expect(step1.session.index).toBe(0);
    
    // Marks cleared
    const marks = Array.from(step1.session.marks.values());
    expect(marks.length).toBe(0);
  });

  it('forward skip past the last event ends the session as stopped, not reachedEnd', () => {
    const { score, timeline } = loadFixture('scale-c-major-q100.musicxml');
    const events = buildExpectedEvents(score, timeline, selection);
    const session = startSession({ scoreId: 'test', events, startEventIndex: events.length - 1, loop: null, accompaniment: false, help: false });
    
    const step1 = apply(session, { type: 'skipNext', timeStampMs: 100 });
    
    expect(step1.session.phase).toBe('finished');
    const endEffects = step1.effects.filter(e => e.type === 'sessionEnded');
    expect(endEffects.length).toBe(1);
    expect(endEffects[0]).toEqual({ type: 'sessionEnded', reason: 'stopped' });
  });
});
