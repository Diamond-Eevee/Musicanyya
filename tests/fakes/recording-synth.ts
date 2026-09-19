import type { SynthInterface } from '../../src/engine/worklets/score-player.processor.js';

export class RecordingSynth implements SynthInterface {
  public events: string[] = [];
  noteOn(channel: number, key: number, velocity: number) {
    this.events.push(`on:${key}:${velocity}`);
  }
  noteOff(channel: number, key: number) {
    this.events.push(`off:${key}`);
  }
}
