import { PRACTICE_DISC_MAX_LEDGER_LINES, PRACTICE_DISC_OTHER_STAFF_LEDGER_LINES } from '../defaults.js';
import type { ExpectedEvent, HandSelection, WrongKeyState } from '../practice/types.js';
import type { Note, Score, ScorePosition } from '../score/model.js';
import { type Letter, staffContextAt } from './context.js';
import { spellPressedKey } from './spell.js';
import { isPlaceableClef, LETTER_PITCH_CLASS, middleLineKey, staffPosition } from './staff-position.js';

/** The most octaves a disc is folded (22ma / 22mb): enough for any key of the piano under an 8va or a 15mb. */
const MAX_OTTAVA = 3;

/** Where the Score shows one held wrong key (feature 008, data-model section 3): a red disc on a staff. */
export interface DiscPlacement {
  /** The MIDI key pressed. */
  key: number;
  /** 1-based staff of the practised part the disc is drawn on. */
  staff: number;
  letter: Letter;
  alter: -1 | 0 | 1;
  /** The octave the disc is drawn at: printed (after an octave shift and a transposition) and after being folded closer
   *  to the staff by `ottava` (research R-10). */
  printedOctave: number;
  /** Whether a sign is drawn: a sharp, flat or natural sign for `alter` 1, -1, 0 (research R-07). */
  showAccidental: boolean;
  /** Diatonic steps above the bottom line: 0 = bottom line, 1 = first space, 8 = top line, -2 = first ledger line below. */
  position: number;
  /** Ledger lines the disc needs, negative below the staff; never more than PRACTICE_DISC_MAX_LEDGER_LINES. */
  ledgerLines: number;
  /** Octaves the disc was drawn closer to the staff than the pitch: +1 draws it an octave lower and is labelled 8va,
   *  -1 an octave higher (8vb), +-2 15ma / 15mb, +-3 22ma / 22mb; 0 = no label. The key is `(letter, alter, printedOctave + ottava)` after
   *  undoing any octave shift and transposition. */
  ottava: -3 | -2 | -1 | 0 | 1 | 2 | 3;
  /** Why the key is not accepted (an accessibility name, never shown as a verdict). */
  state: WrongKeyState;
}

/** The position in the Score of an expected event: where its first required note is written. Null when the note is not
 *  found (it belongs to no part of this Score). */
export function eventPosition(score: Score, event: ExpectedEvent): ScorePosition | null {
  const noteId = event.required[0]?.noteIds[0];
  if (noteId === undefined) return null;
  for (const part of score.parts) {
    const note = part.notes.find((n) => n.id === noteId);
    if (note) return { measureIndex: note.measureIndex, onsetInMeasure: note.onsetInMeasure };
  }
  return null;
}

interface CursorNote {
  key: number;
  staff: number;
}

/** The notes written at the cursor, with their printed staff: the event's required notes and the accompaniment notes
 *  written at the same onset (a later one is not "at the cursor"). */
function notesAtCursor(score: Score, partIndex: number, event: ExpectedEvent, at: ScorePosition): CursorNote[] {
  const part = score.parts[partIndex];
  if (!part) return [];
  const wanted = new Set<string>();
  for (const ref of event.accompaniment) wanted.add(ref.noteId);
  const found = new Map<string, Note>();
  if (wanted.size > 0) {
    for (const note of part.notes) if (wanted.has(note.id)) found.set(note.id, note);
  }
  const notes: CursorNote[] = event.required.map((r) => ({ key: r.key, staff: r.staff }));
  for (const ref of event.accompaniment) {
    const note = found.get(ref.noteId);
    if (note && note.measureIndex === at.measureIndex && note.onsetInMeasure === at.onsetInMeasure) {
      notes.push({ key: ref.key, staff: note.staff });
    }
  }
  return notes;
}

/**
 * Every disc for the held wrong keys at the current event (research R-06 to R-10): the staff each key is drawn on, its
 * spelling and sign, its position, ledger lines and any octave folding. `previous` is the last result: a key that is
 * still held keeps its staff, so a disc never jumps between staves while it is held (R-08). Pure and deterministic
 * (FR-016); never throws on any parsed Score; a key whose staff has a clef that cannot be placed gets no disc.
 */
export function placeDiscs(input: {
  score: Score;
  selection: HandSelection;
  event: ExpectedEvent;
  at: ScorePosition;
  heldWrongKeys: ReadonlyMap<number, WrongKeyState>;
  previous: readonly DiscPlacement[];
}): DiscPlacement[] {
  const { score, selection, event, at, heldWrongKeys, previous } = input;
  const part = score.parts[selection.partIndex];
  if (!part || heldWrongKeys.size === 0) return [];

  const staffCount = Math.max(1, part.staves);
  const staves = Array.from({ length: staffCount }, (_, i) => i + 1);
  const practised = selection.staves.filter((s) => s >= 1 && s <= staffCount);
  const atCursor = notesAtCursor(score, selection.partIndex, event, at);
  const previousStaff = new Map(previous.map((p) => [p.key, p.staff]));

  /** The disc for a key on a staff, before any octave folding. */
  const raw = (key: number, staff: number) => {
    const ctx = staffContextAt(score, selection.partIndex, staff, at);
    const spelled = spellPressedKey(key, ctx);
    const written = key - ctx.transposeSemitones;
    const octave = (written - spelled.alter - LETTER_PITCH_CLASS[spelled.letter]) / 12 - 1;
    const printedOctave = octave - ctx.octaveShift;
    return { ctx, spelled, printedOctave, ...staffPosition(spelled.letter, printedOctave, ctx.clef) };
  };
  const ledgerOn = (key: number, staff: number) => Math.abs(raw(key, staff).ledgerLines);

  const chooseStaff = (key: number): number => {
    const kept = previousStaff.get(key);
    if (kept !== undefined && staves.includes(kept)) return kept;

    // (1) a key that is written at the cursor goes on that note's staff
    const written = atCursor.find((n) => n.key === key);
    if (written && staves.includes(written.staff)) return written.staff;

    // (2) one hand practised: its staff, unless that needs more than a few ledger lines and another needs fewer
    if (practised.length === 1 && staves.length > 1) {
      const hand = practised[0] as number;
      const handLines = ledgerOn(key, hand);
      if (handLines > PRACTICE_DISC_OTHER_STAFF_LEDGER_LINES) {
        let best = hand;
        let bestLines = handLines;
        for (const staff of staves) {
          const lines = ledgerOn(key, staff);
          if (staff !== hand && lines < bestLines) {
            best = staff;
            bestLines = lines;
          }
        }
        return best;
      }
      return hand;
    }
    if (staves.length === 1) return 1;

    // (3) both hands: the staff whose notes at the cursor are nearest in pitch. A staff with no note there (a rest)
    // competes by the pitch of its middle line, so a very low key still goes to the bass staff while only the treble
    // staff has a note at the cursor; when neither staff has a note, the fewer-ledger-lines rule below decides.
    const anyNotes = atCursor.some((n) => staves.includes(n.staff));
    const distance = (staff: number) => {
      const own = atCursor.filter((n) => n.staff === staff);
      if (own.length > 0)
        return own.reduce((least, n) => Math.min(least, Math.abs(n.key - key)), Number.POSITIVE_INFINITY);
      if (!anyNotes) return Number.POSITIVE_INFINITY;
      const ctx = staffContextAt(score, selection.partIndex, staff, at);
      return Math.abs(key - (middleLineKey(ctx.clef) + 12 * ctx.octaveShift + ctx.transposeSemitones));
    };
    const nearest = Math.min(...staves.map(distance));
    const candidates = Number.isFinite(nearest) ? staves.filter((s) => distance(s) === nearest) : staves;
    if (candidates.length === 1) return candidates[0] as number;

    // (4) neither staff has notes there (or a tie): the staff needing fewer ledger lines; still a tie: C4 and above
    // go on the upper staff, lower keys on the lower one
    const fewest = Math.min(...candidates.map((s) => ledgerOn(key, s)));
    const tied = candidates.filter((s) => ledgerOn(key, s) === fewest);
    return key >= 60 ? (tied[0] as number) : (tied[tied.length - 1] as number);
  };

  const discs: DiscPlacement[] = [];
  for (const key of [...heldWrongKeys.keys()].sort((a, b) => a - b)) {
    const staff = chooseStaff(key);
    const { ctx, spelled, printedOctave: drawn, position: drawnPosition } = raw(key, staff);
    if (!isPlaceableClef(ctx.clef)) continue;

    // Beyond the ledger-line limit the disc is drawn one or two octaves closer to the staff and labelled (R-10)
    let printedOctave = drawn;
    let position = drawnPosition;
    let ledgerLines = staffPosition(spelled.letter, printedOctave, ctx.clef).ledgerLines;
    let ottava = 0;
    while (Math.abs(ledgerLines) > PRACTICE_DISC_MAX_LEDGER_LINES && Math.abs(ottava) < MAX_OTTAVA) {
      const step = position > 0 ? 1 : -1; // above the staff: draw an octave lower (8va); below: higher (8vb)
      printedOctave -= step;
      ottava += step;
      ({ position, ledgerLines } = staffPosition(spelled.letter, printedOctave, ctx.clef));
    }
    if (Math.abs(ledgerLines) > PRACTICE_DISC_MAX_LEDGER_LINES) continue; // cannot be shown at a correct position

    discs.push({
      key,
      staff,
      letter: spelled.letter,
      alter: spelled.alter,
      printedOctave,
      showAccidental: spelled.showAccidental,
      position,
      ledgerLines,
      ottava: ottava as DiscPlacement['ottava'],
      state: heldWrongKeys.get(key) as WrongKeyState,
    });
  }
  return discs;
}
