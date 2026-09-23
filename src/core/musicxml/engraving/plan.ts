import { type XmlDocument, XmlElement } from '@rgrove/parse-xml';
import { planAccidentalsForPart } from './accidentals.js';
import { planBeamsForVoice } from './beams.js';
import type { ElementInsert, EngravingFinding, EngravingMode, EngravingPlan } from './index.js';
import { type VoiceEvent, walkScore } from './walk.js';

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

function hasLyric(e: VoiceEvent): boolean {
  return e.noteRef.element.children.some((c) => c instanceof XmlElement && c.name === 'lyric');
}

/**
 * Plans MusicXML engraving completion: `<beam>` for every voice that encodes none (R-2), plus (from
 * US2 on) `<accidental>` wherever the printed pitch would otherwise read wrong (R-3). Never throws for
 * MusicXML `buildScore` accepts.
 */
export function planEngraving(doc: XmlDocument, mode: EngravingMode): EngravingPlan {
  const walked = walkScore(doc);

  const inserts: ElementInsert[] = [];
  const findings: EngravingFinding[] = [];
  const invalidBeams: EngravingPlan['invalidBeams'] = [];
  const contradictions: EngravingPlan['contradictions'] = [];
  let beamGroupsAdded = 0;
  let accidentalsRequired = 0;
  let accidentalsCourtesy = 0;

  for (const part of walked.parts) {
    const voices = Array.from(new Set(part.events.map((e) => e.voice))).sort();
    for (const voice of voices) {
      const voiceEvents = part.events.filter((e) => e.voice === voice);
      // B13: a sung line that encodes no beams at all is flagged per syllable on purpose (traditional vocal
      // notation) - leave it as encoded.
      if (!voiceEvents.some((e) => e.hasBeam) && voiceEvents.some(hasLyric)) continue;
      const result = planBeamsForVoice(voiceEvents, part.measures, walked.ppq, mode === 'library');

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

    const accidentalResult = planAccidentalsForPart(part, mode);

    accidentalsRequired += accidentalResult.requiredCount;
    accidentalsCourtesy += accidentalResult.courtesyCount;
    for (const entry of accidentalResult.entries) {
      const pitch = entry.event.pitches[entry.pitchIndex];
      if (!pitch) continue;
      const offset = entry.event.insertAt.accidental[entry.pitchIndex];
      if (offset === undefined) continue;
      inserts.push({ offset, text: `<accidental>${entry.sign}</accidental>`, order: 0 });
      findings.push({
        kind: entry.courtesy ? 'missingCourtesy' : 'missingAccidental',
        part: part.index,
        measureLabel: entry.event.measureLabel,
        staff: pitch.staff,
        voice: entry.event.voice,
        pitch: `${pitch.step}${pitch.octave}`,
      });
    }
    for (const c of accidentalResult.contradictions) {
      contradictions.push({ part: part.index, measureLabel: c.measureLabel, staff: c.staff, pitch: c.pitch });
    }
  }

  inserts.sort((a, b) => (a.offset !== b.offset ? a.offset - b.offset : a.order - b.order));

  return {
    inserts,
    beamGroupsAdded,
    accidentalsAdded: { required: accidentalsRequired, courtesy: accidentalsCourtesy },
    findings,
    invalidBeams,
    contradictions,
  };
}
