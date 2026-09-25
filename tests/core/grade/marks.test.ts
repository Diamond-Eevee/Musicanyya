import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { gradePerformance } from '../../../src/core/grade/grade.js';
import { extraColumn, type GradeDiscColumn, type GradeMarkSet, gradeMarks } from '../../../src/core/grade/marks.js';
import type { Grade } from '../../../src/core/grade/types.js';
import { buildScore } from '../../../src/core/musicxml/build.js';
import { readXml } from '../../../src/core/musicxml/read.js';
import { placeKeys } from '../../../src/core/notation/place-discs.js';
import type { HandSelection } from '../../../src/core/practice/types.js';
import type { Score } from '../../../src/core/score/model.js';
import { decodeXml } from '../../../src/engine/files/decode.js';
import { buildPerformanceLog } from '../../fakes/performance-log.js';
import { loadFixture } from '../practice/helpers.js';
import { buildGradeInput } from './helpers.js';

// 009 T029 (data-model section 2, research R-08, FR-014 to FR-024): what a Grade draws on the Score, as a pure mark set.
// Every Grade below is produced by the real `gradePerformance` from a synthetic Performance log on the fixture
// `grade/grade-marks.musicxml` (4/4, 100 qpm, one quarter = 0.6 s): m1 twice (a repeat) with a chord B4 D5 G5 over G3,
// m2 with a tie D5 -> m3, m3 with a grace note, m4 under an 8va (sounding G6 A6 B6 D7), m5 with the right hand resting.
//
// How 003 grades a wrong key: a key of the right pitch class in the wrong octave claims the note as `wrongPitch`
// (an octave error); any other wrong key claims nothing, so its note is `missed` and the key is an `extra`.

const FIXTURE = 'grade/grade-marks.musicxml';
const BOTH: HandSelection = { preset: 'both', partIndex: 0, staves: [1, 2] };
const RIGHT: HandSelection = { preset: 'right', partIndex: 0, staves: [1] };
const { score, timeline } = loadFixture(FIXTURE);
const part = score.parts[0];

/** Every expected note played on its beat, right hand and left. Beats are quarters from the start of the timeline. */
// biome-ignore format: one line per measure
const PERFECT = [
  'G4@0', 'A4@1', 'B4@2', 'D5@2', 'G5@2', 'G3@0', // m1, first time
  'G4@4', 'A4@5', 'B4@6', 'D5@6', 'G5@6', 'G3@4', // m1, second time
  'B4@8', 'A4@9', 'D5@10', 'D3@8', 'G3@10', // m2 (the D5 is tied on into m3)
  'G4@14', 'G2@12', // m3 (a grace note before the G4)
  'G6@16', 'A6@17', 'B6@18', 'D7@19', 'C3@16', 'D3@18', // m4, under an 8va
  'G2@20', 'D3@22', // m5, the right hand rests
];

const LEFT_HAND = ['G3@', 'D3@', 'G2@', 'C3@'];

/** PERFECT without the entries starting with `remove`, plus `add`; `rightOnly` leaves the left hand out. */
function performance(options: { remove?: string[]; add?: string[]; rightOnly?: boolean } = {}): string[] {
  const remove = [...(options.remove ?? []), ...(options.rightOnly ? LEFT_HAND : [])];
  const kept = PERFECT.filter((entry) => !remove.some((r) => entry.startsWith(r)));
  return [...kept, ...(options.add ?? [])];
}

function gradeOf(list: readonly string[], selection: HandSelection = BOTH): Grade {
  const log = buildPerformanceLog(list, { qpm: 100 });
  return gradePerformance(buildGradeInput(FIXTURE, selection, log));
}

const marksOf = (grade: Grade, s: Score = score): GradeMarkSet => gradeMarks(s, grade, timeline.passes);

/** The Note ID of a written note: measure (0-based), onset in quarters, staff and sounding key. */
function noteId(measureIndex: number, onsetQuarters: number, staff: number, key: number): string {
  const note = part?.notes.find(
    (n) =>
      n.measureIndex === measureIndex &&
      n.onsetInMeasure === onsetQuarters * 960 &&
      n.staff === staff &&
      n.soundingKey === key &&
      !n.grace,
  );
  if (!note) throw new Error(`no note m${measureIndex} o${onsetQuarters} s${staff} k${key}`);
  return note.id;
}

/** A plain, comparable form of a mark set (Maps to arrays), for snapshots and determinism. */
function plain(marks: GradeMarkSet) {
  return {
    notes: [...marks.notes.values()].map((m) => ({ ...m })),
    discs: marks.discs.map((d) => ({
      key: d.key,
      at: d.column.at,
      state: d.placement.state,
      staff: d.placement.staff,
      position: d.placement.position,
      ledgerLines: d.placement.ledgerLines,
      ottava: d.placement.ottava,
      alter: d.placement.alter,
      showAccidental: d.placement.showAccidental,
      refs: d.refs,
    })),
    skipIcons: marks.skipIcons.map((i) => ({ at: i.column.at, staff: i.staff, noteIds: i.noteIds })),
    mistakes: marks.mistakes,
  };
}

/** The compact note name one semitone higher (sharps only): "G4" -> "G#4", "B4" -> "C5", "Bb4" -> "B4". */
function semitoneUp(entry: string): string {
  const match = /^([A-G])(b|#)?(\d+)@(.*)$/.exec(entry);
  if (!match) throw new Error(`Not a compact note: ${entry}`);
  const [, letter = 'C', accidental, octave = '4', when = '0'] = match;
  const order = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const flatToSharp: Record<string, string> = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };
  const name = accidental === 'b' ? (flatToSharp[`${letter}b`] ?? letter) : `${letter}${accidental ?? ''}`;
  const index = order.indexOf(name) + 1;
  return `${order[index % 12]}${Number(octave) + (index === 12 ? 1 : 0)}@${when}`;
}

describe('the fixture', () => {
  it('opens without notices, with the repeat, the chord, the tie, the grace note and the 8va it is built around', () => {
    const bytes = fs.readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures/musicxml', FIXTURE),
    );
    const { score: built, report } = buildScore(readXml(decodeXml(bytes)).doc);
    expect(report.entries).toEqual([]);
    expect(timeline.passes.map((p) => p.measureIndex)).toEqual([0, 0, 1, 2, 3, 4]); // m1 is played twice
    const notes = built.parts[0]?.notes ?? [];
    expect(notes.some((n) => n.grace)).toBe(true);
    expect(notes.some((n) => n.tie.start) && notes.some((n) => n.tie.stop)).toBe(true);
    expect(built.parts[0]?.octaveShifts.length).toBe(1);
  });
});

describe('gradeMarks: the rules, row by row (data-model section 2)', () => {
  it('a performance with every note correct marks every notehead correct and draws nothing else', () => {
    const grade = gradeOf(performance());
    expect(grade.summary.counts.correct).toBe(grade.results.length);
    const marks = marksOf(grade);
    expect([...marks.notes.values()].every((m) => m.head === 'correct' && m.timing.length === 0)).toBe(true);
    expect(marks.discs).toEqual([]);
    expect(marks.skipIcons).toEqual([]);
    expect(marks.mistakes).toEqual([]);
  });

  it('a missed note: a grey head, one skip icon at its column and staff, no disc, one mistake', () => {
    const marks = marksOf(gradeOf(performance({ remove: ['B4@8'] })));
    const b4 = noteId(1, 0, 1, 71);
    expect(marks.notes.get(b4)).toMatchObject({ head: 'missed', timing: [] });
    expect(marks.skipIcons).toHaveLength(1);
    expect(marks.skipIcons[0]).toMatchObject({
      staff: 1,
      noteIds: [b4],
      column: { at: { measureIndex: 1, onsetInMeasure: 0 } },
    });
    expect(marks.discs).toEqual([]);
    expect(marks.mistakes).toEqual([{ kind: 'note', noteId: b4 }]);
  });

  it("a wrong pitch (an octave error): the head is grey with the icon, and a disc at the key played in that note's column and staff", () => {
    const grade = gradeOf(performance({ remove: ['A4@9'], add: ['A5@9'] }));
    expect(grade.summary.counts.wrongPitch).toBe(1);
    const marks = marksOf(grade);
    const a4 = noteId(1, 1, 1, 69);
    expect(marks.notes.get(a4)?.head).toBe('missed');
    expect(marks.skipIcons.map((i) => i.noteIds)).toEqual([[a4]]);
    expect(marks.discs).toHaveLength(1);
    expect(marks.discs[0]).toMatchObject({ key: 81, refs: [{ kind: 'note', noteId: a4 }] });
    expect(marks.discs[0]?.column.at).toEqual({ measureIndex: 1, onsetInMeasure: 960 });
    expect(marks.discs[0]?.placement).toMatchObject({ staff: 1, key: 81, state: 'wrongOctave' });
    expect(marks.mistakes).toEqual([{ kind: 'note', noteId: a4 }]);
  });

  it('any other wrong note is a missed note and an extra key: the grey head with its icon, a red disc in the same column', () => {
    const grade = gradeOf(performance({ remove: ['A4@9'], add: ['Bb4@9'] }));
    expect(grade.summary.counts).toMatchObject({ missed: 1, extra: 1, wrongPitch: 0 });
    const marks = marksOf(grade);
    const a4 = noteId(1, 1, 1, 69);
    expect(marks.notes.get(a4)?.head).toBe('missed');
    expect(marks.skipIcons.map((i) => i.noteIds)).toEqual([[a4]]);
    expect(marks.discs).toHaveLength(1);
    expect(marks.discs[0]).toMatchObject({ key: 70, refs: [{ kind: 'extra', index: 0 }] });
    expect(marks.discs[0]?.column.at).toEqual({ measureIndex: 1, onsetInMeasure: 960 }); // the moment the note was due
    expect(marks.discs[0]?.placement).toMatchObject({ staff: 1, key: 70, state: 'extra' });
    expect(marks.mistakes).toEqual([
      { kind: 'note', noteId: a4 },
      { kind: 'extra', index: 0 },
    ]);
  });

  it('an extra key: a disc at the written moment nearest to it, no head changes, one mistake', () => {
    const grade = gradeOf(performance({ add: ['C4@16.05'] })); // just after the m4 downbeat
    expect(grade.extras).toHaveLength(1);
    const marks = marksOf(grade);
    expect(marks.discs).toHaveLength(1);
    expect(marks.discs[0]).toMatchObject({ key: 60, refs: [{ kind: 'extra', index: 0 }] });
    expect(marks.discs[0]?.column.at).toEqual({ measureIndex: 3, onsetInMeasure: 0 });
    expect([...marks.notes.values()].every((m) => m.head === 'correct')).toBe(true);
    expect(marks.skipIcons).toEqual([]);
    expect(marks.mistakes).toEqual([{ kind: 'extra', index: 0 }]);
  });
});

describe('gradeMarks: repeats (FR-024)', () => {
  it('a note correct on the first pass and missed on the second is missed', () => {
    const marks = marksOf(gradeOf(performance({ remove: ['G4@4'] })));
    const g4 = noteId(0, 0, 1, 67);
    expect(marks.notes.get(g4)).toMatchObject({ head: 'missed' });
    expect(marks.notes.get(g4)?.results).toHaveLength(2); // both passes explain it
    expect(marks.skipIcons.map((i) => i.noteIds)).toEqual([[g4]]);
    expect(marks.mistakes).toEqual([{ kind: 'note', noteId: g4 }]);
  });

  it('the same wrong key on both passes is one disc; two different wrong keys are two discs', () => {
    const a4 = noteId(0, 1, 1, 69);
    const same = marksOf(gradeOf(performance({ remove: ['A4@1', 'A4@5'], add: ['A5@1', 'A5@5'] })));
    expect(same.discs).toHaveLength(1);
    expect(same.discs[0]).toMatchObject({ key: 81, refs: [{ kind: 'note', noteId: a4 }] });
    expect(same.notes.get(a4)?.results).toHaveLength(2); // the two passes it stands for

    const different = marksOf(gradeOf(performance({ remove: ['A4@1', 'A4@5'], add: ['A5@1', 'A3@5'] })));
    expect(different.discs.map((d) => d.key)).toEqual([57, 81]); // one column, so by key
  });

  it('shows every timing error of any pass: late and early both, and an on-time pass never hides one', () => {
    const a4 = noteId(0, 1, 1, 69); // a single note: a chord member's on-time window is wider
    const both = marksOf(gradeOf(performance({ remove: ['A4@1', 'A4@5'], add: ['A4@1+150', 'A4@5-150'] })));
    expect(both.notes.get(a4)?.timing).toEqual(['late', 'early']);
    const hidden = marksOf(gradeOf(performance({ remove: ['A4@1'], add: ['A4@1+150'] }))); // the second pass is on time
    expect(hidden.notes.get(a4)?.timing).toEqual(['late']);
    expect(hidden.notes.get(a4)?.head).toBe('correct'); // late is a timing result, not a pitch one
  });
});

describe('gradeMarks: tie chains, chords and the skip icon (FR-016, FR-018)', () => {
  const d5 = noteId(1, 2, 1, 74); // the tied half note of m2
  const d5Tied = part?.notes.find((n) => n.measureIndex === 2 && n.tie.stop && n.soundingKey === 74)?.id ?? '';

  it('a tie chain takes one class on every notehead and its timing on the first notehead only', () => {
    const marks = marksOf(gradeOf(performance({ remove: ['D5@10'], add: ['D5@10+250'] })));
    expect(d5Tied).not.toBe('');
    expect(marks.notes.get(d5)).toMatchObject({ head: 'correct', timing: ['late'] });
    expect(marks.notes.get(d5Tied)).toMatchObject({ head: 'correct', timing: [] });
    expect(marks.notes.get(d5)?.results).toEqual(marks.notes.get(d5Tied)?.results);
  });

  it("a missed tie: both heads grey, the icon only at its first note's column", () => {
    const marks = marksOf(gradeOf(performance({ remove: ['D5@10'] })));
    expect(marks.notes.get(d5)?.head).toBe('missed');
    expect(marks.notes.get(d5Tied)?.head).toBe('missed');
    expect(marks.skipIcons.map((i) => [i.column.at.measureIndex, i.noteIds])).toEqual([[1, [d5]]]); // not m3
  });

  it('two missed notes of a chord on one staff share one icon, listing both; the other staff has its own', () => {
    const marks = marksOf(gradeOf(performance({ remove: ['B4@2', 'D5@2', 'B4@6', 'D5@6', 'G3@0', 'G3@4'] })));
    const b4 = noteId(0, 2, 1, 71);
    const d5c = noteId(0, 2, 1, 74);
    const g3 = noteId(0, 0, 2, 55);
    const chord = marks.skipIcons.find((i) => i.column.at.onsetInMeasure === 1920);
    expect(new Set(chord?.noteIds)).toEqual(new Set([b4, d5c]));
    expect(chord?.staff).toBe(1);
    expect(marks.skipIcons.find((i) => i.staff === 2)?.noteIds).toEqual([g3]);
    expect(marks.skipIcons).toHaveLength(2); // one per (column, staff), not one per note or per pass
  });
});

describe('extraColumn (research R-08)', () => {
  const column = (onsetTick: number): GradeDiscColumn => ({
    at: { measureIndex: 0, onsetInMeasure: onsetTick },
    onsetTick,
    noteIdsAtColumn: [],
  });
  const candidates = [column(100), column(200), column(300)];

  it('takes the nearest onset, the earlier one exactly between two, and the last after the last', () => {
    expect(extraColumn(candidates, 149)?.onsetTick).toBe(100);
    expect(extraColumn(candidates, 150)?.onsetTick).toBe(100); // exactly between: the earlier
    expect(extraColumn(candidates, 151)?.onsetTick).toBe(200);
    expect(extraColumn(candidates, -50)?.onsetTick).toBe(100);
    expect(extraColumn(candidates, 99999)?.onsetTick).toBe(300);
  });

  it('is null without candidates and does not depend on their order', () => {
    expect(extraColumn([], 5)).toBeNull();
    expect(extraColumn([column(300), column(100), column(200)], 150)?.onsetTick).toBe(100);
  });
});

describe('gradeMarks: where an extra key goes (FR-017)', () => {
  const at = (marks: GradeMarkSet) => marks.discs.map((d) => [d.column.at.measureIndex, d.column.at.onsetInMeasure]);

  it('exactly between two onsets, the earlier (it was played where the cursor stood)', () => {
    // m2 has onsets at quarter 0 (B4), 1 (A4) and 2 (D5): a key at beat 8 + 1.5 is exactly between the last two
    expect(at(marksOf(gradeOf(performance({ add: ['C4@9.5'] }))))).toEqual([[1, 960]]);
  });

  it("counts the unselected hand's onsets: a key near a left-hand-only onset goes to it", () => {
    // right hand only: m5 has no right-hand note, but the left hand's G2 at beat 20 is a written moment
    const grade = gradeOf(performance({ rightOnly: true, add: ['C4@19.9'] }), RIGHT);
    expect(grade.extras).toHaveLength(1);
    expect(at(marksOf(grade))).toEqual([[4, 0]]);
  });

  it('a grace note is not a column of its own', () => {
    const graceId = part?.notes.find((n) => n.grace)?.id ?? '';
    expect(graceId).not.toBe('');
    const marks = marksOf(gradeOf(performance({ add: ['C4@13.9'] })));
    expect(marks.discs).toHaveLength(1);
    expect(marks.discs[0]?.column.noteIdsAtColumn).not.toContain(graceId);
    expect(at(marks)).toEqual([[2, 1920]]); // the G4 after the grace note
  });

  it("goes across the barline when the next measure's onset is nearer", () => {
    expect(at(marksOf(gradeOf(performance({ add: ['C4@11.8'] }))))).toEqual([[2, 0]]); // m2 ends at beat 12: m3's downbeat
  });

  it('after the last onset it goes to the last onset; in a whole-measure rest to the nearest note onset', () => {
    expect(at(marksOf(gradeOf(performance({ add: ['C4@25'] }))))).toEqual([[4, 1920]]); // after D3 of m5
    // m5's right hand rests for the whole measure; a key at beat 21 is between G2 (20) and D3 (22): the earlier
    expect(at(marksOf(gradeOf(performance({ add: ['C4@21'] }))))).toEqual([[4, 0]]);
  });
});

describe('gradeMarks: staves and octave lines (FR-017a, 008)', () => {
  it("a wrong key equal to the left hand's written note goes on the graded (right-hand) note's staff", () => {
    // right hand only: at beat 0 the left hand writes G3 (55) - ungraded; the right hand's G4 is answered with G4 an octave
    // low... which is G3, the key the left hand writes: 003 grades it as an octave error of the G4
    const grade = gradeOf(performance({ rightOnly: true, remove: ['G4@0'], add: ['G3@0'] }), RIGHT);
    const g4 = noteId(0, 0, 1, 67);
    expect(grade.results.find((r) => r.noteIds.includes(g4))?.pitch).toBe('wrongPitch');
    const marks = marksOf(grade);
    const disc = marks.discs.find((d) => d.key === 55);
    expect(disc?.placement.staff).toBe(1); // not staff 2, where G3 is written
    expect(disc?.refs).toEqual([{ kind: 'note', noteId: g4 }]);
  });

  it('a wrong octave under the 8va is placed as Practice places it (folded and labelled where 008 folds it)', () => {
    const g6 = noteId(3, 0, 1, 91);
    const grade = gradeOf(performance({ remove: ['G6@16'], add: ['G5@16'] })); // an octave low: 79 for 91
    expect(grade.results.find((r) => r.noteIds.includes(g6))?.pitch).toBe('wrongPitch');
    const marks = marksOf(grade);
    const disc = marks.discs.find((d) => d.key === 79);
    expect(disc?.placement.state).toBe('wrongOctave');
    const notesAtColumn = (part?.notes ?? [])
      .filter((n) => n.measureIndex === 3 && n.onsetInMeasure === 0)
      .map((n) => ({ key: n.soundingKey, staff: n.staff }));
    const expected = placeKeys({
      score,
      selection: BOTH,
      at: { measureIndex: 3, onsetInMeasure: 0 },
      notesAtColumn,
      keys: new Map([[79, 'wrongOctave' as const]]),
      preferredStaff: new Map([[79, 1]]),
      previous: [],
    });
    expect(disc?.placement).toEqual(expected[0]);
  });
});

describe('gradeMarks: invariants', () => {
  const scenarios: [string, string[], HandSelection][] = [
    ['all correct', performance(), BOTH],
    ['nothing played', [], BOTH],
    ['every key a semitone high', PERFECT.map(semitoneUp), BOTH],
    ['mixed', performance({ remove: ['A4@1', 'B4@6', 'D5@10'], add: ['A5@1', 'C4@9.5', 'F#5@19.3', 'C3@5.2'] }), BOTH],
    [
      'right hand only, mixed',
      performance({ rightOnly: true, remove: ['G4@4', 'A6@17'], add: ['G3@4', 'C4@21'] }),
      RIGHT,
    ],
  ];

  it.each(scenarios)(
    "%s: every graded NoteId once, no duplicate disc or icon, no disc on a green head's key, stepper complete",
    (_name, list, selection) => {
      const grade = gradeOf(list, selection);
      const marks = marksOf(grade);

      const ids = grade.results.flatMap((r) => r.noteIds);
      expect(new Set(ids).size).toBe(marks.notes.size); // every NoteId of every graded result, exactly once
      for (const id of ids) expect(marks.notes.has(id)).toBe(true);

      const seen = new Set<string>();
      for (const disc of marks.discs) {
        const id = `${disc.column.at.measureIndex}:${disc.column.at.onsetInMeasure}:${disc.key}`;
        expect(seen.has(id), `duplicate disc ${id}`).toBe(false);
        seen.add(id);
        for (const noteIdAtColumn of disc.column.noteIdsAtColumn) {
          const note = part?.notes.find((n) => n.id === noteIdAtColumn);
          if (marks.notes.get(noteIdAtColumn)?.head === 'correct') expect(note?.soundingKey).not.toBe(disc.key);
        }
        expect(disc.refs.length).toBeGreaterThan(0);
        expect(disc.refs.every((r) => r.kind !== 'disc')).toBe(true);
      }

      const icons = new Set<string>();
      for (const icon of marks.skipIcons) {
        const id = `${icon.column.at.measureIndex}:${icon.column.at.onsetInMeasure}:${icon.staff}`;
        expect(icons.has(id), `duplicate icon ${id}`).toBe(false);
        icons.add(id);
        expect(icon.noteIds.length).toBeGreaterThan(0);
        for (const noteIdOfIcon of icon.noteIds) expect(marks.notes.get(noteIdOfIcon)?.head).toBe('missed');
      }
      // every missed first head is in exactly one icon
      const inIcons = marks.skipIcons.flatMap((i) => i.noteIds);
      expect(new Set(inIcons).size).toBe(inIcons.length);

      // the stepper visits every wrong pitch and missed note once and every extra
      const notCorrect = new Set(grade.results.filter((r) => r.pitch !== 'correct').map((r) => r.noteIds[0]));
      expect(marks.mistakes.filter((m) => m.kind === 'note')).toHaveLength(notCorrect.size);
      expect(marks.mistakes.filter((m) => m.kind === 'extra')).toHaveLength(grade.extras.length);
    },
  );

  it('a key no staff can show has no disc but keeps its mistake entry', () => {
    const tab: Score = {
      ...score,
      parts: score.parts.map((p, i) =>
        i === 0 ? { ...p, clefs: p.clefs.map((c) => ({ ...c, sign: 'TAB' as const })) } : p,
      ),
    };
    const grade = gradeOf(performance({ add: ['C4@9.5'] }));
    expect(grade.extras).toHaveLength(1);
    const marks = marksOf(grade, tab);
    expect(marks.discs).toEqual([]);
    expect(marks.mistakes).toEqual([{ kind: 'extra', index: 0 }]);
  });

  it("an extra equal to a correct head's key in its column is not drawn: it would hide the green head", () => {
    // a second strike of A4 (69) right after A4 was played correctly: the extra's nearest column is A4's own
    const grade = gradeOf(performance({ add: ['A4@9.1'] }));
    expect(grade.extras.some((e) => e.key === 69)).toBe(true);
    const marks = marksOf(grade);
    expect(marks.discs).toEqual([]);
    expect(marks.mistakes).toContainEqual({ kind: 'extra', index: 0 });
  });

  it('the mistakes are in playing order: by pass, then tick, a note before an extra at the same tick', () => {
    const grade = gradeOf(performance({ remove: ['A4@5', 'B4@8', 'C3@16'], add: ['A5@5', 'C4@9.5', 'C4@2.2'] }));
    const marks = marksOf(grade);
    const extraAt = (beat: number) => grade.extras.findIndex((e) => e.atTick === Math.round(beat * 960));
    // pass 1: the extra at beat 2.2; pass 2: the wrong A4; m2: the missed B4, then the extra at 9.5; m4: the missed C3
    expect(marks.mistakes).toEqual([
      { kind: 'extra', index: extraAt(2.2) },
      { kind: 'note', noteId: noteId(0, 1, 1, 69) },
      { kind: 'note', noteId: noteId(1, 0, 1, 71) },
      { kind: 'extra', index: extraAt(9.5) },
      { kind: 'note', noteId: noteId(3, 0, 2, 48) },
    ]);
  });

  it('is deterministic (FR-029): the same Score, Grade and passes give the same marks', () => {
    const grade = gradeOf(performance({ remove: ['A4@1', 'B4@6'], add: ['A5@1', 'C4@9.5'] }));
    expect(plain(marksOf(grade))).toEqual(plain(marksOf(grade)));
  });

  it('golden: the whole mark set of a Grade with every kind of result', () => {
    const grade = gradeOf(
      performance({
        remove: ['A4@5', 'A4@1', 'D5@10', 'B4@8', 'G6@16', 'C3@16', 'D3@22'],
        add: ['A4@5+150', 'A5@1', 'D5@10+250', 'G5@16', 'C4@9.5', 'C4@21', 'D3@22-150'],
      }),
    );
    expect(plain(marksOf(grade))).toMatchSnapshot();
  });
});

// 009 FR-022a: what the explanation of a wrong pitch needs to say more precisely than 003's default text - the written notes of
// its chord that were not played, and the octave line (8va / 8vb / 15ma / ...) in force at its note. The mark set carries it
// so the panel only words it (Constitution V: the UI decides no music).
describe('gradeMarks: the context of a wrong pitch (FR-022a)', () => {
  it('a wrong pitch inside a chord lists the written notes of the chord that were not played', () => {
    // the chord B4 D5 G5 (71 74 79): B4 played, D5 an octave up, G5 not played
    const grade = gradeOf(performance({ remove: ['D5@2', 'G5@2', 'D5@6', 'G5@6'], add: ['D6@2', 'D6@6'] }));
    const marks = marksOf(grade);
    const index = grade.results.findIndex((r) => r.pitch === 'wrongPitch' && r.reason.expectedKey === 74);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(marks.contexts.get(index)).toMatchObject({ chordNotPlayed: [74, 79] });
  });

  it('a wrong pitch that is not in a chord has an empty list', () => {
    const grade = gradeOf(performance({ remove: ['A4@9'], add: ['A5@9'] }));
    const index = grade.results.findIndex((r) => r.pitch === 'wrongPitch');
    expect(marksOf(grade).contexts.get(index)).toMatchObject({ chordNotPlayed: [] });
  });

  it('carries the octave shift in force at the note: +1 under the 8va of m4, 0 elsewhere', () => {
    const under = gradeOf(performance({ remove: ['G6@16'], add: ['G5@16'] }));
    const underIndex = under.results.findIndex((r) => r.pitch === 'wrongPitch');
    expect(marksOf(under).contexts.get(underIndex)).toMatchObject({ octaveShift: 1 });

    const plain = gradeOf(performance({ remove: ['A4@9'], add: ['A5@9'] }));
    const plainIndex = plain.results.findIndex((r) => r.pitch === 'wrongPitch');
    expect(marksOf(plain).contexts.get(plainIndex)).toMatchObject({ octaveShift: 0 });
  });

  it('has a context only for wrong pitches: a correct or a missed note needs no special wording', () => {
    const grade = gradeOf(performance({ remove: ['A4@9', 'B4@8'], add: ['A5@9'] }));
    const marks = marksOf(grade);
    const withContext = [...marks.contexts.keys()];
    expect(withContext).toEqual([grade.results.findIndex((r) => r.pitch === 'wrongPitch')]);
  });
});
