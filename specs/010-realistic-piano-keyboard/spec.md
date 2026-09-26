# Feature Specification: On-Screen Piano That Looks Like a Real Keyboard

**Feature Branch**: `010-realistic-piano-keyboard`
**Created**: 2026-09-26
**Status**: Draft
**Input**: User description: "the on screen piano on the bottom doesn't look right. Make it look like real piano keys. It can be
basic but looking accurate."

## Background

The on-screen piano (the strip at the bottom of the window, switched on from the View menu, 004 FR-015) shows the keys
the musician presses on the MIDI keyboard (001), the expected key when Practice's help is asked for, and the wrong-key
markings of Practice (002 FR-011, 008 FR-011). In the owner's screenshot it is a row of 88 identical, evenly spaced
white rectangles: there are no black keys, so the groups of two and three that a pianist finds their way by are
missing, and no key can be recognised as a C, an F or middle C. On narrower windows the row is wider than the window.

This feature changes how the keyboard looks, not what it shows: every state it shows today stays, drawn on keys that
look like a piano's.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Recognise the keyboard at a glance (Priority: P1)

The musician switches the on-screen piano on and sees a piano keyboard: white keys side by side with no gaps between
them except a thin dividing line, and shorter, narrower black keys on top of them in alternating groups of two and
three, from the lowest A to the highest C of an 88-key piano. Without counting, they can find middle C and any other
key, the same way they would on their own instrument.

**Why this priority**: this is the owner's request; everything the strip shows is only useful if the musician can tell
which key it is on.

**Independent Test**: open any Score, switch the on-screen piano on from the View menu, and compare it with a picture
of a real 88-key piano: same number of white and black keys, the same pattern of black-key groups, the lowest key an
A and the highest a C, the keys in proportion.

**Acceptance Scenarios**:

1. **Given** the on-screen piano is switched on, **When** the musician looks at it, **Then** it shows 52 white keys and
   36 black keys, the black keys in alternating groups of two (C#, D#) and three (F#, G#, A#), with the lowest key A0
   and the highest C8.
2. **Given** the keyboard is shown, **When** the musician looks at a black key, **Then** it sits between the two white
   keys it belongs to, on top of them, shorter than them (about two thirds of their length) and narrower than a
   white key, like on a real piano.
3. **Given** the keyboard is shown, **When** the musician looks for middle C, **Then** they find it without counting
   keys: every C carries a small label with its octave at the bottom of the key (C1 ... C8, middle C = C4), and no
   other key is labelled.
4. **Given** a window of any width from 1024 to 2560 pixels, **When** the keyboard is shown, **Then** all 88 keys are
   visible at once, filling the width, with no horizontal scrolling and no key cut off.
5. **Given** the keyboard is shown, **When** the musician resizes the window or zooms the Score, **Then** the keyboard
   keeps its proportions and still fits the width; the Score keeps the space above it free (004 bottom inset).

---

### User Story 2 - See pressed keys and feedback on the realistic keys (Priority: P1)

Everything the strip showed before is still shown, now on the right-looking key: a key held on the MIDI keyboard looks
pressed; in Practice, a wrong pitch, a wrong octave or an extra key keeps its own colour **and** symbol, and the
expected key keeps its help marking; the text hints under the keyboard and the sustain pedal indicator stay. This
works on black keys as well as on white ones.

**Why this priority**: the strip exists for this feedback (002, 008); a nicer-looking keyboard that loses or hides it
would be a step back. It ships together with US1.

**Independent Test**: with a faked MIDI keyboard, press a white key and a black key in Listen mode, then in Practice
press a wrong pitch, a wrong octave and an extra key on black and white keys and ask for help: each state appears on
exactly the key pressed, readable in colour and in greyscale.

**Acceptance Scenarios**:

1. **Given** the keyboard is shown, **When** the musician holds a key on the MIDI keyboard, **Then** the same key on
   screen looks pressed down (a clearly different shade of the key) and carries the pressed marker, within the same
   time budget as today (Constitution: visual feedback within 50 ms); releasing the key restores it.
2. **Given** a black key is held, **When** the musician looks at it, **Then** the pressed look and the marker are as
   visible on the black key as on a white key.
3. **Given** Practice mode, **When** the musician presses a wrong pitch, a wrong octave or an extra key, **Then** that
   key shows the same state colour and symbol as today (✕, ▢, ◆), readable on white and black keys alike.
4. **Given** Practice help is shown, **When** the expected key is a black or a white key, **Then** that key shows the
   help marking (its colour and "?") and nothing on the neighbouring keys.
5. **Given** a chord of up to ten keys is held, including neighbouring black and white keys, **When** the musician
   looks at the keyboard, **Then** every held key is marked and no marking covers a neighbouring key's marking.
6. **Given** the sustain pedal is pressed or the keyboard's text hints appear, **When** the musician looks at the strip,
   **Then** they are shown as today.

---

### Edge Cases

- **MIDI keyboard unplugged mid-session**: keys held at that moment are released on screen as today; the keyboard
  itself stays drawn.
- **Keys outside 88 (a MIDI controller sending notes below A0 or above C8)**: not shown, as today; no key is drawn
  outside the piano's range.
- **Very narrow window (below 1024 px)**: all 88 keys still fit; keys become narrow but keep the black/white pattern
  and proportions; markings stay at least recognisable (see SC-004).
- **Many keys at once** (a forearm cluster, ten fingers): every key shows its own state; neighbouring black and white
  markings stay apart.
- **Greyscale or colour-blind viewing**: every state stays recognisable by its shape as well as its colour
  (Constitution VI), on white and black keys (SC-004).
- **Keyboard hidden**: switched off, it takes no space and nothing changes for the Score (004 FR-015).
- **Clicking a key**: does nothing, as today; the on-screen keyboard never stands in for a MIDI keyboard (002 FR-033,
  003 FR-010).

## Clarifications

### Session 2026-09-26

- Q: How are keys labelled, so middle C can be found at a glance? -> A: only the C keys, each with its octave
  (C1 ... C8, middle C = C4), small at the bottom of the key (FR-007, AS-1.3).
- Q: How tall may the strip be (a real key is about six times as long as it is wide)? -> A: moderate: keys about four
  times as long as wide, capped so the Score keeps most of the window (FR-005, SC-006).

## Requirements *(mandatory)*

### Functional Requirements

#### Look of the keyboard

- **FR-001**: The on-screen piano MUST show the 88 keys of a standard piano, A0 to C8: 52 white keys and 36 black keys.
- **FR-002**: White keys MUST be drawn side by side, equal in width, separated only by a thin dividing line, with no
  visible gap between them.
- **FR-003**: Black keys MUST be drawn on top of the white keys, between the two white keys they belong to, in the
  two-and-three pattern of a real piano, narrower than a white key (about 55-65 % of its width) and shorter (about
  60-70 % of its length), starting at the top edge of the keyboard.
- **FR-004**: Black keys MUST sit where they sit on a real piano: the black keys of a group of two and a group of three
  are placed as on an instrument (not simply centred on the line between two white keys), so the keyboard reads as a
  piano and not as a diagram.
- **FR-005**: The keys MUST keep piano proportions at a moderate height: a white key's length (top edge to bottom
  edge) MUST be about four times its width, with the keys' height capped at 160 pixels and at 20 % of the window height, whichever is
  smaller, so the Score keeps most of the window (at 1920 pixels wide: about 140 pixels of keys).
- **FR-006**: All 88 keys MUST be visible at once, filling the width of the window, at every window width the app
  supports, with no horizontal scrolling and no key cut off; the keyboard MUST keep its proportions when the window is
  resized.
- **FR-007**: Every C key, and no other key, MUST carry a small label with its name and octave (C1 ... C8) near the
  bottom of the key, readable on the white key and never covering a feedback marking; middle C is C4.
- **FR-008**: White keys MUST look light (white or off-white) and black keys dark, like an instrument.

#### Feedback on the keys (unchanged in meaning)

- **FR-009**: A key held on the MIDI keyboard MUST look pressed (a clearly different shade of that key) and keep the
  pressed marker it has today, on white and black keys alike, within the Constitution's visual feedback budget
  (50 ms after the key press).
- **FR-010**: Practice's wrong-key states (wrong pitch, wrong octave, extra), the help marking of the expected key, the
  text hints and the sustain pedal indicator MUST keep their meaning, colour and symbol (colour **and** shape,
  Constitution VI); only their placement adapts to the new key shapes. On a black key each MUST be as recognisable as
  on a white key.
- **FR-011**: A marking MUST stay within its own key: it MUST NOT cover a neighbouring key or a neighbouring key's
  marking, including where a black key overlaps two white keys.
- **FR-012**: Nothing else about the strip changes: it is still off by default and switched from the View menu
  (004 FR-015), it still declares its height so the Score keeps clear of it, and clicking it still plays or judges
  nothing.
- **FR-013**: The keyboard MUST look and behave the same in the browser and in the desktop app, from the same build.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a picture of the keyboard at 1280, 1600 and 1920 pixels wide, a reviewer counts 52 white and 36 black
  keys, finds the lowest key is A0 and the highest C8, and every black-key group follows the two-three pattern.
- **SC-002**: At every window width from 1024 to 2560 pixels, the whole keyboard is inside the window: no horizontal
  scroll bar, no key cut off, the rightmost key ending at most one white-key width from the window's right edge.
- **SC-003**: The owner, shown the keyboard beside a photo of a real piano keyboard, agrees it "looks like real piano
  keys".
- **SC-004**: For each of the six states (pressed, wrong pitch, wrong octave, extra, help, none), on a white key and on
  a black key, a greyscale picture lets a reviewer tell the state apart from every other state at 1280 pixels wide.
- **SC-005**: A held key is shown pressed within 50 ms of the key press (the budget of 001/002), measured as today.
- **SC-006**: At 1280, 1600 and 1920 pixels wide (window 1080 pixels high), a white key's length (from its top edge to
  its bottom edge, the part under the black keys included) is between 3.5 and 4.5 times its width, or the keys are exactly at the height cap (160 pixels, or 20 % of the window height if
  that is smaller); the eight C labels read C1 to C8 and middle C reads C4.
- **SC-007**: With ten keys held at once, including adjacent black and white keys, every one is marked and no marking
  overlaps another key's.

## Assumptions

- Only the look changes: which keys are marked, when, and with which colours and symbols stay as features 001, 002
  and 008 define them.
- "Basic but accurate" means flat, clean keys with the right shapes, proportions and placement - no photographic
  textures, wood, felt or 3D lighting; a simple shade difference for a pressed key is enough.
- Black-key placement follows a standard acoustic piano (in a group of two the keys lean slightly outwards, in a
  group of three the outer keys lean outwards and the middle one is centred); exact offsets are for the plan.
- The keyboard always shows the full 88 keys; it does not zoom to the Score's range.
- The keyboard is a display: it stays unplayable with the mouse or touch, as 002 and 003 require.
- The keyboard is designed for windows 1024 pixels wide or wider (the Score view's own layout, 004, has no minimum);
  below that the keys get narrow, but all 88 still fit and the pattern stays.
- Both Shells (browser and desktop app) show the same keyboard; the Native audio plugin is not involved.

## Out of Scope

- Playing notes by clicking or touching the on-screen keys.
- Showing the Score's notes on the keyboard during Listen playback (a "falling notes" or "lit keys" view).
- Changing the feedback colours, symbols or hint texts, or adding new feedback states.
- Keyboards other than 88 keys (61, 76 keys) or choosing the visible range.
- Redesigning the sustain pedal indicator or the hint text area beyond fitting them under the new keys.
