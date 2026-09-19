import { TEMPO_PERCENT_DEFAULT, VOLUME_DEFAULT } from '../../core/defaults.js';
import type {
  AudioDiagnostics,
  AudioEngine,
  AudioEngineEvent,
  AudioEngineState,
  EngineSchedule,
  LatencyInfo,
  PositionUpdate,
  TransportSnapshot,
} from '../ports.js';
// eslint-disable-next-line import/no-unresolved -- Vite-only query suffix (contracts/worklet-protocol.md)
import scorePlayerWorkletUrl from '../worklets/score-player.processor.ts?worker&url';
import { DropoutDetector } from './dropouts.js';
import { PositionSync } from './position-sync.js';
import { loadSoundFont } from './soundfont-cache.js';

const SOUNDFONT_URL = 'soundfonts/GeneralUser-GS-2.0.3.sf2';
const WORKLET_NAME = 'musicanyya-score-player';
const WORKLET_PROTOCOL_VERSION = '1.0.0';
const REPORT_WINDOW_MS = 1000;

// The score-player worklet's outbound messages (contracts/worklet-protocol.md); defined locally because the
// worklet module lives outside this file's TS project (tsconfig.worklet.json, AudioWorkletGlobalScope types).
type ProcessorMessage =
  | { type: 'status'; state: 'initialised' | 'soundReady' | 'error'; detail?: string }
  | { type: 'position'; frame: number; contextTime: number; tick: number; ticksPerFrame: number; playing: boolean }
  | { type: 'ended'; frame: number };

function initialTransport(): TransportSnapshot {
  return {
    phase: 'stopped',
    startTick: 0,
    positionTick: 0,
    tempoPercent: TEMPO_PERCENT_DEFAULT,
    volume: VOLUME_DEFAULT,
    follow: true,
  };
}

/** AudioEngine adapter for the Web Audio API (R-10, contracts/worklet-protocol.md). */
export class WebAudioEngine implements AudioEngine {
  readonly kind = 'webAudio';

  private context: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private workletReady: Promise<void> | null = null;
  private soundReady: Promise<void> | null = null;

  private state: AudioEngineState = { kind: 'idle' };
  private transport: TransportSnapshot = initialTransport();

  private positionSync = new PositionSync();
  private readonly dropoutDetector = new DropoutDetector();
  private lastReportPerfTimeMs: number | null = null;
  private readonly reportTimestamps: number[] = [];

  private readonly listeners = new Set<(event: AudioEngineEvent) => void>();

  on(listener: (event: AudioEngineEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: AudioEngineEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private setState(state: AudioEngineState): void {
    this.state = state;
    this.emit({ type: 'state', state });
  }

  private setTransport(patch: Partial<TransportSnapshot>): void {
    this.transport = { ...this.transport, ...patch };
    this.emit({ type: 'transport', transport: this.transport });
  }

  async unlock(): Promise<void> {
    if (!this.context) {
      try {
        this.context = new AudioContext({ latencyHint: 'interactive' });
      } catch (err) {
        this.setState({ kind: 'error', code: 'contextFailed', detail: String(err) });
        throw err;
      }
    }
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
    await this.ensureWorklet();
  }

  private async ensureWorklet(): Promise<void> {
    if (this.node) return;
    this.workletReady ??= this.createWorklet();
    return this.workletReady;
  }

  private async createWorklet(): Promise<void> {
    const context = this.context!;
    try {
      await context.audioWorklet.addModule(scorePlayerWorkletUrl);
    } catch (err) {
      this.setState({ kind: 'error', code: 'workletLoadFailed', detail: String(err) });
      throw err;
    }
    const node = new AudioWorkletNode(context, WORKLET_NAME, {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    node.connect(context.destination);
    node.port.onmessage = (event: MessageEvent) => this.handleProcessorMessage(event.data as ProcessorMessage);
    node.port.postMessage({
      type: 'init',
      protocol: WORKLET_PROTOCOL_VERSION,
      sampleRate: context.sampleRate,
      maxBlock: 128,
    });
    this.node = node;
  }

  private handleProcessorMessage(msg: ProcessorMessage): void {
    switch (msg.type) {
      case 'status': {
        if (msg.state === 'soundReady') {
          this.setState({ kind: 'ready' });
        } else if (msg.state === 'error') {
          this.setState({ kind: 'error', code: 'soundFontLoadFailed', detail: msg.detail ?? 'unknown' });
        }
        break;
      }
      case 'position': {
        const perfNow = performance.now();
        this.recordReport(perfNow);
        this.positionSync.updateReport({
          type: 'position',
          frame: msg.frame,
          contextTime: msg.contextTime,
          tick: msg.tick,
          ticksPerFrame: msg.ticksPerFrame,
          playing: msg.playing,
        });
        this.dropoutDetector.check({ contextTime: msg.contextTime, performanceTime: perfNow });
        this.setTransport({ positionTick: msg.tick });
        break;
      }
      case 'ended': {
        this.dropoutDetector.stopPlayback();
        this.setTransport({ phase: 'stopped', positionTick: this.transport.startTick });
        this.emit({ type: 'ended' });
        break;
      }
    }
  }

  private recordReport(perfNow: number): void {
    this.lastReportPerfTimeMs = perfNow;
    this.reportTimestamps.push(perfNow);
    const cutoff = perfNow - REPORT_WINDOW_MS;
    while (this.reportTimestamps.length > 0 && this.reportTimestamps[0]! < cutoff) {
      this.reportTimestamps.shift();
    }
  }

  async ensureSoundLoaded(): Promise<void> {
    await this.ensureWorklet();
    this.soundReady ??= this.loadSound();
    return this.soundReady;
  }

  private async loadSound(): Promise<void> {
    this.setState({ kind: 'loadingSound', loadedBytes: 0, totalBytes: null });
    let bytes: ArrayBuffer;
    try {
      bytes = await loadSoundFont(SOUNDFONT_URL, (loadedBytes, totalBytes) => {
        this.setState({ kind: 'loadingSound', loadedBytes, totalBytes: totalBytes > 0 ? totalBytes : null });
      });
    } catch (err) {
      this.setState({ kind: 'error', code: 'soundFontLoadFailed', detail: String(err) });
      throw err;
    }
    this.node!.port.postMessage({ type: 'soundBank', bytes }, [bytes]);
  }

  load(schedule: EngineSchedule): void {
    this.positionSync = new PositionSync();
    this.dropoutDetector.stopPlayback();
    this.transport = initialTransport();
    // The worklet's 'schedule' handler stops playback and clears held notes itself (contracts/worklet-protocol.md).
    this.node?.port.postMessage(schedule, [
      schedule.eventTick.buffer,
      schedule.eventKind.buffer,
      schedule.eventChannel.buffer,
      schedule.eventData1.buffer,
      schedule.eventData2.buffer,
      schedule.tempoTick.buffer,
      schedule.tempoQpmNum.buffer,
      schedule.tempoQpmDen.buffer,
      schedule.channelSetup.buffer,
    ]);
    this.emit({ type: 'transport', transport: this.transport });
  }

  play(): void {
    this.node?.port.postMessage({ type: 'play' });
    if (this.context) {
      this.dropoutDetector.startPlayback({ contextTime: this.context.currentTime, performanceTime: performance.now() });
    }
    this.setTransport({ phase: 'playing' });
  }

  pause(): void {
    this.node?.port.postMessage({ type: 'pause' });
    this.dropoutDetector.stopPlayback();
    this.setTransport({ phase: 'paused' });
  }

  stop(): void {
    this.node?.port.postMessage({ type: 'stop', returnTick: this.transport.startTick });
    this.dropoutDetector.stopPlayback();
    this.setTransport({ phase: 'stopped', positionTick: this.transport.startTick });
  }

  seekTick(tick: number): void {
    this.node?.port.postMessage({ type: 'seek', tick });
    this.setTransport({ startTick: tick, positionTick: tick });
  }

  setTempoPercent(percent: number): void {
    this.node?.port.postMessage({ type: 'tempo', percent });
    this.setTransport({ tempoPercent: percent });
  }

  setVolume(volume: number): void {
    this.node?.port.postMessage({ type: 'volume', gain: volume / 100 });
    this.setTransport({ volume });
  }

  liveNoteOn(key: number, velocity: number): void {
    this.node?.port.postMessage({ type: 'live', kind: 'on', key, velocity });
  }

  liveNoteOff(key: number): void {
    this.node?.port.postMessage({ type: 'live', kind: 'off', key });
  }

  liveSustain(down: boolean): void {
    this.node?.port.postMessage({ type: 'live', kind: 'sustain', down });
  }

  liveAllOff(): void {
    this.node?.port.postMessage({ type: 'live', kind: 'allOff' });
  }

  audiblePosition(nowMs: number): PositionUpdate | null {
    if (!this.context) return null;
    const outputTimestamp = this.context.getOutputTimestamp?.();
    const audibleTick = this.positionSync.getAudibleTick({
      performanceTime: nowMs,
      outputTimestamp,
      currentTime: this.context.currentTime,
      outputLatency: this.context.outputLatency,
      sampleRate: this.context.sampleRate,
    });
    return { audibleTick, playing: this.transport.phase === 'playing' };
  }

  latency(): LatencyInfo {
    if (!this.context) {
      return { outputLatencyMs: null, keyToSoundMs: null, method: 'estimated' };
    }
    const baseLatency = this.context.baseLatency ?? 0;
    const outputLatency = this.context.outputLatency;
    const outputLatencyMs = outputLatency !== undefined ? (baseLatency + outputLatency) * 1000 : null;
    return {
      outputLatencyMs,
      keyToSoundMs: null,
      method: outputLatency !== undefined ? 'reported' : 'estimated',
    };
  }

  diagnostics(): AudioDiagnostics {
    const lastReportAgeMs = this.lastReportPerfTimeMs !== null ? performance.now() - this.lastReportPerfTimeMs : null;
    return {
      sampleRate: this.context?.sampleRate ?? null,
      baseLatencyMs: this.context?.baseLatency != null ? this.context.baseLatency * 1000 : null,
      outputLatencyMs: this.context?.outputLatency != null ? this.context.outputLatency * 1000 : null,
      dropoutsSincePlay: this.dropoutDetector.getDropoutsSincePlay(),
      dropoutsTotal: this.dropoutDetector.getTotalDropouts(),
      dropoutMethod: this.lastReportPerfTimeMs !== null ? 'clockDrift' : 'none',
      reportsPerSecond: this.reportTimestamps.length,
      lastReportAgeMs,
    };
  }

  async dispose(): Promise<void> {
    this.node?.disconnect();
    this.node = null;
    this.workletReady = null;
    this.soundReady = null;
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    this.listeners.clear();
    this.state = { kind: 'idle' };
  }
}
