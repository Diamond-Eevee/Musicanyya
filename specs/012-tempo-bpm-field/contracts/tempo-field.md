# Contract: `mx-tempo-field` (UI element)

**Version**: `1.0.0` (new, feature 012). The custom element `src/ui/elements/mx-tempo-field.ts`, used by
`mx-transport` (all modes) and `mx-play-panel` (Play setup). No UI framework (Constitution V). States:
[data-model.md](../data-model.md) section 6. Behaviour: [research.md](../research.md) R-6 to R-8.

## Inputs (properties, set by the host)

```ts
interface TempoFieldModel {
  segment: TempoDisplaySegment | null; // null = no Score: the element is hidden
  percent: number;                     // the factor in force (transport or Play settings)
  locked: boolean;                     // a Play run is active (FR-017)
  glyphs: HarvestedGlyphs | null;      // for the beat symbol; null = text label (R-7)
}
set model(value: TempoFieldModel);
```

The host passes a new model whenever the segment, the factor, the lock or the glyphs change. Setting the model never
replaces the element's DOM subtree; it updates text nodes, attributes and - only when the input holds no unapplied
typed text - the input's value. (Refined in implementation, T034: the test is "edited", not "focused", so a focused
field that was only stepped with ArrowUp/ArrowDown keeps following the tempo; typed text is never overwritten.)

## Output (event)

```ts
// Bubbles, composed. `percent` is already clamped (percentForBpm) - the host just applies it.
new CustomEvent<{ percent: number; source: 'typed' | 'step' | 'reset' }>('tempochange', { bubbles: true, composed: true });
```

Hosts: Listen / Practice -> `transportState.setTempo(percent)`; Play -> the Play setup change `{ tempoPercent }`
(both instances edit the same value in Play mode).

## DOM contract (for unit and e2e tests; stable selectors)

| Selector | What |
|---|---|
| `mx-tempo-field` | host; `data-default` present when `segment.isDefault` |
| `[data-id="tempo-label"]` | the word "Tempo" (`en.transport.tempo`) |
| `input[data-id="tempo-bpm"]` | `type="text" inputmode="numeric" autocomplete="off" role="spinbutton"`, `aria-valuenow/min/max`, `aria-valuetext` e.g. "72 beats per minute, dotted quarter note"; `readonly` when locked |
| `[data-id="tempo-unit"]` | "BPM" |
| `[data-id="tempo-beat"]` | beat symbol (inline SVG, `aria-hidden="true"`) or text label; absent for a quarter-note beat |
| `button[data-id="tempo-down"]` / `button[data-id="tempo-up"]` | -1 / +1 BPM; disabled at the limit or when locked |
| `button[data-id="tempo-reset"]` | back to written tempo; disabled when `percent === 100` or locked |
| `[data-id="tempo-written"]` | "written 90" (or "default"); hidden when the whole numbers are equal and not default |

## Keyboard

| Key (focus in the input) | Effect |
|---|---|
| digits | edit text only; no shortcut fires (`isTextEntry`) |
| Enter | apply (`source: 'typed'`); the input keeps focus |
| Escape | restore shown value; nothing emitted; the key does not reach global Escape handling |
| ArrowUp / ArrowDown | +1 / -1 BPM from the shown value, emitted at once (`source: 'step'`) |
| Tab / blur | apply like Enter when the text is a valid number, else restore |

Apply rule: text that is, after trimming, 1 to `TEMPO_BPM_DIGITS_MAX` (4) digits -> `percentForBpm(segment, n)`; if
the resulting shown value equals the current one and the percent equals the current percent, nothing is emitted.
Anything else -> restore.

## Layout

One line: `Tempo [-] [ 72 ] BPM <beat> [+] [reset]  written 90`. The input is wide enough for four digits; at 375 px
width the "written" hint may wrap below, but the number, unit, beat and step buttons never truncate (SC-004).
Font size of number and unit >= the other transport labels (FR-006).
