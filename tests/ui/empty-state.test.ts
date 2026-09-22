import { afterEach, describe, expect, it } from 'vitest';
import { en } from '../../src/ui/i18n/en.js';
import '../../src/ui/elements/mx-drop-zone.js';
import { scoreState } from '../../src/ui/state/scoreState.js';

function makeArea(): { area: HTMLElement; zone: HTMLElement; scoreView: HTMLElement } {
  const area = document.createElement('main');
  const scoreView = document.createElement('div'); // stands in for mx-score-view
  const zone = document.createElement('mx-drop-zone');
  area.append(scoreView, zone);
  document.body.appendChild(area);
  return { area, zone, scoreView };
}

function dropEvent(files: File[], bubbles = true): DragEvent {
  const event = new Event('drop', { bubbles, cancelable: true }) as DragEvent;
  Object.defineProperty(event, 'dataTransfer', { value: { files } });
  return event;
}

/** FR-016, spec Acceptance 1.3: one invitation, an open action in one activation, a drop anywhere in the area. */
describe('empty state', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows one invitation with the drop hint and one open action', () => {
    const { zone } = makeArea();
    const invitation = zone.querySelectorAll('.mx-empty-state');
    expect(invitation).toHaveLength(1);
    expect(invitation[0]?.textContent).toContain(en.open.dropHint);
    const buttons = zone.querySelectorAll('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.textContent?.trim()).toBe(en.open.button);
  });

  it('the open action is one activation and asks the app to open the file chooser', () => {
    const { zone, area } = makeArea();
    let requests = 0;
    area.addEventListener('openrequest', () => requests++);
    (zone.querySelector('button') as HTMLButtonElement).click();
    expect(requests).toBe(1);
  });

  it('accepts a MusicXML file dropped on the invitation itself, exactly once', () => {
    const { zone, area } = makeArea();
    const file = new File(['<a/>'], 'a.musicxml');
    const opened: File[] = [];
    area.addEventListener('fileopen', (event) => opened.push((event as CustomEvent<{ file: File }>).detail.file));

    zone.querySelector('.mx-empty-state')?.dispatchEvent(dropEvent([file]));
    expect(opened).toEqual([file]);
  });

  it('accepts a file dropped anywhere else in the Score area', () => {
    const { scoreView, area } = makeArea();
    const file = new File(['<a/>'], 'a.musicxml');
    const opened: File[] = [];
    area.addEventListener('fileopen', (event) => opened.push((event as CustomEvent<{ file: File }>).detail.file));

    scoreView.dispatchEvent(dropEvent([file]));
    expect(opened).toEqual([file]);
  });

  it('a drop straight on the zone that does not bubble is still handled once', () => {
    const { zone } = makeArea();
    const file = new File(['<a/>'], 'a.musicxml');
    const opened: File[] = [];
    zone.addEventListener('fileopen', (event) => opened.push((event as CustomEvent<{ file: File }>).detail.file));
    zone.dispatchEvent(dropEvent([file], false));
    expect(opened).toEqual([file]);
  });

  it('uses only the first of several dropped files', () => {
    const { scoreView, area } = makeArea();
    const first = new File(['<a/>'], 'a.musicxml');
    const second = new File(['<b/>'], 'b.musicxml');
    const opened: File[] = [];
    area.addEventListener('fileopen', (event) => opened.push((event as CustomEvent<{ file: File }>).detail.file));
    scoreView.dispatchEvent(dropEvent([first, second]));
    expect(opened).toEqual([first]);
  });

  it('allows a drop over the whole area (dragover is default-prevented) and marks it', () => {
    const { scoreView, zone } = makeArea();
    const over = new Event('dragover', { bubbles: true, cancelable: true });
    scoreView.dispatchEvent(over);
    expect(over.defaultPrevented).toBe(true);
    expect(zone.classList.contains('drag-active')).toBe(true);

    scoreView.dispatchEvent(new Event('dragleave', { bubbles: true }));
    expect(zone.classList.contains('drag-active')).toBe(false);
  });

  it('stops listening to the area once removed', () => {
    const { zone, scoreView, area } = makeArea();
    let count = 0;
    area.addEventListener('fileopen', () => count++);
    zone.remove();
    scoreView.dispatchEvent(dropEvent([new File(['<a/>'], 'a.musicxml')]));
    expect(count).toBe(0);
  });

  // Last on purpose: scoreState has no way back to "empty" once a Score has loaded.
  it('hides the invitation once a Score is loaded, but still accepts a dropped file', () => {
    const { zone, scoreView, area } = makeArea();
    expect(zone.querySelector<HTMLElement>('.mx-empty-state')?.hidden).toBe(false);

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
    expect(zone.querySelector<HTMLElement>('.mx-empty-state')?.hidden).toBe(true);

    const file = new File(['<a/>'], 'next.musicxml');
    const opened: File[] = [];
    area.addEventListener('fileopen', (event) => opened.push((event as CustomEvent<{ file: File }>).detail.file));
    scoreView.dispatchEvent(dropEvent([file]));
    expect(opened).toEqual([file]);
  });
});
