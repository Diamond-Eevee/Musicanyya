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
default Score size with the piano strip shown. Start Listen mode and let it play through at least two page turns.
At every system change, check (screenshots) that the cursor's system and the following system are both fully
visible above the piano strip.

**Acceptance Scenarios**:

1. **Given** a run is active and the cursor is in system N (not the last), **When** the view has settled, **Then**
   system N and system N+1 are both fully visible in clear space.
2. **Given** the cursor is in the last system of a page, **When** the view has settled, **Then** the first system
   of the next page is fully visible directly below it, with no more blank space between them than between two
   systems on the same page.
3. **Given** the cursor moves from system N into system N+1, **When** the view has settled, **Then** systems N+1
   and N+2 are fully visible.
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

### User Story 3 - At least two systems fit on screen (Priority: P3)

On a small window, with a large Score size, or with the piano strip taking height, two whole systems may not fit.
The app keeps the Score size the musician chose and shows what fits: the current system always fully, and below it
as much of the next system as the clear space allows, so the musician can at least see how the next line begins.
Nothing changes size on its own.

**Why this priority**: At the default size on a 1080p screen two piano systems already fit (004 US1), so P1 works
for most musicians without this story. It matters for small windows and for musicians who enlarge the Score.

**Independent Test**: Open a piano Score at 1280x720 with the piano strip shown, and at 1920x1080 with the Score
enlarged to 200%; start Listen mode; at every system change, the current system is fully visible, the rest of the
clear space below it shows the top of the next system, and the Score size never changes.

**Acceptance Scenarios**:

1. **Given** a window and Score size where two systems fit in clear space, **Then** User Story 1 applies unchanged.
2. **Given** a window and Score size where two systems do not fit, **When** the view has settled, **Then** the
   current system is fully visible with its top at the top of the clear space, and the space below it shows the top
   part of the next system.
3. **Given** two systems do not fit, **Then** the Score size stays exactly what the musician chose; no hint, dialog
   or automatic resize appears.
4. **Given** a single system is taller than the clear space (very large Score size, many staves), **Then** the part
   of the system with the cursor is shown, and the view never hides the cursor to show the next system.

---

### Edge Cases

- **Repeats, voltas, D.C./D.S./Coda**: "next system" means the next system on the page, in reading order. When the
  cursor jumps (to a repeat start, a segno, a coda), the view follows it to its new system and looks ahead from
  there. Showing the jump target in advance is out of scope.
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
  cursor and the next system in reading order fully visible in clear space (not under the slim bar, the piano strip,
  a notice or the Grade panel), whenever both fit in that space.
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
  show the top part of the next system. If the current system alone does not fit, the view MUST keep the part with
  the cursor visible and never hide the cursor to show the next system.
- **FR-015**: The app MUST NOT change the Score size, re-flow the music or show a hint or dialog because two systems
  do not fit; the musician's chosen size (004 FR-014a, FR-019) is kept.
  *(Owner decision 2026-09-28: "show what fits", over automatic shrinking during runs or a suggestion hint.)*

### Key Entities

- **System**: one line of engraved music across the page, containing every staff of every part for a run of
  measures; systems are ordered by reading order across pages.
- **Clear space**: the part of the Score view not covered by floating chrome (slim bar, piano strip, notice area,
  Grade panel), as defined by 004 FR-010.
- **Look-ahead position**: the view position in which the cursor's system and the following system are both fully
  in clear space.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a 1920x1080 window at the default Score size with the piano strip shown, for every system change of
  a full run through Für Elise (library) and one other multi-page piano Score, the next system is fully visible in
  clear space once the view has settled: 100% of system changes, including every page change.
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
  both a single-page and a multi-page piano Score, in Listen and Practice mode.

## Assumptions

- "Sheet" in the request means a system (one line of music), not a page: two whole pages cannot fit on a laptop
  screen at a readable size, while two systems already do at the default size (004 US1 Independent Test).
  *(Confirmed by the owner 2026-09-28.)*
- The rules apply in both Shells (browser and Electron) identically; the Native audio plugin is not involved.
- The view turns one system at a time: it glides when the cursor enters a new system, and stays still while the
  cursor travels along a system. *(Owner decision 2026-09-28: "glide at line change", over a continuous
  teleprompter-style scroll, which keeps the notes always moving, and over gliding before the line end, which moves
  the line being played.)*
- A good position is: the cursor's system near the top of the clear space, the next system(s) below it; the previous
  system may remain partly visible above if there is room.
- The movement duration default (about 0.3-0.5 s) and the "distant jump" handling are tuning values chosen during
  planning and written down as named settings (Constitution II).
- The existing Follow button and its behaviour stay; no new control is added for the look-ahead itself.
- Page layout of the engraving (how many systems per page, where page breaks fall) is not changed by this feature,
  except that the blank space at the end of a page no longer separates it from the next page on screen (FR-003).

## Out of Scope

- Showing the target of a repeat or D.C./D.S. jump in advance (for example a split view).
- Horizontal (one long line) scrolling or a "page turn" presentation with two pages side by side.
- Changing how many measures go into a system, or the engraving itself.
- Scrolling behaviour when no run is active (browsing by hand, the Score browser).
- A user setting to switch the look-ahead off.
