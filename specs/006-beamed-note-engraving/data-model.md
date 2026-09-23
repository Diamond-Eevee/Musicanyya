# Data Model: Beamed Notes and Complete Engraving

All types live in `src/core/musicxml/engraving/` (pure TypeScript, no DOM). Durations are in the measure's
`<divisions>` units unless stated. Nothing here is persisted.

## 1. EngravingMode

| Value | Used by | Beams | Required accidentals | Courtesy accidentals |
|---|---|---|---|---|
| `'library'` | exercise generator, `pnpm library:engrave`, library guard | every voice with no `<beam>` | where missing | yes (FR-008) |
| `'opened'` | score worker (render copy only) | every voice with no `<beam>` | where missing | only in parts that print **no** `<accidental>` at all (R-3.7) |

## 2. Walked events (`walk.ts`)

`VoiceEvent` - one per `<note>` (chord members folded into their chord head):

| Field | Type | Notes |
|---|---|---|
| `part`, `measureIndex`, `measureLabel` | number, number, string | label = `<measure number>` for messages |
| `staff` | number | printed staff (`<staff>`, default 1) - accidental state key |
| `voice` | string | `<voice>`, default `'1'` - beam grouping key (with part) |
| `onset` | number | position in the measure after `<backup>`/`<forward>` |
| `duration` | number | 0 for grace notes |
| `type` | `'whole'...'1024th'` \| null | `<type>`; null -> derived from duration when unambiguous, else not beamable |
| `dots` | number | |
| `rest`, `grace`, `chord` | boolean | chord members are listed in `chordNotes` of the head |
| `tuplet` | `{ actual: number; normal: number }` \| null | from `<time-modification>` |
| `pitches` | `WrittenPitch[]` | head + chord members; empty for rests / unpitched |
| `hasBeam` | boolean | any `<beam>` child |
| `insertAt` | `{ accidental: number[]; beam: number }` | source offsets (R-8); one accidental offset per pitch |

`WrittenPitch`: `{ step: 'A'..'G'; alter: number /* -2..2, fractional -> ignored (R-3.9) */; octave: number;
hasAccidental: boolean; tieStop: boolean; noteRef: NoteRef }`.

`MeasureContext`: `{ divisions; time: { beats: number[]; beatType: number } | null; implicit: boolean;
lengthDivisions; keyByStaff: Map<number, number /* fifths */> }` - key per staff (`<key number="n">` applies to one
staff, a key without `number` to all staves).

## 3. Beat grouping (`beat-grouping.ts`)

`beamSpans(time, measureLength, implicit, level): Span[]` - half-open `[start, end)` ranges in divisions within
which notes of `level` (1 = eighth beam, 2 = sixteenth beam, ...) may be joined. Rules: research R-2.
Implicit (pickup) bars are aligned to the **end** of a full bar, so a pickup of one eighth in 3/8 falls in the
last part of the bar's span.

## 4. Beam values (`beams.ts`)

`BeamValue = 'begin' | 'continue' | 'end' | 'forward hook' | 'backward hook'` (MusicXML spelling).
Output per beamable event: `Array<{ number: 1..6; value: BeamValue }>`, emitted as
`<beam number="n">value</beam>` in ascending `number`.

Validation: a voice that already has any `<beam>` is skipped entirely (FR-004, US3 scenario 2). A voice whose
encoded beams are inconsistent (research R-2 B12: runs are followed across barlines; e.g. a `begin` that is never
closed) is reported as `beamDataInvalid` and left as encoded (Verovio shows what it can); no beams are added to it. A
voice with lyrics and no `<beam>` is left as encoded too (R-2 B13).

## 5. Accidentals (`accidentals.ts`)

`AccidentalState` per `(part, staff)`, reset at each barline:

| Key | Value |
|---|---|
| `step + octave` (e.g. `D5`) | current alteration in force for that exact written pitch line |
| `step` (courtesy memory) | alterations used in the **previous** bar, for FR-008 |

Output per pitch: `'sharp' | 'flat' | 'natural' | 'double-sharp' | 'flat-flat'` or none, and whether it is
`required` or `courtesy` (for counting only; both are written without brackets).

## 6. EngravingPlan (`plan.ts`)

| Field | Type | Notes |
|---|---|---|
| `inserts` | `ElementInsert[]` | `{ offset: number; text: string; order: number }`, sorted by `(offset, order)` |
| `beamGroupsAdded` | number | groups (level-1 spans), not individual `<beam>` elements |
| `accidentalsAdded` | `{ required: number; courtesy: number }` | |
| `findings` | `EngravingFinding[]` | one per insert-worthy location, for the library guard message |
| `invalidBeams` | `{ part; measureLabel; voice }[]` | -> `beamDataInvalid` |
| `contradictions` | `{ part; measureLabel; staff; pitch }[]` | -> `accidentalContradicts` |

`EngravingFinding`: `{ kind: 'missingBeam' | 'missingAccidental' | 'missingCourtesy'; part: number;
measureLabel: string; staff: number; voice: string; pitch?: string /* 'D5' */ }`.

`applyInserts(xml, inserts): string` - single-pass splice (same technique as `createRenderCopy`).

**Invariants** (tested): deterministic; idempotent (`planEngraving(applyInserts(x, plan(x).inserts))` has no
inserts); never removes or rewrites existing text; the Score built from the completed text has the same Note IDs,
ticks and keys as the one built from the original.

## 7. Load report entries

| Code | Severity | When | Detail |
|---|---|---|---|
| `engravingCompleted` | info | an opened Score needed any insert | `"<g> beam groups, <n> accidentals added for display"` |
| `beamDataInvalid` | warning | encoded beams inconsistent (left as encoded, voice not completed) | measure labels listed |
| `accidentalContradicts` | warning | a printed `<accidental>` contradicts `<alter>` (kept, FR-006 exception) | measure labels + pitch |

Library items are complete on disk, so they never raise `engravingCompleted` (the 005 test "no notice on open"
keeps passing).

## 8. Title block (FR-017, research R-4)

`Score` gains `arranger: string | null` (`<creator type="arranger">`); `title` falls back to `<movement-title>` when
there is no `<work-title>`. The worker summary carries `title`, `composer`, `arranger`.

`TitleBlock` (UI, derived, not stored): `{ title: string /* else file name */; composer: string | null;
arranger: string | null }`. Rendered once above page 1 in every mode; empty lines are omitted.

## 9. Named constants

No new tuning constants. The beat-grouping table (R-2) is a lookup in `beat-grouping.ts`, documented here and in the
contract, not a user setting.
