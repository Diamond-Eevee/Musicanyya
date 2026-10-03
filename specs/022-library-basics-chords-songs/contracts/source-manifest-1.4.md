# Change request: source manifest 1.3.0 -> 1.4.0 (MINOR)

**Canonical contract**: [specs/007-library-fidelity-audit/contracts/source-manifest.md](../../007-library-fidelity-audit/contracts/source-manifest.md)
(fold this in). **Feature**: 022, 2026-10-03 (spec FR-034, SC-007).

## Change

Optional manifest field:

```json
"multiPart": {
  "type": "object", "additionalProperties": false, "required": ["available"],
  "properties": {
    "available": { "type": "boolean" },
    "where":     { "type": "string", "description": "URL of the multi-part (ensemble / SATB / orchestral) version" },
    "licence":   { "type": "string", "description": "SPDX id or public-domain, as that page states it" },
    "note":      { "type": "string", "description": "instrumentation, and anything a later Orchestra feature needs" }
  }
}
```

`tests/library/fidelity.test.ts` requires it on every source used by a song definition created in feature 022.
The source itself may be the multi-part version (then `where` is its own `url`). Nothing is downloaded for it now.
