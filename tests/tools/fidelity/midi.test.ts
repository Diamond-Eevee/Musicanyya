import { describe, expect, it } from 'vitest';
import { readMidi, fromMidi } from '../../../tools/library/fidelity/midi';

function strToBytes(str: string): number[] {
  return Array.from(str).map(c => c.charCodeAt(0));
}

function numToBytes(num: number, len: number): number[] {
  const bytes = [];
  for (let i = len - 1; i >= 0; i--) {
    bytes.push((num >> (i * 8)) & 0xff);
  }
  return bytes;
}

function buildTrack(events: number[]): number[] {
  return [
    ...strToBytes('MTrk'),
    ...numToBytes(events.length, 4),
    ...events
  ];
}

describe('MIDI reader', () => {
  it('reads format 0', () => {
    // format 0, 1 track, 384 ppq
    const header = [
      ...strToBytes('MThd'),
      ...numToBytes(6, 4),
      ...numToBytes(0, 2), // format 0
      ...numToBytes(1, 2), // 1 track
      ...numToBytes(384, 2) // division 384
    ];
    // Delta 0, Note On ch 1 (0x90), pitch 60, vel 64
    // Delta 384, Note On ch 1 (0x90), pitch 60, vel 0 (off)
    const track = buildTrack([
      0x00, 0x90, 60, 64,
      0x83, 0x00, 0x90, 60, 0,
      0x00, 0xff, 0x2f, 0x00
    ]);
    const buffer = new Uint8Array([...header, ...track]);
    const midi = readMidi(buffer);
    expect(midi.format).toBe(0);
    expect(midi.division).toBe(384);
    expect(midi.tracks.length).toBe(1);
    expect(midi.tracks[0].length).toBe(2); // Two note events (on/off)
    expect(midi.tracks[0][0]).toEqual({ type: 'noteOn', channel: 0, pitch: 60, velocity: 64, ticks: 0 });
    expect(midi.tracks[0][1]).toEqual({ type: 'noteOff', channel: 0, pitch: 60, velocity: 0, ticks: 384 });
  });

  it('reads format 1', () => {
    const header = [
      ...strToBytes('MThd'),
      ...numToBytes(6, 4),
      ...numToBytes(1, 2),
      ...numToBytes(2, 2),
      ...numToBytes(96, 2)
    ];
    const track1 = buildTrack([0x00, 0xff, 0x2f, 0x00]);
    const track2 = buildTrack([0x00, 0xff, 0x2f, 0x00]);
    const buffer = new Uint8Array([...header, ...track1, ...track2]);
    const midi = readMidi(buffer);
    expect(midi.format).toBe(1);
    expect(midi.tracks.length).toBe(2);
  });

  it('supports running status', () => {
    const header = [
      ...strToBytes('MThd'),
      ...numToBytes(6, 4),
      ...numToBytes(0, 2),
      ...numToBytes(1, 2),
      ...numToBytes(384, 2)
    ];
    // Note on 60, then running status note on 62
    const track = buildTrack([
      0x00, 0x90, 60, 64,
      0x00, 62, 64,
      0x00, 0xff, 0x2f, 0x00
    ]);
    const buffer = new Uint8Array([...header, ...track]);
    const midi = readMidi(buffer);
    expect(midi.tracks[0].length).toBe(2);
    expect(midi.tracks[0][1].pitch).toBe(62);
  });

  it('reads note-on with velocity 0 as note-off', () => {
    const header = [
      ...strToBytes('MThd'),
      ...numToBytes(6, 4),
      ...numToBytes(0, 2),
      ...numToBytes(1, 2),
      ...numToBytes(384, 2)
    ];
    const track = buildTrack([
      0x00, 0x90, 60, 64,
      0x00, 0x90, 60, 0,
      0x00, 0xff, 0x2f, 0x00
    ]);
    const buffer = new Uint8Array([...header, ...track]);
    const midi = readMidi(buffer);
    expect(midi.tracks[0][1].type).toBe('noteOff');
  });

  it('reads time-signature meta and skips other meta', () => {
    const header = [
      ...strToBytes('MThd'),
      ...numToBytes(6, 4),
      ...numToBytes(0, 2),
      ...numToBytes(1, 2),
      ...numToBytes(384, 2)
    ];
    // Meta time signature 3/4
    // Meta text (skip)
    const track = buildTrack([
      0x00, 0xff, 0x58, 0x04, 0x03, 0x02, 0x18, 0x08,
      0x00, 0xff, 0x01, 0x04, ...strToBytes('test'),
      0x00, 0x90, 60, 64,
      0x00, 0xff, 0x2f, 0x00
    ]);
    const buffer = new Uint8Array([...header, ...track]);
    const midi = readMidi(buffer);
    expect(midi.timeSignatures).toEqual([{ num: 3, den: 4, ticks: 0 }]);
  });

  it('rejects SMPTE division with the byte offset', () => {
    const header = [
      ...strToBytes('MThd'),
      ...numToBytes(6, 4),
      ...numToBytes(0, 2),
      ...numToBytes(1, 2),
      0x80, 0x00 // SMPTE (negative top byte)
    ];
    const track = buildTrack([0x00, 0xff, 0x2f, 0x00]);
    const buffer = new Uint8Array([...header, ...track]);
    expect(() => readMidi(buffer)).toThrow(/SMPTE division not supported at byte 12/);
  });

  it('rejects a truncated chunk with the byte offset', () => {
    const header = [
      ...strToBytes('MThd'),
      ...numToBytes(6, 4),
      ...numToBytes(0, 2),
      ...numToBytes(1, 2),
      ...numToBytes(384, 2)
    ];
    // truncated MTrk length 10 but array ends
    const track = [
      ...strToBytes('MTrk'),
      ...numToBytes(10, 4),
      0x00, 0xff
    ];
    const buffer = new Uint8Array([...header, ...track]);
    expect(() => readMidi(buffer)).toThrow(/Unexpected end of file/);
  });
});

describe('fromMidi', () => {
  it('keeps only midiNoteTracks and converts to QuarterTime', () => {
    const header = [
      ...strToBytes('MThd'),
      ...numToBytes(6, 4),
      ...numToBytes(1, 2),
      ...numToBytes(3, 2),
      ...numToBytes(384, 2)
    ];
    // Track 0: Note on 60 (len 384)
    const track0 = buildTrack([
      0x00, 0x90, 60, 64,
      0x83, 0x00, 0x90, 60, 0,
      0x00, 0xff, 0x2f, 0x00
    ]);
    // Track 1: Note on 62 (len 384)
    const track1 = buildTrack([
      0x00, 0x90, 62, 64,
      0x83, 0x00, 0x90, 62, 0,
      0x00, 0xff, 0x2f, 0x00
    ]);
    // Track 2: Note on 64 (len 384)
    const track2 = buildTrack([
      0x00, 0x90, 64, 64,
      0x83, 0x00, 0x90, 64, 0,
      0x00, 0xff, 0x2f, 0x00
    ]);
    const buffer = new Uint8Array([...header, ...track0, ...track1, ...track2]);
    const file = { format: 'midi' as const, url: 'x', role: 'sound' as const, midiNoteTracks: [1, 2] };
    const score = fromMidi(buffer, file);

    expect(score.origin).toBe('midi');
    expect(score.bars).toEqual([]); // no bars
    expect(score.notes.length).toBe(2);
    expect(score.notes[0].midi).toBe(62);
    expect(score.notes[1].midi).toBe(64);
    expect(score.notes[0].duration).toEqual({ num: 1, den: 1 });
  });

  it('handles overlapping same-pitch notes on different channels', () => {
    const header = [
      ...strToBytes('MThd'),
      ...numToBytes(6, 4),
      ...numToBytes(0, 2),
      ...numToBytes(1, 2),
      ...numToBytes(384, 2)
    ];
    const track = buildTrack([
      0x00, 0x90, 60, 64,
      0x00, 0x91, 60, 64,
      0x83, 0x00, 0x90, 60, 0,
      0x83, 0x00, 0x91, 60, 0,
      0x00, 0xff, 0x2f, 0x00
    ]);
    const buffer = new Uint8Array([...header, ...track]);
    const file = { format: 'midi' as const, url: 'x', role: 'sound' as const, midiNoteTracks: [0] };
    const score = fromMidi(buffer, file);
    expect(score.notes.length).toBe(2);
    expect(score.notes[0].duration).toEqual({ num: 1, den: 1 });
    expect(score.notes[1].duration).toEqual({ num: 2, den: 1 });
  });
});
