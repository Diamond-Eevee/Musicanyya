import { WebAudioEngine } from '../engine/audio/web-audio-engine.js';
import { MAX_FILE_BYTES, ZOOM_STEP } from '../engine/config.js';
import { WebMidiInput } from '../engine/midi/web-midi-input.js';
import type { AudioEngineEvent, EngineSchedule, PracticeSettings, ScoreStore, SettingsStore } from '../engine/ports.js';
import { IndexedDbScoreStore } from '../engine/storage/indexeddb-score-store.js';
import { LocalSettingsStore } from '../engine/storage/local-settings-store.js';
import '../ui/elements/mx-diagnostics.js';
import '../ui/elements/mx-drop-zone.js';
import '../ui/elements/mx-help-notation.js';
import '../ui/elements/mx-open-button.js';
import '../ui/elements/mx-recent-list.js';
import '../ui/elements/mx-score-view.js';
import '../ui/elements/mx-transport.js';
import '../ui/elements/mx-midi-panel.js';
import '../ui/elements/mx-mode-switch.js';
import '../ui/elements/mx-piano-keys.js';
import '../ui/elements/mx-practice-panel.js';
import { buildExpectedEvents, firstEventAtOrAfterTick, resolveStartMeasure } from '../core/practice/expected.js';
import { handOptions, partOptions } from '../core/practice/hands.js';
import { applyInput, startSession } from '../core/practice/matcher.js';
import type {
  ExpectedEvent,
  HandSelection,
  PracticeEffect,
  PracticeInput,
  PracticeSession,
} from '../core/practice/types.js';
import type { LoadReport } from '../core/score/load-report.js';
import type { Score } from '../core/score/model.js';
import type { PlaybackTimeline } from '../core/timeline/types.js';
import type { PracticeSetupChange } from '../ui/elements/mx-practice-panel.js';
import type { MxScoreView, TimelineDto } from '../ui/elements/mx-score-view.js';
import { en } from '../ui/i18n/en.js';
import { createVerovioClient } from '../ui/score/verovio-client.js';
import { initShortcuts } from '../ui/shortcuts.js';
import { midiState } from '../ui/state/midiState.js';
import { noticeState } from '../ui/state/noticeState.js';
import { practiceState } from '../ui/state/practiceState.js';
import type { LoadError, ScoreSummary } from '../ui/state/scoreState.js';
import { scoreState } from '../ui/state/scoreState.js';
import { transportState } from '../ui/state/transportState.js';
import { viewState } from '../ui/state/viewState.js';

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
  private readonly scoreStore: ScoreStore;
  private readonly settingsStore: SettingsStore;
  private nextRequestId = 1;
  private scoreView: MxScoreView | null = null;

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

  constructor(
    scoreStore: ScoreStore = new IndexedDbScoreStore(),
    settingsStore: SettingsStore = new LocalSettingsStore((code) =>
      noticeState.addNotice({ code, severity: 'warning' }),
    ),
  ) {
    if (typeof window !== 'undefined') {
      window.addEventListener('e2e-ready', () => {
        console.log('TEST: e2e-ready received!');
        (this.midiInput as any).grantState = 'available';
        (this.midiInput as any).emit('availability', 'available');
        (this.midiInput as any).emit('devices', [
          { id: 'fake-midi-1', name: 'Fake', manufacturer: 'Musicanyya', connected: true },
        ]);
        console.log('TEST: emitted availability = available');
      });
      window.addEventListener('e2e-midi', (e: any) => {
        (this.midiInput as any).handleMidiMessage('fake-midi-1', { data: e.detail, timeStamp: performance.now() });
      });
    }
    this.scoreStore = scoreStore;
    this.settingsStore = settingsStore;
  }

  async start(): Promise<void> {
    const settings = this.settingsStore.load();
    viewState.setZoom(settings.zoomPercent);
    transportState.applySavedSettings(settings.tempoPercent, settings.volume, settings.follow);

    this.scoreView = document.createElement('mx-score-view');
    this.scoreView.client = this.verovioClient;
    this.scoreView.addEventListener('zoomchange', (event) => {
      const { zoomPercent } = (event as CustomEvent<{ zoomPercent: number }>).detail;
      viewState.setZoom(zoomPercent);
      this.settingsStore.save({ ...this.settingsStore.load(), zoomPercent });
    });
    this.scoreView.addEventListener('measureclick', (event: Event) => {
      const { measureIndex } = (event as CustomEvent<{ measureIndex: number }>).detail;
      if (practiceState.get().mode === 'practice') {
        this.onPracticeMeasureClick(measureIndex);
        return;
      }
      const firstPass = this.currentTimeline?.passes.find((p) => p.measureIndex === measureIndex);
      if (firstPass) transportState.seekMeasure(firstPass.startTick);
    });
    document.getElementById('score-area')?.appendChild(this.scoreView);

    const emptyState = document.querySelector('.mx-empty-state');
    scoreState.subscribe((status) => {
      emptyState?.classList.toggle('hidden', status.kind === 'loading' || status.kind === 'loaded');
    });

    const transport = document.createElement('mx-transport');
    document.getElementById('transport-controls')?.appendChild(transport);
    const modeSwitch = document.createElement('mx-mode-switch');
    document.getElementById('mode-controls')?.appendChild(modeSwitch);
    const updateTransportVisibility = () => {
      const loaded = scoreState.getStatus().kind === 'loaded';
      transport.classList.toggle('hidden', !loaded);
      modeSwitch.classList.toggle('hidden', !loaded);
    };
    scoreState.subscribe(updateTransportVisibility);
    updateTransportVisibility();
    transportState.connect({
      play: () => void this.handlePlay(),
      pause: () => this.audioEngine.pause(),
      stop: () => {
        this.audioEngine.stop();
        this.onTransportStopped();
      },
      seekTick: (tick) => this.audioEngine.seekTick(tick),
      setTempoPercent: (percent) => this.audioEngine.setTempoPercent(percent),
      setVolume: (volume) => this.audioEngine.setVolume(volume),
    });
    transportState.subscribe((state) => {
      this.settingsStore.save({
        ...this.settingsStore.load(),
        tempoPercent: state.tempoPercent,
        volume: state.volume,
        follow: state.follow,
      });
    });
    this.audioEngine.on((event) => this.onAudioEngineEvent(event));
    let lastMode = practiceState.get().mode;
    practiceState.subscribe((state) => {
      if (state.mode === lastMode) return;
      lastMode = state.mode;
      if (state.mode === 'listen') this.leavePractice();
    });
    initShortcuts();

    const openButton = document.createElement('mx-open-button');
    const dropZone = document.createElement('mx-drop-zone');
    openButton.addEventListener('fileopen', (event) =>
      this.openFile((event as CustomEvent<{ file: File }>).detail.file),
    );
    dropZone.addEventListener('fileopen', (event) => this.openFile((event as CustomEvent<{ file: File }>).detail.file));
    document.getElementById('open-controls')?.append(openButton, dropZone);

    const recentList = document.createElement('mx-recent-list');
    recentList.addEventListener('reopenrecent', (event) =>
      this.reopenRecent((event as CustomEvent<{ id: string }>).detail.id),
    );
    recentList.addEventListener('removerecent', (event) =>
      this.removeRecent((event as CustomEvent<{ id: string }>).detail.id),
    );
    document.getElementById('side-panel')?.appendChild(recentList);

    const helpPanel = document.createElement('mx-help-notation');
    document.getElementById('help-panel')?.appendChild(helpPanel);
    const helpButton = document.createElement('button');
    helpButton.type = 'button';
    helpButton.textContent = en.help.button;
    helpButton.addEventListener('click', () => helpPanel.toggle());
    document.getElementById('help-controls')?.appendChild(helpButton);

    const diagnosticsPanel = document.createElement('mx-diagnostics');
    diagnosticsPanel.setEngine(this.audioEngine);
    document.getElementById('diagnostics-panel')?.appendChild(diagnosticsPanel);
    const diagnosticsButton = document.createElement('button');
    diagnosticsButton.type = 'button';
    diagnosticsButton.textContent = en.diagnostics.button;
    diagnosticsButton.addEventListener('click', () => diagnosticsPanel.toggle());
    document.getElementById('diagnostics-controls')?.appendChild(diagnosticsButton);

    document.addEventListener('keydown', (event) => this.onKeyDown(event));

    // MIDI Wire-up
    const midiPanel = document.createElement('mx-midi-panel');
    document.getElementById('side-panel')?.prepend(midiPanel);

    const practicePanel = document.createElement('mx-practice-panel');
    practicePanel.addEventListener('practicesetup', (event) =>
      this.onPracticeSetupChange((event as CustomEvent<PracticeSetupChange>).detail),
    );
    document.getElementById('side-panel')?.prepend(practicePanel);

    const pianoKeys = document.createElement('mx-piano-keys');
    // Place piano keys at the bottom of the score area
    document.getElementById('score-area')?.appendChild(pianoKeys);

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
        this.audioEngine.liveNoteOn(e.key, e.velocity);
        midiState.pressedKeys.add(e.key);
        midiState.emit();
        this.applyPracticeInput({ type: 'noteOn', key: e.key, velocity: e.velocity, timeStampMs: e.timeStampMs });
      } else if (e.type === 'noteOff') {
        this.audioEngine.liveNoteOff(e.key);
        midiState.pressedKeys.delete(e.key);
        midiState.emit();
        this.applyPracticeInput({ type: 'noteOff', key: e.key, timeStampMs: e.timeStampMs });
      } else if (e.type === 'sustain') {
        this.audioEngine.liveSustain(e.down);
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

    await this.refreshRecent();
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (!this.scoreView) return;
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.scoreView.setZoom(viewState.get().zoomPercent + ZOOM_STEP);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      this.scoreView.setZoom(viewState.get().zoomPercent - ZOOM_STEP);
    }
  }

  /** Unlock (user gesture), deliver the schedule if this is the first Play since it was loaded, ensure the
   * SoundFont is loaded (progress shown via `onAudioEngineEvent`'s 'loadingSound' state), then play. */
  private async handlePlay(): Promise<void> {
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

    if (practiceState.get().mode === 'practice') {
      this.startPractice();
      return;
    }

    if (this.currentSchedule && !this.scheduleDelivered) {
      this.audioEngine.load(this.currentSchedule);
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
    const start = startMeasureIndex === null ? 0 : (resolveStartMeasure(events, startMeasureIndex, 0) ?? 0);
    this.beginPractice(events, setup.selection, start);
  }

  /** A fresh session over `events` from `startEventIndex`: the previous marks are cleared (FR-019) and whatever the
   * previous session left ringing is released. */
  private beginPractice(events: readonly ExpectedEvent[], selection: HandSelection, startEventIndex: number): void {
    this.releasePracticeSound(practiceState.get().session);
    const session = startSession({
      scoreId: this.practiceScoreId,
      selection,
      events,
      startEventIndex,
      loop: null,
      accompaniment: practiceState.get().setup?.accompaniment ?? true,
      help: this.practiceSettings.help,
    });
    practiceState.setSession(session);
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
    const session = practiceState.get().session;
    if (!session || (session.phase === 'finished' && session.soundingAccompaniment.size === 0)) return;
    this.releasePracticeSound(session);
    practiceState.setSession({ ...session, phase: 'finished', soundingAccompaniment: new Map() });
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
  }

  /** Picks the part and hands offered for a Score, and the choices remembered for it (R-07). */
  private setupPractice(score: Score): void {
    this.resetPractice();
    const { parts, preselected } = partOptions(score);
    this.practiceSettings = this.settingsStore.loadPractice(this.practiceScoreId);
    const selection = this.resolvePracticeSelection(score, parts, preselected, this.practiceSettings.selection);
    practiceState.setSetup({
      parts,
      hands: selection ? handOptions(score, selection.partIndex) : [],
      selection,
      accompaniment: this.practiceSettings.accompaniment,
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

  private onPracticeSetupChange(change: PracticeSetupChange): void {
    const setup = practiceState.get().setup;
    const score = this.currentScore;
    if (!setup?.selection || !score) return;

    let selection: HandSelection = setup.selection;
    if (change.partIndex !== undefined && change.partIndex !== selection.partIndex) {
      selection = handOptions(score, change.partIndex)[0] ?? selection; // a new part starts with all its staves
    }
    if (change.selection) selection = change.selection;
    const accompaniment = change.accompaniment ?? setup.accompaniment;

    const selectionChanged =
      selection.partIndex !== setup.selection.partIndex ||
      selection.staves.join(',') !== setup.selection.staves.join(',');
    practiceState.setSetup({ ...setup, hands: handOptions(score, selection.partIndex), selection, accompaniment });
    this.practiceSettings = { ...this.practiceSettings, selection, accompaniment };
    this.settingsStore.savePractice(this.practiceScoreId, this.practiceSettings);

    const session = practiceState.get().session;
    if (this.isPracticeRunning(session) && selectionChanged) {
      this.restartPracticeFromCurrentMeasure(session, selection);
    } else if (session && !selectionChanged && accompaniment !== setup.accompaniment) {
      // Also for a finished session: its last accompaniment notes may still be ringing.
      this.applyPracticeInput({ type: 'setAccompaniment', enabled: accompaniment, timeStampMs: performance.now() });
    }
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
    this.beginPractice(events, selection, start);
  }

  /** Clicking a measure in Practice mode chooses where the session starts; a running session restarts there. */
  private onPracticeMeasureClick(measureIndex: number): void {
    practiceState.setStartMeasure(measureIndex);
    const session = practiceState.get().session;
    if (!this.isPracticeRunning(session)) return;
    const start = resolveStartMeasure(session.events, measureIndex, session.index);
    if (start !== null) this.beginPractice(session.events, session.selection, start);
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
  }

  private handlePracticeEffect(effect: PracticeEffect) {
    if (effect.type === 'moveCursor') {
      transportState.setPositionTick(effect.onsetTick);
    } else if (effect.type === 'soundOn') {
      // Accompaniment (R-03): triggered by the musician's own progress and applied by the worklet on the audio
      // clock at its next block - no timer decides when it starts or stops (Constitution I).
      this.audioEngine.liveNoteOn(effect.key, effect.velocity);
    } else if (effect.type === 'soundOff') {
      this.audioEngine.liveNoteOff(effect.key);
    } else if (effect.type === 'sessionEnded') {
      this.endingPracticeNaturally = true;
      transportState.stop();
      this.endingPracticeNaturally = false;
    }
  }

  async openFile(file: File): Promise<void> {
    if (file.size > MAX_FILE_BYTES) {
      scoreState.failed(file.name, {
        code: 'fileTooLarge',
        message: `File exceeds the ${MAX_FILE_BYTES} byte limit.`,
      });
      return;
    }
    const bytes = await file.arrayBuffer();
    await this.loadBytes(file.name, bytes);
  }

  private async loadBytes(fileName: string, bytes: ArrayBuffer): Promise<void> {
    scoreState.startLoading(fileName);
    const requestId = this.nextRequestId++;
    const response = await requestScoreLoad(this.scoreWorker, fileName, bytes.slice(0), requestId);

    if (response.type === 'failed') {
      scoreState.failed(fileName, response.error);
      return;
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

    if (this.scoreView) {
      await this.scoreView.load(response.renderXml, response.summary.measureIds, viewState.get().zoomPercent);
    }

    // this.soundReady is intentionally not reset here: the SoundFont is loaded once into the worklet's sound
    // bank, which is independent of which Score's schedule is currently loaded (contracts/worklet-protocol.md -
    // "soundBank" and "schedule" are separate messages).
    transportState.newScore();
    if (this.engineUnlocked) {
      // Already unlocked from an earlier Score in this session: deliver immediately (contracts/worklet-protocol.md
      // "schedule" stops playback and resets position by itself). Not yet unlocked: handlePlay() delivers it on
      // the first Play, since creating/loading the worklet needs a user gesture.
      this.audioEngine.load(this.currentSchedule);
      this.scheduleDelivered = true;
      if (this.scoreView) this.scoreView.setPlayback(this.audioEngine, this.currentTimeline);
    } else {
      this.scheduleDelivered = false;
    }

    const putResult = await this.scoreStore.put({
      fileName,
      bytes,
      title: response.summary.title,
      composer: response.summary.composer,
    });
    if (!putResult.ok) noticeState.addNotice({ code: 'storageUnavailable', severity: 'warning' });
    this.practiceScoreId = putResult.ok ? response.contentHash : null;
    this.setupPractice(response.fullScore);

    await this.refreshRecent();
  }

  private async reopenRecent(id: string): Promise<void> {
    const result = await this.scoreStore.get(id);
    if (!result.ok) {
      noticeState.addNotice({
        code: result.error === 'notFound' ? 'storageEntryMissing' : 'storageUnavailable',
        severity: 'warning',
      });
      return;
    }
    await this.loadBytes(result.value.summary.fileName, result.value.bytes);
  }

  private async removeRecent(id: string): Promise<void> {
    const result = await this.scoreStore.remove(id);
    if (!result.ok) {
      noticeState.addNotice({ code: 'storageUnavailable', severity: 'warning' });
      return;
    }
    await this.refreshRecent();
  }

  private async refreshRecent(): Promise<void> {
    const result = await this.scoreStore.list();
    if (result.ok) scoreState.setRecent(result.value);
  }
}
