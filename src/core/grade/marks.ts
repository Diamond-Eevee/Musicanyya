import { octaveShiftAt } from '../notation/context.js';
import type { DiscPlacement } from '../notation/place-discs.js';
import { placeKeys } from '../notation/place-discs.js';
import type { WrongKeyState } from '../practice/types.js';
import type { Note, NoteId, Score, ScorePosition, Ticks } from '../score/model.js';
import type { MeasurePass } from '../timeline/types.js';
import type { Grade } from './types.js';

/**
 * What the Score shows for a Grade (009 data-model section 2, research R-06, R-08): green and grey noteheads, timing
 * carets, red discs at the pitch played and one skip icon per column of missed notes. Pure and deterministic (FR-029):
 * the same Score, Grade and passes always give the same marks; it never throws on any parsed Score.
 */

/** Something the musician can select or step to on the Score (009 data-model section 3). */
export type GradeMarkRef =
  | { kind: 'note'; noteId: NoteId } // a graded notehead, explained for every pass it was played
  | { kind: 'extra'; index: number } // grade.extras[index]
  | { kind: 'disc'; index: number }; // GradeMarkSet.discs[index], explained as everything it stands for

/** A notehead of a graded note is either unmarked-green (`correct` on every pass) or grey with the skip icon (`missed`). */
export type GradeHeadMark = 'correct' | 'missed';

export interface GradeNoteMark {
  noteId: NoteId;
  head: GradeHeadMark;
  /** The distinct timing errors over all passes, on the first notehead of a tie chain only; [] = on time (or not a first head). */
  timing: readonly ('early' | 'late')[];
  /** Indexes into `grade.results`, every pass, in playing order. */
  results: readonly number[];
}

/** A written moment of the graded part: where a disc or an icon is drawn. */
export interface GradeDiscColumn {
  at: ScorePosition;
  /** Its first timeline tick (in the pass it was first seen), for ordering. */
  onsetTick: Ticks;
  /** The graded part's noteheads written there, every staff, for the disc layout. */
  noteIdsAtColumn: readonly NoteId[];
}

export interface GradeDisc {
  /** The MIDI key actually played. */
  key: number;
  column: GradeDiscColumn;
  placement: DiscPlacement;
  /** What it stands for: the wrong-pitch note(s) and/or extra(s), never a `disc` ref. */
  refs: readonly GradeMarkRef[];
}

export interface GradeSkipIcon {
  column: GradeDiscColumn;
  /** 1-based staff of the graded part. */
  staff: number;
  /** The missed first noteheads of the column on that staff it stands for (at least one). */
  noteIds: readonly NoteId[];
}

/**
 * What the explanation of a wrong pitch needs beyond its reason (009 FR-022a), worked out here so the panel only words it:
 * the written notes of its chord that were not played, and the octave line in force at its note.
 */
export interface ResultContext {
  /** Keys of the chord's written notes whose result was not `correct`, ascending; [] when the note is not in a chord. */
  chordNotPlayed: readonly number[];
  /** Octaves the printed line lies below the sounding pitch at the note: +1 under an 8va, -1 under an 8vb, +-2 a 15ma / 15mb. */
  octaveShift: number;
}

export interface GradeMarkSet {
  notes: ReadonlyMap<NoteId, GradeNoteMark>;
  /** One per distinct (written moment, key); playing order, then key. */
  discs: readonly GradeDisc[];
  /** One per (written moment, staff) with a missed first notehead; playing order, then staff. */
  skipIcons: readonly GradeSkipIcon[];
  /** What the mistake stepper visits: wrong pitches and missed notes, then extras, by (pass, tick). */
  mistakes: readonly GradeMarkRef[];
  /** By index into `grade.results`, for the wrong-pitch results only. */
  contexts: ReadonlyMap<number, ResultContext>;
}

const momentKey = (measureIndex: number, onsetInMeasure: number) => `${measureIndex}:${onsetInMeasure}`;

/** A note that is written, sounds a pitch and is an attack of its own: the notes a Grade's columns are made of. */
const isPrintedPitched = (note: Note) => !note.grace && !note.unpitched && note.printed !== false;

/**
 * The column an extra key goes to (research R-08): the candidate whose onset is nearest `atTick`, the earlier one when it
 * lies exactly between two; null when there is no candidate. Integer ticks, so the choice is reproducible (FR-029).
 */
export function extraColumn(candidates: readonly GradeDiscColumn[], atTick: Ticks): GradeDiscColumn | null {
  let best: GradeDiscColumn | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const distance = Math.abs(candidate.onsetTick - atTick);
    if (
      distance < bestDistance ||
      (distance === bestDistance && best !== null && candidate.onsetTick < best.onsetTick)
    ) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

interface DiscDraft {
  key: number;
  column: GradeDiscColumn;
  state: WrongKeyState;
  preferredStaff: number | null;
  refs: GradeMarkRef[];
}

interface SortedMistake {
  ref: GradeMarkRef;
  pass: number;
  tick: number;
  rank: number; // 0 = a note, 1 = an extra, so a note comes before an extra at the same tick
  order: number;
}

/**
 * `passes` are the passes of the run's passage - every pass of the timeline for a whole-Score run - which is where an extra
 * key can find a written moment (the unselected hand's onsets included).
 */
export function gradeMarks(score: Score, grade: Grade, passes: readonly MeasurePass[]): GradeMarkSet {
  const part = score.parts[grade.settings.selection.partIndex];
  const noteById = new Map<NoteId, Note>();
  const written = new Map<string, Note[]>(); // written moment -> the graded part's printed pitched noteheads
  for (const note of part?.notes ?? []) {
    noteById.set(note.id, note);
    if (!isPrintedPitched(note)) continue;
    const key = momentKey(note.measureIndex, note.onsetInMeasure);
    const list = written.get(key);
    if (list) list.push(note);
    else written.set(key, [note]);
  }
  const expectedByIndex = new Map(grade.expected.map((e) => [e.index, e]));

  const columnAt = (measureIndex: number, onsetInMeasure: number, onsetTick: Ticks): GradeDiscColumn => ({
    at: { measureIndex, onsetInMeasure },
    onsetTick,
    noteIdsAtColumn: (written.get(momentKey(measureIndex, onsetInMeasure)) ?? []).map((n) => n.id),
  });

  /** The first noteheads of a result's tie chain(s): a continuation (`tie.stop`) is not one; a chain with none keeps its first id. */
  const headsOf = (noteIds: readonly NoteId[]): NoteId[] => {
    const heads = noteIds.filter((id) => noteById.get(id)?.tie.stop !== true);
    return heads.length > 0 ? heads : noteIds.slice(0, 1);
  };

  // 1. The noteheads: green only when every pass was correct; every distinct timing error on the first head
  const notes = new Map<
    NoteId,
    { noteId: NoteId; head: GradeHeadMark; timing: ('early' | 'late')[]; results: number[] }
  >();
  const firstHeads = new Set<NoteId>();
  grade.results.forEach((result, resultIndex) => {
    const heads = headsOf(result.noteIds);
    for (const id of heads) firstHeads.add(id);
    for (const id of result.noteIds) {
      let mark = notes.get(id);
      if (!mark) {
        mark = { noteId: id, head: 'correct', timing: [], results: [] };
        notes.set(id, mark);
      }
      mark.results.push(resultIndex);
      if (result.pitch !== 'correct') mark.head = 'missed';
      const timing = result.timing;
      if (heads.includes(id) && (timing === 'early' || timing === 'late') && !mark.timing.includes(timing)) {
        mark.timing.push(timing);
      }
    }
  });

  // The onset tick of a written moment the first time it is graded, for ordering columns
  const firstTickOf = new Map<string, number>();
  for (const result of grade.results) {
    const expected = expectedByIndex.get(result.expectedIndex);
    const head = headsOf(result.noteIds)[0];
    const note = head === undefined ? undefined : noteById.get(head);
    if (!expected || !note) continue;
    const key = momentKey(note.measureIndex, note.onsetInMeasure);
    const seen = firstTickOf.get(key);
    if (seen === undefined || expected.onsetTick < seen) firstTickOf.set(key, expected.onsetTick);
  }
  const columnOfNote = (note: Note): GradeDiscColumn =>
    columnAt(
      note.measureIndex,
      note.onsetInMeasure,
      firstTickOf.get(momentKey(note.measureIndex, note.onsetInMeasure)) ?? 0,
    );

  // 2. The skip icons: one per (written moment, staff) with a missed first notehead
  const iconDrafts = new Map<string, { column: GradeDiscColumn; staff: number; noteIds: NoteId[] }>();
  for (const mark of notes.values()) {
    if (mark.head !== 'missed' || !firstHeads.has(mark.noteId)) continue;
    const note = noteById.get(mark.noteId);
    if (!note) continue;
    const key = `${momentKey(note.measureIndex, note.onsetInMeasure)}:${note.staff}`;
    const draft = iconDrafts.get(key);
    if (draft) draft.noteIds.push(mark.noteId);
    else iconDrafts.set(key, { column: columnOfNote(note), staff: note.staff, noteIds: [mark.noteId] });
  }
  const skipIcons: GradeSkipIcon[] = [...iconDrafts.values()].sort(
    (a, b) => a.column.onsetTick - b.column.onsetTick || a.staff - b.staff,
  );

  // 3. The red discs: wrong pitches at their note's column and staff, extras at the nearest written moment
  const drafts = new Map<string, DiscDraft>();
  const addDraft = (
    column: GradeDiscColumn,
    key: number,
    state: WrongKeyState,
    staff: number | null,
    ref: GradeMarkRef,
  ) => {
    const id = `${momentKey(column.at.measureIndex, column.at.onsetInMeasure)}:${key}`;
    const draft = drafts.get(id);
    if (draft) {
      if (!draft.refs.some((r) => JSON.stringify(r) === JSON.stringify(ref))) draft.refs.push(ref);
      if (column.onsetTick < draft.column.onsetTick) draft.column = column;
      return;
    }
    drafts.set(id, { key, column, state, preferredStaff: staff, refs: [ref] });
  };

  grade.results.forEach((result) => {
    if (result.pitch !== 'wrongPitch' || result.playedKey === null) return;
    const head = headsOf(result.noteIds)[0];
    const note = head === undefined ? undefined : noteById.get(head);
    if (head === undefined || !note) return;
    const expectedKey = result.reason.expectedKey;
    const octave = expectedKey !== null && (result.playedKey - expectedKey) % 12 === 0;
    addDraft(columnOfNote(note), result.playedKey, octave ? 'wrongOctave' : 'wrongPitch', note.staff, {
      kind: 'note',
      noteId: head,
    });
  });

  // Candidate columns for extras: every printed pitched onset of the graded part (both hands) in the passes the run covered
  // the attack onsets of each measure (a tie continuation is a written head but not an attack), earliest first
  const onsetsByMeasure = new Map<number, number[]>();
  for (const list of written.values()) {
    for (const note of list) {
      if (note.tie.stop) continue;
      const onsets = onsetsByMeasure.get(note.measureIndex);
      if (!onsets) onsetsByMeasure.set(note.measureIndex, [note.onsetInMeasure]);
      else if (!onsets.includes(note.onsetInMeasure)) onsets.push(note.onsetInMeasure);
    }
  }
  for (const onsets of onsetsByMeasure.values()) onsets.sort((a, b) => a - b);
  // Candidate columns for extras (only worked out when there are extras): every printed pitched attack onset of the graded
  // part, on both staves, in every pass of the run's passage, as timeline ticks
  const candidates: GradeDiscColumn[] = [];
  if (grade.extras.length > 0) {
    for (const pass of passes) {
      for (const onset of onsetsByMeasure.get(pass.measureIndex) ?? []) {
        candidates.push(columnAt(pass.measureIndex, onset, pass.startTick + onset));
      }
    }
  }
  grade.extras.forEach((extra, index) => {
    const column = extraColumn(candidates, extra.atTick);
    if (column) addDraft(column, extra.key, 'extra', null, { kind: 'extra', index });
  });

  // Place them: one call per column, so the staff choice sees every key of the column; a disc that would sit on a green
  // head of the same key is not drawn (it would hide it), and a key no staff can show gets none
  const correctKeys = (column: GradeDiscColumn): Set<number> => {
    const keys = new Set<number>();
    for (const id of column.noteIdsAtColumn) {
      const note = noteById.get(id);
      if (note && notes.get(id)?.head === 'correct') keys.add(note.soundingKey);
    }
    return keys;
  };
  const byColumn = new Map<string, DiscDraft[]>();
  for (const draft of drafts.values()) {
    const key = momentKey(draft.column.at.measureIndex, draft.column.at.onsetInMeasure);
    const list = byColumn.get(key);
    if (list) list.push(draft);
    else byColumn.set(key, [draft]);
  }
  const discs: GradeDisc[] = [];
  for (const list of byColumn.values()) {
    const column = (list[0] as DiscDraft).column;
    const green = correctKeys(column);
    const shown = list.filter((d) => !green.has(d.key));
    if (shown.length === 0) continue;
    const notesAtColumn = (written.get(momentKey(column.at.measureIndex, column.at.onsetInMeasure)) ?? []).map((n) => ({
      key: n.soundingKey,
      staff: n.staff,
    }));
    const preferredStaff = new Map<number, number>();
    for (const draft of shown)
      if (draft.preferredStaff !== null && !preferredStaff.has(draft.key))
        preferredStaff.set(draft.key, draft.preferredStaff);
    const placements = placeKeys({
      score,
      selection: grade.settings.selection,
      at: column.at,
      notesAtColumn,
      keys: new Map(shown.map((d) => [d.key, d.state] as const)),
      preferredStaff,
      previous: [],
    });
    for (const draft of shown) {
      const placement = placements.find((p) => p.key === draft.key);
      if (placement) discs.push({ key: draft.key, column: draft.column, placement, refs: draft.refs });
    }
  }
  discs.sort((a, b) => a.column.onsetTick - b.column.onsetTick || a.key - b.key);

  // 4. The context of each wrong pitch, for its explanation (FR-022a)
  const contexts = new Map<number, ResultContext>();
  grade.results.forEach((result, index) => {
    if (result.pitch !== 'wrongPitch') return;
    const expected = expectedByIndex.get(result.expectedIndex);
    const head = headsOf(result.noteIds)[0];
    const note = head === undefined ? undefined : noteById.get(head);
    const notPlayed = new Set<number>();
    if (expected && expected.chordSize > 1) {
      for (const other of grade.results) {
        const at = expectedByIndex.get(other.expectedIndex);
        if (
          at &&
          at.passIndex === expected.passIndex &&
          at.onsetTick === expected.onsetTick &&
          other.pitch !== 'correct'
        ) {
          notPlayed.add(at.key);
        }
      }
    }
    contexts.set(index, {
      chordNotPlayed: [...notPlayed].sort((a, b) => a - b),
      octaveShift:
        part && note
          ? octaveShiftAt(part, note.staff, { measureIndex: note.measureIndex, onsetInMeasure: note.onsetInMeasure })
          : 0,
    });
  });

  // 5. What the stepper visits, in playing order
  const sorted: SortedMistake[] = [];
  grade.results.forEach((result, order) => {
    if (result.pitch === 'correct') return;
    const expected = expectedByIndex.get(result.expectedIndex);
    const head = headsOf(result.noteIds)[0];
    if (!expected || head === undefined) return;
    sorted.push({
      ref: { kind: 'note', noteId: head },
      pass: expected.passIndex,
      tick: expected.onsetTick,
      rank: 0,
      order,
    });
  });
  grade.extras.forEach((extra, index) => {
    sorted.push({ ref: { kind: 'extra', index }, pass: extra.passIndex, tick: extra.atTick, rank: 1, order: index });
  });
  sorted.sort((a, b) => a.pass - b.pass || a.tick - b.tick || a.rank - b.rank || a.order - b.order);
  const seenNotes = new Set<NoteId>();
  const mistakes: GradeMarkRef[] = [];
  for (const { ref } of sorted) {
    if (ref.kind === 'note') {
      if (seenNotes.has(ref.noteId)) continue; // one visit per note; its explanation lists every pass
      seenNotes.add(ref.noteId);
    }
    mistakes.push(ref);
  }

  return {
    notes: new Map(
      [...notes.values()].map(
        (m) => [m.noteId, { noteId: m.noteId, head: m.head, timing: m.timing, results: m.results }] as const,
      ),
    ),
    discs,
    skipIcons,
    mistakes,
    contexts,
  };
}
