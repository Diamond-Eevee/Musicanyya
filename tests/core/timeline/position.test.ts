import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { notesAtTick, passAtTick } from '../../../src/core/timeline/position.js';
import {
  GOLDEN_FIXTURES,
  type GoldenSample,
  listenNotesAtTick,
  loadListenTimeline,
  referencePassIndex,
  sampleTimeline,
} from './listen-cursor-reference.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface Golden {
  files: Record<string, { ppq: number; endTick: number; passes: number; samples: GoldenSample[] }>;
}
const golden = JSON.parse(
  fs.readFileSync(path.join(__dirname, '__snapshots__/listen-cursor.golden.json'), 'utf8'),
) as Golden;

describe('the Listen cursor position logic, moved out of the score view (009 contract section 1, FR-001)', () => {
  it.each(GOLDEN_FIXTURES)('the reference implementation still reproduces the golden for %s', async (name) => {
    const timeline = await loadListenTimeline(name);
    const expected = golden.files[name];
    expect(expected).toBeDefined();
    expect(sampleTimeline(timeline, listenNotesAtTick, referencePassIndex)).toEqual(expected?.samples);
  });

  it.each(GOLDEN_FIXTURES)(
    'notesAtTick and passAtTick reproduce the golden exactly for %s (note IDs and pass at every quarter of a beat)',
    async (name) => {
      const timeline = await loadListenTimeline(name);
      const passIndexAt = (t: typeof timeline, tick: number) => {
        const pass = passAtTick(t, tick);
        return pass === null ? -1 : t.passes.indexOf(pass);
      };
      expect(sampleTimeline(timeline, notesAtTick, passIndexAt)).toEqual(golden.files[name]?.samples);
    },
  );

  it('covers a repeat: the same measure is two different passes', async () => {
    const timeline = await loadListenTimeline('grade/grade-marks.musicxml');
    const first = passAtTick(timeline, 0);
    const second = passAtTick(timeline, 4 * timeline.ppq);
    expect(first?.measureIndex).toBe(0);
    expect(second?.measureIndex).toBe(0);
    expect(second).not.toBe(first);
  });

  it('a tick past the end belongs to the last pass, and highlights nothing', async () => {
    const timeline = await loadListenTimeline('grade/grade-marks.musicxml');
    const last = timeline.passes[timeline.passes.length - 1];
    expect(passAtTick(timeline, timeline.endTick + 5000)).toBe(last);
    expect(notesAtTick(timeline, timeline.endTick + 5000).size).toBe(0);
  });

  it('a note is due from its start tick up to, not including, its end tick', async () => {
    const timeline = await loadListenTimeline('chords/c-major-scale-and-chords.musicxml');
    const span = timeline.spans[0];
    expect(span).toBeDefined();
    if (!span) return;
    expect(notesAtTick(timeline, span.startTick).has(span.noteId)).toBe(true);
    expect(notesAtTick(timeline, span.endTick - 1).has(span.noteId)).toBe(true);
    expect(notesAtTick(timeline, span.endTick).has(span.noteId)).toBe(false);
  });

  it('a timeline without passes has no pass (null) and no notes', () => {
    const empty = { ppq: 960, endTick: 0, passes: [], spans: [] };
    expect(passAtTick(empty, 0)).toBeNull();
    expect(passAtTick(empty, 12345)).toBeNull();
    expect(notesAtTick(empty, 0).size).toBe(0);
  });
});
