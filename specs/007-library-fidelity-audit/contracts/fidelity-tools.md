# Contract: fidelity tools (readers, comparator, theory check, converter, commands)

**Version**: `1.18.0` (1.18.0, 2026-10-01, feature 019-metronome-orchestra-volume T084, MINOR: `library:convert-ly` converts a source with `origin: "transcription"` and no sound file with the read-back check only, and says that its independent check is the audit record's mechanical check against another transcription (§1, §3.4; 019 research R-15 addendum); 1.17.0, 2026-10-01, feature 019-metronome-orchestra-volume T083, MINOR: a `\tempo` with a dotted beat (`4. = 60`) is written as `<metronome>` with `<beat-unit-dot/>` instead of being dropped (its `<sound tempo>` in quarter notes per minute was already written); `WriteDirection.metronome.dots` (§3.3); 1.16.0, 2026-10-01, feature 019-metronome-orchestra-volume T082, MINOR: `\afterGrace main { graces }` (a Nachschlag) - the grace notes belong to the end of the main note, in its bar, and the converter writes them after it in that bar (§3.1, §3.3); 1.15.0, 2026-10-01, feature 019-metronome-orchestra-volume T081, MINOR: the reader reads the two-note `\repeat tremolo n { a b }` as the alternation of strokes it means, the converter writes it as its two printed notes with `<tremolo type="start|stop">` (time modification 2:1), the writer writes `WriteNote.tremolo`, and `fromMusicXml` reads a written two-note tremolo stroke by stroke (§3.1, §3.3); 1.14.0, 2026-10-01, feature 019-metronome-orchestra-volume, MINOR: `checkOrchestra(score, definition)` (rules O1-O5, rule set `orchestra-v1`, `tools/library/fidelity/orchestra.ts`), the command `pnpm library:orchestra <item-id> [--check]` (generator `tools/library/orchestra/`), the MusicXML writer can write `<staff-details print-object="no" print-spacing="no">` and `<sound dynamics>`, and the manifest reader accepts `origin` (source-manifest 1.2.0); full text [019 orchestration-definition.md](../../019-metronome-orchestra-volume/contracts/orchestration-definition.md); 1.13.0, 2026-09-30, feature 017 T051: `\hideNotes` notes are written invisible, a hidden note may be scaled with `*n/m`, an unterminated tie is not written, `WriteNote.printObject` (§3.3); 1.12.1, 2026-09-30, feature 017 T049/T050: the repeat mode may be a string, `\repeat "volta" n` / `"unfold"`, read as the plain word; a top-level `\markup` is skipped (text only); 1.12.0, 2026-09-28, feature 014: rule set `exercise-theory-v3`, `checkMelodyRules` and
`checkMelodyVariation`, `melodyDegrees` (`tools/library/fidelity/melody-rules.ts`, new), `SectionHand` gains `{ kind: 'melody'; level:
Level }` (`theory.ts`), thresholds from `MELODY_LADDER` (`src/core/defaults.ts`); change request
`specs/014-melody-over-chords/contracts/audit-record-1.3.md`; 1.11.0, 2026-09-26, feature 011 US3: the LilyPond reader skips the braced lyric block of `\lyricmode`, `\addlyrics` and `\lyrics` and the `\lyricsto <voice>` argument (words carry no note; a `Lyrics` context is accepted), and reads a `\bar ":|"` at the very end of the music as its final bar line (LilyPond's own MIDI does not repeat it; anywhere earlier it is still refused); `parseInterval` and `transposeSpelling` are exported from `compare.ts`; `checkSong` and `songKeyOfItemId` (rule set `song-chords-v1` runs from `runRecord`); 1.10.0, 2026-09-26, feature 011: rule sets `exercise-theory-v2` (key segments, scale claims, pattern and key-change claims) and `song-chords-v1`, `checkSongChords`, the report's "Replaced by feature 011" table; 1.9.0, 2026-09-24: `renderReport` takes the source manifests, `LEVEL_MINIMUMS`, the CLI's `--check`, T077-T080; 1.0.0 new; 1.0.1 corrected the `\ottava` row; 1.1.0, 2026-09-24: `compareSound`, `describeDifference`, `checkRecord`, `outcomeLabel`, `CheckResult.detail`, the CLI's `main`, Scheme values of layout commands; 1.2.0, 2026-09-24: written bars follow the printed page (§3.2), `measurePosition`, `\tupletSpan`; 1.3.0, 2026-09-24: the converter's marks, §3.3; 1.4.0, 2026-09-24: the constructs of the US1 sources, §3.1, `readLilyPond(source, { score })`; 1.5.0, 2026-09-24: markup text, named voices per staff, moved hairpin ends, the MIDI's playback tempo, T096; 1.6.0, 2026-09-24: `compareMelody` takes `MelodyOptions` and returns `MelodyResult`, `melodyRhythm` differences, `CheckResult.allowed`, T054; 1.7.0, 2026-09-24: `\partcombine` and `#(set-accidental-style ...)` in music, T098; 1.8.0, 2026-09-24: `claimForItem` and `ClaimError`, `TheoryDifference` joins the comparator's `Difference` union as `kind: 'theory'`, the theory check runs from `runRecord`, T073-T074). Dev-time only: nothing here is imported by `src/app`, `src/ui`, `src/engine` or a
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
| `pnpm library:convert-ly <source-id> <item-id>` | Converts the source's `.ly` into the item's `.musicxml` (overwrites it), then prints the MIDI cross-check (§3.4). Refuses when the source is not approved, when the target sidecar says `origin: "authored"` and `--replace` is not given, when the cross-check finds differences, or when the source has no sound file - unless it is our own transcription (`origin: "transcription"`, 1.18.0), which is converted with the read-back check only. | 0 / 1 |

| `pnpm library:orchestra <item-id> [--check]` | Generates the item's Orchestra parts from `content/library/orchestra/<slug>.json` into its MusicXML (idempotent), after checks O1-O5; `--check` writes nothing and exits 1 when the committed file differs (feature 019, 1.14.0). | 0 / 1 |

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
// SectionHand (feature 014): gains `{ kind: 'melody'; level: Level }`, checked by checkMelodyRules instead of note by note
export function checkExercise(xml: string, claim: ExerciseClaim): TheoryDifference[];
// tools/library/fidelity/exercise-claims.ts - the hand-written claim table; throws ClaimError when the title names no known
// exercise, names it in the wrong mode, or does not spell its chords and the description does not state them either
export function claimForItem(item: { itemId: string; title: string; trains: string }): ExerciseClaim;

// tools/library/fidelity/melody-rules.ts - independent melody check (feature 014, research R3-R8; rule set exercise-theory-v3)
// Imports nothing from src/core/library/exercise/ (architecture-test-enforced, as theory.ts); reads the file with the
// theory check's reader; sounding chords are the left hand's notes at each instant, named against the key in force.
export interface MelodyFinding {
  itemId: string;
  bar: number;           // printed bar number
  beat: number;          // 1-based, quarter beats
  rule: MelodyRule;       // data-model.md (014) §5: key, chord-tone, non-chord-tone, minor-degree, augmented-second,
                          // cross-relation, clash, parallel-octaves, register, hand-gap, leap, range, value, shift,
                          // fingering, ending, key-change, variation, static, doubled
  message: string;       // one sentence naming the notes and the chord
}
export interface MelodyCheckInput {
  itemId: string;
  xml: string;           // the generated MusicXML
  level: Level;
  keys: { firstBar: number; key: KeyClaim }[]; // key per bar range, from the claim table / title
}
export function checkMelodyRules(input: MelodyCheckInput): MelodyFinding[];
/** feature 014 FR-008: returns a `variation` finding when every item of one level and group shares one right-hand
 *  degree sequence. */
export function checkMelodyVariation(items: readonly { itemId: string; degrees: string }[]): MelodyFinding[];
/** The right hand's degree sequence of one item for checkMelodyVariation: each melody note's scale degree in the key
 *  in force with its accidental against the natural scale ("♯7"), key segments joined by " | ". */
export function melodyDegrees(input: Omit<MelodyCheckInput, 'level'>): string;

// tools/library/fidelity/sources.ts
export function loadSources(root: string): Map<string, SourceManifest>;       // validates + re-hashes

// tools/library/fidelity/records.ts
export function loadRecords(root: string): AuditRecord[];                     // validates
export function runRecord(record: AuditRecord, ctx: RunContext): CheckResult[];  // the two-step chain for notation + sound
/** feature 014: the theory check plus, from exercise-theory-v3, checkMelodyRules on the claim's melody hand; each melody
 *  finding is a Difference `{ kind: 'melodyRule'; bar; beat; rule; message }`. A melody claim under v1/v2 throws
 *  ClaimError (runTheory reports it as not reproduced). */
export function theoryDifferences(xml: string, claim: ExerciseClaim,
                                  ruleSet: Exclude<TheoryRuleSet, 'song-chords-v1'>): Difference[];
export interface CheckResult { check: Check; differences: Difference[] | TheoryDifference[];
                               allowed: Difference[] /* melody checks: rhythm allowed by departures */; reproduced: boolean;
                               detail: string /* "item vs notation: 0 differences; notation vs sound: 0 differences" */ }
export function checkRecord(record: AuditRecord, results: CheckResult[], ctx: RunContext): string[]; // audit-record.md §2
export function outcomeLabel(record: AuditRecord): string;   // "verified (visual)" for a visual-only record (FR-019)

// tools/library/fidelity/cli.ts
export function main(args: string[], io: { root: string; out: (line: string) => void }): number;  // §1, exit code

// tools/library/fidelity/report.ts
/** audit-record.md §3. `sources` gives each mechanical check's edition and link. Throws when a record is neither on
 *  the shelf nor removed, or a shelf item has no record (coverage is also a test, rule 2.1). */
export function renderReport(records: AuditRecord[], results: Map<string, CheckResult[]>, index: LibraryIndex,
                             sources: Map<string, SourceManifest>): string;
/** FR-022 / feature 005 FR-008: the minimum piece count per level the report compares against. */
export const LEVEL_MINIMUMS: Readonly<Record<Level, number>>;   // beginner 7, intermediate 5, advanced 5
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
| a top-level `\markup` (outside any `\score`, 017 T050) | text only: skipped |
| variable definitions `name = { ... }` / `name = \relative ... { ... }` and references `\name` | expanded |
| `\relative c' { ... }` and absolute mode | LilyPond's relative-octave rule, including "a chord's first note is relative to the previous chord's first note" |
| notes, rests (`r`, `R` full-bar rests, `s` spacers), chords `< >`, durations with dots, durations carried over | as LilyPond defines them |
| `~` ties | merged into one sounding note (spec edge case) |
| `\tuplet n/m { }` and the older `\times m/n { }` | exact rational durations |
| `\grace`, `\acciaccatura`, `\appoggiatura`, `\slashedGrace` | grace notes (no written time), kept apart |
| *Added in 1.16.0 (019 T082):* `\afterGrace main { graces }` | a Nachschlag: the main note, then grace notes at its end (`before` = the main note's end, `bar` = the main note's bar, also when it ends the bar). The form with a fraction (`\afterGrace 3/4 ...`) is an error |
| `\repeat volta n { }` + `\alternative { { } { } }` (the mode may be a string: `\repeat "volta" n`, 017 T049) | bar repeat marks and ending numbers |
| `\repeat unfold n { }` | expanded n times (it is written out in the printed score) |
| *Added in 1.15.0 (019 T081):* `\repeat tremolo n { a b }`, two single notes of one value, neither tied | the reading is the alternation a, b, a, b ... n times, each stroke at its written value (LilyPond's MIDI plays it so); the page prints two notes, each with the whole tremolo's value, joined by tremolo beams (the strokes' beams minus the printed value's own). A one-note tremolo, a chord, a tie, two different values, or a tremolo in grace notes or a `\tuplet` is an error |
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
| `\include` of anything other than `"english.ly"`/`"nederlands.ly"`, any other Scheme expression (in music other than `set-accidental-style`, or at top level other than `set-global-staff-size`/`set-default-paper-size`), `\relative` without a start pitch, `\afterGrace` with a fraction, chord repetition `q`, tremolo `:`, `\repeat percent`, any other `\repeat tremolo` (see 1.15.0 above), `\repeat volta` with more than two passes and alternatives, any other `Timing` property, an end-repeat `\bar` | **unsupported** -> error |

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

Since 1.13.0 (017 T051, Joplin 263 bar 69):

- The reader marks notes between `\hideNotes` and `\unHideNotes` (per voice) as `hidden` (`LyEvent`); the converter
  writes them as `<note print-object="no">` (`WriteNote.printObject: false`), which the app reads as not printed.
- A note value scaled with `*n/m` is written only for a hidden note outside a tuplet, as the plain type of its real
  length (`bes4*1/4` -> an invisible 16th); a visible scaled note still fails (it would print a value it lacks).
- A tie that no later note of its own voice continues is not written: LilyPond prints none ("unterminated tie").

Since 1.15.0 (019 T081, Grieg Op. 46 No. 1 bars 85-86):

- A `\repeat tremolo` is written as its two printed notes: each shows the whole tremolo's value, lasts half of it
  (`<time-modification>` 2:1, the common MusicXML convention) and carries `<tremolo type="start">` /
  `<tremolo type="stop">` with the number of tremolo beams. The app plays the two notes (an ornament whose
  realisation is played-along, `docs/musicxml-support.md`).
- `fromMusicXml` reads such a pair as the alternation of strokes (stroke beams = the printed value's beams plus the
  tremolo marks), so the read-back check of §3.4 compares like with like; a one-note tremolo is read as written.

Since 1.16.0 (019 T082, Grieg Op. 46 No. 1 bars 67-75): the grace notes of an `\afterGrace` are written as plain
`<grace/>` notes right after their main note, in its measure - at the end of the measure when the main note ends it -
and a direction at the time of the next note is written after them, not before them. The app places such a group at
the end of the note before it (`src/core/timeline/grace.ts`: a group with no principal steals from the previous note).

Since 1.17.0 (019 T083): a metronome mark with a dotted beat is written with one `<beat-unit-dot/>` per dot, next to
`<sound tempo>` in quarter notes per minute (dotted quarter = 60 -> 90); only a beat with no MusicXML note type is
dropped and listed.

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

Since 1.18.0 (019 T084): our own transcription of a printed score (`origin: "transcription"`) has no MIDI. Without a
sound file it is converted with the read-back check only, and the command says so; its independent second reading is
the item's audit record, a mechanical check against another transcription of the same print made without seeing the
first (019 research R-15), re-run by `pnpm library:fidelity`. A transcription that does have a sound file is
cross-checked as above; any other source without one is refused.

## 4. Theory check (`tools/library/fidelity/theory.ts`)

- Imports only `tools/library/fidelity/*`, the app's `readXml` (to read the file) and Node built-ins. It must not
  import `src/core/library/exercise/**` or read `content/library/exercises/**`; an architecture test asserts both
  (FR-013).
- Rules: `data-model.md` §5. Output: one `TheoryDifference` per wrong or wrongly spelled chord tone, naming the chord
  index, bar, hand, expected and found (FR-014).
- `checkOrchestra` (feature 019, 1.14.0, `tools/library/fidelity/orchestra.ts`, rule set `orchestra-v1`): rules O1-O5 of
  [019 orchestration-definition.md](../../019-metronome-orchestra-volume/contracts/orchestration-definition.md) section 3.
- Rule set `exercise-theory-v3` (feature 014): a section hand claimed `{ kind: 'melody', level }` is checked by
  `checkMelodyRules` instead; its findings are counted alongside any `TheoryDifference` from the rest of the item.

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
