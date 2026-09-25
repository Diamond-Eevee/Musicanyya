# Research: On-Screen Piano That Looks Like a Real Keyboard

Feature 010. Decisions for [plan.md](plan.md). Each entry: Decision / Rationale / Alternatives considered.

## Baseline (what the code does today)

- `src/ui/elements/mx-piano-keys.ts` (feature 001, extended by 002/008) builds 88 `div.key[data-key]` for MIDI 21-108 in
  a flex row, each 20 x 80 px with a 1 px border and a 2 px gap: no black keys, 88 x 22 px + padding = 1956 px, wider
  than a 1920 px window. `src/ui/styles/layout.css` puts the element at the bottom (`position: absolute`) with
  `overflow-x: auto`, so narrower windows scroll it sideways.
- States are CSS classes on the key: `pressed` (pink background + red dot), `wrong-pitch` / `wrong-octave` / `extra`
  (2 px coloured border + glyph ✕ ▢ ◆ in `.key-mark`), `expected-help` (blue border + glow + "?"); text hints are
  `.key-message[data-key]` under the keys; `.sustain-indicator.down` shows the pedal. Updates are synchronous on every
  `midiState` / `practiceState` change (001's visual-feedback budget).
- The element declares its height as the bottom inset through a `ResizeObserver` (004 `ui-shell.md` Insets), so a
  taller strip is already handled by the Score layout.
- Unit tests (`tests/ui/midi-panel.test.ts`, `practice-key-feedback.test.ts`, `practice-help.test.ts`,
  `play-notices.test.ts`, `overlay-layers.test.ts`, `insets.test.ts`) and e2e (`pressed-keys.spec.ts`,
  `us1-layout.spec.ts`, `us4-overlays.spec.ts`) address keys by `[data-key]` and the state classes above.

## R-1 Key geometry: the "equal key-top" model of a real keyboard

**Decision**: white keys are 52 equal columns across the keyboard's width. Black keys are all
`BLACK_KEY_WIDTH_RATIO = 0.58` of a white key wide and `BLACK_KEY_LENGTH_RATIO = 0.64` of its length, and their
centres follow the equal key-top division that keyboard makers use: the three white keys C-E (with C#, D#) are divided
into five equal tops, the four white keys F-B (with F#, G#, A#) into seven. In white-key units from the group's first
white key:

| Black key | Centre | Offset from the line between its two white keys |
|---|---|---|
| C# | 0.9 (= 1.5 x 3/5) | -0.10 (leans towards C) |
| D# | 2.1 (= 3.5 x 3/5) | +0.10 (leans towards E) |
| F# | 6/7 ~ 0.857 (= 1.5 x 4/7) | -0.143 |
| G# | 2.0 (= 3.5 x 4/7) | 0 (centred) |
| A# | 22/7 ~ 3.143 (= 5.5 x 4/7) | +0.143 |

The lowest keys (A0, A#0, B0) are the top of an F-B group, so A#0 uses A#'s offset.

**Rationale**: spec FR-003/FR-004 and the Assumptions (outer black keys lean outwards, G# centred). A real key is
about 23.5 mm wide and a black key about 13.7 mm (ratio ~0.58); a black key is about 95 of 150 mm long (~0.63). The
equal-top model gives exactly the "lean outwards" look and is a small closed formula, so the layout is a pure, tested
function.

**Alternatives considered**: black keys centred on the white-key lines (reads as a diagram, FR-004 rejects it);
measured offsets of a particular piano model (no better visually, harder to justify); an SVG or image of a keyboard
(fixed aspect, cannot carry per-key states without re-drawing).

## R-2 Drawing: one positioned element per key, sized by CSS container units

**Decision**: keep one `div.key[data-key]` per key inside the element's shadow root, now absolutely positioned inside
a `.keyboard` box: `left` and `width` as percentages of the keyboard width from the pure layout (R-1); white keys fill
the full height, black keys `BLACK_KEY_LENGTH_RATIO` of it, drawn above the whites (later in DOM order and
`z-index`). The host is a size container (`container-type: inline-size`), and the keyboard's height is
`min(100cqw / 52 * WHITE_KEY_ASPECT, PIANO_KEYS_MAX_HEIGHT_PX, PIANO_KEYS_MAX_HEIGHT_VH vh)` with
`WHITE_KEY_ASPECT = 4`, 160 px and 20 vh (spec FR-005, SC-006). Nothing is measured in script; the existing
`ResizeObserver` keeps declaring the strip's height as the bottom inset. `overflow-x: auto` is removed from
`layout.css` (FR-006: nothing to scroll).

Browser support (MDN browser-compat-data, checked 2026-09-26): `container-type` and the container query length units
(`cqw`) are in Chrome and Edge 105, Firefox 110 and Safari 16 - every target browser of the constitution and
Electron's Chromium.

**Rationale**: the DOM contract every existing test and e2e relies on (`[data-key]` + state classes + `.key-mark`)
stays, so feature 002/008 behaviour is untouched; CSS does the resizing with no JS per resize; percentages make the
keyboard fill any width exactly (SC-002). Constitution VIII: Web Platform features only.

**Alternatives considered**: a canvas drawing (would break the DOM contract and every test; states would need their
own hit geometry); computing pixel sizes in the `ResizeObserver` (script on every resize for what CSS can express);
an inline SVG (same element count as divs, no benefit).

## R-3 Marking placement on the new key shapes (FR-010, FR-011)

**Decision**: every marking sits in the part of its key that no other key covers.

- White key: markings go in the lower zone below the black keys (from `BLACK_KEY_LENGTH_RATIO` of the height down),
  stacked from the bottom: the C label (C keys only), then the pressed dot, then the state glyph; the help glow and
  the state border are drawn as an `outline` (no layout shift), clipped to the key's own box.
- Black key: glyph and dot in the lower part of the black key; the glyph sits on a small light rounded badge so the
  state colours (`#d55e00`, `#e69f00`, `#cc79a7`, help `#0072b2`) keep their contrast on black; the pressed dot has a
  light ring for the same reason.
- Sizes follow the white-key width (`cqw`), clamped (glyph 8-12 px, dot 5-10 px, label 7-11 px), so markings stay
  inside their key at 1024 px (white key ~19.5 px, black ~11 px) and do not grow absurdly at 2560 px.

**Rationale**: the upper part of a white key is partly covered by black keys, so a marking there could be hidden or
look as if it belonged to a black key (FR-011, SC-007). Colours and glyphs are exactly today's (FR-010, Constitution
VI: colour and shape).

**Alternatives considered**: markings above the keyboard (detached from the key); colouring the whole key only
(loses the shape cue in greyscale, Constitution VI).

## R-4 The pressed look and the colours of the keys (FR-008, FR-009)

**Decision**: white keys `#fdfdfb` with a 1 px `#555` divider, black keys `#1b1b1b` with a slightly lighter lower edge
(a 2-colour gradient, the only "3D" hint, spec Assumptions "basic"); a pressed white key turns today's `#ffcccc`, a
pressed black key `#6b2020` (dark red), both with a short inset shadow at the top so the key reads as pushed down,
and today's red dot (`red`) - on black keys with a light ring. Colours are fixed (not theme tokens): the app has no
themes, and an instrument's keys are white and black whatever the page colour.

**Rationale**: keeps today's pressed colour on white keys (no change in meaning), makes the black key's pressed state
visible (SC-004: pressed vs none must differ in greyscale: `#1b1b1b` vs `#6b2020` differ in lightness, and the dot
with its ring is a shape cue).

**Alternatives considered**: a single pressed colour for both (a light colour on a black key reads as a white key); no
shade change, dot only (spec AS-2.1 asks for a pressed look).

## R-5 C labels (FR-007)

**Decision**: every C (MIDI 24, 36, ..., 108) carries `.key-label` with its scientific pitch name, C1 ... C8 (middle C
= MIDI 60 = C4, from the existing `midiNoteName` in `src/ui/format/note-name.ts`, which Practice help already uses),
small grey text centred at the
bottom of the key, `pointer-events: none`, never over a marking (R-3 stacking). No other key is labelled.

**Rationale**: owner's answer (spec Clarifications 2026-09-26).

**Alternatives considered**: labels only on middle C (not asked); letters on every white key (rejected by the owner).

## R-6 How the look is tested

**Decision**: (1) the pure layout (`keyboardLayout`) is unit-tested in Node: 88 keys, 52 white / 36 black, A0 first and
C8 last, the black-key pattern per octave, the equal-top centres of R-1, black keys inside their two white keys, no two
black keys overlapping, labels C1-C8 on MIDI 24-108; (2) the element keeps its unit tests (`[data-key]`, classes) and
gains `white`/`black` classes and C labels; (3) a Playwright spec measures the real layout at 1024, 1280, 1600, 1920
and 2560 px wide (every key inside the window, no horizontal scroll, white keys contiguous, black keys on top and
between their neighbours, aspect ratio or height cap - SC-001, SC-002, SC-006), and checks that each marking's box
lies inside its own key and that states on black keys have visible (non-transparent, contrasting) marks (SC-004,
SC-007); (4) pictures via `pnpm screenshot` (normal and greyscale) are looked at for SC-003/SC-004 and shown to the
owner.

**Rationale**: happy-dom lays nothing out and does not implement container units, so geometry is asserted where it is
real (browser), and the rules where they are pure (Node).

**Alternatives considered**: pixel-diff golden images (fragile across font rendering and engines).
