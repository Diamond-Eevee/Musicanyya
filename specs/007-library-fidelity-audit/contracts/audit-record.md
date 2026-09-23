# Contract: audit records and the audit report

**Version**: `1.0.0` - new.

**Owner**: `tools/library/fidelity/records.ts` (reads, validates, re-runs), `tools/library/fidelity/report.ts`
(writes the report). **Location**: records at `content/library/audit/<item-id>.json` (the item id's slashes are
folders, e.g. `content/library/audit/repertoire/advanced/chopin-prelude-op28-no4.json`); report at
`docs/library-audit.md`.

## 1. Audit record schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Musicanyya library audit record v1",
  "type": "object",
  "required": ["version", "itemId", "claim", "claimText", "checks", "outcome", "outcomeNote", "checkedBy", "date"],
  "additionalProperties": false,
  "properties": {
    "version":   { "const": 1 },
    "itemId":    { "type": "string", "pattern": "^[a-z0-9-]+(/[a-z0-9-]+)*$" },
    "claim":     { "enum": ["original", "excerpt", "arrangement", "exercise"] },
    "claimText": { "type": "string", "maxLength": 400 },
    "checks":    { "type": "array", "minItems": 1, "items": { "$ref": "#/$defs/check" } },
    "outcome":   { "enum": ["verified", "fixed", "replaced", "relabelled", "removed"] },
    "outcomeNote": { "type": "string", "maxLength": 600 },
    "checkedBy": { "type": "string" },
    "date":      { "type": "string", "format": "date" },
    "previous":  {
      "type": "object", "additionalProperties": false,
      "required": ["title", "level", "bars", "notes"],
      "properties": {
        "title": { "type": "string" }, "level": { "enum": ["beginner", "intermediate", "advanced"] },
        "bars": { "type": "integer" }, "notes": { "type": "integer" }
      }
    }
  },
  "$defs": {
    "aspect": { "enum": ["barCount", "barLengths", "repeats", "playedOrder", "pitch", "onset", "duration",
                         "spelling", "graceNotes", "melody"] },
    "check": {
      "oneOf": [
        {
          "type": "object", "additionalProperties": false,
          "required": ["method", "source", "sourceFiles", "aspects", "alignment", "expectedDifferences"],
          "properties": {
            "method": { "const": "mechanical" },
            "source": { "type": "string", "description": "a source-manifest id" },
            "sourceFiles": { "type": "array", "items": { "enum": ["notation", "sound"] }, "minItems": 1 },
            "aspects": { "type": "array", "items": { "$ref": "#/$defs/aspect" }, "minItems": 1 },
            "alignment": {
              "type": "object", "additionalProperties": false, "required": ["itemBars", "sourceBars"],
              "properties": {
                "itemBars": { "type": "string", "pattern": "^\\d+-\\d+$|^all$" },
                "sourceBars": { "type": "string", "pattern": "^\\d+-\\d+$|^all$" },
                "staff": { "type": "integer", "minimum": 1 },
                "voice": { "type": "string" },
                "sourceStaff": { "type": "integer", "minimum": 1 },
                "sourceVoice": { "type": "string" },
                "transpose": { "type": "string", "pattern": "^[+-](P1|m2|M2|m3|M3|P4|A4|d5|P5|m6|M6|m7|M7|P8)$",
                               "description": "melody checks only: the declared transposition from source to item, e.g. \"-M2\" for D major -> C major; applied to letters and alterations, so spelling is transposed too" }
              }
            },
            "expectedDifferences": { "type": "integer", "minimum": 0 },
            "differenceNotes": { "type": "array", "items": { "type": "string", "maxLength": 300 } }
          }
        },
        {
          "type": "object", "additionalProperties": false,
          "required": ["method", "ruleSet", "expectedDifferences"],
          "properties": {
            "method": { "const": "theory" },
            "ruleSet": { "const": "exercise-theory-v1" },
            "expectedDifferences": { "const": 0 }
          }
        },
        {
          "type": "object", "additionalProperties": false,
          "required": ["method", "source", "bars", "result", "differences"],
          "properties": {
            "method": { "const": "visual" },
            "source": { "type": "string" },
            "bars": { "type": "string" },
            "result": { "type": "string", "maxLength": 400 },
            "differences": { "type": "array", "items": { "type": "string", "maxLength": 300 } }
          }
        }
      ]
    }
  }
}
```

## 2. Rules (enforced by `tests/library/fidelity.test.ts`)

1. **Coverage** (FR-001, SC-001): the set of record ids equals the set of shelf ids in `public/library/index.json`
   plus the ids of records whose outcome is `removed`. No shelf item without a record; no record for an item that
   is neither on the shelf nor removed.
2. **Re-run** (FR-016, SC-003): every `mechanical` check is re-run from the committed source files; the number of
   differences equals `expectedDifferences`, and when it is non-zero, `differenceNotes` has exactly that many
   entries. Every `theory` check is re-run and must give 0.
3. **Outcome consistency**: `verified`, `fixed` and `replaced` require at least one `mechanical` or `theory` check
   with `expectedDifferences: 0` over the claimed bars; a record whose only checks are `visual` may have outcome
   `verified` but the report prints **"verified (visual)"** (FR-019). `relabelled` requires the item's sidecar to
   differ from `previous` in title/subtitle or `departures`. `removed` requires a row naming the item in
   `public/library/README.md` "Rejected items" (FR-009).
4. **Claims** (FR-008, FR-010): `claim: "excerpt"` requires the item's title or subtitle to name the part it holds;
   `claim: "arrangement"` requires `arrangement: true` and a non-empty `departures` in the sidecar; `claim:
   "original"` requires `arrangement: false` and a mechanical check with aspects covering at least `barCount`,
   `repeats`, `pitch`, `onset` and `duration` when the source has a notation file (FR-005).
5. **Reviewer** (FR-018, SC-006): the sidecar's `reviewedBy` equals `checkedBy` and `reviewedOn` equals `date`.
6. **Sources**: every `source` named by a check exists under `content/library/sources/` and validates
   (contract source-manifest.md).
7. **Item ids** (FR-020, SC-007): a record whose `previous` is present keeps its `itemId`; ids are never renamed by
   this feature.

## 3. The report (`docs/library-audit.md`)

Generated by `pnpm library:fidelity`, deterministic (no timestamps other than the records' own dates), and checked
by a test that regenerates it in memory and compares (same pattern as `index.json`, FR-025 of feature 005).

```markdown
# Library fidelity audit

Generated from `content/library/audit/`. Do not edit; run `pnpm library:fidelity`.

## Summary
| Outcome | Items |          <- counts per outcome, total = shelf + removed
## Level counts after the audit
| Level | Pieces | Minimum | Status |   <- "short by N - reported to the owner" when below (FR-022)

## Repertoire
| Item | Claim | Source | Method | Checked | Differences | Outcome | Date |
<- one row per item; Source = edition + link; Method = mechanical / theory / visual (bars);
   Checked = the aspects; Differences = 0, or the count with the notes below the table

## Learning
| Item | Claim | Rule set | Method | Differences | Outcome | Date |

## Removed
| Item | Reason | Date |

## Notes
<- per item with differenceNotes, departures or an edition decision: the full text
```

SC-009 (find any item in under a minute): rows are in shelf order, one row per item, with the item title as it
appears in the app plus its id.

## 4. Versioning

MINOR for new aspects, methods or optional fields; MAJOR for a changed outcome set or file location.
