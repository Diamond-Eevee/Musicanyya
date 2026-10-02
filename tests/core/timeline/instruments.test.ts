import { describe, expect, it } from 'vitest';
import { LIVE_CHANNEL, METRONOME_CHANNEL, PERCUSSION_CHANNEL } from '../../../src/core/defaults.js';
import type { Instrument, Note, Part } from '../../../src/core/score/model.js';
import {
  assignChannels,
  channelForNote,
  instrumentForNote,
  soundingKeyForNote,
} from '../../../src/core/timeline/instruments.js';

function instrument(overrides: Partial<Instrument> = {}): Instrument {
  return {
    xmlId: 'I1',
    name: '',
    program: 0,
    bank: null,
    channelHint: null,
    percussion: false,
    unpitchedKey: null,
    volume: null,
    pan: null,
    fallback: false,
    ...overrides,
  };
}

function part(index: number, instruments: Instrument[], orchestra = false): Part {
  return {
    index,
    xmlId: `P${index + 1}`,
    name: '',
    orchestra,
    staves: 1,
    instruments,
    notes: [],
    dynamics: [],
    soundDynamics: [],
    wedges: [],
    transpositions: [],
    clefs: [],
    keys: [],
    octaveShifts: [],
  };
}

describe('assignChannels', () => {
  it('honours distinct channel hints for two melodic parts (instruments-two-parts)', () => {
    const piano = instrument({ xmlId: 'P1-I1', program: 0, channelHint: 0 });
    const violin = instrument({ xmlId: 'P2-I1', program: 40, channelHint: 1 });
    const parts = [part(0, [piano]), part(1, [violin])];
    const { channelByKey, channelSetup } = assignChannels(parts);
    expect(channelByKey.get('0#P1-I1')).toBe(0);
    expect(channelByKey.get('1#P2-I1')).toBe(1);
    expect(channelSetup[0]).toMatchObject({ used: true, program: 0, percussion: false });
    expect(channelSetup[1]).toMatchObject({ used: true, program: 40, percussion: false });
  });

  it('always routes percussion to PERCUSSION_CHANNEL regardless of channel hint', () => {
    const snare = instrument({ xmlId: 'P1-I1', percussion: true, channelHint: 9, unpitchedKey: 38 });
    const parts = [part(0, [snare])];
    const { channelByKey, channelSetup } = assignChannels(parts);
    expect(channelByKey.get('0#P1-I1')).toBe(PERCUSSION_CHANNEL);
    expect(channelSetup[PERCUSSION_CHANNEL]).toMatchObject({ used: true, percussion: true });
  });

  it('reassigns a channel hint that collides with a different program', () => {
    const a = instrument({ xmlId: 'A', program: 0, channelHint: 0 });
    const b = instrument({ xmlId: 'B', program: 40, channelHint: 0 }); // collides with A's channel 0
    const parts = [part(0, [a]), part(1, [b])];
    const { channelByKey } = assignChannels(parts);
    expect(channelByKey.get('0#A')).toBe(0);
    expect(channelByKey.get('1#B')).not.toBe(0);
    expect(channelByKey.get('1#B')).not.toBe(PERCUSSION_CHANNEL);
    expect(channelByKey.get('1#B')).not.toBe(LIVE_CHANNEL);
  });

  it('shares a channel between parts with the same program', () => {
    const a = instrument({ xmlId: 'A', program: 0, channelHint: null });
    const b = instrument({ xmlId: 'B', program: 0, channelHint: null });
    const parts = [part(0, [a]), part(1, [b])];
    const { channelByKey } = assignChannels(parts);
    expect(channelByKey.get('0#A')).toBe(channelByKey.get('1#B'));
  });

  it('never allocates the live-input channel to score content', () => {
    const many = Array.from({ length: 16 }, (_, i) => instrument({ xmlId: `I${i}`, program: i, channelHint: null }));
    const parts = [part(0, many)];
    const { channelByKey } = assignChannels(parts);
    for (const value of channelByKey.values()) {
      expect(value).not.toBe(LIVE_CHANNEL);
    }
  });

  it('never allocates the Metronome channel to score content via an explicit channel hint (metronome-channel-collision, research R-19)', () => {
    const piano = instrument({ xmlId: 'P1-I1', program: 0, channelHint: METRONOME_CHANNEL });
    const parts = [part(0, [piano])];
    const { channelByKey, channelSetup } = assignChannels(parts);
    expect(channelByKey.get('0#P1-I1')).not.toBe(METRONOME_CHANNEL);
    expect(channelSetup[METRONOME_CHANNEL]?.used).toBe(false);
  });

  it('never allocates the Metronome channel to score content when melodic channels run out (research R-19)', () => {
    // 16 distinct programs: more than the 13 melodic channels now free (16 minus percussion, live and Metronome).
    const many = Array.from({ length: 16 }, (_, i) => instrument({ xmlId: `I${i}`, program: i, channelHint: null }));
    const parts = [part(0, many)];
    const { channelByKey, channelSetup } = assignChannels(parts);
    for (const value of channelByKey.values()) {
      expect(value).not.toBe(METRONOME_CHANNEL);
      expect(value).not.toBe(LIVE_CHANNEL);
    }
    expect(channelSetup[METRONOME_CHANNEL]?.used).toBe(false);
  });
});

// Feature 019 (data-model section 2, research R-4): Orchestra instruments get channels of their own, so the Orchestra
// level can never change a printed part.
describe('assignChannels with Orchestra parts', () => {
  const printedChannel = (a: ReturnType<typeof assignChannels>, key: string) => a.channelByKey.get(key) as number;

  it('an Orchestra instrument never shares a printed part channel, also when it has the same program', () => {
    const piano = instrument({ xmlId: 'A', program: 0, channelHint: 0 });
    const orchestraPiano = instrument({ xmlId: 'B', program: 0, channelHint: null });
    const assignment = assignChannels([part(0, [piano]), part(1, [orchestraPiano], true)]);
    const printed = printedChannel(assignment, '0#A');
    const orchestra = printedChannel(assignment, '1#B');
    expect(orchestra).not.toBe(printed);
    expect(assignment.channelSetup[printed]).toMatchObject({ used: true, orchestra: false });
    expect(assignment.channelSetup[orchestra]).toMatchObject({ used: true, program: 0, orchestra: true });
    expect(assignment.orchestraChannelsShared).toBe(false);
  });

  it('printed parts are assigned first even when the Orchestra part comes first in the file', () => {
    const oboe = instrument({ xmlId: 'O', program: 68, channelHint: 0 });
    const piano = instrument({ xmlId: 'P', program: 0, channelHint: 0 });
    const assignment = assignChannels([part(0, [oboe], true), part(1, [piano])]);
    expect(printedChannel(assignment, '1#P')).toBe(0); // the piano gets the channel its hint names
    expect(printedChannel(assignment, '0#O')).not.toBe(0);
    expect(assignment.channelSetup[0]?.orchestra).toBe(false);
  });

  it('an Orchestra instrument takes a free channel its hint names, never a used one', () => {
    const free = instrument({ xmlId: 'F', program: 68, channelHint: 5 });
    const taken = instrument({ xmlId: 'T', program: 70, channelHint: 0 }); // channel 0 is the piano's
    const piano = instrument({ xmlId: 'P', program: 0, channelHint: 0 });
    const assignment = assignChannels([part(0, [piano]), part(1, [free, taken], true)]);
    expect(printedChannel(assignment, '1#F')).toBe(5);
    expect(printedChannel(assignment, '1#T')).not.toBe(0);
  });

  it('Orchestra instruments of one program share one Orchestra channel; different programs get channels of their own', () => {
    const piano = instrument({ xmlId: 'P', program: 0 });
    const strings1 = instrument({ xmlId: 'S1', program: 48 });
    const strings2 = instrument({ xmlId: 'S2', program: 48 });
    const flute = instrument({ xmlId: 'F', program: 73 });
    const assignment = assignChannels([part(0, [piano]), part(1, [strings1], true), part(2, [strings2, flute], true)]);
    expect(printedChannel(assignment, '1#S1')).toBe(printedChannel(assignment, '2#S2'));
    expect(printedChannel(assignment, '2#F')).not.toBe(printedChannel(assignment, '2#S2'));
    for (const key of ['1#S1', '2#S2', '2#F']) {
      expect(assignment.channelSetup[printedChannel(assignment, key)]?.orchestra, key).toBe(true);
    }
    expect(assignment.channelSetup.filter((c) => c.orchestra)).toHaveLength(2);
  });

  it('never takes the percussion, live-input or Metronome channel', () => {
    const piano = instrument({ xmlId: 'P', program: 0 });
    const many = Array.from({ length: 10 }, (_, i) => instrument({ xmlId: `O${i}`, program: 40 + i }));
    const assignment = assignChannels([part(0, [piano]), part(1, many, true)]);
    for (const channel of assignment.channelByKey.values()) {
      expect([PERCUSSION_CHANNEL, LIVE_CHANNEL, METRONOME_CHANNEL]).not.toContain(channel);
    }
    for (const reserved of [PERCUSSION_CHANNEL, LIVE_CHANNEL, METRONOME_CHANNEL]) {
      expect(assignment.channelSetup[reserved]?.orchestra).toBe(false);
    }
  });

  it('when no channel is free the extra Orchestra instruments share the last Orchestra channel and say so', () => {
    // 13 melodic channels are free (16 minus percussion, live and Metronome): one printed piano and 13 Orchestra programs
    const piano = instrument({ xmlId: 'P', program: 0 });
    const many = Array.from({ length: 13 }, (_, i) => instrument({ xmlId: `O${i}`, program: 40 + i }));
    const assignment = assignChannels([part(0, [piano]), part(1, many, true)]);
    expect(assignment.orchestraChannelsShared).toBe(true);
    const printed = printedChannel(assignment, '0#P');
    const channels = many.map((_, i) => printedChannel(assignment, `1#O${i}`));
    expect(channels).not.toContain(printed); // never the printed part's channel
    expect(new Set(channels).size).toBe(12); // the last one shares with the one before it
    expect(channels[12]).toBe(channels[11]);
    for (const channel of channels) expect(assignment.channelSetup[channel]?.orchestra).toBe(true);
    expect(assignment.channelSetup[printed]?.orchestra).toBe(false);
  });

  it('a Score without an Orchestra part assigns exactly as before and marks no channel', () => {
    const a = instrument({ xmlId: 'A', program: 0, channelHint: 0 });
    const b = instrument({ xmlId: 'B', program: 40, channelHint: 1 });
    const assignment = assignChannels([part(0, [a]), part(1, [b])]);
    expect([...assignment.channelByKey.entries()]).toEqual([
      ['0#A', 0],
      ['1#B', 1],
    ]);
    expect(assignment.channelSetup.every((c) => c.orchestra === false)).toBe(true);
    expect(assignment.orchestraChannelsShared).toBe(false);
  });
});

describe('instrumentForNote / channelForNote / soundingKeyForNote', () => {
  it('resolves a note explicit <instrument id> override, else the part default (first)', () => {
    const first = instrument({ xmlId: 'A', program: 0 });
    const second = instrument({ xmlId: 'B', program: 40 });
    const p = part(0, [first, second]);
    const noteA: Note = baseNote({ instrument: 'B' });
    expect(instrumentForNote(p, noteA)?.xmlId).toBe('B');
    const noteB: Note = baseNote({ instrument: null });
    expect(instrumentForNote(p, noteB)?.xmlId).toBe('A');
  });

  it('falls back to piano (program 0) when the instrument was unresolved during build (instrument-missing-fallback)', () => {
    const piano = instrument({ xmlId: '', program: 0, fallback: true });
    const p = part(0, [piano]);
    const { channelByKey } = assignChannels([p]);
    const inst = instrumentForNote(p, baseNote({ instrument: null }));
    if (!inst) throw new Error('expected a resolved instrument');
    expect(inst.program).toBe(0);
    expect(channelForNote({ channelByKey, channelSetup: [] }, p, inst)).toBe(0);
  });

  it('sounds the instrument midi-unpitched key for a percussion note (percussion-unpitched)', () => {
    const snare = instrument({ xmlId: 'I1', percussion: true, unpitchedKey: 38 });
    const p = part(0, [snare]);
    const note = baseNote({ unpitched: true, writtenKey: 72, soundingKey: 72, instrument: 'I1' });
    const inst = instrumentForNote(p, note);
    expect(soundingKeyForNote(note, inst)).toBe(38);
  });

  it('does not play an unpitched note whose instrument has no midi-unpitched', () => {
    const noSound = instrument({ xmlId: 'I1', percussion: true, unpitchedKey: null });
    const p = part(0, [noSound]);
    const note = baseNote({ unpitched: true, writtenKey: 72, soundingKey: 72, instrument: 'I1' });
    const inst = instrumentForNote(p, note);
    expect(soundingKeyForNote(note, inst)).toBeNull();
  });
});

function baseNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n-p0-s1-m0-v1-o0-k60',
    part: 0,
    staff: 1,
    voice: '1',
    measureIndex: 0,
    onsetInMeasure: 0,
    onsetQuarters: { num: 0, den: 1 },
    durationTicks: 960,
    step: 'C',
    writtenKey: 60,
    soundingKey: 60,
    unpitched: false,
    grace: null,
    tie: { start: false, stop: false },
    chord: false,
    instrument: null,
    velocityOverride: null,
    accent: false,
    fingerings: [],
    printed: true,
    source: { start: 0, end: 0 },
    ornament: null,
    arpeggiate: false,
    ...overrides,
  };
}
