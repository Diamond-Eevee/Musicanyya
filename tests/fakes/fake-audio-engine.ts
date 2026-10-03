import type { LatencyProfile } from '../../src/core/grade/types.js';
import type { ClockPair } from '../../src/engine/midi/clock-map.js';
import type {
  AudioDiagnostics,
  AudioEngine,
  AudioEngineEvent,
  EngineSchedule,
  LatencyInfo,
  OutputCapability,
  OutputChoice,
  PositionUpdate,
  Unsubscribe,
} from '../../src/engine/ports.js';

export class FakeAudioEngine implements AudioEngine {
  readonly kind = 'webAudio';
  public commands: string[] = [];
  private listeners = new Set<(ev: AudioEngineEvent) => void>();

  async prepare() {
    this.commands.push('prepare');
  }
  async unlock() {
    this.commands.push('unlock');
  }
  async ensureSoundLoaded() {
    this.commands.push('ensureSoundLoaded');
  }
  /** Every schedule handed to `load`, in order (feature 020: a test reads which channels a run plays on). */
  public loaded: EngineSchedule[] = [];
  load(schedule: EngineSchedule) {
    this.commands.push('load');
    this.loaded.push(schedule);
  }
  play() {
    this.commands.push('play');
  }
  pause() {
    this.commands.push('pause');
  }
  stop() {
    this.commands.push('stop');
  }
  seekTick(tick: number) {
    this.commands.push(`seekTick:${tick}`);
  }
  setTempoPercent(percent: number) {
    this.commands.push(`setTempoPercent:${percent}`);
  }
  setVolume(volume: number) {
    this.commands.push(`setVolume:${volume}`);
  }
  setOrchestraLevel(level: number) {
    this.commands.push(`setOrchestraLevel:${level}`);
  }
  setChannelVolume(channel: number, volume: number) {
    this.commands.push(`setChannelVolume:${channel},${volume}`);
  }
  /** A note on a named channel (an Orchestra note, feature 019) is recorded as `liveNoteOn:<key>,<velocity>@<channel>`. */
  liveNoteOn(key: number, velocity: number, channel?: number) {
    this.commands.push(`liveNoteOn:${key},${velocity}${channel === undefined ? '' : `@${channel}`}`);
  }
  liveNoteOff(key: number, channel?: number) {
    this.commands.push(`liveNoteOff:${key}${channel === undefined ? '' : `@${channel}`}`);
  }
  liveSustain(down: boolean) {
    this.commands.push(`liveSustain:${down}`);
  }
  liveAllOff() {
    this.commands.push('liveAllOff');
  }

  public currentPosition: PositionUpdate | null = null;
  audiblePosition(nowMs: number) {
    return this.currentPosition;
  }

  public currentClockPair: ClockPair | null = null;
  clockPair(): ClockPair | null {
    return this.currentClockPair;
  }

  latency(): LatencyInfo {
    return { outputLatencyMs: null, keyToSoundMs: null, method: 'reported' };
  }
  public currentLatencyProfile: LatencyProfile = {
    outputLatencyMs: 0,
    inputLatencyMs: 0,
    source: 'assumed',
    measuredAt: null,
  };
  latencyProfile(): LatencyProfile {
    return this.calibration ?? this.currentLatencyProfile;
  }
  /** Feature 021: recorded as `setLatencyCalibration:<total ms | null>`; the profile in use follows it like the real engine. */
  setLatencyCalibration(profile: LatencyProfile | null) {
    const total = profile === null ? 'null' : String(profile.outputLatencyMs + profile.inputLatencyMs);
    this.commands.push(`setLatencyCalibration:${total}`);
    this.calibration = profile;
  }
  private calibration: LatencyProfile | null = null;

  /** Settable by a test: what the output list and capability say, and the device in use. */
  public outputs: readonly OutputChoice[] = [];
  public capability: OutputCapability = { kind: 'systemDefaultOnly', reason: 'browser' };
  private activeOutput = '';
  outputCapability(): OutputCapability {
    return this.capability;
  }
  async listOutputs(): Promise<readonly OutputChoice[]> {
    return this.outputs;
  }
  async setOutput(deviceId: string | null) {
    this.commands.push(`setOutput:${deviceId ?? ''}`);
    this.activeOutput = deviceId ?? '';
  }
  activeOutputId(): string {
    return this.activeOutput;
  }
  /** Test-only: the chosen output vanished and the sound fell back to the system default. */
  fireOutputFallback(lostDeviceId = ''): void {
    this.activeOutput = '';
    this.fireEvent({ type: 'outputFallback', lostDeviceId });
  }

  diagnostics(): AudioDiagnostics {
    return {
      sampleRate: null,
      baseLatencyMs: null,
      outputLatencyMs: null,
      dropoutsSincePlay: 0,
      dropoutsTotal: 0,
      dropoutMethod: 'none',
      reportsPerSecond: 0,
      lastReportAgeMs: null,
      liveQueueDropped: 0,
      lateEvents: 0,
    };
  }
  async dispose() {
    this.commands.push('dispose');
  }

  on(listener: (event: AudioEngineEvent) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Test-only: fires an event to every subscriber, e.g. to simulate the worklet reaching its own end. */
  fireEvent(event: AudioEngineEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
