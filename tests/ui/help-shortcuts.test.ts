import { afterEach, describe, expect, it } from 'vitest';
import '../../src/ui/elements/mx-help-notation.js';
import { en } from '../../src/ui/i18n/en.js';

/** T050 / research R-4: the Help popup lists the keyboard shortcuts, including the Escape precedence rule. */
describe('Help: keyboard shortcuts', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  const rows = () => {
    const help = document.createElement('mx-help-notation');
    document.body.appendChild(help);
    const section = help.querySelector('.mx-help-shortcuts');
    return {
      section,
      rows: Array.from(section?.querySelectorAll('tbody tr') ?? []).map((row) =>
        Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim() ?? ''),
      ),
    };
  };

  it('has a shortcuts section with its own heading', () => {
    const { section } = rows();
    expect(section?.querySelector('h3')?.textContent).toBe(en.help.shortcuts.title);
  });

  it('lists play/pause and the Escape rule: close the popup first, only otherwise stop', () => {
    const escapeRow = rows().rows.find(([keys]) => keys === 'Esc');
    expect(escapeRow?.[1]).toMatch(/popup/i);
    expect(escapeRow?.[1]).toMatch(/stop/i);
    expect(rows().rows.some(([keys]) => keys === 'Space')).toBe(true);
  });

  it('lists the bare size keys and the Ctrl/Cmd forms, including the reset', () => {
    const keys = rows()
      .rows.map(([k]) => k)
      .join(' | ');
    expect(keys).toContain('+');
    expect(keys).toContain('-');
    expect(keys).toMatch(/Ctrl\/Cmd \+ 0/);
    expect(keys).toMatch(/Ctrl\/Cmd/);
  });

  it('gives every row both the keys and what they do', () => {
    for (const [keys, action] of rows().rows) {
      expect(keys?.length).toBeGreaterThan(0);
      expect(action?.length).toBeGreaterThan(0);
    }
  });
});
