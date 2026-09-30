import { WebAudioEngine } from '../engine/audio/web-audio-engine.js';
import { GRADE_WORKER_TIMEOUT_MS, MAX_FILE_BYTES } from '../engine/config.js';
import { hashFile } from '../engine/files/hash.js';
import { HttpLibraryCatalog } from '../engine/library/http-catalog.js';
import { WebMidiInput } from '../engine/midi/web-midi-input.js';
import type {
  AudioEngineEvent,
  EngineSchedule,
  LibraryCatalog,
  MidiAvailability,
  PracticeSettings,
  SettingsStore,
  UserSettings,
} from '../engine/ports.js';
import { IndexedDbPerformanceStore } from '../engine/storage/indexeddb-performance-store.js';
import { LocalSettingsStore } from '../engine/storage/local-settings-store.js';

import '../ui/elements/mx-attempts-list.js';
import '../ui/elements/mx-browser-continue.js';
import '../ui/elements/mx-browser-detail.js';
import '../ui/elements/mx-browser-list.js';
import '../ui/elements/mx-browser-rail.js';
import '../ui/elements/mx-diagnostics.js';
import '../ui/elements/mx-drop-zone.js';
import '../ui/elements/mx-grade-panel.js';
import '../ui/elements/mx-latency-panel.js';
import '../ui/elements/mx-help-notation.js';
import '../ui/elements/mx-menu.js';
import '../ui/elements/mx-open-button.js';
import '../ui/elements/mx-play-panel.js';
import '../ui/elements/mx-score-browser.js';
import '../ui/elements/mx-score-source.js';
import '../ui/elements/mx-score-view.js';
import '../ui/elements/mx-size-controls.js';
import '../ui/elements/mx-status-badge.js';
import '../ui/elements/mx-transport.js';
import '../ui/elements/mx-view-panel.js';
import '../ui/elements/mx-midi-panel.js';
import '../ui/elements/mx-mode-switch.js';
import '../ui/elements/mx-piano-keys.js';
import '../ui/elements/mx-practice-help.js';
import '../ui/elements/mx-practice-panel.js';
import '../ui/elements/mx-run-status.js';
import {
  METRONOME_CHANNEL,
  METRONOME_KEY_BEAT,
  METRONOME_KEY_DOWNBEAT,
  METRONOME_VELOCITY_BEAT,
  METRONOME_VELOCITY_DOWNBEAT,
} from '../core/defaults.js';
import { buildExpectedNotes, buildPlayedAlongSpans } from '../core/grade/expected.js';
import { type GradeMarkSet, gradeMarks } from '../core/grade/marks.js';
import { type SyntheticKind, syntheticLog } from '../core/grade/synthetic.js';
import type { Grade, GradeInput, StoredPerformance } from '../core/grade/types.js';
import { metronomeChannelVolume } from '../core/play/metronome.js';
import { compileReplay } from '../core/play/replay.js';
import type { PlayEffect, RunSettings } from '../core/play/types.js';
import { buildExpectedEvents, firstEventAtOrAfterTick, resolveStartMeasure } from '../core/practice/expected.js';
import { handOptions, partOptions } from '../core/practice/hands.js';
import { loopRangeToPassIndices, passIndicesToLoopRange, resolveLoop } from '../core/practice/loop.js';
import { applyInput, startSession } from '../core/practice/matcher.js';
import type {
  ExpectedEvent,
  HandSelection,
  LoopPassSpan,
  LoopRange,
  PracticeEffect,
  PracticeInput,
  PracticeSession,
  ResolvedLoop,
} from '../core/practice/types.js';
import { resultFromStoredPerformance } from '../core/progress/from-performance.js';
import { practisedBarRange } from '../core/progress/practised-range.js';
import { resultScope, scopeFromStoredSettings } from '../core/progress/scope.js';
import type { ItemRef, ProgressEvent, ProgressResult } from '../core/progress/types.js';
import { fileKey } from '../core/progress/user-files.js';
import { compilePlaySchedule } from '../core/schedule/play-schedule.js';
import type { LoadReport } from '../core/score/load-report.js';
import type { Score } from '../core/score/model.js';
import { audioTimeAtTick } from '../core/tempo/rate.js';
import { displaySegmentIndexAt, type TempoDisplaySegment } from '../core/tempo/tempo-display.js';
import type { PlaybackTimeline, TempoSegment } from '../core/timeline/types.js';
import type { MxOpenButton } from '../ui/elements/mx-open-button.js';
import type { PlaySetupChange } from '../ui/elements/mx-play-panel.js';
import type { PracticeSetupChange } from '../ui/elements/mx-practice-panel.js';
import type { MxScoreView, TimelineDto } from '../ui/elements/mx-score-view.js';
import type { TempoChangeDetail } from '../ui/elements/mx-tempo-field.js';
import type { MxTransport } from '../ui/elements/mx-transport.js';
import { midiNoteName } from '../ui/format/note-name.js';
import { mountPanels, type PanelTools } from '../ui/layout/panel-host.js';
import { createVerovioClient } from '../ui/score/verovio-client.js';
import { initShortcuts } from '../ui/shortcuts.js';
import { browserState } from '../ui/state/browserState.js';
import { midiState } from '../ui/state/midiState.js';
import { mistakeStepper } from '../ui/state/mistake-stepper.js';
import { noticeState } from '../ui/state/noticeState.js';
import { playState } from '../ui/state/playState.js';
import type { HelpOverlay } from '../ui/state/practiceState.js';
import { practiceState } from '../ui/state/practiceState.js';
import { isRunActive } from '../ui/state/runActive.js';
import { guardPanelsDuringRuns } from '../ui/state/runGuard.js';
import type { LoadError, ScoreSummary } from '../ui/state/scoreState.js';
import { scoreState } from '../ui/state/scoreState.js';
import { type TempoBindingPlaySetup, tempoFieldBinding } from '../ui/state/tempoBinding.js';
import { tempoPositionState } from '../ui/state/tempoPositionState.js';
import { transportState } from '../ui/state/transportState.js';
import { type OverlayLayer, viewState } from '../ui/state/viewState.js';
import { requestGrade } from '../workers/grade.worker.js';
import { BrowserSessionController, type LoadBytesOutcome } from './browser-session.js';
import { PlaySessionController } from './play-session.js';
import { ReplaySessionController } from './replay-session.js';

interface ScoreWorkerLoaded {
  type: 'loaded';
  requestId: number;
  summary: ScoreSummary;
  fullScore: Score;
  report: LoadReport;
  renderXml: string;
  timeline: TimelineDto;
  fullTimeline: PlaybackTimeline;
  schedule: EngineSchedule;
  contentHash: string;
}
interface ScoreWorkerFailed {
  type: 'failed';
  requestId: number;
  error: LoadError;
}
type ScoreWorkerResponse = ScoreWorkerLoaded | ScoreWorkerFailed;

function fileRef(fileName: string): ItemRef {
  return { kind: 'file', fileKey: fileKey(fileName) };
}

function requestScoreLoad(
  worker: Worker,
  fileName: string,
  bytes: ArrayBuffer,
  requestId: number,
): Promise<ScoreWorkerResponse> {
  return new Promise((resolve) => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as ScoreWorkerResponse;
      if (data.requestId !== requestId) return; // stale response, ignored
      worker.removeEventListener('message', onMessage);
      resolve(data);
    };
    worker.addEventListener('message', onMessage);
    worker.postMessage({ type: 'load', requestId, fileName, bytes }, [bytes]);
  });
}

/** Wires ports, stores, workers and UI elements together for the open/recent flow (US1). */
export class Session {
  private readonly scoreWorker = new Worker(new URL('../workers/score.worker.ts', import.meta.url), {
    type: 'module',
  });
  private readonly verovioWorker = new Worker(new URL('../workers/verovio.worker.ts', import.meta.url), {
    type: 'module',
  });
  private readonly verovioClient = createVerovioClient(this.verovioWorker);
  private readonly settingsStore: SettingsStore;
  private readonly libraryCatalog: LibraryCatalog;
  private readonly browserController: BrowserSessionController;
  private nextRequestId = 1;
  private scoreView: MxScoreView | null = null;
  private transportEl: MxTransport | null = null;
  private userSettings!: UserSettings; // assigned at the top of start(), before anything reads it

  // Listen mode (US2, T108)
  private readonly audioEngine = new WebAudioEngine();
  private engineUnlocked = false;
  private soundReady = false;
  private currentSchedule: EngineSchedule | null = null;
  private currentTimeline: TimelineDto | null = null;
  private currentPlaybackTimeline: PlaybackTimeline | null = null;
  private currentScore: Score | null = null;
  private scheduleDelivered = false;
  private readonly midiInput = new WebMidiInput();

  // Practice mode (feature 002): what the musician chose for the open Score, remembered per Score id (R-07).
  private practiceScoreId: string | null = null;
  private practiceSettings: PracticeSettings = { selection: null, loop: null, accompaniment: true, help: true };
  private endingPracticeNaturally = false;

  // Play mode settings (US3, T065-T068): stored and loaded per Score.
  private playScoreId: string | null = null;

  // Play mode (003, T107): the only place engine, worker, store and run meet (R-01) - built once, alongside the
  // ports it needs, which are already fields above.
  private readonly gradeWorker = new Worker(new URL('../workers/grade.worker.ts', import.meta.url), {
    type: 'module',
  });
  // T074: kept attempts (FR-041) - shares the `musicanyya` IndexedDB database with the progress store.
  private readonly performanceStore = new IndexedDbPerformanceStore();
  private readonly playController = new PlaySessionController(
    this.audioEngine,
    this.midiInput,
    this.gradeWorker,
    this.performanceStore,
    {
      onEffect: (effect) => this.onPlayEffect(effect),
      onGraded: (grade) => this.onPlayGraded(grade),
      onGradeFailed: (reason, message) => this.onPlayGradeFailed(reason, message),
      onStored: (stored) => this.onPerformanceFinished(stored),
    },
  );
  // T076: a replayed stored attempt (never concurrent with a live `playController` run - starting one stops the
  // other via mode/measure-click handling already in place). Negative, decrementing request ids so a regrade's
  // or a replay's own grading never collides with `playController`'s own (always positive, incrementing) ids on
  // the one shared `gradeWorker`.
  private replayController: ReplaySessionController | null = null;
  private nextRegradeRequestId = -1;

  constructor(
    settingsStore: SettingsStore = new LocalSettingsStore((code) =>
      noticeState.addNotice({ code, severity: 'warning' }),
    ),
    libraryCatalog: LibraryCatalog = new HttpLibraryCatalog(),
  ) {
    if (typeof window !== 'undefined') {
      // e2e-only seam (tests/e2e/*.spec.ts): fakes a granted MIDI device without a real one, and feeds it raw MIDI
      // bytes. `WebMidiInput`'s fields are private by design (nothing else should touch them); this reaches past
      // that on purpose for the test harness rather than adding a real testing API to the port (no `any`: the
      // narrow local type documents exactly what is being poked, nothing more).
      const midiTestSeam = this.midiInput as unknown as {
        grantState: MidiAvailability;
        emit: (event: { type: string; [key: string]: unknown }) => void;
        handleMidiMessage: (deviceId: string, e: { data: number[]; timeStamp: number }) => void;
      };
      window.addEventListener('e2e-ready', () => {
        midiTestSeam.grantState = 'available';
        midiTestSeam.emit({ type: 'availability', availability: 'available' });
        midiTestSeam.emit({
          type: 'devices',
          devices: [{ id: 'fake-midi-1', name: 'Fake', manufacturer: 'Musicanyya', connected: true }],
        });
      });
      window.addEventListener('e2e-midi', (e) => {
        const detail = (e as CustomEvent<number[]>).detail;
        midiTestSeam.handleMidiMessage('fake-midi-1', { data: detail, timeStamp: performance.now() });
      });
      // e2e-only: a Grade of a canned performance ('nothing' | 'correct' | 'semitoneHigh') of the open Score (009 T054)
      window.addEventListener('e2e-synthetic-grade', (e) => {
        void this.onSyntheticGrade((e as CustomEvent<SyntheticKind>).detail);
      });
      // T094, contracts/score-browser.md §8: seeds progress through the ordinary `apply` (never a direct record
      // write), for SC-002/SC-003 measurements and manual checks without playing out a real history first
      // (`--seed-progress` in tools/dev/screenshot.ts, tests/e2e/*.spec.ts). Each seed names a real library id
      // (tests/fixtures/progress/README.md); this resolves it to the index's own content hash itself (never through
      // `browserState`, so it works whether or not the browser has ever opened) and refreshes the browser's own
      // data afterwards, in case FR-001 already opened it with a now-stale snapshot. `browserController` is
      // assigned right after this block; by the time this ever fires, it always is.
      // The detail is the list of seeds, or `{ files, events }` when *My files* entries are seeded too (T086): each
      // file is `{ fileName, text, title, composer }`, stored through the ordinary `putFile` with its real hash.
      window.addEventListener('e2e-progress-seed', (e) => {
        type Seed = { ref: ItemRef; event: ProgressEvent };
        type SeedFile = { fileName: string; text: string; title: string | null; composer: string | null };
        const detail = (e as CustomEvent<readonly Seed[] | { files?: readonly SeedFile[]; events?: readonly Seed[] }>)
          .detail;
        const seeds = 'length' in detail ? detail : (detail.events ?? []);
        const files = 'length' in detail ? [] : (detail.files ?? []);
        void (async () => {
          for (const file of files) {
            const bytes = new TextEncoder().encode(file.text);
            await this.browserController.seedFile({
              fileName: file.fileName,
              bytes: bytes.buffer,
              hash: await hashFile(bytes),
              title: file.title,
              composer: file.composer,
            });
          }
          const indexResult = await this.libraryCatalog.index();
          for (const seed of seeds) {
            const ref = seed.ref;
            if (ref.kind === 'library') {
              const item = indexResult.ok ? indexResult.value.items.find((i) => i.id === ref.id) : undefined;
              if (item) await this.browserController.seedProgressEvent(item.hash, seed.event);
            } else {
              // T066: a file ref resolves through its *My files* entry, which already exists by the time a seed
              // wants to add progress to it (the seed's own fixture opens or `putFile`s it first).
              const hash = await this.browserController.fileHashFor(ref.fileKey);
              if (hash) await this.browserController.seedProgressEvent(hash, seed.event);
            }
          }
          this.browserController.refreshIfOpen();
        })();
      });
    }
    this.settingsStore = settingsStore;
    this.libraryCatalog = libraryCatalog;
    this.browserController = new BrowserSessionController(
      this.libraryCatalog,
      {
        loadBytes: (fileName, bytes, openedAs) => this.loadBytes(fileName, bytes, openedAs),
        removeAttempts: async (scoreKey) => {
          const result = await this.performanceStore.removeByScore(scoreKey);
          if (!result.ok) noticeState.addNotice({ code: 'storageUnavailable', severity: 'warning' });
          if (scoreKey === this.playScoreId) await this.refreshAttempts();
        },
      },
      this.settingsStore,
    );
  }

  async start(): Promise<void> {
    this.userSettings = this.settingsStore.load();
    const settings = this.userSettings;
    viewState.setScale(settings.scale);
    for (const [layer, on] of Object.entries(settings.overlays)) viewState.setOverlay(layer as OverlayLayer, on);
    transportState.applySavedSettings(settings.volume, settings.follow);

    this.scoreView = document.createElement('mx-score-view');
    this.scoreView.client = this.verovioClient;
    // One direction only: the store is the source of the Score size (a control, a shortcut or the stored value all
    // write it), the view follows it, and the store is what gets persisted.
    const scoreView = this.scoreView;
    let persisted = viewState.get();
    viewState.subscribe((state) => {
      scoreView.setZoom(state.scale);
      // Opening a panel changes the store too; only a change to what is persisted writes settings.
      if (state.scale === persisted.scale && state.overlays === persisted.overlays) return;
      persisted = state;
      this.persistUserSettings({ scale: state.scale, overlays: { ...state.overlays } });
    });
    scoreView.setZoom(viewState.get().scale);
    this.scoreView.addEventListener('measureclick', (event: Event) => {
      const { measureIndex } = (event as CustomEvent<{ measureIndex: number }>).detail;
      if (practiceState.get().mode === 'practice') {
        this.onPracticeMeasureClick(measureIndex);
        return;
      }
      // FR-002: the Play clock never waits for input, and seeking would desync PlaySessionController's own
      // tracked position from the audio engine it shares with the Listen transport - so a measure click is a
      // no-op mid-run, same treatment Practice mode already gets above.
      if (practiceState.get().mode === 'play') return;
      const firstPass = this.currentTimeline?.passes.find((p) => p.measureIndex === measureIndex);
      if (firstPass) transportState.seekMeasure(firstPass.startTick);
    });
    const main = document.getElementById('mx-main') as HTMLElement;
    main.prepend(this.scoreView);

    const transport = document.createElement('mx-transport') as MxTransport;
    this.transportEl = transport;
    document.getElementById('transport-controls')?.appendChild(transport);
    tempoPositionState.subscribe(() => this.updateTempoModel());
    transportState.subscribe(() => this.updateTempoModel());
    playState.subscribe(() => this.updateTempoModel());
    transport.addEventListener('tempochange', (event) => {
      const { percent } = (event as CustomEvent<TempoChangeDetail>).detail;
      // Listen and Practice: the transport factor, applied live (FR-013). Play mode edits the Play setup instead
      // (US3, FR-017) - both fields edit the same value, so they can never disagree.
      if (practiceState.get().mode === 'play') {
        this.onPlaySetupChange({ tempoPercent: percent });
        return;
      }
      transportState.setTempo(percent);
    });
    const modeSwitch = document.createElement('mx-mode-switch');
    document.getElementById('mode-controls')?.appendChild(modeSwitch);
    const sizeControls = document.createElement('mx-size-controls');
    document.getElementById('size-controls')?.appendChild(sizeControls);
    document.getElementById('run-status')?.appendChild(document.createElement('mx-run-status'));
    const updateTransportVisibility = () => {
      const loaded = scoreState.getStatus().kind === 'loaded';
      transport.classList.toggle('hidden', !loaded);
      modeSwitch.classList.toggle('hidden', !loaded);
      sizeControls.classList.toggle('hidden', !loaded);
    };
    scoreState.subscribe(updateTransportVisibility);
    updateTransportVisibility();
    transportState.connect({
      play: () => void this.handlePlay(),
      pause: () => this.audioEngine.pause(),
      stop: () => {
        if (practiceState.get().mode === 'play') {
          this.playController.stop(); // stops the audio engine itself (FR-008): a partial Grade, not a second stop
          return;
        }
        this.audioEngine.stop();
        this.onTransportStopped();
      },
      seekTick: (tick) => this.audioEngine.seekTick(tick),
      setTempoPercent: (percent) => this.audioEngine.setTempoPercent(percent),
      setVolume: (volume) => this.audioEngine.setVolume(volume),
    });
    transportState.subscribe((state) => {
      this.persistUserSettings({ volume: state.volume, follow: state.follow });
    });
    this.audioEngine.on((event) => this.onAudioEngineEvent(event));
    let lastMode = practiceState.get().mode;
    practiceState.subscribe((state) => {
      if (state.mode === lastMode) return;
      const previousMode = lastMode;
      lastMode = state.mode;
      if (state.mode === 'listen') this.leavePractice();
      if (previousMode === 'play' && state.mode !== 'play') this.leavePlay();
      this.updateTempoModel(); // Play shows the Play setup's tempo, Listen and Practice the transport's (012 FR-017)
    });
    initShortcuts();
    guardPanelsDuringRuns();

    const openButton = document.createElement('mx-open-button');
    const dropZone = document.createElement('mx-drop-zone');
    openButton.addEventListener('fileopen', (event) =>
      this.openFile((event as CustomEvent<{ file: File }>).detail.file),
    );
    dropZone.addEventListener('fileopen', (event) => this.openFile((event as CustomEvent<{ file: File }>).detail.file));
    // The invitation in the empty Score area asks for the one thing the bar's open button now asks for too: the
    // browser (feature 013, R-20) - `openbrowser` is handled once, below, wherever it comes from.
    dropZone.addEventListener('openrequest', () => (openButton as MxOpenButton).open());
    document.getElementById('open-controls')?.appendChild(openButton);
    main.appendChild(dropZone);

    // mx-open-button and the score menu's *Open...* entry (mx-menu, across its shadow boundary) both ask for the
    // browser this way instead of calling a `viewState` popup (contracts/score-browser.md §5, R-2) - each already
    // remembers its own invoker before dispatching, so this only has to ask the guarded controller.
    document.addEventListener('openbrowser', () => this.browserController.open());

    const scoreBrowser = document.createElement('mx-score-browser');
    main.appendChild(scoreBrowser); // connects it now, so `.browser-body` exists to receive the rail/list/detail
    scoreBrowser
      .querySelector('.browser-body')
      ?.append(
        document.createElement('mx-browser-rail'),
        document.createElement('mx-browser-continue'),
        document.createElement('mx-browser-list'),
        document.createElement('mx-browser-detail'),
      );
    scoreBrowser.addEventListener('browseropenitem', (event) => {
      const { ref } = (event as CustomEvent<{ ref: ItemRef }>).detail;
      void this.browserController.openItem(ref, browserState.get().data.index);
    });
    scoreBrowser.addEventListener('browserretrylibrary', () => this.browserController.retryLibrary());
    // US3: *Open file...* and a drop onto the dialog take the same path as the empty-state drop zone (FR-005) -
    // `openFile` itself decides whether the browser's own message line or the existing load-error view gets a
    // failure, based on whether the browser was the one open.
    scoreBrowser.addEventListener('browseropenfile', (event) => {
      void this.openFile((event as CustomEvent<{ file: File }>).detail.file);
    });
    // OD-3, US3 #4: "keep progress" removes only the entry/copy; "remove and progress" also resets every hash it
    // shares progress with (its own current hash plus every earlier version) and deletes their Performances.
    scoreBrowser.addEventListener('browserremovefile', (event) => {
      const { fileKey, keepProgress } = (event as CustomEvent<{ fileKey: string; keepProgress: boolean }>).detail;
      const entry = browserState.get().data.files.find((f) => f.fileKey === fileKey);
      if (!entry) return;
      this.browserController.startRemoveFile(fileKey, entry.title ?? entry.fileName, keepProgress, [
        entry.hash,
        ...entry.earlierHashes,
      ]);
    });
    // OD-3/T057: every hash the item shares progress with (a library item's `supersedes[].hash`, a *My files*
    // entry's `earlierHashes`) resets together, since the library/entry itself already treats them as one item.
    scoreBrowser.addEventListener('browserresetprogress', (event) => {
      const { ref } = (event as CustomEvent<{ ref: ItemRef }>).detail;
      const { data } = browserState.get();
      const hashes =
        ref.kind === 'library'
          ? (() => {
              const item = data.index?.items.find((i) => i.id === ref.id);
              return item ? [item.hash, ...(item.meta.supersedes ?? []).map((s) => s.hash)] : [];
            })()
          : (() => {
              const entry = data.files.find((f) => f.fileKey === ref.fileKey);
              return entry ? [entry.hash, ...entry.earlierHashes] : [];
            })();
      if (hashes.length > 0) this.browserController.startResetProgress(ref, hashes);
    });
    // On `document`, not `scoreBrowser`: the toast (`mx-notice-tray`'s own Undo button, R-12) is not inside the
    // browser dialog, but its event still bubbles all the way up.
    document.addEventListener('browserundoreset', () => this.browserController.cancelResetProgress());
    document.addEventListener('browserundoremovefile', () => this.browserController.cancelRemoveFile());

    const menuControls = document.getElementById('menu-controls');
    // 'more' is the four folded into one; the bar shows it instead of them when it runs out of width (mx-app)
    for (const menu of ['score', 'setup', 'view', 'help', 'more']) {
      const element = document.createElement('mx-menu');
      element.setAttribute('menu', menu);
      menuControls?.appendChild(element);
    }

    // "About this score" (R-20): the old shelf and its lazy index fetch are gone - the browser (above) owns the
    // index fetch now, on open. *My files* (T068) replaces the old recent-scores list as the reopen/remove flow.
    const scoreSource = document.createElement('mx-score-source');

    const helpPanel = document.createElement('mx-help-notation');

    const diagnosticsPanel = document.createElement('mx-diagnostics');
    diagnosticsPanel.setEngine(this.audioEngine);

    // MIDI Wire-up
    const midiPanel = document.createElement('mx-midi-panel');

    const practicePanel = document.createElement('mx-practice-panel');
    practicePanel.addEventListener('practicesetup', (event) =>
      this.onPracticeSetupChange((event as CustomEvent<PracticeSetupChange>).detail),
    );
    practicePanel.addEventListener('requesthelp', () => {
      this.applyPracticeInput({ type: 'requestHelp', timeStampMs: performance.now() });
    });

    const playPanel = document.createElement('mx-play-panel');
    playPanel.addEventListener('playsetup', (event) =>
      this.onPlaySetupChange((event as CustomEvent<PlaySetupChange>).detail),
    );

    const gradePanel = document.createElement('mx-grade-panel');
    gradePanel.addEventListener('practisepass', (event) => {
      const passIndex = (event as CustomEvent<{ passIndex: number }>).detail.passIndex;
      if (!this.currentTimeline) return;
      const loop = passIndicesToLoopRange(this.currentTimeline.passes, {
        fromPassIndex: passIndex,
        toPassIndex: passIndex,
      });
      if (!loop) return;

      const grade = playState.get().grade;
      if (grade) {
        this.onPracticeSetupChange({
          loop,
          selection: grade.settings.selection,
          accompaniment: grade.settings.accompaniment,
        });
      }
      practiceState.setMode('practice');
    });

    const attemptsList = document.createElement('mx-attempts-list');
    attemptsList.addEventListener('attemptreplay', (event) =>
      this.onAttemptReplay((event as CustomEvent<{ runId: string }>).detail.runId),
    );
    attemptsList.addEventListener('attemptregrade', (event) =>
      this.onAttemptRegrade((event as CustomEvent<{ runId: string }>).detail.runId),
    );
    attemptsList.addEventListener('attemptdelete', (event) =>
      this.onAttemptDelete((event as CustomEvent<{ runId: string }>).detail.runId),
    );

    const latencyPanel = document.createElement('mx-latency-panel');
    latencyPanel.addEventListener('latencycalibrated', (event) => {
      const profile = (event as CustomEvent).detail.profile;
      this.settingsStore.saveLatencyProfile(profile);
    });

    // Every secondary tool is a popup over the Score, opened from a menu (contracts/ui-shell.md section 3).
    const environmentPanel = document.querySelector('mx-environment-panel') as HTMLElement;
    const tools: PanelTools = {
      scores: [scoreSource],
      attempts: [attemptsList],
      setup: [practicePanel, playPanel],
      midi: [midiPanel],
      latency: [latencyPanel],
      view: [document.createElement('mx-view-panel')],
      help: [helpPanel],
      diagnostics: [diagnosticsPanel],
      environment: [environmentPanel],
      grade: [gradePanel],
    };
    mountPanels(document.getElementById('panel-host') as HTMLElement, tools);

    // The on-screen piano keys are off until the user switches them on (FR-015); the element follows its layer itself.
    main.appendChild(document.createElement('mx-piano-keys'));

    const practiceHelp = document.createElement('mx-practice-help');
    main.appendChild(practiceHelp);

    midiPanel.addEventListener('request-midi', async () => {
      await this.midiInput.request();
    });

    this.midiInput.on((e) => {
      if (e.type === 'availability') {
        midiState.availability = e.availability;
        midiState.emit();
      } else if (e.type === 'devices') {
        midiState.devices = [...e.devices];
        midiState.emit();
      } else if (e.type === 'deviceLost') {
        this.audioEngine.liveAllOff();
        e.heldKeys.forEach((k) => {
          midiState.pressedKeys.delete(k);
        });
        midiState.emit();
        this.applyPracticeInput({ type: 'deviceLost', timeStampMs: performance.now(), heldKeys: e.heldKeys });
        noticeState.addNotice({ code: 'midiDeviceLost', severity: 'warning' });
      } else if (e.type === 'noteOn') {
        // The musician's own sound goes first: the re-renders that state changes trigger must never delay it.
        // In Play mode PlaySessionController's own `soundInput` effect already sounds it (FR-006) - sounding it
        // here too would trigger the same key twice.
        if (practiceState.get().mode !== 'play') this.audioEngine.liveNoteOn(e.key, e.velocity);
        midiState.pressedKeys.add(e.key);
        midiState.emit();
        this.applyPracticeInput({ type: 'noteOn', key: e.key, velocity: e.velocity, timeStampMs: e.timeStampMs });
      } else if (e.type === 'noteOff') {
        if (practiceState.get().mode !== 'play') this.audioEngine.liveNoteOff(e.key);
        midiState.pressedKeys.delete(e.key);
        midiState.emit();
        this.applyPracticeInput({ type: 'noteOff', key: e.key, timeStampMs: e.timeStampMs });
      } else if (e.type === 'sustain') {
        if (practiceState.get().mode !== 'play') this.audioEngine.liveSustain(e.down);
        midiState.sustainDown = e.down;
        midiState.emit();
        this.applyPracticeInput({ type: 'sustain', down: e.down, timeStampMs: e.timeStampMs });
      }
    });

    const transportEl = document.querySelector('mx-transport');
    if (transportEl) {
      transportEl.addEventListener('skipforward', () => {
        this.applyPracticeInput({ type: 'skipNext', timeStampMs: performance.now() });
      });
      transportEl.addEventListener('skipback', () => {
        this.applyPracticeInput({ type: 'skipPrevious', timeStampMs: performance.now() });
      });
    }

    setInterval(() => {
      if (this.engineUnlocked) {
        const lat = this.audioEngine.latency();
        if (lat.outputLatencyMs !== midiState.latencyMs) {
          midiState.latencyMs = lat.outputLatencyMs !== null ? Math.round(lat.outputLatencyMs) : null;
          midiState.emit();
        }
      }
    }, 1000);

    // FR-001: the browser is where a Score is found now - with none loaded, it opens once at start-up. The
    // drop-zone invitation stays behind it for when the browser is closed.
    if (scoreState.getStatus().kind === 'empty') this.browserController.open();
  }

  /** The user's settings live in memory here, so two changes inside the store's write debounce cannot overwrite each
   *  other (reading them back from storage would return the value from before the first change). */
  private persistUserSettings(patch: Partial<UserSettings>): void {
    this.userSettings = { ...this.userSettings, ...patch };
    this.settingsStore.save(this.userSettings);
  }

  /** The tempo field's model (contracts/tempo-field.md): the display segment at tempoPositionState's index, the
   *  transport's own factor, never locked in Listen/Practice (Play's binding is T038/US3), and the glyphs harvested
   *  once at the first Score load. Called whenever any of those inputs change, and once after a Score loads.
   *  `mx-score-view` only publishes tempoPositionState once it has playback attached (after the first unlock, a
   *  user gesture) - before that (a freshly opened Score, or a measure click before ever pressing Play), this
   *  falls back to the transport's own `startTick` (data-model.md section 5's Listen rest position), which is
   *  exactly what audiblePosition() would report once attached anyway. */
  private updateTempoModel(): void {
    const tempo = this.currentTimeline?.tempo ?? [];
    const index = tempoPositionState.get() ?? displaySegmentIndexAt(tempo, transportState.get().startTick);
    const transportSegment = tempo[index] ?? null;

    // Play mode (US3): the range-start segment session.ts already keeps on the setup, except while a run is
    // actually counting in or running, when the live cursor's own segment (tempoPositionState, published by
    // mx-score-view's Play branch) takes over - the same segment the run's own tempo is measured against.
    const setup = playState.get().setup;
    const run = playState.get().run;
    const running = run !== null && (run.phase === 'countIn' || run.phase === 'running');
    const liveIndex = running ? tempoPositionState.get() : null;
    const playSetupBinding: TempoBindingPlaySetup | null = setup
      ? {
          segment: liveIndex !== null ? (tempo[liveIndex] ?? setup.tempoSegment) : setup.tempoSegment,
          tempoPercent: setup.settings.tempoPercent,
        }
      : null;

    const binding = tempoFieldBinding(
      practiceState.get().mode,
      { segment: transportSegment, percent: transportState.get().tempoPercent },
      playSetupBinding,
      run ? { phase: run.phase } : null,
    );
    this.transportEl?.setTempoModel({ ...binding, glyphs: this.scoreView?.harvestedGlyphs ?? null });
  }

  /** Unlock (user gesture), deliver the schedule if this is the first Play since it was loaded, ensure the
   * SoundFont is loaded (progress shown via `onAudioEngineEvent`'s 'loadingSound' state), then play. */
  private async handlePlay(): Promise<void> {
    // The one place a Listen, Practice or Play run starts: nothing may be open over the Score during one (FR-006).
    viewState.closeForRun();
    await this.audioEngine.unlock();
    this.engineUnlocked = true;

    if (!this.soundReady) {
      try {
        await this.audioEngine.ensureSoundLoaded();
        this.soundReady = true;
        transportState.setSoundReady(true);
      } catch {
        transportState.setSoundFailed();
        noticeState.addNotice({ code: 'soundFontMissing', severity: 'warning' });
        return;
      }
    }

    if (practiceState.get().mode === 'play') {
      this.startPlay();
      return;
    }

    // Listen and Practice play at the transport's own tempo: a Play run or a replay leaves the engine at its own
    // (012 FR-018).
    this.audioEngine.setTempoPercent(transportState.get().tempoPercent);

    if (practiceState.get().mode === 'practice') {
      this.startPractice();
      return;
    }

    if (this.currentSchedule && !this.scheduleDelivered) {
      // A copy: `load` transfers the arrays, and Listen reloads this schedule after every Play run or replay.
      this.audioEngine.load(structuredClone(this.currentSchedule));
      this.scheduleDelivered = true;
      const seekTick = transportState.get().positionTick;
      if (seekTick > 0) this.audioEngine.seekTick(seekTick);
      if (this.scoreView && this.currentTimeline) this.scoreView.setPlayback(this.audioEngine, this.currentTimeline);
    }

    this.audioEngine.play();
  }

  private onAudioEngineEvent(event: AudioEngineEvent): void {
    if (event.type === 'ended') {
      transportState.ended();
    } else if (event.type === 'state') {
      if (event.state.kind === 'loadingSound') {
        transportState.setLoadingProgress(event.state.loadedBytes, event.state.totalBytes);
      } else if (event.state.kind === 'suspended') {
        transportState.pause();
        if (event.state.reason === 'deviceChanged') {
          noticeState.addNotice({ code: 'audioDeviceChanged', severity: 'warning' });
        }
      } else if (event.state.kind === 'error' && event.state.code === 'workletLoadFailed') {
        noticeState.addNotice({ code: 'workletLoadFailed', severity: 'warning' });
      } else if (event.state.kind === 'error' && event.state.code === 'processorFaulted') {
        // T161: the processor caught its own throw and has gone quiet for the rest of the session (no more
        // position/ended messages will follow) - reflect that in the transport so Pause doesn't sit there lying.
        transportState.pause();
        noticeState.addNotice({ code: 'processorFaulted', severity: 'warning' });
      }
    }
  }

  /** Starts a session for the current selection, at the measure the musician picked or at the beginning (FR-015). */
  private startPractice(): void {
    const { setup, startMeasureIndex } = practiceState.get();
    const events =
      this.currentScore && this.currentPlaybackTimeline && setup?.selection
        ? buildExpectedEvents(this.currentScore, this.currentPlaybackTimeline, setup.selection)
        : [];
    if (!setup?.selection || events.length === 0) {
      noticeState.addNotice({ code: 'practiceNothingToPlay', severity: 'warning' });
      this.endingPracticeNaturally = true;
      transportState.stop();
      this.endingPracticeNaturally = false;
      return;
    }
    if (startMeasureIndex !== null) {
      const start = resolveStartMeasure(events, startMeasureIndex, 0) ?? 0;
      this.beginPractice(events, setup.selection, start, this.resolveLoopFor(events, start));
      return;
    }
    // With a loop set and no measure picked the musician means to practise the loop: begin at its first event, in
    // the occurrence that was stored with it (R-06).
    const stored = this.practiceSettings.loop;
    const anchor = stored
      ? Math.max(
          events.findIndex((event) => event.passIndex >= stored.fromPassIndex),
          0,
        )
      : 0;
    const loop = this.resolveLoopFor(events, anchor);
    this.beginPractice(events, setup.selection, loop ? loop.fromEventIndex : 0, loop);
  }

  /** The stored loop resolved against `events` for a cursor position, or null with a notice when nothing in it can
   *  be played by the practised hand (R-06); no stored loop, or one that no longer fits the Score, gives null. */
  private resolveLoopFor(events: readonly ExpectedEvent[], cursorEventIndex: number): ResolvedLoop | null {
    const passes = this.currentPlaybackTimeline?.passes ?? [];
    const stored = this.practiceSettings.loop;
    const range = stored ? passIndicesToLoopRange(passes, stored) : null;
    if (!range) return null;
    const loop = resolveLoop(events, passes, range, cursorEventIndex);
    if (!loop) noticeState.addNotice({ code: 'practiceLoopEmpty', severity: 'warning' });
    return loop;
  }

  /** A fresh session over `events` from `startEventIndex`: the previous marks are cleared (FR-019) and whatever the
   * previous session left ringing is released. */
  private beginPractice(
    events: readonly ExpectedEvent[],
    selection: HandSelection,
    startEventIndex: number,
    loop: ResolvedLoop | null,
  ): void {
    this.releasePracticeSound(practiceState.get().session);
    const session = startSession({
      scoreId: this.practiceScoreId,
      selection,
      events,
      startEventIndex,
      loop,
      accompaniment: practiceState.get().setup?.accompaniment ?? true,
      help: this.practiceSettings.help,
    });
    practiceState.setSession(session);
    practiceState.clearAllKeyFeedback();
    practiceState.clearHelpOverlay();
    const first = events[startEventIndex];
    if (first) transportState.setPositionTick(first.onsetTick);
  }

  private isPracticeRunning(session: PracticeSession | null): session is PracticeSession {
    return (
      session !== null &&
      (session.phase === 'waiting' || session.phase === 'blocked' || session.phase === 'interrupted')
    );
  }

  /** Silences the accompaniment notes a session left ringing; the musician's own keys are not touched. */
  private releasePracticeSound(session: PracticeSession | null): void {
    if (!session) return;
    for (const key of session.soundingAccompaniment.keys()) this.audioEngine.liveNoteOff(key);
  }

  /** The Stop button (or anything else that stops the transport) ends the session and leaves its marks on screen
   * (FR-018); reaching the end on its own is left alone so the last accompaniment notes can ring (R-12). */
  private onTransportStopped(): void {
    if (practiceState.get().mode !== 'practice' || this.endingPracticeNaturally) return;
    // The help and the wrong-key feedback are live views of a session that is over; the Score's marks stay (FR-018)
    practiceState.clearHelpOverlay();
    practiceState.clearAllKeyFeedback();
    const session = practiceState.get().session;
    if (!session || (session.phase === 'finished' && session.soundingAccompaniment.size === 0)) return;
    this.releasePracticeSound(session);
    practiceState.setSession({
      ...session,
      phase: 'finished',
      soundingAccompaniment: new Map(),
      heldWrongKeys: new Map(), // the session is over: no red disc stays on the Score
    });
  }

  /** Switching to Listen ends the session and clears its marks (FR-019). */
  private leavePractice(): void {
    this.resetPractice();
    transportState.stop();
  }

  /** Drops the session and the picked start measure, releasing whatever the session left ringing. */
  private resetPractice(): void {
    this.releasePracticeSound(practiceState.get().session);
    practiceState.setSession(null);
    practiceState.setStartMeasure(null);
    practiceState.clearAllKeyFeedback();
    practiceState.clearHelpOverlay();
  }

  /** Resolves a written measure range to a pass span, using the first occurrence that has expected notes - shared
   *  by a live run (`startPlay`) and a stored one (`buildStoredRunContext`, T076), since one `RunSettings.range`
   *  feeds both. */
  private resolveRunRange(score: Score, timeline: PlaybackTimeline, settings: RunSettings): LoopPassSpan | null {
    if (!settings.range) return null;
    const events = buildExpectedEvents(score, timeline, settings.selection);
    const loop = resolveLoop(events, timeline.passes, settings.range, 0);
    if (!loop) return null;
    // `loopRangeToPassIndices` returns `ResolvedLoop`'s inclusive `toPassIndex` (src/core/practice/loop.ts);
    // `buildExpectedNotes` and `compilePlaySchedule` both require the exclusive form (contracts/play-run.md
    // "range.toPassIndex is exclusive"). Found while testing T069: a single-measure range (fromPassIndex ===
    // toPassIndex) silently graded nothing at all without this conversion.
    const inclusive = loopRangeToPassIndices(loop);
    return { fromPassIndex: inclusive.fromPassIndex, toPassIndex: inclusive.toPassIndex + 1 };
  }

  /** Compiles a run from the stored settings (or defaults) and starts it (T065/T066, FR-036 to FR-039). */
  private startPlay(): void {
    if (!this.currentScore || !this.currentPlaybackTimeline) return;
    const phase = this.playController.getRun()?.phase;
    if (phase === 'countIn' || phase === 'running') return;

    const setup = playState.get().setup;
    if (!setup) return;

    const settings = setup.settings;
    const range = this.resolveRunRange(this.currentScore, this.currentPlaybackTimeline, settings);

    const expected = buildExpectedNotes(this.currentScore, this.currentPlaybackTimeline, settings.selection, range);
    if (expected.length === 0) {
      noticeState.addNotice({ code: 'playNothingToGrade', severity: 'warning' });
      transportState.stop();
      return;
    }

    playState.clear();
    mistakeStepper.setMarks(null);
    this.scheduleDelivered = false; // the run's own schedule replaces Listen's in the engine
    this.playController.start({
      scoreId: this.playScoreId,
      score: this.currentScore,
      timeline: this.currentPlaybackTimeline,
      measures: this.currentScore.measures,
      range,
      settings,
    });
    playState.setRun(
      this.playController.getRun(),
      expected.map((note) => ({ key: note.key, onsetTick: note.onsetTick })),
    );
    this.scoreView?.setPlaySession(this.playController);
    if (this.scoreView && this.currentTimeline) this.scoreView.setPlayback(this.audioEngine, this.currentTimeline);
  }

  /** Switching away from Play stops a run still in progress and clears its marks (FR-035: "cleared when a new run
   *  starts OR the mode changes" - found by manual testing that this file's own earlier draft only handled the
   *  first half and left a finished Grade on screen after switching to Listen). */
  private leavePlay(): void {
    const phase = this.playController.getRun()?.phase;
    if (phase === 'countIn' || phase === 'running') this.playController.stop();
    playState.clear();
    mistakeStepper.setMarks(null);
    this.scoreView?.setPlaySession(null);
  }

  private onPlayEffect(effect: PlayEffect): void {
    if (effect.type === 'notice') {
      noticeState.addNotice({ code: effect.code, severity: 'warning' });
    }
  }

  /** Handles a change from `mx-play-panel`: updates state, saves settings, and adjusts a live run if needed. */
  private onPlaySetupChange(change: PlaySetupChange): void {
    const setup = playState.get().setup;
    const score = this.currentScore;
    if (!setup || !score) return;

    let { settings } = setup;
    if (change.partIndex !== undefined && change.partIndex !== settings.selection.partIndex) {
      const newHands = handOptions(score, change.partIndex);
      settings = { ...settings, selection: newHands[0] ?? settings.selection };
      playState.setSetup({
        ...setup,
        hands: newHands,
        settings,
        tempoSegment: this.playRangeStartSegment(settings.range),
      });
    } else {
      if (change.selection) settings = { ...settings, selection: change.selection };
      if (change.range !== undefined) settings = { ...settings, range: change.range };
      if (change.tempoPercent !== undefined) settings = { ...settings, tempoPercent: change.tempoPercent };
      if (change.strictness !== undefined) settings = { ...settings, strictness: change.strictness };
      if (change.countInMeasures !== undefined) settings = { ...settings, countInMeasures: change.countInMeasures };
      if (change.metronomeMuted !== undefined) settings = { ...settings, metronomeMuted: change.metronomeMuted };
      if (change.accompaniment !== undefined) settings = { ...settings, accompaniment: change.accompaniment };
      playState.setSetup({ ...setup, settings, tempoSegment: this.playRangeStartSegment(settings.range) });
    }

    this.settingsStore.savePlay(this.playScoreId, settings);

    // Metronome mute can be applied live (T067): never by recompiling the schedule (R-02).
    const run = this.playController.getRun();
    if (change.metronomeMuted !== undefined && run && (run.phase === 'countIn' || run.phase === 'running')) {
      this.audioEngine.setChannelVolume(METRONOME_CHANNEL, metronomeChannelVolume(change.metronomeMuted));
    }
  }

  /**
   * Puts a Grade on the Score: the mark set is worked out once here (the core knows the Score and the run's passes) and kept
   * in `playState` beside it, for the view, the panel and the mistake stepper alike (009 R-06, FR-023).
   */
  private showGrade(grade: Grade, newBest = false): void {
    const score = this.currentScore;
    const timeline = this.currentPlaybackTimeline;
    let marks: GradeMarkSet | null = null;
    if (score && timeline) {
      const range = this.resolveRunRange(score, timeline, grade.settings);
      const passes = range ? timeline.passes.slice(range.fromPassIndex, range.toPassIndex) : timeline.passes;
      marks = gradeMarks(score, grade, passes);
    }
    playState.setGrade(grade, marks, newBest);
    mistakeStepper.setMarks(marks);
  }

  /** R-7: the live scope of a run over the currently loaded Score - the legacy rule (R-6) only for the rare case
   *  of grading with no Score loaded (should not happen for a live run, kept for defensiveness). */
  private liveResultScope(settings: RunSettings) {
    return this.currentScore ? resultScope(this.currentScore, settings) : scopeFromStoredSettings(settings);
  }

  /** R-18 "New best": the Grade's own figures, as a `ProgressResult` - built before the run is stored, so
   *  `computeNewBest` can compare it against the in-memory record synchronously. `finishedAt` here is only ever
   *  used for a same-instant tie-break; the persisted `played` event later carries the stored run's own time. */
  private progressResultFromGrade(grade: Grade): ProgressResult {
    return {
      runId: grade.runId,
      finishedAt: new Date().toISOString(),
      notesCorrect: grade.summary.notesCorrect,
      notesOnTime: grade.summary.notesOnTime,
      extra: grade.summary.counts.extra,
      tempoPercent: grade.settings.tempoPercent,
      strictness: grade.settings.strictness,
      complete: grade.complete,
      scope: this.liveResultScope(grade.settings),
    };
  }

  /**
   * The `e2e-synthetic-grade` test seam (contract play-display.md section 3): grades a canned performance of the open Score's
   * expected notes through the normal grade worker and shows it, so an e2e test gets a Grade without playing a whole run.
   */
  private async onSyntheticGrade(kind: SyntheticKind): Promise<void> {
    const setup = playState.get().setup;
    if (!setup || !this.currentScore || !this.currentPlaybackTimeline) return;
    const perf: StoredPerformance = {
      runId: 'e2e-synthetic',
      scoreId: this.playScoreId ?? 'e2e',
      finishedAt: new Date(0).toISOString(),
      settings: setup.settings,
      latency: this.audioEngine.latencyProfile(),
      appVersion: 'e2e',
      log: { version: 1, messages: [], droppedMessages: 0 },
      summary: {
        notesCorrect: { count: 0, total: 0 },
        notesOnTime: { count: 0, total: 0 },
        counts: { correct: 0, wrongPitch: 0, missed: 0, extra: 0, early: 0, late: 0 },
        meanAsynchronyMs: null,
        timingNotResolvable: false,
      },
      schema: 1,
    };
    const prepared = this.prepareStoredRun(perf);
    if (!prepared) return;
    const { context } = prepared;
    const log = syntheticLog(context.expected, kind, (tick) =>
      audioTimeAtTick(
        tick - context.tickMap.rangeStartTick + context.tickMap.countInTicks,
        context.tempo,
        context.ppq,
        setup.settings.tempoPercent,
      ),
    );
    const result = await requestGrade(
      this.gradeWorker,
      { ...context, log },
      this.nextRegradeRequestId--,
      GRADE_WORKER_TIMEOUT_MS,
    );
    if (result.ok) this.showGrade(result.grade);
  }

  private onPlayGraded(grade: Grade): void {
    const newBest =
      this.playScoreId !== null &&
      this.browserController.computeNewBest(this.playScoreId, this.progressResultFromGrade(grade));
    this.showGrade(grade, newBest);
    // The Grade arrives over the Score in a dismissible popup; dismissing it leaves the marks on the notes (FR-009). It
    // can arrive late (grading has its own timeout): never over a run that has started since.
    if (!isRunActive()) viewState.openPanel('grade');
  }

  /** R-18: after a Play run has finished and its storage has settled. The result is recorded whether or not the
   *  attempt could be kept (owner decision 2026-09-28, T095), so progress works with no IndexedDB; only a run
   *  without a Score identity (`stored === null`) records nothing. */
  private onPerformanceFinished(stored: StoredPerformance | null): void {
    void this.refreshAttempts();
    if (stored === null) return;
    const result = resultFromStoredPerformance(stored, this.liveResultScope(stored.settings));
    void this.browserController.played(stored.scoreId, result);
  }

  private onPlayGradeFailed(reason: 'timeout' | 'error', _message?: string): void {
    noticeState.addNotice({ code: reason === 'timeout' ? 'playGradeTimeout' : 'playGradeError', severity: 'warning' });
  }

  /** Picks the part and hands offered for a Score, and the choices remembered for it (R-07). */
  private setupPractice(score: Score): void {
    this.resetPractice();
    const { parts, preselected } = partOptions(score);
    this.practiceSettings = this.settingsStore.loadPractice(this.practiceScoreId);
    const selection = this.resolvePracticeSelection(score, parts, preselected, this.practiceSettings.selection);
    const stored = this.practiceSettings.loop;
    practiceState.setSetup({
      parts,
      hands: selection ? handOptions(score, selection.partIndex) : [],
      selection,
      accompaniment: this.practiceSettings.accompaniment,
      help: this.practiceSettings.help,
      measureCount: score.measures.length,
      // A stored loop that no longer fits this Score is not shown; it is not an error (contracts/practice-settings.md).
      loop: stored ? passIndicesToLoopRange(this.currentPlaybackTimeline?.passes ?? [], stored) : null,
    });
  }

  /** A remembered selection is used only if it still fits the Score; otherwise the preselected part, all staves. */
  private resolvePracticeSelection(
    score: Score,
    parts: readonly { partIndex: number; staves: number }[],
    preselected: number,
    stored: HandSelection | null,
  ): HandSelection | null {
    if (parts.length === 0) return null;
    const part = stored ? parts.find((p) => p.partIndex === stored.partIndex) : undefined;
    if (stored && part) {
      const key = stored.staves.join(',');
      const offered = handOptions(score, stored.partIndex).find((option) => option.staves.join(',') === key);
      if (offered) return offered;
      if (stored.staves.every((staff) => staff <= part.staves)) return { ...stored, preset: 'custom' };
    }
    return handOptions(score, preselected)[0] ?? null;
  }

  /** Loads stored play settings for the Score and sets up the PlaySetup state (T065/T066/T068). */
  private setupPlay(score: Score): void {
    playState.clear();
    mistakeStepper.setMarks(null);
    // feature 012, US3: the attempts list and the Grade panel compute their own tempo text (attemptTempo) from
    // this, given fresh whenever a Score loads. `passes` needs the full core shape (attemptTempo's contract),
    // not the compact TimelineDto one `this.currentTimeline` carries.
    playState.setScoreTempo({
      map: this.currentTimeline?.tempo ?? [],
      passes: this.currentPlaybackTimeline?.passes ?? [],
    });
    const { parts, preselected } = partOptions(score);
    const storedSettings = this.settingsStore.loadPlay(this.playScoreId);
    // Validate the stored selection still fits the Score.
    const validatedSettings = this.resolvePlaySettings(score, parts, preselected, storedSettings);
    const hands = validatedSettings.selection ? handOptions(score, validatedSettings.selection.partIndex) : [];
    playState.setSetup({
      parts,
      hands,
      measureCount: score.measures.length,
      settings: validatedSettings,
      tempoSegment: this.playRangeStartSegment(validatedSettings.range),
      glyphs: this.scoreView?.harvestedGlyphs ?? null,
    });
    void this.refreshAttempts();
  }

  /** feature 012, US3, FR-018: the display segment at the run range's start (first pass of its first measure,
   *  else tick 0) - data-model.md section 5's "Play, no run" reference position, what the Play setup's own tempo
   *  field shows and edits before/after a run. */
  private playRangeStartSegment(range: LoopRange | null): TempoDisplaySegment | null {
    const tempo = this.currentTimeline?.tempo ?? [];
    const measureIndex = range ? Math.min(range.fromMeasureIndex, range.toMeasureIndex) : 0;
    const pass = this.currentTimeline?.passes.find((p) => p.measureIndex === measureIndex);
    return tempo[displaySegmentIndexAt(tempo, pass?.startTick ?? 0)] ?? null;
  }

  /** US4, T076: the kept attempts for the open Score, newest first - empty (and no store call) for a Score that
   *  was never itself stored (`playScoreId === null`, feature 001), since there is nothing to key an attempt by. */
  private async refreshAttempts(): Promise<void> {
    const scoreId = this.playScoreId;
    if (scoreId === null) {
      playState.setAttempts([]);
      return;
    }
    const result = await this.performanceStore.listByScore(scoreId);
    playState.setAttempts(result.ok ? result.value : []);
  }

  /** Everything a stored performance's own settings determine about the current Score, recomputed fresh rather
   *  than stored (research R-20 covers why `startAudioTimeSec` alone is normalised away; `expected`,
   *  `playedAlong`, the accompaniment schedule and the tick map are the same story: nothing here outlives the
   *  Score they were computed from). Shared by regrade and replay (T076), since both need it identically. */
  private prepareStoredRun(
    perf: StoredPerformance,
  ): { context: GradeInput; accompaniment: ReturnType<typeof compilePlaySchedule>['schedule'] } | null {
    const score = this.currentScore;
    const timeline = this.currentPlaybackTimeline;
    if (!score || !timeline) return null;

    const range = this.resolveRunRange(score, timeline, perf.settings);
    const expected = buildExpectedNotes(score, timeline, perf.settings.selection, range);
    const playedAlong = buildPlayedAlongSpans(score, timeline, perf.settings.selection, range);
    const gradedNoteIds = new Set(expected.flatMap((note) => note.noteIds));
    const { schedule: accompaniment, tickMap } = compilePlaySchedule(timeline, score.measures, {
      range,
      gradedNoteIds,
      accompaniment: perf.settings.accompaniment,
      countInMeasures: perf.settings.countInMeasures,
      tempoPercent: perf.settings.tempoPercent,
      metronome: {
        beatKey: METRONOME_KEY_BEAT,
        downbeatKey: METRONOME_KEY_DOWNBEAT,
        beatVelocity: METRONOME_VELOCITY_BEAT,
        downbeatVelocity: METRONOME_VELOCITY_DOWNBEAT,
      },
    });
    // The run's own tempo map, in run-tick space (0 = count-in start) - contracts/grading.md step 1, the same
    // reconstruction `PlaySessionController.start` does for a live run.
    const runTempo: TempoSegment[] = Array.from(accompaniment.tempoTick, (_, i) => ({
      startTick: accompaniment.tempoTick[i] as number,
      qpmNum: accompaniment.tempoQpmNum[i] as number,
      qpmDen: accompaniment.tempoQpmDen[i] as number,
    }));

    const context: GradeInput = {
      runId: perf.runId,
      complete: true,
      expected,
      playedAlong,
      log: perf.log,
      tempo: runTempo,
      timelineTempo: timeline.tempo,
      ppq: timeline.ppq,
      tickMap,
      startAudioTimeSec: 0, // research R-20: a stored log is already run-relative
      settings: perf.settings,
      latency: perf.latency,
      reliability: [],
      passes: timeline.passes,
      measures: score.measures,
    };
    return { context, accompaniment };
  }

  /** FR-027, AS-4.4: re-grades a stored attempt at the timing strictness currently chosen in the Play settings
   *  panel - every other stored setting (range, tempo, hands, ...) is kept exactly as the attempt was run, since
   *  changing them would change which notes were expected, not just how they are judged. Never writes back to
   *  the store (SC-011). */
  private async onAttemptRegrade(runId: string): Promise<void> {
    const stored = await this.performanceStore.get(runId);
    if (!stored.ok) {
      noticeState.addNotice({
        code: stored.error === 'notFound' ? 'storageEntryMissing' : 'storageUnavailable',
        severity: 'warning',
      });
      return;
    }
    const prepared = this.prepareStoredRun(stored.value);
    if (!prepared) return;

    const strictness = playState.get().setup?.settings.strictness ?? stored.value.settings.strictness;
    const input: GradeInput = {
      ...prepared.context,
      settings: { ...prepared.context.settings, strictness },
    };

    const result = await requestGrade(this.gradeWorker, input, this.nextRegradeRequestId--, GRADE_WORKER_TIMEOUT_MS);
    if (result.ok) {
      this.showGrade(result.grade);
    } else
      noticeState.addNotice({
        code: result.reason === 'timeout' ? 'playGradeTimeout' : 'playGradeError',
        severity: 'warning',
      });
  }

  /** FR-042, AS-4.2, research R-10: hears a stored attempt back - the notes actually played, in their recorded
   *  timing, against the Score's own accompaniment - and shows the marks by re-grading it with its own stored
   *  settings (unchanged), exactly like `onGraded` does for a live run. */
  private async onAttemptReplay(runId: string): Promise<void> {
    // A replay is a run too (FR-006): the Attempts popup it was started from must not stay open over the music.
    viewState.closeForRun();
    const stored = await this.performanceStore.get(runId);
    if (!stored.ok) {
      noticeState.addNotice({
        code: stored.error === 'notFound' ? 'storageEntryMissing' : 'storageUnavailable',
        severity: 'warning',
      });
      return;
    }
    const perf = stored.value;
    const prepared = this.prepareStoredRun(perf);
    if (!prepared) return;

    const graded = await requestGrade(
      this.gradeWorker,
      prepared.context,
      this.nextRegradeRequestId--,
      GRADE_WORKER_TIMEOUT_MS,
    );
    if (graded.ok) {
      this.showGrade(graded.grade);
    } else
      noticeState.addNotice({
        code: graded.reason === 'timeout' ? 'playGradeTimeout' : 'playGradeError',
        severity: 'warning',
      });

    const schedule = compileReplay({
      log: perf.log,
      tempo: prepared.context.tempo,
      ppq: prepared.context.ppq,
      tempoPercent: perf.settings.tempoPercent,
      startAudioTimeSec: 0,
      accompaniment: prepared.accompaniment,
    });

    this.replayController?.dispose();
    this.replayController = new ReplaySessionController(this.audioEngine, {
      onEnded: () => {
        if (this.scoreView) this.scoreView.setPlaySession(this.playController);
      },
    });
    this.scheduleDelivered = false; // as for a live run: Listen reloads its own schedule next time
    this.replayController.start(this.playScoreId, perf.settings, prepared.context.tickMap, schedule);
    this.scoreView?.setPlaySession(this.replayController);
  }

  /** FR-043: deletes a stored attempt, which removes its recording from the device. R-18: `resultRemoved` fires
   *  only once the delete itself succeeded, keyed by the open Score (attempts are always listed for it alone). */
  private async onAttemptDelete(runId: string): Promise<void> {
    const result = await this.performanceStore.remove(runId);
    if (!result.ok) {
      noticeState.addNotice({ code: 'storageUnavailable', severity: 'warning' });
    } else if (this.playScoreId !== null) {
      void this.browserController.resultRemoved(this.playScoreId, runId);
    }
    await this.refreshAttempts();
  }

  /** Validates and corrects stored play settings against the current Score (same logic as practice). */
  private resolvePlaySettings(
    score: Score,
    parts: readonly { partIndex: number; staves: number }[],
    preselected: number,
    stored: RunSettings,
  ): RunSettings {
    const storedSel = stored.selection;
    let selection = stored.selection;
    if (parts.length > 0) {
      const part = storedSel ? parts.find((p) => p.partIndex === storedSel.partIndex) : undefined;
      if (storedSel && part) {
        const key = storedSel.staves.join(',');
        const offered = handOptions(score, storedSel.partIndex).find((option) => option.staves.join(',') === key);
        if (offered) selection = offered;
        else if (storedSel.staves.every((staff) => staff <= part.staves))
          selection = { ...storedSel, preset: 'custom' };
        else selection = handOptions(score, preselected)[0] ?? selection;
      } else {
        selection = handOptions(score, preselected)[0] ?? selection;
      }
    }
    return { ...stored, selection };
  }

  private onPracticeSetupChange(change: PracticeSetupChange): void {
    const setup = practiceState.get().setup;
    const score = this.currentScore;
    if (!setup?.selection || !score) return;
    if (change.loop !== undefined) {
      this.onLoopChange(change.loop);
      return;
    }

    let selection: HandSelection = setup.selection;
    if (change.partIndex !== undefined && change.partIndex !== selection.partIndex) {
      selection = handOptions(score, change.partIndex)[0] ?? selection; // a new part starts with all its staves
    }
    if (change.selection) selection = change.selection;
    const accompaniment = change.accompaniment ?? setup.accompaniment;
    const help = change.help ?? setup.help;

    const selectionChanged =
      selection.partIndex !== setup.selection.partIndex ||
      selection.staves.join(',') !== setup.selection.staves.join(',');
    practiceState.setSetup({
      ...setup,
      hands: handOptions(score, selection.partIndex),
      selection,
      accompaniment,
      help,
    });
    this.practiceSettings = { ...this.practiceSettings, selection, accompaniment, help };
    this.settingsStore.savePractice(this.practiceScoreId, this.practiceSettings);

    const session = practiceState.get().session;
    if (this.isPracticeRunning(session) && selectionChanged) {
      this.restartPracticeFromCurrentMeasure(session, selection);
      return;
    }
    if (session && !selectionChanged && accompaniment !== setup.accompaniment) {
      // Also for a finished session: its last accompaniment notes may still be ringing.
      this.applyPracticeInput({ type: 'setAccompaniment', enabled: accompaniment, timeStampMs: performance.now() });
    }
    if (session && !selectionChanged && help !== setup.help) {
      this.applyPracticeInput({ type: 'setHelp', enabled: help, timeStampMs: performance.now() });
    }
  }

  /** Sets or clears the loop (FR-016). The range is resolved to one occurrence on the unrolled timeline, and that
   *  occurrence is what is stored, so the same loop comes back on the same time through a repeat (R-06). A range the
   *  practised hand has no notes in is refused with a notice and the previous loop stays (AS-3.4 does the same for a
   *  reversed range by correcting it). */
  private onLoopChange(range: LoopRange | null): void {
    const setup = practiceState.get().setup;
    if (!setup?.selection) return;
    const session = practiceState.get().session;
    const running = this.isPracticeRunning(session) ? session : null;

    if (range === null) {
      this.storeLoop(null);
      this.applyPracticeInput({ type: 'setLoop', loop: null, timeStampMs: performance.now() });
      return;
    }

    const passes = this.currentPlaybackTimeline?.passes ?? [];
    const events =
      running?.events ??
      (this.currentScore && this.currentPlaybackTimeline
        ? buildExpectedEvents(this.currentScore, this.currentPlaybackTimeline, setup.selection)
        : []);
    const loop = resolveLoop(events, passes, range, running?.index ?? 0);
    if (!loop) {
      noticeState.addNotice({ code: 'practiceLoopEmpty', severity: 'warning' });
      return;
    }
    this.storeLoop(loopRangeToPassIndices(loop));
    this.applyPracticeInput({ type: 'setLoop', loop, timeStampMs: performance.now() });
  }

  /** Remembers the loop for this Score (as pass indices) and shows it. */
  private storeLoop(span: LoopPassSpan | null): void {
    const setup = practiceState.get().setup;
    if (!setup) return;
    this.practiceSettings = { ...this.practiceSettings, loop: span };
    this.settingsStore.savePractice(this.practiceScoreId, this.practiceSettings);
    practiceState.setSetup({
      ...setup,
      loop: span ? passIndicesToLoopRange(this.currentPlaybackTimeline?.passes ?? [], span) : null,
    });
  }

  /** A changed hand or part restarts cleanly from the measure the session is in (FR-015, FR-025c, AS-2.4). */
  private restartPracticeFromCurrentMeasure(session: PracticeSession, selection: HandSelection): void {
    if (!this.currentScore || !this.currentPlaybackTimeline) return;
    const events = buildExpectedEvents(this.currentScore, this.currentPlaybackTimeline, selection);
    if (events.length === 0) {
      noticeState.addNotice({ code: 'practiceNothingToPlay', severity: 'warning' });
      this.onTransportStopped();
      return;
    }
    const current = session.events[session.index];
    const cursor = current ? firstEventAtOrAfterTick(events, current.onsetTick) : 0;
    const start = current ? (resolveStartMeasure(events, current.measureIndex, cursor) ?? cursor) : 0;
    this.beginPractice(events, selection, start, this.resolveLoopFor(events, start));
  }

  /** Clicking a measure in Practice mode chooses where the session starts; a running session restarts there. */
  private onPracticeMeasureClick(measureIndex: number): void {
    practiceState.setStartMeasure(measureIndex);
    const session = practiceState.get().session;
    if (!this.isPracticeRunning(session)) return;
    const start = resolveStartMeasure(session.events, measureIndex, session.index);
    if (start !== null) {
      this.beginPractice(session.events, session.selection, start, this.resolveLoopFor(session.events, start));
    }
  }

  private applyPracticeInput(input: PracticeInput) {
    if (practiceState.get().mode !== 'practice') return;
    const session = practiceState.get().session;
    if (!session) return;

    const { session: nextSession, effects } = applyInput(session, input);
    practiceState.setSession(nextSession);

    for (const effect of effects) {
      this.handlePracticeEffect(effect);
    }

    // The wrong key was let go: whatever it was accused of no longer applies (T056). A key that never got
    // feedback is a harmless no-op clear.
    if (input.type === 'noteOff' && input.key !== undefined) {
      practiceState.clearKeyFeedback(input.key);
    }
  }

  private handlePracticeEffect(effect: PracticeEffect) {
    if (effect.type === 'moveCursor') {
      transportState.setPositionTick(effect.onsetTick);
      // The cursor moved to a different expected event: feedback about the one just left no longer applies.
      practiceState.clearAllKeyFeedback();
    } else if (effect.type === 'soundOn') {
      // Accompaniment (R-03): triggered by the musician's own progress and applied by the worklet on the audio
      // clock at its next block - no timer decides when it starts or stops (Constitution I).
      this.audioEngine.liveNoteOn(effect.key, effect.velocity);
    } else if (effect.type === 'soundOff') {
      this.audioEngine.liveNoteOff(effect.key);
    } else if (effect.type === 'keyFeedback') {
      // No notehead to mark a wrong / wrong-octave / extra press on: shown on the on-screen keyboard instead
      // (T056, owner decision 2026-09-20).
      practiceState.setKeyFeedback(effect.key, {
        state: effect.state,
        ...(effect.messageId !== undefined ? { messageId: effect.messageId } : {}),
      });
    } else if (effect.type === 'showHelp') {
      const overlay = this.resolveHelpOverlay(effect.eventIndex, effect.reason);
      if (overlay) practiceState.setHelpOverlay(overlay);
    } else if (effect.type === 'hideHelp') {
      practiceState.clearHelpOverlay();
    } else if (effect.type === 'notice') {
      noticeState.addNotice({ code: effect.code, severity: effect.code === 'practiceDeviceLost' ? 'warning' : 'info' });
    } else if (effect.type === 'sessionEnded') {
      // R-18/R-9: reaching the end naturally records the whole practised range; stopping early records nothing.
      if (effect.reason === 'reachedEnd') {
        const session = practiceState.get().session;
        const range = session && session.scoreId !== null ? practisedBarRange(session.events) : null;
        if (session && session.scoreId !== null && range) {
          void this.browserController.practised(session.scoreId, range.fromMeasure, range.toMeasure);
        }
      }
      this.endingPracticeNaturally = true;
      transportState.stop();
      this.endingPracticeNaturally = false;
    } else if (effect.type === 'loopCompleted') {
      const scoreId = practiceState.get().session?.scoreId ?? null;
      if (scoreId !== null) void this.browserController.practised(scoreId, effect.fromMeasure, effect.toMeasure);
    }
  }

  /** What `showHelp` refers to (FR-023): the note name is spelled from the MIDI key, since `Note` keeps only
   *  `writtenKey` / `soundingKey`, not the printed spelling (R-15) - the fingering is read from the Score's own
   *  `Note.fingerings` instead, since that is exactly what is stored. */
  private resolveHelpOverlay(eventIndex: number, reason: HelpOverlay['reason']): HelpOverlay | null {
    const event = practiceState.get().session?.events[eventIndex];
    if (!event) return null;
    return {
      reason,
      keys: event.required.map((req) => ({
        key: req.key,
        noteName: midiNoteName(req.key),
        fingering: this.fingeringFor(req.noteIds),
      })),
    };
  }

  /** The first written fingering among a required key's Note IDs (unison / voice-sharing can carry several). */
  private fingeringFor(noteIds: readonly string[]): string | null {
    if (!this.currentScore) return null;
    for (const part of this.currentScore.parts) {
      for (const note of part.notes) {
        if (note.fingerings.length > 0 && noteIds.includes(note.id)) return note.fingerings[0]?.text ?? null;
      }
    }
    return null;
  }

  /** A drop or the file chooser, from either the empty-state drop zone or the browser's own "Open file..." button
   *  or drop target (T068). Closes the browser on success, exactly like a successful library item does
   *  (contracts/score-browser.md §5); a failure shows a message naming the file and the load error in the
   *  browser's own message line when it was the one open (US3 #5), otherwise the existing load-error view
   *  already covers it. */
  async openFile(file: File): Promise<void> {
    if (file.size > MAX_FILE_BYTES) {
      const error: LoadError = { code: 'fileTooLarge', message: `File exceeds the ${MAX_FILE_BYTES} byte limit.` };
      scoreState.failed(file.name, error);
      browserState.fileFailed({ code: error.code, fileName: file.name }); // shown if the browser is open (017 T016)
      return;
    }
    this.browserController.clearOpenedItem();
    const bytes = await file.arrayBuffer();
    const browserWasReady = browserState.get().phase === 'ready';
    if (browserWasReady) browserState.startOpeningItem(fileRef(file.name));
    const outcome = await this.loadBytes(file.name, bytes, fileRef(file.name));
    if (outcome.ok) browserState.close();
    // Also when the browser was still loading its library at the drop (017 T016): it is open, so it shows the message.
    else browserState.fileFailed({ code: outcome.errorCode ?? 'internal', fileName: file.name });
  }

  /** `openedAs` is the ref this load represents (R-18): a library ref from `BrowserSessionController.openItem`, or
   *  a file ref computed from the name for a direct drop/dialog/*My files* reopen. Reports whether the Score
   *  actually parsed, and the `LoadErrorCode` on failure (`LoadBytesOutcome`, T068) - the boolean alone the library
   *  path has always used is not enough for a file that can genuinely fail to load. */
  private async loadBytes(fileName: string, bytes: ArrayBuffer, openedAs: ItemRef): Promise<LoadBytesOutcome> {
    scoreState.startLoading(fileName);
    const requestId = this.nextRequestId++;
    const response = await requestScoreLoad(this.scoreWorker, fileName, bytes.slice(0), requestId);

    if (response.type === 'failed') {
      scoreState.failed(fileName, response.error);
      return { ok: false, errorCode: response.error.code };
    }

    this.currentSchedule = response.schedule;
    this.currentTimeline = response.timeline;
    this.currentPlaybackTimeline = response.fullTimeline;
    this.currentScore = response.fullScore;
    this.resetPractice(); // the old session must not go on against the new Score while it is being stored

    scoreState.succeeded({
      fileName,
      summary: response.summary,
      report: response.report,
      renderXml: response.renderXml,
      contentHash: response.contentHash,
    });

    this.scoreView?.setNotationScore(response.fullScore); // the clefs, keys and shifts the red discs are printed with
    if (this.scoreView) {
      await this.scoreView.load(response.renderXml, response.summary.measureIds, viewState.get().scale);
    }
    this.updateTempoModel(); // the new Score's tempo (and, on the first load, the harvested glyphs)

    // this.soundReady is intentionally not reset here: the SoundFont is loaded once into the worklet's sound
    // bank, which is independent of which Score's schedule is currently loaded (contracts/worklet-protocol.md -
    // "soundBank" and "schedule" are separate messages).
    transportState.newScore();
    if (this.engineUnlocked) {
      // Already unlocked from an earlier Score in this session: deliver immediately (contracts/worklet-protocol.md
      // "schedule" stops playback and resets position by itself). Not yet unlocked: handlePlay() delivers it on
      // the first Play, since creating/loading the worklet needs a user gesture. A copy, as in handlePlay().
      this.audioEngine.load(structuredClone(this.currentSchedule));
      this.scheduleDelivered = true;
      if (this.scoreView) this.scoreView.setPlayback(this.audioEngine, this.currentTimeline);
    } else {
      this.scheduleDelivered = false;
    }

    if (openedAs.kind === 'file') {
      // R-11/T068: only a direct file open needs a *My files* entry - a library item's own row already comes
      // from the index, never from this store.
      void this.browserController.fileLoaded({
        fileName,
        bytes,
        hash: response.contentHash,
        title: response.summary.title,
        composer: response.summary.composer,
      });
    }
    // R-3: identity is the content hash, independent of whether a copy of the bytes could be stored - a
    // `MemoryProgressStore` fallback (R-19) always reports "available", so this is no longer ever null once a
    // Score has loaded.
    this.practiceScoreId = response.contentHash;
    this.setupPractice(response.fullScore);
    this.playScoreId = this.practiceScoreId;
    this.setupPlay(response.fullScore);
    void this.browserController.scoreOpened(response.contentHash, openedAs);

    return { ok: true };
  }
}
