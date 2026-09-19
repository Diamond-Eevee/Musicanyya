import { MAX_FILE_BYTES, ZOOM_STEP } from '../engine/config.js';
import type { ScoreStore, SettingsStore } from '../engine/ports.js';
import { IndexedDbScoreStore } from '../engine/storage/indexeddb-score-store.js';
import { LocalSettingsStore } from '../engine/storage/local-settings-store.js';
import '../ui/elements/mx-drop-zone.js';
import '../ui/elements/mx-open-button.js';
import '../ui/elements/mx-recent-list.js';
import '../ui/elements/mx-score-view.js';
import type { LoadReport } from '../core/score/load-report.js';
import type { MxScoreView } from '../ui/elements/mx-score-view.js';
import { createVerovioClient } from '../ui/score/verovio-client.js';
import { noticeState } from '../ui/state/noticeState.js';
import type { LoadError, ScoreSummary } from '../ui/state/scoreState.js';
import { scoreState } from '../ui/state/scoreState.js';
import { viewState } from '../ui/state/viewState.js';

interface ScoreWorkerLoaded {
  type: 'loaded';
  requestId: number;
  score: ScoreSummary;
  report: LoadReport;
  renderXml: string;
  contentHash: string;
}
interface ScoreWorkerFailed {
  type: 'failed';
  requestId: number;
  error: LoadError;
}
type ScoreWorkerResponse = ScoreWorkerLoaded | ScoreWorkerFailed;

function requestScoreLoad(
  worker: Worker,
  fileName: string,
  bytes: ArrayBuffer,
  requestId: number,
): Promise<ScoreWorkerResponse> {
  return new Promise((resolve) => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as ScoreWorkerResponse;
      if (data.requestId !== requestId) return; // stale response, ignored
      worker.removeEventListener('message', onMessage);
      resolve(data);
    };
    worker.addEventListener('message', onMessage);
    worker.postMessage({ type: 'load', requestId, fileName, bytes }, [bytes]);
  });
}

/** Wires ports, stores, workers and UI elements together for the open/recent flow (US1). */
export class Session {
  private readonly scoreWorker = new Worker(new URL('../workers/score.worker.ts', import.meta.url), {
    type: 'module',
  });
  private readonly verovioWorker = new Worker(new URL('../workers/verovio.worker.ts', import.meta.url), {
    type: 'module',
  });
  private readonly verovioClient = createVerovioClient(this.verovioWorker);
  private readonly scoreStore: ScoreStore;
  private readonly settingsStore: SettingsStore;
  private nextRequestId = 1;
  private scoreView: MxScoreView | null = null;

  constructor(
    scoreStore: ScoreStore = new IndexedDbScoreStore(),
    settingsStore: SettingsStore = new LocalSettingsStore((code) =>
      noticeState.addNotice({ code, severity: 'warning' }),
    ),
  ) {
    this.scoreStore = scoreStore;
    this.settingsStore = settingsStore;
  }

  async start(): Promise<void> {
    const settings = this.settingsStore.load();
    viewState.setZoom(settings.zoomPercent);

    this.scoreView = document.createElement('mx-score-view');
    this.scoreView.client = this.verovioClient;
    this.scoreView.addEventListener('zoomchange', (event) => {
      const { zoomPercent } = (event as CustomEvent<{ zoomPercent: number }>).detail;
      viewState.setZoom(zoomPercent);
      this.settingsStore.save({ ...this.settingsStore.load(), zoomPercent });
    });
    document.getElementById('score-area')?.appendChild(this.scoreView);

    const emptyState = document.querySelector('.mx-empty-state');
    scoreState.subscribe((status) => {
      emptyState?.classList.toggle('hidden', status.kind === 'loading' || status.kind === 'loaded');
    });

    const openButton = document.createElement('mx-open-button');
    const dropZone = document.createElement('mx-drop-zone');
    openButton.addEventListener('fileopen', (event) =>
      this.openFile((event as CustomEvent<{ file: File }>).detail.file),
    );
    dropZone.addEventListener('fileopen', (event) => this.openFile((event as CustomEvent<{ file: File }>).detail.file));
    document.getElementById('open-controls')?.append(openButton, dropZone);

    const recentList = document.createElement('mx-recent-list');
    recentList.addEventListener('reopenrecent', (event) =>
      this.reopenRecent((event as CustomEvent<{ id: string }>).detail.id),
    );
    recentList.addEventListener('removerecent', (event) =>
      this.removeRecent((event as CustomEvent<{ id: string }>).detail.id),
    );
    document.getElementById('side-panel')?.appendChild(recentList);

    document.addEventListener('keydown', (event) => this.onKeyDown(event));

    await this.refreshRecent();
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (!this.scoreView) return;
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.scoreView.setZoom(viewState.get().zoomPercent + ZOOM_STEP);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      this.scoreView.setZoom(viewState.get().zoomPercent - ZOOM_STEP);
    }
  }

  async openFile(file: File): Promise<void> {
    if (file.size > MAX_FILE_BYTES) {
      scoreState.failed(file.name, {
        code: 'fileTooLarge',
        message: `File exceeds the ${MAX_FILE_BYTES} byte limit.`,
      });
      return;
    }
    const bytes = await file.arrayBuffer();
    await this.loadBytes(file.name, bytes);
  }

  private async loadBytes(fileName: string, bytes: ArrayBuffer): Promise<void> {
    scoreState.startLoading(fileName);
    const requestId = this.nextRequestId++;
    const response = await requestScoreLoad(this.scoreWorker, fileName, bytes.slice(0), requestId);

    if (response.type === 'failed') {
      scoreState.failed(fileName, response.error);
      return;
    }

    scoreState.succeeded({
      fileName,
      summary: response.score,
      report: response.report,
      renderXml: response.renderXml,
      contentHash: response.contentHash,
    });

    if (this.scoreView) {
      await this.scoreView.load(response.renderXml, response.score.measureIds, viewState.get().zoomPercent);
    }

    const putResult = await this.scoreStore.put({
      fileName,
      bytes,
      title: response.score.title,
      composer: response.score.composer,
    });
    if (!putResult.ok) noticeState.addNotice({ code: 'storageUnavailable', severity: 'warning' });

    await this.refreshRecent();
  }

  private async reopenRecent(id: string): Promise<void> {
    const result = await this.scoreStore.get(id);
    if (!result.ok) {
      noticeState.addNotice({
        code: result.error === 'notFound' ? 'storageEntryMissing' : 'storageUnavailable',
        severity: 'warning',
      });
      return;
    }
    await this.loadBytes(result.value.summary.fileName, result.value.bytes);
  }

  private async removeRecent(id: string): Promise<void> {
    const result = await this.scoreStore.remove(id);
    if (!result.ok) {
      noticeState.addNotice({ code: 'storageUnavailable', severity: 'warning' });
      return;
    }
    await this.refreshRecent();
  }

  private async refreshRecent(): Promise<void> {
    const result = await this.scoreStore.list();
    if (result.ok) scoreState.setRecent(result.value);
  }
}
