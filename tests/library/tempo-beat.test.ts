// research R-10 (feature 012, FR-021): the library index's `tempoBpm` keeps meaning "quarter notes per minute of
// the first mark" - unchanged by this feature. `tempoBpm` is the qpm the display segment implies
// (`writtenBpm x beat.quartersNum/Den`), in whatever beat that segment uses. Before T048's review, three real
// pieces (cut-time or 3/8 with only a `<sound tempo>` and no printed metronome mark) fell back to the meter's own
// counting beat (half, eighth) instead of quarters; T048 refined R-4 so a Score with no metronome mark anywhere yet
// counts quarter notes, and every library item is quarter-based again (below).

import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { LibraryIndex } from '../../src/core/library/types.js';
import { buildScore } from '../../src/core/musicxml/build.js';
import { readXml } from '../../src/core/musicxml/read.js';
import { buildTempoDisplayMap, writtenBpm } from '../../src/core/tempo/tempo-display.js';
import { buildTimeline } from '../../src/core/timeline/timeline.js';
import { unroll } from '../../src/core/timeline/unroll.js';
import { decodeXml } from '../../src/engine/files/decode.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const libraryRoot = path.join(root, 'public/library');
const index = JSON.parse(readFileSync(path.join(libraryRoot, 'index.json'), 'utf8')) as LibraryIndex;

describe('library tempoBpm counts quarter notes (research R-10)', () => {
  expect(index.items.length).toBeGreaterThan(0);

  for (const item of index.items) {
    it(`${item.id}: tempoBpm is the qpm of the display segment at tick 0`, () => {
      const bytes = readFileSync(path.join(libraryRoot, item.file));
      const { doc } = readXml(decodeXml(bytes));
      const { score } = buildScore(doc);
      const { timeline } = buildTimeline(score);
      const { passes } = unroll(score.measures, score.navigation);
      const map = buildTempoDisplayMap(score.tempoMarks, passes, score.measures, timeline.leadInTicks);
      const first = map[0];
      if (!first) throw new Error(`${item.id}: expected a display segment`);
      const impliedQpm = writtenBpm(first) * (first.beat.quartersNum / first.beat.quartersDen);
      expect(Math.round(impliedQpm), item.id).toBe(Math.round(item.facts.tempoBpm ?? Number.NaN));
    });
  }

  it('every item counts quarters (T048: no metronome mark yet falls back to quarters, not the meter)', () => {
    const nonQuarter: string[] = [];
    for (const item of index.items) {
      const bytes = readFileSync(path.join(libraryRoot, item.file));
      const { doc } = readXml(decodeXml(bytes));
      const { score } = buildScore(doc);
      const { timeline } = buildTimeline(score);
      const { passes } = unroll(score.measures, score.navigation);
      const map = buildTempoDisplayMap(score.tempoMarks, passes, score.measures, timeline.leadInTicks);
      const first = map[0];
      if (first && (first.beat.type !== 'quarter' || first.beat.dots !== 0)) nonQuarter.push(item.id);
    }
    expect(nonQuarter).toEqual([]);
  });
});
