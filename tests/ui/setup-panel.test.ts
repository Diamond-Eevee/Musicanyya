import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PlayRun } from '../../src/core/play/types.js';
import '../../src/ui/elements/mx-menu.js';
import '../../src/ui/elements/mx-play-panel.js';
import '../../src/ui/elements/mx-practice-panel.js';
import { mountPanels, type PanelTools } from '../../src/ui/layout/panel-host.js';
import { playState } from '../../src/ui/state/playState.js';
import { practiceState } from '../../src/ui/state/practiceState.js';
import { scoreState } from '../../src/ui/state/scoreState.js';
import { transportState } from '../../src/ui/state/transportState.js';
import { PANEL_IDS, viewState } from '../../src/ui/state/viewState.js';

const hands = [{ preset: 'both', partIndex: 0, staves: [1, 2] }] as const;
const practiceSetup = {
  parts: [{ partIndex: 0, name: 'Piano', staves: 2 }],
  hands,
  selection: hands[0],
  accompaniment: true,
  help: true,
  measureCount: 4,
  loop: null,
};

function mountSetup(): { practice: HTMLElement; play: HTMLElement; panel: HTMLElement } {
  const practice = document.createElement('mx-practice-panel');
  const play = document.createElement('mx-play-panel');
  const host = document.createElement('div');
  document.body.appendChild(host);
  const empty = () => [document.createElement('span')];
  const tools = Object.fromEntries(PANEL_IDS.map((id) => [id, empty()])) as PanelTools;
  tools.setup = [practice, play];
  mountPanels(host, tools);
  return { practice, play, panel: host.querySelector('mx-panel[data-panel="setup"]') as HTMLElement };
}

/** FR-007 / FR-018: one `setup` popup, showing the setup of the current mode, with the same elements as before. */
describe('the setup popup', () => {
  // A Score is open for the whole file, so the Setup entry is only ever disabled by a run, never by "no Score".
  beforeAll(() => {
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
  });

  afterEach(() => {
    document.body.innerHTML = '';
    practiceState.setMode('listen');
    practiceState.setSetup(null);
    playState.setSetup(null);
    playState.setRun(null);
    transportState.stop();
    viewState.closePanel();
    vi.restoreAllMocks();
  });

  it('holds both setup elements unchanged, in one panel', () => {
    const { practice, play, panel } = mountSetup();
    expect(practice.parentElement).toBe(panel);
    expect(play.parentElement).toBe(panel);
  });

  it('shows the Practice setup in Practice mode and not the Play setup', () => {
    const { practice, play } = mountSetup();
    practiceState.setSetup(practiceSetup);
    practiceState.setMode('practice');
    expect(practice.hidden).toBe(false);
    expect(play.hidden).toBe(true);
  });

  it('shows the Play setup in Play mode and not the Practice setup', () => {
    const { practice, play } = mountSetup();
    practiceState.setSetup(practiceSetup);
    playState.setSetup({
      hands,
      settings: {
        range: null,
        tempoPercent: 100,
        selection: hands[0],
        strictness: 'beginner',
        countInMeasures: 1,
        metronomeMuted: false,
        accompaniment: true,
      },
      measureCount: 4,
      parts: practiceSetup.parts,
    } as never);
    practiceState.setMode('play');
    expect(play.hidden).toBe(false);
    expect(practice.hidden).toBe(true);
  });

  it('still emits the same setup-change events as before it moved into a popup', () => {
    const { practice } = mountSetup();
    practiceState.setSetup(practiceSetup);
    practiceState.setMode('practice');
    const changes: unknown[] = [];
    practice.addEventListener('practicesetup', (event) => changes.push((event as CustomEvent).detail));
    (practice.querySelector('input[name="hands"]') as HTMLInputElement | null)?.click();
    (practice.querySelector('input[type="checkbox"]') as HTMLInputElement | null)?.click();
    expect(changes.length).toBeGreaterThan(0);
  });

  describe('the Setup menu entry while a run is active (FR-007)', () => {
    const entry = () =>
      document.querySelector('mx-menu[menu="setup"]')?.shadowRoot?.querySelector('[data-panel="setup"]') as
        | HTMLButtonElement
        | undefined;

    it('is enabled when idle, and every entry is disabled during a Listen run (no popup over the music)', () => {
      const menu = document.createElement('mx-menu');
      menu.setAttribute('menu', 'setup');
      document.body.appendChild(menu);
      expect(entry()?.disabled).toBe(false);
      transportState.setSoundReady(true);
      transportState.play();
      expect(entry()?.disabled).toBe(true);
      for (const item of menu.shadowRoot?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []) {
        expect(item.disabled, item.dataset.panel).toBe(true);
      }
      transportState.stop();
      for (const item of menu.shadowRoot?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []) {
        expect(item.disabled, item.dataset.panel).toBe(false);
      }
    });

    it('is disabled during a Play run and comes back when the run is over', () => {
      const menu = document.createElement('mx-menu');
      menu.setAttribute('menu', 'setup');
      document.body.appendChild(menu);
      practiceState.setMode('play');
      playState.setRun({ phase: 'running' } as unknown as PlayRun);
      expect(entry()?.disabled).toBe(true);
      playState.setRun({ phase: 'finished' } as unknown as PlayRun);
      expect(entry()?.disabled).toBe(false);
    });
  });
});
