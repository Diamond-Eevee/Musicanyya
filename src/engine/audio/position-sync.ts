export interface PositionReport {
  type: 'position';
  frame: number;
  contextTime: number;
  tick: number;
  ticksPerFrame: number;
  playing: boolean;
}

export interface SyncParams {
  performanceTime: number;
  outputTimestamp?: {
    contextTime?: number;
    performanceTime?: number;
  };
  currentTime?: number;
  outputLatency?: number;
  sampleRate: number;
}

export class PositionSync {
  private lastReport: PositionReport | null = null;

  updateReport(report: PositionReport) {
    this.lastReport = report;
  }

  getAudibleTick(params: SyncParams): number {
    if (!this.lastReport) {
      return 0;
    }

    if (!this.lastReport.playing) {
      return this.lastReport.tick;
    }

    let audibleContextTime = 0;

    if (
      params.outputTimestamp &&
      params.outputTimestamp.contextTime !== undefined &&
      params.outputTimestamp.performanceTime !== undefined
    ) {
      const perfDiff = (params.performanceTime - params.outputTimestamp.performanceTime) / 1000.0;
      audibleContextTime = params.outputTimestamp.contextTime + perfDiff;
    } else if (params.currentTime !== undefined && params.outputLatency !== undefined) {
      audibleContextTime = params.currentTime - params.outputLatency;
    } else {
      return this.lastReport.tick;
    }

    const timeSinceReport = audibleContextTime - this.lastReport.contextTime;
    const framesSinceReport = timeSinceReport * params.sampleRate;
    const ticksSinceReport = framesSinceReport * this.lastReport.ticksPerFrame;

    return Math.round(this.lastReport.tick + ticksSinceReport);
  }
}
