import { Score } from '../../../src/core/score/model';
import { readXml } from '../../../src/core/musicxml/read';
import { buildScore } from '../../../src/core/musicxml/build';
import { ReferenceScore, ReferenceBar, ReferenceNote, ReferenceGraceNote } from './midi';
import { QuarterTime, q } from './time';
import { XmlElement } from '@rgrove/parse-xml';

export async function fromMusicXml(xmlText: string): Promise<ReferenceScore> {
  const parseResult = readXml(xmlText);
  const { score } = buildScore(parseResult.doc);

  const bars: ReferenceBar[] = [];
  
  // Navigation
  const repeatsStart = new Set<number>();
  const repeatsEnd = new Map<number, number>();
  for (const r of score.navigation.repeats) {
    if (r.direction === 'forward') repeatsStart.add(r.measureIndex);
    if (r.direction === 'backward') repeatsEnd.set(r.measureIndex, r.times || 2);
  }

  const endingsByMeasure = new Map<number, number[]>();
  let currentEndings: number[] = [];
  for (const mark of score.navigation.endings) {
    if (mark.type === 'start') {
      currentEndings = mark.numbers;
      endingsByMeasure.set(mark.measureIndex, [...currentEndings]);
    } else if (mark.type === 'stop') {
      // In musicxml, stop is usually at the end of the measure, so the measure had the ending.
      // But if it's start in the same measure, we already set it.
      if (!endingsByMeasure.has(mark.measureIndex)) {
        endingsByMeasure.set(mark.measureIndex, [...currentEndings]);
      }
      currentEndings = [];
    } else if (mark.type === 'discontinue') {
      if (!endingsByMeasure.has(mark.measureIndex)) {
        endingsByMeasure.set(mark.measureIndex, [...currentEndings]);
      }
      currentEndings = [];
    }
  }

  for (const m of score.measures) {
    let endings = endingsByMeasure.get(m.index);
    if (!endings && currentEndings.length > 0) {
      endings = [...currentEndings];
    }
    
    bars.push({
      index: m.index,
      number: m.label,
      start: q(m.startTick, score.ppq),
      length: q(m.lengthTicks, score.ppq),
      repeatStart: repeatsStart.has(m.index),
      repeatEnd: repeatsEnd.has(m.index),
      repeatTimes: repeatsEnd.get(m.index),
      endings: endings || []
    });
  }

  const notes: ReferenceNote[] = [];
  const graceNotes: ReferenceGraceNote[] = [];

  // Parse spelling directly from XML doc since Score doesn't store alter/octave
  // Also parse time-modification since buildScore ignores it
  const spellings = new Map<number, { step: string, alter: number, octave: number }>();
  const timeMods = new Map<number, { actual: number, normal: number }>();
  
  function traverse(node: any) {
    if (node instanceof XmlElement && node.name === 'note') {
      const offset = node.start;
      if (offset !== undefined) {
        const pitch = node.children.find((c: any) => c instanceof XmlElement && c.name === 'pitch') as XmlElement | undefined;
        if (pitch) {
          const stepEl = pitch.children.find((c: any) => c instanceof XmlElement && c.name === 'step') as XmlElement | undefined;
          const alterEl = pitch.children.find((c: any) => c instanceof XmlElement && c.name === 'alter') as XmlElement | undefined;
          const octaveEl = pitch.children.find((c: any) => c instanceof XmlElement && c.name === 'octave') as XmlElement | undefined;
          
          if (stepEl && octaveEl) {
            const step = stepEl.text.trim();
            const alter = alterEl ? parseInt(alterEl.text.trim(), 10) : 0;
            const octave = parseInt(octaveEl.text.trim(), 10);
            spellings.set(offset, { step, alter, octave });
          }
        }
        const tm = node.children.find((c: any) => c instanceof XmlElement && c.name === 'time-modification') as XmlElement | undefined;
        if (tm) {
          const actualEl = tm.children.find((c: any) => c instanceof XmlElement && c.name === 'actual-notes') as XmlElement | undefined;
          const normalEl = tm.children.find((c: any) => c instanceof XmlElement && c.name === 'normal-notes') as XmlElement | undefined;
          if (actualEl && normalEl) {
            timeMods.set(offset, {
              actual: parseInt(actualEl.text.trim(), 10),
              normal: parseInt(normalEl.text.trim(), 10)
            });
          }
        }
      }
    }
    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }
  traverse(parseResult.doc);

  // Group tied notes
  const activeTies = new Map<number, ReferenceNote>(); // soundingKey -> note

  for (const part of score.parts) {
    for (const n of part.notes) {
      if (n.unpitched) continue; // Fidelity check ignores unpitched? Or maybe compares? "non-grace note" in model.

      const spelling = spellings.get(n.source.start);
      let alter: any = 0;
      let octave = 4;
      let step = n.step as any;
      if (spelling) {
        alter = spelling.alter;
        octave = spelling.octave;
        step = spelling.step;
      }

      const timeMod = timeMods.get(n.source.start);
      let duration = q(n.durationTicks, score.ppq);
      if (timeMod && timeMod.actual > 0) {
        duration = q(duration.num * timeMod.normal, duration.den * timeMod.actual);
      }

      if (n.grace) {
        graceNotes.push({
          bar: n.measureIndex,
          before: q(n.onsetInMeasure + score.measures[n.measureIndex].startTick, score.ppq),
          midi: n.soundingKey,
          spelling: { step, alter, octave }
        });
        continue;
      }

      if (n.tie.stop) {
        const active = activeTies.get(n.soundingKey);
        if (active) {
          active.duration = q(
            active.duration.num * duration.den + active.duration.den * duration.num,
            active.duration.den * duration.den
          );
          if (!n.tie.start) {
            activeTies.delete(n.soundingKey);
          }
          continue;
        }
      }

      const refNote: ReferenceNote = {
        bar: n.measureIndex,
        onset: q(n.onsetInMeasure + score.measures[n.measureIndex].startTick, score.ppq),
        duration,
        midi: n.soundingKey,
        spelling: { step, alter, octave },
        staff: n.staff,
        voice: n.voice
      };

      if (n.tie.start) {
        activeTies.set(n.soundingKey, refNote);
      }
      
      notes.push(refNote);
    }
  }

  return {
    origin: 'musicxml',
    bars,
    notes,
    graceNotes
  };
}
