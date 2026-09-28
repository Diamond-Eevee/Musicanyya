import { afterEach, describe, expect, it } from 'vitest';
import '../../../src/ui/elements/mx-browser-detail.js';
import '../../../src/ui/elements/mx-browser-rail.js';
import '../../../src/ui/elements/mx-score-browser.js';
import { rememberInvoker } from '../../../src/ui/layout/invoker.js';
import { browserState } from '../../../src/ui/state/browserState.js';
import { scoreState } from '../../../src/ui/state/scoreState.js';
import { transportState } from '../../../src/ui/state/transportState.js';

function mount(): HTMLElement {
  const el = document.createElement('mx-score-browser');
  document.body.appendChild(el);
  return el;
}

describe('mx-score-browser dialog shell (US1 #1, US1 #3, FR-004)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    browserState.reset();
  });

  it('opens with showModal() and focuses the search field', () => {
    const el = mount();
    const dialog = el.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(false);

    browserState.open();

    expect(dialog.open).toBe(true);
    const search = el.querySelector('[data-testid="browser-search"]') as HTMLInputElement;
    expect(document.activeElement).toBe(search);
  });

  it('Escape with an empty search closes the dialog and emits browserclose', () => {
    const el = mount();
    const dialog = el.querySelector('dialog') as HTMLDialogElement;
    browserState.open();

    const closed = new Promise<void>((resolve) => {
      el.addEventListener('browserclose', () => resolve(), { once: true });
    });
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));

    expect(dialog.open).toBe(false);
    expect(browserState.get().phase).toBe('closed');
    return closed;
  });

  it('Escape with a non-empty search clears the search and keeps the dialog open (contract §4)', () => {
    const el = mount();
    const dialog = el.querySelector('dialog') as HTMLDialogElement;
    browserState.open();
    browserState.setView({ search: 'sonat' });

    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));

    expect(dialog.open).toBe(true);
    expect(browserState.get().view.search).toBe('');
  });

  it('the close button closes the dialog and emits browserclose', () => {
    const el = mount();
    const dialog = el.querySelector('dialog') as HTMLDialogElement;
    browserState.open();

    const closed = new Promise<void>((resolve) => {
      el.addEventListener('browserclose', () => resolve(), { once: true });
    });
    (el.querySelector('.browser-close') as HTMLButtonElement).click();

    expect(dialog.open).toBe(false);
    return closed;
  });

  it('a click on the backdrop (target = the dialog itself) closes it and emits browserclose', () => {
    const el = mount();
    const dialog = el.querySelector('dialog') as HTMLDialogElement;
    browserState.open();

    const closed = new Promise<void>((resolve) => {
      el.addEventListener('browserclose', () => resolve(), { once: true });
    });
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(dialog.open).toBe(false);
    return closed;
  });

  it('a click inside the dialog body does not close it', () => {
    const el = mount();
    const dialog = el.querySelector('dialog') as HTMLDialogElement;
    browserState.open();

    const header = el.querySelector('.browser-header') as HTMLElement;
    header.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(dialog.open).toBe(true);
  });

  it('closing never touches scoreState or transportState (FR-004)', () => {
    const el = mount();
    const dialog = el.querySelector('dialog') as HTMLDialogElement;
    const scoreBefore = scoreState.getStatus();
    const transportBefore = transportState.get();

    browserState.open();
    (el.querySelector('.browser-close') as HTMLButtonElement).click();

    expect(dialog.open).toBe(false);
    expect(scoreState.getStatus()).toEqual(scoreBefore);
    expect(transportState.get()).toEqual(transportBefore);
  });

  it('the folder picker toggles the rail overlay open class, closed again by a folder/row selection (contract §1)', () => {
    const el = mount();
    const rail = document.createElement('mx-browser-rail');
    el.querySelector('.browser-body')?.appendChild(rail);
    browserState.open();

    (el.querySelector('.browser-folder-picker') as HTMLButtonElement).click();
    expect(rail.classList.contains('browser-rail-overlay-open')).toBe(true);

    el.dispatchEvent(new CustomEvent('browserviewchange', { detail: { view: { folder: { kind: 'all' } } } }));
    expect(rail.classList.contains('browser-rail-overlay-open')).toBe(false);
  });

  it('a row selection opens the detail overlay; Back closes it without changing the selection', () => {
    const el = mount();
    const detail = document.createElement('mx-browser-detail');
    el.querySelector('.browser-body')?.appendChild(detail);
    browserState.open();

    browserState.setView({ selected: { kind: 'library', id: 'x' } });
    el.dispatchEvent(
      new CustomEvent('browserviewchange', {
        detail: { view: { selected: { kind: 'library', id: 'x' } } },
      }),
    );
    expect(detail.classList.contains('browser-detail-overlay-open')).toBe(true);

    (el.querySelector('.browser-back') as HTMLButtonElement).click();
    expect(detail.classList.contains('browser-detail-overlay-open')).toBe(false);
    expect(browserState.get().view.selected).toEqual({ kind: 'library', id: 'x' });
  });

  it('the breadcrumb shows the current folder label', () => {
    const el = mount();
    browserState.open();
    expect(el.querySelector('.browser-breadcrumb')?.textContent).toBe('Continue');

    browserState.setView({ folder: { kind: 'myFiles' } });
    expect(el.querySelector('.browser-breadcrumb')?.textContent).toBe('My files');
  });

  it('focus returns to the invoker on close', () => {
    const invoker = document.createElement('button');
    document.body.appendChild(invoker);
    invoker.focus();
    rememberInvoker(invoker);

    const el = mount();
    browserState.open();
    (el.querySelector('.browser-close') as HTMLButtonElement).click();

    expect(document.activeElement).toBe(invoker);
  });
});
