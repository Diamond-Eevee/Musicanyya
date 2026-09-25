import type { Note, NoteId, Score } from '../../core/score/model.js';

/**
 * A look-up over a parsed Score for the marks the score view draws (009): a note by its ID, and the noteheads written in
 * the same column as a note (the same part, measure and onset, every staff and voice), so a mark can be placed clear of
 * every head of its column (`skipIconBox`, `caretBox`). Grace notes, unpitched and unprinted notes are not heads of a column.
 * Built once per Score.
 */
export class ScoreNoteIndex {
  private readonly byId = new Map<NoteId, Note>();
  private readonly byMoment = new Map<string, Note[]>();

  constructor(score: Score) {
    for (const part of score.parts) {
      for (const note of part.notes) {
        this.byId.set(note.id, note);
        if (note.grace || note.unpitched || note.printed === false) continue;
        const key = momentKey(note);
        const list = this.byMoment.get(key);
        if (list) list.push(note);
        else this.byMoment.set(key, [note]);
      }
    }
  }

  note(id: NoteId): Note | undefined {
    return this.byId.get(id);
  }

  /** Every notehead written at the note's moment in its part, on every staff, the note itself included. */
  column(note: Note): readonly Note[] {
    return this.byMoment.get(momentKey(note)) ?? [];
  }

  /** The same column, on the note's own staff only. */
  columnOnStaff(note: Note): readonly Note[] {
    return this.column(note).filter((other) => other.staff === note.staff);
  }
}

const momentKey = (note: Pick<Note, 'part' | 'measureIndex' | 'onsetInMeasure'>) =>
  `${note.part}:${note.measureIndex}:${note.onsetInMeasure}`;
