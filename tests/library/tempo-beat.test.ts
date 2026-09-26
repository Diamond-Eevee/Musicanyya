// research R-10 (feature 012, FR-021): the library index's `tempoBpm` keeps meaning "quarter notes per minute of
// the first mark" - unchanged by this feature. Most items' first mark counts quarters, so `tempoBpm` is also what
// the tempo field shows; a few real pieces (cut-time or 3/8 with only a `<sound tempo>` and no printed metronome
// mark) fall back to the meter's own counting beat (half, eighth) instead, so this pins the invariant that is
// actually true for every item - `tempoBpm` is the qpm the display segment implies, in whatever beat it uses -
// rather than assuming every item happens to be quarter-based (found while implementing 012, see the log; the
// three non-quarter items are a case for music-domain-expert's T048 review of the display semantics).

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

  it('every item counts quarters except the known cut-time/3-8 pieces with no printed metronome mark', () => {
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
    // T048 (music-domain-expert): confirm the fallback beat (meter, no printed mark) is the right display for these.
    expect(nonQuarter.sort()).toEqual(
      [
        'repertoire/advanced/chopin-prelude-op28-no4',
        'repertoire/advanced/clementi-sonatina-op36-no1-mvt1',
        'repertoire/advanced/fur-elise-complete',
      ].sort(),
    );
  });
});
