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
| Notes | `<unpitched>` | Supported | Played on its instrument (MIDI percussion key); drawn at its display-step/-octave under the clef in force. Verovio 6.3 reads that position as if in a treble clef, so under F and C clefs the render copy moves it to the matching treble position (017 T045, T047) |
| Notes | `<beam>` | Supported | Shown as encoded; completed automatically when a voice has none (not for sung lines with lyrics) |
| Notes | `<accidental>` | Supported | Shown as encoded; required and courtesy signs completed when missing |
| Notes | `<grace>` | Supported | Acciaccatura and appoggiatura |
| Notes | `<fingering>` | Supported | Engraved by Verovio; also read by Practice mode for its help overlay (feature 002) |
| Time & Repeats | `<repeat>` | Supported | Backward and forward repeats. Note: middle-barline repeats not supported |
| Time & Repeats | `<ending>` | Supported | Voltas (1., 2. endings) |
| Time & Repeats | `<measure-repeat>` | Partial | The measure's encoded notes are played and engraved in place of the repeat sign, so every played note has its own mark on the Score (017). A measure repeat with no encoded notes keeps its sign and plays as rests |
| Time & Repeats | `<direction>` | Supported | Jumps (D.C., D.S., To Coda, Fine). Note: mid-measure jumps not supported; a <sound> standing directly in a <measure> is read like one in a <direction> - tempo, dynamics and jumps (017 T044, T048) |
| Time & Repeats | `<sound tempo>` | Supported | In a <direction> or directly in the <measure> (017); wins over a <metronome> at the same position, and of two at one position the later wins (012, 017). Note: continuous changes (rit./accel.) not supported; outside 10-1000 quarter notes per minute is treated as unusable, like a missing tempo |
| Time & Repeats | `<metronome>` | Supported | Every note value from 1024th to maxima, 0-3 dots, "c."/"ca."/"circa" and a range read as their first number, parenthesised marks (012). A metric modulation (two <beat-unit>s), <metronome-note> and <beat-unit-tied> give no tempo and no beat from the mark |
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
| Notes | `<note print-object="no">` | Supported | An invisible note (017): it sounds, but is not shown, marked or graded |
| Harmony | `<harmony>` | Ignored | Chord symbols above the staff: engraved by Verovio, not played and not graded |
| Harmony | `<figured-bass>` | Ignored | Figured-bass numerals: engraved by Verovio, not played and not graded |
| Credits | `<creator type="arranger">` | Supported | Not drawn by the engraver; shown in the UI title block instead |
| Credits | `<movement-title>` | Supported | Not drawn by the engraver; shown in the UI title block instead |
| Credits | `<credit>` | Ignored | Not drawn by the engraver; UI title block used instead |
| Notes | `<slur>` | Ignored | Engraved by Verovio; not used by playback or grading |
| Notes | `<tuplet>` | Supported | The bracket and number are engraved by Verovio; the timing comes from `<time-modification>` |
| Directions | `<octave-shift>` | Supported | 8va/8vb lines engraved by Verovio and used when completing accidentals; also read into the Score (staff, span, octaves) so Practice prints a pressed key where that note would be (feature 008); `<pitch>` is the sounding pitch, so playback and grading are unaffected |
| Attributes | `<clef>` | Supported | Engraved by Verovio; also read into the Score (sign, line, octave change, per staff and position) so Practice shows a pressed key on the staff at the right place (feature 008). Percussion, TAB and other non-pitched clefs are reported and no key is drawn on that staff |
| Attributes | `<key>` | Supported | Engraved by Verovio and used when completing accidentals; also read (fifths, mode, per staff or all staves) so Practice spells a pressed key against the key signature (feature 008). A non-traditional key (no fifths element) shows a sign on every pressed key |
| Directions | `<pedal>` | Ignored | Engraved by Verovio; the sustain is not played (library items say so in their limitations) |
| Credits | `<rights>` | Ignored | Kept in the file for attribution; not shown |
| Credits | `<source>` | Ignored | Kept in the file for attribution; not shown |
