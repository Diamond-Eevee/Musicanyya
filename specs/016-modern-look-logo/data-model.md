# Data Model: A Modern Look, Themes and a Musicanyya Logo (feature 016)

**Date**: 2026-09-29 | Contracts: [theme.md](contracts/theme.md), [brand.md](contracts/brand.md)

This feature adds no core entity and no IndexedDB data. Everything lives in the UI layer, except for one named
constant block in `src/engine/config.ts`, the project's constants table for the UI and engine layers.

## 1. Theme

| Field | Type | Rule |
|---|---|---|
| `id` | `ThemeId` | one of `paper`, `ivory`, `slate`, `night`, `walnut`, `midnight`; stable |
| `kind` | `'light' \| 'dark'` | paper, ivory, slate = light; night, walnut, midnight = dark |
| palette | CSS tokens (theme.md 3.2) | all tokens defined; contrast and ΔE rules of theme.md 3.2 hold |
| name | i18n `en.theme.names[id]` | "Paper", "Ivory", "Slate", "Night", "Walnut", "Midnight" |

Palette values: research R-5 (the table there is the source; `themes.css` must match it, which the unit test checks).

## 2. Theme choice (persisted)

| Field | Type | Rule |
|---|---|---|
| `version` | `1` | anything else -> `auto` |
| `choice` | `ThemeChoice` = `'auto' \| ThemeId` | unknown -> `auto` |

Stored under `localStorage['musicanyya.theme.v1']`. Per device, never synced.

### State machine (theme store)

```text
            init(): read storage + system
                     |
          +----------v-----------+   setChoice(id)    +-------------------+
          |  AUTO                | -----------------> |  FIXED(id)        |
          |  theme = system ?    | <----------------- |  theme = id       |
          |   night : paper      |  setChoice('auto') |  system change:   |
          |  system change:      |                    |   ignored         |
          |   re-resolve at once |                    +---------+---------+
          +----------------------+                              | setChoice(other id)
                                                                v
                                                          FIXED(other id)
```

Every transition writes `data-theme` and `data-theme-choice` on `<html>` in the same task, then notifies
subscribers. A storage write failure does not change the transition. No transition touches the Score, the session,
or the layout.

## 3. Logo

| Field | Type | Rule |
|---|---|---|
| variant | `'regular' \| 'small'` | `small` below 24 px |
| mark | SVG paths on a 32 x 32 grid | `currentColor`; no text, fonts or images |
| tile | mark `#ffffff` on `#1f3a5f`, `rx` 6/32 | used for every icon file |
| word | text "Musicanyya" | system font, weight 600; the accessible name in the bar |

Generated files and placements: brand.md sections 2 and 3.

## 4. Bar fit state (extends ui-shell 1.2.0)

`roomy` -> `roomy-no-word` -> `compact`, chosen by measurement on each resize (`mx-app`), trying the states in that
order and taking the first that does not overflow. The only new state is `roomy-no-word` (class `.mx-bar-no-word`).

## 5. Named constants (`src/engine/config.ts`)

| Constant | Value | Source |
|---|---|---|
| `THEME_STORAGE_KEY` | `'musicanyya.theme.v1'` | theme.md 2 |
| `THEME_CHOICE_DEFAULT` | `'auto'` | clarification Q3 |
| `THEME_AUTO_LIGHT` | `'paper'` | clarification Q3 |
| `THEME_AUTO_DARK` | `'night'` | clarification Q3 |
| `THEME_ACCENT_MIN_DELTA_E` | `15` | FR-011, research R-5 |
| `THEME_CONTROL_TRANSITION_MS` | `120` | FR-008 (≤ 150), research R-8 |
| `CHROME_FOCUS_RING_PX` | `2` | FR-006 |
| `BRAND_SMALL_BELOW_PX` | `24` | brand.md 1 |

The fixed Score colours `--score-paper` `#ffffff` and `--score-ink` `#000000` are CSS tokens in `tokens.css`, next to
the feedback colours. They are not constants, because nothing in TypeScript reads them.
