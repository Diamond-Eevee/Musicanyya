# Implementation Log: 018 Collapsible Browser Folder Tree

## 2026-10-01 - claude-opus-5.5 (specify, clarify, plan)
- Done: spec.md (4 stories, FR-001..FR-017, SC-001..SC-006), 3 clarifications (name click chooses and expands; reveal
  only on open; ancestor expansion is saved), plan.md, research.md (R-1..R-11), data-model.md,
  contracts/browser-view.md (013 score-browser 1.0.0 -> 1.1.0), contracts/contract-changes.md, quickstart.md;
  reference.md Recent Changes.
- Decisions: additive `expanded` field in the existing `musicanyya.browser.v1` record, version stays 1 (R-1);
  tree state owned by `browserState` and not by the rail element (R-2); reveal on every index load and on open (R-4);
  after an open, the folder switches only when it cannot list the item (R-5); no new port until accounts exist (R-10).
- Problems / open questions: none; no owner decisions.
- Model fit: steps are tier `deep`; claude-opus-5.5 fits.
- Handoff: next = `/speckit:tasks`; no code changed yet, gate not run (docs only).

## 2026-10-01 - claude-opus-5.5 (tasks)
- Done: tasks.md, T001-T023 in 6 phases (Setup, Foundational, US1+US2 together because both are P1 and share the rail
  change, US3, US4, Polish). Tiers: 6 light (T001-T003, T019, T022, T023), 16 standard, 1 deep (T021 audit).
- Decisions: the persistence tests (T006) are in Phase 2 so they fail before the stored field exists (test-first);
  no RT review (no real-time path) and no owner gate (no open decision).
- Model fit: the tasks step is tier `standard`; claude-opus-5.5 fits.
- Handoff: next = `/speckit:analyze`, then `/speckit:implement` from T001; no code changed yet.

## 2026-10-01 - claude-opus-5.5 (analyze)
- Analyze: 11 findings (CRITICAL 0, HIGH 1, MEDIUM 4, LOW 6); tasks.md as of 09b2efd.
- Top: H1 direct file opens (Open file..., drop) end in `browserState.close()` in `src/app/session.ts` `openFile`, not
  `openSucceeded`, so FR-012 / US3 #5 / T016(c) have no implementing task; M1 reveal on every index load (also
  `startRefresh` after a reset) re-expands a path collapsed in the session; M2 a stale `selected` ref is not defined
  as cleared; M3 SC-003 timing not measured; M4 narrow-layout rail overlay not verified.
- Model fit: analyze is tier `deep`; claude-opus-5.5 fits.
- Handoff: next = fix H1 (plan/data-model + new task) and decide M1-M4, then `/speckit:implement` from T001.

## 2026-10-01 - claude-opus-5.5 (analyze remediation, owner: "make the recommended edits")
- Done: all 11 analyze findings resolved in the documents. H1: new `browserState.fileOpened(ref)` called from
  `Session.openFile` (research R-5, data-model §3, contract §4, plan, new task T024, T014 case 8). M1: reveal on the
  first successful index load of an app run only (R-4, T014 case 1b). M2: a missing restored selection is cleared
  (R-8, T014 case 6, T016 (d)). M3: timing case in `score-browser-timing.spec.ts` (T016). M4: 900 px overlay check
  (T010 (d)). L1: three-click path (T010 (e)). L2: fast double toggle (T009 case 10). L3: marker follows
  `effectiveFolder` (contract §1, data-model §2). L4: "chosen folder" wording in spec US1 #4/#5 and US3 #3. L5: `git grep`
  fallback (T019). L6: noted in T014 case 6.
- Spec behaviour changed: none beyond the owner-approved recommendations (M1 narrows the reveal to app start, as US3
  already says).
- Handoff: next = `/speckit:implement` from T001; 24 tasks (T024 belongs to Phase 4); no code changed yet.

## 2026-10-01 - claude-sonnet-5.5 (implement: Phase 1 Setup)
- Baseline (T001), branch 018-browser-tree-collapse at a59876e, before any code change, 2026-10-01:
  - `pnpm test`: `Test Files  299 passed (299)`, `Tests  6273 passed (6273)`, exit 0
  - `pnpm lint`: `Checked 1086 files ... No fixes applied. Found 316 warnings. Found 13 infos.`, exit 0 (the warnings and
    infos exist before this feature; no errors)
  - `pnpm typecheck`: `tsc --build tsconfig.json`, exit 0
- Model fit: Phase 1 is tier `light`; claude-sonnet-5.5 fits (a higher tier never asks). T021 is `deep`: will ask.

## 2026-10-01 - claude-sonnet-5.5 (implement: Phase 2 Foundational checkpoint)
- Done: T001-T008. T002 folded the 018 contract changes into 013 `score-browser.md` (1.0.0 -> 1.1.0), 013
  `data-model.md` §7/§8 and 001 `storage.md`; T003 `BROWSER_EXPANDED_MAX = 512` matches data-model §5.
- Tests first: T004 (`tree-state.test.ts`) failed with `Cannot find module .../tree-state.js`; T005 (4 new cases in
  `view-state.test.ts`) failed with `expected undefined to deeply equal []`; T006 (`tree-persistence.test.ts`, 6
  cases) all failed with `expected undefined to deeply equal ...` (no `view.expanded` yet). Implemented T007 (types,
  `tree-state.ts`) and T008 (default, `validateViewState`, `inFolder` exported); `browserState.ts` needed no change
  (`indexFailed` revalidates with the known sections, `persistView` writes the whole view).
- Test changed: `view-state.test.ts` "keeps every valid field of a full, well-formed payload" now includes
  `expanded` in its payload (018: the view has the new field; the assertion is the same `toEqual(raw)`).
- Gate at this point: `pnpm test` `Test Files  301 passed (301)`, `Tests  6305 passed (6305)`, exit 0; `pnpm
  typecheck` exit 0; `pnpm lint` exit 0 with the same 316 warnings / 13 infos as the baseline (no new ones).
  (`pnpm test -- <path>` runs the whole suite here; the path filter is ignored.)
- Handoff: next = T009 (rail tests, then T010 e2e, then T011/T012/T013); tree clean at the next commit.

## 2026-10-01 - claude-sonnet-5.5 (implement: Phase 3 US1+US2, Phase 4 US3, T019 US4 - checkpoint)
- Done: T009-T019, T024, T025, T026. T020-T023 (Polish) open.
- Tests first: T009 (`rail-tree.test.ts`) 8 of 10 cases failed for the expected reasons (no `.browser-rail-toggle`, the
  rail ignored `view.expanded`); cases 4 and 7 first passed on the old rail (`toBeDefined()` accepts `null`; case 4 never
  touched the toggle) and were tightened until they failed. T010 e2e: 4 failed on the old rail and the SC-004 case was
  anchored to the collapsed start. T014: 8 of 10 failed (`fileOpened is not a function`, no reveal, no clearing); cases
  1b and 7 are negative guards that pass on the old code and only get their teeth from the reveal. T015: 2 failed (list
  and rail never scroll); "no second scroll" and "focus stays" are guards. T016: written after the store change
  (the gate's e2e run held the build), then checked against the old `browserState.ts`/`session.ts` with
  `git stash`: the four US3 cases failed (`toHaveAttribute` on `aria-expanded`/`aria-selected`), the five Phase 3 cases
  passed; the stash was restored.
- Implemented: T011 rail rework (view.expanded, `.browser-rail-toggle`, name click opens, marker + hidden text),
  T012 CSS (chevron, 24 px hit area, marker bar + dot, `.visually-hidden`, reduced motion), T017 store (first-load-only
  reveal, missing selection cleared, open rule, `fileOpened`, `revealSelection`/`selectionRevealed`), T024
  `Session.openFile`, T018 scroll in list (lowers the request in a microtask) and rail, T025, T026.
- Decisions: (1) **New tasks T025 and T026** (next free numbers; files the tasks did not name): T025 - the
  folder-picker overlay closed on every `browserviewchange`, so a toggle inside it would have closed it
  (`mx-score-browser.ts`; contract browser-view.md §2 and 013 §4 updated); T026 - `pnpm screenshot --storage <key>=<json>`
  to seed `musicanyya.browser.v1` for the checkpoint pictures (`tools/dev/screenshot.ts`, reference.md). (2) The list
  lowers `revealSelection` in a microtask, so the rail acts on the same request whatever the subscription order (a
  synchronous clear inside the list's render would hide the flag from a rail subscribed after it). (3) `inFolder`'s
  parameter widened to `Pick<BrowserItem, 'ref' | 'sectionId'>` (logic unchanged) so the open rule can ask it about a
  file ref without building a row. (4) A name click, Enter or Space sends one `browserviewchange` with `folder` and,
  when it also opened the folder, `expanded`.
- Tests changed for 018 (reason "018: rail starts collapsed", assertions unchanged): unit - `keyboard.test.ts`
  (mountRail opens Learning and Keys first), `progress-display.test.ts` (2 cases open Repertoire),
  `rail-list-detail.test.ts` (3 cases open Repertoire, T099 opens Learning and Key changes; one title now says "with the
  folders open"), `view-state.test.ts` (the full-payload case includes `expanded`); e2e - `score-browser.spec.ts`
  (7 tests seed Learning and Keys open before `goto`; the Continue-link test now checks the marker on the closed
  Repertoire and opens it with its toggle before asserting Beginner is selected; the "every library folder" test opens
  each folder's ancestors with `revealFolder`; the keyboard test runs on the seeded open Learning), `library.spec.ts`,
  `score-browser-memory-store.spec.ts`, `score-browser-timing.spec.ts` (SC-003 test) seed the same, and
  `score-browser-a11y.spec.ts` (2 tests) call `revealFolder`. New helpers `seedBrowserView`, `seedOpenFolders`,
  `KEYS_OPEN`, `revealFolder` in `tests/e2e/helpers/browser.ts`. 013 SC-001 ("3 actions") now holds for a returning
  musician whose Keys folder is open (that is what the test seeds); a fresh profile needs the three name clicks of 018
  SC-004 (own e2e case).
- US4 review (T019): `git grep -n -E "BROWSER_VIEW_STORAGE_KEY|musicanyya.browser.v1" -- src` (`rg` is not installed
  here) lists the constant and its two uses (`loadInitialRawView` read, `persistView` write) only in
  `src/ui/state/browserState.ts`; the other hits are comments. e2e `score-browser-tree.spec.ts` "same after a reload"
  asserts the record is `{ version: 1, view }` with exactly `expanded, filters, folder, search, selected, sort`.
  US4 #2 (a 013 record upgrades in place) is covered by `view-state.test.ts` (T005).
- FR-013 half "remembered folder gone" is covered by 013's `view-state.test.ts` ("a stored section id gone ... becomes
  continue") (analyze L6); T014 case 6 covers the selection half.
- Looked at (PNGs in `tests/.generated/018/`): `fresh-night.png` (five entries, chevrons, nothing open),
  `marker-night.png` and `marker-paper.png` (Learning open, Keys closed with the dot and the thin bar, C major chosen),
  `restore-paper.png` (path open, C major chosen, *Intermediate* selected with its detail, score area empty).
  Note: the progress text beside a name is cut ("0 of 165 played, 0 mas...") a little earlier than before because the
  toggle takes 26 px of the 16 rem rail; it was already cut for deep folders.
- Gate (T013 + checkpoint), exit codes 0: `pnpm lint` 316 warnings 13 infos (same as the baseline); `pnpm typecheck`;
  `pnpm test` `Test Files  303 passed (303)`, `Tests  6330 passed (6330)`; `pnpm test:e2e` `1236 passed`, `720 skipped`,
  0 failed (13.4 min). An earlier full run had one failure, `panels-look.spec.ts` "Practice help ..." in the Paper
  theme (the Start button stayed "Start"; the spec does not touch the browser rail); alone it passed 6 of 6 and the
  next full run passed, so it was load-related, not caused by this change.
- Timing: new e2e case, open with a restored selection in a once-collapsed path: median 16.3 ms (budget 300 ms);
  SC-002 23.0 ms; SC-003 folder 11.7 ms, search 19.3 ms, filter 19.4 ms (budget 100 ms).
- Model fit: owner chose nothing yet for T021 (`deep`); I am claude-sonnet-5.5 and will ask before it.
- Handoff: next = T020 (quickstart manual verification with `pnpm screenshot`, PNGs to `tests/.generated/018/`), then
  T021 (`deep`: ask the owner switch or continue), T022, T023; tree clean at the next commit.

## 2026-10-01 - claude-sonnet-5.5 (implement: T020 manual verification)
- T020 per quickstart "Manual verification" (PNGs in `tests/.generated/018/`, each one looked at; `pnpm screenshot` cannot
  click, so a step that needs a click is covered by the named test and, where useful, by a seeded picture):
  - US1 #1 Learning open shows Keys and Key changes, both closed: `marker-night.png` / `marker-paper.png`. #2 name click
    chooses and opens, a second click keeps it open: `rail-tree.test.ts` cases 3-4, e2e "three name clicks". #3 the toggle
    hides the key folders, list unchanged: `rail-tree.test.ts` case 1. #4 closed Keys with C major chosen shows the bar
    and dot: `marker-night.png`, `marker-paper.png`. #5 keyboard: `rail-tree.test.ts` case 6 and the e2e keyboard walk
    in `score-browser.spec.ts`. #6 no triangle on Continue, All, My files and key folders: `restore-paper.png`,
    `rail-tree.test.ts` case 7.
  - US2 #1 five closed entries, whole rail visible at 768 px tall: `fresh-night.png` and the e2e `scrollHeight <=
    clientHeight` check. #2 reload keeps the open folders: e2e. #3 a stored `expanded` with `no/such/section`:
    `stale-id-night.png` (Learning open, nothing else changed, no error). #4 `{not json`: `corrupt-night.png`
    (collapsed rail, no message) and e2e.
  - US3 #1-#2 `restore-paper.png` (Learning and Keys open, C major chosen, *Intermediate* selected with its detail,
    empty score area) and e2e; #3 and #4 e2e (`score-browser-tree.spec.ts`).
  - US4: reviewed in the entry above.
- Handoff: next = T021 (`deep`, needs the owner's model-fit answer), then T022, T023; tree clean at the next commit.

## 2026-10-01 - claude-sonnet-5.5 (implement: T021 audit, T023)
- Model fit: owner chose to continue `deep` tasks with claude-sonnet-5.5 (2026-10-01). The audit was run by the
  `constitution-auditor` agent (a subagent, not myself); I summarise and act on its report.
- T021 constitution audit of `main..018-browser-tree-collapse`: COMPLIANT WITH NOTES, 0 CRITICAL, 0 HIGH, 2 MEDIUM, 6 LOW.
  It ran the browser unit tests (220 passed) and biome; it did not run e2e. No principle violated (I/II untouched,
  V layering clean, VI shape + colour marker, VIII no dependency, IV no weakened test: every adapted test changes setup only).
  - MEDIUM T016 written after the store change: disclosed above (checked with `git stash`); no change.
  - MEDIUM 013 SC-001 "3 actions" holds for a visible folder only: added a note to 013 `spec.md` SC-001 pointing at 018
    SC-004. This is an annotation, not a change of the criterion; **owner: please confirm** the wording.
  - LOW defect: a failed `store.listFiles()` made `loadIndex` pass `files = []`, so a restored *My files* selection looked
    gone and was cleared and saved. Fixed: `indexLoaded`/`indexFailed` take `filesKnown` (default true); `loadIndex`
    passes `filesListed.ok`; unknown clears nothing. New test `open-rules.test.ts` case 6c.
  - LOW rail scrolls on every render while the flag is up and only the list lowers it: comment added naming the
    dependency (the list is always mounted with the rail). LOW inline `'section:'` slicing: `sectionIdOf(key)` added.
    LOW README lacked `--storage`: added. LOW uncommitted edits and log wording: committed with this entry.
- T023: `docs/agents/reference.md` did change (the `--storage` option, the Recent Changes entry); spec.md Status set to
  `Implemented`.

## 2026-10-01 - claude-sonnet-5.5 (implement: final gate T022, session end)
- Final gate on the final commit (after the audit fixes), all exit 0: `pnpm lint` 316 warnings, 13 infos (unchanged from the
  baseline, no errors); `pnpm typecheck` clean; `pnpm test` `Test Files  303 passed (303)`, `Tests  6331 passed (6331)`;
  `pnpm test:e2e` `1236 passed`, `720 skipped`, 0 failed (13.4 min).
- Done: all 26 tasks (T001-T026) ticked with evidence above; spec Status `Implemented`; constitution audit summarised.
- Needs owner: confirm the 013 SC-001 annotation (013 `spec.md`); merging into `main` and pushing are the owner's call (not done).
- Handoff: nothing open on 018; branch `018-browser-tree-collapse` is ready to merge when you ask; tree clean at the next commit.
