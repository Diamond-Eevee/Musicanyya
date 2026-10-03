// Feature 022 US1 scenario 4 and Edge Cases (ties): in the two Basics tie lessons, Practice waits for the first note of
// each tied pair only - the tied continuation is held, never asked for again. Reads the generated library files.
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildScore } from '../../../src/core/musicxml/build.js';
import { readXml } from '../../../src/core/musicxml/read.js';
import { buildExpectedEvents } from '../../../src/core/practice/expected.js';
import type { HandSelection } from '../../../src/core/practice/types.js';
import { buildTimeline } from '../../../src/core/timeline/timeline.js';

const libraryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../public/library');
const BOTH: HandSelection = { preset: 'both', partIndex: 0, staves: [1, 2] };

describe.each(['basics/ties-in-a-bar', 'basics/ties-across-the-bar-line'])('%s in Practice', (id) => {
  const { score } = buildScore(readXml(readFileSync(path.join(libraryRoot, `${id}.musicxml`), 'utf8')).doc);
  const { timeline } = buildTimeline(score);
  const notes = score.parts.flatMap((p) => p.notes).filter((n) => n.printed);
  const events = buildExpectedEvents(score, timeline, BOTH);

  it('has tied pairs', () => {
    expect(notes.filter((n) => n.tie.start).length).toBeGreaterThan(0);
  });

  it('waits at the start of every tie chain, and never where a tied continuation starts', () => {
    const startOf = new Map(timeline.spans.map((span) => [span.noteId, span.startTick]));
    const heads = notes.filter((n) => !n.tie.stop);
    const continuations = notes.filter((n) => n.tie.stop);
    const waits = events.map((e) => e.onsetTick);
    expect(waits).toEqual(heads.map((n) => startOf.get(n.id)));
    for (const c of continuations) expect(waits, c.id).not.toContain(startOf.get(c.id));
    // each wait asks for the head note (its id first) and nothing else
    events.forEach((e, i) => {
      expect(e.required.map((r) => r.noteIds[0])).toEqual([heads[i]?.id]);
    });
  });
});
