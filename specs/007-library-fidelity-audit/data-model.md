# Data model: Library Fidelity Audit

Feature 007. Everything here is **dev-time data and tooling**: nothing is read by the running app except the
library sidecars, which gain one optional field (§6). Musical time is exact: onsets and durations are rational
numbers of quarter notes (§1), never floats and never seconds, so a comparison can report "no difference" and mean
it.

## 1. Exact musical time

| Name | Shape | Rule |
|---|---|---|
| `QuarterTime` | `{ num: number; den: number }` | A non-negative rational number of quarter notes, always reduced (`gcd(num, den) = 1`, `den > 0`). Built from integer ticks as `ticks / ppq`. Compared by cross-multiplication, never by division. |

Sources use different resolutions (Mutopia MIDI: the file's own `division`, usually 384; the app's Score: its own
PPQ). Both convert losslessly to `QuarterTime`, so a triplet eighth is `1/3` in both and never "off by one tick".

## 2. Reference score (the normalised form every reading produces)

One neutral shape, so the comparator (§4) never knows where the notes came from. Three readers produce it:

| Reader | Input | Produces | Knows about |
|---|---|---|---|
| `fromMusicXml` | a library item (`readXml` + `buildScore`, the app's own pipeline) | full | bars, repeats, endings, spelling, grace notes, staves, voices |
| `fromMidi` | a Standard MIDI File (format 0 or 1) | sounding notes only | pitch, onset, duration, track/channel; **no** bars, spelling or repeats |
| `fromLilyPond` | a Mutopia `.ly` file (the subset in `contracts/fidelity-tools.md` §3) | full | as MusicXML |

```ts
interface ReferenceScore {
  origin: 'musicxml' | 'midi' | 'lilypond';
  /** Written bars in written order. Empty for a MIDI reading. */
  bars: ReferenceBar[];
  /** Every sounding note in written order (repeats NOT unfolded). */
  notes: ReferenceNote[];
  /** Grace notes, kept apart: they take no written time (spec edge case "grace notes"). */
  graceNotes: ReferenceGraceNote[];
}

interface ReferenceBar {
  index: number;            // 0-based written bar; a pickup is bar 0 and is numbered 0 in reports
  number: string;           // the printed bar number shown to people ("0" for the pickup, then "1", "2", ...)
  start: QuarterTime;       // written onset of the bar from the start of the piece
  length: QuarterTime;      // actual length (a pickup or short first-ending bar is shorter than the metre)
  repeatStart: boolean;
  repeatEnd: boolean;       // with `times` when a repeat is played more than twice
  repeatTimes?: number;
  endings: number[];        // volta numbers this bar belongs to, e.g. [1] or [2]; [] outside an ending
}

interface ReferenceNote {
  bar: number;              // ReferenceBar.index; for MIDI: -1 until aligned (§4.2)
  onset: QuarterTime;       // from the start of the piece, written order
  duration: QuarterTime;    // tied notes are ONE note: the sum of the tied values (spec edge case)
  midi: number;             // SOUNDING pitch (an 8va passage sounds an octave up; spec edge case)
  spelling?: { step: 'A'|'B'|'C'|'D'|'E'|'F'|'G'; alter: -2|-1|0|1|2; octave: number }; // absent for MIDI
  staff?: number;           // 1 = upper, 2 = lower; absent for MIDI
  voice?: string;
}

interface ReferenceGraceNote {
  bar: number;
  before: QuarterTime;      // onset of the principal note it precedes
  midi: number;
  spelling?: ReferenceNote['spelling'];
}
```

**Validation** (each reader, before returning): notes sorted by `(onset, midi)`; no duplicate `(onset, midi)` pair
unless the source really doubles a note in two voices (then both are kept and the comparator counts them); every
`duration > 0`; bar starts strictly increasing; for MusicXML and LilyPond, every note lies inside its bar.

## 3. Sources

```ts
interface SourceManifest {             // content/library/sources/<source-id>/source.json (contract source-manifest.md)
  version: 1;
  id: string;                          // e.g. "mutopia-468-chopin-op28-no4"
  work: string;                        // "Chopin, Prelude in E minor, Op. 28 No. 4"
  edition: string;                     // the printed edition the source was made from, e.g. "Peters, 1879"
  publisher: string;                   // "The Mutopia Project"
  url: string;                         // the piece page someone else can open
  identifier?: string;                 // e.g. "Mutopia-2016/10/28-468"
  licence: 'public-domain' | 'CC0-1.0';
  credit?: string;
  obtained: string;                    // YYYY-MM-DD
  files: SourceFile[];
  approvedByOwner: string;             // YYYY-MM-DD the owner approved this source (spec assumption; AGENTS 6)
}

interface SourceFile {
  role: 'notation' | 'sound' | 'scan';  // .ly/.musicxml | .mid | .pdf (scans are NOT committed, see research R1)
  path?: string;                        // relative to the source folder; absent for an uncommitted scan
  url: string;                          // where the file itself was downloaded from
  sha256?: string;                      // required when `path` is present; the fidelity test re-hashes it
  format: 'lilypond' | 'midi' | 'musicxml' | 'pdf';
  midiOrder?: 'written' | 'played';     // for role "sound": did the source unfold repeats? (research R5)
  midiNoteTracks?: number[];            // for role "sound": the tracks that carry the music (others ignored)
}
```

**Validation**: `licence` is only `public-domain` or `CC0-1.0` (FR-006); a Creative Commons licence with any other
term (BY, SA, NC) fails - this is what rejects Mutopia 659 (research R11); every committed file's hash matches;
`approvedByOwner` is present before any item may cite the source.

## 4. Comparison

### 4.1 Aspects

A comparison checks a chosen set of **aspects**; the record names them, so "verified" always says what was
verified.

| Aspect | Needs | Catches (FR-017 planted error) |
|---|---|---|
| `barCount` | bars on both sides | a missing or extra bar |
| `barLengths` | bars on both sides | a short or long bar, a lost pickup |
| `repeats` | bars on both sides | a missing repeat, a wrong or missing ending |
| `playedOrder` | bars + notes on the item side; bars + notes, or a `played` MIDI, on the source side | a repeat that goes back to the wrong bar |
| `pitch` | notes | one changed pitch |
| `onset` | notes | a shifted note |
| `duration` | notes | one changed duration |
| `spelling` | spelling on both sides | E-flat written as D-sharp |
| `graceNotes` | grace notes on both sides | a missing or wrong grace note |
| `melody` | a melody line on both sides (§4.4) | one wrong note in a quoted tune |

### 4.1a The two-step chain for a source with notation and sound

A mechanical check whose `sourceFiles` are `["notation", "sound"]` runs **two** comparisons, and both must give
the recorded result:

1. **item vs notation reading** (`fromMusicXml` vs `fromLilyPond`): every aspect the record names, including bars,
   repeats, spelling and grace notes.
2. **notation reading vs sound** (`fromLilyPond` vs `fromMidi`): `pitch`, `onset` and `duration` of every
   non-grace note, in written order (or played order when the MIDI unfolds repeats). This step shows our LilyPond
   reader read the source correctly, independently of that reader: the MIDI was written by LilyPond itself.

LilyPond's MIDI behaviour is part of step 2's rules, not a per-source exception (research R5):

- a note directly before a grace group sounds shorter by the grace time;
- a note with an articulation may sound shorter;
- ornaments sound as the main note;
- arpeggio signs are not rolled.

A MIDI note shorter than written is accepted **only** where the notation reading shows one of these causes. Any
other difference counts.

A source with sound only (no notation file) runs step 1 against `fromMidi`, with bars from the record's alignment
and without the `spelling`, `repeats` or `graceNotes` aspects. The report says which aspects were not possible.

### 4.2 Alignment

The item and the source may start at different offsets (a MIDI file starts at 0 even with a pickup; an excerpt
starts mid-piece). An alignment is **declared in the audit record**, never searched for: `sourceBars` (inclusive
range in the source's bar numbering) maps onto `itemBars`, and the onset offset follows from those bars' starts. For
a MIDI source, bars are assigned from the paired notation reading of the same source (`fromLilyPond`), or, when
there is none, by an explicit `barLength` + `pickup` in the record. A search would find a "best" match and hide the
difference the audit exists to report.

### 4.3 Differences

```ts
type Difference =
  | { kind: 'missing'; bar: string; note: NoteRef }                 // in the source, not in the item
  | { kind: 'extra'; bar: string; note: NoteRef }                   // in the item, not in the source
  | { kind: 'pitch'; bar: string; at: QuarterTime; item: number; source: number }
  | { kind: 'duration'; bar: string; at: QuarterTime; midi: number; item: QuarterTime; source: QuarterTime }
  | { kind: 'spelling'; bar: string; at: QuarterTime; item: string; source: string }
  | { kind: 'barCount'; item: number; source: number }
  | { kind: 'barLength'; bar: string; item: QuarterTime; source: QuarterTime }
  | { kind: 'repeat'; bar: string; item: string; source: string }  // e.g. "repeat end" vs "none"
  | { kind: 'playedOrder'; position: number; item: string; source: string }
  | { kind: 'grace'; bar: string; detail: string }
  | { kind: 'melody'; bar: string; index: number; item: string; source: string };

interface NoteRef { at: QuarterTime; midi: number; name: string }   // name = "E5", "D#5"
```

Matching rule: within one bar, notes are matched on `(onset, midi)` exactly. An unmatched pair at the same onset in
the same staff with different pitch is reported once as `pitch` (not as a `missing` + `extra` pair), so one planted
wrong note produces exactly one difference that names its bar (FR-014, SC-004). Differences are sorted by bar, then
onset, so a re-run gives identical output (FR-016).

### 4.4 Melody (arrangements, US2)

A **melody line** is the highest sounding note at each onset of the named staff (default: staff 1), with ties
merged, over a declared bar range. The quote check compares the ordered list of pitches (FR-011: "melodic pitch
and order"). It compares onsets and durations too, unless the item's `departures` (§6) names a rhythmic departure
for that range, in which case rhythm differences are reported as `allowedByDeparture` and do not count. The source
melody comes from a named voice/staff of the source (e.g. the soprano of an SATB hymn).

## 5. Theory rule set (exercises, US3)

The **independent** check (FR-013) does not import anything from `src/core/library/exercise/` (enforced by an
architecture test, research R8). It derives the expected chords from what the exercise *says*, not from the
generator's degree tables.

```ts
interface ExerciseClaim {           // read from the title, the key signature/mode and the claim table (below)
  itemId: string;
  key: { tonicLetter: Letter; tonicAlter: -1|0|1; mode: 'major'|'minor' };
  chords: ChordClaim[];             // in order, one per sounded chord event
}
interface ChordClaim {
  roman: string;                    // "I", "ii", "V", "i", "iv", "V" (major V in minor), "vi" ...
  quality: 'major'|'minor'|'diminished'|'augmented';
  inversion: 0|1|2;
  hands: ('left'|'right')[];
}
```

**Claim table** (`tools/library/fidelity/exercise-claims.ts`): for each exercise family, the Roman-numeral sequence
its **title** names (e.g. `"I-IV-V-I"`), and for the chord-type families the sequence their `trains` text states
(`"i, iv, the harmonic-minor major V and the three shapes of the tonic"`). It is written by hand from the titles and
descriptions, and is reviewed against them (the review is recorded). It does not read `content/library/exercises/`.

**Rules the check computes itself**:

| Rule | Definition |
|---|---|
| Scale | Major: letters from the tonic, semitone pattern 2-2-1-2-2-2-1. Minor: natural minor 2-1-2-2-1-2-2; the dominant chord in a minor key raises the 7th degree (harmonic minor) where the claim says major `V`. |
| Root | Degree N = the Nth letter from the tonic letter, with the alteration that gives the scale's semitone distance. |
| Third / fifth | The letters two and four steps above the root (letter arithmetic, never pitch-class arithmetic), altered to give the claimed quality: major = 4 + 3 semitones, minor = 3 + 4, diminished = 3 + 3, augmented = 4 + 4. |
| Spelling | Every written note's `(step, alter)` equals the derived tone's letter and alteration. So B-flat minor's iv is E-flat, G-flat, B-flat and never D-sharp, F-sharp, A-sharp; G-sharp minor's V is D-sharp, F-double-sharp, A-sharp. |
| Inversion | The lowest sounding note of the chord **in each hand** is the root (0), third (1) or fifth (2). Where the hands are claimed to play different shapes, the claim table gives each hand's inversion. The chord as a whole is named by its lowest note across both staves. |
| Minor-key degrees | i and iv use the key's natural 3rd and 6th. V is major, with the raised leading tone (B-flat minor V = F, A natural, C). A minor `v` where the claim says `V` is an error. In a minor ii-V-i, ii is diminished. |
| Progression names | Each title's name maps to one sequence in the claim table: perfect cadence = V-I with both chords in root position; plagal = IV-I; minor cadence = iv-V-i; same-tonic = parallel major/minor on one tonic. An ambiguous name ("turnaround") takes its sequence from the item's own description. If the description does not state it, that is a finding: the description is corrected at its origin, the exercise definition (FR-015). |
| Octave | Written octave is compared with the letter: C-flat 4 sounds as MIDI 59, B-sharp 3 as MIDI 60. A tone respelled to another letter with the same MIDI number (G for F-double-sharp) is a spelling error. |
| Completeness | Each hand's chord holds exactly the claimed tones (a triad voicing: all three; other voicings as the claim table states). |
| Key signature | The file's `<key><fifths>` equals the signature of the named key (derived from the letter/alteration of the tonic by the circle of fifths), and `<mode>` equals the named mode. |
| Labels | Where a chord carries a `<words>` label, it names the same root and quality ("Am", "F#", "Bb", "G#m"). |

**Result**: `TheoryDifference = { chordIndex; bar; hand; expected: string; found: string; rule }` - the chord and
the rule are named (FR-014).

## 6. Library item metadata (sidecar) - one additive change

Contract `specs/005-practice-score-library/contracts/library-index.md` goes from **1.0.0 to 1.1.0** (MINOR, additive):

| Field | Type | Rule |
|---|---|---|
| `departures` (new, optional) | `string[]`, 1-8 entries, each <= 200 characters | **Required when `arrangement: true`** (FR-010). One entry per deliberate departure, in musician's words and naming the bars ("Bars 2-16 are our own continuation, not Beethoven's"; "Metre renotated from 3/8 to 3/4, all note values doubled"). Forbidden when `arrangement` is false. |
| `reviewedBy` (meaning tightened) | string | Must equal the `checkedBy` of the item's audit record, and `reviewedOn` its `date` (FR-018, SC-006). A plausibility review can no longer be recorded here because the record must name a source or the theory check. |

The index generator copies `departures` verbatim; `index-model.ts` accepts and validates it. The app does **not**
display it in this feature (UI changes are out of scope); the title/subtitle already mark every arrangement, and
where a departure matters while playing it also goes in `limitations`, which the Score source panel shows. Whether
to show `departures` in the app is recorded as a follow-up for the owner (plan, Open questions).

## 7. Audit record and report

```ts
interface AuditRecord {                  // content/library/audit/<item-id>.json (contract audit-record.md)
  version: 1;
  itemId: string;                        // e.g. "repertoire/advanced/chopin-prelude-op28-no4" - FR-020
  claim: 'original' | 'excerpt' | 'arrangement' | 'exercise';
  claimText: string;                     // what the item says it is, quoted from title/subtitle
  checks: Check[];                       // at least one
  outcome: 'verified' | 'fixed' | 'replaced' | 'relabelled' | 'removed';   // FR-002
  outcomeNote: string;                   // what was done and why, one or two sentences
  checkedBy: string;                     // agent id or person
  date: string;                          // YYYY-MM-DD
  previous?: { title: string; level: Level; bars: number; notes: number };  // when the item changed
}

type Check =
  | { method: 'mechanical'; source: string /* SourceManifest.id */; sourceFiles: ('notation'|'sound')[];
      aspects: Aspect[]; alignment: Alignment; expectedDifferences: number; differenceNotes?: string[] }
  | { method: 'theory'; ruleSet: 'exercise-theory-v1'; expectedDifferences: 0 }
  | { method: 'visual'; source: string; bars: string /* "1-16" */; result: string; differences: string[] };

interface Alignment {
  itemBars: string; sourceBars: string;           // "1-8" or "all"
  staff?: number; voice?: string;                 // item side
  sourceStaff?: number; sourceVoice?: string;     // source side (e.g. the soprano of an SATB hymn)
  transpose?: string;                             // melody checks: "-M2" = source D major -> item C major
}
```

**Rules**

- `expectedDifferences` is what the comparison must reproduce on every re-run (FR-016, SC-003). A verified or
  replaced item has 0 for every mechanical check over the bars it claims to quote. A non-zero value is allowed only
  with one `differenceNotes` entry per difference, and only for an arrangement's declared departures or an
  edition disagreement settled by a second source (spec edge case).
- A `visual` check can never make an item `verified` on its own claim of "mechanically verified" (FR-019): the
  report prints its method as **visual** and lists the bars.
- A `removed` item's record stays (the item id is gone from the shelf); the report lists it, and
  `public/library/README.md`'s Rejected items table carries the reason (FR-009).

**Report** (`docs/library-audit.md`, generated by `pnpm library:fidelity`, contract audit-record.md §3): one row per
item in shelf order, then the removed items, then the level counts after the audit against the minimums (Beginner 7,
Intermediate 5, Advanced 5) and any gap (FR-022, SC-008). Each row: item, claim, source (edition + link), method,
aspects, differences, outcome, date. Generated, never hand-edited; a test fails if it is stale.

## 8. Audit state per item

```text
unaudited --compare--> differences found --replace from source--> replaced --compare = 0--> (done)
    |                         |---fix at origin (exercises)--> fixed --compare = 0--> (done)
    |                         |---relabel claims------------> relabelled --compare quoted bars = 0--> (done)
    |                         `---no licence-compliant source--> removed (README rejected-items row) --> (done)
    `--compare = 0--> verified --> (done)
```

`(done)` requires: an audit record with its outcome; the sidecar's `reviewedBy`/`reviewedOn` equal to the record;
the library gates green (licence, level, sweep, engraving guard, identity golden) - FR-021.

## 9. Named values

No new runtime constants (nothing is added to `src/core/defaults.ts` or `src/engine/config.ts`). The comparator
has **no tolerances**: exact rational equality is the only match. Which MIDI tracks carry the music is not guessed
either: it is `midiNoteTracks` in the source manifest (§3).
