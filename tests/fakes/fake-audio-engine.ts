import type { LatencyProfile } from '../../src/core/grade/types.js';
import type { ClockPair } from '../../src/engine/midi/clock-map.js';
import type {
  AudioDiagnostics,
  AudioEngine,
  AudioEngineEvent,
  EngineSchedule,
  LatencyInfo,
  PositionUpdate,
  Unsubscribe,
} from '../../src/engine/ports.js';

export class FakeAudioEngine implements AudioEngine {
  readonly kind = 'webAudio';
  public commands: string[] = [];
  private listeners = new Set<(ev: AudioEngineEvent) => void>();

  async unlock() {
    this.commands.push('unlock');
  }
  async ensureSoundLoaded() {
    this.commands.push('ensureSoundLoaded');
  }
  load(schedule: EngineSchedule) {
    this.commands.push('load');
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
  setChannelVolume(channel: number, volume: number) {
    this.commands.push(`setChannelVolume:${channel},${volume}`);
  }
  liveNoteOn(key: number, velocity: number) {
    this.commands.push(`liveNoteOn:${key},${velocity}`);
  }
  liveNoteOff(key: number) {
    this.commands.push(`liveNoteOff:${key}`);
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
    return this.currentLatencyProfile;
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
