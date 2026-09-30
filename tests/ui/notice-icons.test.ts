import { afterEach, describe, expect, it } from 'vitest';
import '../../src/ui/elements/mx-notice-tray.js';
import { en } from '../../src/ui/i18n/en.js';
import { noticeState } from '../../src/ui/state/noticeState.js';
import { viewState } from '../../src/ui/state/viewState.js';

/** Feature 016 US4 (FR-018, research R-9): a notice says what kind it is by an icon as well as its edge colour. */
describe('notice icons', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    noticeState.clear();
    viewState.setOverlay('notices', true);
  });

  const mount = () => {
    const el = document.createElement('mx-notice-tray');
    document.body.appendChild(el);
    return el;
  };
  const iconOf = (notice: Element) => notice.querySelector('svg');
  const pathData = (svg: SVGElement | null) =>
    Array.from(svg?.querySelectorAll('path, circle') ?? [])
      .map((shape) => shape.outerHTML)
      .join('');

  it('a warning shows a named warning icon, an information notice a different named icon, and the text is unchanged', () => {
    noticeState.addNotice({ code: 'malformedXml', severity: 'warning' });
    noticeState.addNotice({ code: 'unsupportedElement', severity: 'info' });
    const el = mount();
    const warning = el.querySelector('.notice.warning');
    const info = el.querySelector('.notice.info');
    expect(warning).not.toBeNull();
    expect(info).not.toBeNull();

    const warningIcon = iconOf(warning as Element);
    expect(warningIcon?.getAttribute('role')).toBe('img');
    expect(warningIcon?.getAttribute('aria-label')).toBe(en.notices.iconWarning);
    expect(en.notices.iconWarning).toBe('Warning');

    const infoIcon = iconOf(info as Element);
    expect(infoIcon?.getAttribute('role')).toBe('img');
    expect(infoIcon?.getAttribute('aria-label')).toBe(en.notices.iconInfo);
    expect(en.notices.iconInfo).toBe('Information');

    expect(pathData(warningIcon).length).toBeGreaterThan(0);
    expect(pathData(infoIcon).length).toBeGreaterThan(0);
    expect(pathData(warningIcon)).not.toBe(pathData(infoIcon));

    // The notice's own text is exactly what it was: the sentence, then the Dismiss button.
    expect(warning?.textContent?.replace(/\s+/g, ' ').trim()).toBe(`${en.notices.malformedXml} Dismiss`);
    expect(info?.textContent?.replace(/\s+/g, ' ').trim()).toBe(`${en.notices.unsupportedElement} Dismiss`);
  });
});
