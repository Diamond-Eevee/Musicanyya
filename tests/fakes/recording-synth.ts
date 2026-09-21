import type { SynthInterface } from '../../src/engine/worklets/score-player.processor.js';

/**
 * Records noteOn/noteOff calls and, via `process()`, every sub-block render segment the
 * processor asks for. Each `on:`/`off:` entry carries the cumulative frame count rendered so
 * far, which is exactly the absolute frame at which that event was applied - the only way to
 * observe sample-accurate sub-block dispatch from Node without real audio (T024, research R-02).
 */
export class RecordingSynth implements SynthInterface {
  public events: string[] = [];
  public framesRendered = 0;
  noteOn(channel: number, key: number, velocity: number) {
    this.events.push(`on:${key}:${velocity}:${this.framesRendered}`);
  }
  noteOff(channel: number, key: number) {
    this.events.push(`off:${key}:${this.framesRendered}`);
  }
  process(_left: Float32Array, _right: Float32Array, _startIndex: number, sampleCount: number) {
    this.events.push(`render:${this.framesRendered}:${sampleCount}`);
    this.framesRendered += sampleCount;
  }
}
