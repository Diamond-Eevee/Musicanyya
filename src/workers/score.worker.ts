import { buildScore } from '../core/musicxml/build.js';
import { readXml } from '../core/musicxml/read.js';
import { createRenderCopy } from '../core/musicxml/render-copy.js';
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

    const renderXml = createRenderCopy(xmlString, {
      notes: notesInserts,
      measures: measuresInserts,
    });

    const summary = {
      title: score.title,
      composer: score.composer,
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

    postMessageFn({
      type: 'loaded',
      requestId,
      score: summary,
      report,
      renderXml,
      timeline: { ppq: 1, endTick: 0, passes: [], spans: [] },
      schedule: [],
      contentHash,
    });
  } catch (error: any) {
    postMessageFn({
      type: 'failed',
      requestId,
      error: {
        code: error.code || 'internal',
        message: error.message,
        line: error.line,
        column: error.column,
        detail: error.detail,
      },
    });
  }
}

if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  self.addEventListener('message', (event) => {
    handleMessage(event, self.postMessage.bind(self));
  });
}
