import { errorCode, errorMessage } from '../core/errors.js';
import { buildScore } from '../core/musicxml/build.js';
import { planEngraving } from '../core/musicxml/engraving/plan.js';
import { readXml } from '../core/musicxml/read.js';
import { createRenderCopy } from '../core/musicxml/render-copy.js';
import { compileSchedule } from '../core/schedule/compile.js';
import { buildTimeline } from '../core/timeline/timeline.js';
import { decodeXml } from '../engine/files/decode.js';
import { hashFile } from '../engine/files/hash.js';
import { readMxl } from '../engine/files/mxl.js';

export async function handleMessage(event: MessageEvent, postMessageFn: typeof postMessage) {
  const data = event.data;
  if (data.type !== 'load') return;

  const { requestId, fileName, bytes } = data;

  try {
    const contentHash = await hashFile(bytes);

    let fileBytes = new Uint8Array(bytes);
    if (fileName.toLowerCase().endsWith('.mxl')) {
      fileBytes = await readMxl(fileBytes);
    }

    const xmlString = decodeXml(fileBytes);
    const parsed = readXml(xmlString);
    const scoreAndReport = buildScore(parsed.doc);
    const score = scoreAndReport.score;
    const report = scoreAndReport.report;

    const notesInserts = [];
    for (const part of score.parts) {
      for (const note of part.notes) {
        if (note.source.start > 0) {
          const tagLength = xmlString.indexOf('>', note.source.start) - note.source.start + 1;
          notesInserts.push({ startOffset: note.source.start, tagLength, id: note.id });
        }
      }
    }

    const measuresInserts = [];
    for (let i = 0; i < score.measures.length; i++) {
      const startOffset = parsed.offsets.measures[i];
      const measure = score.measures[i];
      if (startOffset !== undefined && measure !== undefined) {
        const tagLength = xmlString.indexOf('>', startOffset) - startOffset + 1;
        measuresInserts.push({ startOffset, tagLength, id: measure.id });
      }
    }

    // Run engraving completion (FR-010, FR-011): beam voices that have no encoded beams and
    // add any missing accidentals. Never modifies what the file encodes.
    const engravingPlan = planEngraving(parsed.doc, 'opened');

    const renderXml = createRenderCopy(xmlString, {
      notes: notesInserts,
      measures: measuresInserts,
      elements: engravingPlan.inserts,
    });

    // Build the playback timeline and compile the engine schedule (T089)
    const { timeline, notices: timelineNotices } = buildTimeline(score);
    const scheduleMsg = compileSchedule(timeline);

    // Add engraving completion notices to the load report (FR-011).
    // engravingCompleted: one info entry summarising what was added (only when something changed).
    const totalBeamGroups = engravingPlan.beamGroupsAdded;
    const totalAccRequired = engravingPlan.accidentalsAdded.required;
    const totalAccCourtesy = engravingPlan.accidentalsAdded.courtesy;
    if (totalBeamGroups > 0 || totalAccRequired > 0 || totalAccCourtesy > 0) {
      const parts: string[] = [];
      if (totalBeamGroups > 0) parts.push(`${totalBeamGroups} beam group${totalBeamGroups !== 1 ? 's' : ''} added`);
      if (totalAccRequired > 0)
        parts.push(`${totalAccRequired} required accidental${totalAccRequired !== 1 ? 's' : ''} added`);
      if (totalAccCourtesy > 0)
        parts.push(`${totalAccCourtesy} courtesy accidental${totalAccCourtesy !== 1 ? 's' : ''} added`);
      report.entries.push({
        code: 'engravingCompleted',
        severity: 'info',
        measureLabels: [],
        detail: parts.join(', '),
      });
    }
    // beamDataInvalid: one warning per voice whose beam data is inconsistent.
    for (const inv of engravingPlan.invalidBeams) {
      report.entries.push({
        code: 'beamDataInvalid',
        severity: 'warning',
        measureLabels: [inv.measureLabel],
        detail: `part ${inv.part + 1}, voice ${inv.voice}`,
      });
    }
    // accidentalContradicts: one warning per note that prints a sign contradicting its pitch.
    for (const c of engravingPlan.contradictions) {
      report.entries.push({
        code: 'accidentalContradicts',
        severity: 'warning',
        measureLabels: [c.measureLabel],
        detail: `part ${c.part + 1}, staff ${c.staff}, ${c.pitch}`,
      });
    }

    // Add timeline notices to the load report
    for (const tn of timelineNotices) {
      const entry: { code: typeof tn.code; severity: 'warning'; measureLabels: string[]; detail?: string } = {
        code: tn.code,
        severity: 'warning',
        measureLabels: [],
      };
      if (tn.detail !== undefined) entry.detail = tn.detail;
      report.entries.push(entry);
    }

    // Build the TimelineDto (compact form for the main thread per contracts/worker-messages.md)
    const timelineDto = {
      ppq: timeline.ppq,
      endTick: timeline.endTick,
      passes: timeline.passes.map((p) => ({
        measureIndex: p.measureIndex,
        startTick: p.startTick,
        endTick: p.startTick + p.lengthTicks,
      })),
      spans: timeline.spans.map((s) => ({
        noteId: s.noteId,
        startTick: s.startTick,
        endTick: s.endTick,
      })),
    };

    const summary = {
      title: score.title,
      composer: score.composer,
      arranger: score.arranger,
      parts: score.parts.map((p) => {
        const instrument = p.instruments[0];
        return {
          id: p.xmlId,
          name: p.name,
          instrument: instrument?.name ?? '',
          program: instrument?.program ?? 0,
          percussion: instrument?.percussion ?? false,
        };
      }),
      measureCount: score.measures.length,
      measureIds: score.measures.map((m) => m.id),
      defaultTempoUsed: score.defaultTempoUsed,
    };

    // Transfer the schedule's typed array buffers to avoid copying
    const transfers: ArrayBuffer[] = [
      scheduleMsg.eventTick.buffer as ArrayBuffer,
      scheduleMsg.eventKind.buffer as ArrayBuffer,
      scheduleMsg.eventChannel.buffer as ArrayBuffer,
      scheduleMsg.eventData1.buffer as ArrayBuffer,
      scheduleMsg.eventData2.buffer as ArrayBuffer,
      scheduleMsg.tempoTick.buffer as ArrayBuffer,
      scheduleMsg.tempoQpmNum.buffer as ArrayBuffer,
      scheduleMsg.tempoQpmDen.buffer as ArrayBuffer,
      scheduleMsg.channelSetup.buffer as ArrayBuffer,
    ];

    postMessageFn(
      {
        type: 'loaded',
        requestId,
        summary,
        fullScore: score,
        fullTimeline: timeline,
        report,
        renderXml,
        timeline: timelineDto,
        schedule: scheduleMsg,
        contentHash,
      },
      transfers,
    );
  } catch (error) {
    // A MusicXmlLoadError carries a code (and sometimes a position) the notice tray knows how to
    // show; anything else is genuinely ours and falls back to `internal`.
    const located = error as { line?: number; column?: number; detail?: string };
    postMessageFn({
      type: 'failed',
      requestId,
      error: {
        code: errorCode(error) ?? 'internal',
        message: errorMessage(error),
        line: located.line,
        column: located.column,
        detail: located.detail,
      },
    });
  }
}

if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  self.addEventListener('message', (event) => {
    handleMessage(event, self.postMessage.bind(self));
  });
}
