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
  updateReport(report: PositionReport) {
    throw new Error('Not implemented');
  }

  getAudibleTick(params: SyncParams): number {
    throw new Error('Not implemented');
  }
}
