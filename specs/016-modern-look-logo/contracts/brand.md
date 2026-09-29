# Contract: the Musicanyya logo (mark, placements, generated icon files)

**Version**: `1.0.0` (new with feature 016)

**Owner**: `src/ui/brand/logo.ts` (artwork source), `tools/brand/build-icons.ts` (`pnpm brand:icons`), placements
in `src/ui/elements/mx-app.ts` (bar), `src/ui/elements/mx-drop-zone.ts` (empty state), `index.html` (tab icon),
`electron/main.ts` + `electron-builder.yml` (window, taskbar, installer). Research: R-10, R-11.

---

## 1. Artwork

- The mark is two stems-up eighth notes joined at the stem tops by two beam-weight strokes meeting in a central
  valley, so that the stems and strokes read as an **M**. Filled note heads sit at the stem feet.
- It is drawn on a 32 x 32 unit `viewBox`, paths only (no `<text>`, no font outlines, no raster images), with
  `fill="currentColor"`.
- There are two variants: `regular` (for 24 px and larger) and `small` (for 16 to 23 px, heavier strokes, larger heads).
- The tile is the mark in `#ffffff` on a rounded square (`rx` = 6 of 32) of `#1f3a5f`. It is used for every file in
  section 3.
- It is original work of the project. It has no third-party notice and no licence file (spec FR-017).

```ts
export type LogoVariant = 'regular' | 'small';
export function logoMarkSvg(opts: { variant?: LogoVariant; title?: string }): string; // aria-hidden unless title
export function logoTileSvg(size: number): string; // picks the variant from size
```

The artwork is final only after owner approval (spec SC-007, gate OD-1). Until then the files may change, but not
their paths or the API above.

## 2. Placements

| Where | What | Accessibility |
|---|---|---|
| Bar, first slot `#brand` (ui-shell 1.2.0) | mark at 24 px + word "Musicanyya" (system font, 600) | mark `aria-hidden`; the word is the name, visually hidden (not removed) when the bar hides it; not focusable |
| Empty state (`mx-drop-zone .mx-empty-state`) | mark at 64 px above the existing text | `aria-hidden` (the invitation text beside it is unchanged) |
| Browser tab | `favicon.svg` (tile), `favicon-32.png` fallback | - |
| Electron window + taskbar | `BrowserWindow({ icon })` = `build/icon.png` in dev; the packaged exe's icon in production | - |
| Windows installer + exe | `electron-builder.yml` `win.icon: build/icon.ico` | - |

The bar's fit order (research R-11) is: roomy with word, then roomy without word (`.mx-bar-no-word`), then compact.

## 3. Generated files (`pnpm brand:icons`)

| File | Content | Committed |
|---|---|---|
| `public/favicon.svg` | tile, `regular` | yes |
| `public/favicon-32.png` | tile at 32 px | yes |
| `build/icon.ico` | tile at 16, 24, 32, 48, 64, 128, 256 px, PNG-compressed entries | yes |
| `build/icon.png` | tile at 512 px | yes |
| `tests/.generated/brand-sheet.png` | owner review sheet: every size on the six themes' surfaces | no (git-ignored) |

The tool is deterministic for a given Chromium build. The committed files are regenerated only when `logo.ts`
changes, and a unit test checks that `favicon.svg` equals `logoTileSvg(32)`.
