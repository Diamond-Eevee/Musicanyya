# Research: Melody over chords in Learning exercises (014)

Inputs: `spec.md` (owner decisions of 2026-09-28: rewritten items start fresh; per-key steps out of scope), the
generator (`src/core/library/exercise/generate.ts`), the level criteria (`src/core/library/levels.ts`,
`src/core/defaults.ts`), the step-order check (`src/core/library/step-order.ts`), the independent theory check
(`tools/library/fidelity/theory.ts`, `exercise-claims.ts`) and a `music-domain-expert` consultation (2026-09-28,
summarised in R3-R7; its method-book comparisons were from memory, not re-read sources).

## R1 - Where the melodies come from: authored step sequences, checked by rules

**Decision**: Melodies are **authored** in the exercise definitions as scale-step sequences with note values
(`melody` hand part, contract exercise-definition 1.3), a few **variants** per section and mode, rotated across the
keys/key pairs of a family (variant = item index mod variant count). The generator only spells, places and fingers
them. A separate, independent **melody rule check** (R8) verifies every generated item against the Difficulty ladder
and the harmony rules, and the build refuses to write an item that fails.

**Rationale**: One definition already serves all 24 keys / all pairs by writing chords as degrees; melodies written
as steps inherit that. Authored phrases are readable, reviewable and deterministic (golden-tested), and the owner's
listening check (SC-005) judges music a person chose. The feature-007 lesson (agent-written music can be wrong)
is met by the mechanical check, not by trusting the author.

**Alternatives considered**: (a) An algorithmic melody generator (constraint search over chord tones and passing
tones): varied for free, but harder to explain, prone to aimless lines, and its output still needs the same checker.
(b) Borrowed public-domain tunes: they rarely fit a given progression and each needs a source check (feature 007).
(c) One phrase per section for every key: fails FR-008 (variation).

## R2 - Scope after the plan-time correction

**Decision**: 59 items: 54 key-change items (6 definitions) and 5 chord-change drills (5 chords-form definitions).
The per-key steps are out of scope (owner decision 2026-09-28, spec Background).

**Rationale**: A survey of every definition found both hands on the same block chord in every bar of those 59;
the intermediate and advanced steps share only the closing tonic chord (a normal ending) and would lose their
progress for a one-bar change.

**Alternatives considered**: Rewriting the steps' last bar (rejected by the owner).

## R3 - Minor keys: sixth and seventh degrees

**Decision**: Minor phrases say explicitly which form each 6th/7th uses (`alter` on the note). The rule check allows:

- degree 7 **raised** when the sounding chord is V or vii°, or when the next melody note is the tonic by step;
- degree 7 **natural** when the sounding chord contains the natural 7th (III, v, VII), or the line descends to 6;
- degree 6 **raised** only in the ascending figure 5-♯6-♯7-1 over V or i; never over iv, ii° or VI;
- **never** an augmented second (natural 6 next to raised 7) and **never** a cross-relation (a melody note with the
  same letter as a sounding left-hand note but another accidental), at every level;
- a raised 7th followed by a chord start on i resolves to 1.

**Rationale**: Standard melodic-minor practice, reducible to a pure predicate (note, alteration, sounding chord,
next note). Explicit alterations keep the generator simple and make each choice visible in the definition.

**Alternatives considered**: Harmonic minor everywhere (augmented seconds, unidiomatic); natural minor over a major
V (cross-relation); the generator choosing alterations (hides decisions; the checker would duplicate the generator).

## R4 - Non-chord tones and clashes

**Decision**: A melody note sounding at a chord start is a chord tone (FR-006). Any other note that is not in the
sounding chord (a non-chord tone) is approached and left by diatonic step, as a passing tone (same direction) or a
neighbour (step away, step back), and is never the last note. Per level: Introduction - only on the second half of a
bar, one at a time; Beginner - weak beats only, one at a time; Intermediate - also off-beat eighths, up to two passing
tones in a row in one direction; Advanced - as intermediate (the appoggiatura the expert suggested is left out:
it is a leap to a non-chord tone, which FR-006 forbids; analyze A2). No appoggiaturas, suspensions, escape tones or
anticipations. Clashes: no minor second / major seventh /
minor ninth between the melody and a sounding left-hand note at a chord start or strong beat (passing and neighbour
tones on weak beats exempt); parallel octaves between melody and bass on consecutive chord starts forbidden from
intermediate up only; parallel fifths not checked.

**Rationale**: Textbook definitions, each a predicate over three consecutive notes and the metre position. Beginner
method books routinely have outer-voice octave parallels, so forbidding them early over-constrains for no audible
gain.

**Alternatives considered**: Chord tones only (static, forces repeated notes with two notes per bar); full four-part
voice-leading rules (wrong model for melody plus block chord).

**Implementation note (T010, 2026-09-28)**: the downbeat is strong, and so is the half bar in a metre of four beats;
a non-chord tone may stand where its level or a lower one allows it (introduction from the half bar on, beginner also
on any later beat, intermediate and advanced anywhere after the downbeat). The clash rule exempts the leading tone
rising by step to the tonic: FR-005 requires the raised 7th leading to the tonic, and over the tonic chord it always
lies a major seventh above the root, so without the exemption no introduction item could sound G♯ over A minor's
i - and a relative change into minor (C major to A minor) could not be heard (FR-007). Alternatives: treating beat 3 as
weak (makes the clash rule redundant with `chord-tone` for triads); dropping the key-change audibility requirement at
introduction (FR-007 applies at every level).

**Amendment (T060, 2026-09-28)**: a **diatonic passing tone** on a strong beat that is not a chord start (in 4/4 the
half bar) is exempt from the clash rule: it moves by diatonic step from a chord tone and on by step, in the same
direction, to a note in the chord sounding under it. Neighbour tones there stay checked. **Why**: at introduction a non-chord
tone can only be a half note on beat 3, so the unamended rule forbade 4 and 7 over I and 2 and 6 over i on every beat
where a non-chord tone may stand. A melody could then never move 5-4-3 over I or 3-2-1 over i. *A minor to C major -
introduction* (8 bars of I, G needed within 2 bars, ending on C) had no valid melody at all, and *C major to A minor*
was left with A-G♯-A for 8 bars. The exemption is second-species counterpoint (dissonance on the second half note only
as a passing tone) and method-book practice (*Ode to Joy*: E E F G over C). `music-domain-expert` consultation
2026-09-28 (its Fux/method-book references were from memory) agreed, and advised keeping neighbours checked: a
dissonant neighbour dwells on the clash and returns to the note it clashed with. **Alternatives**: treating the half
bar as weak (also exempts neighbours and chord-start-like dwelling); dropping key-change audibility at introduction
(rejected above).

## R5 - Register

**Decision**: The melody's reference tonic (`step` 1) is the section key's tonic in **octave 4** (C4-B4) in every
key; the left hand stays exactly where the generator puts it today (bass window around the tonic an octave below the
per-key table octave). The rule check requires, at every instant, the lowest melody note to be at least 3 semitones
above the highest sounding left-hand note, and the melody inside C4-A5 (C6 at advanced).

**Rationale**: Puts every key in the classic middle-C region (C position C4-G4) on the treble staff. The per-key
scale table (octave 3 from F♯ up) would put an F♯ position inside the left-hand triad. A fixed octave keeps phrases
predictable for the author; the checker catches the few low-note collisions so the author changes the variant.

**Alternatives considered**: The scale's per-key octave (collides with the left hand); computing an octave per
phrase from the left hand (can jump octaves between sections, which a learner cannot follow).

## R6 - Right-hand fingering

**Decision**: Introduction and beginner: a five-finger position; finger = position index + 1 (thumb on the lowest
note of the position, `position` given per phrase), in all 24 keys (Faber teaches all twelve major positions this
way). Intermediate and advanced: stepwise runs take the finger of each degree from the one-octave scale table
(`scales.ts`, Franklin Taylor), including its thumb-under / finger-over; leaps stay inside the current five-note frame
or start a new position. Written fingering only where a phrase or position starts, after a shift, and on a
thumb-under or finger-over (FR-009). The rule check verifies: an ascending step has f2 = f1 + 1 or a thumb-under
(f1 in 2-4, f2 = 1); descending mirrors it with a finger-over; a leap of k steps has |f2 - f1| <= k or is a shift; no
thumb-under onto a black key; spans limited per level.

**Rationale**: Matches method-book practice (fingers at position starts, not on every note), reuses a verified
table, and is mechanically checkable.

**Alternatives considered**: A fingering optimiser (not explainable); fingering on every note (clutter).

**Implementation note (T010)**: the check reads fingers the way a learner does - a written finger sets the hand's
position, an unwritten one continues it (finger = steps above the thumb + 1); a note outside the position with no
finger written is a `fingering` finding. A position change is a thumb-under / finger-over or else a shift; at
introduction and beginner a thumb crossing counts as a shift (the ladder allows crossings from intermediate). A shift
is "at a section start" at the first note of a key segment or after a rest.

**Amendment (T062, 2026-09-28)**: fingering is written on **every** melody note, not only where a position starts.
**Why**: feature 005 FR-006 requires a fingering mark on every note of a Learning exercise, and the index build
refuses an exercise whose `fingeringCoverage` is not 1 - with fingers only at position starts every rewritten
introduction item came out at 0.68. 014 FR-009 names where fingering must at least appear; every note includes those
places, and it matches every other exercise on the shelf. The rule check is unchanged: each written finger sets the
position, so a phrase must now finger every note consistently (a `finger` override on one note no longer carries an
unwritten position for the notes after it). **Alternatives**: exempting melody items from the coverage rule (changes
feature 005's requirement - an owner decision, and it would make these the only exercises with unfingered notes).

**Amendment (T066, 2026-09-28)**: the check reads a **leap** that moves the hand by direction, not only by span. At a
chord start after at least a quarter (`SHIFT_MIN_QUARTERS`) the hand may lift to a new position with any fingers (a
shift). Anywhere else: going up, a lower finger is only the thumb passing under; coming down, a higher finger only
passes over the thumb; such a crossing spans at most a third (`CROSSING_LEAP_MAX_STEPS`) and the thumb is on a white
key; the same finger never moves to a new pitch; thumb to finger 2 spans at most a fourth
(`THUMB_TO_SECOND_MAX_STEPS`). A step keeps its rule (thumb-under / finger-over only, no chord-start exemption).
**Why**: the T032 music review found backward and same-finger leaps in all 18 intermediate items (e.g. E3 G2, B2 G♯4,
G2 D2 after an eighth) that the old rule passed, since a leap at intermediate counted as an unlimited shift.
**Fingers in the definitions, not the generator**: the scale-table default stays; each intermediate phrase writes a
finger on every note (`MelodyNote.finger`, contract 1.3.1), checked by the rule above. Making the generator keep
leaps inside a five-finger frame would break the table's thumb-under points for the stepwise runs that follow, and
choosing positions automatically is the fingering optimiser rejected above.

**Amendment (T071, 2026-09-28)**: at a chord start after at least a quarter a **step** may move the hand too (the hand
lifts between phrases; a teacher writes 5-4-3-2-1 into a cadence rather than crossing onto the tonic). Everywhere else
a step keeps thumb-under / finger-over only. **Why**: the T032 follow-up review found thumb-pivot figures (A1 G♯4 A1)
and crossings onto the tonic that the strict step rule forced; its natural fixes need this lift.

**Amendment (T076, T091, 2026-09-28)**: three checker rules added with the reworked ladder. (1) A legal thumb-under
/ finger-over that lands on a chord start is a crossing, not a lift: the T071 rule (a step may move the hand at a chord
start after at least a quarter) applies only when the step is not a legal crossing. (2) A second step crossing in the
same direction two notes after the last one (`ZIGZAG_NOTES`, a descent fingered 1-2-1-2) is a `fingering` finding:
no scale fingering crosses every second note (found by the T088 review). (3) `triadRoot` recognises a root only by a
triad's own third-and-fifth pair (`TRIAD_SHAPES`: major, minor, diminished, augmented); "a third and any fifth" had
named G♯ the root of G♯-B-E (an augmented fifth above G♯), rejecting the rising 5-♯6-♯7-1 over V6.

## R7 - Difficulty: ladder, existing criteria and step order

**Decision**: The spec's Difficulty ladder becomes a named constants table (`MELODY_LADDER` in
`src/core/defaults.ts`) used by the rule check. Three stricter house rules, inside the spec's limits: at beginner the
left-hand chord changes at most once per bar (true of every beginner item today); at intermediate the melody's
eighths never coincide with left-hand eighths; dotted rhythms only at advanced. The existing level criteria still
apply and bite: beginner allows at most 4 notes in a row at the shortest value (`LEVEL_LONGEST_RUN_MAX`) - counted
only when the shortest value is faster than a quarter (`facts.ts`, correction C), so quarter-note scale runs are free
at introduction and beginner (correction 2026-09-28, R11); introduction requires a hand-independence fraction of 0,
which a held chord under a moving right hand satisfies (feature 011 B1). Step order (`checkStepOrder`) keeps each
key-change folder's introduction < beginner < intermediate on `notesPerBeat` and the other step-order facts.

**Rationale**: Reuses the library's levelling machinery rather than inventing a second one; the ladder adds only
what the level criteria do not measure (leap size in steps, shifts, non-chord-tone placement).

**Alternatives considered**: Moving the ladder into `levels.ts` as new level criteria for every item (would change
the levelling of Songs and Repertoire, out of scope).

## R8 - The mechanical check: independent of the generator

**Decision**: A new dev-only module `tools/library/fidelity/melody-rules.ts` reads a generated MusicXML file (the
same reader the theory check uses) and applies R3-R7 plus FR-005-FR-008 (key membership, chord tone at chord starts,
ending on the tonic over the tonic chord, first note after a key change in the new tonic chord and a new-key-only
pitch class within two bars, variation). It imports nothing from `src/core/library/exercise/` (asserted by a test,
as for `exercise-claims.ts`). It runs (1) in the build (`pnpm library:exercises` refuses to write a failing item),
(2) as rule set `exercise-theory-v3` in the audit (the right hand's claim becomes `{ kind: 'melody', level }`), and
(3) in a shelf sweep test over all 59 items.

**Rationale**: FR-014 asks for a mechanical check, and feature 007 showed review alone is not enough. Independence
from the generator means a shared mistake cannot pass both.

**Alternatives considered**: Checks inside the generator only (not independent); review by the music-domain-expert
only (FR-014 forbids).

**Implementation note (T010)**: key-change audibility (FR-007) asks, within two bars of the change, for a melody pitch
class of the new key's characteristic scale (major, or harmonic minor) that the old key's lacks - C to A minor: G♯;
A minor to C: G natural; C to C minor: E♭ or A♭. A note of the old key only (full scales, both forms of a minor
6th/7th) after the change is a `key-change` finding rather than `key`. The left hand's chord changes per bar
(`lhAttacksPerBar`) are reported under `value`. `melodyDegrees` (exported) gives each item's degree sequence for
`checkMelodyVariation`.

## R9 - Progress starts fresh

**Decision**: Nothing is needed at run time: progress is keyed by the file's content hash (feature 013 R-3), so a
rewritten file has no records. The 5 drills carry `supersedes` links (feature 011) that would pool progress from
their pre-011 doubled-chord predecessors; their definitions drop `supersedes`, and `tools/library/successors.ts`
marks those 5 entries `resetBy: '014'` so the feature-011 invariants ("every old id appears once in the shelf's
supersedes") exempt them. The key-change definitions have empty `supersedes` already. Old records stay in storage,
unreachable; a test proves they cause no error in the browser or the suggestions.

**Rationale**: Implements FR-012 exactly with the smallest change, and keeps the successor table as history for the
audit report.

**Alternatives considered**: Deleting old records (touches user data for no benefit); keeping `supersedes` (would
show pre-011 doubled-chord progress, against FR-012).

## R10 - Left hand in the rewritten items

**Decision** (superseded for the key-change items' chords by R11, 2026-09-28): Key-change items keep their left-hand
whole-note block chords at every level (same chords, inversions, bars). The drills keep their left hand exactly (dotted half + quarter rest with the repeat, then whole notes with
common tones tied, then the tonic); the right hand rests with the left hand's quarter rest (US3 #2). Difficulty grows
through the melody.

**Rationale**: FR-002 (same chords and inversions); the intermediate relative items teach voice-leading in the
chords, which broken chords would blur; fewer moving parts per item.

**Alternatives considered**: Broken left-hand chords at intermediate (allowed by the ladder; left for a later
feature if the owner asks).

## R11 - Rework after the owner's listening check (T057, 2026-09-28)

**Finding**: *C major to A minor - introduction* was "not fun to play": half notes then a whole note in one five-note
position, over i held for eight bars. The key step the learner plays just before it at the same level (*C major -
introduction*) has quarter notes, a C4-C5 scale up and down with the thumb passing under (1-2-3-1-2-3-4-5) and I-V
alternating every bar. The first ladder (R7) set introduction below the key step instead of level with it.

**Decision** (owner, 2026-09-28):
1. Ladder rows, introduction: quarter notes, range up to an octave per section, steps only, thumb-under /
   finger-over inside a scale run (not counted as shifts) plus the one lift at a section start kept from T068, non-chord tones on weak beats (passing tones of a scale run),
   one block chord per bar. Beginner: as introduction plus leaps up to a third (to chord notes), chord changes on
   the half bar, and at most two lifts anywhere (the agent's value within "a step above introduction"; the owner may
   tune `MELODY_LADDER.beginner.shiftsMax`). Intermediate and advanced unchanged. `MELODY_LADDER` follows (T072 made the checker read every
   level rule from it).
2. FR-002 amended for the key-change items: the key change bar, the tonic at the start of each key's section and at
   the end, and the chord before the change stay; the chords in between are re-written with the key's primary triads (I/IV/V,
   i/iv/V) so the harmony moves - at introduction one chord per bar, as the key step; beginner may change on the half
   bar; intermediate keeps its (already moving) progressions unless a melody needs otherwise. Voicing (close
   position, the same inversions per degree as today) and left-hand fingering stay as generated. The drills keep
   their left hand (they train those chord changes).
   Found while composing (library level criteria, not changed): introduction allows no chord wider than a fifth
   (criterion 16), so its chords are root-position triads (beginner: V6 and IV6/4, which keep the hand in place);
   root-position iv in the octave-lower E minor is A1, below the introduction's bounds (criterion 2); and a minor second
   key that keeps the first key's signature (C major to A minor ...) counts its raised 7ths as accidentals (criterion
   11: at most one in 12 bars), so those minor sections move between i, VI (the pivot chord) and iv, and the melody's
   leading tone is the one accidental. A minor first key has its own signature (its raised 7ths are exempt) and plays V.
3. Beginner must stay not easier than introduction in every ladder dimension and harder in at least one (US2 #3):
   leaps of a third and half-bar harmony, plus tempo 72 > 60 in step order.

**Rationale**: the learner meets the key-change folder after the key steps; an introduction item slower and emptier
than the key step reads as a step back. Quarter-note runs are within the library's introduction criteria (shortest
value 1 beat; runs count only below a quarter; hand independence 0 holds with a block chord under a moving hand, as
in the key step).

**Alternatives considered**: keep the ladder and only make the phrases more tuneful (rejected by the owner: the rhythm
is the problem); quarters within one five-finger position (smaller change, but still easier than the key step).

No new dependency, no new technology.
