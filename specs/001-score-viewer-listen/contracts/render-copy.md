# Contract: render copy and element ids

**Version**: `1.0.0`. The render copy is the MusicXML text given to Verovio. Research R-7, R-8.2, R-9.

## Render copy

- Produced by `src/core/musicxml/render-copy.ts` from the **decoded** source text (UTF-16 JS string) and the node
  offsets reported by the parser.
- For each playable `<note>` (R-8.2): insert ` id="<NoteId>"` right after the tag name `<note`; if the element
  already has an `id` attribute, its value is replaced.
- For each `<measure>` **of the first part only**: insert/replace ` id="<MeasureId>"`.
- Rests, cue notes and elements of other parts keep whatever `id` they had; duplicate source ids that would collide
  with ours are removed from those elements (collision check), so every id in the copy is unique.
- Everything else is unchanged: no reformatting, no removal of unsupported elements (Verovio shows what it can).
- The XML declaration's `encoding` is rewritten to `UTF-8` (the string is passed to Verovio as text).

## Id formats

| Id | Format | Example |
|---|---|---|
| Note ID | `n-p{part}-s{staff}-m{measure}-v{voice}-o{onset}-k{key}[-g{i}][-d{j}]` | `n-p0-s2-m12-v5-o3_2-k43` |
| Measure ID | `ms-{index}` (0-based notation-order index) | `ms-0` |

Field rules are in research R-8.2. Ids are valid XML NCNames and CSS identifiers (no escaping needed in
`getElementById`/`querySelector`).

## Guarantees checked by tests

1. Every Note ID in the Score occurs exactly once in the render copy (core test).
2. With the real Verovio WASM, every Note ID of a printed note (`printed: true`) exists as an SVG element id
   (`g.note`), and every Measure ID as `g.measure` (verovio-mapping test, all fixtures).
3. Re-parsing the render copy gives the same Score (ids are stable and idempotent).
