# Feature Specification: Score-First Application Window

**Feature Branch**: `004-score-first-layout`
**Created**: 2026-09-21
**Status**: Draft
**Input**: User description: "this is laptop screen 1080p, improve program window. The program should be mainly showing score/sheets. Other things should be minimalistic, overlapping, or hidden in menus and popups."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The Score fills the window (Priority: P1)

A musician opens Musicanyya on a 1080p laptop and loads a Score. The music itself takes up
practically the whole window, like a sheet of printed music on a stand. Nothing is permanently
docked to the left, the right or the bottom: the only always-visible chrome is one slim bar
with the few controls needed to start playing.

**Why this priority**: This is the entire point of the change. Today fixed side panels and a tall
header squeeze the Score into a narrow column, so almost no music is readable at once. Fixing the
base layout delivers value even if every other story is dropped.

**Independent Test**: Open a multi-page MusicXML file in a maximised window on a 1920x1080 screen
and measure the area given to the Score view: the Score occupies the full window width and all
window height except one slim control bar, and at least two systems of a typical piano score are
fully readable without scrolling.

**Acceptance Scenarios**:

1. **Given** a maximised window on a 1080p screen and a loaded Score, **When** the user looks at the
   window, **Then** the Score view spans the full window width and at least 90% of the window height,
   and no side panel or bottom panel reserves any space.
2. **Given** a loaded Score, **When** the user has not opened any menu or popup, **Then** the only
   chrome visible is one slim bar no taller than 48 px at 100% OS scaling, plus transient notices.
3. **Given** no Score is loaded, **When** the app starts, **Then** the whole Score area shows a single
   clear invitation to open or drop a MusicXML file, with the open action reachable in one click.
4. **Given** a loaded Score, **When** the user resizes the window between 1280x720 and 2560x1440,
   **Then** the Score re-flows to the new size, the chrome stays one slim bar, and nothing is clipped
   or overlapped in a way that hides notation.

---

### User Story 2 - Secondary tools live in menus and popups (Priority: P2)

Everything that is not the Score - recent scores, MIDI keyboard connection, environment and
permission status, audio diagnostics, notation-support help, latency calibration - is reached from a
small number of menu entries in the slim bar. Each opens as a popup over the Score, and closes again,
returning the full window to the music.

**Why this priority**: These panels are what currently steals the Score's space. Moving them behind
menus is what makes Story 1 hold over time, but Story 1 is already valuable on its own.

**Independent Test**: With a Score loaded, open each secondary tool from the menu in turn: each one
appears as a popup over the Score, only one is open at a time, Escape closes it, and afterwards the
Score is back to its full size.

**Acceptance Scenarios**:

1. **Given** a loaded Score, **When** the user opens any secondary tool, **Then** it appears as a popup
   layered over the Score and the Score view keeps its size and scroll position underneath.
2. **Given** a secondary tool is open, **When** the user opens a different one, **Then** the first one
   closes, so at most one popup is open at a time.
3. **Given** a secondary tool is open, **When** the user presses Escape, clicks outside it, or activates
   its close control, **Then** it closes and keyboard focus returns to the control that opened it.
4. **Given** a secondary tool is open, **When** the user starts a Listen, Practice or Play session,
   **Then** the popup closes automatically and the session starts without any modal interruption.
5. **Given** any popup is open, **When** the user navigates with the keyboard only, **Then** every
   control inside the popup is reachable and the popup can be dismissed without a mouse.

---

### User Story 3 - Mode setup before the run, minimal chrome during it (Priority: P2)

Practice and Play setup (part, hands, loop or measure range, tempo, strictness, count-in,
accompaniment) is chosen in a popup before starting. Once a run is going, that setup disappears and
only a minimal status strip remains: what mode is running, where the run is, and how to stop it.

**Why this priority**: Mode panels are the largest remaining space consumers, and during a run the
musician's eyes belong on the notes, not on settings they cannot change anyway.

**Independent Test**: Choose Practice mode, adjust the settings in the setup popup, start the run: the
setup popup is gone, the Score is at full size, and the slim bar shows mode, position and a Stop
control that works.

**Acceptance Scenarios**:

1. **Given** Practice or Play mode is selected and no run is active, **When** the user opens mode setup,
   **Then** all settings for that mode are available in one popup over the Score.
2. **Given** a run is active, **When** the user looks at the window, **Then** no setup controls are
   shown, and mode, current measure and a Stop control are visible in the slim bar at all times.
3. **Given** a run is active, **When** any message or status must be shown (device lost, count-in,
   waiting for a note), **Then** it appears without a modal dialog and without covering the notes of
   the current system.
4. **Given** a run has just ended in Play mode, **When** the Grade is ready, **Then** the Grade is
   presented over the Score in a dismissible panel, and dismissing it returns the full window to the
   Score with the graded marks still on the notes.

---

### User Story 4 - Overlays never hide the music (Priority: P3)

The slim bar, notices and popups may overlap the Score, but never the notation the musician is
currently reading. When the cursor moves under a floating element, the Score scrolls or the element
gets out of the way.

**Why this priority**: Overlapping chrome is explicitly wanted for space, but an overlay that covers
the note being played would break the core promise of the app.

**Independent Test**: Start Listen mode on a score long enough to scroll; watch the cursor pass the
top and bottom edges of the viewport: the current system is never underneath the slim bar, a notice or
an open popup.

**Acceptance Scenarios**:

1. **Given** a run is active and floating chrome overlaps the Score area, **When** the cursor reaches a
   system that would sit under that chrome, **Then** the Score view keeps the current system fully
   visible in clear space.
2. **Given** notices appear during a run, **When** several arrive at once, **Then** they stack in one
   corner, never grow beyond a bounded area, and disappear on their own or on dismissal.
3. **Given** any floating element is shown over the Score, **When** the user wants the bare Score,
   **Then** each optional overlay layer can be switched off from the menu.

---

### Edge Cases

- **Window too small for the slim bar's controls**: at widths below the design minimum, secondary
  controls collapse into an overflow menu instead of wrapping into a second row that steals height.
- **MIDI keyboard unplugged mid-run**: the notice appears in the notice area, not as a dialog, and the
  slim bar's status reflects the device state; no layout jump.
- **Audio device lost mid-run**: same - a notice plus status, no modal, no change of Score size.
- **Malformed or unsupported MusicXML**: the failure message is shown in the empty Score area (or as a
  notice if a Score was already open); the layout stays score-first.
- **Very long or very dense scores**: the layout gives the Score the same space regardless of score
  length; scrolling and page navigation are the only differences.
- **Grade panel plus notices at the same time**: they do not overlap each other or the current system.
- **High OS display scaling (125-175%) on a 1080p laptop**: chrome stays proportionally slim; the Score
  keeps at least the same share of the window.
- **A popup is open when a notice arrives**: the notice is still readable, and it never steals focus.
- **Electron and browser Shells**: the layout is identical; the browser's own toolbar reduces available
  height, which the layout absorbs by shrinking the Score area, never by adding chrome.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application window MUST give the Score view the full window width and all remaining
  height after exactly one slim control bar; no other element may permanently reserve layout space.
- **FR-002**: The slim control bar MUST contain only: mode selection, the transport controls for the
  current mode, score-open access, the Score size controls (FR-014a), a menu (or small set of menus)
  for everything else, and a compact status area (mode, position, device/engine state).
- **FR-003**: All secondary tools - recent scores, MIDI connection, environment/permission status,
  audio diagnostics, notation-support help, latency calibration - MUST be reachable only from that
  menu and MUST open as popups layered over the Score.
- **FR-004**: At most one secondary popup MUST be open at a time; opening another closes the first.
- **FR-005**: Every popup MUST be dismissible with Escape, with an explicit close control, and by
  clicking outside it, and MUST return keyboard focus to the control that opened it.
- **FR-006**: No popup, panel or message may be modal during an active Listen, Practice or Play
  session; starting a session MUST close any open popup.
- **FR-007**: Practice and Play setup MUST be presented in a popup before the run and MUST NOT be
  displayed while the run is active.
- **FR-008**: While a run is active the app MUST always show, in the slim bar, the current mode, the
  current measure, and a Stop control that ends the run in one activation.
- **FR-009**: The Play-mode Grade MUST be presented over the Score in a dismissible panel, and
  dismissing it MUST leave the per-note Grade marks on the Score.
- **FR-010**: Floating chrome MUST NOT cover the system that contains the playback/practice cursor; the
  Score view MUST keep that system in clear space while a run is active.
- **FR-011**: Notices MUST appear in one bounded, non-modal area that never expands to hide notation,
  and MUST NOT take keyboard focus.
- **FR-012**: The user MUST be able to switch each optional overlay layer (cursor overlay, feedback
  marks, Advice markers, on-screen piano keys, notice area) off and on from the menu.
- **FR-013**: The layout MUST work without horizontal clipping or hidden controls for window sizes from
  1280x720 up to 2560x1440 and for OS display scaling from 100% to 175%.
- **FR-014**: The Score MUST be scaled by default so that the page width fills the available Score
  width, and MUST re-fit whenever the window is resized.
- **FR-014a**: The user MUST be able to enlarge or reduce the Score in visible, always-reachable steps
  (a "larger" and a "smaller" control in the slim bar, plus keyboard equivalents), with a control to
  return to the default size. Enlarging MUST re-flow the music - fewer measures per system, larger
  staves - so the page always stays within the window width; horizontal scrolling MUST never be needed.
  *(Amended 2026-09-21 during planning: the first wording allowed horizontal scrolling when enlarged.
  The engraving engine re-flows instead, which is both better for reading and simpler; see
  research.md R-2.)*
- **FR-014b**: The enlargement range MUST cover at least 50% to 200% of the default size, in steps no
  coarser than 10%, so a musician with reduced sight can make staves substantially bigger.
- **FR-015**: The on-screen piano keys MUST be hidden by default and shown only when the user switches
  them on from the menu; the choice is remembered (FR-019).
- **FR-016**: The empty state (no Score loaded) MUST occupy the Score area with a single invitation to
  open or drop a file, and MUST accept a dropped MusicXML file anywhere in the Score area.
- **FR-017**: Every control that leaves the slim bar MUST remain reachable by keyboard, with its
  existing keyboard shortcut unchanged where one exists.
- **FR-018**: The layout MUST NOT change the musical behaviour of any mode: the same Score, inputs and
  settings MUST produce the same playback, feedback and Grade as before.
- **FR-019**: The user's layout preferences (which overlays are on, the chosen zoom/scaling) MUST be
  remembered for the next session on the same device.
- **FR-020**: Opening, closing and resizing popups MUST NOT re-layout or re-render the Score in a way
  that loses the scroll position or the current run's cursor position.

### Key Entities

- **Layout preference**: the user's persisted view choices - score scaling/zoom, which overlay layers
  are enabled, notice area on/off. Belongs to the device, not to a Score.
- **Menu group**: a named set of secondary tools reachable from the slim bar (e.g. "Score", "Setup",
  "Diagnostics", "Help"), each entry opening exactly one popup.
- **Run status**: the compact, always-visible description of what is happening now - mode, current
  measure, device and engine state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With a Score loaded and no popup open, in a maximised window on a 1920x1080 screen, the
  Score view occupies at least 90% of the window height and 100% of its width.
- **SC-002**: In that same window, at least 2 systems of a two-staff piano score are fully visible and
  readable without scrolling (today: effectively none, because the Score column is too narrow).
- **SC-003**: Every secondary tool is reachable in at most 2 activations (one menu, one entry) from the
  slim bar, and closed again in 1 (Escape).
- **SC-004**: During an active run, the number of on-screen elements other than the Score, the slim bar
  and transient notices is zero.
- **SC-005**: Over a full Listen run of a 100-measure score, the system containing the cursor is never
  covered by chrome in any frame sampled at 10 Hz.
- **SC-006**: The app remains usable - no clipped controls, no horizontal page scrollbar, no hidden
  actions - at 1280x720, 1366x768, 1600x900, 1920x1080 and 2560x1440, at 100% and 150% scaling.
- **SC-007**: Opening or closing any popup completes within 100 ms and never causes a main-thread task
  longer than 50 ms during an active session.
- **SC-008**: A returning user's layout preferences - enlargement level and which overlays are on - are
  restored on the next launch in 100% of cases where device storage is available.
- **SC-008a**: From the fitted size, a musician can make the staves at least twice as tall using only
  controls visible in the slim bar, in at most 10 activations, without opening any menu.
- **SC-009**: All existing mode, timing and grading tests still pass unchanged, confirming the layout
  change is behaviour-neutral.

## Assumptions

- The reference target is a 1080p laptop (1920x1080, 100-150% OS scaling), maximised window. Smaller
  (1280x720) and larger (2560x1440) sizes must work but are not optimised for.
- Touch and phone-sized screens are out of scope for this feature; mouse plus keyboard is assumed.
- "Slim bar" means a single horizontal row at the top of the window, at most 48 px tall at 100% scaling.
  It may be opaque and reserve that height, since it is the only chrome that does.
- The Score view keeps its current paging and scrolling behaviour; only its size and surrounding chrome
  change.
- Accessibility for reduced sight is served by the Score size controls (FR-014a/b) rather than by a
  separate large-print mode; the slim bar's own text scales with the OS/browser text size.
- Existing keyboard shortcuts keep working; this feature may add shortcuts for menus and popups but
  changes none, with one deliberate exception: Escape now closes an open popup first and only otherwise
  stops a run (research R-4). In particular the bare `+` / `-` Score-size keys stay, and `Ctrl/Cmd +`,
  `Ctrl/Cmd -` and `Ctrl/Cmd 0` are added beside them.
- No new information is added to the UI: every panel that exists today survives, just relocated.
- The notice area sits in a corner of the Score area (bottom-right), bounded to a few stacked notices.
- The feature applies to the browser and Electron Shells identically; the Native audio plugin has no UI
  of its own here.

## Out of Scope

- Any change to MusicXML parsing, playback, Practice wait-mode logic, grading or Advice.
- A new visual design system (colours, fonts, iconography) beyond what is needed to make chrome slim.
- Multi-window, detachable panels, or a full-screen/kiosk mode beyond what the OS already offers.
- Touch, tablet and phone layouts.
- Printing or exporting the Score.
