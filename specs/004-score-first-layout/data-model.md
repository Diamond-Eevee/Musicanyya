# Data Model: Score-First Application Window

Feature `004-score-first-layout`. This feature adds **no core entity**: the Score, timeline, Practice
session, Play run, Grade and Performance log are untouched. Everything here lives in the UI layer
(`src/ui/state`) or in the settings file.

---

## 1. `PanelId`

The identity of a secondary tool that can be opened as a popup.

```ts
type PanelId =
  | 'scores'      // recent scores + open
  | 'midi'        // MIDI keyboard connection
  | 'environment' // capability / permission status
  | 'diagnostics' // audio diagnostics
  | 'latency'     // Latency profile calibration
  | 'help'        // supported notation + keyboard shortcuts
  | 'view'        // overlay switches + Score size
  | 'setup'       // Practice or Play setup (which one depends on the current mode)
  | 'grade'       // the Grade of the run that just finished
  | 'attempts';   // recent attempts for this Score
```

Validation: an unknown string read from anywhere is treated as `null` (no panel open).

---

## 2. `ViewState` (extends the existing store)

`src/ui/state/viewState.ts`, currently `{ zoomPercent }`.

| Field | Type | Default | Persisted | Notes |
|---|---|---|---|---|
| `scale` | integer 50-200, step 10 | `100` | yes | Score size; 100 = fitted to the Score viewport width. Replaces `zoomPercent` (same range, same meaning). |
| `openPanel` | `PanelId \| null` | `null` | no | At most one (FR-004). Session-only. |
| `overlays.cursor` | boolean | `true` | yes | Cursor overlay layer. |
| `overlays.marks` | boolean | `true` | yes | Practice / Grade result marks. |
| `overlays.advice` | boolean | `true` | yes | Advice markers (layer exists for a later feature). |
| `overlays.pianoKeys` | boolean | `false` | yes | On-screen piano keys (FR-015: off by default). |
| `overlays.notices` | boolean | `true` | yes | Notice tray. |

### State rules

- `setScale(n)` clamps to `[50, 200]` and rounds to the nearest multiple of `SCORE_SCALE_STEP` (10).
- `resetScale()` sets `100`.
- `openPanel(id)` replaces any currently open panel (FR-004).
- `closePanel()` sets `null`.
- **Run guard (FR-006)**: when a Listen, Practice or Play run starts, `openPanel` is forced to `null`.
  The store exposes this as `closeForRun()` so the rule has exactly one call site and one test.
- `setOverlay(layer, on)` toggles one layer; turning `cursor` off does not stop the run, it only stops
  drawing (Principle VI: every overlay layer can be switched off).

### Transitions

```text
                 openPanel(id)        openPanel(other)
   null  ------------------------>  id  ---------------->  other
     ^                               |                       |
     |   closePanel() / Escape /     |                       |
     |   click outside / run start   |                       |
     +-------------------------------+-----------------------+
```

---

## 3. `RunStatus` (derived, not stored)

What the slim bar shows while a run is active (FR-008). Derived (`src/ui/state/runStatus.ts`, a pure function) from the existing `transportState`, `practiceState`, `playState`,
`midiState` and the notices on screen. The one input that is new is the measure under the cursor, which `mx-score-view`
already works out each frame and publishes to `runPositionState`; the status never derives musical position itself.

| Field | Type | Source |
|---|---|---|
| `mode` | `'listen' \| 'practice' \| 'play'` | `practiceState.mode` |
| `phase` | `'idle' \| 'countIn' \| 'running' \| 'paused' \| 'finished'` | `transportState.phase` / `playState.run.phase` |
| `measureLabel` | `string \| null` | current measure of the active timeline |
| `deviceState` | `'ok' \| 'noMidi' \| 'midiLost' \| 'audioLost'` | `midiState` + engine events |
| `canStop` | boolean | `phase` is `countIn`, `running` or `paused` (a `finished` run has nothing left to stop) |

---

## 4. `UserSettings` version 2

`musicanyya.settings.v1` (the storage key keeps its name; the `version` field inside moves to `2`).

```ts
interface UserSettings {
  version: 2;
  volume: number;        // unchanged
  tempoPercent: number;  // unchanged
  scale: number;         // NEW - 50..200 step 10; reads a v1 `zoomPercent` if present
  follow: boolean;       // unchanged
  overlays: {            // NEW
    cursor: boolean; marks: boolean; advice: boolean; pianoKeys: boolean; notices: boolean;
  };
}
```

Validation follows the file's existing rule: **every field is validated on its own and falls back to
its default**; unknown fields survive a save. Migration from version 1:

| v1 | v2 | Rule |
|---|---|---|
| `zoomPercent` | `scale` | Taken over unchanged if it is a valid 50-200 integer, else `100`. |
| *(absent)* | `overlays` | All defaults (`pianoKeys: false`, the rest `true`). |
| `version: 1` | `version: 2` | Silent, no notice. A v2 file read by older code still validates field by field. |

---

## 5. Menu structure (content, not state)

A static table in `src/ui/i18n/en.ts` + `src/ui/layout/menu-model.ts`; no runtime state beyond
`openPanel`.

| Menu | Entries (`PanelId`) |
|---|---|
| Score | `scores`, `attempts` |
| Setup | `setup`, `midi`, `latency` |
| View | `view` (overlay switches, Score size) |
| Help | `help`, `diagnostics`, `environment` |

Entries are disabled (not hidden) when they cannot apply - e.g. `attempts` and `setup` with no Score
loaded - so the menu's shape never changes under the user's hand.
