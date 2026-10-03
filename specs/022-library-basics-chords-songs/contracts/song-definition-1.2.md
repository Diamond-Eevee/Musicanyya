# Change request: song definition 1.1.0 -> 1.2.0 (MINOR)

**Canonical contract**: [specs/011-learning-by-key/contracts/song-definition.md](../../011-learning-by-key/contracts/song-definition.md)
(fold this in). **Feature**: 022, 2026-10-03.

## Changes

1. Optional `leftHand`:
   ```json
   "leftHand": {
     "type": "object", "additionalProperties": false,
     "properties": {
       "pattern": { "enum": ["block", "waltz", "repeated", "broken"], "default": "block" }
     }
   }
   ```
   - `block` - today's held block chord (default; existing songs stay byte-identical).
   - `waltz` - 3/4 (or 6/8 per dotted beat group): the lowest note of the chord's voicing alone on the first beat of the
     bar (and where the chord starts), the other two notes on the other beats. In root position that is the root; where
     the voicing is inverted to keep off the melody it is the inversion's bass (found in implement, T055).
   - `repeated` - the block triad struck on every beat (dotted beat in 6/8), each a beat long.
   - `broken` - root, fifth, third, fifth in eighths (6/8: root, fifth, third per dotted beat) from the root-position
     triad of the register rule, an octave lower where it would share a key with the melody (an Alberti bass in close
     position; T055 - the octave-lower root of the draft made a 19-semitone stretch for no musical gain).
   Every pattern keeps the 1.1.0 register and melody-avoidance rules per strike and stays within "comfortable".
2. Optional `simplifies: string` - written into the sidecar (library-index 1.5.0).
3. `meta.raisedBecause` optional (FR-006, data-model §1).
4. `meta.level` stays `beginner | intermediate`; a definition with `simplifies` must have a lower level than the
   target.
5. **Ordering** (replaces 1.1.0 §2 step 6 for paired songs): a simplified song and the song it `simplifies` get
   consecutive `stepOrder` values in their folder, simplified first. Unpaired songs are ordered as in 1.1.0 (Beginner
   first, then Intermediate, each by title) and come first; the pairs follow them, ordered by the full song's title.
   So the 10 existing (unpaired) songs keep their `stepOrder`; the builder test pins those 10 values.
6. Id pattern unchanged; a simplified song's id ends in `-simplified`, its title in " (simplified)"; the
   `departures` of a simplified song list what was simplified (FR-035).
7. Optional `melody.joinShortBars: boolean` (default `false`; added in implement, T077). A source may print a phrase
   end as a bar line inside a bar (Leoni, Mutopia 525: `\bar "||"` after beat 3 of a 4/4 bar), so its reading has short
   written bars in the middle of the piece, which the builder refuses (1.1.0 §2.1). With `joinShortBars`, a short bar
   other than the first is joined with the bars after it while together they make at most one bar of the metre, never
   across a repeat sign or into an ending; the joined bar keeps the first bar's start, and the item's bars are numbered
   in order (0 for a pickup). The melody is unchanged note for note, so the audit's melody check is unchanged; the
   definition's `departures` say the phrase lines are left out.

## Audit

Songs built with this version use rule set `song-chords-v2` (audit-record 1.5.0); existing records keep v1.
