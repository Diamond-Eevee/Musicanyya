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
   - `waltz` - 3/4 (or 6/8 per dotted beat group): the chord's root alone on the first beat, the triad without the
     root on the other beats.
   - `repeated` - the block triad struck on every beat (dotted beat in 6/8), each a beat long.
   - `broken` - root, fifth, third, fifth in eighths (6/8: root, fifth, third per dotted beat), the root an octave
     below the triad's register rule.
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

## Audit

Songs built with this version use rule set `song-chords-v2` (audit-record 1.5.0); existing records keep v1.
