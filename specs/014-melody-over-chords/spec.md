# Feature Specification: Melody over chords in Learning exercises

**Feature Branch**: `014-melody-over-chords`
**Created**: 2026-09-28
**Status**: Draft
**Input**: User description: "I've noticed that a lot of learning tracks have boring double chord playing. Please make
them more exciting. Like left hand chords, right hand do-re-mi-fa etc. Mind the difficulty level."

## Background (what is on the shelf today)

Many generated Learning exercises have both hands strike the same block chord at the same moment, bar after bar
("doubled chords"). Surveyed on `main` at 801767d:

| Group | Items | Doubled chords |
|---|---|---|
| Key changes (relative and parallel, introduction / beginner / intermediate) | 54 | every bar |
| Chord-change drills in C major and A minor (I-V-vi-IV, I-vi-ii-V, diatonic ladder, same tonic, minor and major) | 5 | every bar |
| Per-key steps, advanced (24 keys) | 24 | the closing section |
| Per-key steps, intermediate (24 keys) | 24 | bars of the last section where the left hand plays block chords |

The screenshot that raised this is *C major to A minor - introduction*: twelve bars of whole-note triads in both hands.
Per-key steps where one hand plays a scale and the other chords, and all Songs, are not doubled and not in scope.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Key-change exercises have a melody (Priority: P1)

A learner opens a key-change exercise (for example *C major to A minor - introduction*). Instead of the same triad in
both hands, the left hand plays the chords and the right hand plays a simple melody built from the scale of the key
it is in - do-re-mi-fa-like steps that land on a chord note when the chord changes. After the key change the melody
uses the new key's scale (including the raised seventh in minor), so the learner hears and feels the change in both
hands. How busy the melody is follows the item's level.

**Why this priority**: The 54 key-change items are the largest group and are doubled in every bar; they are what the
owner saw. Fixing them alone removes most of the problem.

**Independent Test**: Open *C major to A minor - introduction* in Listen mode - the right hand plays single notes
that move by step in C major, then in A minor with G♯, over left-hand chords; then play it in Practice mode with a
MIDI keyboard (or the on-screen piano) and finish it.

**Acceptance Scenarios**:

1. **Given** any key-change item, **When** it is opened, **Then** no bar has both hands striking the same chord at the
   same time; the left hand plays the chord progression and the right hand plays single notes.
2. **Given** an introduction-level key-change item, **When** the learner reads it, **Then** the right hand moves only
   by step within one five-finger position in half or whole notes, and the left hand holds one chord per bar.
3. **Given** a key-change item into a minor key, **When** the melody passes the seventh degree over the dominant or
   leading to the tonic, **Then** it uses the raised seventh with its accidental written.
4. **Given** a key-change item, **When** a chord starts, **Then** the right-hand note sounding on that beat is a note
   of that chord.
5. **Given** a key-change item, **When** it is opened, **Then** fingering is written for every right-hand note that
   starts a position or needs a thumb-under or finger-over, and chord symbols, roman numerals, key change and new-key
   label are shown as before.

---

### User Story 2 - The difficulty ladder is kept (Priority: P1)

A learner who works through introduction, beginner, intermediate and advanced for a key finds each step a little
harder than the one before, and none of them suddenly harder than its level suggests. The melody's note values,
range, leaps, hand shifts and the left hand's accompaniment pattern grow with the level (see the Difficulty ladder
below), and the library's level check still agrees with the level each item is shelved under.

**Why this priority**: The owner asked explicitly to "mind the difficulty level"; a melody that is too hard at
introduction level would make the exercises worse than doubled chords. It must hold from the first rewritten item,
so it shares P1.

**Independent Test**: For one key, open the four steps and the key-change items that start in it: each rewritten
item satisfies the limits of its row in the Difficulty ladder, and the library level check passes for all of them.

**Acceptance Scenarios**:

1. **Given** the rewritten items of one level, **When** their notes are checked against the Difficulty ladder,
   **Then** none exceeds its level's shortest note value, range, largest leap, number of hand shifts or accompaniment
   pattern.
2. **Given** the library index is regenerated, **When** the level check runs, **Then** every rewritten item is at or
   below the level it is shelved under, or carries a written reason for being raised (as today).
3. **Given** the same progression at two levels, **When** they are compared, **Then** the higher level is never
   easier in any of the ladder's dimensions.

---

### User Story 3 - Chord-change drills and step exercises lose their doubled bars (Priority: P2)

A learner practising a chord-change drill (I-V-vi-IV, I-vi-ii-V, the diatonic ladder, same tonic, minor and major) or
the closing section of an intermediate or advanced step hears left-hand chords with a right-hand line on top,
instead of two copies of the same chord. The drill still trains what its description says (chord changes with
little hand travel): the left hand keeps the drill's chords, inversions and voice-leading; the right hand adds a
melody on top.

**Why this priority**: Fewer items (5 drills, plus one section in 48 step items) and those sections already sit next
to non-doubled material, so the gain is smaller than US1.

**Independent Test**: Open *C major - I-V-vi-IV* and *C major - advanced*: no bar has both hands on the same block
chord; the left hand plays the same chord sequence with the same inversions as before.

**Acceptance Scenarios**:

1. **Given** a chord-change drill, **When** it is opened, **Then** the left hand plays the drill's chord sequence and
   inversions unchanged, and the right hand plays a melody that fits each chord.
2. **Given** an intermediate or advanced per-key step, **When** it is opened, **Then** its scale sections are
   unchanged and its formerly doubled bars have a right-hand melody over left-hand chords.
3. **Given** any item described as training a skill ("trains"), **When** it is rewritten, **Then** its description
   still matches the music, or is updated to say what it now trains.

---

### Edge Cases

- **Every key**: the melody is spelled correctly in all 24 keys, including F♯/G♭-area keys and minor keys with double
  sharps where the raised seventh needs one; accidentals are written; no melody note falls outside the key except the
  raised sixth/seventh of minor.
- **Register**: the right-hand melody stays above the left-hand chord and on the treble staff; the hands never cross
  or share a key at the same time; low keys (for example E minor, which already sits an octave lower) keep a playable
  distance between the hands.
- **Key change bar**: the melody note on the first beat after the key change belongs to the new key's tonic chord; a
  note that exists only in the old key is never held across the change.
- **Chords that repeat**: several bars of the same chord (the introduction holds the tonic for up to eight bars) still
  get a melody that moves, not the same note repeated for the whole passage.
- **Ending**: every item ends on the tonic in the melody, with the tonic chord in the left hand.
- **Practice mode with chords**: Practice mode waits for the left-hand chord and the right-hand note that start
  together, as it already does for any two-staff Score; hands-separately practice works on the new items.
- **Wrong, extra or no input** and **device loss**: unchanged behaviour of features 002/003; nothing new here.
- **Progress**: the learner may already have practised or graded an item that is rewritten - it starts fresh
  (FR-012); records left over from the old version never cause an error.
- **Links elsewhere**: items that other items or the audit report name as successors (feature 011) keep working.

## Requirements *(mandatory)*

### Functional Requirements

**Which music changes**

- **FR-001**: Every Learning item listed under Background MUST, after this feature, have no bar in which both hands
  strike the same chord at the same time as block chords.
- **FR-002**: In the rewritten bars the left hand MUST play the item's chord progression (same chords, same
  inversions, same bar positions, same key change) and the right hand MUST play a single-note melody.
- **FR-003**: Items not listed under Background (scale sections, Songs, Repertoire, *My files*) MUST NOT change.
- **FR-004**: Titles, section places, levels, tempo, metre, bar count and the way items are listed in the browser
  MUST stay the same unless a Difficulty ladder limit forces a change, which MUST be recorded per item.

**What the melody is**

- **FR-005**: The melody MUST use the scale of the key it is in (major; harmonic minor, or melodic minor where the
  item already uses it), with every altered note carrying its accidental.
- **FR-006**: The right-hand note sounding when a chord starts MUST be a note of that chord; notes between chord
  changes MUST move mostly by step (do-re-mi-fa), with leaps only as the Difficulty ladder allows and only to chord
  notes.
- **FR-007**: Each item's melody MUST end on the tonic, and at a key change the first melody note in the new key MUST
  be a note of the new tonic chord.
- **FR-008**: Melodies MUST vary: across the items of one level and one group, the melody MUST not be the same
  degree sequence in every item, and within one item a passage of repeated chords MUST NOT hold or repeat one note for
  more than two bars.
- **FR-009**: Right-hand fingering MUST be written where a position starts, a thumb passes under or a finger crosses
  over, and left-hand chord fingering MUST be kept as it is today.

**Difficulty**

- **FR-010**: Each rewritten item MUST stay within the limits of its level in the Difficulty ladder (below) for
  shortest right-hand note, melody range, largest leap, hand shifts, and left-hand pattern.
- **FR-011**: The library's level check MUST pass for every rewritten item without a new "raised because" reason
  unless the item already had one.

**Progress and identity**

- **FR-012**: A rewritten item MUST start fresh: it shows no status, results or history until the learner opens,
  practises or plays the new version. Progress recorded on the old doubled-chord version MUST NOT be shown for it or
  counted towards it, and MUST NOT make the browser, grading or any other item fail. Progress on items that do not
  change (FR-003) MUST be unaffected. (Owner decision, 2026-09-28.)

**Correctness and provenance**

- **FR-013**: Every rewritten item MUST keep the library's standing rules: authored for this project and CC0, fully
  engraved on disk (no beams or accidentals added on open), a sidecar and an audit record that reproduces.
- **FR-014**: Every rewritten item MUST pass a mechanical check, run as part of the test suite, of FR-002 and
  FR-005 to FR-010 (chord notes on chord changes, key membership, ending, key-change note, variation, ladder limits),
  not a review alone.
- **FR-015**: Every rewritten item MUST open, play in Listen mode, and complete in Practice and Play mode in the
  browser Shell and the Electron Shell; the Native audio plugin is not involved.

### Difficulty ladder

Limits per level for the rewritten bars (right hand = melody, left hand = accompaniment). A level may use anything
allowed at a lower level.

| Level | Shortest RH note | RH range | Largest RH leap | RH hand shifts | LH pattern |
|---|---|---|---|---|---|
| Introduction | half | five notes (one five-finger position) | a step (2nd) | none | one held block chord per bar |
| Beginner | quarter | five notes, one position per section | a third | at most one, at a section start | block chord per bar or half bar |
| Intermediate | eighth (in pairs on the beat) | up to an octave | a fifth, to a chord note | thumb-under / finger-over allowed | block chords or broken chords (as today's broken voicing) |
| Advanced | eighth, including dotted rhythms | up to a tenth | an octave, to a chord note | free | broken chords, root-fifth or block chords, mixed |

### Key Entities

- **Learning item**: a generated exercise on the shelf - title, level, section, key or key pair, what it trains -
  whose music this feature changes; its place and name stay.
- **Melody line**: the right-hand single-note line of a rewritten bar range - notes as scale degrees of the current
  key, note values, fingering - fitted to the item's chords.
- **Difficulty ladder**: the per-level limits above, used both to write the melodies and to check them.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0 bars with both hands striking the same block chord remain in the Learning section (today: every bar
  of 59 items and part of 48 more).
- **SC-002**: 100% of rewritten items pass the mechanical melody check (FR-014) and the library level check (FR-011);
  0 rewritten items exceed their level's row of the Difficulty ladder.
- **SC-003**: 100% of rewritten items open, play in Listen mode and can be completed in Practice mode without a load
  error or an engraving warning, in both Shells.
- **SC-004**: Items and files outside the Background list are byte-identical before and after the feature.
- **SC-005**: In a listening check by the owner of at least six rewritten items (one per group and level), the owner
  judges each as more interesting than its doubled-chord version and as fitting its level; any item judged too hard
  is simplified before merge.

## Assumptions

- The melodies are written for this project from the scale and chords of each item (the owner's "do-re-mi-fa"), not
  taken from existing tunes, so the CC0 authored rule applies and no external source or licence check is needed.
  They are "exercise" items in the audit, so the audit compares them against their own definition, not a published
  source.
- Existing items are rewritten in place (same title and place on the shelf) rather than added next to the old
  doubled versions; no doubled-chord version is kept.
- The chord progressions, inversions and left-hand voicings the exercises teach are right and stay; only the right
  hand changes (and, from intermediate up, the left-hand pattern as the ladder allows).
- Tempo stays as it is (60 BPM for most items); learners can still change it with the tempo field (feature 012).
- Grading, Practice mode waiting and feedback are unchanged; they already handle a note plus a chord starting
  together on two staves.
- The Difficulty ladder above is the project's default; the owner can tune its numbers during clarify without
  changing the rest of the spec.

## Out of Scope

- Songs and Repertoire items, and per-key scale sections that already give each hand a different part.
- New exercise families, new keys, new levels, or new chord progressions.
- Melodies in the left hand with chords in the right (the per-key steps already practise swapped hands with scales).
- Letting the learner choose between the doubled and the melody version.
- Changing how grades, Practice mode or the browser work.
