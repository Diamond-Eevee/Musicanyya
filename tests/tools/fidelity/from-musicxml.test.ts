import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fromMusicXml } from '../../../tools/library/fidelity/from-musicxml';
import type { ReferenceBar } from '../../../tools/library/fidelity/reference';
import { q } from '../../../tools/library/fidelity/time';

const read = (name: string) =>
  fromMusicXml(readFileSync(resolve('tests/fixtures/musicxml', `${name}.musicxml`), 'utf8'));
const bar = (index: number, number: string, start: number, length: number, extra: Partial<ReferenceBar> = {}) => ({
  index,
  number,
  start: q(start),
  length: q(length),
  repeatStart: false,
  repeatEnd: false,
  endings: [],
  ...extra,
});

describe('fromMusicXml', () => {
  it('merges a chain of three tied notes into one note', () => {
    expect(read('tie-chain-three').notes).toEqual([
      {
        bar: 0,
        onset: q(0),
        duration: q(3),
        midi: 60,
        spelling: { step: 'C', alter: 0, octave: 4 },
        staff: 1,
        voice: '1',
      },
    ]);
  });

  it('keeps grace notes apart from the notes, anchored to their principal note', () => {
    const score = read('grace-acciaccatura');
    expect(score.notes.map((n) => [n.midi, n.onset, n.duration])).toEqual([[60, q(0), q(4)]]);
    expect(score.graceNotes).toEqual([
      { bar: 0, before: q(0), midi: 59, spelling: { step: 'B', alter: 0, octave: 3 } },
    ]);
  });

  it('reads the pitch data under an octave-shift as the sounding pitch (the shift is display only)', () => {
    expect(read('octave-shift-8va').notes.map((n) => n.midi)).toEqual([72, 74, 76]);
  });

  it('gives triplet eighths exact thirds of a quarter', () => {
    expect(read('tuplet-triplet-exact').notes.map((n) => [n.onset, n.duration])).toEqual([
      [q(0), q(1, 3)],
      [q(1, 3), q(1, 3)],
      [q(2, 3), q(1, 3)],
      [q(1), q(3)],
    ]);
  });

  it('marks repeat barlines and ending numbers per written bar', () => {
    expect(read('volta-1-2').bars).toEqual([
      bar(0, '1', 0, 4, { repeatStart: true }),
      bar(1, '2', 4, 4, { repeatEnd: true, endings: [1] }),
      bar(2, '3', 8, 4, { endings: [2] }),
      bar(3, '4', 12, 4),
    ]);
  });

  it('records a repeat played more than twice with its times', () => {
    expect(read('repeat-times-3').bars[1]).toEqual(bar(1, '2', 4, 4, { repeatEnd: true, repeatTimes: 3 }));
  });

  it('keeps a pickup as bar 0 with its short length and printed number "0"', () => {
    expect(read('pickup-implicit').bars).toEqual([bar(0, '0', 0, 1), bar(1, '1', 1, 4)]);
  });

  it('keeps the written spelling of enharmonic notes', () => {
    expect(read('enharmonic-cs-db').notes.map((n) => [n.midi, n.spelling])).toEqual([
      [61, { step: 'C', alter: 1, octave: 4 }],
      [61, { step: 'D', alter: -1, octave: 4 }],
    ]);
  });

  it("takes the played order from the app's own buildTimeline", () => {
    expect(read('volta-1-2').playedOrder).toEqual([0, 1, 0, 2, 3]);
    expect(read('repeat-times-3').playedOrder).toEqual([0, 1, 0, 1, 0, 1]);
  });
});
