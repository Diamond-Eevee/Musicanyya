import type {
  AudioDiagnostics,
  AudioEngine,
  AudioEngineEvent,
  EngineSchedule,
  LatencyInfo,
  PositionUpdate,
} from '../ports.js';

export class WebAudioEngine implements AudioEngine {
  readonly kind = 'webAudio';

  on(listener: (event: AudioEngineEvent) => void): () => void {
    throw new Error('Not implemented');
  }

  async unlock(): Promise<void> {
    throw new Error('Not implemented');
  }

  async ensureSoundLoaded(): Promise<void> {
    throw new Error('Not implemented');
  }

  load(schedule: EngineSchedule): void {
    throw new Error('Not implemented');
  }

  play(): void {
    throw new Error('Not implemented');
  }

  pause(): void {
    throw new Error('Not implemented');
  }

  stop(): void {
    throw new Error('Not implemented');
  }

  seekTick(tick: number): void {
    throw new Error('Not implemented');
  }

  setTempoPercent(percent: number): void {
    throw new Error('Not implemented');
  }

  setVolume(volume: number): void {
    throw new Error('Not implemented');
  }

  liveNoteOn(key: number, velocity: number): void {
    throw new Error('Not implemented');
  }

  liveNoteOff(key: number): void {
    throw new Error('Not implemented');
  }

  liveSustain(down: boolean): void {
    throw new Error('Not implemented');
  }

  liveAllOff(): void {
    throw new Error('Not implemented');
  }

  audiblePosition(nowMs: number): PositionUpdate | null {
    throw new Error('Not implemented');
  }

  latency(): LatencyInfo {
    throw new Error('Not implemented');
  }

  diagnostics(): AudioDiagnostics {
    throw new Error('Not implemented');
  }

  async dispose(): Promise<void> {
    throw new Error('Not implemented');
  }
}
