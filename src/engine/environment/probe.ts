import type { Capability, Environment } from '../ports.js';

/**
 * Two globals TypeScript's DOM library does not describe, declared here rather than reached through
 * `window as any` / `navigator as any` - a cast that turns off checking for the whole expression,
 * including the property chain being walked (tasks.md T139).
 *
 * `musicanyyaShell` is the desktop shell's frozen bridge (`electron/preload.ts`); it is absent in the
 * browser, so every field is optional and the `kind` check still decides. `userAgentData` is the
 * User-Agent Client Hints API, shipped in Chromium and absent elsewhere.
 */
interface ShellBridge {
  kind?: string;
  bridgeVersion?: string;
  appVersion?: string;
  electronVersion?: string;
  chromeVersion?: string;
  platform?: string;
}

interface UserAgentData {
  brands?: { brand: string; version: string }[];
}

export function probeEnvironment(): Environment {
  const isSecure = !!(typeof window !== 'undefined' && window.isSecureContext);

  let shell: Environment['shell'] = { kind: 'browser', browser: null };
  const bridge =
    typeof window !== 'undefined' ? (window as Window & { musicanyyaShell?: ShellBridge }).musicanyyaShell : undefined;
  const userAgentData =
    typeof navigator !== 'undefined'
      ? (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData
      : undefined;

  if (bridge) {
    if (bridge.kind === 'electron') {
      // A bridge from an older shell may not carry every field; '' keeps the panel honest rather
      // than printing "undefined".
      shell = {
        kind: 'electron',
        appVersion: bridge.appVersion ?? '',
        electronVersion: bridge.electronVersion ?? '',
        chromeVersion: bridge.chromeVersion ?? '',
        platform: bridge.platform ?? '',
        bridgeVersion: bridge.bridgeVersion ?? '',
      };
    }
  } else if (userAgentData?.brands?.[0]) {
    // User-Agent Client Hints calls it `brand`; our Environment calls it `name`. This was assigned
    // straight across under `navigator as any`, so `browser.name` was always undefined and the
    // Environment panel showed "Browser (Unknown ...)" on every Chromium build (tasks.md T139).
    const first = userAgentData.brands[0];
    shell = { kind: 'browser', browser: { name: first.brand, version: first.version } };
  }

  const checkBuiltInSound = (): Capability => {
    if (typeof AudioWorklet === 'undefined') return { available: false, reason: 'notSupported' };
    return { available: true };
  };

  const checkMidiInput = (): Capability => {
    if (typeof navigator === 'undefined' || typeof navigator.requestMIDIAccess !== 'function') {
      return { available: false, reason: 'notSupported' };
    }
    return { available: true };
  };

  const checkRecentScores = (): Capability => {
    if (typeof indexedDB === 'undefined') return { available: false, reason: 'notSupported' };
    return { available: true };
  };

  const checkCompressedFiles = (): Capability => {
    if (typeof DecompressionStream === 'undefined') return { available: false, reason: 'notSupported' };
    return { available: true };
  };

  return {
    shell,
    secureContext: isSecure,
    builtInSound: checkBuiltInSound(),
    midiInput: checkMidiInput(),
    audioPlugin: { available: false, reason: 'notYetAvailable' },
    recentScores: checkRecentScores(),
    compressedFiles: checkCompressedFiles(),
  };
}
