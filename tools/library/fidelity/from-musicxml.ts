// Reads a library item through the app's own pipeline (readXml + buildScore + buildTimeline), so the check proves
// what the app actually shows and plays (data-model.md §2, research R6). The Score model keeps the pitch letter
// but not the alteration or octave, so the written spelling is read from the parse tree by the note's offset.
import { XmlElement, type XmlNode } from '@rgrove/parse-xml';
import { buildScore } from '../../../src/core/musicxml/build';
import { readXml } from '../../../src/core/musicxml/read';
import type { Score } from '../../../src/core/score/model';
import { buildTimeline } from '../../../src/core/timeline/timeline';
import {
  type Alter,
  compareGraceNotes,
  compareNotes,
  type ReferenceBar,
  type ReferenceGraceNote,
  type ReferenceNote,
  type ReferenceScore,
  type Spelling,
  type Step,
  validateReference,
} from './reference';
import { add, cmp, q } from './time';

export function fromMusicXml(xml: string): ReferenceScore {
  const { doc } = readXml(xml);
  const { score } = buildScore(doc);
  const spellings = readSpellings(doc.children);

  const notes: ReferenceNote[] = [];
  const graceNotes: ReferenceGraceNote[] = [];
  let staffBase = 0;
  for (const part of score.parts) {
    const openTies = new Map<number, ReferenceNote[]>(); // sounding key -> notes whose tie continues
    for (const n of part.notes) {
      if (n.unpitched) throw new Error(`fromMusicXml: unpitched note ${n.id} cannot be compared`);
      const measure = score.measures[n.measureIndex];
      if (!measure) throw new Error(`fromMusicXml: note ${n.id} names measure ${n.measureIndex}`);
      const spelling = spellings.get(n.source.start);
      if (!spelling) throw new Error(`fromMusicXml: no <pitch> found for note ${n.id}`);
      const onset = q(measure.startTick + n.onsetInMeasure, score.ppq);
      if (n.grace) {
        graceNotes.push({ bar: n.measureIndex, before: onset, midi: n.soundingKey, spelling });
        continue;
      }
      const duration = q(n.durationTicks, score.ppq);
      const pending = openTies.get(n.soundingKey) ?? [];
      const tiedFrom = n.tie.stop ? pending.find((p) => cmp(add(p.onset, p.duration), onset) === 0) : undefined;
      if (tiedFrom) {
        tiedFrom.duration = add(tiedFrom.duration, duration);
        if (!n.tie.start) pending.splice(pending.indexOf(tiedFrom), 1);
        continue;
      }
      const note: ReferenceNote = {
        bar: n.measureIndex,
        onset,
        duration,
        midi: n.soundingKey,
        spelling,
        staff: staffBase + n.staff,
        voice: n.voice,
      };
      notes.push(note);
      if (n.tie.start) openTies.set(n.soundingKey, [...pending, note]);
    }
    staffBase += part.staves;
  }
  notes.sort(compareNotes);
  graceNotes.sort(compareGraceNotes);

  return validateReference({
    origin: 'musicxml',
    bars: readBars(score),
    notes,
    graceNotes,
    playedOrder: buildTimeline(score).timeline.passes.map((p) => p.measureIndex),
  });
}

function readBars(score: Score): ReferenceBar[] {
  const { repeats, endings } = score.navigation;
  const endingNumbers = new Map<number, number[]>();
  const marks = [...endings].sort((a, b) => a.measureIndex - b.measureIndex);
  marks.forEach((mark, i) => {
    if (mark.type !== 'start') return;
    const close = marks.slice(i + 1).find((m) => m.type !== 'start') ?? mark;
    for (let m = mark.measureIndex; m <= Math.max(mark.measureIndex, close.measureIndex); m++)
      endingNumbers.set(m, [...mark.numbers]);
  });
  return score.measures.map((m) => {
    const end = repeats.find((r) => r.measureIndex === m.index && r.direction === 'backward');
    return {
      index: m.index,
      number: m.label,
      start: q(m.startTick, score.ppq),
      length: q(m.lengthTicks, score.ppq),
      repeatStart: repeats.some((r) => r.measureIndex === m.index && r.direction === 'forward'),
      repeatEnd: end !== undefined,
      ...(end?.times !== undefined && end.times !== 2 ? { repeatTimes: end.times } : {}),
      endings: endingNumbers.get(m.index) ?? [],
    };
  });
}

/** Written spelling of every pitched <note>, keyed by the element's offset (Note.source.start). */
function readSpellings(nodes: readonly XmlNode[], out = new Map<number, Spelling>()): Map<number, Spelling> {
  for (const node of nodes) {
    if (!(node instanceof XmlElement)) continue;
    if (node.name === 'note') {
      const pitch = child(node, 'pitch');
      if (pitch) {
        const step = text(child(pitch, 'step'));
        const alter = Number(text(child(pitch, 'alter')) || '0');
        const octave = Number(text(child(pitch, 'octave')));
        if (!/^[A-G]$/.test(step) || ![-2, -1, 0, 1, 2].includes(alter) || !Number.isInteger(octave))
          throw new Error(`fromMusicXml: unreadable <pitch> at offset ${node.start}`);
        out.set(node.start, { step: step as Step, alter: alter as Alter, octave });
      }
      continue;
    }
    readSpellings(node.children, out);
  }
  return out;
}

const child = (el: XmlElement, name: string): XmlElement | undefined =>
  el.children.find((c): c is XmlElement => c instanceof XmlElement && c.name === name);
const text = (el: XmlElement | undefined): string => el?.text.trim() ?? '';
