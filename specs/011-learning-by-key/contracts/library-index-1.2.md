# Contract change: library content formats 1.1.0 -> 1.2.0

**Changes**: `specs/005-practice-score-library/contracts/library-index.md` (the canonical contract; this file is the
change request, folded into it by the first implementation task that touches the schema, then kept as history).

**Kind**: MINOR (additive for readers). `index.json` `version` stays `1`. A 1.1.0 reader ignores the new fields, but it
does not know the level value `introduction`; per §3 of the canonical contract such an item is **skipped and reported**
by an old build, which is acceptable because old builds never ship with the new shelf (the shelf and the app are
deployed together).

## 1. Authored item metadata (`<name>.json`)

`level` enum gains `introduction`:

```json
"level": { "enum": ["introduction", "beginner", "intermediate", "advanced"] }
```

New optional properties:

```json
"step": {
  "enum": ["introduction", "beginner", "intermediate", "advanced", "song"],
  "description": "the step of a key or key-change folder this item belongs to (feature 011 FR-003)"
},
"stepOrder": {
  "type": "integer", "minimum": 0, "maximum": 99,
  "description": "position inside its step; 0 = the step's main exercise, 10+ = more practice at the same step"
},
"supersedes": {
  "type": "array", "minItems": 1, "maxItems": 8,
  "items": {
    "type": "object", "additionalProperties": false, "required": ["id", "hash"],
    "properties": {
      "id":   { "type": "string", "pattern": "^[a-z0-9-]+(/[a-z0-9-]+)*$" },
      "hash": { "type": "string", "pattern": "^[0-9a-f]{64}$" }
    }
  },
  "description": "former library items this item replaces: old id and the SHA-256 of the old file (feature 011 FR-020)"
}
```

Rules:

- Every item under `learning/keys/` or `learning/key-changes/` **requires** `step`. Items elsewhere **forbid** it.
- `step` = `introduction` requires `level` = `introduction`; `beginner`, `intermediate`, `advanced` require the level of
  the same name. `song` items carry their own level (`beginner` or `intermediate`) and `kind: "piece"`.
- Within one folder, `(step, stepOrder)` is unique. A folder in `learning/keys/` holds exactly one item with
  `stepOrder: 0` for each of the four exercise steps.
- `supersedes[].id` must not be the id of any item on the shelf, and one old id may be superseded by at most one item
  (the successor table, data-model §7, is the single source).
- Skill tag list gains `key-changes` (MINOR): the item practises moving between two keys. Required on every item under
  `learning/key-changes/`.

## 2. Generated index (`index.json`)

Section objects gain one optional property:

```json
"formerIds": {
  "type": "array", "items": { "type": "string" }, "minItems": 1,
  "description": "section ids this section replaces; a persisted filter naming one is moved here (feature 011 FR-020)"
}
```

Item objects copy `supersedes` from the sidecar's metadata (it stays inside `meta`; no new top-level item field).
`levelCheck.level` gains `introduction`. `facts` gains `chordChangesPerBar` (number, mean over written measures of the
chord attacks - onsets where one staff sounds two or more notes - that differ from the previous chord attack in the
same staff).

Section order: `order` is now **the position among siblings** (same `parent`), which is what the builder already
writes; readers build the tree from `parent` + `order` (library-port 1.2 §2). Sibling `order` values are unique.

## 3. Reading rules (additions)

- An item whose `meta.level` or `meta.step` is unknown to the reader is skipped and reported (existing rule).
- `supersedes` and `formerIds` are read by `src/app/library-session.ts` and `src/ui/state/libraryState.ts` only; they
  never affect what is listed.

## 4. Generation and verification (additions)

- `pnpm library:index` refuses to write when a key folder breaks the step order (data-model §4, `checkStepOrder`), and
  names the folder, the two steps and the fact.
- `tests/library/index.test.ts` additionally asserts: 24 key folders in circle order (data-model §2); each has the four
  main steps; 18 key-change folders (introduction, beginner, intermediate each); every old id from the successor table appears in exactly one `supersedes`; the
  counts of the canonical contract §4 are replaced by: >= 96 step exercises, >= 54 key-change exercises, >= 8 songs in
  >= 4 keys of which >= 2 minor.

## 5. Id rule (clarified)

Ids are still the path without the extension. Feature 011 renames every `learning/` id once; from then on the rule of
the canonical §3 applies again, and any future rename must add a `supersedes` entry.
