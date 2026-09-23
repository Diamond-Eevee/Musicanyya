import { QuarterTime, fromTicks } from './time';

export interface MidiEvent {
  ticks: number;
  type: string;
  channel?: number;
  pitch?: number;
  velocity?: number;
}

export interface MidiTimeSignature {
  num: number;
  den: number;
  ticks: number;
}

export interface MidiFile {
  format: number;
  division: number;
  tracks: MidiEvent[][];
  timeSignatures: MidiTimeSignature[];
}

export function readMidi(buffer: Uint8Array): MidiFile {
  let offset = 0;
  function readString(len: number) {
    if (offset + len > buffer.length) throw new Error('Unexpected end of file');
    const str = String.fromCharCode(...buffer.subarray(offset, offset + len));
    offset += len;
    return str;
  }
  function readUint16() {
    if (offset + 2 > buffer.length) throw new Error('Unexpected end of file');
    const val = (buffer[offset] << 8) | buffer[offset + 1];
    offset += 2;
    return val;
  }
  function readUint32() {
    if (offset + 4 > buffer.length) throw new Error('Unexpected end of file');
    const val = (buffer[offset] << 24) | (buffer[offset + 1] << 16) | (buffer[offset + 2] << 8) | buffer[offset + 3];
    offset += 4;
    return val >>> 0;
  }
  function readVarInt() {
    let val = 0;
    while (true) {
      if (offset >= buffer.length) throw new Error('Unexpected end of file');
      const b = buffer[offset++];
      val = (val << 7) | (b & 0x7f);
      if (!(b & 0x80)) break;
    }
    return val;
  }

  const chunkType = readString(4);
  if (chunkType !== 'MThd') throw new Error(`Expected MThd at byte 0, found ${chunkType}`);
  const len = readUint32();
  if (len !== 6) throw new Error(`MThd length must be 6, found ${len}`);
  const format = readUint16();
  const trackCount = readUint16();
  const division = readUint16();
  
  if (division & 0x8000) {
    throw new Error(`SMPTE division not supported at byte ${offset - 2}`);
  }

  const tracks: MidiEvent[][] = [];
  const timeSignatures: MidiTimeSignature[] = [];

  for (let t = 0; t < trackCount; t++) {
    if (offset >= buffer.length) break;
    const type = readString(4);
    const chunkLen = readUint32();
    if (type !== 'MTrk') {
      offset += chunkLen;
      continue;
    }

    const end = offset + chunkLen;
    let ticks = 0;
    let runningStatus = 0;
    const events: MidiEvent[] = [];

    while (offset < end) {
      const delta = readVarInt();
      ticks += delta;
      if (offset >= buffer.length) throw new Error('Unexpected end of file');
      let status = buffer[offset];
      if (status < 0x80) {
        if (!runningStatus) throw new Error(`No running status at byte ${offset}`);
        status = runningStatus;
      } else {
        runningStatus = status;
        offset++;
      }

      const eventType = status >> 4;
      const channel = status & 0x0f;

      if (eventType === 0x8 || eventType === 0x9) {
        if (offset + 2 > buffer.length) throw new Error('Unexpected end of file');
        const pitch = buffer[offset++];
        const velocity = buffer[offset++];
        if (eventType === 0x9 && velocity > 0) {
          events.push({ ticks, type: 'noteOn', channel, pitch, velocity });
        } else {
          events.push({ ticks, type: 'noteOff', channel, pitch, velocity: 0 });
        }
      } else if (eventType === 0xf) {
        // System or Meta
        if (status === 0xff) {
          if (offset + 1 > buffer.length) throw new Error('Unexpected end of file');
          const metaType = buffer[offset++];
          const metaLen = readVarInt();
          if (metaType === 0x58 && metaLen === 4) { // Time signature
            const num = buffer[offset];
            const den = Math.pow(2, buffer[offset + 1]);
            timeSignatures.push({ num, den, ticks });
          }
          offset += metaLen;
        } else if (status === 0xf0 || status === 0xf7) {
          const sysexLen = readVarInt();
          offset += sysexLen;
        }
      } else if (eventType === 0xc || eventType === 0xd) {
        offset += 1;
      } else {
        offset += 2;
      }
    }
    tracks.push(events);
    // ensure offset is at end of chunk (in case of malformed track or early termination)
    offset = end;
  }

  return { format, division, tracks, timeSignatures };
}

export interface ReferenceScore {
  origin: 'musicxml' | 'midi' | 'lilypond';
  bars: any[];
  notes: any[];
  graceNotes: any[];
}

export function fromMidi(buffer: Uint8Array, sourceFile: { midiNoteTracks?: number[] }): ReferenceScore {
  const midi = readMidi(buffer);
  const notes: any[] = [];
  
  const tracksToKeep = new Set(sourceFile.midiNoteTracks || []);

  midi.tracks.forEach((track, idx) => {
    if (sourceFile.midiNoteTracks && !tracksToKeep.has(idx)) return;
    
    // Map of channel -> pitch -> { onset, midi }
    const activeNotes = new Map<string, { onsetTicks: number, midi: number }>();

    for (const event of track) {
      if (event.type === 'noteOn') {
        const key = `${event.channel}-${event.pitch}`;
        activeNotes.set(key, { onsetTicks: event.ticks, midi: event.pitch! });
      } else if (event.type === 'noteOff') {
        const key = `${event.channel}-${event.pitch}`;
        const active = activeNotes.get(key);
        if (active) {
          notes.push({
            bar: -1,
            onset: fromTicks(active.onsetTicks, midi.division),
            duration: fromTicks(event.ticks - active.onsetTicks, midi.division),
            midi: active.midi
          });
          activeNotes.delete(key);
        }
      }
    }
  });

  notes.sort((a, b) => {
    const aOnset = a.onset.num / a.onset.den;
    const bOnset = b.onset.num / b.onset.den;
    if (aOnset !== bOnset) return aOnset - bOnset;
    return a.midi - b.midi;
  });

  return {
    origin: 'midi',
    bars: [],
    notes,
    graceNotes: []
  };
}
