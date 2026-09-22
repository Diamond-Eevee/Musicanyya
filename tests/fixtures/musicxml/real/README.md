# Real repertoire fixtures

Eighteen **downloaded** scores of real music, kept compressed (`.mxl`, 9-254 KB each; 0.2-6.6 MB of
MusicXML when unpacked). Everything else under `tests/fixtures/musicxml/` is a hand-written probe of one feature;
these are whole pieces as a notation program actually exports them, and they are here to answer one
question: does the app engrave a page that looks like a page of a printed music book?

They exercise what hand-written fixtures never do: title blocks and credits, lyrics with elisions and
melismas, pedal marks, `8va` shifts, tremolos, trill extension lines, ornament accidentals, hairpins
that stay open across systems, cross-staff beaming, pickup measures that the encoder forgot to mark
`implicit="yes"`, five-part vocal writing, and 700-measure multi-movement works.

## Provenance and licence

All eighteen come from the **OpenScore** corpora, which are transcriptions of public-domain works released
under **CC0 1.0** (public-domain dedication - no attribution required, no conditions). Each file also
carries `<rights>OpenScore (CC0)</rights>` and a link to the IMSLP source it was transcribed from in
its own `<identification>` block. Downloaded 2026-09-22 from `main`, unmodified byte for byte.

- [OpenScore Lieder](https://github.com/OpenScore/Lieder) - CC0-1.0
- [OpenScore String Quartets](https://github.com/OpenScore/StringQuartets) - CC0-1.0

| Fixture | Work | Path in the corpus |
|---|---|---|
| `schubert-erlkoenig-d328.mxl` | Schubert, *Der Erlkönig*, D.328 | `Lieder/scores/Schubert,_Franz/_/Der_Erlkönig,_D.328/lc29062370.mxl` |
| `schubert-im-gegenwaertigen-vergangenes-d710.mxl` | Schubert, *Im Gegenwärtigen Vergangenes*, D.710 | `Lieder/scores/Schubert,_Franz/_/Im_Gegenwärtigen_Vergangenes,_D.710/lc28789279.mxl` |
| `schumann-dichterliebe-15.mxl` | Schumann, *Dichterliebe* Op.48 no.15 | `Lieder/scores/Schumann,_Robert/Dichterliebe,_Op.48/15_Aus_alten_Märchen_winkt_es/lc4978398.mxl` |
| `wolf-auf-einer-wanderung.mxl` | Wolf, *Mörike-Lieder* no.15 | `Lieder/scores/Wolf,_Hugo/Mörike-Lieder/15_Auf_einer_Wanderung/lc30893624.mxl` |
| `faure-les-roses-dispahan.mxl` | Fauré, *Les roses d'Ispahan*, Op.39 no.4 | `Lieder/scores/Fauré,_Gabriel/Op.39/4_Les_roses_d’Ispahan/lc29989154.mxl` |
| `berlioz-villanelle.mxl` | Berlioz, *Les nuits d'été* Op.7 no.1 | `Lieder/scores/Berlioz,_Hector/Les_nuits_d’été,_Op.7/1_Villanelle/lc29383976.mxl` |
| `chopin-zyczenie.mxl` | Chopin, *Życzenie*, Op.74 no.1 | `Lieder/scores/Chopin,_Frédéric/Op.74/1_Życzenie/lc30707789.mxl` |
| `mendelssohn-duet-op63-1.mxl` | Mendelssohn, *6 Duets* Op.63 no.1 | `Lieder/scores/Mendelssohn,_Felix/6_Duets,_Op.63/1_Ich_wollt’,_meine_Lieb’_ergösse_sich,_MWV_J_5/lc7074684.mxl` |
| `mozart-quartet-k387.mxl` | Mozart, String Quartet no.14 in G, K.387 (4 movements) | `StringQuartets/scores/Mozart,_Wolfgang_Amadeus/String_Quartet_No.14_in_G_major,_K.387_(Op._10,_No._1)/sq7103818.mxl` |
| `beethoven-grosse-fuge-op133.mxl` | Beethoven, *Grosse Fuge*, Op.133 | `StringQuartets/scores/Beethoven,_Ludwig_van/Grosse_Fuge_in_B-flat_major,_Op.133/sq10502527.mxl` |
| `debussy-le-balcon.mxl` | Debussy, *Le Balcon* (Cinq Poèmes de Baudelaire) | `Lieder/scores/Debussy,_Claude/Cinq_Poëmes_de_Baudelaire/1_Le_Balcon/lc5060949.mxl` |
| `satie-mort-de-socrate.mxl` | Satie, *Mort de Socrate* (Socrate) | `Lieder/scores/Satie,_Erik/Socrate/3_Mort_de_Socrate/lc6482032.mxl` |
| `stanford-sailing-at-dawn.mxl` | Stanford, *Sailing at Dawn* (Songs of the Fleet, Op.117) | `Lieder/scores/Stanford,_Charles_Villiers/Songs_of_the_Fleet_(Piano),_Op.117/1_Sailing_at_Dawn/lc31184216.mxl` |
| `holmes-lor.mxl` | Holmès, *L'Or* (Les Sept Ivresses) | `Lieder/scores/Holmès,_Augusta_Mary_Anne/Les_Sept_Ivresses/7_L’Or/lc5879039.mxl` |
| `bridge-dweller-in-my-deathless-dreams.mxl` | Bridge, *Dweller in My Deathless Dreams* (3 Tagore Songs) | `Lieder/scores/Bridge,_Frank/3_Tagore_Songs,_H.164/3_Dweller_in_My_Deathless_Dreams/lc31562306.mxl` |
| `janacek-quartet-2-intimate-letters.mxl` | Janáček, String Quartet no.2 *Intimate Letters* | `StringQuartets/scores/Janáček,_Leoš/String_Quartet_No.2_“Intimate_Letters”/sq7267316.mxl` |
| `dvorak-quartet-12-american.mxl` | Dvořák, String Quartet no.12 *American*, Op.96 | `StringQuartets/scores/Dvořák,_Antonín/String_Quartet_No.12,_Op.96_(“American”)/sq8885439.mxl` |
| `mayer-quartet-d-minor.mxl` | Emilie Mayer, String Quartet in D minor | `StringQuartets/scores/Mayer,_Emilie/String_Quartet_in_D_Minor/sq7643891.mxl` |

## What the app makes of them

Read off the fixtures on 2026-09-22 and asserted in `tests/core/musicxml/real-scores.test.ts`.
`Notices` are the load-report codes; all of them are `info`, and none of the files fails to open.

| Fixture | Parts | Measures | Notes | Pages | Notices |
|---|---:|---:|---:|---:|---|
| `chopin-zyczenie` | 2 | 30 | 297 | 2 | - |
| `mendelssohn-duet-op63-1` | 3 | 57 | 1 629 | 5 | - |
| `faure-les-roses-dispahan` | 2 | 81 | 1 021 | 4 | - |
| `wolf-auf-einer-wanderung` | 2 | 108 | 2 090 | 5 | `measureLengthMismatch`, `unsupportedElement` (wavy-line) |
| `schumann-dichterliebe-15` | 2 | 114 | 1 855 | 5 | - |
| `berlioz-villanelle` | 2 | 131 | 1 949 | 5 | - |
| `schubert-erlkoenig-d328` | 2 | 148 | 2 893 | 8 | - |
| `schubert-im-gegenwaertigen-vergangenes-d710` | 5 | 158 | 3 931 | 14 | `measureLengthMismatch` |
| `mozart-quartet-k387` | 4 | 724 | 10 375 | 49 | `measureLengthMismatch` |
| `beethoven-grosse-fuge-op133` | 4 | 742 | 9 946 | 45 | `measureLengthMismatch`, `unsupportedElement` (accidental-mark, wavy-line) |
| `bridge-dweller-in-my-deathless-dreams` | 2 | 77 | 1 618 | 8 | - |
| `stanford-sailing-at-dawn` | 6 | 70 | 2 341 | 11 | - |
| `debussy-le-balcon` | 2 | 131 | 3 135 | 13 | - |
| `holmes-lor` | 2 | 154 | 4 255 | 17 | - |
| `satie-mort-de-socrate` | 2 | 294 | 6 212 | 20 | - |
| `dvorak-quartet-12-american` | 4 | 853 | 13 610 | 51 | `unsupportedElement` (inverted-mordent, wavy-line) |
| `mayer-quartet-d-minor` | 4 | 914 | 13 220 | 58 | `unsupportedElement` (accidental-mark, wavy-line) |
| `janacek-quartet-2-intimate-letters` | 4 | 993 | 10 396 | 55 | `measureLengthMismatch`, `unsupportedElement` (accidental-mark, inverted-mordent, wavy-line) |

Every `measureLengthMismatch` here is the file's own doing, not a parser error: an anacrusis the
encoder left unmarked (Wolf measure 1 is half a 6/8 bar; Mozart measure 55 is an eighth-note pickup
into a repeat). The app opens all of them and reports the mismatch as `info`.

`unsupportedElement` covers engraving-only markup the time model does not need - `<wavy-line>` (the
trill extension) and `<accidental-mark>` (the accidental printed over an ornament). Verovio still
engraves them from the render copy, so the printed page is complete; see `docs/musicxml-support.md`.

## Sister folders

- `../community/` - the 183-file MusicXML Test Suite the notation-software community tests against
  (MIT). Small conformance probes rather than music; it is what found the two parser bugs listed in
  its README.
- `../spec-examples/` - five worked examples from the MusicXML specification, covering guitar
  tablature, drum-kit percussion and chord symbols.

## Adding another one

Keep it CC0 or public domain, keep it compressed, record it in the tables above and in
`THIRD_PARTY_NOTICES.md`, and add its row to `tests/core/musicxml/real-scores.test.ts` (which fails if
a file here has no entry). `pnpm tsx tests/tools/probe-real-scores.ts <dir>` prints the numbers the
row needs and writes the first engraved page as an SVG to look at.
