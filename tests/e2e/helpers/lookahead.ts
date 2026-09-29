import { expect, type Page } from '@playwright/test';

export interface Span {
  top: number;
  bottom: number;
}

/** One settled view after a system change: boxes in viewport px, clear space as follow-view.md defines it. */
export interface FitObservation {
  /** The system's index within its page. */
  systemIndex: number;
  page: number;
  clearTop: number;
  clearBottom: number;
  current: Span;
  /** null: the cursor's system is the Score's last; `nextKnown` false: the next page is not mounted. */
  next: Span | null;
  nextKnown: boolean;
  /** The next system's first `g.staff` (its upper staff in the first measure). */
  nextStaff: Span | null;
}

export interface FitRun {
  observations: FitObservation[];
  /** Every change of the cursor's system: page, index in the page, ms since the first change. */
  changes: [number, number, number][];
  systemChanges: number;
  /** System changes left again before the view settled (never observed). */
  unsettled: number;
  /** 1 when the run was stopped before its last system change was observed, else 0. */
  pendingAtEnd: number;
  dialogsSeen: number;
  noticesBefore: number;
  noticesMax: number;
}

export interface ObserveOptions {
  /** The earliest observation after a system change, in ms (the glide has had its time). */
  afterChangeMs: number;
  /** How long the view must also have been still, in ms. */
  stillMs: number;
  /** Listen to the end of the run (the default), or stop it once this many page changes have been observed. */
  untilPageChanges?: number;
  timeoutMs: number;
}

/** Page changes among the observations: consecutive observed systems on different pages. */
export function pageChanges(run: FitRun): number {
  return run.observations.filter((o, i) => i > 0 && o.page !== run.observations[i - 1]?.page).length;
}

const phase = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __TRANSPORT_STATE__: { get(): { phase: string } } }).__TRANSPORT_STATE__.get().phase,
  );

/**
 * Starts Listen, and at every change of the cursor's system (the `g.system` of a `.playing` note) waits until the view
 * has settled - at least `afterChangeMs` after the change and `scrollTop` unchanged for `stillMs` - then records the
 * current and the next system in reading order: the next `g.system` of its page, else the first one of the next
 * `.mx-score-page` (`nextKnown` false when that page is not mounted). Also samples every frame for a visible
 * `role="dialog"` and for the notice count. Returns when the run has ended, or once `untilPageChanges` page changes
 * have been observed (the run is then stopped).
 */
export async function listenAndObserve(page: Page, opts: ObserveOptions): Promise<FitRun> {
  await page.evaluate(
    ({ afterChangeMs, stillMs }) => {
      const w = window as unknown as { __FIT_RUN__: FitRun; __FIT_STOP__: boolean };
      const run: FitRun = {
        observations: [],
        changes: [],
        systemChanges: 0,
        unsettled: 0,
        pendingAtEnd: 0,
        dialogsSeen: 0,
        noticesBefore: document.querySelectorAll('mx-notice-tray .notice').length,
        noticesMax: 0,
      };
      w.__FIT_RUN__ = run;
      w.__FIT_STOP__ = false;
      const scroller = document.querySelector('.mx-score-scroll') as HTMLElement;
      const box = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom };
      };
      let current: Element | null = null;
      let changedAt = 0;
      let firstChangeAt = 0;
      let observed = true;
      let lastScroll = scroller.scrollTop;
      let stillSince = performance.now();

      const observe = (sys: Element) => {
        const pageEl = sys.closest('.mx-score-page') as HTMLElement;
        const pageNo = Number(pageEl.dataset.page);
        const inPage = Array.from(pageEl.querySelectorAll('g.system'));
        const index = inPage.indexOf(sys);
        let next: Element | null = inPage[index + 1] ?? null;
        let nextKnown = true;
        if (!next) {
          const nextPage = document.querySelector(`.mx-score-page[data-page="${pageNo + 1}"]`);
          if (nextPage) {
            next = nextPage.querySelector('g.system');
            nextKnown = next !== null;
          }
        }
        const rect = scroller.getBoundingClientRect();
        const inset = Number.parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue('--mx-inset-bottom'),
        );
        const staff = next?.querySelector('g.staff') ?? null;
        run.observations.push({
          systemIndex: index,
          page: pageNo,
          clearTop: rect.top,
          clearBottom: rect.top + scroller.clientHeight - (Number.isFinite(inset) ? inset : 0),
          current: box(sys),
          next: next ? box(next) : null,
          nextKnown,
          nextStaff: staff ? box(staff) : null,
        });
      };

      const frame = () => {
        if (w.__FIT_STOP__) {
          run.pendingAtEnd = observed ? 0 : 1;
          return;
        }
        const now = performance.now();
        if (Math.abs(scroller.scrollTop - lastScroll) > 0.5) stillSince = now;
        lastScroll = scroller.scrollTop;
        const dialogs = Array.from(document.querySelectorAll('[role="dialog"]')).filter(
          (el) => (el as HTMLElement).checkVisibility?.() ?? (el as HTMLElement).offsetParent !== null,
        );
        run.dialogsSeen = Math.max(run.dialogsSeen, dialogs.length);
        run.noticesMax = Math.max(run.noticesMax, document.querySelectorAll('mx-notice-tray .notice').length);

        const sys = document.querySelector('g.note.playing')?.closest('g.system') ?? null;
        // A system is its page and its index in the page: a page mounted again has new elements for the same systems.
        const sysKey = (el: Element) => {
          const pg = el.closest('.mx-score-page') as HTMLElement;
          return `${pg.dataset.page}:${Array.from(pg.querySelectorAll('g.system')).indexOf(el)}`;
        };
        if (sys && current && sys !== current && sysKey(sys) === sysKey(current)) current = sys;
        if (sys && sys !== current) {
          if (!observed) run.unsettled++;
          const sysPage = sys.closest('.mx-score-page') as HTMLElement;
          if (run.changes.length === 0) firstChangeAt = now;
          run.changes.push([
            Number(sysPage.dataset.page),
            Array.from(sysPage.querySelectorAll('g.system')).indexOf(sys),
            Math.round(now - firstChangeAt),
          ]);
          current = sys;
          changedAt = now;
          observed = false;
          run.systemChanges++;
        }
        if (current && !observed && now - changedAt >= afterChangeMs && now - stillSince >= stillMs) {
          observe(current);
          observed = true;
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    },
    { afterChangeMs: opts.afterChangeMs, stillMs: opts.stillMs },
  );

  await page.locator('.play-btn').click();
  await expect.poll(() => phase(page), { timeout: 10_000 }).toBe('playing');
  if (opts.untilPageChanges === undefined) {
    // The last system's observation is due `afterChangeMs` after it began; the loop keeps running after the run ends.
    await expect.poll(() => phase(page), { timeout: opts.timeoutMs, intervals: [500] }).not.toBe('playing');
  } else {
    const wanted = opts.untilPageChanges;
    await expect
      .poll(
        async () => {
          const run = await page.evaluate(() => (window as unknown as { __FIT_RUN__: FitRun }).__FIT_RUN__);
          return pageChanges(run) >= wanted || (await phase(page)) !== 'playing';
        },
        { timeout: opts.timeoutMs, intervals: [250] },
      )
      .toBe(true);
  }
  await page.evaluate(() => {
    (window as unknown as { __FIT_STOP__: boolean }).__FIT_STOP__ = true;
  });
  // One more frame, so the loop sees the stop and records whether the last change was observed.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  if ((await phase(page)) === 'playing') await page.locator('.stop-btn').click();
  return page.evaluate(() => (window as unknown as { __FIT_RUN__: FitRun }).__FIT_RUN__);
}
