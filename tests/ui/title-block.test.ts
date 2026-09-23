import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../src/ui/elements/mx-score-view.js';
import type { MxScoreView } from '../../src/ui/elements/mx-score-view.js';
import { scoreState } from '../../src/ui/state/scoreState.js';

describe('title block (US5)', () => {
  let el: MxScoreView;

  beforeEach(() => {
    vi.useFakeTimers();
    el = document.createElement('mx-score-view') as MxScoreView;
    document.body.appendChild(el);
    vi.spyOn(el, 'clientWidth', 'get').mockReturnValue(1200);
  });

  afterEach(() => {
    el.remove();
    vi.restoreAllMocks();
  });

  function setSummary(
    title: string | null,
    composer: string | null,
    arranger: string | null,
    fileName = 'test.xml',
  ) {
    scoreState.succeeded({
      fileName,
      summary: {
        title,
        composer,
        arranger,
        parts: [],
        measureCount: 1,
        measureIds: [],
        defaultTempoUsed: false,
      },
      report: { entries: [] },
      renderXml: '',
      contentHash: '',
    });
    // Force render
    (el as any).applyPageCount(0);
    vi.advanceTimersByTime(100);
  }

  function getTitleBlock() {
    return el.querySelector('.mx-title-block') as HTMLElement | null;
  }

  it('renders a title block before page 1 with title, composer, "arr. <name>"', () => {
    setSummary('My Title', 'Composer Name', 'Arranger Name');
    const block = getTitleBlock();
    expect(block).not.toBeNull();
    const text = block!.textContent ?? '';
    expect(text).toContain('My Title');
    expect(text).toContain('Composer Name');
    expect(text).toContain('arr. Arranger Name');
  });

  it('falls back to file name without a title', () => {
    setSummary(null, 'Composer', null, 'fur-elise.musicxml');
    const block = getTitleBlock();
    expect(block).not.toBeNull();
    expect(block!.textContent).toContain('fur-elise.musicxml');
  });

  it('omits missing lines', () => {
    setSummary('Only Title', null, null);
    const block = getTitleBlock();
    expect(block).not.toBeNull();
    const html = block!.innerHTML;
    // ensure no undefined/null rendered, and no empty blocks for composer/arranger if possible
    expect(html).not.toContain('null');
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('arr.'); // since arranger is missing
  });
});
