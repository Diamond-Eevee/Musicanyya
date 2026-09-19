import type { LoadReport } from '../../core/score/load-report.js';
import type { RecentScoreSummary } from '../../engine/ports.js';
import { noticeState } from './noticeState.js';
import { createStore } from './store.js';

export type LoadErrorCode =
  | 'notMusicXml'
  | 'timewiseUnsupported'
  | 'unsupportedEncoding'
  | 'unsupportedArchive'
  | 'archiveNoScore'
  | 'fileTooLarge'
  | 'fileTooComplex'
  | 'malformedXml'
  | 'noPlayableContent'
  | 'internal';

export interface LoadError {
  code: LoadErrorCode;
  message: string;
  line?: number;
  column?: number;
  detail?: string;
}

export interface ScoreSummary {
  title: string | null;
  composer: string | null;
  parts: { id: string; name: string; instrument: string; program: number; percussion: boolean }[];
  measureCount: number;
  measureIds: string[];
  defaultTempoUsed: boolean;
}

export interface LoadedScore {
  fileName: string;
  summary: ScoreSummary;
  report: LoadReport;
  renderXml: string;
  contentHash: string;
}

export type ScoreStatus =
  | { kind: 'empty' }
  | { kind: 'loading'; fileName: string }
  | { kind: 'loaded'; score: LoadedScore }
  | { kind: 'error'; fileName: string; error: LoadError };

class ScoreState {
  private statusStore = createStore<ScoreStatus>({ kind: 'empty' });
  private recentStore = createStore<readonly RecentScoreSummary[]>([]);

  getStatus(): ScoreStatus {
    return this.statusStore.get();
  }

  subscribe(listener: (status: ScoreStatus) => void) {
    return this.statusStore.subscribe(listener);
  }

  getRecent(): readonly RecentScoreSummary[] {
    return this.recentStore.get();
  }

  subscribeRecent(listener: (recent: readonly RecentScoreSummary[]) => void) {
    return this.recentStore.subscribe(listener);
  }

  setRecent(recent: readonly RecentScoreSummary[]) {
    this.recentStore.set(recent);
  }

  startLoading(fileName: string) {
    this.statusStore.set({ kind: 'loading', fileName });
  }

  succeeded(loaded: LoadedScore) {
    this.statusStore.set({ kind: 'loaded', score: loaded });
    for (const entry of loaded.report.entries) {
      const base = {
        code: entry.code,
        severity: entry.severity,
        ...(entry.element !== undefined ? { element: entry.element } : {}),
      };
      if (entry.measureLabels.length === 0) {
        noticeState.addNotice(base);
        continue;
      }
      for (const measureLabel of entry.measureLabels) {
        noticeState.addNotice({ ...base, measureLabel });
      }
    }
  }

  /** A failed open never clears a previously loaded Score; it only surfaces an error notice. */
  failed(fileName: string, error: LoadError) {
    if (this.statusStore.get().kind !== 'loaded') {
      this.statusStore.set({ kind: 'error', fileName, error });
    }
    noticeState.addNotice({ code: error.code, severity: 'warning' });
  }
}

export const scoreState = new ScoreState();
