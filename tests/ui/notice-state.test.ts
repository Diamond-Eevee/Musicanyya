import { describe, expect, it } from 'vitest';
import { noticeState } from '../../src/ui/state/noticeState.js';
import { createStore } from '../../src/ui/state/store.js';

// We might need to mock Date or use fake timers, but let's test basic logic first
describe('noticeState', () => {
  it('adds a notice and groups by code within merge window', () => {
    // Assuming noticeState is a store or exposes methods
    noticeState.clear();

    noticeState.addNotice({ code: 'unsupportedElement', severity: 'info', element: 'harmony', measureLabel: '1' });
    noticeState.addNotice({ code: 'unsupportedElement', severity: 'info', element: 'harmony', measureLabel: '2' });

    const notices = noticeState.getNotices();
    expect(notices).toHaveLength(1);
    expect(notices[0].measureLabels).toEqual(['1', '2']);
    expect(notices[0].count).toBe(2);
  });

  it('dismisses a notice by id', () => {
    noticeState.clear();
    const id = noticeState.addNotice({ code: 'tempoTextIgnored', severity: 'warning', measureLabel: '1' });

    expect(noticeState.getNotices()).toHaveLength(1);
    noticeState.dismiss(id);
    expect(noticeState.getNotices()).toHaveLength(0);
  });
});
