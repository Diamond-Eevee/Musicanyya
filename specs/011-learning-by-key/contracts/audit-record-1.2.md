# Contract change: audit records 1.1.0 -> 1.2.0

**Changes**: `specs/007-library-fidelity-audit/contracts/audit-record.md` (canonical; folded in by the first fidelity
task of feature 011, then kept as history). Also bumps `fidelity-tools.md` to 1.10.0 (new claims, `checkSongChords`).

**Kind**: MINOR. Every 1.1.0 record stays valid and re-runs unchanged.

## 1. Schema additions

- `theory` check: `ruleSet` becomes `{ "enum": ["exercise-theory-v1", "exercise-theory-v2", "song-chords-v1"] }`.
  - `exercise-theory-v2`: v1 plus key segments (a key per bar range, for key-change items), scale claims per section and
    hand (major, harmonic, melodic with direction), broken-chord and root-fifth voicings. Claims come from the title
    (`{key} - introduction|beginner|intermediate|advanced`, `{from} to {to} - introduction|beginner|intermediate`).
  - `song-chords-v1`: reads the shelf key from the file, every words-direction chord name above staff 1, and every
    staff-2 chord; each chord's notes must be exactly the triad its name spells (letters and alterations), and each name
    must be in the allowed set of the item's level (research R9). `expectedDifferences` stays `const 0`.
- `previous.level` enum gains `introduction`.
- New optional top-level `supersedes`: `{ "type": "array", "items": { "type": "string" }, "minItems": 1 }` - old item ids
  whose records were retired because this item replaced them (research R12). Must equal the sidecar's
  `supersedes[].id` set.

## 2. Rule changes

- Rule 7 ("ids are never renamed by this feature") is scoped to feature 007. Feature 011 moves records with their items:
  a moved record keeps its checks and outcome and changes only `itemId`; the file moves to the new path.
- Rule 4 (claims): `claim: "arrangement"` for songs requires `arrangement: true`, non-empty `departures`, one
  `mechanical` check with aspect `melody`, and one `song-chords-v1` check.
- Coverage (rule 1) is unchanged: records = shelf ids + removed ids. Superseded ids are neither; they appear only in
  `supersedes`, and the report lists them under a new "Replaced by feature 011" table (old id -> new id).

## 3. Report

`docs/library-audit.md` gains the "Replaced by feature 011" table after "Removed"; the Learning table groups rows by
key folder then key-change folder, in shelf order; songs appear in the Learning table with Claim = arrangement, Source =
the Mutopia edition, Method = mechanical + theory.
