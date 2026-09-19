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
