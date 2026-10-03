# Change request: audit record 1.4.0 -> 1.5.0 (MINOR)

**Canonical contract**: [specs/007-library-fidelity-audit/contracts/audit-record.md](../../007-library-fidelity-audit/contracts/audit-record.md)
(fold this in). **Feature**: 022, 2026-10-03.

Three new theory rule sets. Each reads only the finished MusicXML (and the claim recorded in the audit record),
never the definition or the builder (independence, like `theory.ts` and `song-chords.ts`).

## `lesson-claims-v1` (Basics; `tools/library/fidelity/lesson-claims.ts`)

The record's check carries `claims: { introduces: string[], singlePitch?: boolean, practice?: boolean }` and `teachingOrder: number`
(the lesson's `stepOrder`). Differences reported:

1. `explanation-missing` - no `<words>` direction above staff 1 in bar 1 (pickup bar or bar 1).
2. `not-single-pitch` - `singlePitch` claimed and more than one sounding pitch.
3. `not-introduced` - a notation feature (a staff holding only whole-bar rests, with its clef, is not counted;
   neither are tempo marks, key signatures or the explanation) (lesson-definition §3 ids, detected from the MusicXML) that neither this
   lesson nor an earlier Basics lesson introduces; the check reads the other Basics records for the earlier ones.
4. `tie-pitch` - a tie between different pitches; `slur-same-pitch` - a slur between two equal adjacent pitches only.

## `chord-lessons-v1` (`tools/library/fidelity/chord-lessons.ts`)

Name grammar: research R4. At each chord symbol until the next (or the end):

1. `chord-tones` - the pitch classes struck at the symbol's onset across both staves are not exactly the named
   chord's (letter arithmetic; `omit` in the claim honoured for named chords only).
2. `bass` - the lowest note is not the slash bass (or the root without a slash).
3. `common-tone` - a claimed common tone (`claims.commonTones`) is not held or re-struck on the same key.
4. `stray-note` - a note under the symbol's span that is not a chord tone.

## `song-chords-v2` (`tools/library/fidelity/song-chords.ts`, option `ruleSet`)

As v1, plus: left-hand notes are grouped by the chord name above them (not by attack), so `waltz`, `repeated` and
`broken` patterns are checked note by note; the per-bar limit counts chord **changes**; the Beginner minor set is
`i, iv, v, V, VII` (research R8).

## Records

Every 022 item has a record (data-model §10), `outcome: "verified"`, `expectedDifferences: 0`.
`pnpm library:fidelity` regenerates `docs/library-audit.md`.
