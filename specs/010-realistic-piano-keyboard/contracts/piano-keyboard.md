# Contract: On-screen piano keyboard (layout and element)

**Version**: `1.0.0` (new with feature 010; internal contract between `src/ui/piano/keyboard-layout.ts`,
`src/ui/elements/mx-piano-keys.ts`, `src/ui/styles/layout.css` and the tests). Signatures and the DOM structure below
are normative. Changes bump the version (MINOR additive, MAJOR breaking).

The element's place in the window and its bottom inset are 004's `ui-shell.md` (1.0.0), unchanged.

## 1. Layout (pure, runs in Node)

```ts
// src/ui/piano/keyboard-layout.ts
export type KeyColour = 'white' | 'black';
export interface PianoKeyGeometry {
  key: number; colour: KeyColour; left: number; width: number; length: number; label: string | null;
}
/** The 88 keys A0 ... C8 in key order, in fractions of the keyboard's width and height (data-model section 1). */
export function keyboardLayout(): readonly PianoKeyGeometry[];
/** True for pitch classes 1, 3, 6, 8, 10. */
export function isBlackKey(key: number): boolean;
```

Guarantees: pure and deterministic; computed once (module-level) and reused, never per state update; every rule of
data-model section 1 holds.

## 2. Element DOM (inside `mx-piano-keys`'s shadow root)

```html
<div class="keyboard" id="keys">              <!-- position: relative; width 100 %; height per research R-2 -->
  <div class="key white" data-key="21" style="left: 0%; width: 1.923%"></div>
  ...                                          <!-- the 52 white keys first -->
  <div class="key black" data-key="22" style="left: ...%; width: ...%"></div>
  ...                                          <!-- then the 36 black keys, drawn on top -->
  <!-- on each C key: <span class="key-label">C4</span> -->
  <!-- when a state needs one: <span class="key-mark">✕</span> (as today) -->
  <!-- while the key is held: <span class="key-dot"></span> (the red dot; was a ::after pseudo-element) -->
</div>
<div class="key-messages" id="key-messages"></div>   <!-- unchanged -->
<div class="sustain-indicator" id="sustain">Sustain Pedal</div>   <!-- unchanged -->
```

Kept exactly as before (every existing test relies on them): one `.key[data-key]` per MIDI key 21-108; the state
classes `pressed`, `wrong-pitch`, `wrong-octave`, `extra`, `expected-help`; the glyph in `.key-mark` (✕ ▢ ◆ ?, the same
precedence); `.key-message[data-key]` with the English hint text; `.sustain-indicator` with `down`.

New: the `white` / `black` class on every key; the pressed dot as a real `.key-dot` element (so its box can be
measured, research R-6); `.key-label` on the eight C keys (text `C1` ... `C8`); `left` and
`width` as inline percentages from `keyboardLayout()`; the host is a size container (`container-type: inline-size`).

## 3. Look (normative, research R-2 to R-5)

- Keys fill the keyboard's width exactly; white keys are contiguous, separated by a 1 px divider; black keys are above
  the white keys, from the top edge, `BLACK_KEY_LENGTH_RATIO` of the height.
- Keyboard height: `min(100cqw / 52 * WHITE_KEY_ASPECT, PIANO_KEYS_MAX_HEIGHT_PX px, PIANO_KEYS_MAX_HEIGHT_VH vh)`.
- The element never scrolls sideways (`layout.css` drops `overflow-x: auto`).
- Markings lie inside their own key's uncovered area: on a white key below the black keys (bottom up: label, dot,
  glyph); on a black key in its lower part, the glyph on a light badge and the dot with a light ring. State borders
  and the help glow are outlines of the key itself.
- Clicking a key does nothing (002 FR-033, 003 FR-010).

## 4. Test seams

None new. Playwright reads the shadow DOM directly (`mx-piano-keys .key[data-key="61"]`), as `pressed-keys.spec.ts`
already does.
