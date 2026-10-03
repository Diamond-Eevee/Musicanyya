# Library Audit Records

This directory contains the audit records for the Musicanyya library. There is one record per shelf item, plus records for removed items. 
The records are authored; the final report (`docs/library-audit.md`) is generated from them.

## Audit Record Contract

The records adhere to the schema and rules defined in the [audit-record contract](../../specs/007-library-fidelity-audit/contracts/audit-record.md).

## Theory rule sets

A `theory` check names the independent rule set that re-reads the finished MusicXML (never the definition or the
builder that wrote it). Full rules: audit-record contract §2.

| Rule set | Used for | Since |
|---|---|---|
| `exercise-theory-v1`, `-v2`, `-v3` | generated exercises (keys, key changes, chord drills; v3 checks a melody hand by its rules) | 007, 011, 014 |
| `song-chords-v1` | songs with left-hand block chords: each chord spells its printed name, every name allowed at the level | 011 |
| `orchestra-v1` | an item's Orchestra parts against its orchestration definition | 019 |
| `lesson-claims-v1` | Basics lessons: explanation above bar 1, single pitch when claimed, nothing used before a lesson introduces it, ties and slurs written correctly; the check carries `claims` and `teachingOrder` | 022 |
| `chord-lessons-v1` | chord lessons: the sounding notes spell each named chord, the right bass, claimed common tones kept, no stray notes; optional `claims` (`commonTones`, `omit`) | 022 |
| `song-chords-v2` | songs built with song definition 1.2.0: as v1, with a moving left hand (waltz, repeated, broken) read by the chord names, chord changes per bar, Beginner minor `i, iv, v, V, VII` | 022 |

## Outcomes

Each record specifies an outcome, which means:

- **`verified`**: The item matches the source (or theory rules) exactly as claimed, with no modifications required, or with visual confirmation.
- **`fixed`**: The item was updated to correct a mistake found during the audit (e.g., a wrong note fixed against the source).
- **`replaced`**: The item was replaced entirely by a direct conversion from a verified machine-readable source.
- **`relabelled`**: The item's claims were changed to be accurate (e.g., marked as an arrangement, adding departures, changing title), but the notes themselves were not modified.
- **`removed`**: The item was removed from the library because it could not be verified against a valid public-domain source or violated licensing constraints.
