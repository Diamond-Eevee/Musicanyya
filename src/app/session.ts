import { WebAudioEngine } from '../engine/audio/web-audio-engine.js';
import { MAX_FILE_BYTES, ZOOM_STEP } from '../engine/config.js';
import { WebMidiInput } from '../engine/midi/web-midi-input.js';
import type { AudioEngineEvent, EngineSchedule, ScoreStore, SettingsStore } from '../engine/ports.js';
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
import '../ui/elements/mx-piano-keys.js';
import type { LoadReport } from '../core/score/load-report.js';
import type { MxScoreView, TimelineDto } from '../ui/elements/mx-score-view.js';
import { en } from '../ui/i18n/en.js';
import { createVerovioClient } from '../ui/score/verovio-client.js';
import { initShortcuts } from '../ui/shortcuts.js';
import { midiState } from '../ui/state/midiState.js';
import { noticeState } from '../ui/state/noticeState.js';
import type { LoadError, ScoreSummary } from '../ui/state/scoreState.js';
import { scoreState } from '../ui/state/scoreState.js';
import { transportState } from '../ui/state/transportState.js';
import { viewState } from '../ui/state/viewState.js';

interface ScoreWorkerLoaded {
  type: 'loaded';
  requestId: number;
  score: ScoreSummary;
  report: LoadReport;
  renderXml: string;
  timeline: TimelineDto;
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
  private scheduleDelivered = false;
  private readonly midiInput = new WebMidiInput();

  constructor(
    scoreStore: ScoreStore = new IndexedDbScoreStore(),
    settingsStore: SettingsStore = new LocalSettingsStore((code) =>
      noticeState.addNotice({ code, severity: 'warning' }),
    ),
  ) {
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
    this.scoreView.addEventListener('measureclick', (event) => {
      const { measureIndex } = (event as CustomEvent<{ measureIndex: number }>).detail;
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
    const updateTransportVisibility = () => {
      transport.classList.toggle('hidden', scoreState.getStatus().kind !== 'loaded');
    };
    scoreState.subscribe(updateTransportVisibility);
    updateTransportVisibility();
    transportState.connect({
      play: () => void this.handlePlay(),
      pause: () => this.audioEngine.pause(),
      stop: () => this.audioEngine.stop(),
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
        e.heldKeys.forEach((k) => midiState.pressedKeys.delete(k));
        midiState.emit();
        noticeState.addNotice({ code: 'midiDeviceLost', severity: 'warning' });
      } else if (e.type === 'noteOn') {
        midiState.pressedKeys.add(e.key);
        midiState.emit();
        this.audioEngine.liveNoteOn(e.key, e.velocity);
      } else if (e.type === 'noteOff') {
        midiState.pressedKeys.delete(e.key);
        midiState.emit();
        this.audioEngine.liveNoteOff(e.key);
      } else if (e.type === 'sustain') {
        midiState.sustainDown = e.down;
        midiState.emit();
        this.audioEngine.liveSustain(e.down);
      }
    });

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

    if (this.currentSchedule && !this.scheduleDelivered) {
      this.audioEngine.load(this.currentSchedule);
      this.scheduleDelivered = true;
      const seekTick = transportState.get().positionTick;
      if (seekTick > 0) this.audioEngine.seekTick(seekTick);
      if (this.scoreView && this.currentTimeline) this.scoreView.setPlayback(this.audioEngine, this.currentTimeline);
    }

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

    scoreState.succeeded({
      fileName,
      summary: response.score,
      report: response.report,
      renderXml: response.renderXml,
      contentHash: response.contentHash,
    });

    if (this.scoreView) {
      await this.scoreView.load(response.renderXml, response.score.measureIds, viewState.get().zoomPercent);
    }

    this.currentSchedule = response.schedule;
    this.currentTimeline = response.timeline;
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
      title: response.score.title,
      composer: response.score.composer,
    });
    if (!putResult.ok) noticeState.addNotice({ code: 'storageUnavailable', severity: 'warning' });

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
