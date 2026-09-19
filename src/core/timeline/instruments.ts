import { LIVE_CHANNEL, PERCUSSION_CHANNEL } from '../defaults.js';
import type { Instrument, Note, Part } from '../score/model.js';
import type { ChannelSetup } from './types.js';

export interface InstrumentAssignment {
  channelByKey: Map<string, number>;
  channelSetup: ChannelSetup[];
}

function instrumentKey(partIndex: number, instrument: Instrument): string {
  return `${partIndex}#${instrument.xmlId}`;
}

function emptyChannelSetup(): ChannelSetup {
  return { used: false, program: 0, bankMsb: 0, percussion: false, volume: null, pan: null };
}

/**
 * Assigns each part's instruments to a MIDI channel (R-8.7). Percussion instruments all share
 * PERCUSSION_CHANNEL; melodic instruments honour an explicit, non-colliding channel hint, else
 * share a channel already carrying the same program, else take the next free channel (never the
 * percussion or live-input channels). Parts beyond 14 distinct melodic programs share the last one.
 */
export function assignChannels(parts: Part[]): InstrumentAssignment {
  const channelSetup: ChannelSetup[] = Array.from({ length: 16 }, emptyChannelSetup);
  const channelByKey = new Map<string, number>();
  const programToChannel = new Map<number, number>();

  for (const part of parts) {
    for (const instrument of part.instruments) {
      if (!instrument.percussion) continue;
      channelByKey.set(instrumentKey(part.index, instrument), PERCUSSION_CHANNEL);
      channelSetup[PERCUSSION_CHANNEL] = {
        used: true,
        program: instrument.program,
        bankMsb: instrument.bank ?? 0,
        percussion: true,
        volume: instrument.volume,
        pan: instrument.pan,
      };
    }
  }

  for (const part of parts) {
    for (const instrument of part.instruments) {
      if (instrument.percussion) continue;
      const hint = instrument.channelHint;
      let channel: number | undefined;
      if (hint !== null && hint >= 0 && hint <= 15 && hint !== PERCUSSION_CHANNEL && hint !== LIVE_CHANNEL) {
        const occupant = channelSetup[hint];
        if (occupant && (!occupant.used || occupant.program === instrument.program)) {
          channel = hint;
        }
      }
      if (channel === undefined) {
        channel = programToChannel.get(instrument.program);
      }
      if (channel === undefined) {
        for (let c = 0; c < 16; c++) {
          if (c === PERCUSSION_CHANNEL || c === LIVE_CHANNEL) continue;
          if (!channelSetup[c]?.used) {
            channel = c;
            break;
          }
        }
      }
      if (channel === undefined) channel = 14; // exhausted: share the last melodic channel

      channelByKey.set(instrumentKey(part.index, instrument), channel);
      programToChannel.set(instrument.program, channel);
      channelSetup[channel] = {
        used: true,
        program: instrument.program,
        bankMsb: instrument.bank ?? 0,
        percussion: false,
        volume: instrument.volume,
        pan: instrument.pan,
      };
    }
  }

  return { channelByKey, channelSetup };
}

export function instrumentForNote(part: Part, note: Note): Instrument | undefined {
  if (note.instrument) {
    const found = part.instruments.find((i) => i.xmlId === note.instrument);
    if (found) return found;
  }
  return part.instruments[0];
}

export function channelForNote(assignment: InstrumentAssignment, part: Part, instrument: Instrument): number {
  return assignment.channelByKey.get(instrumentKey(part.index, instrument)) ?? 0;
}

/** The MIDI key actually sounded: the instrument's midi-unpitched for percussion (null if missing = not played), else the note's written/sounding key. */
export function soundingKeyForNote(note: Note, instrument: Instrument | undefined): number | null {
  if (note.unpitched) {
    return instrument?.unpitchedKey ?? null;
  }
  return note.soundingKey;
}
