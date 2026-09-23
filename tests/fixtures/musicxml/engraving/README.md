# Engraving-completion fixtures (feature 006)

Nine hand-written MusicXML 4.0 probes for feature 006 "Beamed Notes and Complete Engraving" - each one
isolates a single rule from `specs/006-beamed-note-engraving/research.md` R-2 (beam rules B1-B11) or R-3
(accidental rules A1-A7, C1-C4), so a unit test can assert an exact-match engraving-completion result
against it. Every file carries a header comment (after `<part-list>`, before the first `<measure>`)
stating measure by measure, in exact pitch+octave+measure-number language, what the fixture tests and
what the completion module is expected to produce.

## Provenance and licence

All nine are **original work**, written for this feature, released under **CC0 1.0** (public-domain
dedication - no attribution required, no conditions), same as the rest of this app's own test fixtures.
None is derived from a third-party score except `fur-elise-bare.musicxml`, whose pitches/durations come
from the app's own bundled arrangement (already CC0, see `THIRD_PARTY_NOTICES.md`).

## Files

| Fixture | Tests |
|---|---|
| `metres.musicxml` | R-2 B3/B4: one measure per metre (2/4, 3/4, 4/4, 2/2, 3/8, 6/8, 9/8, 12/8, 5/8, 7/8, additive 3+2/8), each filled exactly with plain eighths/sixteenths, to exercise the groups-per-metre table and the 4/4, 2/2 and 3/4 eighth-note exceptions. |
| `rests-and-hooks.musicxml` | R-2 B6/B9: a rest splitting an otherwise-beamable beat into a flagged note plus a small beam; a dotted-eighth-then-sixteenth and its mirror sixteenth-then-dotted-eighth (opposite beam-hook directions); an eighth followed by two sixteenths (mixed primary/secondary group). |
| `tuplets-grace.musicxml` | R-2 B7/B8: an eighth-note triplet as its own beam group, isolated from a plain eighth pair sharing the same 4/4 half-bar span; a two-grace-note group beamed to itself; a single lone grace note that keeps its flag. |
| `voices-cross-staff.musicxml` | R-2 B5/B6: two independently-grouped voices sharing one staff; one voice whose notes cross `<staff>1</staff>`/`<staff>2</staff>` mid-beam (grouping ignores staff); a beam-eligible chord, with the beam on the chord head. |
| `partly-beamed.musicxml` | R-2 B11: a voice with one real, correctly-matched `<beam>` pair anywhere in the piece is skipped by completion entirely - including an otherwise-ordinary unbeamed eighth run elsewhere in that same voice; a second, fully unbeamed voice is completed normally, as a contrast. |
| `broken-beam.musicxml` | An inconsistent encoded beam (`begin`/`continue` with no matching `end` in the measure) - left exactly as encoded and expected to be reported as `beamDataInvalid`. |
| `accidentals.musicxml` | R-3 A1-A7, C1-C2: required sharp/natural insertions, per-octave state (A6), a tie that does not leak its alteration into the same-bar state it lands in (A3), a mid-bar key change (A2), a same-position chord needing two signs (A5), a double-sharp resolving to a plain sharp (A4), a grace note's alteration lasting to the end of its bar (A7), a cross-bar courtesy natural (C1/C2), and the first-ending/second-ending courtesy-memory special case (C1). One note already carries an `<accidental>` in the source and must be left untouched (A4). |
| `prints-accidentals.musicxml` | R-3 C3/A4: a file that already prints most of its own accidentals, so mode `'opened'` must add no courtesy signs anywhere in it - only the one genuinely missing required accidental; plus one note whose printed `<accidental>sharp</accidental>` contradicts its own `<alter>` (left as is, reported as `accidentalContradicts`). |
| `fur-elise-bare.musicxml` | *Für Elise* (theme)'s pitches and durations with all `<accidental>` elements stripped; no `<beam>` element exists in the source library file either, so this is used as-is - a whole-piece probe alongside the rule-isolating fixtures above. |

## A note on verification

Every file here loads cleanly through `readXml`/`buildScore` (verified 2026-09-23): no `unsupportedElement`,
`timingRounded` or `measureLengthMismatch` notices, only the expected `defaultTempo` info entry each file gets
for carrying no explicit tempo. One issue was found and fixed in this pass: `accidentals.musicxml`'s header
comment used `--` as a bullet/dash inside an XML comment, which is illegal XML (a comment may not contain `--`
anywhere in its body) - reworded, no content change.
