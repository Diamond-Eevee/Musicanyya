// Standard MIDI File reader (research R3): formats 0 and 1, running status, note-on velocity 0 as note-off, meta
// events skipped except the time signature. No SMPTE division; any other file shape fails with the byte offset.
import { compareNotes, type ReferenceNote, type ReferenceScore, validateReference } from './reference';
import { fromTicks } from './time';

export type { ReferenceBar, ReferenceGraceNote, ReferenceNote, ReferenceScore } from './reference';

export interface MidiNote {
  track: number;
  channel: number;
  midi: number;
  onTick: number;
  offTick: number;
}

export interface MidiFile {
  format: 0 | 1;
  ppq: number;
  /** Sorted by track, then onset tick, then pitch. */
  notes: MidiNote[];
  timeSignatures: { tick: number; num: number; den: number }[];
}

export class MidiFormatError extends Error {
  constructor(
    detail: string,
    public readonly offset: number,
  ) {
    super(`${detail} at byte ${offset}`);
    this.name = 'MidiFormatError';
  }
}

/** Data bytes per channel message, by status high nibble. */
const DATA_BYTES: Record<number, number> = { 8: 2, 9: 2, 10: 2, 11: 2, 12: 1, 13: 1, 14: 2 };

export function readMidi(bytes: Uint8Array): MidiFile {
  let pos = 0;
  const need = (n: number, limit: number, what: string): void => {
    if (pos + n > limit) throw new MidiFormatError(`${what} is truncated`, pos);
  };
  const u8 = (limit: number): number => {
    need(1, limit, 'event');
    return bytes[pos++] as number;
  };
  const uint = (n: number, limit: number, what: string): number => {
    need(n, limit, what);
    let v = 0;
    for (let i = 0; i < n; i++) v = v * 256 + (bytes[pos++] as number);
    return v;
  };
  const ascii4 = (): string => {
    need(4, bytes.length, 'chunk header');
    const s = String.fromCharCode(...bytes.subarray(pos, pos + 4));
    pos += 4;
    return s;
  };
  const varLen = (limit: number): number => {
    let v = 0;
    for (let i = 0; i < 4; i++) {
      const b = u8(limit);
      v = v * 128 + (b & 0x7f);
      if ((b & 0x80) === 0) return v;
    }
    throw new MidiFormatError('variable-length number longer than 4 bytes', pos);
  };

  if (ascii4() !== 'MThd') throw new MidiFormatError('not a MIDI file (no MThd)', 0);
  const headerLength = uint(4, bytes.length, 'header');
  if (headerLength < 6) throw new MidiFormatError('header shorter than 6 bytes', 4);
  const headerEnd = pos + headerLength;
  const format = uint(2, headerEnd, 'header');
  if (format !== 0 && format !== 1) throw new MidiFormatError(`MIDI format ${format} is not supported`, 8);
  const trackCount = uint(2, headerEnd, 'header');
  const divisionOffset = pos;
  const ppq = uint(2, headerEnd, 'header');
  if (ppq & 0x8000) throw new MidiFormatError('SMPTE division is not supported', divisionOffset);
  if (ppq === 0) throw new MidiFormatError('division is 0', divisionOffset);
  pos = headerEnd;

  const notes: MidiNote[] = [];
  const timeSignatures: MidiFile['timeSignatures'] = [];
  let track = 0;
  while (track < trackCount) {
    const chunkStart = pos;
    const type = ascii4();
    const length = uint(4, bytes.length, 'chunk header');
    const bodyStart = pos;
    if (bodyStart + length > bytes.length) throw new MidiFormatError(`${type} chunk is truncated`, bodyStart);
    const end = bodyStart + length;
    if (type !== 'MTrk') {
      // Unknown chunk types are skipped, as the SMF specification requires.
      if (!/^[\x20-\x7e]{4}$/.test(type)) throw new MidiFormatError('invalid chunk type', chunkStart);
      pos = end;
      continue;
    }
    readTrack(track, end);
    pos = end;
    track++;
  }

  function readTrack(trackIndex: number, end: number): void {
    let tick = 0;
    let running = 0;
    const open = new Map<number, number[]>(); // channel * 128 + key -> onset ticks, oldest first
    const trackNotes: MidiNote[] = [];
    while (pos < end) {
      tick += varLen(end);
      const statusOffset = pos;
      let status = u8(end);
      if (status < 0x80) {
        if (running === 0) throw new MidiFormatError('data byte without running status', statusOffset);
        status = running;
        pos--;
      }
      if (status === 0xff) {
        const metaType = u8(end);
        const len = varLen(end);
        need(len, end, 'meta event');
        if (metaType === 0x58) {
          if (len < 2) throw new MidiFormatError('time signature shorter than 2 bytes', pos);
          timeSignatures.push({ tick, num: bytes[pos] as number, den: 2 ** (bytes[pos + 1] as number) });
        }
        pos += len;
        if (metaType === 0x2f) break;
        continue;
      }
      if (status === 0xf0 || status === 0xf7) {
        const len = varLen(end);
        need(len, end, 'sysex event');
        pos += len;
        continue;
      }
      if (status >= 0xf0) throw new MidiFormatError(`system message 0x${status.toString(16)} in a file`, statusOffset);
      running = status;
      const kind = status >> 4;
      const channel = status & 0x0f;
      const dataBytes = DATA_BYTES[kind] as number;
      need(dataBytes, end, 'channel event');
      if (kind === 0x8 || kind === 0x9) {
        const key = bytes[pos] as number;
        const velocity = bytes[pos + 1] as number;
        const slot = channel * 128 + key;
        if (kind === 0x9 && velocity > 0) {
          const list = open.get(slot);
          if (list) list.push(tick);
          else open.set(slot, [tick]);
        } else {
          const onTick = open.get(slot)?.shift();
          // A note-off with no sounding note is harmless and ignored.
          if (onTick !== undefined) trackNotes.push({ track: trackIndex, channel, midi: key, onTick, offTick: tick });
        }
      }
      pos += dataBytes;
    }
    for (const [slot, ticks] of open) {
      if (ticks.length > 0)
        throw new MidiFormatError(
          `track ${trackIndex}: note ${slot % 128} on channel ${Math.floor(slot / 128)} never ends (tick ${ticks[0]})`,
          end,
        );
    }
    trackNotes.sort((a, b) => a.onTick - b.onTick || a.midi - b.midi || a.channel - b.channel);
    notes.push(...trackNotes);
  }

  return { format, ppq, notes, timeSignatures };
}

/** The sounding notes of the named tracks as exact quarter time; bars are assigned later by alignment. */
export function fromMidi(file: MidiFile, tracks: number[]): ReferenceScore {
  const keep = new Set(tracks);
  const notes: ReferenceNote[] = file.notes
    .filter((n) => keep.has(n.track))
    .map((n) => ({
      bar: -1,
      onset: fromTicks(n.onTick, file.ppq),
      duration: fromTicks(n.offTick - n.onTick, file.ppq),
      midi: n.midi,
    }));
  notes.sort(compareNotes);
  return validateReference({ origin: 'midi', bars: [], notes, graceNotes: [] });
}
