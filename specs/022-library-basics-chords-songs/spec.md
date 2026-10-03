# Feature Specification: Library Basics, Chord Lessons and More Songs

**Feature Branch**: `022-library-basics-chords-songs`
**Created**: 2026-10-03
**Status**: Draft
**Input**: User description: "add more tracks, like Greensleeves, and other tracks to learn specific chords, chord switches, multichords also. Try to find multitrack so we will have orchestra, but single tracks are also nice. Don't add orchestra by yourself now because I think it's tough task, we can do it later, for now let's build base. Also maybe create folder (basics) and add more music introduction tracks, like playing same note explaing note lenghts, ties, legatos etc."

## Context

The library today has three shelves of content: **Learning > Keys** (scales, chords and a few songs per key),
**Learning > Key changes**, and **Repertoire** (Beginner, Intermediate, Advanced pieces). A musician who has never
read music has no place to start: the easiest items already assume that note values, rests, ties and slurs are known.
Chord practice exists only as part of each key's exercises (I-V-vi-IV, turnaround, diatonic ladder) and covers no
chord types beyond the key's own triads. There are 21 Repertoire pieces and 10 songs.

This feature grows the library's *base*: a Basics shelf for absolute beginners, a set of chord lessons, and more
songs in the spirit of Greensleeves. It adds content only; Listen, Practice, Play and grading work as they do today.
Orchestra parts are explicitly deferred to a later feature, but sources are chosen so that one can follow.

## Clarifications

### Session 2026-10-03

- Q: What does "multichords" mean? -> A: Switching from one chord to another, e.g. C -> C minor or D minor -> C.
  Some lessons hold a single chord, some switch between two simple chords, and harder ones use progressions. Harder
  items (songs and lessons) also get a **simplified version** at a lower level - a simpler chord progression, fewer
  notes, or slower left-hand chords instead of a busy left hand, as Piano Marvel does - titled "simplified".
- Q: Where do the chord lessons go? -> A: A new **Learning > Chords** shelf next to Keys and Key changes, ordered
  from easy to hard.
- Q: How does a Basics lesson show its explanation? -> A: In the item's description **and** as one short line
  printed on the score above the first bar, so it is visible while playing.
- Q (during planning: the level check bans eighth notes, ties, repeats and 6/8 at Introduction, so the Basics lessons
  could not be Introduction): change the restrictions? -> A: Yes. **No level bans any notation** (note values, ties,
  repeats, time signatures, tuplets, grace notes, ornaments, pedal, key signatures, accidentals, key, metre and tempo
  changes). Levels differ only by **hand reach** (how far apart the notes are) and by **pace**: tempo, length,
  density, and how independent the hands are. Every Score must still be playable by human hands (constitution VII).
  Follow-up: Introduction means **one focus**: eighth notes are fine on their own (to show what they are), but an
  Introduction item never combines two harder things (e.g. eighth notes *and* ties).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Basics: learning to read rhythm and articulation (Priority: P1)

A musician who has never read music opens the library and finds a **Basics** shelf. Its lessons come in a fixed
order, and each teaches one idea with as little else as possible: the first lessons use a single repeated note (for
example middle C) so that only the *length* of the notes changes. Each lesson explains its idea in one or two short
sentences and then lets the musician hear it (Listen), try it with the app waiting (Practice), and play it in time
(Play).

The lessons cover, in this order (one lesson or more each): the staff, middle C and the right hand; whole, half and
quarter notes; rests of the same lengths; 3/4 time and the dotted half note; moving from one note to its neighbours
(steps) and a first five-note hand position; the left hand and the bass clef; both hands, first taking turns, then
together on single notes; eighth notes; dotted notes; ties (a note held across a beat and across a bar line - played
once, held longer); slurs and legato versus staccato (connected versus short notes); a pickup (upbeat); repeat signs;
finally 6/8 time. (Owner decision 2026-10-03, after the T038 music review: the hand positions come before the rhythm
lessons, as data-model §4 orders them.)

**Why this priority**: it is the missing entry point for the target user (a beginner) and needs no new source
approval, because every lesson is written for this project. It delivers value alone.

**Independent Test**: Open the library, open Basics, open the first lesson; its explanation is visible, Listen plays
it with the cursor, Practice waits for each note, and Play grades it. Open the ties lesson: a tied pair is shown as
one tie and is expected once.

**Acceptance Scenarios**:

1. **Given** the library, **When** the musician opens it, **Then** a Basics shelf is listed, and its lessons appear
   in teaching order (not alphabetical), each with a title saying what it teaches (e.g. "Half notes").
2. **Given** a Basics lesson, **When** it is opened, **Then** its explanation is readable without starting a session,
   and the score shows only notation that the lesson or an earlier lesson has introduced.
3. **Given** the note-value lessons, **When** they are opened, **Then** each uses one repeated pitch so that only
   the rhythm changes.
4. **Given** the ties lesson in Practice mode, **When** the musician plays the first note of a tied pair, **Then**
   the app moves on after the tied length without asking for the second note again.
5. **Given** the legato and staccato lesson, **When** it is shown, **Then** slurs and staccato dots are engraved, and
   Listen makes the difference audible.
6. **Given** any Basics lesson in Play mode, **When** the musician plays it correctly, **Then** every note is marked
   correct, exactly as for any other library item.

---

### User Story 2 - Chord lessons: single chords, chord switches and progressions (Priority: P2)

A musician who can read single notes wants to learn chords. On the **Learning > Chords** shelf they find lessons
that go step by step: **single-chord lessons** (one chord type repeated - major, minor, diminished, augmented,
suspended, seventh chords - and its inversions), **two-chord switches** (moving from one chord to another, e.g.
C -> C minor, D minor -> C, C -> F, G -> C, with the least hand movement), and **progressions** (I-IV-I, I-V-I,
I-IV-V-I, ii-V-I, a twelve-bar blues). Each lesson names the chords it uses, shows chord symbols above the staff,
and states what it trains.

**Why this priority**: the owner asked for it explicitly; chord fluency is the next skill after reading single
notes and is what songs need. It builds on Basics but is testable alone.

**Independent Test**: Open Learning > Chords, open "C -> C minor" (or any lesson), play it in Practice mode with
the correct chords: the app waits for each whole chord and moves on; play one wrong note of a chord: it is marked
as wrong pitch.

**Acceptance Scenarios**:

1. **Given** the library, **When** the musician opens Learning, **Then** a Chords shelf is listed next to Keys and
   Key changes, its lessons ordered from simplest (one chord) through two-chord switches to progressions.
2. **Given** a chord lesson, **When** it is opened, **Then** chord symbols (e.g. "Cmaj7", "G/B") are shown above the
   staff and its description names the chord types and the switch it trains.
3. **Given** a two-chord switch or progression lesson, **When** it is opened, **Then** consecutive chords keep their common tones where
   the lesson says so, and its description says which notes stay and which move.
4. **Given** any chord lesson, **When** it is checked, **Then** no hand ever has to strike more than three keys at
   once or reach wider than an octave (the "comfortable" tier), so a four-note chord is split between the hands or
   voiced without one of its notes, and the lesson says which.
5. **Given** a chord lesson at Intermediate level, **When** the musician looks at a lower level, **Then** its
   simplified version is there (e.g. fewer notes per chord, chords held longer), titled "... (simplified)".

---

### User Story 3 - More songs like Greensleeves (Priority: P3)

A musician who wants real tunes, not only exercises, finds more songs: well-known traditional or public-domain
melodies in the right hand over chords in the left hand, at Introduction to Intermediate level, in several keys,
both major and minor, and in 4/4, 3/4 and 6/8. Each song's melody comes from an owner-approved public-domain (or
permitted-licence) source, is checked against that source like every existing song, and names its origin and any
change (for example a transposition).

**Why this priority**: songs keep beginners motivated and use what Basics and the chord lessons teach; but each
song needs an owner-approved source, so it depends on the owner more than the first two stories.

**Independent Test**: Open one new song, play it in Listen mode: the tune is the familiar one; its details show the
source, the licence and any departure; the library audit for that song reports no differences.

**Acceptance Scenarios**:

1. **Given** the library, **When** the musician browses songs, **Then** the new songs appear beside the existing
   ones, each with its level, key and what it trains.
2. **Given** a new song, **When** its details are opened, **Then** its composer (or "Traditional"), source, licence
   and every departure from the source are listed.
3. **Given** a new song at Intermediate level or harder, **When** the musician looks one level lower, **Then** a
   simplified version of it is there, titled "<song> (simplified)", with a simpler chord progression, fewer notes,
   or slower left-hand chords instead of a busy left hand, and its description says what was simplified.
4. **Given** a new song, **When** the library audit runs, **Then** its melody matches the approved source note for
   note (apart from listed departures) and its chords pass the existing chord check.
5. **Given** a candidate tune, **When** no clean public-domain or permitted-licence source is found, **Then** it is
   not added and is recorded as rejected with the reason.

---

### User Story 4 - Ready for an Orchestra later (Priority: P4)

The owner wants an Orchestra for these songs later, but not now. While choosing sources, the project records for
each song whether a multi-part (ensemble or multi-instrument) public-domain version exists, so that a later feature
can add Orchestra parts without searching again. Single-track sources remain fully acceptable.

**Why this priority**: it is preparation, not something the musician sees in this feature.

**Independent Test**: Read the source list for the new songs; every song has an entry saying "multi-part source
available: yes (where) / no".

**Acceptance Scenarios**:

1. **Given** the chosen songs, **When** the source list is read, **Then** each states whether a multi-part version
   exists, where, and under which licence.
2. **Given** this feature is finished, **When** any new item is opened, **Then** it has no Orchestra parts and Play
   mode uses the Guide voice as for every Score without an Orchestra.

---

### Edge Cases

- **Ties**: a tie across a bar line and a tie between notes of different values (e.g. a half tied to a quarter) are
  played once and held; the tied continuation is never expected, marked or counted as a separate note.
- **Slurs versus ties**: a slur between different pitches expects each note; a tie between equal pitches expects
  only the first. Lessons show both and must not confuse them.
- **Held length is not judged**: the app grades when a note starts, not how long it is held. A musician who releases
  a half note early is still marked correct; the note-value, tie and legato lessons say so honestly instead of
  implying that holding is checked.
- **Repeat signs and pickups**: a lesson with a repeat plays and expects the repeated bars twice; a pickup bar is not
  counted as a full bar.
- **Rests**: a rest expects nothing; a key pressed during a rest is an extra note in Play mode, as today.
- **Chords**: a chord played with one wrong note, a missing note, or spread over time is handled exactly as today
  (wrong pitch, missed, chord spread tolerance); no new rules.
- **Wrong octave, extra notes, no input**: handled as for any library item.
- **Unsupported notation**: every new item uses only notation listed as supported; any item that produces a parser
  notice is a defect and is fixed before it is added.
- **Device loss** (MIDI keyboard unplugged mid-lesson): handled as today; nothing new.
- **Saved progress and links**: existing item ids, saved progress and remembered filters keep working; no existing
  item is renamed or moved.

## Requirements *(mandatory)*

### Functional Requirements

**Library structure**

- **FR-001**: The library MUST contain a new **Basics** shelf whose lessons are listed in teaching order.
- **FR-002**: The chord lessons MUST be on a new **Learning > Chords** shelf beside Keys and Key changes, listed
  from simplest to hardest.
- **FR-003**: New songs MUST be listed with the existing songs and MUST be findable by level, key and tags as every
  item is today.
- **FR-004**: Existing items, shelves, ids, saved progress and remembered filters MUST NOT change meaning or break.
- **FR-005**: The level check MUST NOT forbid any notation at any level: note values, ties, repeats and voltas, time
  signatures and their changes, tuplets, grace notes, ornaments, pedal, key signatures, accidentals, key and tempo
  changes. A level MUST be decided only by hand reach (pitch range, the widest chord in one hand, the widest leap),
  pace (tempo, length in bars and seconds, notes per second), hand independence and voices per hand, together with
  the existing playability tiers.
- **FR-007**: An Introduction item MUST contain at most one of these harder features: notes shorter than a beat,
  dotted rhythms shorter than a dotted half, ties, repeats or voltas, a pickup, a metre other than 2/4, 3/4 or 4/4,
  tuplets, grace notes or ornaments, accidentals outside the key signature, pedal, key, metre or tempo changes.
  Other levels have no such limit.
- **FR-006**: Every existing item MUST keep its current level; an item whose measured level falls below it after
  FR-005 MUST record why it sits higher (e.g. "a key change in the middle", "6/8 with a pickup").

**Basics lessons**

- **FR-010**: Basics MUST cover at least: the staff and middle C; whole, half and quarter notes; their rests; eighth
  notes; dotted notes; ties (within a bar and across a bar line); slurs/legato and staccato; time signatures 4/4,
  3/4 and 6/8; a pickup; repeat signs; steps and a five-note hand position; the bass clef and left hand; both hands
  together.
- **FR-011**: Each note-value and rest lesson MUST use a single repeated pitch.
- **FR-012**: Each Basics lesson MUST introduce at most one new notation idea and use no notation that no earlier
  lesson introduced.
- **FR-013**: Each Basics lesson MUST explain its idea in plain words (one or two sentences, plus how to play it and
  what the app checks - owner decision 2026-10-03; no unexplained jargon)
  in its description, and MUST print one short line of that explanation on the score above the first bar.
- **FR-014**: Basics lessons MUST be at the Introduction level and pass the level check for it (FR-005), which their
  tempo and pace are chosen to fit.

**Chord lessons**

- **FR-020**: Single-chord lessons MUST cover major, minor, diminished and augmented triads; suspended (sus2, sus4) chords;
  seventh chords (major 7, dominant 7, minor 7, half-diminished); and the inversions of triads.
- **FR-021**: Progression lessons MUST cover at least I-IV-I, I-V-I, I-IV-V-I, ii-V-I and a twelve-bar blues, each
  in more than one key, with smooth voice leading (common tones kept) stated in the description.
- **FR-022**: Two-chord switch lessons MUST cover at least: major -> minor on the same root (e.g. C -> Cm), a minor
  chord to the major chord a step below (e.g. Dm -> C), and the switches to IV and V and back (e.g. C -> F, C -> G),
  each in more than one key.
- **FR-023**: Every chord MUST carry a chord symbol shown above the staff.

**Songs**

- **FR-030**: At least eight new songs MUST be added, covering at least three keys, at least two minor-key songs and
  at least two songs in 3/4 or 6/8.
- **FR-031**: Every new song's melody MUST come from a source the owner approved, with a licence the library
  accepts (public domain, CC0, CC BY, CC BY-SA), committed unchanged and checked by the library audit; candidates
  without such a source MUST be rejected and recorded.
- **FR-032**: Every new song MUST list its composer (or "Traditional"), source, licence and every departure from the
  source (transposition, shortened, simplified rhythm).
- **FR-033**: Every new song's chords MUST pass the song chord check against its melody (the existing check, extended
  for moving left-hand patterns and the natural-minor chords v and VII at Beginner).
- **FR-034**: For each new song the project MUST record whether a multi-part public-domain or permitted-licence
  version exists (where, which licence), for a later Orchestra feature.

- **FR-035**: Every new song and chord lesson at Intermediate level or harder MUST have a simplified version at a lower
  level, titled "<title> (simplified)", made by a simpler chord progression, fewer notes per chord, or slower
  left-hand chords instead of a busy left hand; its description MUST say what was simplified. The simplified version
  keeps the original's melody recognisable and lists every change from the source as a departure.

**All new items**

- **FR-040**: Every new item MUST open without parser notices, be engraved like every Score, and play in
  Listen, Practice and Play mode with grading unchanged.
- **FR-041**: Every new item MUST be "comfortable" for each hand (constitution VII, "comfortable" tier).
- **FR-042**: Every new item MUST state what it trains, which hands it uses and its level, and MUST pass the level
  check for that level.
- **FR-043**: Every item written for this project MUST be marked as authored, CC0, with author and reviewer, and be
  reproducible from its definition (never hand-edited output), like the existing exercises and songs.
- **FR-044**: Every new lesson MUST have fingering where a beginner needs it (at least the first note of each hand
  position and every position change). Songs keep the existing rule: left-hand chord fingering, no right-hand melody
  fingering (as for the 10 existing songs).
- **FR-045**: New items MUST NOT contain Orchestra parts.
- **FR-046**: New items MUST work the same in the browser and in Electron; the Native audio plugin is not involved.

### Key Entities

- **Basics lesson**: an authored library item teaching one notation idea; has a teaching order, an explanation, a
  level (Introduction), the hands it uses.
- **Chord lesson**: an authored library item teaching chord types, inversions or a chord switch; names its chords
  (symbols), the switch trained and how a four-note chord is voiced.
- **Song**: a library item whose melody comes from an approved source, with chords added; has composer, source,
  licence, departures, level, key.
- **Simplified version**: a lower-level item made from a song or chord lesson; names the item it simplifies and
  what was simplified.
- **Source record**: an approved source with licence and checksums, plus (new) whether a multi-part version exists
  for a later Orchestra.
- **Rejected candidate**: a tune considered and not used, with the reason.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can find and open the first Basics lesson in under 30 seconds from opening the library.
- **SC-002**: Basics contains at least 15 lessons covering every topic of FR-010; chord lessons contain at least 15
  lessons covering every chord type and switch of FR-020 to FR-022; at least 8 new songs are added (FR-030), and every new item at Intermediate level or harder has a simplified version
  (FR-035).
- **SC-003**: 100 % of new items open with zero parser notices, pass their level check and the "comfortable"
  playability check.
- **SC-004**: 100 % of new songs reproduce their approved source in the library audit with zero unlisted differences,
  and the audit report stays fresh.
- **SC-005**: Playing any new item perfectly in Play mode (a synthetic perfect performance) gives 100 % correct, and
  grading it twice gives identical Grades.
- **SC-006**: 100 % of existing item ids, levels and saved progress records are unchanged, and every existing item
  passes the changed level check (FR-005, FR-006).
- **SC-007**: Every new song has a recorded answer to "multi-part source available?" (FR-034).

## Assumptions

- **Analyze follow-up (2026-10-03, owner "go with recommended")**: FR-035 applies from Intermediate up (Beginner chord
  lessons are already the simple form); FR-044 keeps the songs' existing fingering rule; FR-033 names the extended
  song chord check.

- **Basics is a new top-level shelf**, listed before Learning and Repertoire, because it is where a beginner starts.
- **Explanations are text only** (description plus one printed line); no video, animation or audio narration.
- **Simplified naming**: new simplified versions use "(simplified)"; the existing "easier" Morning Mood keeps its
  name and id (FR-004).
- **Held length is not graded**: grading judges note starts; adding release/hold judging would change grading for
  every Score and belongs in its own feature. The lessons say so.
- **"Comfortable" applies to every new item** (they are exercises, songs or arrangements at Introduction to
  Intermediate level), so four-note chords are split between hands or voiced with three notes.
- **Sources**: new songs come from the same kind of sources as the existing ones (public-domain editions such as
  Mutopia); the owner approves each source before it is added, as today. Tunes already rejected for copyright or
  licence reasons (see the sources README) are not proposed again.
- **Greensleeves already exists** (Repertoire > Beginner and a song in A minor); "like Greensleeves" means more tunes
  of that kind, not another Greensleeves.
- **Levels**: Basics lessons are Introduction; chord lessons range from Beginner to Intermediate; new songs from
  Beginner (simplified) to Intermediate. Level is about reach and pace only (FR-005).
- **Language**: item titles and texts are English like the rest of the library.
- **Shells**: browser and Electron; no new audio or MIDI behaviour.

## Out of Scope

- Orchestra parts for any item (a later feature; only the multi-part source list is prepared here).
- Grading of note length, release time, legato or staccato.
- New notation support, new grading or Practice rules, new UI screens beyond listing the new shelf (the level-check
  change of FR-005 is the one rule change).
- Advanced-level chord voicings (more than three keys in one hand, spans beyond an octave).
- Simplified versions of the existing 21 Repertoire pieces and 10 songs (only new items get one here).
- Copyrighted songs or sources with a licence the library does not accept.
