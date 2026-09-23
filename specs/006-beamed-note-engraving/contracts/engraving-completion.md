# Contract: engraving completion

**Version**: `2.0.0` (MAJOR, 2026-09-23: library mode completes the unbeamed groups of a partly beamed voice, which
changed a shipped file; sung lines are not beamed; see research R-2 B11-B13, R-11). Module `src/core/musicxml/engraving/` (pure core, Node-testable). Research R-2, R-3, R-5, R-8.

## 1. API

```ts
export type EngravingMode = 'library' | 'opened';

export interface ElementInsert { offset: number; text: string; order: number }

export interface EngravingPlan {
  inserts: ElementInsert[];              // sorted by (offset, order)
  beamGroupsAdded: number;
  accidentalsAdded: { required: number; courtesy: number };
  findings: EngravingFinding[];
  invalidBeams: Array<{ part: number; measureLabel: string; voice: string }>;
  contradictions: Array<{ part: number; measureLabel: string; staff: number; pitch: string }>;
}

export function planEngraving(doc: XmlDocument, mode: EngravingMode): EngravingPlan;
export function applyInserts(xml: string, inserts: readonly ElementInsert[]): string;
```

`doc` is the tree from `readXml` (parsed with offsets). Offsets refer to the same decoded string `readXml` got.
Never throws for MusicXML that `buildScore` accepts; an unexpected shape inside one voice leaves that voice
untouched.

## 2. What is inserted

| Element | Text | Where inside `<note>` (R-8) |
|---|---|---|
| Beam | `<beam number="N">begin|continue|end|forward hook|backward hook</beam>`, N ascending | before the first of `notations`, `lyric`, `play`, `listen`; else before `</note>` |
| Accidental | `<accidental>sharp|flat|natural|double-sharp|flat-flat</accidental>` (no attributes = plain) | after the last of `type`, `dot`; else before the first of `time-modification`, `stem`, `notehead`, `notehead-text`, `staff`, `beam`, `notations`, `lyric`, `play`, `listen`; else before `</note>` |

Two inserts at the same offset are ordered accidental (order 0) before beam (order 1), matching the MusicXML
schema sequence. Nothing else is inserted, removed or reformatted.

## 3. Rules

- Beams: in mode `'opened'` only for a (part, voice) with **no** `<beam>` anywhere in the Score; in mode `'library'`
  also the groups of a partly beamed voice whose notes carry no `<beam>` (a library file must be fully beamed); never
  for a voice with lyrics and no `<beam>` (R-2 B13); a voice with inconsistent encoded beams (R-2 B12) is left as
  encoded; grouping per research R-2.
- Accidentals: every written pitch whose line would otherwise read wrong (key signature + earlier accidentals in
  the bar, same staff and octave, ties) gets a required accidental; courtesy accidentals per R-3.6, in mode
  `'library'` always and in mode `'opened'` only for parts that print no `<accidental>` at all.
- Existing `<beam>` and `<accidental>` elements are never changed (FR-004, FR-009).

## 4. Guarantees checked by tests

1. Deterministic: the same input gives byte-identical output.
2. Idempotent: planning the completed text gives zero inserts.
3. Identity: `buildScore(readXml(completed))` has the same Note IDs, onsets, durations and keys as for the original.
4. With real Verovio, the completed *Für Elise (theme)* renders beams (`g.beam`) and visible accidentals, and no
   `<note>` in it keeps a `g.flag` where a beam group applies.
5. Every library file: `planEngraving(doc, 'library').inserts.length === 0` (FR-012 guard).

## 5. Related contract changes

- `render-copy.md` 1.1.0 (feature 001): `createRenderCopy` also takes `elements: ElementInsert[]`, spliced in the
  same single pass as the id inserts. Id inserts touch start tags only; element inserts sit strictly inside note
  bodies, so they never overlap.
- `worker-messages.md` 1.1.0 (feature 001): load notice codes `engravingCompleted`, `beamDataInvalid`,
  `accidentalContradicts` (warning), `engravingSkipped` (warning: completion threw, the Score opens without it);
  `summary.arranger`.

## 6. Versioning

MINOR: new optional behaviour or insert kinds. MAJOR: changing what is inserted for an unchanged input (it changes
shipped library files and render copies).
