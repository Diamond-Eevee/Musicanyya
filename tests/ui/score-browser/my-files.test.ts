// specs/013-score-browser-progress T063 (US3) - *Open file...*, drop onto the dialog, file rows and the remove
// flow (contracts/score-browser.md).
import { afterEach, describe, expect, it } from 'vitest';
import '../../../src/ui/elements/mx-browser-detail.js';
import '../../../src/ui/elements/mx-browser-list.js';
import '../../../src/ui/elements/mx-score-browser.js';
import { browserState } from '../../../src/ui/state/browserState.js';
import { record, userFile } from '../../fakes/progress-builders.js';

function mount(): HTMLElement {
  const el = document.createElement('mx-score-browser');
  document.body.appendChild(el);
  return el;
}

describe('mx-score-browser *Open file...* and drop (US3)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    browserState.reset();
  });

  it('the *Open file...* button and its hidden input accept .musicxml/.xml/.mxl', () => {
    const el = mount();
    const button = el.querySelector('[data-testid="browser-open-file"]') as HTMLButtonElement;
    const input = el.querySelector('.browser-open-file-input') as HTMLInputElement;
    expect(button.hidden).toBe(false);
    expect(input.accept).toBe('.musicxml,.xml,.mxl');
  });

  it('choosing a file through the input emits browseropenfile with that file', () => {
    const el = mount();
    browserState.open();
    const input = el.querySelector('.browser-open-file-input') as HTMLInputElement;
    const file = new File(['<score-partwise/>'], 'Etude.musicxml', { type: 'application/vnd.recordare.musicxml+xml' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });

    const opened = new Promise<{ file: File }>((resolve) => {
      el.addEventListener('browseropenfile', (e) => resolve((e as CustomEvent).detail), { once: true });
    });
    input.dispatchEvent(new Event('change'));

    return opened.then((detail) => {
      expect(detail.file.name).toBe('Etude.musicxml');
    });
  });

  it('a drop onto the dialog shows a highlight and emits browseropenfile', () => {
    const el = mount();
    const dialog = el.querySelector('dialog') as HTMLDialogElement;
    browserState.open();
    const file = new File(['<score-partwise/>'], 'Etude.musicxml');
    const dataTransfer = { files: [file] } as unknown as DataTransfer;

    dialog.dispatchEvent(new DragEvent('dragover', { cancelable: true }));
    expect(dialog.classList.contains('browser-drag-active')).toBe(true);

    const opened = new Promise<{ file: File }>((resolve) => {
      el.addEventListener('browseropenfile', (e) => resolve((e as CustomEvent).detail), { once: true });
    });
    const dropEvent = new DragEvent('drop', { cancelable: true });
    Object.defineProperty(dropEvent, 'dataTransfer', { value: dataTransfer });
    dialog.dispatchEvent(dropEvent);

    expect(dialog.classList.contains('browser-drag-active')).toBe(false);
    return opened.then((detail) => {
      expect(detail.file.name).toBe('Etude.musicxml');
    });
  });

  it('a fileNotStored message opens the file chooser once, not on every later render', () => {
    const el = mount();
    browserState.open();
    browserState.indexLoaded({ version: 1, generated: '2026-01-01T00:00:00.000Z', sections: [], items: [] }, [], []);
    browserState.startOpeningItem({ kind: 'file', fileKey: 'etude.musicxml' });
    const input = el.querySelector('.browser-open-file-input') as HTMLInputElement;
    let clicks = 0;
    input.addEventListener('click', () => clicks++);

    browserState.openFailed({ code: 'fileNotStored', fileName: 'Etude.musicxml' });
    expect(clicks).toBe(1);

    // An unrelated view change re-renders but must not click the input again.
    browserState.setView({ search: 'x' });
    expect(clicks).toBe(1);
  });

  it('the message line names the file and the load error (US3 #5)', () => {
    const el = mount();
    browserState.open();
    browserState.indexLoaded({ version: 1, generated: '2026-01-01T00:00:00.000Z', sections: [], items: [] }, [], []);
    browserState.startOpeningItem({ kind: 'file', fileKey: 'broken.musicxml' });

    browserState.openFailed({ code: 'malformedXml', fileName: 'Broken.musicxml' });

    const messageLine = el.querySelector('.browser-message');
    expect(messageLine?.textContent).toContain('Broken.musicxml');
    expect(messageLine?.textContent).toContain('well-formed XML');
  });
});

describe('mx-browser-list file rows (US3)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    browserState.reset();
  });

  it('a row with stored: false shows "file not stored - open it again from disk to play"', () => {
    const entry = userFile({ fileName: 'Etude.musicxml', stored: false });
    browserState.open();
    browserState.indexLoaded(
      { version: 1, generated: '2026-01-01T00:00:00.000Z', sections: [], items: [] },
      [entry],
      [],
    );
    const el = document.createElement('mx-browser-list');
    document.body.appendChild(el);

    const row = el.querySelector('[role="option"]') as HTMLElement;
    expect(row.textContent).toContain('file not stored - open it again from disk to play');
  });

  it('a row with stored: true shows no such text', () => {
    const entry = userFile({ fileName: 'Etude.musicxml', stored: true });
    browserState.open();
    browserState.indexLoaded(
      { version: 1, generated: '2026-01-01T00:00:00.000Z', sections: [], items: [] },
      [entry],
      [],
    );
    const el = document.createElement('mx-browser-list');
    document.body.appendChild(el);

    const row = el.querySelector('[role="option"]') as HTMLElement;
    expect(row.textContent).not.toContain('file not stored');
  });
});

describe('mx-browser-detail remove flow (US3 #4, OD-3, T062)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    browserState.reset();
  });

  function withFile(overrides: Parameters<typeof userFile>[0] = {}) {
    const entry = userFile({ fileName: 'Etude.musicxml', hash: 'a'.repeat(64), ...overrides });
    browserState.open();
    browserState.indexLoaded(
      { version: 1, generated: '2026-01-01T00:00:00.000Z', sections: [], items: [] },
      [entry],
      overrides.hash === undefined || overrides.earlierHashes === undefined
        ? []
        : [record({ scoreKey: entry.hash, attempts: 1 })],
    );
    browserState.setView({ selected: { kind: 'file', fileKey: entry.fileKey } });
    return entry;
  }

  it('offers the two choices inline, no blocking dialog', () => {
    withFile();
    const el = document.createElement('mx-browser-detail');
    document.body.appendChild(el);

    expect(el.querySelector('.browser-remove-keep')).toBeNull();
    (el.querySelector('.browser-remove-start') as HTMLButtonElement).click();

    expect(el.querySelector('.browser-remove-keep')?.textContent).toContain('keep progress');
    expect(el.querySelector('.browser-remove-progress')?.textContent).toContain('and progress');
    expect(document.querySelector('dialog')).toBeNull(); // never a blocking <dialog>/confirm()
  });

  it('"Remove file, keep progress" dispatches browserremovefile with keepProgress: true', () => {
    const entry = withFile();
    const el = document.createElement('mx-browser-detail');
    document.body.appendChild(el);

    const removed = new Promise<{ fileKey: string; keepProgress: boolean }>((resolve) => {
      el.addEventListener('browserremovefile', (e) => resolve((e as CustomEvent).detail), { once: true });
    });
    (el.querySelector('.browser-remove-start') as HTMLButtonElement).click();
    (el.querySelector('.browser-remove-keep') as HTMLButtonElement).click();

    return removed.then((detail) => {
      expect(detail).toEqual({ fileKey: entry.fileKey, keepProgress: true });
    });
  });

  it('"Remove file and progress" dispatches browserremovefile with keepProgress: false', () => {
    const entry = withFile();
    const el = document.createElement('mx-browser-detail');
    document.body.appendChild(el);

    const removed = new Promise<{ fileKey: string; keepProgress: boolean }>((resolve) => {
      el.addEventListener('browserremovefile', (e) => resolve((e as CustomEvent).detail), { once: true });
    });
    (el.querySelector('.browser-remove-start') as HTMLButtonElement).click();
    (el.querySelector('.browser-remove-progress') as HTMLButtonElement).click();

    return removed.then((detail) => {
      expect(detail).toEqual({ fileKey: entry.fileKey, keepProgress: false });
    });
  });

  it('Cancel returns to the plain "Remove from My files" button', () => {
    withFile();
    const el = document.createElement('mx-browser-detail');
    document.body.appendChild(el);

    (el.querySelector('.browser-remove-start') as HTMLButtonElement).click();
    (el.querySelector('.browser-remove-cancel') as HTMLButtonElement).click();

    expect(el.querySelector('.browser-remove-keep')).toBeNull();
    expect(el.querySelector('.browser-remove-start')).not.toBeNull();
  });

  it('while a removal is pending for this file, shows Undo instead of the remove button', () => {
    const entry = withFile();
    browserState.setPending({
      kind: 'removeFile',
      fileKey: entry.fileKey,
      keepProgress: false,
      deadline: Date.now() + 8000,
    });
    const el = document.createElement('mx-browser-detail');
    document.body.appendChild(el);

    expect(el.querySelector('.browser-remove-undo')).not.toBeNull();
    expect(el.querySelector('.browser-remove-start')).toBeNull();

    const undone = new Promise<void>((resolve) => {
      el.addEventListener('browserundoremovefile', () => resolve(), { once: true });
    });
    (el.querySelector('.browser-remove-undo') as HTMLButtonElement).click();
    return undone;
  });

  it('a row with stored: false shows "file not stored" in the detail pane too', () => {
    withFile({ stored: false });
    const el = document.createElement('mx-browser-detail');
    document.body.appendChild(el);

    expect(el.textContent).toContain('file not stored - open it again from disk to play');
  });

  it('an earlier-version result is labelled "Earlier version of this file"', () => {
    const currentHash = 'a'.repeat(64);
    const olderHash = 'b'.repeat(64);
    const entry = userFile({ fileName: 'Etude.musicxml', hash: currentHash, earlierHashes: [olderHash] });
    browserState.open();
    browserState.indexLoaded(
      { version: 1, generated: '2026-01-01T00:00:00.000Z', sections: [], items: [] },
      [entry],
      [
        record({ scoreKey: currentHash, attempts: 1 }),
        record({
          scoreKey: olderHash,
          attempts: 1,
          results: [
            {
              runId: 'older-run',
              finishedAt: '2026-01-01T00:00:00.000Z',
              notesCorrect: { count: 80, total: 100 },
              notesOnTime: { count: 70, total: 80 },
              extra: 0,
              tempoPercent: 100,
              strictness: 'beginner',
              complete: true,
              scope: { kind: 'whole' },
            },
          ],
        }),
      ],
    );
    browserState.setView({ selected: { kind: 'file', fileKey: entry.fileKey } });
    const el = document.createElement('mx-browser-detail');
    document.body.appendChild(el);

    expect(el.textContent).toContain('Earlier version of this file');
  });
});
