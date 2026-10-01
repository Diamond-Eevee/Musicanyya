import { afterEach, describe, expect, it } from 'vitest';
import '../../src/ui/elements/mx-drop-zone.js';
import '../../src/ui/elements/mx-open-button.js';
import type { LoadReport } from '../../src/core/score/load-report.js';
import { SCORE_FILE_ACCEPT } from '../../src/ui/elements/mx-open-button.js';
import { noticeState } from '../../src/ui/state/noticeState.js';
import { scoreState } from '../../src/ui/state/scoreState.js';

// Feature 013 T092: the recent-scores list (`mx-recent-list`) is gone; *My files* replaces it, tested in
// tests/ui/score-browser/my-files.test.ts and the US3 block of tests/e2e/score-browser.spec.ts. What stays here is the
// open button, the drop zone and how a load result reaches the Score and the notices.
describe('Open button, drop zone and load results', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    noticeState.clear();
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

  it('clicking the button, or calling open(), asks the app to open the browser instead of the file chooser (feature 013, R-20)', () => {
    const el = document.createElement('mx-open-button');
    document.body.appendChild(el);

    const opens: string[] = [];
    el.addEventListener('openbrowser', () => opens.push('click'));
    (el.querySelector('.mx-open-button') as HTMLButtonElement).click();
    expect(opens).toEqual(['click']);

    el.addEventListener('openbrowser', () => opens.push('open()'));
    (el as unknown as { open(): void }).open();
    expect(opens).toEqual(['click', 'click', 'open()']);
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

  // 017 T043 (owner decision, 001 FR-005): load notices belong to their Score
  const loaded = (fileName: string, entries: LoadReport['entries']) => ({
    fileName,
    summary: {
      title: null,
      composer: null,
      arranger: null,
      parts: [],
      measureCount: 1,
      measureIds: ['m1'],
      defaultTempoUsed: false,
    },
    report: { entries, skippedElementCount: 0 },
    renderXml: '<x/>',
    contentHash: fileName,
  });

  it("removes the previous Score's load notices when another Score opens (017 T043)", () => {
    scoreState.succeeded(loaded('dropped.musicxml', [{ code: 'defaultTempo', severity: 'info', measureLabels: [] }]));
    expect(noticeState.getNotices().map((n) => n.code)).toEqual(['defaultTempo']);

    scoreState.succeeded(
      loaded('bach.musicxml', [{ code: 'tempoTextIgnored', severity: 'warning', measureLabels: ['3'] }]),
    );
    expect(noticeState.getNotices().map((n) => n.code)).toEqual(['tempoTextIgnored']);

    scoreState.succeeded(loaded('clean.musicxml', []));
    expect(noticeState.getNotices()).toEqual([]);
  });

  it('keeps every other notice - device, storage, a failed open - when another Score opens (017 T043)', () => {
    noticeState.addNotice({ code: 'midiDeviceLost', severity: 'warning' });
    scoreState.failed('bad.musicxml', { code: 'malformedXml', message: 'boom' });
    scoreState.succeeded(loaded('a.musicxml', [{ code: 'defaultTempo', severity: 'info', measureLabels: [] }]));
    scoreState.succeeded(loaded('b.musicxml', []));
    expect(noticeState.getNotices().map((n) => n.code)).toEqual(['midiDeviceLost', 'malformedXml']);
  });

  it('a load notice whose code is also raised outside a load is not merged into it, so it goes with its Score (017 T043)', () => {
    noticeState.addNotice({ code: 'defaultTempo', severity: 'info' });
    scoreState.succeeded(loaded('a.musicxml', [{ code: 'defaultTempo', severity: 'info', measureLabels: [] }]));
    scoreState.succeeded(loaded('b.musicxml', []));
    expect(noticeState.getNotices()).toMatchObject([{ code: 'defaultTempo', count: 1 }]);
  });
});
