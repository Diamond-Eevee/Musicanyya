// The Orchestra generator (feature 019, contracts/orchestration-definition.md section 2, research R-16): writes the Orchestra
// parts of a library item from its reviewed definition. Pure: MusicXML text in, MusicXML text out. The printed part and
// everything before it are never touched; Orchestra parts already in the file are cut out first, so a second run gives the
// same text (idempotent). Dev-time only.
import { buildScore } from '../../../src/core/musicxml/build';
import { orchestraRemovals } from '../../../src/core/musicxml/orchestra';
import { readXml } from '../../../src/core/musicxml/read';
import {
  type WriteDuration,
  type WriteEvent,
  type WriteMeasure,
  type WriteNote,
  writePartXml,
  writeScorePartXml,
} from '../../../src/core/musicxml/write';
import type { Note, Score } from '../../../src/core/score/model';
import type { OrchestraInstrument, OrchestrationDefinition, Passage } from './definition';

export class GenerateError extends Error {
  constructor(detail: string) {
    super(`orchestra generation: ${detail}`);
    this.name = 'GenerateError';
  }
}

const LETTER_PITCH_CLASS: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const TYPES: readonly [number, WriteDuration][] = [
  [8, 'breve'],
  [4, 'whole'],
  [2, 'half'],
  [1, 'quarter'],
  [1 / 2, 'eighth'],
  [1 / 4, '16th'],
  [1 / 8, '32nd'],
  [1 / 16, '64th'],
];

/** The note type for a length in ticks: the largest one that is not longer. The part is never printed, so this is
 *  bookkeeping; the app reads `<duration>`. */
function typeOf(duration: number, ppq: number): WriteDuration {
  const quarters = duration / ppq;
  for (const [length, type] of TYPES) if (quarters >= length - 1e-9) return type;
  return '64th';
}

export const keyName = (key: number): string => `${NAMES[((key % 12) + 12) % 12]}${Math.floor(key / 12) - 1}`;

/** A written pitch for `key` that keeps the piano note's letter: the octave and alteration follow from the key. */
function spell(step: string, key: number): { step: string; alter: number; octave: number } {
  const pitchClass = LETTER_PITCH_CLASS[step] ?? 0;
  const octave = Math.round((key - pitchClass) / 12) - 1;
  return { step, alter: key - ((octave + 1) * 12 + pitchClass), octave };
}

interface Doubled {
  measure: number;
  onset: number;
  duration: number;
  /** One entry per pitch of the (chord) group. */
  pitches: { step: string; key: number; tie: Note['tie'] }[];
}

/** Which of the piano's notes a passage doubles, grouped by onset (and length, so a chord stays a chord). */
function doubledNotes(
  piano: readonly Note[],
  instrument: OrchestraInstrument,
  passage: Passage,
  ppq: number,
): Doubled[] {
  const eligible = piano.filter(
    (n) =>
      n.printed &&
      !n.unpitched &&
      n.grace === null &&
      n.ornament === null && // ornamented (trilled) notes are never doubled
      n.staff === passage.doubles.staff &&
      n.measureIndex >= passage.bars.from - 1 &&
      n.measureIndex <= passage.bars.to - 1 &&
      n.durationTicks / ppq >= (passage.minQuarters ?? 0) - 1e-9,
  );
  const byOnset = new Map<string, Note[]>();
  for (const note of eligible) {
    const key = `${note.measureIndex}:${note.onsetInMeasure}`;
    byOnset.set(key, [...(byOnset.get(key) ?? []), note]);
  }
  const groups = new Map<string, Doubled>();
  for (const notes of byOnset.values()) {
    const sorted = [...notes].sort((a, b) => a.soundingKey - b.soundingKey);
    const chosen =
      passage.doubles.pick === 'top'
        ? sorted.slice(-1)
        : passage.doubles.pick === 'bottom'
          ? sorted.slice(0, 1)
          : sorted;
    for (const note of chosen) {
      for (const shift of passage.octaves) {
        let key = note.soundingKey + 12 * shift;
        if (passage.fitRange) {
          while (key > instrument.range.high) key -= 12;
          while (key < instrument.range.low) key += 12;
        }
        if (key < instrument.range.low || key > instrument.range.high) {
          throw new GenerateError(
            `bar ${note.measureIndex + 1}: ${keyName(key)} (${keyName(note.soundingKey)} shifted by ${shift} octaves) is outside the range of ${instrument.name} (${keyName(instrument.range.low)}-${keyName(instrument.range.high)})`,
          );
        }
        const groupKey = `${note.measureIndex}:${note.onsetInMeasure}:${note.durationTicks}`;
        const group = groups.get(groupKey) ?? {
          measure: note.measureIndex,
          onset: note.onsetInMeasure,
          duration: note.durationTicks,
          pitches: [],
        };
        if (!group.pitches.some((p) => p.key === key)) group.pitches.push({ step: note.step, key, tie: note.tie });
        groups.set(groupKey, group);
      }
    }
  }
  return [...groups.values()].sort((a, b) => a.measure - b.measure || a.onset - b.onset || a.duration - b.duration);
}

/** One bar of an Orchestra part: the doubled groups in as many voices as they need, every voice completed with rests. */
function measureEvents(groups: readonly Doubled[], length: number, ppq: number): WriteEvent[] {
  if (groups.length === 0) {
    return [
      {
        kind: 'note',
        note: { rest: true, measureRest: true, duration: length, voice: '1', type: 'whole' },
      },
    ];
  }
  const voices: { end: number; events: WriteEvent[] }[] = [];
  const rest = (duration: number, voice: number): WriteEvent => ({
    kind: 'note',
    note: { rest: true, duration, voice: String(voice), type: typeOf(duration, ppq) },
  });
  for (const group of groups) {
    let index = voices.findIndex((v) => v.end <= group.onset);
    if (index < 0) {
      voices.push({ end: 0, events: [] });
      index = voices.length - 1;
    }
    const voice = voices[index] as { end: number; events: WriteEvent[] };
    if (group.onset > voice.end) voice.events.push(rest(group.onset - voice.end, index + 1));
    group.pitches.forEach((pitch, i) => {
      const note: WriteNote = {
        pitch: spell(pitch.step, pitch.key),
        duration: group.duration,
        voice: String(index + 1),
        type: typeOf(group.duration, ppq),
        ...(i > 0 ? { chord: true } : {}),
        ...(pitch.tie.start || pitch.tie.stop ? { tie: { start: pitch.tie.start, stop: pitch.tie.stop } } : {}),
      };
      voice.events.push({ kind: 'note', note });
    });
    voice.end = group.onset + group.duration;
  }
  const events: WriteEvent[] = [];
  voices.forEach((voice, i) => {
    if (i > 0) events.push({ kind: 'backup', duration: length });
    events.push(...voice.events);
    if (voice.end < length) events.push(rest(length - voice.end, i + 1));
  });
  return events;
}

function orchestraPart(
  score: Score,
  piano: readonly Note[],
  instrument: OrchestraInstrument,
  passages: readonly Passage[],
): string {
  const doubled = passages.flatMap((p) => doubledNotes(piano, instrument, p, score.ppq));
  const measures: WriteMeasure[] = score.measures.map((m, i) => {
    const events: WriteEvent[] = [];
    const starting = passages.find((p) => p.bars.from - 1 === i);
    if (starting) events.push({ kind: 'direction', soundDynamics: starting.dynamics ?? instrument.dynamics });
    events.push(
      ...measureEvents(
        doubled.filter((g) => g.measure === i),
        m.lengthTicks,
        score.ppq,
      ),
    );
    const measure: WriteMeasure = { number: m.label, events };
    if (i === 0) {
      measure.attributes = {
        divisions: score.ppq,
        key: { fifths: 0 },
        ...(m.time ? { time: { beats: m.time.beats, beatType: m.time.beatType } } : {}),
        clefs: [{ number: 1, sign: 'G', line: 2 }],
        staffDetails: [{ printObject: false, printSpacing: false }], // no `number`: staff 1
      };
    } else if (m.time) {
      measure.attributes = { time: { beats: m.time.beats, beatType: m.time.beatType } };
    }
    return measure;
  });
  return writePartXml({ id: instrument.id, name: instrument.name, measures });
}

/** The text without any Orchestra part (their `<score-part>` and `<part>` ranges cut out, nothing else touched). */
export function withoutOrchestra(xml: string): string {
  const { doc } = readXml(xml);
  const { score } = buildScore(doc);
  const removals = orchestraRemovals(doc, score);
  let text = xml;
  for (const { start, end } of [...removals].reverse()) text = text.slice(0, start) + text.slice(end);
  return text;
}

export function generateOrchestra(xml: string, definition: OrchestrationDefinition): { xml: string; notes: number } {
  const base = withoutOrchestra(xml);
  const { score } = buildScore(readXml(base).doc);
  const piano = score.parts.find((p) => !p.orchestra);
  if (!piano) throw new GenerateError('the item has no printed part to double');
  for (const passage of definition.passages) {
    if (passage.bars.to > score.measures.length) {
      throw new GenerateError(
        `bars ${passage.bars.from}-${passage.bars.to} of "${passage.instrument}" are outside the piece (it has ${score.measures.length} bars)`,
      );
    }
  }
  const scoreParts: string[] = [];
  const parts: string[] = [];
  let notes = 0;
  for (const instrument of definition.instruments) {
    const own = definition.passages.filter((p) => p.instrument === instrument.id);
    notes += own.reduce((sum, p) => sum + doubledNotes(piano.notes, instrument, p, score.ppq).length, 0);
    scoreParts.push(writeScorePartXml({ id: instrument.id, name: instrument.name, program: instrument.program }));
    parts.push(orchestraPart(score, piano.notes, instrument, own));
  }
  const listEnd = base.lastIndexOf('</part-list>');
  const scoreEnd = base.lastIndexOf('</score-partwise>');
  if (listEnd < 0 || scoreEnd < 0) throw new GenerateError('the item is not a score-partwise file with a part-list');
  // No white space is added, so cutting the Orchestra parts out again gives back exactly `base`
  return {
    xml:
      base.slice(0, listEnd) +
      scoreParts.join('') +
      base.slice(listEnd, scoreEnd) +
      parts.join('') +
      base.slice(scoreEnd),
    notes,
  };
}
