# Contract change: library item metadata 1.0.0 -> 1.1.0

**Changes**: `specs/005-practice-score-library/contracts/library-index.md` (the canonical contract; this file is
the change request, folded into it by the first implementation task and then kept here as history). Applied on 2026-09-23.

**Kind**: MINOR (additive). An index written by 1.0.0 tools still validates; `index.json` `version` stays `1`.

## 1. New optional field `departures`

Added to §1 (authored item metadata) `properties`:

```json
"departures": {
  "type": "array",
  "items": { "type": "string", "minLength": 1, "maxLength": 200 },
  "minItems": 1,
  "maxItems": 8,
  "description": "each deliberate departure of an arrangement from the original, in musician's words, naming the bars"
}
```

Rules added to §1 "Rules":

- `arrangement: true` **requires** `departures` (FR-010). `arrangement: false` (or absent) **forbids** it.
- `departures` never describes added material as the composer's (FR-012); it says whose it is ("our own
  continuation").
- `src/core/library/index-model.ts` accepts the field, validates length and type, and copies it into the item's
  `meta`. The app does not display it in this feature (spec: UI changes out of scope).

## 2. `reviewedBy` / `reviewedOn` meaning tightened

Old: "who checked the music itself - a person or an agent id".
New: "who ran the item's fidelity audit (`content/library/audit/<item-id>.json` `checkedBy`), on `reviewedOn` =
that record's `date`. It names a check against a source or the exercise theory rules; a review with nothing to
compare against is not recorded here (FR-018)." Enforced by `tests/library/fidelity.test.ts`, not by the index
validator (the app never needs it).

## 3. Rejected items table

`public/library/README.md` "Rejected items" gains rows for items this feature removes, format unchanged:
`| <item id> (<title>) | <reason, source searched, date> |`.
