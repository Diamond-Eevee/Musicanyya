# Contract changes to earlier features (feature 016)

Each change is applied to the named contract file with the version bump shown, as part of the implementation tasks
(AGENTS.md section 6: contract first, then code). Reasons: [research.md](../research.md).

| Contract | From -> to | Change |
|---|---|---|
| `004/contracts/ui-shell.md` | 1.1.0 -> **1.2.0** (MINOR) | Section 2: new first bar slot `#brand` (logo, [brand.md](brand.md)), not focusable, not a toolbar item; the fit order gains a step between roomy and compact (`.mx-bar-no-word`, R-11). Section 3: the View popup gains the Theme choice ([theme.md](theme.md), R-12). Section 6: notices carry an icon with an accessible name ("Information" / "Warning", R-9); every focusable control has a visible `:focus-visible` ring (FR-006). |
| `001/contracts/storage.md` | note only (no schema change) | New `localStorage` key `musicanyya.theme.v1` ([theme.md](theme.md) section 2). IndexedDB schema unchanged (3). |
| `004/contracts/view-settings.md` | unchanged (2.1.0) | The theme is deliberately **not** a field of `musicanyya.settings.v1` (theme.md section 2 gives the reason). |
| `010/contracts/piano-keyboard.md` | 1.2.0 -> **1.2.1** (PATCH) | The host's frame and background come from `--mx-surface` / `--mx-border`; key colours, sizes and markings are unchanged and not themed. |
| `015/contracts/score-layout.md` | 2.2.0 -> **2.2.1** (PATCH) | Clarifies that the white page comes from `.mx-score-stack` (`--score-paper`) and the area around it is the theme's desk (R-4); no geometry change, G-1 to G-6 unchanged. |
| `001/contracts/electron-bridge.md` | unchanged | No new channel: the main process picks the start background from `nativeTheme` itself (R-3). |
