# Contract: top bar - MIDI keyboard control and icon transport

**Version**: `1.0.0` (new, feature 021). Owners: `src/ui/elements/mx-app.ts`, new `src/ui/elements/mx-midi-status.ts`,
`src/ui/elements/mx-midi-panel.ts`, `src/ui/elements/mx-transport.ts`, new `src/ui/icons/transport-icons.ts`, new
`src/ui/icons/midi-icons.ts`, `src/ui/layout/menu-model.ts`, `src/ui/state/viewState.ts`, `src/ui/state/runGuard.ts`,
`src/ui/i18n/en.ts`. Amends ui-shell 1.5.0 -> 1.6.0. Decisions: research R-4, R-10, R-11. Spec: US3, US4, FR-003,
FR-007, FR-016 to FR-023, FR-027.

## 1. Slim bar (ui-shell section 2, amended)

| Slot | Element | Visible when |
|---|---|---|
| `#brand` .. `#menu-controls` | unchanged | unchanged |
| `#midi-controls` (new, after `#menu-controls`) | `mx-midi-status` | always |
| `#run-status` | unchanged | unchanged |

Fit steps: in `mx-bar-compact` and later steps the control shows its icon only (the name moves to its `title` and
stays its accessible name). It never moves to the View popup.

## 2. `mx-midi-status`

- A `<button type="button" aria-haspopup="dialog" aria-expanded>` with an icon (`midi-icons.ts`, one shape per display
  state, data-model section 2) and a label; `aria-label` = the label, plus ", sound off - click the page to turn it on"
  while locked, ", sound loading" while loading.
- Live-sound marker: while `liveSound` is `locked` or `loading`, a second small icon (speaker + lock / speaker + dots)
  sits after the label; `failed`: speaker + cross with the label "Sound failed to load".
- Locked hint: on the first note-on while locked, a non-modal hint bubble under the control reads "Click anywhere on the
  page to turn the sound on." It disappears on unlock or after `LOCKED_HINT_MS` (new constant, 8000) and is never
  shown twice in one page load (FR-003). It is not a notice and takes no focus.
- Click toggles panel `'midi'` (like Levels toggles `'sound'`). Escape closes it and returns focus to the button.
- Updates from `midiState` only; re-renders only when the display state, label or live-sound value changes.

## 3. MIDI popover (panel `'midi'`, `mx-midi-panel` reworked)

Content, in order (strings in `en.midi.*`, new section; the hard-coded English in today's panel moves there):

1. Status line (the display state's label, with its icon).
2. Device list: each found keyboard's name, manufacturer and "Connected" / "Disconnected" as text (not colour alone).
3. Button: "Connect MIDI keyboard" (`notRequested`, `denied` -> "Try again"), absent when `available`.
4. Live input latency "{n} ms" when known (moved from today's panel).
5. Help for `notSupported` ("This browser cannot use MIDI keyboards. Use Chrome or Edge, or the desktop app. Listening
   to scores works here.") and `denied` ("MIDI access was blocked. Allow MIDI for this site in the browser's site
   settings, then press Try again.").

Panel rules: non-modal popover anchored under `mx-midi-status`; allowed during any run (`RUN_OK_PANELS`, data-model
section 7); its height never exceeds the bar inset area so the current system stays visible (FR-027; checked in e2e by
the cursor's bounding box not intersecting the popover).

## 4. Menu change

Setup menu: `setup`, `latency`. The `more` overflow menu follows (`MENU_GROUPS` flatMap). The panel title
`panels.midi` ("MIDI keyboard") stays for the popover heading.

## 5. Icon transport (`mx-transport`)

| Button | Icon (state) | `aria-label` (unchanged) | `title` |
|---|---|---|---|
| `.play-btn` Listen / Play mode | triangle; two bars while playing | "Play" / "Pause" | "Play (Space)" / "Pause (Space)" |
| `.play-btn` Practice | triangle; square while practising | "Start" / "Stop" | "Start (Space)" / "Stop (Space)" |
| `.stop-btn` | square | "Stop" | "Stop (Esc)" |
| `.skip-back-btn` | bar + left triangle | "Skip Back" | "Skip Back" |
| `.skip-forward-btn` | right triangle + bar | "Skip Forward" | "Skip Forward" |

- The button's text content is the inline SVG only (`aria-hidden="true"`, `focusable="false"`, `fill="currentColor"`),
  so `getByRole('button', { name: 'Play' })` keeps working and no caption is visible (SC-009).
- Size: each button's border box is at least as large as the 020 build's captioned "Stop" button height and at least
  that height in width (square), measured once and stored as `TRANSPORT_BUTTON_MIN_PX` (new constant in the UI layer
  config, value fixed from that measurement by the task).
- Disabled: `opacity` reduced **and** a dashed border (not colour alone, FR-023).
- The loading-sound label (`transport.loadingSound`) keeps its text: it is a status, not a caption.
- Other bar buttons (Levels, Follow, size, Open score, menus) keep their words (spec assumption).

## 6. Tests that pin this contract

- UI unit (`tests/ui/midi-status.test.ts`): `midiStatus()` for every availability/devices/lost combination; the icon id
  differs per display state (shape, not colour); label strings.
- UI unit (`tests/ui/menu.test.ts`): Setup has no `midi` entry; `more` neither.
- e2e (chromium): fake MIDI connected at start -> control shows its name with no click; disconnect -> "disconnected"
  within `MIDI_STATUS_UPDATE_MAX_MS`; click -> popover lists it; popover open during a Play run, run continues and the
  cursor stays visible (SC-007, SC-008).
- e2e (chromium): every transport button has an SVG, empty visible text, the old accessible name and a `title`; bar
  width at 1280 px with a Score open is smaller than the 020 value recorded by the task (SC-009); light and dark theme
  screenshots via `pnpm screenshot` checked by eye.
