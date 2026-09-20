import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { probeEnvironment } from '../../src/engine/environment/probe.js';
import { createEnvironmentState, type EnvironmentState } from '../../src/ui/state/environmentState.js';
import '../../src/ui/elements/mx-environment-panel.js';

/** window.musicanyyaShell drives shell detection in probeEnvironment(), not in createEnvironmentState() itself
 * (Principle V: probing is the engine's job). Tests that simulate Electron must go through probeEnvironment()
 * for shell.kind to actually become 'electron'; forcing other capabilities keeps assertions independent of the
 * real (happy-dom) test environment's AudioWorklet/MIDI/IndexedDB support. */
function probedEnvWithForcedCapabilities() {
  return {
    ...probeEnvironment(),
    builtInSound: { available: true },
    midiInput: { available: true },
    audioPlugin: { available: true },
    recentScores: { available: true },
    compressedFiles: { available: true },
    secureContext: true,
  } as any;
}

describe('Environment Panel', () => {
  let envState: EnvironmentState;

  beforeEach(() => {
    delete (window as any).musicanyyaShell;
  });

  it('identifies as browser when bridge is absent', () => {
    const env = {
      shell: { kind: 'browser', browser: null },
      builtInSound: { available: true },
      midiInput: { available: true },
      audioPlugin: { available: true },
      recentScores: { available: true },
      compressedFiles: { available: true },
      secureContext: true,
    } as any;
    envState = createEnvironmentState(env);
    expect(envState.get().shell.kind).toBe('browser');
  });

  it('identifies as electron when bridge is present', () => {
    (window as any).musicanyyaShell = {
      kind: 'electron',
      bridgeVersion: '1.0.0',
      appVersion: '1.0.0',
      electronVersion: '44',
      chromeVersion: '128',
      platform: 'win32',
      audioPlugin: { available: false, reason: 'notYetAvailable' },
    };
    envState = createEnvironmentState(probedEnvWithForcedCapabilities());
    expect(envState.get().shell.kind).toBe('electron');
    if (envState.get().shell.kind === 'electron') {
      expect((envState.get().shell as any).bridgeVersion).toBe('1.0.0');
    }
  });

  it('handles unknown bridge version safely', () => {
    (window as any).musicanyyaShell = {
      kind: 'electron',
      bridgeVersion: '2.0.0', // unknown major
    };
    envState = createEnvironmentState(probedEnvWithForcedCapabilities());
    expect(envState.get().shell.kind).toBe('electron');
    expect(envState.get().isUnknownBridgeMajor).toBe(true);
  });

  describe('UI Rendering', () => {
    let panel: any;

    beforeEach(() => {
      panel = document.createElement('mx-environment-panel');
      document.body.appendChild(panel);
    });

    afterEach(() => {
      panel.remove();
    });

    it('renders browser shell info', () => {
      const env = {
        shell: { kind: 'browser', browser: null },
        builtInSound: { available: true },
        midiInput: { available: true },
        audioPlugin: { available: true },
        recentScores: { available: true },
        compressedFiles: { available: true },
        secureContext: true,
      } as any;
      envState = createEnvironmentState(env);
      panel.setEnvironment(envState);
      panel.toggle();
      const html = panel.innerHTML;
      expect(html).toContain('Browser');
    });

    it('renders desktop app info and capabilities', () => {
      (window as any).musicanyyaShell = {
        kind: 'electron',
        bridgeVersion: '1.0.0',
        appVersion: '1.2.3',
        electronVersion: '44',
        chromeVersion: '128',
        platform: 'win32',
        audioPlugin: { available: false, reason: 'notYetAvailable' },
      };
      envState = createEnvironmentState(probedEnvWithForcedCapabilities());
      panel.setEnvironment(envState);
      panel.toggle();
      const html = panel.innerHTML;
      expect(html).toContain('Desktop App');
      expect(html).toContain('1.2.3');
    });

    it('explains capability reasons when not available', () => {
      const env = {
        shell: { kind: 'browser', browser: null },
        builtInSound: { available: true },
        midiInput: { available: true },
        audioPlugin: { available: true },
        recentScores: { available: true },
        compressedFiles: { available: true },
        secureContext: true,
      } as any;
      envState = createEnvironmentState(env);
      // force some missing capabilities for test
      envState.update((s) => ({
        ...s,
        builtInSound: { available: false, reason: 'notSupported' },
        audioPlugin: { available: false, reason: 'notYetAvailable' },
      }));
      panel.setEnvironment(envState);
      panel.toggle();
      const html = panel.innerHTML;
      expect(html).toContain('Not available');
      expect(html).toContain('Not yet available');
    });

    it('shows a warning for unknown bridge major version', () => {
      (window as any).musicanyyaShell = {
        kind: 'electron',
        bridgeVersion: '2.0.0',
      };
      envState = createEnvironmentState(probedEnvWithForcedCapabilities());
      panel.setEnvironment(envState);
      panel.toggle();
      const html = panel.innerHTML;
      expect(html).toContain('Unknown bridge version');
    });
  });
});
