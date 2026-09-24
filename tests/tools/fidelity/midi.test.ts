import { describe, expect, it } from 'vitest';
import { fromMidi, MidiFormatError, readMidi } from '../../../tools/library/fidelity/midi';
import { q } from '../../../tools/library/fidelity/time';

const ascii = (s: string): number[] => Array.from(s, (c) => c.charCodeAt(0));
const be = (n: number, len: number): number[] =>
  Array.from({ length: len }, (_, i) => (n >> ((len - 1 - i) * 8)) & 0xff);
const header = (format: number, tracks: number, division: number): number[] => [
  ...ascii('MThd'),
  ...be(6, 4),
  ...be(format, 2),
  ...be(tracks, 2),
  ...be(division, 2),
];
const track = (events: number[]): number[] => [...ascii('MTrk'), ...be(events.length, 4), ...events];
const END = [0x00, 0xff, 0x2f, 0x00];
const file = (...parts: number[][]): Uint8Array => new Uint8Array(parts.flat());

describe('readMidi', () => {
  it('reads a format 0 file: one note, ticks and ppq kept as integers', () => {
    // delta 0 note-on C4; delta 384 (0x83 0x00) note-off
    const midi = readMidi(file(header(0, 1, 384), track([0x00, 0x90, 60, 64, 0x83, 0x00, 0x80, 60, 0, ...END])));
    expect(midi.format).toBe(0);
    expect(midi.ppq).toBe(384);
    expect(midi.notes).toEqual([{ track: 0, channel: 0, midi: 60, onTick: 0, offTick: 384 }]);
  });

  it('reads a format 1 file and records the track of every note', () => {
    const midi = readMidi(
      file(
        header(1, 3, 96),
        track([0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20, ...END]), // tempo track, no notes
        track([0x00, 0x90, 64, 80, 0x60, 0x80, 64, 0, ...END]),
        track([0x00, 0x91, 48, 80, 0x60, 0x81, 48, 0, ...END]),
      ),
    );
    expect(midi.format).toBe(1);
    expect(midi.notes).toEqual([
      { track: 1, channel: 0, midi: 64, onTick: 0, offTick: 96 },
      { track: 2, channel: 1, midi: 48, onTick: 0, offTick: 96 },
    ]);
  });

  it('applies running status to data bytes that follow a channel message', () => {
    // note-on 60, running-status note-on 62, then running-status velocity-0 offs
    const midi = readMidi(
      file(header(0, 1, 384), track([0x00, 0x90, 60, 64, 0x00, 62, 64, 0x83, 0x00, 60, 0, 0x00, 62, 0, ...END])),
    );
    expect(midi.notes).toEqual([
      { track: 0, channel: 0, midi: 60, onTick: 0, offTick: 384 },
      { track: 0, channel: 0, midi: 62, onTick: 0, offTick: 384 },
    ]);
  });

  it('reads note-on with velocity 0 as note-off', () => {
    const midi = readMidi(file(header(0, 1, 384), track([0x00, 0x90, 60, 64, 0x81, 0x40, 0x90, 60, 0, ...END])));
    expect(midi.notes).toEqual([{ track: 0, channel: 0, midi: 60, onTick: 0, offTick: 192 }]);
  });

  it('keeps overlapping same-pitch notes on different channels apart', () => {
    const midi = readMidi(
      file(
        header(0, 1, 384),
        track([0x00, 0x90, 60, 64, 0x00, 0x91, 60, 64, 0x83, 0x00, 0x80, 60, 0, 0x83, 0x00, 0x81, 60, 0, ...END]),
      ),
    );
    expect(midi.notes).toEqual([
      { track: 0, channel: 0, midi: 60, onTick: 0, offTick: 384 },
      { track: 0, channel: 1, midi: 60, onTick: 0, offTick: 768 },
    ]);
  });

  it('closes overlapping same-pitch notes on one channel first-in, first-out', () => {
    // on@0, on@192, off@384, off@576: two notes, neither lost
    const midi = readMidi(
      file(
        header(0, 1, 384),
        track([0x00, 0x90, 60, 64, 0x81, 0x40, 0x90, 60, 64, 0x81, 0x40, 0x80, 60, 0, 0x81, 0x40, 0x80, 60, 0, ...END]),
      ),
    );
    expect(midi.notes).toEqual([
      { track: 0, channel: 0, midi: 60, onTick: 0, offTick: 384 },
      { track: 0, channel: 0, midi: 60, onTick: 192, offTick: 576 },
    ]);
  });

  it('reads the time-signature meta event and skips other meta and sysex events', () => {
    const midi = readMidi(
      file(
        header(0, 1, 384),
        track([
          0x00,
          0xff,
          0x58,
          0x04,
          0x03,
          0x03,
          0x18,
          0x08, // 3/8
          0x00,
          0xff,
          0x01,
          0x04,
          ...ascii('test'), // text meta
          0x00,
          0xf0,
          0x02,
          0x7e,
          0xf7, // sysex
          0x00,
          0x90,
          60,
          64,
          0x81,
          0x40,
          0x80,
          60,
          0,
          ...END,
        ]),
      ),
    );
    expect(midi.timeSignatures).toEqual([{ tick: 0, num: 3, den: 8 }]);
    expect(midi.notes).toHaveLength(1);
  });

  it('reads set-tempo meta events as quarter notes per minute (T096: the playback tempo of a conversion)', () => {
    // 500000 us per quarter = 120; 384615 us = 156.0001..., kept to two decimals.
    const midi = readMidi(
      file(
        header(0, 1, 384),
        track([0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20, 0x83, 0x00, 0xff, 0x51, 0x03, 0x05, 0xde, 0x67, ...END]),
      ),
    );
    expect(midi.tempos).toEqual([
      { tick: 0, qpm: 120 },
      { tick: 384, qpm: 156 },
    ]);
  });

  it('rejects an SMPTE division, naming the byte offset of the division field', () => {
    const bytes = file([...ascii('MThd'), ...be(6, 4), ...be(0, 2), ...be(1, 2), 0xe7, 0x28], track(END));
    expect(() => readMidi(bytes)).toThrow(MidiFormatError);
    expect(() => readMidi(bytes)).toThrow(/SMPTE.*byte 12/);
  });

  it('rejects a truncated chunk, naming the byte offset where it runs out', () => {
    // MTrk claims 10 bytes, only 2 follow; the chunk body starts at byte 22
    const bytes = file(header(0, 1, 384), [...ascii('MTrk'), ...be(10, 4), 0x00, 0xff]);
    expect(() => readMidi(bytes)).toThrow(MidiFormatError);
    expect(() => readMidi(bytes)).toThrow(/truncated.*byte 22/);
  });

  it('rejects a note that never ends', () => {
    const bytes = file(header(0, 1, 384), track([0x00, 0x90, 60, 64, ...END]));
    expect(() => readMidi(bytes)).toThrow(/never ends/);
  });
});

describe('fromMidi', () => {
  const threeTracks = readMidi(
    file(
      header(1, 3, 384),
      track([0x00, 0x90, 60, 64, 0x83, 0x00, 0x80, 60, 0, ...END]),
      track([0x00, 0x90, 64, 64, 0x83, 0x00, 0x80, 64, 0, ...END]),
      // a triplet eighth at 384 ppq: 128 ticks, then a quarter
      track([0x00, 0x90, 67, 64, 0x81, 0x00, 0x80, 67, 0, 0x00, 0x90, 69, 64, 0x83, 0x00, 0x80, 69, 0, ...END]),
    ),
  );

  it('keeps only the named tracks and converts ticks to exact quarter time', () => {
    const score = fromMidi(threeTracks, [1, 2]);
    expect(score).toEqual({
      origin: 'midi',
      bars: [],
      graceNotes: [],
      notes: [
        { bar: -1, onset: q(0), duration: q(1), midi: 64 },
        { bar: -1, onset: q(0), duration: q(1, 3), midi: 67 },
        { bar: -1, onset: q(1, 3), duration: q(1), midi: 69 },
      ],
    });
  });

  it('sorts notes by onset, then pitch', () => {
    const score = fromMidi(threeTracks, [2, 0, 1]);
    expect(score.notes.map((n) => n.midi)).toEqual([60, 64, 67, 69]);
  });
});
