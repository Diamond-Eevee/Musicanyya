# Feature Specification: Learning by key

**Feature Branch**: `011-learning-by-key`
**Created**: 2026-09-26
**Status**: Draft
**Input**: User description: "organise learning xmls, put them in folder. My idea: folders: cmajor, cminor,
cmajortocminor, dminorcmarojamajor ... inside put by difficulty: introduction just simple chords with playing notes
(like on pasted image), maybe a bit less frequent accompaniment hand so it will be slightly easier. Also try to find
some beginner songs to test just chords (they should be free/opensource/etc). What do you propose?"

The pasted image is the existing *C major - scale and chords for both hands* exercise: section A, right hand plays the
scale in quarter notes while the left hand holds root-position triads in half notes (I-V-IV-V-I); section B, the hands
swap.

## Proposal in short

Today the *Learning* shelf is flat: *Chords* holds 24 near-identical triad drills and one scale-and-chords piece,
*Chord changes* holds 13 progressions, almost all in C. A learner cannot see "what do I play first in G major, and
what next?". This feature turns *Learning* into a **path per key**:

```
Learning
  Keys
    C major        1 Introduction  2 Beginner  3 Intermediate  4 Advanced  Songs
    A minor        ...
    G major, E minor, F major, D minor, ...  (circle-of-fifths order, each major next to its relative minor)
  Key changes
    C major -> A minor   (relative: same key signature, new tonic)
    C major -> C minor   (parallel: same tonic, new key signature)
    A minor -> A major
    ...  (relative and parallel pairs, both directions, for C, G, F and D major - 16 folders)
```

Inside every key the same four steps, each one small step harder than the last:

| Step | What the learner plays |
|---|---|
| 1 Introduction | One hand plays the scale slowly; the other hand holds **one chord per bar** (whole notes) - sparser than the image. Then the hands swap. Only I and V (i and V in minor). |
| 2 Beginner | The pattern in the image: scale against **half-note** chords, I-IV-V-I, both directions. |
| 3 Intermediate | Chord changes with inversions (the smooth-voice-leading shapes), broken chords, both hands at once on the chords. |
| 4 Advanced | Cadences and progressions (I-vi-IV-V, ii-V-I, minor cadence with the raised leading tone) with the scale in both hands, quicker values. |
| Songs | Public-domain songs with the melody in the right hand and **block chords in the left hand**. Practise the left hand alone and the app plays the melody for you (existing hands-separately accompaniment). |

The existing drills are not thrown away: each one moves to the key and step it fits (e.g. *C major triads* ->
*C major / Intermediate*, *C major - I-V-I* -> *C major / Beginner*, *C major - major and minor* ->
*Key changes / C major -> C minor*).

## Clarifications

### Session 2026-09-26

- Q: Which keys get the full four-step path? -> A: All 24 major and minor keys.
- Q: Which key changes? -> A: Relative and parallel pairs in both directions, starting with C, G, F and D major
  (16 folders); no longer journeys.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find my key and start at the easiest step (Priority: P1)

A beginner wants to learn C major. They open the library, open *Learning > Keys > C major* and see the steps in
order, from *Introduction* to *Advanced*, then *Songs*. They open *Introduction*: one hand plays the C major scale while
the other holds a single chord per bar. It is easy enough to play in Practice mode on the first try.

**Why this priority**: it is the organising idea the owner asked for and it delivers value with only the existing
material regrouped plus the new Introduction step.

**Independent Test**: open the library, go to *Learning > Keys*, pick any key in scope, and check that its steps are
listed in difficulty order, that *Introduction* opens and plays in Listen mode, and that in Practice mode its
accompanying hand has at most one chord per bar.

**Acceptance Scenarios**:

1. **Given** the library is open, **When** the user opens *Learning*, **Then** they see *Keys* and *Key changes*,
   and *Keys* lists every key in scope in circle-of-fifths order with each major key followed by its relative minor.
2. **Given** a key folder, **When** it is opened, **Then** its items appear in the fixed order Introduction,
   Beginner, Intermediate, Advanced, Songs, each marked with its step name and level.
3. **Given** the *Introduction* item of any key, **When** it is opened, **Then** one hand plays the scale of that key
   and the other plays only the tonic and dominant chords, at most one chord per bar, at a slower tempo than the
   *Beginner* item of the same key.
4. **Given** any two consecutive steps of one key, **When** their facts are compared, **Then** the later step is at
   least as demanding on every measured fact (tempo, notes per beat, chord changes per bar, hand independence) and
   more demanding on at least one.

---

### User Story 2 - Learn to move between keys (Priority: P2)

A learner who can play C major and C minor wants to practise switching between them. They open *Learning > Key
changes > C major -> C minor* and find exercises that start in one key and turn into the other, from a slow
introduction to a harder version, each labelled with the kind of relationship (relative or parallel).

**Why this priority**: the owner named key changes explicitly; it builds on single keys, so it comes after them.

**Independent Test**: open any key-change folder; every item starts in the first key, ends in the second, shows the
change of key (signature and/or tonic) in the Score, and the folder's items are ordered by difficulty.

**Acceptance Scenarios**:

1. **Given** the *Key changes* folder, **When** it is opened, **Then** each entry is named "<from key> -> <to key>"
   and says whether the keys are relative or parallel.
2. **Given** a key-change item, **When** it is played in Listen mode, **Then** it begins in the first key and ends
   on the tonic chord of the second key.
3. **Given** a key change that alters the key signature (e.g. C major -> C minor), **When** the Score is shown,
   **Then** the new key signature appears at the bar where the change happens.

---

### User Story 3 - Songs to try chords on (Priority: P2)

A learner who knows I, IV and V in a key wants to use them in real music. In the key's *Songs* step they pick a
well-known public-domain song, choose "left hand only" in Practice or Play mode and play the block chords while the
app plays the melody.

**Why this priority**: gives the drills a purpose; depends on no other new work, but needs sourcing and review.

**Independent Test**: open any song in a *Songs* step, select the left hand in Practice mode, and check that only
chords are expected from the learner, the melody sounds as accompaniment, and every chord belongs to the set the
song's step promises.

**Acceptance Scenarios**:

1. **Given** a song in a *Songs* step, **When** it is opened, **Then** the right hand has the melody, the left hand
   has block chords, and chord symbols are shown above the staff.
2. **Given** a song with "left hand only" selected in Practice mode, **When** the learner plays the chords, **Then**
   the melody sounds as the cursor passes it and only the chords are expected.
3. **Given** any song, **When** its details are shown, **Then** it names the source it was checked against and its
   licence, and the licence is public domain or CC0.
4. **Given** a beginner-level song, **When** its chords are listed, **Then** it uses only the primary chords of its
   key (I, IV, V in major; i, iv, V in minor) and changes chord at most once per bar.

---

### User Story 4 - Old links still work (Priority: P3)

A returning user had a drill in their recent items or remembered settings from before the reorganisation. After the
update, the drill opens from its new place and their remembered settings still apply.

**Why this priority**: protects existing users; small.

**Independent Test**: with a remembered item from the old layout (e.g. *Chords > C major triads*), open the library
after the update: the item opens from its new place and its remembered run settings are kept.

**Acceptance Scenarios**:

1. **Given** a remembered library item from the old layout, **When** the app starts, **Then** it resolves to the same
   exercise in the new layout, with its remembered settings.
2. **Given** an old item that no longer exists as such, **When** it is requested, **Then** the user sees a notice
   naming what replaced it, never an error.

### Edge Cases

- Keys with many accidentals (F# major, Eb minor, Db major): the Introduction must be just as easy in shape; the key
  signature is the only added difficulty, and enharmonic spellings follow the key (no Gb in an F# major exercise).
- Minor keys: the V chord uses the raised leading tone (harmonic minor), and the Introduction scale says which minor
  form it uses; the accidental is written on every occurrence it needs.
- Key-change items across a key signature change: the cancelling naturals and the new signature are engraved; notes
  tied across the change keep their pitch.
- A song whose melody needs a chord outside the step's promised set: it moves to a higher step, or it is not shipped.
- A song whose only machine-readable source has a licence other than CC0/public domain: rejected and recorded with
  the reason (as feature 005 requires), never adapted.
- A generated exercise that fails the engraving or level check: the library index refuses it, naming the item.
- Practice mode with both hands on the Introduction: the whole-note chord holds while the scale hand moves on; the
  learner is never asked to re-strike a held chord.
- The learner plays the chord in a different inversion or octave: judged exactly as feature 002/003 already judge
  pitch (this feature does not change grading).
- A key folder with no songs yet: the *Songs* step is simply absent, never an empty placeholder.

## Requirements *(mandatory)*

### Functional Requirements

**Organisation**

- **FR-001**: The *Learning* section MUST contain two folders, *Keys* and *Key changes*, replacing the current
  *Chords* and *Chord changes* folders.
- **FR-002**: *Keys* MUST hold one folder per key in scope, named by the key (e.g. "C major", "A minor"), ordered
  around the circle of fifths from C major, each major key directly followed by its relative minor.
- **FR-003**: Each key folder MUST present its items as ordered steps - Introduction, Beginner, Intermediate,
  Advanced, then Songs - and each item MUST show its step.
- **FR-004**: *Key changes* MUST hold one folder per key pair in scope, named "<from key> -> <to key>", each stating
  the relationship (relative or parallel) and holding its items in difficulty order (Introduction to Advanced).
- **FR-005**: Every existing *Learning* item MUST be placed in the key (or key-change) folder and step it fits, or be
  replaced by a newer item that covers the same skill; no existing skill may disappear from the shelf.

**Steps inside a key**

- **FR-006**: Every key in scope (FR-015) MUST have one *Introduction*, *Beginner*, *Intermediate* and *Advanced*
  item.
- **FR-007**: The *Introduction* item MUST have one hand play the key's one-octave scale up and down in quarter notes
  while the other hand plays only I and V (i and V in minor) in root position, **at most one chord per bar**, then the
  same with the hands swapped; its tempo MUST be lower than the *Beginner* item of the same key.
- **FR-008**: The *Beginner* item MUST follow the pattern of the existing *C major - scale and chords* exercise: scale
  against half-note chords using I, IV and V, hands swapping halfway.
- **FR-009**: The *Intermediate* item MUST add inversions (close-position voice leading between I, IV and V) and at
  least one passage where both hands play chords; the *Advanced* item MUST add at least one four-chord progression
  including a minor chord of the key (vi or ii in major; VI or iv in minor) and a faster note value than the step
  before.
- **FR-010**: Within one key, each step MUST be at least as demanding as the step before on every measured difficulty
  fact the library already derives (tempo, notes per beat, hand independence, chord changes per bar) and more
  demanding on at least one; the library check MUST reject a key whose steps break this order.
- **FR-011**: All exercises of one step MUST share the same shape in every key (only the key differs), so a learner
  who finished a step in one key knows what the same step asks in another.
- **FR-012**: Every exercise MUST carry fingering for every note, matching standard fingering for that key's scale
  and triads.

**Key changes**

- **FR-013**: A key-change item MUST start in the first key, establish it with its tonic chord, move to the second key
  and end on the second key's tonic chord; when the key signature changes, the new signature MUST be written at that
  bar.
- **FR-014**: The existing same-tonic drills (*C major - major and minor*, *A minor - minor and major*) MUST move into
  the matching *Key changes* folders.

**Scope of keys**

- **FR-015**: The first release MUST give all 24 major and minor keys the full four-step path (Introduction,
  Beginner, Intermediate, Advanced). *Key changes* MUST cover relative and parallel pairs in both directions for
  the major keys C, G, F and D: each major key to and from its relative minor (C major <-> A minor, G major <->
  E minor, F major <-> D minor, D major <-> B minor) and to and from its parallel minor (C major <-> C minor,
  G major <-> G minor, F major <-> F minor, D major <-> D minor) - 16 key-change folders. Longer journeys through
  three or more keys are out of scope.

**Songs**

- **FR-016**: The library MUST offer at least 8 beginner songs for practising chords, spread over at least 4 keys
  including at least 2 minor keys, each placed in the *Songs* step of its key.
- **FR-017**: Each song MUST have the melody in the right hand and block chords in the left hand with chord symbols
  above the staff; a beginner-level song MUST use only the key's primary chords and change chord at most once per bar.
- **FR-018**: Each song's melody MUST be public domain and checked note by note against a named public-domain
  printing or recognised source (the audit process of feature 007); the chord arrangement MUST be the project's own
  work released as CC0. A song that cannot be verified or is not free MUST NOT ship and its rejection MUST be
  recorded with the reason.
- **FR-019**: Each song MUST be practisable "left hand only" in Practice and Play mode with the melody sounding as
  accompaniment (the existing hands-separately behaviour; no new mode).

**Continuity and quality**

- **FR-020**: Remembered library items and their remembered run settings from the old layout MUST resolve to the
  corresponding new items; an item with no direct successor MUST show a notice naming its replacement.
- **FR-021**: Every new and moved item MUST pass the library's existing checks: licence, engraving (beams and
  accidentals complete), level criteria, fidelity audit record, and loading through the app's parser without notices.
- **FR-022**: The published level criteria MUST gain an *Introduction* level (below *Beginner*) with written,
  objective limits, and every Introduction item MUST satisfy them.
- **FR-023**: The library MUST keep working unchanged in the browser and in the Electron Shell; no Native audio plugin
  is involved.

### Key Entities

- **Key folder**: one key (tonic and mode) with its ordered steps; position given by the circle of fifths.
- **Key-change folder**: an ordered pair (or sequence) of keys, its relationship (relative, parallel) and its steps.
- **Step**: Introduction, Beginner, Intermediate, Advanced or Songs; fixed order; the same exercise shape in every key.
- **Song**: a library item whose melody is a verified public-domain tune and whose left-hand chord arrangement is the
  project's own; carries its source, licence and chord set.
- **Level criteria**: the existing objective limits per level, extended by an *Introduction* level.
- **Item successor**: the link from an old library item id to the item that now covers it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From the library, a user reaches the *Introduction* item of any key in scope in at most 3 selections
  (Learning -> Keys -> key -> item already listed).
- **SC-002**: 100% of keys in scope have their steps in strictly non-decreasing difficulty as measured by the
  library's derived facts, with an automatic check that fails when not.
- **SC-003**: In every *Introduction* item the accompanying hand plays at most one chord per bar and the tempo is at
  least 10% slower than the same key's *Beginner* item.
- **SC-004**: At least 8 songs over at least 4 keys (at least 2 minor) ship, each with a passing audit record naming
  its source; 0 items with a licence other than CC0 or public domain.
- **SC-005**: A first-time learner playing the C major *Introduction* hands together in Practice mode completes it
  with no more than 3 wrong notes on the first attempt in an owner test with at least 3 people (or the owner alone,
  recorded).
- **SC-006**: 100% of remembered items from the previous layout open the corresponding new item.
- **SC-007**: 100% of Learning items pass the licence, engraving, level, fidelity and parser checks; the full quality
  gate stays green.

## Assumptions

- The folder names the owner typed ("cmajor", "cmajortocminor") are the idea, not the spelling: folders show readable
  names ("C major", "C major -> C minor"). "dminorcmarojamajor" was one example of a key change; the owner chose
  relative and parallel pairs (clarified 2026-09-26, FR-015).
- Step names follow the repertoire levels (Beginner, Intermediate, Advanced) plus a new *Introduction* below them, so
  the words mean the same thing across the library.
- "Less frequent accompaniment hand" means one chord per bar (whole notes) in the Introduction, against the half-note
  chords of the pasted exercise, which becomes the *Beginner* step.
- Minor keys use harmonic minor for the V chord and the Introduction scale; natural and melodic minor scales appear
  from *Intermediate* on.
- Exercises are generated from definitions (as the current 24-key drills are), so adding keys costs review, not hand
  engraving.
- Songs are traditional, long-out-of-copyright tunes (e.g. *Frere Jacques*, *London Bridge*, *Oh When the Saints*,
  *Michael, Row the Boat Ashore*, *Skip to My Lou*, *Aura Lee*, *Scarborough Fair*, *Wayfaring Stranger*,
  *Drunken Sailor*), checked against public-domain printings such as those on the Internet Archive. Song titles still
  under copyright or disputed (e.g. *Happy Birthday*) are avoided. The final list is decided during planning and
  sourcing.
- Existing repertoire pieces (Twinkle, Ode to Joy, ...) stay in *Repertoire*; the new songs are chord-practice
  arrangements and live in *Learning*.
- No change to grading, Practice or Play mode behaviour, or the Metronome.

## Out of Scope

- Chord-symbol-only lead sheets where the learner invents the voicing (the app cannot grade a free voicing).
- Seventh chords, suspended chords and modes other than major and minor.
- Key journeys through three or more keys (e.g. D minor -> C major -> A major).
- A guided "what to play next" path across keys, or unlocking steps after a Grade.
- Transposing any library item into another key on demand.
- Songs under copyright, or sourced from licences other than CC0 / public domain (including CC BY-SA).
