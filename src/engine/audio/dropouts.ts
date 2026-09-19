export interface TimeSample {
  contextTime: number;
  performanceTime: number; // in milliseconds
}

export class DropoutDetector {
  startPlayback(sample: TimeSample): void {
    throw new Error('Not implemented');
  }

  stopPlayback(): void {
    throw new Error('Not implemented');
  }

  check(sample: TimeSample): void {
    throw new Error('Not implemented');
  }

  getDropoutsSincePlay(): number {
    throw new Error('Not implemented');
  }

  getTotalDropouts(): number {
    throw new Error('Not implemented');
  }
}
