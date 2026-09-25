# Data Model: On-Screen Piano That Looks Like a Real Keyboard

Feature 010. No stored data changes: no settings, no IndexedDB, no `localStorage` key, no worker or worklet message.
The only new data is the keyboard's geometry, computed by a pure function (research R-1).

## 1. Piano key geometry (`src/ui/piano/keyboard-layout.ts`, pure, no DOM)

```ts
type KeyColour = 'white' | 'black';

interface PianoKeyGeometry {
  key: number;          // MIDI key, 21 (A0) ... 108 (C8)
  colour: KeyColour;
  left: number;         // left edge, as a fraction of the keyboard width (0 ... 1)
  width: number;        // as a fraction of the keyboard width
  length: number;       // as a fraction of the keyboard height: 1 for white keys, BLACK_KEY_LENGTH_RATIO for black
  label: string | null; // 'C1' ... 'C8' on the C keys (midiNoteName), null on every other key
}
```

Validation rules (all tested, research R-6):

- exactly 88 entries, ordered by `key`, 21 ... 108; 52 white, 36 black;
- a key is black exactly when its pitch class is 1, 3, 6, 8 or 10;
- white key `i` (0-based among white keys) has `left = i / 52`, `width = 1 / 52`; the last white key ends at 1;
- a black key's centre is at `(whiteIndexOfGroupStart + centreInGroup) / 52` with the centres of research R-1, and its
  `width = BLACK_KEY_WIDTH_RATIO / 52`; it lies strictly inside the two white keys it sits between; no two black keys
  overlap;
- `label` is non-null exactly for MIDI 24, 36, 48, 60, 72, 84, 96, 108, and equals `midiNoteName(key)`.

## 2. Key display state (unchanged, for reference)

A key's look is derived on every `midiState` / `practiceState` change, as today (001, 002, 008):

| Source | Class on `.key` | Mark |
|---|---|---|
| held on the MIDI keyboard (`midiState.pressedKeys`) | `pressed` | pressed shade + red dot (`.key-dot`, new element; was `::after`) |
| Practice key feedback `wrongPitch` / `wrongOctave` / `extra` | `wrong-pitch` / `wrong-octave` / `extra` | coloured outline + glyph ✕ / ▢ / ◆ in `.key-mark` |
| Practice help (`practiceState.helpOverlay.keys`) | `expected-help` | blue outline + glow + "?" |

A wrong-key glyph wins over the help glyph on the same key (002 R-14, unchanged). Several classes can be on one key at
once (e.g. `pressed` and `wrong-pitch`).

## 3. Named constants (`src/engine/config.ts`, beside `OVERLAYS_DEFAULT`)

| Constant | Value | Meaning |
|---|---|---|
| `PIANO_KEY_LOW` | 21 | lowest key shown (A0) |
| `PIANO_KEY_HIGH` | 108 | highest key shown (C8) |
| `BLACK_KEY_WIDTH_RATIO` | 0.58 | black key width / white key width |
| `BLACK_KEY_LENGTH_RATIO` | 0.64 | black key length / white key length |
| `WHITE_KEY_ASPECT` | 4 | white key length / width before the height cap (spec FR-005) |
| `PIANO_KEYS_MAX_HEIGHT_PX` | 160 | height cap of the keys, in CSS pixels |
| `PIANO_KEYS_MAX_HEIGHT_VH` | 20 | height cap of the keys, in % of the window height |

The number of white keys (52) is derived from `PIANO_KEY_LOW` / `PIANO_KEY_HIGH`, not a separate constant.

Two styling constants live in `src/ui/elements/mx-piano-keys.ts` beside the CSS that uses them (presentation only, not
timing or grading): `KEYBOARD_INLINE_PADDING_PX = 4` (room left of the first and right of the last key) and
`MARKING_MAX_SHARE = 0.9` (a badge or dot on a black key is at most this share of the key's width).

Marking sizes (in the element's CSS, from the white-key width `w`): glyph `clamp(8px, 0.5 w, 12px)`, dot
`clamp(5px, 0.3 w, 10px)`, label `clamp(7px, 0.45 w, 11px)`; on a black key the badge is at most `min(0.9 x its width,
12px)` and the dot at most `min(0.9 x its width, 10px)`, the glyph in the badge 0.8 of the badge.
