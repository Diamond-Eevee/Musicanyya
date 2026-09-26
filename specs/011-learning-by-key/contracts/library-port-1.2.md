# Contract change: library port and panel 1.1.0 -> 1.2.0

**Changes**: `specs/005-practice-score-library/contracts/library-port.md` (canonical; this is the change request,
folded in by the first task that touches the panel, then kept as history).

**Kind**: MINOR. The port signature is unchanged; the panel's layout, sort order and two persistence rules change.

## 1. Port

`LibraryCatalog` is unchanged.

## 2. Panel behaviour (replaces "always expanded" of §4 and the sort of §3)

- Sections render as a **tree** built by `buildSectionTree(sections)` (`src/core/library/tree.ts`, pure): roots and
  children ordered by `order` among siblings; a section with no items and no non-empty descendant is omitted.
- Each section is a native `<details class="library-section">` with a `<summary>` holding its title (and, for key-change
  folders, the relation word "relative" / "parallel" from its `description`). No custom keyboard handling: Enter/Space
  toggles, as the browser provides.
- **Default open state**: the roots (*Learning*, *Repertoire*) and their direct children (*Keys*, *Key changes*,
  *Beginner*, *Intermediate*, *Advanced*) are open; key folders and key-change folders are closed. So a key's items are
  reached with: open the key folder, then open the item - within SC-001's 3 selections from the open panel.
- **With a filter active** (level, key, tag or text), every folder that contains a matching item is open and folders
  without matches are omitted, so a filter never costs extra clicks (005 SC-001 intent).
- Open/closed state set by the user survives re-renders within the session (kept in `libraryState`, not persisted).
- Inside a section, items sort by: step rank (introduction, beginner, intermediate, advanced, song; items without a
  step after them), then `stepOrder`, then title with the caller's collator. Items show their step as text
  ("1 Introduction", "2 Beginner", ..., "Song") before the level chip; the level chip stays.

`filterItems(items, sections, filter, compare)` keeps its signature; its sort becomes: section tree order (depth-first
over `buildSectionTree`), then the in-section order above.

## 3. Filter state

`LibraryFilter.level` accepts `'introduction'`. When the persisted `sectionId` is not a section of the loaded index,
it is replaced by the section whose `formerIds` contains it, or by `null` when none does. The stored payload keeps
`version: 1` (the field set is unchanged).

## 4. Opening an item: settings adoption

Before `loadBytes`, `LibrarySession.openItem` calls
`settings.adoptScoreSettings(item.meta.supersedes?.map((s) => s.hash) ?? [], item.hash)`:

```ts
/** Copies per-Score Practice and Play settings from the first of `fromHashes` that has an entry to `toHash`, when
 *  `toHash` has no entry of its own. Never overwrites, never deletes the old entry, never throws (storage errors are
 *  swallowed like every other write in this store). Returns true when something was copied. */
adoptScoreSettings(fromHashes: readonly string[], toHash: string): boolean;
```

It lives on the existing settings store (`src/engine/storage/local-settings-store.ts`) and its fake. Items whose bytes did
not change keep their hash, so their settings apply with no adoption at all.

Recent scores are copies of the bytes the user opened (feature 001); a recent entry of an old item keeps opening that
copy and is not redirected. The audit report's existing note says so for replaced items (007 FR-020).

## 4a. Where the Score came from (`mx-score-source`)

For an `authored` item with `provenance.basedOn`, the panel shows "Arrangement for this app (CC0)" and then
`provenance.note` (for songs: the source edition, its link and "public domain"), so a song names the source it was
checked against and both licences (spec US3 scenario 3). Authored items without `basedOn` are unchanged.

## 5. Performance

Unchanged budgets (list <= 1 s for 200 items, filter <= 200 ms); the synthetic-index test grows to 200 items spread over
a 3-level tree.
