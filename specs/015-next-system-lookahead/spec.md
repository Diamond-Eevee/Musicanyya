# Feature Specification: See the Next System While Playing

**Feature Branch**: `015-next-system-lookahead`
**Created**: 2026-09-28
**Status**: Draft
**Input**: User description: "improve presentation, if we are on second sheet, the third should be shown (scroll
fluently). We should always try to fit at least two sheets on the screen. User should be able to see next sheet, to
know what to play."

## Background

"Sheet" in the request means a **system**: one line of music across the page (for piano, one grand staff). The
owner's screenshot (Listen mode, piano strip shown, Für Elise) shows the problem: the cursor is in the second
system, the view shows the first and second systems, and below them there is an empty band down to the piano
strip - the third system is not visible, so the musician cannot read ahead to what they will play next.

Today the view follows the cursor only when it leaves the middle band of the viewport, and then jumps in one step
so that the cursor's system is centred (001 FR-014, 004 FR-010). It never looks ahead, and each page of the Score
ends in blank space, so near a page end the next system is often off-screen or pushed far down. Reading ahead is
basic sight-reading practice: a musician's eyes are always a bar or a line ahead of their hands.

Measured during planning (2026-09-28, Verovio page renders measured in Chromium): at 1920 px wide and the default
size each page holds one or two systems, and its unused bottom is 100-460 px of blank; piano systems are 305-463 px
tall, and a 1080p browser window with the piano strip leaves about 700 px of clear space.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The next system is always visible (Priority: P1)

A musician plays along (Listen, Practice or Play mode) on a typical piano Score. Whatever system the cursor is in,
the system that follows it is also fully visible below it, in clear space - not under the piano strip, the slim bar
or a notice. When the cursor moves on to the next system, the view moves so that the system after that comes into
view. Page ends make no difference: the first system of the next page is shown right below the last system of the
current page, without an empty band between them that would push it off-screen.

**Why this priority**: This is the whole request. A musician who cannot see the next line stops or stumbles at every
line end; seeing it lets them read ahead as they would on a printed page.

**Independent Test**: Open a multi-page piano Score (e.g. Für Elise from the library) in a 1920x1080 window at the
default Score size with the piano strip hidden (or in a window tall enough for two of its systems). Start Listen
mode and let it play through at least two page turns. At every system change where two systems fit, check
(screenshots) that the cursor's system and the following system are both fully visible in clear space.

**Acceptance Scenarios**:

1. **Given** a run is active, the cursor is in system N (not the last), and systems N and N+1 fit together in clear
   space, **When** the view has settled, **Then** both are fully visible in clear space (where they do not fit, see
   User Story 3).
2. **Given** the cursor is in the last system of a page, **When** the view has settled, **Then** the first system
   of the next page is fully visible directly below it, with no more blank space between them than between two
   systems on the same page.
3. **Given** the cursor moves from system N into system N+1 and systems N+1 and N+2 fit together, **When** the view
   has settled, **Then** systems N+1 and N+2 are fully visible.
4. **Given** the cursor is in the last system of the Score, **Then** that system is fully visible and the view does
   not scroll further than needed to show it.
5. **Given** the same situations in Practice mode (the cursor waits for the musician) and in Play mode, **Then**
   the same rules hold: the view looks ahead exactly as in Listen mode.
6. **Given** the musician scrolls away during a run, **Then** following stops as today (001 FR-014); **When** they
   press Follow, **Then** the view returns to the look-ahead position (current and next system visible).
7. **Given** the piano strip is hidden, **Then** the same rules hold with the extra height used for the Score.

---

### User Story 2 - Fluent scrolling instead of jumps (Priority: P2)

When the view moves to keep the next system in sight, it glides smoothly to its new position instead of jumping.
The musician's eye can follow the music as it moves; the notes they are playing never vanish, blur or jump away
under them.

**Why this priority**: A jump - especially a large one at a system or page change - makes the musician lose their
place exactly when they need to read on. P1 already makes the next system visible; this makes getting there
comfortable.

**Independent Test**: Start Listen mode on a multi-page Score and record the screen across several system changes
and one page change: every view movement is a continuous glide of bounded length; no frame shows a jump, and the
cursor's system stays at least partly visible throughout every movement.

**Acceptance Scenarios**:

1. **Given** a run is active, **When** the view moves to show the next system, **Then** the movement is a smooth
   animation of bounded duration, not an instant jump.
2. **Given** a view movement is in progress, **When** the cursor moves on or the musician plays, **Then** sound,
   cursor and note feedback stay exactly in time; the animation never delays or disturbs them.
3. **Given** the cursor jumps to a distant position (a repeat, D.C./D.S., the musician clicks another measure, or
   presses Follow after scrolling away), **When** the view moves there, **Then** it arrives quickly, without a long
   slow scroll through the whole Score.
4. **Given** the musician's operating system asks for reduced motion, **Then** view movements are instant (or
   nearly so) instead of animated.
5. **Given** the musician scrolls by hand while an animation is running, **Then** the animation stops at once and
   following is suspended, exactly as for any manual scroll.

---

### User Story 3 - Two systems fit more often; otherwise show what fits (Priority: P3)

On a small window, with a large Score size, or with the piano strip taking height, two whole systems may not fit.
The app keeps the Score size the musician chose and shows what fits: the current system always fully, and below it
as much of the next system as the clear space allows, so the musician can at least see how the next line begins.
Nothing changes size on its own.

To make two systems fit more often, the staves of a piano grand staff are engraved a little closer together
(compact vertical spacing): the minimum distance between the treble and bass staff shrinks, while music that needs
more room (ledger lines, beams, dynamics between the staves) still pushes them apart. This applies to the Score
everywhere, not only during a run, so the page never changes appearance when a run starts.

**Why this priority**: Measured during planning (2026-09-28): on a 1080p browser window with the piano strip shown,
the clear space is about 700 px and a piano system at the default size is 305-463 px tall, so with the original
spacing two systems fit for none of the library's piano pieces. Without this story P1 still helps on larger
windows or with the piano strip hidden; with it, P1 also works on a typical laptop for simple and intermediate pieces.
*(Amended 2026-09-28 during planning, owner decision: compact spacing added to this feature; the first wording
assumed two systems already fit at the default size.)*

**Independent Test**: Open Clementi's Sonatina op. 36 no. 1 (library) at 1920x950 with the piano strip shown and
the default Score size; start Listen mode; at every system change both systems are fully visible. Then open a piano
Score at 1280x720 with the piano strip shown, and at 1920x1080 with the Score enlarged to 200%; at every system
change the current system is fully visible, the rest of the clear space below it shows the top of the next system,
and the Score size never changes.

**Acceptance Scenarios**:

1. **Given** a window and Score size where two systems fit in clear space, **Then** User Story 1 applies unchanged.
2. **Given** a window and Score size where two systems do not fit, **When** the view has settled, **Then** the
   current system is fully visible with its top at the top of the clear space, and the space below it shows the top
   part of the next system.
3. **Given** two systems do not fit, **Then** the Score size stays exactly what the musician chose; no hint, dialog
   or automatic resize appears.
4. **Given** a single system is taller than the clear space (very large Score size, many staves), **Then** the
   system is shown from its top, the cursor bar crossing it stays visible, and the view never hides the cursor to show
   the next system.
5. **Given** a piano Score, **When** it is displayed (with or without a run), **Then** its staves are engraved with
   the compact vertical spacing, with no collisions between notes, beams, dynamics, pedal marks or slurs of the two
   staves, and the result still looks like a printed edition.

---

### Edge Cases

- **Repeats, voltas, D.C./D.S./Coda**: "next system" means the next system on the page, in reading order, as on a
  printed page. When the cursor jumps (to a repeat start, a segno, a coda), the view follows it to its new system
  and looks ahead from there. Showing the jump target in advance is out of scope. In detail:
  - a system that ends with a backward repeat, a first-ending volta, D.C./D.S. or "To Coda" shows the following
    system in reading order, which is not the one played next; the jump target comes into view only at the jump;
  - a jump within the same system (a short repeat) moves nothing (FR-002);
  - a jump to the system just above (the usual repeat) is an ordinary system-to-system movement, not a distant one;
  - a Practice loop that ends in the middle of a system and returns to a measure of the same system moves nothing.
- **System change within a fast passage**: when systems follow each other faster than a view movement lasts, the
  view never falls behind: the cursor's system is always at least partly visible and the view settles on the latest
  position, not on each intermediate one.
- **Short Scores** (everything fits on one screen): the view does not move at all.
- **Very long Scores** (100+ pages): scrolling stays smooth; the next page's music is shown in time, even if it was
  not yet displayed before.
- **Practice mode waiting at the last note of a system**: the next system is already visible while the app waits
  (the rule is about where the cursor is, not about time).
- **Loops in Practice mode**: at the loop end, the view returns to the loop start like any other jump.
- **Zoom, window resize or showing/hiding the piano strip during a run**: the view re-applies the look-ahead rule
  for the new layout without losing the cursor position.
- **A notice appears during a run** (like the time-signature notice in the owner's screenshot): the next system is
  still readable; notices stay in their bounded corner area (004 FR-011) and never cover the current system.
- **Malformed or unsupported MusicXML**: no change; whatever systems are engraved follow the same rules.
- **MIDI keyboard unplugged, audio device lost mid-run**: no change to scrolling; the notice appears as today.
- **No run active**: browsing the Score by hand is unchanged; the look-ahead applies only while the view follows a
  run.
- **Multi-part Scores** (e.g. voice and piano): a system includes all its staves; "fully visible" means every staff
  of the system.

## Requirements *(mandatory)*

### Functional Requirements

**Look-ahead (US1)**

- **FR-001**: While the view follows a run (Listen, Practice or Play mode), it MUST keep the system containing the
  cursor and the next system in reading order fully visible in clear space (not under the slim bar or the piano
  strip), whenever both fit in that space. Notices are a bounded corner overlay (004 FR-011) and do not reduce the
  clear space. *(Amended 2026-09-28 after analyze A3, owner accepted the recommendation: the first wording also named
  notices and the Grade panel; the Grade panel only appears after a run.)*
- **FR-002**: When the cursor enters a new system, the view MUST move so that FR-001 holds again for the new
  system; it MUST NOT move while the cursor stays within a system whose position already satisfies FR-001.
- **FR-003**: The first system of a page MUST be shown after the last system of the previous page with a gap no
  larger than the normal gap between two systems on one page, so that a page end never hides the next system.
- **FR-004**: At the last system of the Score, the view MUST show that system fully and MUST NOT scroll further than
  needed for it (the space reserved so it can clear the piano strip stays, 004 FR-010).
- **FR-005**: Follow rules stay as they are (001 FR-014): a manual scroll suspends following; pressing Follow or
  starting a run resumes it, and the resumed position MUST satisfy FR-001.
- **FR-006**: The look-ahead rule MUST be re-applied, without losing the cursor position, after a zoom change, a
  window resize, or showing or hiding the piano strip during a run.

**Fluent movement (US2)**

- **FR-007**: Every view movement made by following MUST be a smooth, continuous animation of bounded duration,
  never an instant jump; the duration MUST be a named, documented setting.
- **FR-008**: During a movement to the next system (including across a page end) the cursor's system MUST remain at
  least partly visible; the musician never sees a screen without the music they are playing.
- **FR-009**: A movement to a distant position (jump, click on a measure, Follow after scrolling away) MUST arrive
  within the same bounded duration as a normal movement, however far it goes.
- **FR-010**: A new target arriving while a movement runs (a fast system change, a jump) MUST redirect the movement
  smoothly to the latest target, without first finishing the old one.
- **FR-011**: When the operating system requests reduced motion, view movements MUST be instant (or shortened to a
  barely visible glide).
- **FR-012**: A manual scroll during a movement MUST stop the movement at once and suspend following (FR-005).
- **FR-013**: View movement MUST NOT affect sound, the cursor, note feedback, Practice waiting or grading in any way:
  the same Score, input and settings MUST give the same playback, feedback and Grade as before.

**Fitting two systems (US3)**

- **FR-014**: When the current system and the next do not both fit in clear space, the current system MUST take
  priority and stay fully visible, placed at the top of the clear space, and the remaining clear space below it MUST
  show the top part of the next system. If the current system alone does not fit, the view MUST show it from its top
  (the cursor bar crosses every staff of the system, so the cursor stays visible) and never hide the cursor to show the
  next system. *(Amended 2026-09-28 after analyze A6, owner accepted the recommendation: the first wording said "the
  part with the cursor".)*
- **FR-015**: The app MUST NOT change the Score size, re-flow the music or show a hint or dialog because two systems
  do not fit; the musician's chosen size (004 FR-014a, FR-019) is kept.
  *(Owner decision 2026-09-28: "show what fits", over automatic shrinking during runs or a suggestion hint.)*
- **FR-016**: The Score MUST be engraved with a compact vertical spacing: a smaller minimum distance between the
  staves of one braced instrument (a piano grand staff, an organ or harp part) than the engraving default, while
  content that needs more room still pushes staves apart. The distance between different parts (voice and piano,
  two instruments) and between systems stays as it is, so parts and systems remain clearly separated. It
  applies in every view of the Score (with or without a run, every mode, both Shells) and never changes during a
  run. The value MUST be a named, documented setting and MUST pass a notation review (printed-edition norms, SC-008)
  before it ships.
  *(Added 2026-09-28 during planning, owner decision. Amended 2026-09-29, owner decision after the T030 review: "no
  collisions" now reads "SC-008", which says what is measured.)*

### Key Entities

- **System**: one line of engraved music across the page, containing every staff of every part for a run of
  measures; systems are ordered by reading order across pages.
- **Clear space**: the part of the Score view not covered by the slim bar or the piano strip (004 FR-010); the
  bounded notice area in a corner is not subtracted (004 FR-011).
- **Look-ahead position**: the view position in which the cursor's system and the following system are both fully
  in clear space.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For every system change of a full Listen run through Für Elise (complete) and Clementi's Sonatina
  op. 36 no. 1 (library), at the default Score size, once the view has settled:
  (a) wherever the current and the next system fit together in clear space, both are fully visible - 100% of such
  system changes, including every page change; checked at 1920x1080 with the piano strip hidden and at 1920x950
  with it shown;
  (b) wherever they do not fit, the current system is fully visible and the top of the next system fills the rest of
  the clear space (at least its top staff whenever that staff fits) - 100% of such system changes.
  *(Amended 2026-09-28 during planning, owner decision: measured system heights make "both fully visible at 100%"
  impossible at 1080p with the piano strip; see US3.)*
- **SC-002**: The view settles on its new position within 0.6 seconds of the cursor entering a new system (default
  setting).
- **SC-003**: With reduced motion off, no view movement from one system to the next (including across a page end)
  moves the music by more than one sixth of the viewport height in a single displayed frame (no visible jump).
  Distant jumps (FR-009) are exempt but still animated, never a single-frame cut.
- **SC-004**: Scrolling during a run keeps up with the display (60 frames per second on the reference machine), and
  playback has no audible glitches caused by scrolling.
- **SC-005**: Grades and Practice feedback for the same recorded performances are identical before and after this
  feature (existing golden tests unchanged).
- **SC-006**: In a hand test with the owner, the owner confirms they can read the next line before reaching it on
  both a single-page and a multi-page piano Score, in Listen and Practice mode, including a fast passage across a
  line change and a line change after a repeat.
- **SC-007**: With the compact spacing, at 1920x950 with the piano strip shown and the default Score size, two
  systems fit in clear space for every system change of Clementi's Sonatina op. 36 no. 1 and Mary Had a Little
  Lamb (measured during planning: 8 of 8 and 1 of 1, against 0 of 8 and 0 of 1 before).
- **SC-008**: A notation review (music-domain-expert) and the owner's visual check of the library's piano pieces
  find no ink contact introduced by the compact spacing, and no element of one staff closer to an element of the
  other staff than the 0.28 staff space Verovio itself leaves wherever the music forces the staves apart. Places in
  other Scores where Verovio's own placement collides with the compact spacing are recorded as known limits
  (research R-4), not fixed by hand.
  *(Amended 2026-09-29, owner decision after the T030 review: the first wording also forbade "crowding"; the review
  found Bach BWV 846 m. 1/4 and Clementi op. 36 no. 1 m. 20 at that 0.28-space floor, legible and consistent with the
  rest of the engraving, and ink collisions only in two test files outside the library.)*

## Assumptions

- "Sheet" in the request means a system (one line of music), not a page: two whole pages cannot fit on a laptop
  screen at a readable size.
  *(Confirmed by the owner 2026-09-28.)*
- The rules apply in both Shells (browser and Electron) identically; the Native audio plugin is not involved.
- The view turns one system at a time: it glides when the cursor enters a new system, and stays still while the
  cursor travels along a system. *(Owner decision 2026-09-28: "glide at line change", over a continuous
  teleprompter-style scroll, which keeps the notes always moving, and over gliding before the line end, which moves
  the line being played.)*
- A good position is: the cursor's system near the top of the clear space, the next system(s) below it. No
  movement happens while the cursor's system and the next are already fully visible (for example when three systems
  fit on screen, every second system change moves nothing).
- A movement eases in and out, never overshoots, and moves the music no further than needed (normally one system).
  A movement redirected while it runs (a fast system change, a jump) continues without stopping first and still ends
  within the original movement's time (FR-009, FR-010).
- The movement duration default (about 0.3-0.5 s) and the "distant jump" handling are tuning values chosen during
  planning and written down as named settings (Constitution II).
- The existing Follow button and its behaviour stay; no new control is added for the look-ahead itself.
- The horizontal layout of the engraving (how many measures go into a system) is not changed. The vertical layout
  changes only through the compact spacing (FR-016), which can put more systems on a page, and through FR-003: the
  blank space at the end of a page no longer separates it from the next page on screen.

## Out of Scope

- Showing the target of a repeat or D.C./D.S. jump in advance (for example a split view).
- Horizontal (one long line) scrolling or a "page turn" presentation with two pages side by side.
- Changing how many measures go into a system, or any engraving change other than the compact vertical spacing
  (FR-016). *(Amended 2026-09-28: compact spacing moved into scope by the owner.)* In particular, where the
  engraver places pedal marks below the staff (the notation review found the "Ped." row sits nearly as close to the
  next system as to its own) is a separate engraving question, not part of this feature.
- Scrolling behaviour when no run is active (browsing by hand, the Score browser).
- A user setting to switch the look-ahead off.
