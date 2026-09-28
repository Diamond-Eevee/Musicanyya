# Contract change: audit records 1.2.0 -> 1.3.0, fidelity tools 1.11.0 -> 1.12.0

**Changes**: `specs/007-library-fidelity-audit/contracts/audit-record.md` and `fidelity-tools.md` (canonical; folded
in by the first fidelity task of feature 014, then kept here as history).

**Kind**: MINOR. Every 1.2.0 record stays valid and re-runs unchanged.

## 1. Audit record: rule set `exercise-theory-v3`

`THEORY_RULE_SETS` gains `exercise-theory-v3`. A record with it runs everything `exercise-theory-v2` runs, except that
a section hand claimed as `{ "kind": "melody", "level": <level> }` is checked by `checkMelodyRules` (below) instead of
note by note. Its `expectedDifferences` counts findings of both. Records of the 59 rewritten items (spec Background)
use v3; no other record changes.

## 2. Theory claims (`tools/library/fidelity/theory.ts`)

`SectionHand` gains `{ kind: 'melody'; level: Level }`. The claim table (`exercise-claims.ts`) states it for the right
hand of every key-change and drill claim; the left hand's chord claims are unchanged. The claim table still reads
nothing from the definitions or the generator.

## 3. `checkMelodyRules` (new, `tools/library/fidelity/melody-rules.ts`)

```ts
export interface MelodyFinding {
  itemId: string;
  bar: number;           // printed bar number
  beat: number;          // 1-based, quarter beats
  rule: MelodyRule;      // data-model.md §5
  message: string;       // one sentence naming the notes and the chord
}
export interface MelodyCheckInput {
  itemId: string;
  xml: string;           // the generated MusicXML
  level: Level;
  keys: { firstBar: number; key: KeyClaim }[]; // key per bar range, from the claim table / title
}
export function checkMelodyRules(input: MelodyCheckInput): MelodyFinding[];
/** FR-008 across a family: returns a `variation` finding when every item of one level and group has the same
 *  right-hand degree sequence. */
export function checkMelodyVariation(items: readonly { itemId: string; degrees: string }[]): MelodyFinding[];
```

Reads the file with the theory check's reader; sounding chords are the left hand's notes at each instant, named
against the key in force. Imports nothing from `src/core/library/exercise/` (test-enforced). Thresholds come from
`MELODY_LADDER` (`src/core/defaults.ts`).
