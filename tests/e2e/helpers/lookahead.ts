import type { Page } from '@playwright/test';

export interface SystemObservation {
  systemIndex: number;
  currentBox: { top: number; bottom: number; height: number };
  nextBox: { top: number; bottom: number; height: number } | null;
  fitsTogether: boolean;
  currentVisible: boolean;
  nextVisible: boolean;
  bothVisible: boolean;
  pageChanged: boolean;
}

/**
 * Tracks system transitions during playback and records visibility of current and next system boxes
 * in the clear space after the view has been still for 700 ms.
 */
export async function installLookaheadTracker(page: Page): Promise<() => Promise<SystemObservation[]>> {
  await page.evaluate(() => {
    const observations: SystemObservation[] = [];
    (window as unknown as { __LOOKAHEAD_OBSERVATIONS__: SystemObservation[] }).__LOOKAHEAD_OBSERVATIONS__ =
      observations;
    let lastSystem: Element | null = null;
    let lastPage: Element | null = null;

    function getClearSpace() {
      const scroller = document.querySelector('.mx-score-scroll') as HTMLElement;
      if (!scroller) return { top: 0, bottom: 0, height: 0 };
      const rect = scroller.getBoundingClientRect();
      const style = getComputedStyle(document.documentElement);
      const insetBottom = parseFloat(style.getPropertyValue('--mx-inset-bottom')) || 0;
      return {
        top: rect.top,
        bottom: rect.bottom - insetBottom,
        height: rect.height - insetBottom,
      };
    }

    function checkObservation(currentSys: Element, pageChanged: boolean) {
      const allSystems = Array.from(document.querySelectorAll('.mx-score-page g.system'));
      const currentIndex = allSystems.indexOf(currentSys);
      const nextSys = currentIndex >= 0 && currentIndex + 1 < allSystems.length ? allSystems[currentIndex + 1] : null;

      const clear = getClearSpace();
      const curRect = currentSys.getBoundingClientRect();
      const currentBox = { top: curRect.top, bottom: curRect.bottom, height: curRect.height };

      let nextBox: { top: number; bottom: number; height: number } | null = null;
      let nextVisible = true;
      let fitsTogether = true;

      if (nextSys) {
        const nextRect = nextSys.getBoundingClientRect();
        nextBox = { top: nextRect.top, bottom: nextRect.bottom, height: nextRect.height };
        fitsTogether = nextRect.bottom - curRect.top <= clear.height + 1;
        nextVisible = nextRect.top >= clear.top - 1 && nextRect.bottom <= clear.bottom + 1;
      }

      const currentVisible = curRect.top >= clear.top - 1 && curRect.bottom <= clear.bottom + 1;
      const bothVisible = currentVisible && (nextSys ? nextVisible : true);

      observations.push({
        systemIndex: currentIndex,
        currentBox,
        nextBox,
        fitsTogether,
        currentVisible,
        nextVisible,
        bothVisible,
        pageChanged,
      });
    }

    const interval = setInterval(() => {
      let currentSys: Element | null = null;
      const playingNote = document.querySelector('g.note.playing');
      if (playingNote) {
        currentSys = playingNote.closest('g.system');
      } else {
        const band = document.querySelector('.mx-practice-band');
        if (band && !band.hasAttribute('hidden')) {
          const practiceState = (
            window as unknown as {
              __PRACTICE_STATE__?: {
                get?: () => { session?: { currentEvent?: { measureIndex?: number } } };
              };
            }
          ).__PRACTICE_STATE__?.get?.();
          const measureIndex = practiceState?.session?.currentEvent?.measureIndex;
          if (measureIndex !== undefined) {
            const measureEl = document.querySelectorAll('.mx-score-page g.measure')[measureIndex];
            if (measureEl) currentSys = measureEl.closest('g.system');
          }
        }
      }

      if (currentSys && currentSys !== lastSystem) {
        const recordedSys = currentSys;
        const curPage = recordedSys.closest('.mx-score-page');
        const pageChanged = lastPage !== null && curPage !== null && curPage !== lastPage;
        lastSystem = recordedSys;
        lastPage = curPage;

        setTimeout(() => {
          checkObservation(recordedSys, pageChanged);
        }, 500);
      }
    }, 50);

    (
      window as unknown as { __GET_LOOKAHEAD_OBSERVATIONS__: () => SystemObservation[] }
    ).__GET_LOOKAHEAD_OBSERVATIONS__ = () => {
      clearInterval(interval);
      return observations;
    };
  });

  return async () => {
    return await page.evaluate(
      () =>
        (
          window as unknown as {
            __GET_LOOKAHEAD_OBSERVATIONS__?: () => SystemObservation[];
          }
        ).__GET_LOOKAHEAD_OBSERVATIONS__?.() ?? [],
    );
  };
}
