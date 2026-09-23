# Engraving Audit

## Element Support Summary

| Element | Status in Library | Notes |
|---|---|---|
| Beams | Present | Completed by the engraving tool (006) |
| Accidentals (incl. courtesy) | Present | Completed by the engraving tool (006) |
| Stems | Present | Rendered by Verovio |
| Rests | Present | Encoded in files, rendered |
| Ties | Present | Used in Bach BWV846, Chopin No.4, Satie, Burgmuller No.2 |
| Slurs & Phrase marks | **Missing** | Not encoded in any file (e.g. Für Elise reference has them) |
| Dynamics & Hairpins | Present | Encoded and rendered |
| Tempo & Expression text | Present | Encoded and rendered |
| Articulations | **Missing** | Not encoded in any file |
| Fingering | **Missing** | Not encoded (planned for Advice files later?) |
| Pedal marks | Present | Used in Chopin No.20, Satie |
| Ornaments | Present | Used in Chopin No.4 |
| Repeats / Voltas / Jumps | Present | Used in Burgmuller No.2 |
| Title & Composer block | Present | Added to the UI in this feature (006) |
| System-start bar numbers | Present | Rendered automatically by Verovio |

## Piece-by-Piece Matrix

| Piece | Slurs | Articulations | Fingering | Other Missing |
|---|---|---|---|---|
| bach-prelude-bwv846 | Not used (no original slurs) | Not used | Missing (bars 1-35) | |
| chopin-prelude-op28-no20 | Missing (bars 1-12) | Missing (accents bars 1-12) | Missing (bars 1-13) | |
| chopin-prelude-op28-no4 | Missing (RH bars 1-25) | Not used | Missing (bars 1-25) | |
| fur-elise-complete | Missing (bars 1-8, 14-22, 24-37) | Missing (staccato bars 4-8, 14-16) | Missing (bars 1-105) | |
| satie-gymnopedie-no1 | Missing (bars 5-31) | Not used | Missing (bars 1-39) | |
| amazing-grace | Not used | Not used | Missing (bars 1-16) | |
| fur-elise-theme-16-bar | Missing (bars 1-16) | Missing (staccato bars 4-8, 14-16) | Missing (bars 1-16) | |
| greensleeves | Missing (bars 1-16) | Not used | Missing (bars 1-16) | |
| jingle-bells | Not used | Missing (accents bar 16) | Missing (bars 1-16) | |
| mary-had-a-little-lamb | Not used | Not used | Missing (bars 1-8) | |
| ode-to-joy | Missing (bars 1-16) | Not used | Missing (bars 1-16) | |
| twinkle-twinkle-little-star | Not used | Not used | Missing (bars 1-12) | |
| burgmuller-op100-no2 | Missing (bars 1-10, 13-24) | Missing (staccato bars 2, 4, 15-20) | Missing (bars 1-25) | |
| burgmuller-op100-no5 | Missing (bars 1-8) | Missing (staccato bars 1-16) | Missing (bars 1-24) | |
| clementi-sonatina-op36-no1-mvt1 | Missing (bars 1-15, 24-38) | Missing (staccato bars 1, 3, 24, 26) | Missing (bars 1-38) | |
| fur-elise-theme | Missing (bars 1-8) | Missing (staccato bars 4-8) | Missing (bars 1-8) | |
| schumann-op68-no10 | Missing (bars 1-16) | Missing (accents bars 1, 3, 5, 11) | Missing (bars 1-20) | |

## Gaps & Follow-Ups (FR-015)

No gaps were found that contradict playback or grading (pitches, rests, ties, and repeats are present).

The following purely visual/pedagogical gaps were found across the library and are recorded as named follow-ups:
1. **Slurs & Phrase Marks**: Missing from the MusicXML.
2. **Articulations** (staccato, accents, etc.): Missing.
3. **Fingering**: Missing.

**Decision (T045)**: The owner requested to try to fix visual gaps if possible. However, because this data is completely absent from the source MusicXML files and cannot be algorithmically deduced without a pedagogical model, it is not possible to fix programmatically in this feature. These gaps require manual data entry and remain recorded as follow-ups for a future library enrichment task.
