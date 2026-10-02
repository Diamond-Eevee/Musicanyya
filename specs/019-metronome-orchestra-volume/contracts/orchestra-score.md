# Contract: Orchestra parts (MusicXML, Score model, render copy, playback)

**Version**: `1.0.0` (new, feature 019). Owners: `src/core/musicxml/build.ts`, `src/core/musicxml/render-copy.ts`,
`src/workers/score.worker.ts`, `src/core/timeline/*`, `src/core/schedule/*`, `src/core/practice/expected.ts`.
Decisions: research R-1 to R-4, R-8 to R-10.

## 1. Encoding (input)

```xml
<part id="P2">                       <!-- listed in <part-list> as a normal <score-part> with <midi-instrument> -->
  <measure number="1">
    <attributes>
      <divisions>4</divisions>
      <staves>1</staves>             <!-- optional for one staff -->
      <clef>...</clef>
      <staff-details number="1" print-object="no" print-spacing="no"/>   <!-- one per staff; no `number` = staff 1 -->
    </attributes>
    <note>...</note>
```

Detection: `Part.orchestra = true` iff, in the part's **first measure**, every staff 1..`staves` has a
`<staff-details>` with `print-object="no"` **and `print-spacing="no"`** (omitted: not drawn, no room), and no later
`<staff-details>` of that part sets `print-object="yes"`. Otherwise every such omitted staff of the part is ignored with one
`hiddenStaffIgnored` warning. `print-object="no"` **without** `print-spacing="no"` is not this feature: it is a cutaway band or
MuseScore's "hide empty staves" (written for the measures where a staff is empty while it is printed elsewhere) - the part is
printed and nothing is reported (found by the real-score e2e `stanford-sailing-at-dawn`, 2026-10-01, T037; a first reading that
accepted `print-object="no"` alone cut a printed part out of that score).

An Orchestra instrument whose
`<midi-program>` is missing or invalid is not played (`orchestraInstrumentMissing` warning; never piano).

Library items put Orchestra parts **after** the printed parts. A file with an Orchestra part first is still read
correctly (measure ids go to the first printed part).

A Score whose parts are **all** Orchestra parts: the parts are treated as printed (`hiddenStaffIgnored`), so a file can
never become an empty score sheet.

## 2. Score model

- `Part.orchestra: boolean`; every `Note` of an Orchestra part has `printed: false`.
- Note IDs are built as for any part (`n-p<part>-s<staff>-...`); nothing renumbers printed parts. Consequence: in a
  file whose Orchestra part comes **first**, the piano's Note IDs carry part index 1, not 0 as in the same file
  without the Orchestra - such a file's Note IDs equal its twin's only with the part index mapped.
- Orchestra notes have no SVG element (Constitution III as clarified by OD-4).

## 3. Render copy

`createRenderCopy(xml, inserts)` gains `inserts.removals?: Array<{ start: number; end: number }>` (render-copy
contract 1.2.0): byte ranges cut out of the copy in the same single pass. The worker passes, per Orchestra part, the
range of its `<score-part>` element and of its `<part>` element. Rules:

- Removals never overlap each other; a note, measure, element insert or rewrite whose range lies inside a removal is
  dropped (not an error).
- The worker writes no note inserts for Orchestra notes and puts measure ids on the first printed part.
- The resulting SVG has no element for any Orchestra note, staff, label or brace.

## 4. Worker `loaded` message (worker-messages 1.4.0)

- `summary.parts[i].orchestra: boolean` (and the existing `name` / `instrument`).
- `timeline.spans` (`TimelineDto`) contains no Orchestra note.
- `schedule.orchestraMask` set (section 5).

## 5. Playback

- Channels: as data-model section 2. `orchestraChannelsShared` warning when they run out.
- `ScheduleMessage.orchestraMask?: number` - bit *c* = channel *c* is an Orchestra channel (worklet-protocol 1.6.0).
- Listen: the Score schedule contains Orchestra events like any part.
- Play (`compilePlaySchedule`, play-run 2.2.0): Orchestra events kept regardless of `accompaniment`; shifted behind
  the count-in; never graded. `mergeSchedules` keeps `orchestraMask` (replay).
- Practice (practice-session 1.8.0): `ExpectedEvent.orchestra`, effects `orchestraOn` / `orchestraOff`, started and
  released by the accompaniment's timing rules, independent of the Accompaniment setting. Orchestra notes on
  `PERCUSSION_CHANNEL` (an Orchestra part with percussion instruments) are left out of `orchestra`: they sound in Listen
  and Play only (live input on the percussion channel is refused by the worklet).

## 6. Exclusions (normative)

An Orchestra note is never: expected or required (Practice, Play), in `accompaniment` or `playedAlong` spans, marked,
counted in progress or library facts, shown on the on-screen piano, part of a visual span, offered as a part or hand to
play, or an Advice anchor.

## 7. Tests (minimum)

Fixture `tests/fixtures/musicxml/orchestra/` (own work, CC0): piano + one-staff Orchestra part; piano + two-staff
Orchestra part; Orchestra part first; partly hidden part (warning); later-hidden staff (warning); all parts hidden
(warning, printed). Each asserts the model flags, the render copy (no Orchestra element), spans, channels and
`orchestraMask`, expected events, and that every printed Note ID equals the same file without the Orchestra part -
for Orchestra-after-piano files exactly, for `orchestra-first` with the part index mapped (its render copy differs from
the twin's only in those ids).
