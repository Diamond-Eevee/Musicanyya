# MusicXML Support

This document lists the supported MusicXML elements.

| Category | Element | Status | Notes |
|---|---|---|---|
| Structure | `<part>` | Supported | |
| Structure | `<measure>` | Supported | |
| Notes | `<note>` | Supported | |
| Notes | `<pitch>` | Supported | |
| Notes | `<rest>` | Supported | |
| Notes | `<tie>` | Supported | |
| Notes | `<beam>` | Supported | Shown as encoded; completed automatically when a voice has none (not for sung lines with lyrics) |
| Notes | `<accidental>` | Supported | Shown as encoded; required and courtesy signs completed when missing |
| Notes | `<grace>` | Supported | Acciaccatura and appoggiatura |
| Notes | `<fingering>` | Supported | Engraved by Verovio; also read by Practice mode for its help overlay (feature 002) |
| Time & Repeats | `<repeat>` | Supported | Backward and forward repeats. Note: middle-barline repeats not supported |
| Time & Repeats | `<ending>` | Supported | Voltas (1., 2. endings) |
| Time & Repeats | `<direction>` | Supported | Jumps (D.C., D.S., To Coda, Fine). Note: mid-measure jumps not supported |
| Time & Repeats | `<sound tempo>` | Supported | Note: continuous changes (rit./accel.) not supported |
| Time & Repeats | `<fermata>` | Unsupported | Ignored for playback |
| Dynamics | `<dynamics>` | Supported | Marks and wedges |
| Instruments | `<midi-instrument>` | Supported | MIDI programs and unpitched percussion |
| Notes | `<trill-mark>` | Supported | Play mode: the realisation is played-along, never graded (feature 003) |
| Notes | `<mordent>` | Supported | Play mode: the realisation is played-along, never graded (feature 003) |
| Notes | `<turn>` | Supported | Play mode: the realisation is played-along, never graded (feature 003) |
| Notes | `<tremolo>` | Supported | Play mode: the realisation is played-along, never graded (feature 003) |
| Notes | `<arpeggiate>` | Supported | Play mode: the wider arpeggio spread applies instead of the chord spread (feature 003) |
| Notes | `<glissando>` | Unsupported | Reported; ignored for playback |
| Notes | `<slide>` | Unsupported | Reported; ignored for playback |
| Notes | `<wavy-line>` | Ignored | The trill extension line: engraved by Verovio, ignored by the time model. Common in real scores |
| Notes | `<accidental-mark>` | Ignored | The accidental printed over an ornament: engraved by Verovio, ignored by the time model |
| Harmony | `<harmony>` | Ignored | Chord symbols above the staff: engraved by Verovio, not played and not graded |
| Harmony | `<figured-bass>` | Ignored | Figured-bass numerals: engraved by Verovio, not played and not graded |
| Credits | `<creator type="arranger">` | Supported | Not drawn by the engraver; shown in the UI title block instead |
| Credits | `<movement-title>` | Supported | Not drawn by the engraver; shown in the UI title block instead |
| Credits | `<credit>` | Ignored | Not drawn by the engraver; UI title block used instead |
| Notes | `<slur>` | Ignored | Engraved by Verovio; not used by playback or grading |
| Notes | `<tuplet>` | Supported | The bracket and number are engraved by Verovio; the timing comes from `<time-modification>` |
| Directions | `<octave-shift>` | Supported | 8va/8vb lines engraved by Verovio and used when completing accidentals; `<pitch>` is the sounding pitch, so playback and grading are unaffected |
| Directions | `<pedal>` | Ignored | Engraved by Verovio; the sustain is not played (library items say so in their limitations) |
| Credits | `<rights>` | Ignored | Kept in the file for attribution; not shown |
| Credits | `<source>` | Ignored | Kept in the file for attribution; not shown |
