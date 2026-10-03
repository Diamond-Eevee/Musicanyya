# Change request: library index 1.4.2 -> 1.5.0 (MINOR)

**Canonical contract**: [specs/005-practice-score-library/contracts/library-index.md](../../005-practice-score-library/contracts/library-index.md)
(fold this in, bump its version line). **Feature**: 022, 2026-10-03.

## Changes

1. **Authored metadata**: optional `simplifies: string` - the id of the item this one is a simplified version of.
   Validated by `tools/library/build-index.ts`: the target exists, is in the same section, and has a higher level;
   otherwise the build fails. `src/core/library/index-model.ts` ignores it (not copied into the app model).
2. **Skill tags** (`SKILL_TAGS`, `src/core/library/types.ts`): add `note-values`, `rests`, `articulation`,
   `time-signatures`, `reading`, `inversions`, `seventh-chords`; English labels in `src/ui/i18n/en.ts`.
3. **Facts**: `hasPickup: boolean` (first measure implicit and shorter than the metre), `hasDottedRhythm: boolean`
   (a dotted value shorter than a dotted half in a simple metre, grace notes excluded), `hasShortNotes: boolean` (a
   value shorter than a quarter, not counting the eighth completing a dotted-quarter beat in a simple metre, nor
   eighths in a compound metre) - 022 data-model §1. Optional for readers (older index).
4. **Level check** (data-model §4 of 005, criteria): criteria 5, 6, 8-13, 20-25 retired; criterion 29 "one focus"
   (Introduction only) added - text in [022 data-model.md](../data-model.md) §1. `levelCheck.failed` may now list `29`
   and no longer lists retired ids.
5. **Sections**: `basics` (order 1) top-level; `learning` order 2, `repertoire` order 3; `learning/chord-lessons` with
   three children (022 data-model §2). Sibling `order` values stay unique.
6. **`stepOrder` maximum 999** (was 99; found in implement, task T074): the Basics lessons are ordered 10, 20, ... 240
   (022 data-model §4), and transposed chord lessons add their index. Readers accept `0..999`; a value outside still
   skips the item.

## Compatibility

Additive for the app: an index without the new fields reads as before. An item with a new tag is skipped by an older
app (existing rule) - acceptable, the index and the app ship together.
