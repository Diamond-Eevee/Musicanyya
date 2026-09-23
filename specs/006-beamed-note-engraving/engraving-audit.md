# Engraving audit - repertoire library (FR-014, FR-015, SC-007)

Feature 006, task T044. Audit date: **2026-09-23**. Reviewer role: `music-domain-expert`.
This file replaces the earlier draft (which listed bar ranges that do not exist in the files, had no rows for
stems, rests and system bar numbers, and did not compare against the cited sources).

## Owner decision (recorded 2026-09-23)

- **Purely visual gaps** (a marking is missing or misprinted, but the notes, rhythm, ties and repeats that are
  played and graded are right) are **named follow-ups** (`LE-xx` below) for a future "library enrichment"
  feature. They are **not fixed in 006**.
- **Every playback/grading gap** (wrong or missing pitch, rhythm, tie, repeat/volta/jump compared with the cited
  source, `G-xx` below) **is fixed in 006** (FR-015), as new tasks numbered from T052.

## Summary

17 repertoire pieces x 15 FR-014 elements = 255 cells, all filled (SC-007). Every `M` / `P*` cell points to a
`G-xx` fix (006), the `B-01` finding (006) or an `LE-xx` follow-up.

| ID | File (`public/library/repertoire/`) | Bars | Checked against | Playback/grading | Visual |
|---|---|---|---|---|---|
| twinkle | beginner/twinkle-twinkle-little-star | 1-12 | the traditional tune | none | LE-08 |
| mary | beginner/mary-had-a-little-lamb | 1-8 | the traditional tune (in F) | none | LE-08 |
| ode | beginner/ode-to-joy | 1-8 | Beethoven's theme | G-04 (minor) | - |
| jingle | beginner/jingle-bells | 1-8 | Pierpont's refrain | G-05 (minor) | - |
| grace | beginner/amazing-grace | 0-16 | "New Britain" (hymnary.org) | **G-01** | LE-08 |
| green | beginner/greensleeves | 0-16 | the traditional tune | **G-02** | LE-08 |
| fe16 | beginner/fur-elise-theme-16-bar | 0-16 | Mutopia 931 (A theme) | **G-03** | LE-08 |
| feth | intermediate/fur-elise-theme | 0-8 | Mutopia 931, bars 0-8 both hands | none | LE-04 |
| arab | intermediate/burgmuller-op100-no2 | 1-33 | Mutopia 25EF-02 (spot check) | none found | LE-01..04, 08, 09 |
| innoc | intermediate/burgmuller-op100-no5 | 1-16 | Mutopia 25EF-05 bars 1-12 | **G-07** | LE-01..04, 08 |
| clem | intermediate/clementi-sonatina-op36-no1-mvt1 | 1-15 | Mutopia 804 (spot check) | none found | LE-08 |
| schum | intermediate/schumann-op68-no10 | 0-20 | Mutopia 659, LH all bars | none found | B-01, LE-01, 02, 04 |
| bach | advanced/bach-prelude-bwv846 | 1-35 | Mutopia 5 (spot check) | none found | LE-07, LE-11 |
| ch20 | advanced/chopin-prelude-op28-no20 | 1-13 | Mutopia 472 (spot check) | none found | LE-01, 02, 04-06 |
| ch4 | advanced/chopin-prelude-op28-no4 | 0-25 | Mutopia 468 (spot check) | **G-08** | B-01, LE-01, 02, 04-06, 09 |
| fecomp | advanced/fur-elise-complete | 0-59 | Mutopia 931 | **G-06** | LE-04, 05, 08, 10 |
| satie | advanced/satie-gymnopedie-no1 | 1-37 | Mutopia 37 | **G-09** | LE-01, 04, 06, 08, 09 |

Bars are the file's `<measure number>` values (`0` = pickup, `implicit="yes"`).

## Piece x element matrix

Legend: `P` present and matching the source; `P*` present but deviating from the source (see details);
`M` missing, bars in the details; `D` deliberately left out and disclosed in the sidecar (no action);
`n/u` not used (neither the file nor the cited source/usual edition has it); `?` unverified (see details).

Columns: Bm beams, Ac accidentals (incl. courtesy), St stems, Re rests (incl. multi-voice placement), Ti ties,
Sl slurs/phrase marks, Dy dynamics and hairpins, Tx tempo and expression text, Ar articulations (incl. fermatas),
Fi fingering, Pe pedal, Or ornaments (incl. grace notes, arpeggio), Rp repeats/voltas/jumps, Tb title block,
Bn system-start bar numbers.

| ID | Bm | Ac | St | Re | Ti | Sl | Dy | Tx | Ar | Fi | Pe | Or | Rp | Tb | Bn |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| twinkle | n/u | n/u | P | n/u | n/u | n/u | P | P | n/u | n/u | n/u | n/u | n/u | M | P |
| mary | n/u | n/u | P | n/u | n/u | n/u | P | P | n/u | n/u | n/u | n/u | n/u | M | P |
| ode | n/u | n/u | P | n/u | n/u | n/u | P | P | n/u | n/u | n/u | n/u | n/u | P | P |
| jingle | n/u | n/u | P | n/u | n/u | n/u | P | P | n/u | n/u | n/u | n/u | n/u | P | P |
| grace | n/u | n/u | P | P | n/u | n/u | P | P | n/u | n/u | n/u | n/u | n/u | M | P |
| green | n/u | n/u | P | P | n/u | n/u | P | P | n/u | n/u | n/u | n/u | n/u | M | P |
| fe16 | P | P | P | P | n/u | n/u | P | P | n/u | n/u | n/u | n/u | n/u | P* | P |
| feth | P | P | P | P | n/u | n/u | P* | P | n/u | n/u | n/u | n/u | D | P | P |
| arab | P | P | P | P | P | M | P* | P | M | M | n/u | n/u | P | P* | P |
| innoc | P | P | P | P | n/u | M | M | P | M | M | n/u | n/u | M | P* | P |
| clem | P | P | P | P | n/u | n/u | P | P | n/u | n/u | n/u | n/u | D | P* | P |
| schum | M | P | P | P | n/u | M | P* | P | M | n/u | n/u | n/u | n/u | P | P |
| bach | P | P | ? | P | P | n/u | n/u | P | P | n/u | n/u | M | n/u | P | P |
| ch20 | P | P | P | P | n/u | M | P* | P* | M | n/u | P* | n/u | n/u | P | P |
| ch4 | M | P* | P | P | P | M | P* | M | M | n/u | M | P | n/u | P | P |
| fecomp | P | P | P | P | n/u | M | P* | P* | n/u | n/u | M | M | D | P* | P |
| satie | n/u | P | P | P | P | M | P* | P | n/u | n/u | P* | n/u | M | P* | P |

Notes that apply to every row:

- **Stems**: no file encodes `<stem>`; direction is computed by Verovio. `P` means nothing in the file forces a
  wrong direction (see `bach` for the one case to verify).
- **Rests**: multi-voice staves occur in `ch20` (staff 1, voices 1-2, bars 1-12), `schum` (staff 1, voices 1-2,
  bars 9-12, 15-18) and `bach` (staff 2, voices 5-6, bars 1-34); rests there are placed by Verovio per voice.
- **Accidentals**: printed pitch = played pitch is enforced by the 006 publishing guard (FR-012); courtesy
  signs were spot-checked by hand (e.g. `ch20` bars 5 and 7, `arab` bar 19, `innoc` bar 6) and are present.
- **System-start bar numbers**: shown by Verovio's default (numbers at the start of every system after the
  first, from `<measure number>`); pickups are numbered 0, so the first full bar is 1 as in printed editions.
  Not re-rendered for this audit.
- **Title block**: taken from `<movement-title>`, else `<work-title>`, and `<creator type="composer|arranger">` in the
  MusicXML (FR-017, research R-4), not from the sidecar. Library files name only a `<work-title>`.

## Details per piece (every cell that is not `P` or `n/u`)

**twinkle** - pitches and rhythm match the tune. Tb `M`: no composer line (file has only an arranger creator;
sidecar says "Traditional (French, 18th century)") -> LE-08.

**mary** - matches the tune (transposed to F). Tb `M`: no composer line (sidecar: "Traditional (American, 19th
century)") -> LE-08.

**ode** - pitches match. Bars 4 and 8 change the theme's rhythm (undisclosed) -> G-04.

**jingle** - bars 1-4 are the refrain's opening, bars 5-8 its closing line. Bar 3 straightens the dotted rhythm
(undisclosed) -> G-05.

**grace** - melody wrong from bar 2 -> G-01. Tb `M`: no composer line (sidecar: "Traditional (American hymn tune
'New Britain')") -> LE-08.

**green** - the melody is not Greensleeves -> G-02. Tb `M`: no composer line (sidecar: "Traditional (English,
16th century)") -> LE-08.

**fe16** - bar 1 drops the C5 of the motif -> G-03. Bars 2-16 are the arranger's diatonic continuation
(disclosed). Tb `P*`: title reads "Fur Elise" (also in the sidecar) -> LE-08.

**feth** - bars 0-7 match Mutopia 931 note for note in both hands. Dy `P*`: `p` at bar 0, source `pp` -> LE-04.
Rp `D`: the source repeats bars 0-7 with first/second endings; the file ends on a single-pass cadence at bar 8
(disclosed).

**arab** - spot-checked against `25EF-02.ly`: LH bars 1-2, RH bars 3-5, bar 8 (tie D5), both voltas (bars 10/11
and 27/28) match. Sl `M`: every 16th-note figure and its eighth-note tag is slurred in the source (RH bars 3-9,
20-23, 28-32; LH bars 12-17) -> LE-01. Ar `M`: staccato on the LH chords (bars 1-11, 20-33) and on the RH eighth
tags (bars 3-11, 20-32); accent on D5 bar 8 -> LE-02. Fi `M`: the source fingers the figures throughout (bars
3-33) -> LE-03. Dy `P*`: the source's `sf` in bar 10 is encoded as `<dynamics>` directly inside `<note>`, which is
not valid MusicXML there and is probably ignored on import -> LE-09. Tb `P*`: "Burgmuller" -> "Burgmüller" (LE-08).

**innoc** - bars 1-11 do not match `25EF-05.ly` as the sidecar claims -> G-07. Sl `M` bars 1-11 (every
16th-note group and bars 9-11 slurred) -> LE-01. Dy `M`: source hairpins bars 2, 3, 4, 7 and "cresc." bar 5
(file has only `p` bar 1 and its own `pp` bar 16) -> LE-04. Ar `M`: accents bar 7, staccato bars 9-11 -> LE-02.
Fi `M`: fingering throughout bars 1-11 in the source -> LE-03. Rp `M`: see G-07. Tb `P*`: "Burgmüller" (LE-08).

**clem** - spot-checked against `sonatina-1.ly` (both hands bars 1-4 and 9-11, LH bar 15): match. The source has
no slurs, articulations, fingering or dynamics in bars 1-15 (the file's `f` is editorial). Rp `D`: source
`\repeat volta 2` over bars 1-15; file plays once (disclosed: "repeat not taken"). Tb `P*`: title says "arranged
for this app" but there is no arranger line -> LE-08.

**schum** - the LH (melody) of all 21 bars matches Mutopia 659 including the two-voice bars 14 and 20; the source
has no repeat signs, so the file is complete. RH chords not re-checked (unverified). Bm `M`: RH voice 1 eighth
chords without beams, bars 1, 2, 5, 6 (beats 1.5-2 and 3.5-4) and bars 14, 20 (beat 3.5) -> B-01. Sl `M`: LH
phrasing slurs bars 0-20 -> LE-01. Ar `M`: LH accents bars 9, 10, 15, 16; LH staccato bars 10, 16; RH accents
around bars 9-10 (approx.) -> LE-02. Dy `P*`: the source has `f` four times, the file once (bar 0); positions of
the other three unverified -> LE-04.

**bach** - bars 1, 33, 34 and 35 match Mutopia 5 exactly (upper staff under `\transpose c c'`); bars 2, 21-24 and
32 were read note by note and match the standard Urtext; the remaining bars were checked through the file's
per-bar chord comments (35 bars, no Schwencke bar). The source has no dynamics, slurs, fingering or pedal. St `?`:
in staff 2 the bass (voice 5) precedes the tenor (voice 6); check in a screenshot that the bass gets stems down
and the tenor stems up, as in editions -> LE-11. Or `M`: arpeggio (spread-chord) sign on the final chord, bar 35
(`\arpeggio` in the source) -> LE-07. Fermata bar 35 present.

**ch20** - spot-checked bars 3 and 13 against `Chop-28-20.ly`: match (the sidecar reports a mechanical decode of
every pitch). Sl `M`: phrasing slurs bars 1-4, 5-8, 9-12 -> LE-01. Dy `P*`: the crescendo wedges in bars 3 and 11
have no `stop` (source ends them in bars 4 and 12) -> LE-04. Tx `P*`: "riten." printed at bar 7, source bar 8; the
second "riten." (bar 11) is missing -> LE-05. Ar `M`: accent on the final chord bar 13 (fermata present) -> LE-02.
Pe `P*`: one pedal line bars 1-13; the source changes pedal (12 marks, bars 1-13); disclosed -> LE-06.

**ch4** - pickup (`b8. b'16`), the turn on G##5 (bar 16), both acciaccaturas (bars 11, 19) and RH bars 21-23
match `Chop-28-4.ly`; the LH bass of bars 24-25 is missing -> G-08. Bm `M`: pickup bar 0 (B3 dotted eighth +
B4 sixteenth) not beamed -> B-01. Ac `P*`: redundant sharp on the tied continuation G#4, bar 9 (FR-007; kept
per FR-009) -> LE-09. Sl `M`: phrasing slurs throughout bars 0-25 -> LE-01. Dy `P*`: bar 0 has `pp`, source
`p`; source hairpins around bars 9, 12, 16-17, 19, 21 and a closing `pp` around bar 24 are missing (source bar
numbers approx.) -> LE-04. Tx `M`: "espressivo" bar 0, "stretto" around bar 16 -> LE-05. Ar `M`: accent around
bar 12; fermatas on the rest of bar 23 and on bar 25 -> LE-02. Pe `M`: source pedals nearly every bar 1-23
(disclosed) -> LE-06.

**fecomp** - bars 0-8, 21-28 and 48-55 (A theme) match Mutopia 931; the episodes do not -> G-06. Sl/Pe/Or `M`:
the source's F-major and D-minor episodes carry slurs, pedal and grace notes (e.g. `\grace { f'16 a' }` at the
start of the F-major episode); they come back with the re-transcription in G-06, not as separate follow-ups.
Dy `P*`: `p` at bar 0, source `pp` -> LE-04. Tx `P*`: "Tempo I" at bar 48 with no earlier tempo change ->
LE-05. Rp `D`: each section written out once (disclosed); the source uses repeats with voltas. Tb `P*`: the
file's title says "(complete)", the sidecar says "arranged ... abridged" -> LE-08. The source uses `\ottava`
(exact bars not quoted); the file has no `<octave-shift>` -> LE-10.

**satie** - bars 17-21 and 32-35 match Mutopia quotes; bars 1-16 and 22-31 match the well-known melody and
ostinato (not quoted bar by bar); the close is truncated -> G-09. Sl `M`: source slurs bars 5-7, 13-15, 25-26 and
the later phrases -> LE-01. Dy `P*`: `f` bar 9 and `mp` bar 29 are not in the source; the source's `p` is at bar
22 (file 21); the source hairpins (bars 5-9, 13, 17-19, 25-29, 30-32, 33-38) are missing -> LE-04. Pe `P*`: all
pedal marks (bars 1-37) are editorial, the source has none, and the sidecar does not say so -> LE-06. Rp `M`: see
G-09 (the whole-piece repeat with two endings is left out, loosely disclosed as "further reprises"). Tb `P*`:
"Gymnopedie" -> "Gymnopédie"; the title says "(arranged for this app)" but the sidecar says
`"arrangement": false` -> LE-08.

## Playback/grading gaps (fix in 006, new tasks from T052)

Each of these makes the app play and grade notes that differ from the piece it names. Page and playback agree
with each other (both come from the same MusicXML), so the fix is always in the library file, plus its sidecar
where the provenance text is wrong.

| # | Piece | Bars | Problem | Evidence / fix |
|---|---|---|---|---|
| G-01 | grace | 1-16 | Melody is not "New Britain" after bar 1: bar 2 has G4 (tune: B4-A4), bar 3 E4-D4 (G4-E4), bars 6-8 G4 / E4-D4 / G4 (B4-A4 / D5 / D5...); the second half is a different line | hymnary.org incipit `51313 21655 13132` = D4 \| G4 B4-G4 \| B4 A4 \| G4 E4 \| D4 D4 \| G4 B4-G4 \| B4 A4 \| D5. Re-set all 16 bars from a PD hymnal (quarter/half values allowed); fix the sidecar claim "follow the verified tune closely" |
| G-02 | green | 0-16 | Melody is not Greensleeves (pickup E5, then A-C-E \| D-C-B \| B-A-G ...) | Traditional tune in A minor: pickup A4 \| C5 D5 \| E5 F5 E5 \| D5 B4 \| G4 A4 B4 \| C5 A4 \| A4 G#4 A4 \| B4 G#4 \| E4 ... (G natural allowed by the sidecar's natural-minor choice). Re-transcribe from a PD source and record it in the sidecar |
| G-03 | fe16 | 1 | The motif E-D#-E-B-D-C-A loses its C5: bar 1 is E5 D#5 E5(quarter) B4 D5, then A4 in bar 2 | Mutopia 931 bar 1: `e'' dis'' e'' b' d'' c''`. Restore C5 within the Beginner run cap of 4 (e.g. pickup E5 as a quarter, bar 1 D#5 E5 B4 D5 as eighths + C5 quarter), or disclose the dropped note; the sidecar mentions only the rhythm change |
| G-04 | ode | 4, 8 | Theme cadences E4. D4(8) D4(2) and D4. C4(8) C4(2) are written E4(3 beats) D4(1) and D4(3) C4(1): one note and the rhythm differ | Minor. Restore the dotted rhythm or disclose the simplification in the sidecar (owner's choice) |
| G-05 | jingle | 3 | "jingle all the way" E4 G4 C4. D4(8) is written as four quarters | Minor. Restore or disclose (the sidecar discloses only the bar-6 simplification) |
| G-06 | fecomp | 9-20, 29-47 | Bridges, F-major episode and C section are not Beethoven's: source F-major episode starts with grace notes F-A, C5, F5. E5(32nd), E5-D5, Bb5. A5 (file: F4. G4 A4 \| Bb4. A4 G4 ...); source D-minor section is RH chords over a LH pedal of repeated A2 sixteenths (file: A1 + chord eighths); run bars 41-43 is 16th-note triplets in the source (file: plain 16ths, bar 42 not an arpeggio) | Mutopia 931 `fur_Elise_WoO59.ly` exists (the sidecar says no LilyPond source is published). Re-transcribe the episodes from it, or cut the item back to what is verified and retitle it; fix the "(complete)" title and the sidecar |
| G-07 | innoc | 1-16 | LH differs from the source in bars 2-10 (source: F-G-D quarters bar 2, E-Bb-C bar 3, F-A-C / F-A-C# quarters bar 4, broken eighths Bb-C / A-C bars 9-10; file: plain triads); RH bar 11 is a descending 16th scale, source repeats bar 9's figure an octave higher (8va); RH bar 7 Ab-G-A-G sits an octave above the source line; the repeat of bars 1-8 with first/second endings is missing (the file plays the first-ending bar 8 and runs on); the whole piece may be an octave low (source `\relative c'''` for RH, `\relative c` for LH) | `25EF-05.ly`. Re-transcribe bars 1-11 and the repeat (voltas), check octaves against the Mutopia PDF, keep or redo the own close (bars 12-16); fix the sidecar claim "measures 1-11 checked note-by-note" |
| G-08 | ch4 | 24-25 | The LH bass voice is missing: B1+B2 (beats 1-2) and B1+F#2+B2 (beats 3-4) in bar 24, E1+E2 (whole, fermata) in bar 25; only the RH cross-staff chords are encoded | `Chop-28-4.ly`: `\relative b,, { <b! b'!>2 <b b' fs> \| <e, e'>1 }`. Add the voice; also correct the sidecar ("1-eighth-note pickup" - the source pickup is a quarter, `b8. b'16`, as the file already has) |
| G-09 | satie | 35-37 | The close skips two source bars: after C#5-D5-E5 (bar 35) the source repeats C#5-D5-E5 and holds F#4 (dotted half) before the two closing chords; the file goes straight to the chords | Mutopia 37, first ending: `g2. \| fis2. \| b,4 a b \| cis d e \| cis d e \| fis,2. \| <c' a e c>2. \| <d a fis d>2.`. Add the two bars and fix the sidecar ("33-37 our own close" - it is the source's first ending) |

Not gaps (disclosed arrangement choices, no action): `clem` repeat not taken; `feth` single-pass ending; `fecomp`
sections written once; `arab` bar 31 landing raised an octave; `innoc` bars 12-16 own close; `fe16` bars 2-16 own
diatonic continuation; beginner rhythm simplifications named in the sidecars.

## 006 conformance finding (not library enrichment)

**B-01 - beams missing in partly beamed voices (FR-001).** The engraving tool beams only voices that encode no
`<beam>` at all (`planBeamsForVoice` returns `skipped` when any event has a beam), and the publishing guard
(FR-012) checks "no beams" per piece. So two library voices keep unbeamed eighths:

- `schum` staff 1 voice 1: eighth chords at beats 1.5-2 and 3.5-4 in bars 1, 2, 5, 6; beat 3.5 in bars 14 and 20
  (half-bar grouping rule from the Assumptions).
- `ch4` staff 1 voice 1: pickup bar 0 (dotted eighth + sixteenth).

This is visual, but it is 006's own requirement, not a library-enrichment item.

**Resolution (2026-09-23, lead agent):**

- `ch4`: fixed in 006. Two rule bugs kept the pickup unbeamed: library mode skipped any partly beamed voice (now
  it completes the groups that carry no `<beam>`, T062, R-2 B11) and the 2/2 split cut a quarter-note pickup at its
  midpoint (T063, R-2 B4). `pnpm library:engrave` added the beam; the guard now checks per group.
- `schum`: no change. Each flagged pair is an off-beat eighth at beat 1.5 (or 3.5) and one on beat 2 (or 4) - two
  different quarter groups under the owner's 4/4 rule (R-2 B4: half-bar groups only for four plain eighths), so the
  flags are what the rule prints. Beaming off-beat pairs across a beat would need the owner to change B4.

## Named follow-ups (library enrichment, not in 006)

| # | Follow-up | Pieces and bars |
|---|---|---|
| LE-01 | Slurs and phrase marks from the sources | arab RH 3-9, 20-23, 28-32, LH 12-17; innoc 1-11; schum LH 0-20; ch4 0-25; ch20 1-4, 5-8, 9-12; satie 5-7, 13-15, 25-26 and later phrases |
| LE-02 | Articulations and fermatas | arab staccato LH 1-11, 20-33 and RH tags 3-11, 20-32, accent 8; innoc accents 7, staccato 9-11; schum LH accents 9, 10, 15, 16, staccato 10, 16, RH accents ~9-10; ch20 accent 13; ch4 accent ~12, fermatas 23 (rest) and 25 |
| LE-03 | Fingering | From the sources: arab 3-33, innoc 1-11. Optional pedagogical fingering for the beginner pieces (no source has any) - owner decides |
| LE-04 | Dynamics and hairpins | feth and fecomp bar 0 `p` -> `pp`; ch4 bar 0 `pp` -> `p`, hairpins ~9, 12, 16-17, 19, 21, closing `pp` ~24; ch20 add wedge stops bars 4 and 12; satie remove `f` (9) and `mp` (29), move `p` to 22, add hairpins 5-9, 13, 17-19, 25-29, 30-32, 33-38; innoc hairpins 2, 3, 4, 7, "cresc." 5; schum the other three `f` marks (positions to verify) |
| LE-05 | Tempo and expression text | ch4 "espressivo" 0, "stretto" ~16; ch20 "riten." at 8 (not 7) and at 11; fecomp remove or justify "Tempo I" at 48 |
| LE-06 | Pedal | ch4 add the source pedalling (bars 1-23); ch20 per-chord changes instead of one pedal over bars 1-13; satie remove the pedal or mark it editorial in the sidecar. Note: the engine does not play written pedal (sidecar limitations); if it ever does, ch20's single 13-bar pedal would blur the piece |
| LE-07 | Ornaments | bach arpeggio sign on the final chord, bar 35 |
| LE-08 | Title block text | composer lines for twinkle, mary, grace, green ("Traditional ..."); "Für" in fe16 (file and sidecar); "Burgmüller" in arab and innoc; "Gymnopédie" in satie; satie "(arranged for this app)" vs `"arrangement": false`; clem arranger line (title says arranged); fecomp "(complete)" (also part of G-06) |
| LE-09 | Encoding hygiene | arab bar 10 `sf` inside `<note>` -> `<direction>`; satie bar 36 `<accidental>` after `<staff>` (schema order); ch4 bar 9 accidental on the tied continuation |
| LE-10 | Ottava | fecomp: follow the source's `\ottava` once G-06 is done; innoc bar 11 8va (after G-07) |
| LE-11 | Verify stem directions in a two-voice LH | bach staff 2, bars 1-34 (bass should be stems down, tenor stems up); screenshot with `pnpm screenshot` |

## Method

- Date: 2026-09-23. Scope: the 17 `public/library/repertoire/**/*.musicxml` files (the same 17 repertoire items
  as `public/library/index.json`), each with its sidecar `.json` for source, licence and disclosed changes.
- Every file was read in full. Element counts come from searching the MusicXML for `<beam>`, `<accidental>`,
  `<stem>` (none in any file), `<rest>`, `<tie>`/`<tied>`, `<slur>` (none), `<dynamics>`, `<wedge>`, `<words>`,
  `<metronome>`, `<articulations>` (none), `<fingering>` (none), `<pedal>`, `<ornaments>`, `<grace>`,
  `<fermata>`, `<repeat>`, `<ending>`, `<octave-shift>` (none), `<work-title>`, `<creator>`; bar numbers are
  the `<measure number>` values. `tools/library/audit.ts` was read but not run; nothing was rendered, so stems,
  rest placement and system bar numbers are judged from the encoding and Verovio's documented defaults.
- Sources: the Mutopia LilyPond files cited by the sidecars (Chopin Op. 28/4 id 468, Op. 28/20 id 472; Für Elise
  id 931; Clementi Op. 36/1 id 804; Burgmüller Op. 100/2 `25EF-02`, Op. 100/5 `25EF-05`; Schumann Op. 68/10 id
  659; Satie Gymnopédie 1 id 37; Bach BWV 846 id 5) were fetched and quoted bar by bar where a question arose,
  with LilyPond relative-pitch rules applied by hand; hymnary.org for "New Britain"; the well-known traditional
  tunes (Twinkle, Mary, Greensleeves, Jingle Bells, Ode to Joy) from standard knowledge. The fetch tool
  returns short quotes, so source bar numbers marked "approx." or "~" were not counted exactly, and parts not
  quoted are listed as unverified (schum RH, satie close LH, fecomp run bars 44-45).
- "Missing" for arrangements is measured against the usual edition of the original; folk tunes have no such
  edition, so their markings are `n/u` unless the file itself is wrong.
