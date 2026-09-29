# Feature Specification: A Modern Look, Themes and a Musicanyya Logo

**Feature Branch**: `016-modern-look-logo`
**Created**: 2026-09-29
**Status**: Draft
**Input**: User description: "improve layout to be more modern. Note sheets can be white&black (they will have
professional and natural feelings), but menus, buttons etc. Make them look a little better (they should in pallete
that fits white&black sheets). Also add some musicanyaa simple but nice logo. Like double note that is suggesting M
or something."

## Clarifications

### Session 2026-09-29

- Q: In a dark theme, what should the Score pages look like? -> A: The paper stays light. Dark themes darken only
  the chrome around the Score (bar, menus, panels, the area around the pages); the pages keep black notation on
  light paper, like a lit sheet on a dark desk.
- Q: Which themes should ship? -> A: Three light and three dark themes. Light: **Paper** (warm off-white, ink-blue
  accent; the default), **Ivory** (cream, burgundy accent), **Slate** (cool grey, teal accent). Dark: **Night**
  (near-black, ink-blue accent), **Walnut** (dark brown wood, brass accent), **Midnight** (deep navy, soft violet
  accent).
- Q: Which theme does a first-time user get? -> A: Follow the system. The theme choice has an **Automatic** entry,
  selected until the user picks a theme: Paper when the operating system is in light mode, Night when it is in dark
  mode. A theme picked by hand wins from then on; picking Automatic again restores following the system.
- Q: Does the paper colour of the pages change with the theme? -> A: No. The pages are pure white with black
  notation in every theme, so the Score is pixel-identical across all six themes.
- Q (OD-1, SC-007): Is the logo artwork approved? -> A: Yes, owner approved 2026-09-29 from
  `tests/.generated/brand-sheet.png` (commit eca8304), as drawn: the M-shaped double-note mark, the ink-blue tile
  unchanged (its low contrast on the Midnight surface was shown and accepted).

## Context

Today every control around the Score uses the browser's default look: grey system buttons, plain drop-downs, thin
grey borders, and default text sizes and spacing. The Score browser (feature 013) is one dense block of same-weight
text. The app has no logo: the browser tab, the Electron window and the installer show a generic icon.

This feature changes how the **chrome** looks: the bar, menus, buttons, fields, popup panels, the Score browser,
notices, the empty state and the frame around the on-screen piano. It adds a logo. The **Score stays exactly as it
is**: black notation on white pages, in every theme. The chrome gets a quiet palette that suits those pages, in one of
six themes (three light, three dark) the user can choose. Apart from that choice, this feature changes only the look.
Nothing else a user can do, and no wording, changes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A calm, consistent look around the Score (Priority: P1)

A musician opens Musicanyya and sees a clean, modern window. The bar at the top, its menus and buttons, the transport
(Play/Stop, tempo, volume, Follow), the mode switch and the popup panels share one look. They use one palette of
warm paper and ink tones with a single accent colour, the same corner rounding, the same spacing and the same text
sizes. Every control shows clearly when the pointer is over it, when it is pressed, when it has keyboard focus, when
it is switched on and when it is unavailable. The engraved Score in the middle stays black on white and is still what
the eye goes to first.

**Why this priority**: the bar and panels are on screen for the whole session. Bringing them into one look delivers
most of the "more modern" impression by itself, and later stories reuse its palette and control styles.

**Independent Test**: open a library Score in the browser at 1280 x 800 and at 390 x 844. Take screenshots of the
bar, each bar menu open, the View, Setup and Practice popups, and a Listen session. Compare them with screenshots of
`main` at the same sizes: every control uses the new styles, the Score pages are unchanged pixel for pixel, and every
control is still in the same place in the same order.

**Acceptance Scenarios**:

1. **Given** a Score is open, **When** the window is shown, **Then** every button, menu, drop-down, checkbox,
   slider, number field and text field in the bar and the popups uses the new styles, and none shows the browser's
   default grey look.
2. **Given** a Score is open, **When** the user moves the keyboard focus through the bar with Tab, **Then** every
   focused control has a clearly visible focus ring that the rest of the bar does not hide.
3. **Given** Listen, Practice or Play is running, **When** the user looks at the bar, **Then** the running state (the
   active mode, Play shown as active, the run status) is shown by more than colour: a filled or outlined shape, an
   icon or text.
4. **Given** a control is unavailable (for example Play before a Score is open), **When** it is shown, **Then** it
   clearly looks unavailable and does not react to hover.
5. **Given** any Score, **When** its pages are drawn, **Then** notation, page background, title block, cursor, Practice
   marks and Grade marks look exactly as before this feature.

---

### User Story 2 - A Musicanyya logo (Priority: P1)

The musician sees a simple, recognisable Musicanyya logo: two joined notes (a double note with one beam) whose
stems and beam together suggest the letter **M**. It appears at the start of the bar, as the browser tab icon
(favicon), as the Electron window and taskbar icon, as the installer icon, and in the empty state shown before a
Score is open.

**Why this priority**: it gives the app an identity. It is small and independent of the rest, so it can ship
alone. The owner asked for it explicitly.

**Independent Test**: open the app in the browser with no Score open. The logo shows in the bar, in the empty state and
in the tab. Build and start the Electron app: the logo shows as the window and taskbar icon. Check each size (16 px
tab icon to 256 px installer icon) by eye: at 16 px it still reads as two joined notes.

**Acceptance Scenarios**:

1. **Given** the app is open, **When** the user looks at the start of the bar, **Then** the logo is shown with the
   word "Musicanyya" at wide widths, or the logo alone at narrow widths, and it never pushes a control out of the bar.
2. **Given** the browser tab, **When** it is shown, **Then** its icon is the logo, including in a browser's dark tab
   strip.
3. **Given** the Electron app (Windows), **When** it is started or installed, **Then** the window, taskbar and
   installer show the logo.
4. **Given** no Score is open, **When** the empty state is shown, **Then** it shows the logo above the existing text
   and "Open score" action.
5. **Given** a screen reader, **When** it reaches the logo in the bar, **Then** it announces "Musicanyya" once and
   does not treat the picture as a separate unlabelled image.

---

### User Story 3 - An easier-to-scan Score browser (Priority: P2)

The Score browser (the "Scores" dialog) keeps its content, filters, order and keyboard behaviour. It becomes easier to
read. Each row puts the title first and makes it stronger; composer, level, key and length follow in a quieter style;
progress is a compact status badge with the numbers after it. The selected row is clearly marked. The rail on the
left groups its sections visibly. The detail pane uses headings and spacing instead of one long block of text, and
its **Open** action is the one clearly primary button. Filters and search look like the rest of the app.

**Why this priority**: it is the densest screen in the app (see the owner's screenshot), so it gains the most from
better hierarchy. It depends on the palette and control styles from Story 1.

**Independent Test**: open the Score browser at 1280 x 800 and at 390 x 844, select "Für Elise" and compare with
`main`. Every piece of text and every control from before is still there in the same order. A first-time user can
find the selected row's title, status and the Open button at a glance.

**Acceptance Scenarios**:

1. **Given** the Score browser is open, **When** the list is shown, **Then** each row shows the title as its most
   prominent text and the other facts in a secondary style, and no text that was there before is missing.
2. **Given** a row is selected, **When** the list is shown, **Then** the selection is visible by more than colour (for
   example a bar at the edge of the row or a changed outline) and survives hover on another row.
3. **Given** the detail pane shows an item, **When** the user looks at it, **Then** the attempts, history and "Where
   this score came from" are separate, headed sections, and **Open** is visibly the primary action.
4. **Given** the keyboard-only flows of feature 013, **When** they are used, **Then** they work exactly as before, with
   a visible focus ring on every focused element.

---

### User Story 4 - Consistent notices, results and piano frame (Priority: P3)

The remaining chrome follows the same look: the notice tray (information and warnings), the Grade panel after Play,
the Practice help, the latency and MIDI panels, the diagnostics list and the frame around the on-screen piano. Each
notice kind has an icon as well as a colour. The on-screen piano's keys keep their realistic look (feature 010); only
the frame and background around them change.

**Why this priority**: these appear less often. They should look consistent, but the app is usable and looks modern
without them.

**Independent Test**: trigger an information notice and a warning, finish a short Play run to show the Grade panel,
and open the MIDI, latency and diagnostics panels. Each uses the new palette and control styles. Warnings are told
apart from information notices by an icon as well as by colour.

**Acceptance Scenarios**:

1. **Given** a warning and an information notice, **When** both are shown, **Then** they differ by an icon and text,
   not only by colour.
2. **Given** the Grade panel, **When** it is shown, **Then** its result colours and shapes are the ones the Score uses
   (unchanged) and the rest follows the new look.
3. **Given** the on-screen piano is shown, **When** keys are pressed, **Then** the keys look and light up exactly as in
   feature 010, and the frame around them matches the bar.

---

### User Story 5 - Choose a theme, light or dark (Priority: P2)

The musician picks one of six themes: three light (Paper, Ivory, Slate) and three dark (Night, Walnut, Midnight). The
theme changes the whole chrome at once: bar, menus, buttons, popups, the Score browser, notices, the empty state, the
area around the pages and the frame around the on-screen piano. The Score pages stay light with black notation in
every theme, so a dark theme looks like a lit sheet on a dark desk. The choice is remembered the next time the app
opens.

**Why this priority**: the owner wants some variety, including dark themes "for fun". It builds on the control
styles of Story 1, which become the Paper theme.

**Independent Test**: open a library Score, open the theme choice, and pick each of the six themes in turn during
Listen. Each time the chrome changes at once, the Score pages and every mark on them stay the same, and nothing
moves. Reload the app: the last theme chosen is still in use.

**Acceptance Scenarios**:

1. **Given** the app is open, **When** the user chooses a theme, **Then** the whole chrome switches to it at once,
   with no reload, and the choice shows which theme is active by more than colour (for example a check mark).
2. **Given** a dark theme, **When** a Score is open, **Then** the pages keep black notation on pure white paper, and the
   cursor, Practice marks and Grade marks look the same as in the light themes.
3. **Given** a Listen, Practice or Play session is running, **When** the user changes the theme, **Then** the session
   goes on undisturbed: no pause, no jump, no change to the Score layout or scroll position.
4. **Given** a first start (no theme chosen yet), **When** the operating system is in dark mode, **Then** the app uses
   Night; in light mode it uses Paper. **When** the system setting changes while the app is open and Automatic is
   selected, **Then** the app follows it at once.
5. **Given** the user chose a theme, **When** the app is opened again (browser or Electron), **Then** that theme is
   used from the first frame, without a flash of another theme.
6. **Given** any of the six themes, **When** the automated contrast check runs on the chrome, **Then** it reports no
   violation.

---

### Edge Cases

- **Narrow windows (phone width, compact bar)**: the logo shrinks to the mark alone. The feature 004/012/013 rules
  still hold: one bar row, nothing wraps, the same controls move to the View popup. New padding must not make the bar
  overflow sooner than today.
- **Forced colours / high contrast (Windows)**: every control is still visible and usable, with system colours taking
  over. Focus rings and selected states stay visible, and the logo stays visible (it follows the text colour).
- **Reduced motion**: any new hover or open/close transitions are switched off when the user asks for reduced motion.
- **Native parts the page cannot fully style** (scrollbars, drop-down lists, number spinners): in dark themes they
  must follow the theme's light or dark kind, never dark on dark or light on light.
- **Stored theme unknown or unreadable** (renamed in a later version, storage cleared or blocked): the app falls back
  to Automatic without an error.
- **On-screen piano in a dark theme**: the keys keep their realistic look (white and black keys); only the frame
  around them follows the theme.
- **Browser zoom 200% and larger system text**: controls grow with the text. Nothing is clipped, and the bar keeps its
  one-row rule (compact mode takes over as it does today).
- **Long titles, composer names and credits** (Score browser rows and detail pane): they truncate with an ellipsis or
  wrap exactly as they do now. The full text stays reachable as it is today.
- **A session is running**: no restyled element may appear, animate or move in a way that covers or shifts the Score
  (Constitution VI: nothing modal, overlays never hide the notes).
- **Electron offline / file:// start**: the logo and all styles come with the app, and no image or font is fetched
  from the network.
- **Malformed or unsupported MusicXML**: the error and notice texts are unchanged and use the new notice style.
- **MIDI device lost mid-session**: the existing notice shows in the new notice style, with its icon.

## Requirements *(mandatory)*

### Functional Requirements

**Palette and look (chrome only)**

- **FR-001**: The chrome MUST be drawn from the active theme's palette: neutral surface and ink tones (backgrounds,
  surfaces, borders, primary and secondary text) plus one accent colour for primary actions, selection and focus.
  Every palette MUST suit black-and-white Score pages: calm, low-saturation surfaces, and no large areas of strong
  colour.
- **FR-002**: In every theme, every text and icon in the chrome MUST reach a contrast of at least 4.5:1 against its background (3:1 for
  large text, icons, focus rings and control borders), in every state (normal, hover, pressed, selected, disabled
  excepted).
- **FR-003**: Buttons, menu buttons, drop-downs, text and number fields, checkboxes, radio buttons, sliders and the
  menu lists MUST each have one consistent style used everywhere they appear (bar, popups, Score browser, dialogs).
  Each style MUST have visible hover, pressed, focus, checked or selected (where applicable) and disabled states.
- **FR-004**: There MUST be exactly one "primary" button style for a screen's main action (e.g. **Open** in the Score
  browser). Every other button uses a quieter style.
- **FR-005**: The chrome MUST use one type scale (a small, fixed set of text sizes and weights) and one spacing scale.
  Corner rounding and shadows MUST be consistent across the bar, popups, Score browser and notices.
- **FR-006**: Keyboard focus MUST be shown with a focus ring that is visible on every focusable chrome element, is at
  least 2 px thick, and is never removed without being replaced.
- **FR-007**: States that are currently shown by colour (active mode, Follow on, selected row, warning notice) MUST also
  be shown by a shape, icon, weight or text change (Constitution VI).
- **FR-008**: Hover and open/close transitions, if any, MUST be short (at most 150 ms). They MUST be switched off when
  the user prefers reduced motion. They MUST never animate anything over the Score during a running session.
- **FR-009**: In forced-colours (high-contrast) mode, every control, its focus ring and its selected state MUST stay
  visible.

**What must not change**

- **FR-010**: The Score's rendering MUST NOT change, in any theme: page background, notation colours, title block, page size and
  layout (feature 015's layout guarantees included), cursor, Practice band, notehead marks, Grade marks and the
  on-screen piano keys MUST look exactly as before.
- **FR-011**: The feedback colours (the colour-blind-safe set used for Grade marks, Practice marks, progress badges and
  the cursor) MUST stay as they are. No theme's accent colour may be one that can be confused with any of them
  where they appear together.
- **FR-012**: Every control, menu entry, label, text, keyboard shortcut, tab order and accessible name MUST stay as it
  is. The only additions are the logo and its accessible name, the notice icons (FR-018) and the theme choice
  (FR-022). Apart from the theme choice, this feature changes no behaviour.
- **FR-013**: The layout rules of features 004, 012 and 013 MUST keep holding: the bar is one row of the same height
  and never wraps, compact mode and the View popup relocation work at the same widths or wider, no popup reserves
  space, and the Score browser covers the window minus the same margins.

**Logo**

- **FR-014**: The app MUST have a logo: a simple mark of two notes joined by one beam (a double note) whose stems and
  beam together suggest the letter **M**, readable in one colour on light and dark backgrounds. There MUST be a
  version for small sizes, legible as two joined notes at 16 x 16 px.
- **FR-015**: The logo MUST appear at the start of the bar (mark plus the word "Musicanyya" when there is room, the mark
  alone in compact mode), as the browser tab icon, as the Electron window, taskbar and installer icon, and in the
  empty state before a Score is open.
- **FR-016**: The logo in the bar MUST have "Musicanyya" as its accessible name exactly once, and MUST NOT take the
  keyboard focus unless it does something. (It does nothing in this feature.)
- **FR-017**: The logo MUST be original artwork made for Musicanyya, owned by the project, and shipped with the app.
  It uses no fonts, images or artwork from a third party (see Assumptions).

**Score browser and remaining chrome**

- **FR-018**: Notices MUST show an icon for their kind (information, warning) as well as their colour.
- **FR-019**: In the Score browser, each row MUST show the title as its most prominent text, the other facts in a
  secondary style, and progress as the existing status badge. The selected row MUST be marked by more than colour.
  The detail pane MUST separate its sections with headings and spacing.
- **FR-020**: The frame and background around the on-screen piano, the Grade panel, Practice help, MIDI, latency and
  diagnostics panels MUST use the palette and control styles of FR-001 to FR-006.

**Themes**

- **FR-022**: Users MUST be able to choose one of six themes: Paper, Ivory and Slate (light), and Night, Walnut and
  Midnight (dark), or **Automatic**. Automatic is the default: it uses Paper while the operating system is in light
  mode and Night while it is in dark mode, and follows a change of that setting at once. The choice MUST be reachable from the View menu at every window width, and
  MUST show the active theme by more than colour.
- **FR-023**: Changing the theme MUST apply to the whole chrome at once, without a reload, and MUST NOT pause, move or
  re-lay out the Score or a running session.
- **FR-024**: The chosen theme MUST be remembered on the device and used from the first frame of the next start, in
  the browser and in Electron. An unknown or unreadable stored theme MUST fall back to Automatic silently.
- **FR-025**: In every theme, including the dark ones, the Score pages MUST keep black notation on pure white paper,
  pixel-identical across themes (FR-010), and the feedback colours MUST stay as they are (FR-011).
- **FR-026**: In dark themes the logo, the focus ring and every state of FR-003 MUST stay clearly visible. Native
  controls MUST follow the theme's light or dark kind (Edge Cases).

**Shells**

- **FR-021**: The look MUST be the same in the browser app and the Electron app, in Chromium, Firefox and WebKit, at
  the widths the existing layout tests cover. It needs no network access.

### Key Entities

- **Theme**: a name (Paper, Ivory, Slate, Night, Walnut, Midnight), a kind (light or dark) and a palette: the named
  colours of the chrome (surface, raised surface, border, ink, secondary ink, accent, text on accent, focus, warning,
  the area around the pages). It sits beside the unchanged feedback colours and the light Score pages.
- **Theme choice**: Automatic or one of the six themes, remembered on the device; Automatic when none or an unknown
  one is stored. Automatic resolves to Paper (system light) or Night (system dark).
- **Control styles**: one look per kind of control, with its states (normal, hover, pressed, focus, checked or
  selected, disabled).
- **Logo**: the mark (two joined notes suggesting M), the word "Musicanyya", and their sizes (bar, tab icon, window,
  taskbar and installer icons, empty state).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Before and after screenshots of the same Score at 1280 x 800 and 390 x 844 show identical Score pages
  (no pixel differs inside the page area) in Listen, Practice and after a graded Play run, in every theme.
- **SC-002**: In each of the six themes, 100% of chrome text and icons meet the contrast levels of FR-002. An
  automated accessibility check on the bar, every popup and the Score browser reports no contrast violations.
- **SC-003**: No control in the bar, popups or Score browser keeps the browser's default look. Each control kind has
  one style, checked on the screenshots of Story 1 and Story 3.
- **SC-004**: With the keyboard alone, the focused element is visibly marked at every step through the bar, a popup
  and the Score browser, in all three browser engines.
- **SC-005**: All existing automated tests (unit, layout, end-to-end) pass unchanged, except for tests that
  deliberately snapshot the chrome's look. Any such test is updated with its reason logged.
- **SC-006**: The compact bar switches on at the same window width as today or wider, never narrower. At 390 px wide
  every control reachable today is still reachable.
- **SC-007**: The logo is recognisable as two joined notes at 16 px and suggests an "M" at 32 px and larger. The owner
  approves it from a sheet showing every size on light and dark backgrounds before it ships.
- **SC-008**: The owner approves the overall look, all six themes included, from the Story 1, 3 and 5 screenshots ("more modern, suits the
  black-and-white sheets") before the feature is merged.
- **SC-009**: Opening a Score and starting playback take no longer than on `main`: within 5% on the same machine, over
  five timed runs each.
- **SC-010**: Switching theme during a running Listen session changes the chrome within one frame, and the playback
  position, scroll position and Score layout are identical before and after.

## Assumptions

- **Score pages stay pure white in every theme**, dark ones included (Clarifications 2026-09-29): black notation on
  white paper. Tinted or inverted (dark) sheets are not part of this feature.
- **Palette direction.** Each theme is low-saturation surfaces plus one muted accent, as named in the
  Clarifications, chosen so it cannot be mistaken for any feedback colour. The exact values are a design decision for
  the plan, checked against FR-002 and FR-011 and approved under SC-008.
- **The theme choice lives in the View menu** (the popup that already holds view settings), so it is reachable at
  every width. It is remembered per device, like the other view settings, and is not synced between devices.
- **System fonts.** The chrome keeps the operating system's font. No web font is added (a font would be a new asset
  with its own licence, which needs owner approval). The title block over the Score keeps its current serif.
- **The logo is drawn for the project** as simple vector artwork, with no typeface outlines, so it has no third-party
  licence. The word "Musicanyya" next to the mark is ordinary text in the system font.
- **Icons** (notices, and any icon added to the chrome) are simple drawings made for the project or text symbols. No
  icon set is added.
- The on-screen piano's keys (feature 010) and every Score overlay are part of "the Score" for FR-010 and are not
  restyled.
- The Native audio plugin has no user interface of its own in this feature, so it is not affected.

## Out of Scope

- Any change to the engraving, the page background, or the colours and shapes of Score feedback.
- Dark (inverted) Score pages, or a paper tint per theme.
- New features, new controls (other than the theme choice), moved controls, renamed labels or changed wording.
- User-made or edited themes, custom accent colours, and syncing the theme between devices.
- A marketing website, splash screen or animated logo.
- Web fonts or third-party icon sets.
