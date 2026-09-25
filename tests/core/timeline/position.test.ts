import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { cursorNotesAtTick, notesAtTick, passAtTick } from '../../../src/core/timeline/position.js';
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

// Owner review 2026-09-25 (spec FR-001, AS-1.9): the bar follows the note that started last, not a long note held under
// a moving part. The highlight is still every note sounding (`notesAtTick`); only where the bar stands changes.
describe('cursorNotesAtTick: the notes the cursor bar stands at (FR-001, owner review)', () => {
  // grade-marks.musicxml, measure 1: G4 A4 then the chord B4 D5 G5 in the right hand over a whole-note G3 in the left
  const ids = (set: ReadonlySet<string>) => [...set].sort();

  it('while the left hand holds its whole note, the bar is at the right hand note that started last', async () => {
    const timeline = await loadListenTimeline('grade/grade-marks.musicxml');
    const { ppq } = timeline;
    // beat 1: G4 and G3 start together, both are the current moment
    expect(ids(cursorNotesAtTick(timeline, 0))).toEqual(['n-p0-s1-m0-v1-o0-k67', 'n-p0-s2-m0-v2-o0-k55']);
    // beat 2: A4 only - the held G3 is still sounding (and highlighted) but it is not where the music is
    expect(notesAtTick(timeline, ppq).has('n-p0-s2-m0-v2-o0-k55')).toBe(true);
    expect(ids(cursorNotesAtTick(timeline, ppq))).toEqual(['n-p0-s1-m0-v1-o1-k69']);
    // beats 3 and 4: the chord, all three of its notes, and still not the G3
    const chord = ['n-p0-s1-m0-v1-o2-k71', 'n-p0-s1-m0-v1-o2-k74', 'n-p0-s1-m0-v1-o2-k79'];
    expect(ids(cursorNotesAtTick(timeline, 2 * ppq))).toEqual(chord);
    expect(ids(cursorNotesAtTick(timeline, 3 * ppq + ppq / 2))).toEqual(chord);
  });

  it.each(GOLDEN_FIXTURES)(
    'over %s, at every quarter of a beat: the sounding notes of the latest start, nothing else, never empty while one sounds',
    async (name) => {
      const timeline = await loadListenTimeline(name);
      const step = timeline.ppq / 4;
      let checked = 0;
      for (let tick = 0; tick <= timeline.endTick + timeline.ppq; tick += step) {
        const sounding = timeline.spans.filter((s) => s.startTick <= tick && s.endTick > tick);
        const latest = Math.max(...sounding.map((s) => s.startTick));
        const expected = sounding.filter((s) => s.startTick === latest).map((s) => s.noteId);
        const at = cursorNotesAtTick(timeline, tick);
        expect(ids(at), `tick ${tick}`).toEqual([...new Set(expected)].sort());
        if (sounding.length > 0) checked++;
      }
      expect(checked).toBeGreaterThan(0);
    },
  );

  // The files above with a note held while a newer one sounds (chords/c-major-scale-and-chords.musicxml has none: its
  // chords and scale notes always start together or alone): there, the held notes are never where the bar stands.
  it.each(GOLDEN_FIXTURES.filter((name) => name !== 'chords/c-major-scale-and-chords.musicxml'))(
    'over %s, a note held under a newer one is highlighted but never under the bar',
    async (name) => {
      const timeline = await loadListenTimeline(name);
      let heldUnderneath = 0;
      for (let tick = 0; tick <= timeline.endTick; tick += timeline.ppq / 4) {
        const sounding = timeline.spans.filter((s) => s.startTick <= tick && s.endTick > tick);
        const latest = Math.max(...sounding.map((s) => s.startTick));
        const held = sounding.filter((s) => s.startTick < latest);
        if (held.length === 0) continue;
        heldUnderneath++;
        const at = cursorNotesAtTick(timeline, tick);
        for (const s of held) {
          expect(notesAtTick(timeline, tick).has(s.noteId), `tick ${tick} ${s.noteId} lit`).toBe(true);
          // a note ID can recur on a later pass; it is held only if no span of it started at `latest`
          if (!sounding.some((o) => o.noteId === s.noteId && o.startTick === latest)) {
            expect(at.has(s.noteId), `tick ${tick} ${s.noteId} under the bar`).toBe(false);
          }
        }
      }
      expect(heldUnderneath).toBeGreaterThan(0);
    },
  );

  it("the owner's example (library learning/chords/c-major-scale-and-chords): the bar follows the scale over the held chords", async () => {
    // measure 1: C4 D4 E4 F4 in the right hand over a whole-note C3 E3 G3 chord; measure 2: G4 A4 ... over half-note chords
    const timeline = await loadListenTimeline(
      '../../../public/library/learning/chords/c-major-scale-and-chords.musicxml',
    );
    const { ppq } = timeline;
    const chord = ['n-p0-s2-m0-v5-o0-k48', 'n-p0-s2-m0-v5-o0-k52', 'n-p0-s2-m0-v5-o0-k55'];
    expect(ids(cursorNotesAtTick(timeline, 0))).toEqual(['n-p0-s1-m0-v1-o0-k60', ...chord].sort());
    for (const [beat, id] of [
      [1, 'n-p0-s1-m0-v1-o1-k62'],
      [2, 'n-p0-s1-m0-v1-o2-k64'],
      [3, 'n-p0-s1-m0-v1-o3-k65'],
      [5, 'n-p0-s1-m1-v1-o1-k69'],
    ] as const) {
      expect(ids(cursorNotesAtTick(timeline, beat * ppq)), `beat ${beat}`).toEqual([id]);
      expect(notesAtTick(timeline, beat * ppq).size, `beat ${beat}: the chord is still highlighted`).toBe(4);
    }
  });

  it('nothing sounding: no notes (the bar stands at the measure start); a timeline without spans: none either', async () => {
    const timeline = await loadListenTimeline('grade/grade-marks.musicxml');
    expect(cursorNotesAtTick(timeline, timeline.endTick + 5000).size).toBe(0);
    expect(cursorNotesAtTick({ spans: [] }, 0).size).toBe(0);
  });
});
