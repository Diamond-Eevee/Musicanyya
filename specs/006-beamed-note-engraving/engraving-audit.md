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
| bach-prelude-bwv846 | Missing | Missing | Missing | |
| chopin-prelude-op28-no20 | Missing | Missing | Missing | |
| chopin-prelude-op28-no4 | Missing | Missing | Missing | |
| fur-elise-complete | Missing | Missing | Missing | |
| satie-gymnopedie-no1 | Missing | Missing | Missing | |
| amazing-grace | Not used | Not used | Missing | |
| fur-elise-theme-16-bar | Missing | Missing | Missing | |
| greensleeves | Not used | Not used | Missing | |
| jingle-bells | Not used | Not used | Missing | |
| mary-had-a-little-lamb | Not used | Not used | Missing | |
| ode-to-joy | Not used | Not used | Missing | |
| twinkle-twinkle-little-star | Not used | Not used | Missing | |
| burgmuller-op100-no2 | Missing | Missing | Missing | |
| burgmuller-op100-no5 | Missing | Missing | Missing | |
| clementi-sonatina-op36-no1-mvt1 | Missing | Missing | Missing | |
| fur-elise-theme | Missing | Missing | Missing | |
| schumann-op68-no10 | Missing | Missing | Missing | |

## Gaps & Follow-Ups (FR-015)

No gaps were found that contradict playback or grading (pitches, rests, ties, and repeats are present).

The following purely visual/pedagogical gaps were found across the library and are recorded as named follow-ups:
1. **Slurs & Phrase Marks**: Missing from the MusicXML.
2. **Articulations** (staccato, accents, etc.): Missing.
3. **Fingering**: Missing.

**Decision (T045)**: The owner requested to try to fix visual gaps if possible. However, because this data is completely absent from the source MusicXML files and cannot be algorithmically deduced without a pedagogical model, it is not possible to fix programmatically in this feature. These gaps require manual data entry and remain recorded as follow-ups for a future library enrichment task.
