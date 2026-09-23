import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../src/ui/elements/mx-score-view.js';
import type { MxScoreView } from '../../src/ui/elements/mx-score-view.js';
import type { PageLayout } from '../../src/ui/score/pages.js';
import { scoreState } from '../../src/ui/state/scoreState.js';

/** The private members these tests drive: page placeholders are built when Verovio reports its page count. */
interface ScoreViewInternals {
  applyPageCount(pageCount: number): void;
  layouts: PageLayout[];
}

describe('title block (006 US5, FR-017, T039/T058)', () => {
  let el: MxScoreView;
  const internals = () => el as unknown as ScoreViewInternals;

  beforeEach(() => {
    vi.useFakeTimers();
    el = document.createElement('mx-score-view') as MxScoreView;
    document.body.appendChild(el);
    vi.spyOn(el, 'clientWidth', 'get').mockReturnValue(1200);
  });

  afterEach(() => {
    el.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function load(title: string | null, composer: string | null, arranger: string | null, fileName = 'test.xml') {
    scoreState.succeeded({
      fileName,
      summary: { title, composer, arranger, parts: [], measureCount: 1, measureIds: [], defaultTempoUsed: false },
      report: { entries: [] },
      renderXml: '',
      contentHash: '',
    });
    internals().applyPageCount(2);
    vi.advanceTimersByTime(100);
  }

  const block = () => el.querySelector<HTMLElement>('.mx-title-block');

  it('renders the block before page 1: title, then composer and "arr. <name>" on one credits line', () => {
    load('My Title', 'Composer Name', 'Arranger Name');
    const titleBlock = block();
    expect(titleBlock?.nextElementSibling?.getAttribute('data-page')).toBe('1');
    expect(titleBlock?.querySelector('h1')?.textContent).toBe('My Title');
    const credits = titleBlock?.querySelectorAll('.mx-title-credits');
    expect(credits).toHaveLength(1);
    expect(credits?.[0]?.querySelector('.mx-title-composer')?.textContent).toBe('Composer Name');
    expect(credits?.[0]?.querySelector('.mx-title-arranger')?.textContent).toBe('arr. Arranger Name');
  });

  it('falls back to the file name without a title', () => {
    load(null, 'Composer', null, 'fur-elise.musicxml');
    expect(block()?.querySelector('h1')?.textContent).toBe('fur-elise.musicxml');
  });

  it('leaves out missing lines', () => {
    load('Only Title', null, null);
    expect(block()?.querySelector('.mx-title-credits')).toBeNull();
    expect(block()?.textContent).toBe('Only Title');
  });

  it('page 1 starts at the drawn height of the block, whatever it is (a long title wraps onto more lines)', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('mx-title-block') ? 97 : 0;
    });
    load('A very long title that wraps onto a second line on a narrow screen', 'Composer', null);
    expect(internals().layouts.map((l) => l.top)).toEqual([97, 97 + (internals().layouts[0]?.height ?? 0)]);
  });
});
