import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import '../../../src/ui/elements/mx-browser-continue.js';
import '../../../src/ui/elements/mx-browser-list.js';
import { CONTINUE_ITEMS_MAX, MORE_PRACTICE_AFTER_RUNS } from '../../../src/core/defaults.js';
import type { LibraryIndex } from '../../../src/core/library/types.js';
import type { ItemRef, ProgressRecord, ProgressResult } from '../../../src/core/progress/types.js';
import { browserState } from '../../../src/ui/state/browserState.js';
import { record, result, userFile } from '../../fakes/progress-builders.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const index: LibraryIndex = JSON.parse(fs.readFileSync(path.join(root, 'public/library/index.json'), 'utf8'));

const C = 'learning/keys/c-major';
const KC = 'learning/key-changes/a-minor-to-a-major';
const DAY_MS = 24 * 60 * 60 * 1000;

const lib = (id: string): ItemRef => ({ kind: 'library', id });
const daysAgo = (n: number): string => new Date(Date.now() - n * DAY_MS).toISOString();

function itemOf(id: string) {
  const item = index.items.find((i) => i.id === id);
  if (!item) throw new Error(`no such library item: ${id}`);
  return item;
}

function opened(id: string, openedAt: string, extra: Partial<ProgressRecord> = {}): ProgressRecord {
  return record({
    scoreKey: itemOf(id).hash,
    openedAs: lib(id),
    firstOpenedAt: openedAt,
    lastOpenedAt: openedAt,
    updatedAt: openedAt,
    ...extra,
  });
}

function masteringRun(finishedAt: string): ProgressResult {
  return result({
    runId: `mastering-${finishedAt}`,
    finishedAt,
    notesCorrect: { count: 96, total: 100 },
    notesOnTime: { count: 90, total: 100 },
  });
}

function mastered(id: string, at: string): ProgressRecord {
  const run = masteringRun(at);
  return opened(id, at, {
    attempts: 1,
    firstPlayedAt: at,
    lastPlayedAt: at,
    best: run,
    masteredAt: at,
    masteredBy: run.runId,
    results: [run],
  });
}

function mount(records: ProgressRecord[], files = [] as ReturnType<typeof userFile>[]): HTMLElement {
  browserState.open();
  browserState.indexLoaded(index, files, records);
  const el = document.createElement('mx-browser-continue');
  document.body.appendChild(el);
  return el;
}

function cards(el: HTMLElement, within = '.continue-recent'): HTMLElement[] {
  return [...el.querySelectorAll<HTMLElement>(`${within} .continue-card`)];
}

describe('mx-browser-continue (T072, US4, contracts/score-browser.md section 2)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    browserState.reset();
  });

  it('shows the mastered item first with its status, best and "last played" text, and suggests the next step', () => {
    const el = mount([mastered(`${C}/introduction`, daysAgo(3))]);

    const [first] = cards(el);
    expect(first?.dataset.ref).toBe(`library:${C}/introduction`);
    expect(first?.dataset.status).toBe('mastered');
    expect(first?.querySelector('mx-status-badge')).not.toBeNull();
    expect(first?.textContent).toContain(itemOf(`${C}/introduction`).meta.title);
    expect(first?.textContent).toContain('96% correct');
    expect(first?.textContent).toContain('90% on time');
    expect(first?.textContent).toContain('Last played 3 days ago');

    const suggested = el.querySelector<HTMLElement>('[data-testid="browser-suggested"]');
    const card = suggested?.querySelector<HTMLElement>('.continue-card');
    expect(card?.dataset.ref).toBe(`library:${C}/beginner`);
    expect(suggested?.textContent).toContain('Suggested next');
    expect(suggested?.textContent).toContain(`Next step after ${itemOf(`${C}/introduction`).meta.title}`);
    expect(el.querySelector('.continue-welcome')).toBeNull();
    expect(el.querySelector('.continue-more')).toBeNull();
  });

  it('suggests continuing an unmastered recent item', () => {
    const el = mount([opened(`${C}/beginner`, daysAgo(1))]);
    const card = el.querySelector<HTMLElement>('[data-testid="browser-suggested"] .continue-card');
    expect(card?.dataset.ref).toBe(`library:${C}/beginner`);
    expect(el.querySelector('[data-testid="browser-suggested"]')?.textContent).toContain('Pick up where you left off');
  });

  it('a card for an item that was only opened says when it was opened, not "last played"', () => {
    const el = mount([opened(`${C}/beginner`, daysAgo(2))]);
    const [first] = cards(el);
    expect(first?.dataset.status).toBe('new');
    expect(first?.textContent).toContain('Opened 2 days ago');
    expect(first?.textContent).not.toContain('Last played');
  });

  it('lists at most CONTINUE_ITEMS_MAX recent cards, newest first', () => {
    const ids = index.items.slice(0, CONTINUE_ITEMS_MAX + 3).map((i) => i.id);
    const el = mount(ids.map((id, n) => opened(id, daysAgo(ids.length - n))));
    const shown = cards(el).map((c) => c.dataset.ref);
    expect(shown).toHaveLength(CONTINUE_ITEMS_MAX);
    expect(shown[0]).toBe(`library:${ids[ids.length - 1]}`);
  });

  it('fresh profile: the welcome, the first step and a link that selects Repertoire > Beginner', () => {
    const el = mount([]);
    expect(el.querySelector('.continue-welcome')).not.toBeNull();
    expect(cards(el)).toHaveLength(0);
    const card = el.querySelector<HTMLElement>('[data-testid="browser-suggested"] .continue-card');
    expect(card?.dataset.ref).toBe(`library:${C}/introduction`);

    const changes: unknown[] = [];
    el.addEventListener('browserviewchange', (event) => changes.push((event as CustomEvent).detail));
    el.querySelector<HTMLElement>('.continue-link')?.click();

    expect(browserState.get().view.folder).toEqual({ kind: 'section', id: 'repertoire/beginner' });
    expect(changes).toEqual([{ view: { folder: { kind: 'section', id: 'repertoire/beginner' } } }]);
  });

  it('offers More practice after enough whole complete runs without Mastered', () => {
    const runs = Array.from({ length: MORE_PRACTICE_AFTER_RUNS }, (_, n) =>
      result({ runId: `more-${n}`, finishedAt: daysAgo(10 - n) }),
    );
    const played = opened(`${KC}/intermediate`, daysAgo(1), {
      attempts: runs.length,
      lastPlayedAt: runs[runs.length - 1]?.finishedAt ?? null,
      best: runs[0] ?? null,
      results: [...runs].reverse(),
    });
    const el = mount([played]);
    const more = el.querySelector<HTMLElement>('.continue-more');
    expect(more?.querySelector<HTMLElement>('.continue-card')?.dataset.ref).toBe(`library:${KC}/minor-and-major`);
    expect(more?.textContent).toContain('More practice');
  });

  it('activating a card emits browseropenitem once, with that item', () => {
    const el = mount([mastered(`${C}/introduction`, daysAgo(3))]);
    const opens: ItemRef[] = [];
    el.addEventListener('browseropenitem', (event) => opens.push((event as CustomEvent<{ ref: ItemRef }>).detail.ref));

    el.querySelector<HTMLElement>('[data-testid="browser-suggested"] .continue-card')?.click();
    cards(el)[0]?.click();

    expect(opens).toEqual([lib(`${C}/beginner`), lib(`${C}/introduction`)]);
  });

  it('cards are real buttons, so Enter and Space activate them and Tab reaches them', () => {
    const el = mount([opened(`${C}/beginner`, daysAgo(1))]);
    for (const card of el.querySelectorAll('.continue-card')) {
      expect(card.tagName).toBe('BUTTON');
      expect((card as HTMLButtonElement).type).toBe('button');
    }
  });

  it('lists a My files entry that was opened, resolved through its file key', () => {
    const file = userFile({ fileKey: 'etude.xml', fileName: 'Etude.xml', title: 'Etude in C' });
    const rec = record({
      scoreKey: file.hash,
      openedAs: { kind: 'file', fileKey: 'etude.xml' },
      lastOpenedAt: daysAgo(1),
    });
    const el = mount([rec], [file]);
    const [first] = cards(el);
    expect(first?.dataset.ref).toBe('file:etude.xml');
    expect(first?.textContent).toContain('Etude in C');
  });

  it('escapes item titles', () => {
    const file = userFile({ fileKey: 'x.xml', fileName: 'x.xml', title: '<img src=x onerror=alert(1)>' });
    const rec = record({ scoreKey: file.hash, openedAs: { kind: 'file', fileKey: 'x.xml' }, lastOpenedAt: daysAgo(1) });
    const el = mount([rec], [file]);
    expect(el.querySelector('img')).toBeNull();
    expect(cards(el)[0]?.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});

describe('Continue replaces the list only for the Continue folder with an empty search (T075)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    browserState.reset();
  });

  function mountBoth(): { list: HTMLElement; cont: HTMLElement } {
    browserState.open();
    browserState.indexLoaded(index, [], []);
    const cont = document.createElement('mx-browser-continue');
    const list = document.createElement('mx-browser-list');
    document.body.append(cont, list);
    return { list, cont };
  }

  it('shows Continue, not the list, on the Continue folder (the default)', () => {
    const { list, cont } = mountBoth();
    expect(browserState.get().view.folder).toEqual({ kind: 'continue' });
    expect(cont.hidden).toBe(false);
    expect(list.hidden).toBe(true);
  });

  it('shows the list, not Continue, for any other folder', () => {
    const { list, cont } = mountBoth();
    browserState.setView({ folder: { kind: 'all' } });
    expect(cont.hidden).toBe(true);
    expect(list.hidden).toBe(false);
    browserState.setView({ folder: { kind: 'myFiles' } });
    expect(cont.hidden).toBe(true);
    expect(list.hidden).toBe(false);
  });

  it('a non-empty search shows the list, and clearing it brings Continue back', () => {
    const { list, cont } = mountBoth();
    browserState.setView({ search: 'greensleeves' });
    expect(cont.hidden).toBe(true);
    expect(list.hidden).toBe(false);
    browserState.setView({ search: '' });
    expect(cont.hidden).toBe(false);
    expect(list.hidden).toBe(true);
  });
});
