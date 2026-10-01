# Contract changes to earlier features (feature 019)

Applied by the implementation tasks, contract first, then code (AGENTS.md section 6). Reasons: [research.md](../research.md).
New contracts of this feature: [orchestra-score.md](orchestra-score.md), [mixer-levels.md](mixer-levels.md),
[orchestration-definition.md](orchestration-definition.md).

| Contract | From -> to | Change |
|---|---|---|
| `001/contracts/worklet-protocol.md` | 1.5.1 -> **1.6.0** (MINOR) | New `orchestraLevel { gain }` message (CC11 on Orchestra channels); `ScheduleMessage.orchestraMask?` and CC11 reset to 127 on other used channels when the setup is applied; `live` gains optional `channel` (validated; stored in the pre-allocated queue); `allOff` also releases Orchestra channels. Full text: [mixer-levels.md](mixer-levels.md) §4. |
| `001/contracts/ports.md` | 2.1.0 -> **2.2.0** (MINOR) | `AudioEngine.setOrchestraLevel(level)`; `liveNoteOn(key, velocity, channel?)`, `liveNoteOff(key, channel?)`; `UserSettings` version 3 with `metronomeLevel`, `orchestraLevel`. |
| `001/contracts/render-copy.md` | 1.1.0 -> **1.2.0** (MINOR) | `inserts.removals` (byte ranges cut out in the same pass; inserts inside a removal are dropped); measure ids on the first printed part. [orchestra-score.md](orchestra-score.md) §3. |
| `001/contracts/worker-messages.md` | 1.3.0 -> **1.4.0** (MINOR) | `summary.parts[].orchestra`; `TimelineDto.spans` without Orchestra notes; `schedule.orchestraMask`. |
| `001/contracts/storage.md` | table, additive | Row `musicanyya.settings.v1`: object version 3 adds the two levels (see view-settings). |
| `004/contracts/view-settings.md` | 2.1.0 -> **2.2.0** (MINOR) | Settings object version 3: `metronomeLevel`, `orchestraLevel` (0..100), reading rules for 1/2/invalid. [mixer-levels.md](mixer-levels.md) §2. |
| `004/contracts/ui-shell.md` | 1.4.0 -> **1.5.0** (MINOR) | Panel id `'sound'` (Levels popover) and its toolbar button after the Volume slider. |
| `002/contracts/practice-session.md` | 1.7.0 -> **1.8.0** (MINOR) | `ExpectedEvent.orchestra: OrchestraRef[]`; session `soundingOrchestra`; effects `orchestraOn` / `orchestraOff`; release rules shared with the accompaniment but independent of `setAccompaniment`. |
| `003/contracts/play-run.md` | 2.1.0 -> **2.2.0** (MINOR) | `compilePlaySchedule` keeps Orchestra-channel events whatever `accompaniment` is; the Metronome channel volume is `metronomeChannelVolume(muted, level)`. |
| `003/contracts/grading.md` | 1.2.1 -> **1.2.2** (PATCH, wording) | States that notes with `printed: false` (including every Orchestra note) are never expected and never in played-along spans; no behaviour change for existing Scores. |
| `005/contracts/library-index.md` | 1.2.0 -> **1.3.0** (MINOR) | `ItemFacts.orchestra?: string[]`; facts from printed parts only; (conditional, R-17) `maxArpeggiatedSpanSemitones` and the Advanced `<arpeggiate>` span exception. |
| `007/contracts/source-manifest.md` | 1.1.0 -> **1.2.0** (MINOR) | Optional `origin: "downloaded" \| "transcription"`. |
| `007/contracts/source-manifest.md` | 1.2.0 -> **1.3.0** (MINOR, R-19) | `licence` also CC BY / CC BY-SA 2.0-4.0 (SPDX); `credit` required for them. |
| `005/contracts/library-index.md` | 1.3.0 -> **1.4.0** (MINOR, R-19) | `downloaded` items may be CC BY / CC BY-SA; then `credit`, `unmodified` required and `sourcePath`'s manifest has the same licence; authored items stay CC0. Data-model §6.3a. |
| `007/contracts/audit-record.md` | 1.3.0 -> **1.4.0** (MINOR) | Theory rule set `orchestra-v1` (rules O1-O5 of [orchestration-definition.md](orchestration-definition.md) §3). |
| `007/contracts/fidelity-tools.md` | 1.13.0 -> **1.14.0** (MINOR) | `checkOrchestra`; command `pnpm library:orchestra <item-id> [--check]`; the writer can write `<staff-details print-object="no">` and `<sound dynamics>`. |
| `007/contracts/fidelity-tools.md` | 1.14.0 -> **1.15.0** (MINOR, T081) | Two-note `\repeat tremolo` in the LilyPond reader (read as strokes) and converter (two notes with `<tremolo>` start/stop, 2:1); `WriteNote.tremolo`; `fromMusicXml` reads a written two-note tremolo as strokes. |
| `007/contracts/fidelity-tools.md` | 1.15.0 -> **1.16.0** (MINOR, T082) | `\afterGrace main { graces }` (Nachschlag): graces at the end of the main note, in its bar; written as `<grace/>` notes after it in that measure. |
| `013/contracts/score-browser.md` | 1.1.0 -> **1.2.0** (MINOR) | List rows of items with `facts.orchestra` show the "with orchestra" marker (glyph + text); the detail lists the instruments. |
| `docs/musicxml-support.md` + `SUPPORT_MATRIX` | additive | `<staff-details print-object="no">` on every staff of a part: supported (Orchestra part); other hidden-staff uses: warning, printed. |
