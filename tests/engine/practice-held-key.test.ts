/**
 * Feature 021 US1 (FR-006, research R-12): a key the musician holds keeps sounding until they let go, however the app
 * changes what it plays around it. Practice's accompaniment plays on the live channel too, so when it uses the same key
 * the musician is holding (a unison between the hands) and the session is reset - a mode switch, a new start - releasing
 * the accompaniment must not cut the musician's key.
 */
import { describe, expect, it } from 'vitest';
import { releasePracticeSound } from '../../src/app/practice-sound.js';
import { startSession } from '../../src/core/practice/matcher.js';
import type { PracticeSession } from '../../src/core/practice/types.js';
import { FakeAudioEngine } from '../fakes/fake-audio-engine.js';

function sessionWith(fields: Partial<PracticeSession>): PracticeSession {
  return {
    ...startSession({
      scoreId: null,
      selection: { preset: 'both', partIndex: 0, staves: [1] },
      events: [],
      startEventIndex: 0,
      loop: null,
      accompaniment: true,
      help: false,
    }),
    ...fields,
  };
}

describe('Practice reset keeps the musician`s held key sounding (FR-006, R-12)', () => {
  it('releases the accompaniment keys that ring, and leaves a key the musician holds alone', () => {
    const engine = new FakeAudioEngine();
    const session = sessionWith({
      heldKeys: new Set([60]), // the musician holds C4 ...
      soundingAccompaniment: new Map([
        [60, 480], // ... and the accompaniment's note is the same key
        [64, 480],
      ]),
    });

    releasePracticeSound(engine, session);

    expect(engine.commands).toContain('liveNoteOff:64');
    expect(engine.commands).not.toContain('liveNoteOff:60');
  });

  it('once the musician lets go of the key, nothing of the accompaniment is left ringing on it', () => {
    const engine = new FakeAudioEngine();
    const session = sessionWith({ heldKeys: new Set(), soundingAccompaniment: new Map([[60, 480]]) });

    releasePracticeSound(engine, session);

    expect(engine.commands).toEqual(['liveNoteOff:60']);
  });

  it('an Orchestra note is on its own channel, so it is released whatever key the musician holds', () => {
    const engine = new FakeAudioEngine();
    const session = sessionWith({ heldKeys: new Set([60]), soundingOrchestra: new Map([['3:60', 960]]) });

    releasePracticeSound(engine, session);

    expect(engine.commands).toEqual(['liveNoteOff:60@3']);
  });

  it('no session, nothing to release', () => {
    const engine = new FakeAudioEngine();
    releasePracticeSound(engine, null);
    expect(engine.commands).toEqual([]);
  });
});
