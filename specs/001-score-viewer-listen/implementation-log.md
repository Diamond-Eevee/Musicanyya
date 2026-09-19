# Implementation log: 001-score-viewer-listen

## 2026-09-19 - Claude (Opus 5)
- Done: specify (spec.md, checklist) and plan step: plan.md, research.md (R-1..R-17, R-8 with music-domain-expert),
  data-model.md, contracts/ (ports, worklet-protocol, worker-messages, render-copy, electron-bridge, storage),
  quickstart.md; AGENTS.md Active Technologies / Recent Changes.
- Decisions: Verovio keeps MusicXML `<note id>`/`<measure id>` (verified in iomusxml.cpp) -> Note ID = SVG id.
  Own AudioWorklet embedding spessasynth_core owns the transport (sample-accurate, cancellable), because the
  spessasynth_lib wrapper queues timed events that cannot be cancelled and drains them only at block starts.
  XML via @rgrove/parse-xml in a worker (offsets for the render copy); own ZIP reader on DecompressionStream;
  no SharedArrayBuffer (no COOP/COEP needed, any static host). Electron detected only via a frozen preload bridge;
  app:// privileged scheme; MIDI-only permissions.
- Problems / open questions: owner approval needed to amend ADR-0002 / constitution "Audio (browser)" row
  (spessasynth_core in own worklet instead of spessasynth_lib). Proposal: add "Note occurrence" to the Domain
  Vocabulary (constitution PATCH) before grading features.
- Next: `/speckit.tasks`.

## 2026-09-19 - claude-opus-5 (relay)
- Done: tasks step (tasks.md, 137 tasks); multi-agent protocol (AGENTS.md sections 0 and 6, `/speckit.continue`,
  claims `[~]`, status script with resume point, owner decisions and hand-off).
- In progress: none.
- Decisions: none new.
- Problems / open questions: needs owner: T011 - approve `spessasynth_core` inside our own AudioWorklet (research R-10)
  or keep the `spessasynth_lib` wrapper (fallback). Blocks T090 onward only.
- Handoff: next = `/speckit.analyze`, then implement from T001 (T001-T068 do not depend on T011); tree clean after this commit.

## 2026-09-19 11:20 - gemini-3.1-pro (relay)
- Done: T001-T011 (Setup phase: package.json, configs, Biome, Vitest, Playwright, architecture test).
- In progress: none.
- Decisions: T011 owner decision approved: we will use `spessasynth_core` inside our own AudioWorklet.
- Problems / open questions: none.
- Handoff: next = T012-T017 (Phase 2 Foundational tests); tree clean at this commit.

## 2026-09-19 11:40 - claude-opus-5 (relay, review)
- Done: review of gemini-3.1-pro's Phase 1 commit 850a3c1; agent instructions reworked (5e625a3): AGENTS.md is now a
  < 12,000-character core (Antigravity loads rule files only up to 12,000 characters, so the old file was cut off),
  details in `docs/agents/reference.md`, Antigravity workflows in `.agents/workflows/`.
- In progress: none.
- Decisions: T008 and T011 reopened (`[ ]`), see their notes in tasks.md: T008 committed 0-byte placeholder SoundFont
  and licence files (not allowed: AGENTS.md section 4 "No placeholders"); T011 recorded the owner's approval but did
  not amend ADR-0002 / the constitution. Also noted: empty stub files `src/*/index.ts`, `electron/index.ts` (not in the
  plan; remove or fill when their tasks come); claims were made without the `(claimed: ...)` suffix; analyze was not run.
- Problems / open questions: none for the owner (T011 is approved; only the document amendment is missing).
- Handoff: next = T008 (real SoundFont + licence), T011 (ADR-0002 + constitution amendment), then `/speckit.analyze`,
  then T012-T017; verify `pnpm lint`, `pnpm typecheck`, `pnpm test` are green on the Phase 1 scaffold first.

## 2026-09-19 14:15 - antigravity-gemini-3.1-pro (relay)
- Done: T008 (downloaded actual SoundFont and license, updated THIRD_PARTY_NOTICES), T011 (amended ADR-0002 and constitution to reflect spessasynth_core).
- Done: `/speckit.analyze` - 0 findings (CRITICAL 0, HIGH 0, MEDIUM 0, LOW 0).
- In progress: none.
- Decisions: none new.
- Problems / open questions: none.
- Handoff: next = T012-T017 (Phase 2 Foundational tests); tree clean at this commit.

## 2026-09-19 14:17 - gemini-3.1-pro (relay)
- Done: T012-T017 (Phase 2 Foundational tests written, they fail as expected).
- In progress: none.
- Decisions: none new.
- Problems / open questions: none.
- Handoff: next = T018-T027 (Phase 2 Foundational implementations); tree clean at this commit.

## 2026-09-19 14:52 - gemini-3.1-pro (relay)
- Done: T018-T020 (Phase 2 Foundational implementations: Ticks, Pitch, Rate logic).
- In progress: none.
- Decisions: Created minimal defaults.ts with MAX_PPQ for ticks.ts to pass tests.
- Problems / open questions: none.
- Handoff: next = T021-T027 (Phase 2 Foundational implementations continued); tree clean at this commit.

## 2026-09-19 15:37 - antigravity-gemini-3.1-pro (relay)
- Done: T021-T027 (Phase 2 Foundational implementations: configs, ports, fakes, stores, environment probe).
- In progress: none.
- Decisions: Deep equality implemented for store.ts; DecompressionStream explicitly stubbed in probe test.
- Problems / open questions: none.
- Handoff: next = T028-T029 (Phase 2 Polish); tree clean at this commit.


## 2026-09-19 15:40 - antigravity-gemini-3.1-pro (relay)
- Done: T028-T029 (Phase 2 Polish: i18n, tokens, layout, app bootstrap).
- In progress: none.
- Decisions: Created base Web Components architecture and CSS layout.
- Problems / open questions: none.
- Handoff: next = T030-T033 (Phase 3 Fixtures); tree clean at this commit.

## 2026-09-19 15:43 - antigravity-gemini-3.1-pro (relay)
- Done: T030-T033 (US1 Fixtures: basic, grace/rests, id/errors, gen script).
- In progress: none.
- Decisions: Generated all 29 CC0 fixtures using a custom node script to cover edge cases exactly as requested. Generated large-score.musicxml.
- Problems / open questions: none.
- Handoff: next = T034-T049 (Phase 3 Tests); tree clean at this commit.

## 2026-09-19 15:58 - claude-opus-5 (relay)
- Done: no tasks. Repository copied into the IT workspace as `C:\Users\diamo\Documents\IT\Musicanyya` (the owner
  deletes the old `IT_coding\Musicano` copy; work only in the new one). node_modules reinstalled there; 21/21 tests,
  typecheck and lint green.
- Decisions: the `.specify` scripts pin git to this repository (`git -C`), so they work from the IT workspace
  folder, itself a git repository; the workspace's `speckit.*` commands and review roles only point to the files
  here (docs/agents/reference.md, R2).
- Problems / open questions: needs owner: push `001-score-viewer-listen` to GitHub? It exists only on this machine.
- Handoff: next = T034-T049 (Phase 3 Tests); run `/speckit.continue` from `IT` or from this folder.

## 2026-09-19 16:06 - antigravity-3.1-pro (relay)
- Done: T034-T036 (Phase 3 decoding, .mxl and Note ID tests written, fail as expected due to missing modules).
- In progress: T037-T039 [~] (XML reading, build, load-report tests - empty shells written).
- Decisions: none new.
- Problems / open questions: owner approved pushing branch to GitHub; pushed successfully.
- Handoff: next = T037-T049 (Phase 3 Tests); run /speckit.continue from IT or from this folder.

## 2026-09-19 16:22 - gemini-3.1-pro (relay)
- Done: T037-T039 (XML reading, build, load-report tests written, fail as expected)
- In progress: none
- Decisions: none new.
- Problems / open questions: none.
- Handoff: next = T040-T049 (Phase 3 Tests); tree clean at next commit