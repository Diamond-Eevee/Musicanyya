export class RecordingSynth {
  public events: string[] = [];
  noteOn(key: number, velocity: number) {
    this.events.push(`on:${key}:${velocity}`);
  }
  noteOff(key: number) {
    this.events.push(`off:${key}`);
  }
}
