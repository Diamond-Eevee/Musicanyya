# Third Party Notices

This application includes open source software. We are grateful to the authors for their work.

- **Verovio** (v6.3.0)
  Licence: GNU Lesser General Public License v3.0 (LGPL-3.0)
  https://github.com/rism-digital/verovio

- **Leipzig font** (via Verovio)
  Licence: SIL Open Font License (OFL)

- **spessasynth_core** (v4.3.22)
  Licence: Apache License 2.0
  https://github.com/spessasynth/spessasynth_core

- **parse-xml** (v5.0.0)
  Licence: ISC License
  https://github.com/rgrove/parse-xml

- **GeneralUser GS** (v2.0.3)
  Licence: GeneralUser GS v2.0 License (allows free redistribution and modification in software).
  Note: Some samples originated from older free banks on the internet. The author states they have never received a complaint since 2000, but cannot be 100% sure of their origin. See `public/soundfonts/GeneralUser-GS-LICENSE.txt` for details.
  https://github.com/mrbumpy409/GeneralUser-GS

- **Electron** (v44)
  Licence: MIT License
  https://github.com/electron/electron

## Bundled practice library (`public/library/`)

Every score and exercise under `public/library/` is either the project's own work, dedicated to the
public domain under **Creative Commons CC0 1.0 Universal**, or a public-domain edition listed below.
Where an `authored` piece is based on a public-domain composition (composer died before 1946, or the
edition is otherwise clearly public domain), the MusicXML is Musicanyya's own transcription or
arrangement, not a copy of any particular edition; `provenance.basedOn` in each item's sidecar
(`<item>.json`) names the work it is based on. Items taken from a third party have
`provenance.origin` `downloaded` and a dated entry here with their source, the date they were obtained
and their licence (FR-020); `tests/library/licence.test.ts` checks both (FR-017).

- **Für Elise, WoO 59** - `repertoire/advanced/fur-elise-complete.musicxml` (obtained 2026-09-23)
  Licence: public domain. Typeset in LilyPond by Stelios Samelis for the Mutopia Project
  (Mutopia-2015/08/18-931) from the Breitkopf & Härtel edition of 1888, and placed in the public domain
  by the typesetter ("free to distribute, modify, and perform"). Converted by Musicanyya from the
  LilyPond source `fur_Elise_WoO59.ly` to MusicXML; the notes were checked against Mutopia's own MIDI
  file of the same source. Both source files are kept unchanged in
  `content/library/sources/mutopia-931-beethoven-woo59/`, where `pnpm library:fidelity` re-checks the item against
  them.
  https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=931

- **Chopin, Prelude in E minor, Op. 28 No. 4** - `repertoire/advanced/chopin-prelude-op28-no4.musicxml` (obtained 2026-09-24)
  Licence: public domain. Typeset in LilyPond by Magnus Lewis-Smith for the Mutopia Project
  (Mutopia-2016/10/28-468) from the Peters edition of 1879, and placed in the public domain
  by the typesetter. Converted by Musicanyya from the
  LilyPond source `Chop-28-4.ly` to MusicXML, with the right hand's closing chords in bars 24-25 printed on the
  upper staff instead of across on the lower one; the notes were checked against Mutopia's own MIDI
  file of the same source. Both source files are kept unchanged in
  `content/library/sources/mutopia-468-chopin-op28-no4/`, where `pnpm library:fidelity` re-checks the item against
  them.
  https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=468

- **Chopin, Prelude in C minor, Op. 28 No. 20** - `repertoire/advanced/chopin-prelude-op28-no20.musicxml` (obtained 2026-09-24)
  Licence: public domain. Typeset in LilyPond by Magnus Lewis-Smith for the Mutopia Project
  (Mutopia-2011/06/19-472) from Edition Peters, and placed in the public domain by the typesetter. Converted by
  Musicanyya from the LilyPond source `Chop-28-20.ly` to MusicXML; the notes were checked against Mutopia's own MIDI
  file of the same source. Both source files are kept unchanged in
  `content/library/sources/mutopia-472-chopin-op28-no20/`, where `pnpm library:fidelity` re-checks the item against
  them.
  https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=472

- **Burgmüller, Op. 100 No. 2, L'Arabesque** - `repertoire/advanced/burgmuller-op100-no2.musicxml` (obtained 2026-09-24)
  Licence: public domain. Typeset in LilyPond by Bas Wassink for the Mutopia Project (Mutopia-2013/01/12-203)
  from the Collection Litolff, and placed in the public domain by the typesetter. Converted by Musicanyya from the
  LilyPond source `25EF-02.ly` to MusicXML; the notes were checked against Mutopia's own MIDI file of the same
  source. Both source files are kept unchanged in `content/library/sources/mutopia-203-burgmuller-op100-no2/`,
  where `pnpm library:fidelity` re-checks the item against them.
  https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=203

- **Satie, Gymnopédie No. 1** - `repertoire/advanced/satie-gymnopedie-no1.musicxml` (obtained 2026-09-24)
  Licence: public domain. Typeset in LilyPond by Evin Robertson for the Mutopia Project (Mutopia-2014/12/14-37)
  from the Dover edition (a reprint of the original), and placed in the public domain by the typesetter. Converted
  by Musicanyya from the LilyPond source `gymnopedie_1.ly` to MusicXML, with the accompaniment chords moved to
  the lower staff (all but the last accompaniment bar of each ending); the notes were checked against Mutopia's
  own MIDI file of the same source. Both source files are kept unchanged in `content/library/sources/mutopia-37-satie-gymnopedie1/`, where
  `pnpm library:fidelity` re-checks the item against them.
  https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=37

- **Clementi, Sonatina in C major, Op. 36 No. 1, first movement** -
  `repertoire/advanced/clementi-sonatina-op36-no1-mvt1.musicxml` (obtained 2026-09-24)
  Licence: public domain. Typeset in LilyPond by Brian D. Rude for the Mutopia Project (Mutopia-2016/11/30-804)
  from the Sonatina Album (G. Schirmer, 1893), and placed in the public domain by the typesetter. Converted by
  Musicanyya from the LilyPond source `sonatina-1.ly` (first movement) to MusicXML; the notes were checked against
  Mutopia's own MIDI file of the same source (published zipped as `sonatina-1-mids.zip`; only the first movement's
  file, `sonatina-1.mid`, is kept, extracted unchanged). Both source files are kept unchanged in
  `content/library/sources/mutopia-804-clementi-op36-no1/`, where `pnpm library:fidelity` re-checks the item
  against them.
  https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=804

- **Petzold, Minuet in G major, BWV Anh. 114** -
  `repertoire/intermediate/petzold-minuet-g-major-anh114.musicxml` (obtained 2026-09-30)
  Licence: public domain. Typeset in LilyPond by Allen Garvin for the Mutopia Project (Mutopia-2017/01/19-75) from
  the Bach-Gesellschaft edition, and placed in the public domain by the typesetter. Converted by Musicanyya from the
  LilyPond source `anna-magdalena-04.ly` to MusicXML; the notes were checked against Mutopia's own MIDI file of the
  same source. Both source files are kept unchanged in `content/library/sources/mutopia-75-bach-anh114/`, where
  `pnpm library:fidelity` re-checks the item against them.
  https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=75

- **Petzold, Minuet in G minor, BWV Anh. 115** -
  `repertoire/intermediate/petzold-minuet-g-minor-anh115.musicxml` (obtained 2026-09-30)
  Licence: public domain. Typeset in LilyPond by Allen Garvin for the Mutopia Project (Mutopia-2015/08/21-76) from
  the Bach-Gesellschaft edition, and placed in the public domain by the typesetter. Converted by Musicanyya from the
  LilyPond source `anna-magdalena-05.ly` to MusicXML; the notes were checked against Mutopia's own MIDI file of the
  same source. Both source files are kept unchanged in `content/library/sources/mutopia-76-bach-anh115/`, where
  `pnpm library:fidelity` re-checks the item against them.
  https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=76

- **Musette in D major, BWV Anh. 126** (composer unknown) -
  `repertoire/intermediate/musette-d-major-anh126.musicxml` (obtained 2026-09-30)
  Licence: public domain. Typeset in LilyPond by Allen Garvin for the Mutopia Project (Mutopia-2013/01/06-79) from
  the Bach-Gesellschaft edition, and placed in the public domain by the typesetter. Converted by Musicanyya from the
  LilyPond source `anna-magdalena-22.ly` to MusicXML; the notes were checked against Mutopia's own MIDI file of the
  same source. Both source files are kept unchanged in `content/library/sources/mutopia-79-bach-anh126/`, where
  `pnpm library:fidelity` re-checks the item against them.
  https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=79

The library's `.musicxml` files were completed by the project's engraving tool (`pnpm library:engrave`), which adds
missing `<beam>` and `<accidental>` elements for display. Nothing else in the files is changed, and each file keeps
the licence recorded for it in `public/library/index.json`.

## Reference sources (not shipped; `content/library/sources/`)

Public-domain editions kept unchanged so that `pnpm library:fidelity` can re-check library items against them
(feature 007). Each folder's `source.json` records the edition, the file hashes and the owner's approval. A source
an item is converted from is listed above, with that item, and not repeated here. All were typeset for the Mutopia
Project and placed in the public domain by their typesetters; each piece page states "Copyright: Public Domain" (checked 2026-09-24).
LilyPond source and the MIDI file LilyPond made from it, obtained 2026-09-24:

- **Bach, Prelude No. 1 in C major, BWV 846** - Mutopia-2011/09/12-5, typeset by Tobias Erbsland; edition
  "Unknown" (as Mutopia states it). `mutopia-5-bach-bwv846/`.
  https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=5
- **Burgmüller, Op. 100 No. 5, Innocence** - Mutopia-2013/01/12-214, typeset by Bas Wassink from the Collection
  Litolff. `mutopia-214-burgmuller-op100-no5/`.
  https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=214
- **New Britain ("Amazing Grace" hymn tune)** - Mutopia-2008/02/19-1283, typeset by Steve Dunlop from
  www.cyberhymnal.org (tune: Virginia Harmony, 1831; harmonization: E. O. Excell, 1900).
  `mutopia-1283-new-britain/`. https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1283
- **Greensleeves (hymn tune)** - Mutopia-2014/03/30-1247, typeset by Steve Dunlop from www.cyberhymnal.org.
  `mutopia-1247-greensleeves-hymntune/`. https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1247
- **Beethoven, "Ode to Joy" (hymn setting)** - Mutopia-2009/08/05-528, typeset by Peter Chubb from "Various"
  sources (as Mutopia states it). `mutopia-528-ode-to-joy/`.
  https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=528

The melodies of the songs in *Learning > Keys* (feature 011) are taken unchanged from these public-domain Mutopia
sources (LilyPond source and the MIDI file LilyPond made from it, obtained 2026-09-26; each piece page states
"Copyright: Public Domain"); the left-hand chords are Musicanyya's own and CC0. `pnpm library:songs` re-reads the
source, cross-checks it against its MIDI and `pnpm library:fidelity` re-checks every song against it:

- **Au clair de la lune** (F. Horetzky, Nº. 21) - Mutopia-2007/11/10-1111, classical guitar, Boije collection #268.
  `mutopia-1111-au-clair-de-la-lune/`. https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1111
- **Good King Wenceslas** - Mutopia-2007/01/10-905, Hutchins, Carols Old and Carols New (1916), carol #415.
  `mutopia-905-good-king-wenceslas/`. https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=905
- **The Holly and the Ivy** - Mutopia-2005/12/23-644 (traditional).
  `mutopia-644-holly-and-the-ivy/`. https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=644
- **Antioch ("Joy to the World", G. F. Handel)** - Mutopia-2008/01/13-1223, typeset by Steve Dunlop from
  www.cyberhymnal.org. `mutopia-1223-antioch/`. https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1223
- **Adeste Fideles ("O Come, All Ye Faithful", J. F. Wade)** - Mutopia-2008/01/13-1220, typeset by Steve Dunlop
  from www.cyberhymnal.org. `mutopia-1220-adeste-fideles/`. https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1220
- **Stille Nacht ("Silent Night", F. X. Gruber)** - Mutopia-2008/02/19-1295, typeset by Steve Dunlop from
  www.cyberhymnal.org. `mutopia-1295-stille-nacht/`. https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1295
- **Veni Emmanuel ("O Come, O Come, Emmanuel")** - Mutopia-2008/02/19-1300, typeset by Steve Dunlop from
  www.cyberhymnal.org. `mutopia-1300-veni-emmanuel/`. https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1300
  (The songs Greensleeves, Ode to Joy and Amazing Grace take their melodies from the Mutopia 1247, 528 and 1283 sources
  listed above.)

The melodies of the songs feature 022 adds to *Learning > Keys* (each a full and a simplified version) are taken
unchanged from these public-domain Mutopia sources, in the same way (LilyPond source and its MIDI file, obtained
2026-10-03/04; each piece page states "Public Domain"). All are SATB settings with the tune in the Soprano; the
left-hand chords are Musicanyya's own and CC0:

- **The First Noel** - Mutopia-2008/01/13-1243, typeset by Steve Dunlop from www.cyberhymnal.org.
  `mutopia-1243-first-noel/`. https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1243
- **"O Haupt voll Blut und Wunden" (Passion Chorale, J. S. Bach, St Matthew Passion)** - Mutopia-2013/03/22-107,
  typeset by dwb from Edition Peters. `mutopia-107-passion-chorale/`.
  https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=107
- **Carol ("It Came Upon the Midnight Clear", R. S. Willis)** - Mutopia-2008/01/13-1231, typeset by Steve Dunlop
  from www.cyberhymnal.org. `mutopia-1231-carol/`. https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1231
- **Cranham ("In the Bleak Midwinter", G. Holst)** - Mutopia-2008/01/13-1233, typeset by Steve Dunlop from
  www.cyberhymnal.org. `mutopia-1233-cranham/`. https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1233
- **Lobe den Herren ("Praise to the Lord")** - Mutopia-2008/01/13-1256, typeset by Steve Dunlop from
  www.cyberhymnal.org. `mutopia-1256-lobe-den-herren/`. https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1256
- **St. Anne ("O God, Our Help in Ages Past", W. Croft)** - Mutopia-2008/02/19-1290, typeset by Steve Dunlop from
  www.cyberhymnal.org. `mutopia-1290-st-anne/`. https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1290
- **Leoni ("The God of Abraham Praise", from a synagogue melody for the Yigdal, transcribed by M. Lyon and adapted by
  T. Olivers)** - Mutopia-2016/11/01-525, typeset by Peter Chubb from the Australian Hymn Book (number 53).
  `mutopia-525-leoni/`. https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=525
- **St. Denio ("Immortal, Invisible", Welsh)** - Mutopia-2008/02/19-1291, typeset by Steve Dunlop from
  www.cyberhymnal.org. `mutopia-1291-st-denio/`. https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1291
- **Tryggare kan ingen vara (Swedish)** - Mutopia-2008/02/19-1299, typeset by Steve Dunlop from www.cyberhymnal.org.
  `mutopia-1299-tryggare-kan-ingen-vara/`. https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1299
- **Mendelssohn ("Hark! the Herald Angels Sing", F. Mendelssohn)** - Mutopia-2008/01/13-1261, typeset by Steve
  Dunlop from www.cyberhymnal.org. `mutopia-1261-mendelssohn/`.
  https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1261

A printed edition recorded by URL and hash only (the scan is not committed; feature 019): Musicanyya's own CC0
transcriptions of *Morning Mood* are read from it.

- **Grieg, Peer Gynt Suite No. 1, Op. 46, arranged for pianoforte by the composer** - G. Schirmer, New York
  (Schirmer's Library of Musical Classics Vols. 205 and 1420); *Morgenstimmung* edited and fingered by Louis Oesterle,
  "Copyright, 1899, by G. Schirmer". Scan digitized by the Internet Archive from the University of Toronto, Faculty of
  Music Library, item 31761045200615, obtained 2026-10-01. `ia-31761045200615-grieg-op46-schirmer/`.
  https://archive.org/details/31761045200615

## Test fixtures (not shipped with the application)

- **OpenScore Lieder Corpus** and **OpenScore String Quartets** (downloaded 2026-09-22)
  Licence: Creative Commons CC0 1.0 Universal (public-domain dedication; no attribution required).
  Eighteen scores are used unmodified as test fixtures in `tests/fixtures/musicxml/real/`, which lists each
  file and where it came from. They are transcriptions of public-domain works and are not part of any
  build output.
  https://github.com/OpenScore/Lieder
  https://github.com/OpenScore/StringQuartets

- **MusicXML Test Suite** (downloaded 2026-09-22)
  Licence: MIT License, Copyright (c) 2016-2026 Michael Scott Asato Cuthbert. Originally written for
  LilyPond's `musicxml2ly` by Reinhold Kainhofer, forked with his blessing, and donated in 2026 to the
  W3C Music Notation Community Group. 183 files are used unmodified as test fixtures in
  `tests/fixtures/musicxml/community/`; the full licence text is in that folder as
  `LICENSE.musicxmlTestSuite.txt`. Not part of any build output.
  https://github.com/w3c-cg/musicxmlTestSuite

- **MusicXML specification tutorial examples** (downloaded 2026-09-22)
  Licence: W3C Software and Document License (the repository is a W3C Community Group report and
  carries no per-file licence statement of its own). Five files are used unmodified as test fixtures
  in `tests/fixtures/musicxml/spec-examples/`. Not part of any build output.
  https://www.w3.org/copyright/software-license/
  https://github.com/w3c/musicxml
