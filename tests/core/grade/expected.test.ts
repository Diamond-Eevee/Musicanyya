import { describe, expect, it } from 'vitest';
import { buildExpectedNotes } from '../../../src/core/grade/expected.js';
import type { HandSelection, LoopPassSpan } from '../../../src/core/practice/types.js';
import { loadFixture } from './helpers.js';

const BOTH: HandSelection = { preset: 'both', partIndex: 0, staves: [1, 2] };
const RIGHT: HandSelection = { preset: 'right', partIndex: 0, staves: [1] };

describe('buildExpectedNotes', () => {
  it('flattens one ExpectedNote per required key of a chord, sharing the chord onset (chord-basic)', () => {
    const { score, timeline } = loadFixture('chord-basic.musicxml', BOTH);
    const notes = buildExpectedNotes(score, timeline, BOTH, null);
    const chords = new Map<number, typeof notes>();
    for (const n of notes) {
      const arr = chords.get(n.onsetTick) ?? [];
      arr.push(n);
      chords.set(n.onsetTick, arr);
    }
    const chord = [...chords.values()].find((arr) => arr.length > 1);
    expect(chord).toBeDefined();
    const keys = new Set(chord?.map((n) => n.key));
    expect(keys.size).toBe(chord?.length); // distinct keys, one ExpectedNote each
    for (const n of chord ?? []) {
      expect(n.chordSize).toBe(chord?.length);
    }
  });

  it('never expects a grace note (grace-acciaccatura)', () => {
    const { score, timeline } = loadFixture('grace-acciaccatura.musicxml', RIGHT);
    const notes = buildExpectedNotes(score, timeline, RIGHT, null);
    const graceNoteIds = new Set(score.parts[0]?.notes.filter((n) => n.grace).map((n) => n.id) ?? []);
    for (const n of notes) {
      for (const id of n.noteIds) expect(graceNoteIds.has(id)).toBe(false);
    }
  });

  it('never expects a hidden or playback-only note (cue-notes-not-played)', () => {
    const { score, timeline } = loadFixture('cue-notes-not-played.musicxml', BOTH);
    const notes = buildExpectedNotes(score, timeline, BOTH, null);
    const hiddenIds = new Set(score.parts[0]?.notes.filter((n) => n.printed === false).map((n) => n.id) ?? []);
    for (const n of notes) {
      for (const id of n.noteIds) expect(hiddenIds.has(id)).toBe(false);
    }
  });

  it('never expects an unpitched or percussion note (percussion-unpitched)', () => {
    const { score, timeline } = loadFixture('percussion-unpitched.musicxml', BOTH);
    const notes = buildExpectedNotes(score, timeline, BOTH, null);
    const unpitchedIds = new Set(score.parts[0]?.notes.filter((n) => n.unpitched).map((n) => n.id) ?? []);
    for (const n of notes) {
      for (const id of n.noteIds) expect(unpitchedIds.has(id)).toBe(false);
    }
  });

  it('never expects the unselected hand (hands-accompaniment, right hand only)', () => {
    const { score, timeline } = loadFixture('hands-accompaniment.musicxml', RIGHT);
    const notes = buildExpectedNotes(score, timeline, RIGHT, null);
    const leftHandIds = new Set(score.parts[0]?.notes.filter((n) => n.staff === 2).map((n) => n.id) ?? []);
    expect(notes.length).toBeGreaterThan(0);
    for (const n of notes) {
      for (const id of n.noteIds) expect(leftHandIds.has(id)).toBe(false);
    }
  });

  it('a tie chain appears once, at its onset, carrying every tied note id (tie-chain-three)', () => {
    const { score, timeline } = loadFixture('tie-chain-three.musicxml', BOTH);
    const notes = buildExpectedNotes(score, timeline, BOTH, null);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.onsetTick).toBe(0);
    expect(notes[0]?.noteIds).toHaveLength(3);
  });

  it('each repeat occurrence appears separately, in Listen order (repeat-simple)', () => {
    const { score, timeline } = loadFixture('repeat-simple.musicxml', BOTH);
    const notes = buildExpectedNotes(score, timeline, BOTH, null);
    // measure 0 (C4) then measure 1 (D4), twice through the repeat: 4 notes total. passIndex is the global,
    // Listen-order index into timeline.passes - each of the 4 measure-occurrences gets its own value.
    expect(notes).toHaveLength(4);
    expect(notes.map((n) => n.measureIndex)).toEqual([0, 1, 0, 1]);
    expect(notes.map((n) => n.passIndex)).toEqual([0, 1, 2, 3]);
    // Listen order: index is sequential and onsets never go backwards.
    expect(notes.map((n) => n.index)).toEqual([0, 1, 2, 3]);
    for (let i = 1; i < notes.length; i++) {
      expect(notes[i]!.onsetTick).toBeGreaterThan(notes[i - 1]!.onsetTick);
    }
  });

  it('carries arpeggiated from the chord (arpeggiate-chord)', () => {
    const { score, timeline } = loadFixture('arpeggiate-chord.musicxml', BOTH);
    const notes = buildExpectedNotes(score, timeline, BOTH, null);
    const rolled = notes.filter((n) => n.onsetTick === 0);
    const plain = notes.filter((n) => n.onsetTick > 0);
    expect(rolled.length).toBeGreaterThan(1);
    expect(rolled.every((n) => n.arpeggiated)).toBe(true);
    expect(plain.every((n) => !n.arpeggiated)).toBe(true);
  });

  it('slices to the given range of passes (repeat-simple, measure 0 second occurrence only)', () => {
    const { score, timeline } = loadFixture('repeat-simple.musicxml', BOTH);
    // Global pass indices: 0 = measure 0 first time, 1 = measure 1 first time, 2 = measure 0 second time,
    // 3 = measure 1 second time. Slicing to [2, 3) keeps only measure 0's second occurrence.
    const range: LoopPassSpan = { fromPassIndex: 2, toPassIndex: 3 };
    const notes = buildExpectedNotes(score, timeline, BOTH, range);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.passIndex).toBe(2);
    expect(notes[0]?.measureIndex).toBe(0);
    expect(notes.map((n) => n.index)).toEqual([0]); // re-based to the sliced range, not the whole Score
  });
});
