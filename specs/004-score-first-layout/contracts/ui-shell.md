# Contract: UI shell (slim bar, panel host, overlays)

**Version**: `1.0.0` (new with feature 004)
**Owner**: `src/ui/elements/mx-app.ts`, `src/ui/layout/*`, `src/ui/state/viewState.ts`

This contract fixes the shape of the application window so that every other element knows where it
may live. It is a UI-layer contract only: no core type, no engine port and no real-time path changes.

---

## 1. Window regions

```text
+--------------------------------------------------------------+
| header#mx-bar        (reserves height, <= 48px @100% scaling) |
+--------------------------------------------------------------+
| main#mx-main                                                  |
|   mx-score-view                     (fills the region)        |
|   div#panel-host                    (overlay, popovers)       |
|   mx-notice-tray                    (overlay, bottom-right)   |
|   mx-piano-keys                     (overlay, bottom, opt-in) |
|   mx-practice-help                  (overlay, near the cursor) |
+--------------------------------------------------------------+
```

Rules:

1. `#mx-bar` is the **only** element permitted to reserve layout space besides the Score view.
2. Every child of `#mx-main` other than `mx-score-view` is `position: absolute` within it and must
   declare a `--mx-inset-*` custom property if it needs the Score to keep clear of it.
3. `mx-score-view` receives `width: 100%` and all remaining height; it never has a sibling in the flow.
4. No element may use `<dialog>.showModal()` or otherwise block interaction while a run is active.

### Insets

| Overlay | Custom property | Effect |
|---|---|---|
| `mx-piano-keys` (when on) | `--mx-inset-bottom` | Added as `padding-bottom` on the Score scroll container, so the follow-scroll band stays clear (FR-010). |
| `mx-notice-tray` | none | Corner-anchored, bounded to 3 stacked notices; never enters the middle band. |

---

## 2. Slim bar contents (FR-002)

Fixed order, left to right:

| Slot | Element | Visible when |
|---|---|---|
| `#mode-controls` | `mx-mode-switch` | a Score is loaded |
| `#transport-controls` | `mx-transport` | a Score is loaded |
| `#size-controls` | `mx-size-controls` (new) | a Score is loaded |
| `#open-controls` | `mx-open-button` | always |
| `#menu-controls` | `mx-menu` x4 (Score, Setup, View, Help) | always |
| `#run-status` | `mx-run-status` (new) | always (empty when idle) |

Nothing else may be added to the bar without amending this contract.

---

## 3. Panel host and the panel protocol

Every secondary tool is wrapped in `mx-panel`:

```html
<mx-panel data-panel="diagnostics" popover="auto" aria-labelledby="...">
  <header>title + close button</header>
  <slot>the existing element, unchanged</slot>
</mx-panel>
```

State machine (source of truth: `viewState.openPanel`, see `data-model.md` section 2):

| Trigger | Result |
|---|---|
| menu entry activated | `openPanel(id)`; any other panel closes |
| close button / Escape / click outside | `closePanel()`; focus returns to the invoker |
| a run starts (Listen, Practice or Play) | `closeForRun()` -> `openPanel = null` |
| a notice arrives | nothing; notices never change `openPanel` and never take focus |

`mx-panel` applies the state to the DOM as:

- `viewState.openPanel === id` -> `el.showPopover?.()`, `hidden = false`, `aria-hidden="false"`
- otherwise -> `el.hidePopover?.()`, `hidden = true`, `aria-hidden="true"`

The optional-call form is deliberate: `happy-dom@20` has no Popover API (research R-3), so unit tests
assert the store and the attributes, and Playwright asserts the native behaviour.

**Panels must not re-render the Score.** Opening or closing a panel changes no layout input of
`mx-score-view`, so no relayout is triggered (FR-020).

---

## 4. Keyboard contract

| Key | Behaviour | Precedence |
|---|---|---|
| `Escape` | closes the open panel if there is one; **otherwise** stops the transport | panel first (research R-4) |
| `Space` | play / pause | unchanged; ignored while focus is inside a panel's form control |
| `Ctrl/Cmd +` , `Ctrl/Cmd -` | Score larger / smaller | new |
| `Ctrl/Cmd 0` | Score back to the default size | new |

Every menu and panel is reachable by Tab; `mx-menu` supports Arrow/Home/End within an open menu and
closes on Escape without touching the transport.

---

## 5. Events

`mx-panel` and `mx-menu` communicate only through `viewState`. No new custom events cross layers; the
existing per-element events (`zoomchange`, `measureclick`, setup-change events) keep their current
names and payloads, except:

| Event | Change |
|---|---|
| `mx-score-view` `zoomchange` | renamed payload field `zoomPercent` -> `scale`; same range and meaning (see `score-layout.md`) |

---

## 6. Accessibility

- The bar is a `<header>` with `role="toolbar"`; each menu button has `aria-haspopup="menu"` and
  `aria-expanded`.
- Each `mx-panel` has an accessible name from its heading and is `role="dialog"` **without**
  `aria-modal` (it is non-modal by design, Principle VI).
- The run status is an `aria-live="polite"` region so mode and device changes are announced without
  stealing focus.
