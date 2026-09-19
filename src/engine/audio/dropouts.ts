export interface TimeSample {
  contextTime: number;
  performanceTime: number; // in milliseconds
}

export class DropoutDetector {
  private totalDropouts = 0;
  private dropoutsSincePlay = 0;
  private lastTime: TimeSample | null = null;
  private playing = false;
  private readonly DRIFT_THRESHOLD_SECONDS = 0.05;

  startPlayback(sample: TimeSample): void {
    this.dropoutsSincePlay = 0;
    this.lastTime = sample;
    this.playing = true;
  }

  stopPlayback(): void {
    this.playing = false;
    this.lastTime = null;
  }

  check(sample: TimeSample): void {
    if (!this.playing || !this.lastTime) {
      return;
    }

    const contextDiff = sample.contextTime - this.lastTime.contextTime;
    const perfDiff = (sample.performanceTime - this.lastTime.performanceTime) / 1000.0;

    if (perfDiff - contextDiff > this.DRIFT_THRESHOLD_SECONDS) {
      this.dropoutsSincePlay++;
      this.totalDropouts++;
    }

    this.lastTime = sample;
  }

  getDropoutsSincePlay(): number {
    return this.dropoutsSincePlay;
  }

  getTotalDropouts(): number {
    return this.totalDropouts;
  }
}
