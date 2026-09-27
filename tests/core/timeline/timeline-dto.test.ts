import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildScore } from '../../../src/core/musicxml/build.js';
import { readXml } from '../../../src/core/musicxml/read.js';
import { buildTempoDisplayMap } from '../../../src/core/tempo/tempo-display.js';
import { buildTimelineDto } from '../../../src/core/timeline/dto.js';
import { buildTimeline } from '../../../src/core/timeline/timeline.js';
import { unroll } from '../../../src/core/timeline/unroll.js';
import { decodeXml } from '../../../src/engine/files/decode.js';

// contracts/worker-messages.md 1.3.0: TimelineDto gains `tempo` (feature 012)

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '../../fixtures/musicxml');

function load(name: string) {
  const bytes = fs.readFileSync(path.join(fixturesDir, name));
  const { doc } = readXml(decodeXml(bytes));
  const { score } = buildScore(doc);
  const { timeline } = buildTimeline(score);
  return { score, timeline };
}

describe('buildTimelineDto', () => {
  it('returns the same passes and spans as the current inline construction, on scale-c-major-q100', () => {
    const { score, timeline } = load('scale-c-major-q100.musicxml');
    const dto = buildTimelineDto(timeline, score);

    expect(dto.ppq).toBe(timeline.ppq);
    expect(dto.endTick).toBe(timeline.endTick);
    expect(dto.passes).toEqual(
      timeline.passes.map((p) => ({
        measureIndex: p.measureIndex,
        startTick: p.startTick,
        endTick: p.startTick + p.lengthTicks,
      })),
    );
    expect(dto.spans).toEqual(
      timeline.spans.map((s) => ({ noteId: s.noteId, startTick: s.startTick, endTick: s.endTick })),
    );
  });

  it('tempo equals buildTempoDisplayMap on the same Score and timeline', () => {
    const { score, timeline } = load('scale-c-major-q100.musicxml');
    const dto = buildTimelineDto(timeline, score);

    const { passes } = unroll(score.measures, score.navigation);
    const expected = buildTempoDisplayMap(score.tempoMarks, passes, score.measures, timeline.leadInTicks);
    expect(dto.tempo).toEqual(expected);
  });

  it('also holds on a Score with a tempo change (tempo-change-90-60)', () => {
    const { score, timeline } = load('tempo-change-90-60.musicxml');
    const dto = buildTimelineDto(timeline, score);
    expect(dto.tempo.length).toBeGreaterThan(1);
    expect(dto.tempo[0]?.startTick).toBe(0);
  });
});
