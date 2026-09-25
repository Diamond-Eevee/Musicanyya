# MusicXML Fixtures

| Fixture | Behaviour | Origin | Licence |
|---|---|---|---|
| minimal-single-note | A single whole note C4 in 4/4 | Hand-written | CC0 |
| scale-c-major-q100 | Four quarter notes C4-F4 with tempo=100 | Hand-written | CC0 |
| divisions-change-mid-part | Changing divisions in measure 2 | Hand-written | CC0 |
| backup-forward-two-voices | Two voices using backup and forward | Hand-written | CC0 |
| chord-basic | Basic 3-note chord | Hand-written | CC0 |
| grand-staff-two-voices-per-staff | 2 staves, 4 voices | Hand-written | CC0 |
| tuplet-triplet-eighths | 3:2 eighth-note triplet | Hand-written | CC0 |
| tuplet-triplet-exact | 3:2 eighth-note triplet with exact `<duration>` (divisions 3), then a dotted half; `tuplet-triplet-eighths` gives each note 1/2 quarter | Hand-written (feature 007) | CC0 |
| fractional-duration | Durations that don't land on beats easily | Hand-written | CC0 |
| grace-acciaccatura | Grace note with slash | Hand-written | CC0 |
| grace-group-at-start | Multiple grace notes at start | Hand-written | CC0 |
| grace-after-note-end-of-measure | Grace notes after main note | Hand-written | CC0 |
| cue-notes-not-played | Cue size notes, shouldn't sound | Hand-written | CC0 |
| whole-measure-rest | Rest with measure="yes" | Hand-written | CC0 |
| multi-measure-rest | measure-style multiple-rest 3 | Hand-written | CC0 |
| measure-repeat | measure-style repeat | Hand-written | CC0 |
| pickup-implicit | implicit="yes" measure 0 | Hand-written | CC0 |
| measure-overfull | Notes exceed time signature | Hand-written | CC0 |
| measure-underfull | Notes fall short of time signature | Hand-written | CC0 |
| measure-numbers-duplicate-nonnumeric | Non-numeric or duplicate measure numbers | Hand-written | CC0 |
| duplicate-notes-disambiguator | Exact same note twice | Hand-written | CC0 |
| verovio-id-roundtrip | Custom xml:id preservation | Hand-written | CC0 |
| fingering-substitution-alternate | Alternate and substitution fingering | Hand-written | CC0 |
| unsupported-elements-notice | Elements that trigger notices | Hand-written | CC0 |
| non-ascii-Łódź-日本 | Non-ASCII characters in text | Hand-written | CC0 |
| malformed-not-xml | Plain text | Hand-written | CC0 |
| malformed-truncated | Incomplete XML tree | Hand-written | CC0 |
| malformed-timewise | score-timewise root | Hand-written | CC0 |
| malformed-external-entity | XXE attempt | Hand-written | CC0 |
| encoding-utf16 | UTF-16LE encoding | Hand-written | CC0 |
| tempo-none-default | No tempo anywhere; the default 100 qpm applies | Hand-written | CC0 |
| tempo-sound-vs-metronome | Both sound tempo and metronome present; sound wins | Hand-written | CC0 |
| tempo-dotted-beat-unit | Metronome with a dotted beat-unit | Hand-written | CC0 |
| tempo-change-mid-measure-offset | Tempo direction mid-measure shifted by offset sound="yes" | Hand-written | CC0 |
| meter-change | Time signature changes mid-piece | Hand-written | CC0 |
| repeat-simple | One forward+backward repeat pair | Hand-written | CC0 |
| repeat-implicit-start | Backward repeat with no forward repeat; implicit start at measure 1 | Hand-written | CC0 |
| repeat-times-3 | times="3" on the backward repeat | Hand-written | CC0 |
| repeat-unbalanced-backward | Two backward repeats with only one forward repeat | Hand-written | CC0 |
| volta-1-2 | First and second ending (number="1" then "2") | Hand-written | CC0 |
| volta-combined-numbers | One ending covering both endings at once (number="1,2") | Hand-written | CC0 |
| volta-discontinue | Ending with type="discontinue", no closing backward repeat | Hand-written | CC0 |
| dc-al-fine | D.C. al Fine via sound dacapo/fine and matching words | Hand-written | CC0 |
| ds-al-coda | D.S. al Coda via sound dalsegno/segno/tocoda/coda targets | Hand-written | CC0 |
| dc-after-jump-repeats | Repeat retaken after D.C. only when after-jump="yes" | Hand-written | CC0 |
| jump-text-only | Words-only jump markings with no sound element (text inference) | Hand-written | CC0 |
| jump-time-only | Jump usable only on a specific pass via time-only | Hand-written | CC0 |
| jump-loop-malformed | Oversized repeat times and a missing dalsegno target exercise the loop guard | Hand-written | CC0 |
| tie-across-barline | Note tied over a barline | Hand-written | CC0 |
| tie-chain-three | Three notes tied in a chain | Hand-written | CC0 |
| tie-chord-partial | Chord where only some notes are tied, others re-attack | Hand-written | CC0 |
| tie-into-volta | Tie whose stop is inside a second ending | Hand-written | CC0 |
| tie-broken | Unmatched tie start with no matching stop | Hand-written | CC0 |
| tied-without-tie | tied notation present but no tie element (display-only) | Hand-written | CC0 |
| dynamics-marks | Several dynamics marks (mf, f, pp) on different notes | Hand-written | CC0 |
| dynamics-sound-override | sound dynamics="%" overriding the dynamics mark | Hand-written | CC0 |
| wedge-crescendo | wedge crescendo...stop spanning several notes | Hand-written | CC0 |
| instruments-two-parts | Two parts, each with its own score-instrument/midi-instrument | Hand-written | CC0 |
| instrument-missing-fallback | Note references an instrument with no matching midi-instrument; falls back to piano | Hand-written | CC0 |
| percussion-unpitched | Unpitched percussion part using unpitched and midi-unpitched | Hand-written | CC0 |
| transpose-bb-clarinet | Bb clarinet part with transpose chromatic=-2 | Hand-written | CC0 |
| octave-shift-8va | octave-shift up 8; display only, does not change sounding pitch | Hand-written | CC0 |
| cross-staff-beaming | Left-hand voice with two notes printed on the treble staff (`<staff>1</staff>`); feature 002 hand attribution | Hand-written | CC0 |
| unison-across-hands | A unison (one key, both hands) and an octave doubling (two keys); feature 002 | Hand-written | CC0 |
| hands-accompaniment | Left-hand half note under two right-hand notes, plus a left-hand note where the right hand rests; feature 002 | Hand-written | CC0 |
| voice-and-piano | Piano-vocal score: part 1 one staff, part 2 two staves; feature 002 part selection | Hand-written | CC0 |
| window-beat-unit-6-8 | 6/8 at dotted-quarter=60, six eighth notes; the Play window "beat" is the dotted quarter | Hand-written | CC0 |
| neighbour-clamp-sixteenths-160 | Eight consecutive 16ths at quarter=160 (93.75ms apart); exercises the neighbour clamp | Hand-written | CC0 |
| repeated-pitch-two-presses | Two written C4 quarter notes in a row; order-preserving pass-1 matching | Hand-written | CC0 |
| unison-two-voices | Two voices write C4 a 48th of a quarter apart; same-pitch onsets must never cross-match | Hand-written | CC0 |
| anacrusis-count-in | 4/4 pickup measure with 2 of 4 beats; the count-in clicks the pickup's missing beats too | Hand-written | CC0 |
| range-start-mid-measure-rests | Measure 2 opens with two beats of rest before its first note; count-in still ends on the barline | Hand-written | CC0 |
| enharmonic-cs-db | C#4 then Db4, both sounding key 61; matching is on sounding key, never spelling | Hand-written | CC0 |
| transposing-part-sounding-pitch | Bb clarinet (chromatic=-2), three notes; matching claims the sounding key | Hand-written | CC0 |
| first-note-early-into-count-in | Plain melody whose first note's early claim window reaches into the count-in (D-4) | Hand-written | CC0 |
| last-note-late-past-end | Plain melody whose last note's late claim window must be recorded past the final onset | Hand-written | CC0 |
| chord-spread-rolled | Unmarked C-E-G whole-note chord; rolled within the ordinary chord spread, not the arpeggio spread | Hand-written | CC0 |
| played-along-both-hands | Right-hand melody over a left-hand accompaniment; the unselected hand is played-along, never wrong or extra | Hand-written | CC0 |
| metronome-channel-collision | A part hinted to midi-channel 15 (0-based 14 = METRONOME_CHANNEL); assignChannels must reroute it | Hand-written | CC0 |
| eight-measure-melody | 8 measures of 4/4 at quarter=100, one note per beat: C-major scale up/down then broken chords | Hand-written | CC0 |
| trill-realisation | One note each with trill-mark, mordent, turn, tremolo, plus an unsupported inverted-mordent | Hand-written | CC0 |
| arpeggiate-chord | A C-E-G chord marked `<arpeggiate>` (wider arpeggio spread applies), then an unmarked F-A chord for contrast | Hand-written | CC0 |
| large-score-100-measures-fast | 100 measures, two staves, one quarter note each at 400 quarter notes a minute (about 15 s), skipped by the golden snapshot test like `large-score`; generated by `tests/tools/gen-hundred-measures.ts` (feature 004, SC-005) | Generated | CC0 |
| notation/clef-changes | Part 1: treble -> bass clef mid-measure on one staff, then a G8vb clef; part 2: a grand staff whose file names no clef (defaults treble/bass); part 3: an explicit TAB clef (unsupported: a load notice, never a failure). Feature 008 | Hand-written | CC0 |
| notation/key-changes | G major -> F major -> A minor (`<mode>`) -> a non-traditional key (no `<fifths>`); a second part with a key per staff (`number`) then one key for both. Feature 008 | Hand-written | CC0 |
| notation/octave-shift | An 8va stopped mid-measure, a 15mb stopped at the next measure and an 8va with no stop (runs to the end of the part). Feature 008 | Hand-written | CC0 |
| notation/grand-staff-accidentals | A grand staff in C major with accidentals earlier in the bar on each staff (D#5, Bb4 / C#3, Eb3) and a measure whose lower staff is only a rest. Feature 008 | Hand-written | CC0 |
| notation/transposing-part | A Bb clarinet: written pitch and written key signature (D major), sounding a major second lower. Feature 008 | Hand-written | CC0 |

The `notation/` fixtures sit in a subfolder so the golden snapshot test above (top-level `*.musicxml` only) leaves them alone;
they are read by `tests/core/musicxml/build.test.ts`, `tests/core/notation/*.test.ts` and, for the pictures, `tests/e2e/pressed-keys.spec.ts`.

## Downloaded corpora

Every fixture above is hand-written (or generated) to probe one feature. Three subfolders hold
**downloaded** files instead, so the app is checked against music and markup it did not have written
for it. They sit in subfolders so the golden snapshot test above - which reads only `*.musicxml` in
this directory - leaves them alone. Each folder's README carries provenance, licence and what the app
makes of every file, and all three are recorded in `THIRD_PARTY_NOTICES.md`.

| Folder | What | Licence | Tests |
|---|---|---|---|
| [`real/`](real/README.md) | 18 whole pieces from the **OpenScore** Lieder and String Quartets corpora - Lieder with lyrics and pedal marks, quartets up to 993 measures and 13 610 notes. Kept `.mxl`, which also exercises `readMxl` on real files. | CC0 | `tests/core/musicxml/real-scores.test.ts`, `tests/e2e/real-scores.spec.ts` |
| [`community/`](community/README.md) | The 183-file **MusicXML Test Suite** the notation-software community tests against (LilyPond → Michael Scott Asato Cuthbert → W3C Music Notation Community Group). Small conformance probes, one notation feature each, including three deliberately invalid files. | MIT | `tests/core/musicxml/community-suite.test.ts`, `tests/verovio/community-suite.test.ts` |
| [`spec-examples/`](spec-examples/README.md) | Five worked examples from the **MusicXML specification**: guitar tablature, drum-kit percussion, chord symbols, Fauré, Chopin. | W3C Software and Document License | `tests/e2e/real-scores.spec.ts` |

The community corpus is what found the `<backup>` negative-tick bug and the overlapping-measure bug
(see `community/README.md`); neither appeared in any of the whole pieces, because real encoders pad
their voices with rests. Both kinds of fixture earn their place.
