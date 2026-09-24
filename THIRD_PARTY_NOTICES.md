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

The library's `.musicxml` files were completed by the project's engraving tool (`pnpm library:engrave`), which adds
missing `<beam>` and `<accidental>` elements for display. Nothing else in the files is changed, and each file keeps
the licence recorded for it in `public/library/index.json`.

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
