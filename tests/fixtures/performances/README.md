# Recorded Performance Fixtures

JSON `PerformanceLog` fixtures ([contracts/performance-log.md](../../../specs/003-play-mode-grading/contracts/performance-log.md)),
generated with `tests/fakes/performance-log.ts`'s `buildPerformanceLog` from compact `"<pitch>@<beat>[+-errorMs]"`
notation. Each file is `{ scoreFixture, settings, log }`; `scoreFixture` names the MusicXML fixture under
`tests/fixtures/musicxml/` the recording was played against. Load with `loadRecordedPerformance(name)`.

| Fixture | Against | Behaviour | Origin | Licence |
|---|---|---|---|---|
| accurate-eight-measures | eight-measure-melody.musicxml | Every note on time, correct pitch, quarter=100 | Hand-written | CC0 |
| mistakes-measures-3-and-7 | eight-measure-melody.musicxml | Measure 3: one note late by 150ms, one an octave high (wrongPitch), one missed. Measure 7: one note early by 150ms, one missed, one unrelated extra press. Everything else accurate (US2's Independent Test) | Hand-written | CC0 |
