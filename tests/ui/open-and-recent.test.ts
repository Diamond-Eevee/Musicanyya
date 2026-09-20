import { afterEach, describe, expect, it } from 'vitest';
import '../../src/ui/elements/mx-drop-zone.js';
import '../../src/ui/elements/mx-open-button.js';
import '../../src/ui/elements/mx-recent-list.js';
import type { RecentScoreSummary } from '../../src/engine/ports.js';
import { SCORE_FILE_ACCEPT } from '../../src/ui/elements/mx-open-button.js';
import { noticeState } from '../../src/ui/state/noticeState.js';
import { scoreState } from '../../src/ui/state/scoreState.js';

function recent(id: string, fileName: string, lastOpened: string): RecentScoreSummary {
  return { id, fileName, title: null, composer: null, byteLength: 10, lastOpened };
}

describe('Open and recent UI', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    noticeState.clear();
    scoreState.setRecent([]);
  });

  it('open button exposes the score file accept list and dispatches fileopen on selection', () => {
    const el = document.createElement('mx-open-button');
    document.body.appendChild(el);
    const input = el.querySelector('input') as HTMLInputElement;
    expect(input.accept).toBe(SCORE_FILE_ACCEPT);

    const file = new File(['<x/>'], 'song.musicxml');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });

    const detail = new Promise<{ file: File }>((resolve) => {
      el.addEventListener('fileopen', (e) => resolve((e as CustomEvent).detail), { once: true });
    });
    input.dispatchEvent(new Event('change'));

    return detail.then((d) => expect(d.file).toBe(file));
  });

  it('drop zone accepts only the first dropped file', () => {
    const el = document.createElement('mx-drop-zone');
    document.body.appendChild(el);

    const first = new File(['<a/>'], 'a.musicxml');
    const second = new File(['<b/>'], 'b.musicxml');
    const detail = new Promise<{ file: File }>((resolve) => {
      el.addEventListener('fileopen', (e) => resolve((e as CustomEvent).detail), { once: true });
    });

    const dropEvent = new Event('drop', { cancelable: true }) as DragEvent & { dataTransfer: unknown };
    Object.defineProperty(dropEvent, 'dataTransfer', { value: { files: [first, second] } });
    el.dispatchEvent(dropEvent);

    return detail.then((d) => {
      expect(d.file).toBe(first);
      expect(d.file).not.toBe(second);
    });
  });

  it('renders the recent list newest first and supports reopen/remove', () => {
    scoreState.setRecent([
      recent('id-2', 'second.musicxml', '2026-01-02T00:00:00.000Z'),
      recent('id-1', 'first.musicxml', '2026-01-01T00:00:00.000Z'),
    ]);
    const el = document.createElement('mx-recent-list');
    document.body.appendChild(el);

    const openButtons = el.querySelectorAll('.mx-recent-open');
    expect(openButtons).toHaveLength(2);
    expect(openButtons[0]?.textContent).toBe('second.musicxml');
    expect(openButtons[1]?.textContent).toBe('first.musicxml');

    const reopened = new Promise<{ id: string }>((resolve) => {
      el.addEventListener('reopenrecent', (e) => resolve((e as CustomEvent).detail), { once: true });
    });
    (openButtons[0] as HTMLButtonElement).click();

    const removed = new Promise<{ id: string }>((resolve) => {
      el.addEventListener('removerecent', (e) => resolve((e as CustomEvent).detail), { once: true });
    });
    (el.querySelectorAll('.mx-recent-remove')[1] as HTMLButtonElement).click();

    return Promise.all([reopened, removed]).then(([r, rm]) => {
      expect(r.id).toBe('id-2');
      expect(rm.id).toBe('id-1');
    });
  });

  it('keeps the previously loaded Score when a later open fails, and reports an error notice', () => {
    scoreState.succeeded({
      fileName: 'good.musicxml',
      summary: {
        title: 'Good',
        composer: null,
        parts: [],
        measureCount: 1,
        measureIds: ['m1'],
        defaultTempoUsed: false,
      },
      report: { entries: [], skippedElementCount: 0 },
      renderXml: '<x/>',
      contentHash: 'hash1',
    });
    expect(scoreState.getStatus()).toMatchObject({ kind: 'loaded' });

    // The real open flow always calls startLoading before it knows the outcome (session.ts); the "keep the
    // previous Score" guard must survive that intermediate "loading" status, not just a direct succeeded->failed
    // call.
    scoreState.startLoading('bad.musicxml');
    scoreState.failed('bad.musicxml', { code: 'malformedXml', message: 'boom' });

    expect(scoreState.getStatus()).toMatchObject({ kind: 'loaded' }); // unchanged
    expect(scoreState.getStatus()).toMatchObject({ score: { fileName: 'good.musicxml' } });
    const notices = noticeState.getNotices();
    expect(notices.some((n) => n.code === 'malformedXml' && n.severity === 'warning')).toBe(true);
  });

  it('shows load-report notices grouped by code with measure labels', () => {
    scoreState.succeeded({
      fileName: 'x.musicxml',
      summary: {
        title: null,
        composer: null,
        parts: [],
        measureCount: 2,
        measureIds: ['m1', 'm2'],
        defaultTempoUsed: true,
      },
      report: {
        entries: [
          { code: 'unsupportedElement', severity: 'info', measureLabels: ['1', '2'], element: 'harmony' },
          { code: 'defaultTempo', severity: 'info', measureLabels: [] },
        ],
        skippedElementCount: 2,
      },
      renderXml: '<x/>',
      contentHash: 'hash2',
    });

    const unsupported = noticeState.getNotices().find((n) => n.code === 'unsupportedElement');
    expect(unsupported?.count).toBe(2);
    expect(unsupported?.measureLabels).toEqual(['1', '2']);
    expect(noticeState.getNotices().some((n) => n.code === 'defaultTempo')).toBe(true);
  });
});
