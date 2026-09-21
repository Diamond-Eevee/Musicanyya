import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayRun } from '../../src/core/play/types.js';
import type { PracticeSession } from '../../src/core/practice/types.js';
import '../../src/ui/elements/mx-run-status.js';
import { en } from '../../src/ui/i18n/en.js';
import { midiState } from '../../src/ui/state/midiState.js';
import { noticeState } from '../../src/ui/state/noticeState.js';
import { playState } from '../../src/ui/state/playState.js';
import { practiceState } from '../../src/ui/state/practiceState.js';
import { runPositionState } from '../../src/ui/state/runPositionState.js';
import { deriveRunStatus, type RunStatusInputs } from '../../src/ui/state/runStatus.js';
import { transportState } from '../../src/ui/state/transportState.js';

const idle = (): RunStatusInputs => ({
  transport: { ...transportState.get(), phase: 'stopped' },
  practice: { ...practiceState.get(), mode: 'listen', session: null },
  run: null,
  midiConnected: false,
  noticeCodes: [],
  measureIndex: null,
});

/** `data-model.md` section 3, `ui-shell.md` section 6: what the slim bar shows while a run is active (FR-008). */
describe('deriveRunStatus', () => {
  it('is idle when nothing is running, whatever the mode', () => {
    for (const mode of ['listen', 'practice', 'play'] as const) {
      const status = deriveRunStatus({ ...idle(), practice: { ...idle().practice, mode } });
      expect(status).toMatchObject({ mode, phase: 'idle', canStop: false, measureLabel: null });
    }
  });

  it('Listen follows the transport', () => {
    const base = idle();
    const playing = deriveRunStatus({ ...base, transport: { ...base.transport, phase: 'playing' }, measureIndex: 2 });
    expect(playing).toMatchObject({ mode: 'listen', phase: 'running', canStop: true, measureLabel: '3' });
    const paused = deriveRunStatus({ ...base, transport: { ...base.transport, phase: 'paused' }, measureIndex: 2 });
    expect(paused).toMatchObject({ phase: 'paused', canStop: true });
    const loading = deriveRunStatus({ ...base, transport: { ...base.transport, phase: 'loading' } });
    expect(loading.phase).toBe('idle');
  });

  it('Practice is running while a session is not finished, and finished after', () => {
    const base = idle();
    const session = (phase: string) => ({ phase }) as unknown as PracticeSession;
    const practice = (phase: string) => ({ ...base.practice, mode: 'practice' as const, session: session(phase) });
    expect(deriveRunStatus({ ...base, practice: practice('waiting'), measureIndex: 0 })).toMatchObject({
      mode: 'practice',
      phase: 'running',
      canStop: true,
      measureLabel: '1',
    });
    expect(deriveRunStatus({ ...base, practice: practice('finished') })).toMatchObject({
      phase: 'finished',
      canStop: false,
    });
  });

  it('Play follows the run: count-in, running, then finished for every way a run can end', () => {
    const base = idle();
    const play = (phase: string) => ({
      ...base,
      practice: { ...base.practice, mode: 'play' as const },
      run: { phase } as unknown as PlayRun,
      measureIndex: 4,
    });
    expect(deriveRunStatus(play('countIn'))).toMatchObject({ mode: 'play', phase: 'countIn', canStop: true });
    expect(deriveRunStatus(play('running'))).toMatchObject({ phase: 'running', canStop: true, measureLabel: '5' });
    for (const ended of ['finished', 'stopped', 'aborted']) {
      expect(deriveRunStatus(play(ended)), ended).toMatchObject({ phase: 'finished', canStop: false });
    }
    expect(deriveRunStatus(play('idle')).phase).toBe('idle');
  });

  it('shows no measure when the run is idle, even if a position is still known', () => {
    expect(deriveRunStatus({ ...idle(), measureIndex: 7 }).measureLabel).toBeNull();
  });

  describe('device state', () => {
    it('is ok in Listen without a keyboard, since Listen needs none', () => {
      expect(deriveRunStatus(idle()).deviceState).toBe('ok');
    });

    it('is noMidi in Practice and Play with no connected keyboard, ok with one', () => {
      for (const mode of ['practice', 'play'] as const) {
        const base = { ...idle(), practice: { ...idle().practice, mode } };
        expect(deriveRunStatus(base).deviceState).toBe('noMidi');
        expect(deriveRunStatus({ ...base, midiConnected: true }).deviceState).toBe('ok');
      }
    });

    it('is midiLost after a keyboard-lost notice, until the matching back notice', () => {
      const base = { ...idle(), practice: { ...idle().practice, mode: 'play' as const }, midiConnected: false };
      expect(deriveRunStatus({ ...base, noticeCodes: ['playMidiLost'] }).deviceState).toBe('midiLost');
      expect(deriveRunStatus({ ...base, noticeCodes: ['practiceDeviceLost'] }).deviceState).toBe('midiLost');
      expect(deriveRunStatus({ ...base, noticeCodes: ['playMidiLost', 'playMidiBack'] }).deviceState).not.toBe(
        'midiLost',
      );
    });

    it('is audioLost after an audio-device notice, ahead of any keyboard state', () => {
      const base = { ...idle(), noticeCodes: ['playAudioLost', 'midiDeviceLost'] };
      expect(deriveRunStatus(base).deviceState).toBe('audioLost');
      expect(deriveRunStatus({ ...idle(), noticeCodes: ['audioDeviceChanged'] }).deviceState).toBe('audioLost');
    });
  });
});

const status = () => document.querySelector('mx-run-status') as HTMLElement;

describe('mx-run-status', () => {
  beforeEach(() => {
    document.body.appendChild(document.createElement('mx-run-status'));
  });

  afterEach(() => {
    document.body.innerHTML = '';
    transportState.stop();
    practiceState.setMode('listen');
    practiceState.setSession(null);
    playState.clear();
    noticeState.clear();
    midiState.devices = [];
    midiState.emit();
    runPositionState.set(null);
    vi.restoreAllMocks();
  });

  it('is a polite live region, so a mode or device change is announced without taking focus', () => {
    expect(status().getAttribute('aria-live')).toBe('polite');
    expect(status().getAttribute('role')).toBe('status');
  });

  it('is empty when idle: no text and no Stop control', () => {
    expect(status().textContent?.trim()).toBe('');
    expect(status().querySelector('button')).toBeNull();
  });

  it('shows mode, current measure and a working Stop while Listen plays', () => {
    const stop = vi.spyOn(transportState, 'stop').mockImplementation(() => undefined);
    transportState.setSoundReady(true);
    transportState.play();
    runPositionState.set(2);

    expect(status().textContent).toContain(en.run.mode.listen);
    expect(status().textContent).toContain(en.run.measure.replace('{n}', '3'));
    const button = status().querySelector('button') as HTMLButtonElement;
    expect(button.textContent?.trim()).toBe(en.run.stop);
    button.click();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('follows the Play run through its count-in', () => {
    practiceState.setMode('play');
    playState.setRun({ phase: 'countIn' } as unknown as PlayRun);
    expect(status().textContent).toContain(en.run.mode.play);
    expect(status().textContent).toContain(en.run.phase.countIn);
    expect(status().querySelector('button')).not.toBeNull();

    playState.setRun({ phase: 'finished' } as unknown as PlayRun);
    expect(status().querySelector('button')).toBeNull();
  });

  it('follows the Practice session', () => {
    practiceState.setMode('practice');
    practiceState.setSession({ phase: 'waiting' } as unknown as PracticeSession);
    runPositionState.set(0);
    expect(status().textContent).toContain(en.run.mode.practice);
    expect(status().textContent).toContain(en.run.measure.replace('{n}', '1'));
  });

  it('says why when a device is missing or lost, in words', () => {
    practiceState.setMode('practice');
    practiceState.setSession({ phase: 'waiting' } as unknown as PracticeSession);
    expect(status().textContent).toContain(en.run.device.noMidi);

    noticeState.addNotice({ code: 'practiceDeviceLost', severity: 'warning' });
    expect(status().textContent).toContain(en.run.device.midiLost);

    noticeState.clear();
    noticeState.addNotice({ code: 'playAudioLost', severity: 'warning' });
    expect(status().textContent).toContain(en.run.device.audioLost);
  });

  it('a connected keyboard clears the missing-keyboard note', () => {
    practiceState.setMode('practice');
    practiceState.setSession({ phase: 'waiting' } as unknown as PracticeSession);
    midiState.devices = [{ id: '1', name: 'Keys', manufacturer: 'M', connected: true }];
    midiState.emit();
    expect(status().textContent).not.toContain(en.run.device.noMidi);
  });

  it('holds no state of its own: a new element shows the same as the first', () => {
    transportState.setSoundReady(true);
    transportState.play();
    runPositionState.set(5);
    const second = document.createElement('mx-run-status');
    document.body.appendChild(second);
    expect(second.textContent).toBe(status().textContent);
  });

  it('stops updating once removed', () => {
    const el = status();
    el.remove();
    transportState.setSoundReady(true);
    transportState.play();
    expect(el.textContent?.trim()).toBe('');
  });
});
