import type { XmlDocument } from '@rgrove/parse-xml';
import { planBeamsForVoice } from './beams.js';
import type { ElementInsert, EngravingFinding, EngravingMode, EngravingPlan } from './index.js';
import { walkScore } from './walk.js';

/**
 * Splices every insert into `xml` in a single pass (the same slice-and-join technique
 * `createRenderCopy` uses), so a large file with many inserts is linear rather than quadratic.
 * Inserts are applied in ascending `(offset, order)` - two inserts at the same offset keep the order
 * their caller gave them (contract: accidental order 0 before beam order 1).
 */
export function applyInserts(xml: string, inserts: readonly ElementInsert[]): string {
  if (inserts.length === 0) return xml;

  const sorted = [...inserts].sort((a, b) => (a.offset !== b.offset ? a.offset - b.offset : a.order - b.order));

  const pieces: string[] = [];
  let cursor = 0;
  for (const insert of sorted) {
    pieces.push(xml.slice(cursor, insert.offset), insert.text);
    cursor = insert.offset;
  }
  pieces.push(xml.slice(cursor));

  return pieces.join('');
}

/**
 * Plans MusicXML engraving completion: `<beam>` for every voice that encodes none (R-2), plus (from
 * US2 on) `<accidental>` wherever the printed pitch would otherwise read wrong (R-3). Never throws for
 * MusicXML `buildScore` accepts.
 */
export function planEngraving(doc: XmlDocument, _mode: EngravingMode): EngravingPlan {
  const walked = walkScore(doc);
  const inserts: ElementInsert[] = [];
  const findings: EngravingFinding[] = [];
  const invalidBeams: EngravingPlan['invalidBeams'] = [];
  let beamGroupsAdded = 0;

  for (const part of walked.parts) {
    const voices = Array.from(new Set(part.events.map((e) => e.voice))).sort();
    for (const voice of voices) {
      const voiceEvents = part.events.filter((e) => e.voice === voice);
      const result = planBeamsForVoice(voiceEvents, part.measures, walked.ppq);

      if (result.skipped) {
        for (const measureLabel of result.invalidMeasureLabels) {
          invalidBeams.push({ part: part.index, measureLabel, voice });
        }
        continue;
      }

      beamGroupsAdded += result.groupsAdded;
      for (const [event, beams] of result.assignments) {
        const text = beams.map((b) => `<beam number="${b.number}">${b.value}</beam>`).join('');
        inserts.push({ offset: event.insertAt.beam, text, order: 1 });
        if (beams.some((b) => b.number === 1 && b.value === 'begin')) {
          findings.push({
            kind: 'missingBeam',
            part: part.index,
            measureLabel: event.measureLabel,
            staff: event.staff,
            voice,
          });
        }
      }
    }
  }

  inserts.sort((a, b) => (a.offset !== b.offset ? a.offset - b.offset : a.order - b.order));

  return {
    inserts,
    beamGroupsAdded,
    accidentalsAdded: { required: 0, courtesy: 0 },
    findings,
    invalidBeams,
    contradictions: [],
  };
}
