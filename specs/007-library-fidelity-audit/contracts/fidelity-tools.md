# Contract: fidelity tools (readers, comparator, theory check, converter, commands)

**Version**: `1.8.0` (1.0.0 new; 1.0.1 corrected the `\ottava` row; 1.1.0, 2026-09-24: `compareSound`, `describeDifference`, `checkRecord`, `outcomeLabel`, `CheckResult.detail`, the CLI's `main`, Scheme values of layout commands; 1.2.0, 2026-09-24: written bars follow the printed page (§3.2), `measurePosition`, `\tupletSpan`; 1.3.0, 2026-09-24: the converter's marks, §3.3; 1.4.0, 2026-09-24: the constructs of the US1 sources, §3.1, `readLilyPond(source, { score })`; 1.5.0, 2026-09-24: markup text, named voices per staff, moved hairpin ends, the MIDI's playback tempo, T096; 1.6.0, 2026-09-24: `compareMelody` takes `MelodyOptions` and returns `MelodyResult`, `melodyRhythm` differences, `CheckResult.allowed`, T054; 1.7.0, 2026-09-24: `\partcombine` and `#(set-accidental-style ...)` in music, T098; 1.8.0, 2026-09-24: `claimForItem` and `ClaimError`, `TheoryDifference` joins the comparator's `Difference` union as `kind: 'theory'`, the theory check runs from `runRecord`, T073-T074). Dev-time only: nothing here is imported by `src/app`, `src/ui`, `src/engine` or a
worker, and `tests/architecture/layers.test.ts` asserts it (as it already does for the exercise generator).

**Location**: `tools/library/fidelity/` (pure TypeScript, Node, no DOM; compiled by `tsconfig.tools.json`) and
`tools/library/lilypond/`. Tests: `tests/tools/fidelity/`, `tests/tools/lilypond/`, `tests/library/fidelity.test.ts`.

## 1. Commands (`package.json`)

| Command | Does | Exit code |
|---|---|---|
| `pnpm library:fidelity` | Validates every source and record, re-runs every check, prints a one-line result per item, rewrites `docs/library-audit.md`. | 0 when every check reproduces its recorded result; 1 otherwise (names item, check, and the first differences). The report is **not** written on failure. |
| `pnpm library:fidelity --item <id>` | Same for one item, prints every difference in full. Does not write the report. | as above |
| `pnpm library:fidelity --item <id> --file <path>` | Runs that item's checks against another MusicXML file (a mutated copy in scratch space) instead of the shelf file. Used for manual planted-error checks. Writes nothing. | 0 / 1 |
| `pnpm library:fidelity --inspect-midi <path>` | Prints a MIDI file's tracks (note counts, channels, first/last tick) and whether repeats look unfolded, to fill `midiOrder`/`midiNoteTracks` once. | 0 |
| `pnpm library:fidelity --check` | As the first row, but only compares the report with a fresh render (CI mode, writes nothing). | 1 when stale |
| `pnpm library:convert-ly <source-id> <item-id>` | Converts the source's `.ly` into the item's `.musicxml` (overwrites it), then prints the MIDI cross-check (§3.4). Refuses when the source is not approved, when the target sidecar says `origin: "authored"` and `--replace` is not given, or when the cross-check finds differences. | 0 / 1 |

`pnpm library:engrave`, `pnpm library:index` and the existing library tests run after a conversion exactly as
for any edited file.

## 2. Module interfaces

```ts
// tools/library/fidelity/time.ts
export function q(num: number, den?: number): QuarterTime;                    // reduces
export function add(a: QuarterTime, b: QuarterTime): QuarterTime;
export function cmp(a: QuarterTime, b: QuarterTime): -1 | 0 | 1;
export function fromTicks(ticks: number, ppq: number): QuarterTime;
export function show(t: QuarterTime): string;                                 // "3 1/3"

// tools/library/fidelity/midi.ts - Standard MIDI File reader (research R3)
export interface MidiNote { track: number; channel: number; midi: number; onTick: number; offTick: number }
export interface MidiFile { format: 0 | 1; ppq: number; notes: MidiNote[]; timeSignatures: { tick: number; num: number; den: number }[] }
export function readMidi(bytes: Uint8Array): MidiFile;                        // throws MidiFormatError with byte offset
export function fromMidi(file: MidiFile, tracks: number[]): ReferenceScore;

// tools/library/fidelity/from-musicxml.ts - via the app's own readXml + buildScore
export function fromMusicXml(xml: string): ReferenceScore;

// tools/library/lilypond/read.ts - the LilyPond subset (section 3)
// options.score: which \score of a file with one per movement (source manifest 1.1.0)
export function readLilyPond(source: string, options?: { score?: number }): LyScore;  // throws LyUnsupportedError(line, col, construct)
export function fromLilyPond(score: LyScore): ReferenceScore;
/** The same reading plus the written events (notes, rests, clefs, marks ... in source order), for the converter. */
export function readWritten(score: LyScore): { reading: ReferenceScore; events: LyEvent[]; staves: number };

// tools/library/lilypond/to-musicxml.ts - the converter (section 3.3); `dropped` lists display-only marks not written
export function toMusicXml(score: LyScore, meta?: { title?: string; composer?: string; rights?: string; source?: string }):
  { xml: string; dropped: string[] };

// tools/library/lilypond/cli.ts - pnpm library:convert-ly (section 1)
export function main(args: string[], io: { root: string; out: (line: string) => void }): number;

// tools/library/fidelity/compare.ts
export function compare(item: ReferenceScore, source: ReferenceScore, aspects: Aspect[], alignment: Alignment): Difference[];
/** research R7, data-model.md §4.4: `differences` are counted; `allowed` holds the rhythm differences a declared
 *  rhythmic departure allows (listed in the report, never counted). Throws on a transpose it cannot read. */
export function compareMelody(item: ReferenceScore, source: ReferenceScore, alignment: Alignment,
                              options: { allowRhythm: boolean; spelling: boolean }):
  { differences: Difference[]; allowed: Difference[] };                                // US2, task T054
/** Step 2 of data-model.md §4.1a: notation reading vs the MIDI made from it, with research R5's rules. */
export function compareSound(notation: ReferenceScore, sound: ReferenceScore,
                             options: { order: 'written' | 'played'; articulate: boolean }):
  { differences: Difference[]; durations: 'compared' | 'notation only' };
export function describeDifference(d: Difference): string;   // "bar 12, beat 1 1/2: pitch F4, source E4"

// tools/library/fidelity/theory.ts - independent exercise check (research R8); claim and difference shapes: data-model.md §5
export function checkExercise(xml: string, claim: ExerciseClaim): TheoryDifference[];
// tools/library/fidelity/exercise-claims.ts - the hand-written claim table; throws ClaimError when the title names no known
// exercise, names it in the wrong mode, or does not spell its chords and the description does not state them either
export function claimForItem(item: { itemId: string; title: string; trains: string }): ExerciseClaim;

// tools/library/fidelity/sources.ts
export function loadSources(root: string): Map<string, SourceManifest>;       // validates + re-hashes

// tools/library/fidelity/records.ts
export function loadRecords(root: string): AuditRecord[];                     // validates
export function runRecord(record: AuditRecord, ctx: RunContext): CheckResult[];  // the two-step chain for notation + sound
export interface CheckResult { check: Check; differences: Difference[] | TheoryDifference[];
                               allowed: Difference[] /* melody checks: rhythm allowed by departures */; reproduced: boolean;
                               detail: string /* "item vs notation: 0 differences; notation vs sound: 0 differences" */ }
export function checkRecord(record: AuditRecord, results: CheckResult[], ctx: RunContext): string[]; // audit-record.md §2
export function outcomeLabel(record: AuditRecord): string;   // "verified (visual)" for a visual-only record (FR-019)

// tools/library/fidelity/cli.ts
export function main(args: string[], io: { root: string; out: (line: string) => void }): number;  // §1, exit code

// tools/library/fidelity/report.ts
export function renderReport(records: AuditRecord[], results: Map<string, CheckResult[]>, index: LibraryIndex): string;
```

Every function is deterministic: the same inputs give byte-identical output (FR-016).

## 3. LilyPond reader (`tools/library/lilypond/`)

### 3.1 Scope

The reader implements the constructs the audited Mutopia sources actually use, each with its own test, and fails
loudly on anything else: `LyUnsupportedError` names the line, column and construct. It never skips a construct
silently - a skipped `\repeat` would produce a plausible but wrong score, which is the failure this feature exists
to stop.

| Construct | Behaviour |
|---|---|
| `\version`, `\header { ... }`, `\paper`, `\layout`, `\midi` blocks | header fields read (title, composer, opus, source, copyright, `mutopia*`); other blocks skipped as a unit |
| variable definitions `name = { ... }` / `name = \relative ... { ... }` and references `\name` | expanded |
| `\relative c' { ... }` and absolute mode | LilyPond's relative-octave rule, including "a chord's first note is relative to the previous chord's first note" |
| notes, rests (`r`, `R` full-bar rests, `s` spacers), chords `< >`, durations with dots, durations carried over | as LilyPond defines them |
| `~` ties | merged into one sounding note (spec edge case) |
| `\tuplet n/m { }` and the older `\times m/n { }` | exact rational durations |
| `\grace`, `\acciaccatura`, `\appoggiatura`, `\slashedGrace` | grace notes (no written time), kept apart |
| `\repeat volta n { }` + `\alternative { { } { } }` | bar repeat marks and ending numbers |
| `\repeat unfold n { }` | expanded n times (it is written out in the printed score) |
| `\partial d` | pickup bar of length d |
| `\set Timing.measurePosition = #(ly:make-moment -n/d)` | re-anchors LilyPond's bar lines (a negative position ends the bar that far ahead), as 2.18 sources use it to end a second ending early |
| `\tupletSpan d` | tuplet bracket grouping only; no timing effect |
| `\time`, `\key`, `\clef` | metre, key signature (for spelling output), clef changes |
| `\ottava #n` | the entered pitch **is** the sounding pitch (LilyPond's `\ottava` only sets `middleCPosition`, i.e. the staff position; research R5 rule 6); the written pitch is the entered pitch minus n octaves, kept for the writer's `<octave-shift>` |
| `<< { } \\ { } >>`, `\new Voice`, `\new Staff`, `\new PianoStaff`, `\context`, `\change Staff` | voices and staves; a named `\context Voice = "x"` belongs to the staff it is created in, so the same name in two staves is two voices (1.5.0; Burgmüller 203) |
| `\bar "..."` | a visible style adds a written bar line; `\bar ""` hides the bar line at that point (it is then not a bar line of the written music); repeat bars via the repeat construct only |
| articulations, dynamics, slurs, phrasing slurs, fingerings, `\markup`, text scripts, `\tempo`, `\sustainOn/Off` | read as notation marks for the converter; ignored by the comparator |
| `\set`, `\override`, `\revert`, `\once`, `\omit`, `\hide`, `\accidentalStyle` of layout properties | skipped as a unit, including their Scheme value (`#'(...)`, `##f`, `#red`); a property that moves notes in pitch or time (`Timing.*`, `measurePosition`, `middleCPosition`, `currentBarNumber`, ...) or hides printed music (`skipTypesetting`) is an error where the music uses it (a variable that only defines it, as Chopin 468's `paperOFF`, is not) |
| `\language "english"` / `\include "english.ly"` | English note names (Dutch is the default) |
| *Added in 1.4.0 for the US1 sources (T095):* | |
| non-ASCII characters (markup text: "Gymnopédie", the "•" of Mutopia taglines) | words; in music such a word is not a note, so an error |
| a `\markup` variable used as a script (`^\crescendo`) | a text script; since 1.5.0 its text is read as below. A variable the file defines shadows LilyPond's own identifier of that name (`cr = \markup ...` is not the `\cr` hairpin) |
| *Added in 1.5.0 (T096):* `\markup` text | strings and words joined by spaces; `\italic`/`\bold` give the style; `\dynamic p` inside gives a dynamic mark; commands that only change the look (`\large`, `\teeny`, `\hspace #n`, ...) are passed over with their Scheme arguments; a markup that prints only spaces gives no mark |
| `\tweak property value event`, also stored in a variable and used after `-`/`^`/`_` (`-\hidePP`) | the event; the tweak is layout only |
| `\shape #'(...) Grob`, `\crossStaff { }`, `\crescTextCresc`, `\crescHairpin`, `\dimTextDim`, `\dimTextDecresc`, `\dimTextDecr`, `\dimHairpin` | layout only; the music inside `\crossStaff` is read as written |
| `\transpose from to { }` outside `\relative` | every pitch and key tonic inside moves by the interval, spelled by letter (`\transpose c d`: F#4 -> G#4); inside `\relative`, or needing a triple accidental, an error |
| `\bar ".\|:"`, `"\|:"`, `"[\|:"` | a printed start repeat, allowed only where a `\repeat volta` starts; that bar then has a start repeat even at the beginning of the piece |
| `\book { }` with one `\score` per movement | the source manifest's `score` field (1.1.0) names the `\score` to read; without it, several notation scores are an error |
| `\barNumberCheck #n` | LilyPond's own measure number must be n there (from 1, or from 0 after `\partial`) |
| `e4\rest` (a rest at a pitch) | a rest; its pitch counts for `\relative` |
| *Added in 1.7.0 (T098):* `\partcombine A B` | two voices on the staff, exactly as `<< A \\ B >>` (LilyPond only decides how the parts are printed); Mutopia 1283 and 1247 read this way agree with their own MIDI (0 differences) |
| *Added in 1.7.0 (T098):* `#(set-accidental-style ...)` in music | layout only (which accidentals are printed) |
| `\include` of anything other than `"english.ly"`/`"nederlands.ly"`, any other Scheme expression (in music other than `set-accidental-style`, or at top level other than `set-global-staff-size`/`set-default-paper-size`), `\relative` without a start pitch, `\afterGrace`, chord repetition `q`, tremolo `:`, `\repeat percent`/`tremolo`, `\repeat volta` with more than two passes and alternatives, any other `Timing` property, an end-repeat `\bar` | **unsupported** -> error |

### 3.2 Bars

LilyPond's own measures are derived from `\time`, `\partial`, `\set Timing.measurePosition` and accumulated
durations, and cross-checked against the source's bar checks (`|`): a bar check that does not fall on one of those
bar lines is an error, as it is in LilyPond itself.

The **written bars** of the reading follow the printed page: LilyPond's bar lines, minus those hidden with `\bar ""`,
plus visible `\bar` lines and every repeat and volta boundary (a repeat sign is printed as a bar line even inside a
measure). So a first ending that completes a pickup bar is a short bar of its own, as it is in the MusicXML item.
A repeat that starts at the very beginning has no start-repeat bar line (LilyPond prints none there). Bars are
numbered in order, from 0 when the piece starts with `\partial`.

### 3.3 Converter (`tools/library/lilypond/to-musicxml.ts`)

Writes MusicXML through `src/core/musicxml/write.ts`, extended additively (research R13) with: repeat barlines and
`<ending>`, grace notes, `<time-modification>` for tuplets, `<octave-shift>`, clef/key/time changes mid-piece,
`16th`/`32nd` types, slurs, dynamics, `<pedal>`, tempo `<words>` + `<sound tempo>`; since 1.3.0 also
articulations, ornaments, fermatas, arpeggios, hairpins, whole-bar rests, italic words, `<rights>`/`<source>`
(research R13 addendum). A mark that changes playback or grading and cannot be written fails the conversion;
display-only marks that cannot be written are dropped and listed.

Since 1.5.0 (T096):

- Text scripts and markup words are written as `<words>`: upright unless the markup says `\italic` or `\bold`;
  above with `^`, otherwise below (LilyPond's TextScript direction is down).
- A hairpin end on a spacer where no note starts or ends moves to the next note in the bar and is listed
  ("hairpin end moved to beat ..."); any other mark there still fails.
- `readMidi` returns `tempos` (quarter notes per minute). `library:convert-ly` passes the set-tempo at tick 0 as
  `playbackTempo`. When the notation has no metronome mark, the first bar gets `<sound tempo>` in a direction with
  empty `<words/>` (nothing printed), and the command prints "playback tempo N from the source MIDI"; later MIDI
  tempo changes are reported, not written.

Exercise output stays
byte-identical (the existing exercise goldens are the guard). Titles, composer and credit come from the item's
sidecar, not from the `.ly` header.

### 3.4 Cross-check on conversion

`library:convert-ly` compares its own reading (`fromLilyPond`) with the source's MIDI (`fromMidi`) on pitch, onset
and duration before writing anything. Two independent readings of the same source must agree - that is what shows
the reader read the source right. A difference stops the conversion and prints it. Known, explained exceptions
(for example how LilyPond's MIDI places grace notes, research R5) are handled by the comparison rules, not by
per-source exceptions.

A second check runs before the file is written: the MusicXML written, read back with `fromMusicXml`, must equal
`fromLilyPond` on every aspect. A difference is a converter bug; it stops the conversion and prints it.

## 4. Theory check (`tools/library/fidelity/theory.ts`)

- Imports only `tools/library/fidelity/*`, the app's `readXml` (to read the file) and Node built-ins. It must not
  import `src/core/library/exercise/**` or read `content/library/exercises/**`; an architecture test asserts both
  (FR-013).
- Rules: `data-model.md` §5. Output: one `TheoryDifference` per wrong or wrongly spelled chord tone, naming the chord
  index, bar, hand, expected and found (FR-014).

## 5. Self-tests (FR-017, SC-004)

`tests/tools/fidelity/planted.test.ts` takes a verified item and its source, applies one mutation at a time to a
copy of the item's MusicXML, and asserts the comparison reports exactly that difference with the right bar:

| Mutation | Expected |
|---|---|
| one pitch +1 semitone | one `pitch` difference in that bar |
| one duration halved (rest fills the gap) | one `duration` difference in that bar |
| one bar deleted | `barCount` difference, plus `missing` notes in that bar only |
| one repeat barline removed | `repeat` difference at that bar, and a `playedOrder` difference |
| one note respelled enharmonically | one `spelling` difference |
| one grace note removed | one `grace` difference |
| one melody note changed in an arrangement quote | one `melody` difference naming the bar |
| (theory) one chord tone respelled, per family | one `TheoryDifference` naming the chord |
| (theory) one chord tone moved a semitone, per family | one `TheoryDifference` naming the chord |

A comparison method whose planted error is not caught may not be used for any "no differences" result.

## 6. Versioning

MINOR for new constructs, aspects or commands; MAJOR for a changed command meaning or output format.
