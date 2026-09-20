import { describe, expect, it } from 'vitest';
import { buildExpectedEvents } from '../../../src/core/practice/expected.js';
import type { HandSelection } from '../../../src/core/practice/types.js';
import { loadFixture } from './helpers.js';

describe('buildExpectedEvents', () => {
  it('groups notes by notated onset, keeping grace notes in accompaniment (grace-acciaccatura)', () => {
    const { score, timeline } = loadFixture('grace-acciaccatura.musicxml');
    const selection: HandSelection = { preset: 'right', partIndex: 0, staves: [1] };
    const events = buildExpectedEvents(score, timeline, selection);

    // There should be at least one event
    expect(events.length).toBeGreaterThan(0);

    // Find the event that has grace notes in accompaniment
    const withGrace = events.find((e) => e.accompaniment.length > 0);
    expect(withGrace).toBeDefined();
    expect(withGrace?.required.length).toBeGreaterThan(0);
  });

  it('treats a tie chain as a single event (tie-across-barline)', () => {
    const { score, timeline } = loadFixture('tie-across-barline.musicxml');
    const selection: HandSelection = { preset: 'both', partIndex: 0, staves: [1, 2] };
    const events = buildExpectedEvents(score, timeline, selection);

    expect(events.length).toBeGreaterThan(0);
    expect(events.length).toBe(timeline.events.length);
  });

  it('treats a tie chain as a single event (tie-chain-three)', () => {
    const { score, timeline } = loadFixture('tie-chain-three.musicxml');
    const selection: HandSelection = { preset: 'both', partIndex: 0, staves: [1, 2] };
    const events = buildExpectedEvents(score, timeline, selection);

    expect(events.length).toBeGreaterThan(0);
    expect(events.length).toBe(timeline.events.length);
  });

  it('deduplicates required notes by sounding key, keeping all noteIds (chord-basic)', () => {
    const { score, timeline } = loadFixture('chord-basic.musicxml');
    const selection: HandSelection = { preset: 'both', partIndex: 0, staves: [1, 2] };
    const events = buildExpectedEvents(score, timeline, selection);

    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      const keys = event.required.map((r) => r.key);
      const uniqueKeys = new Set(keys);
      expect(keys.length).toBe(uniqueKeys.size);
    }
  });

  it('collects all printed noteIds across staves and voices (grand-staff-two-voices-per-staff)', () => {
    const { score, timeline } = loadFixture('grand-staff-two-voices-per-staff.musicxml');
    const selection: HandSelection = { preset: 'both', partIndex: 0, staves: [1, 2] };
    const events = buildExpectedEvents(score, timeline, selection);

    expect(events.length).toBe(1);
    const totalNoteIds = events[0].required.reduce((sum, r) => sum + r.noteIds.length, 0);
    expect(totalNoteIds).toBe(4);
  });

  it('never requires unpitched notes (percussion-unpitched)', () => {
    const { score, timeline } = loadFixture('percussion-unpitched.musicxml');
    const selection: HandSelection = { preset: 'both', partIndex: 0, staves: [1] };
    const events = buildExpectedEvents(score, timeline, selection);

    // Empty required lists are dropped, so percussion-only scores should yield 0 events
    expect(events.length).toBe(0);
  });
});
