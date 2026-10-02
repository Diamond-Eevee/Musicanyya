# Contract: Web Worker messages

**Version**: `1.4.0` (MINOR, feature 019-metronome-orchestra-volume, additive; full text:
[019 orchestra-score.md](../../019-metronome-orchestra-volume/contracts/orchestra-score.md) section 4:
`ScoreSummary.parts[].orchestra`; `TimelineDto.spans` contains no Orchestra note; `schedule.orchestraMask`).
`1.3.0` (MINOR, feature 012-tempo-bpm-field: `TimelineDto` gains `tempo: TempoDisplaySegment[]`
(tempo-display.md 1.1.0, built next to the tempo map); the Verovio worker's `ready` response `glyphs` gains
`noteheadHalf`, `noteheadWhole`, `flag8thUp` path data, harvested alongside `notehead`). `1.2.0` (MINOR, feature 008-pressed-keys-on-score: the Verovio worker's `ready` response gains `glyphs`,
the sharp, flat, natural and black-notehead glyph path data read from Verovio's own SVG at start-up, for the accidentals
of the red discs; nothing else changes). `1.1.0` (MINOR: additive — four new `LoadNoticeCode` values: `engravingCompleted`, `beamDataInvalid`,
`accidentalContradicts`, `engravingSkipped`; feature 006-beamed-note-engraving US3). Two dedicated module workers keep heavy work off
the main thread (Constitution I). Every request carries a `requestId`; every response echoes it. A newer request of
the same kind supersedes older ones (the main thread ignores stale responses).

## Score worker (`src/workers/score.worker.ts`)

Decodes, unpacks, parses and builds everything the rest of the app needs from one file.

| Direction | `type` | Payload |
|---|---|---|
| main -> worker | `load` | `{ requestId, fileName: string, bytes: ArrayBuffer /* transferred */ }` |
| worker -> main | `loaded` | `{ requestId, score: ScoreSummary, report: LoadReport, renderXml: string, timeline: TimelineDto, schedule: ScheduleMessage /* buffers transferred */, contentHash: string }` |
| worker -> main | `failed` | `{ requestId, error: LoadError }` |

```ts
type LoadErrorCode =
  | "notMusicXml" | "timewiseUnsupported" | "unsupportedEncoding" | "unsupportedArchive"
  | "archiveNoScore" | "fileTooLarge" | "fileTooComplex" | "malformedXml" | "noPlayableContent" | "internal";
interface LoadError { code: LoadErrorCode; message: string; line?: number; column?: number; detail?: string }

interface ScoreSummary {                       // what the UI needs; the full Score stays in the worker
  title: string | null; composer: string | null;
    arranger: string | null; // 1.1.0 (feature 006): <creator type="arranger">
  parts: { id: string; name: string; instrument: string; program: number; percussion: boolean;
           orchestra: boolean /* 1.4.0 */ }[];
  measureCount: number;                        // measures in notation order
  measureIds: string[];                        // MeasureId per notation-order index (render-copy.md)
  defaultTempoUsed: boolean;                   // true -> "no tempo marking, 100 BPM" notice
}
interface TimelineDto {                        // compact form of data-model §3 for highlighting and seeking
  ppq: number; endTick: number;
  passes: { measureIndex: number; startTick: number; endTick: number }[];   // playback order
  spans: { noteId: string; startTick: number; endTick: number }[];          // visual spans, sorted by startTick; no Orchestra notes (1.4.0)
  tempo: TempoDisplaySegment[];   // 1.3.0: buildTempoDisplayMap output (feature 012 contracts/tempo-display.md 1.1.0)
}
```

`LoadReport` is defined in data-model §2. `ScheduleMessage` is defined in worklet-protocol.md.

## Verovio worker (`src/workers/verovio.worker.ts`)

Holds one `VerovioToolkit`. The WASM module is created on the first `init`.

| Direction | `type` | Payload |
|---|---|---|
| main -> worker | `init` | `{ requestId }` -> `ready { requestId, version: string, glyphs: MusicGlyphData \| null }` (1.2.0) |
| main -> worker | `load` | `{ requestId, renderXml: string, options: LayoutOptions }` -> `laidOut { requestId, pageCount }` |
| main -> worker | `relayout` | `{ requestId, options: LayoutOptions }` -> `laidOut { requestId, pageCount }` |
| main -> worker | `page` | `{ requestId, page: number /* 1-based */ }` -> `svg { requestId, page, svg: string }` |
| main -> worker | `pageOf` | `{ requestId, elementId: string }` -> `pageIs { requestId, page: number /* 0 = not found */ }` |
| worker -> main | `error` | `{ requestId, message: string }` |

```ts
interface LayoutOptions { pageWidth: number; pageHeight: number; scale: number /* 50..200 */ }

/** 1.2.0: SVG path data in font units, y up (`<path d>`); `unitsPerEm` is four staff spaces (Leipzig: 1000). Read once, at
 *  the first `init`, by rendering a tiny built-in snippet before any Score is loaded (research R-11 of feature 008);
 *  `null` when that failed, and the discs are then drawn without accidentals.
 *  1.3.0: adds `noteheadHalf`, `noteheadWhole`, `flag8thUp` for the tempo field's beat symbol (feature 012 R-7); the
 *  same harvest, same fallback (null on failure -> the tempo field shows a text label instead). */
interface MusicGlyphData {
  sharp: string; flat: string; natural: string; notehead: string; unitsPerEm: number;
  noteheadHalf: string; noteheadWhole: string; flag8thUp: string;
}
```

Fixed options are applied in the worker (R-9): `breaks: "auto"`, `adjustPageHeight: true`, `header: "encoded"`,
`footer: "none"`, `font: "Leipzig"`, `svgViewBox: true`, `svgHtml5: false`.
