import type { Capability, Environment } from '../ports.js';

export function probeEnvironment(): Environment {
  const isSecure = !!(typeof window !== 'undefined' && window.isSecureContext);

  let shell: Environment['shell'] = { kind: 'browser', browser: null };
  const w = typeof window !== 'undefined' ? (window as any) : null;

  if (w && w.musicanyyaShell) {
    const b = w.musicanyyaShell;
    if (b.kind === 'electron') {
      shell = {
        kind: 'electron',
        appVersion: b.appVersion,
        electronVersion: b.electronVersion,
        chromeVersion: b.chromeVersion,
        platform: b.platform,
        bridgeVersion: b.bridgeVersion,
      };
    }
  } else if (
    typeof navigator !== 'undefined' &&
    (navigator as any).userAgentData &&
    (navigator as any).userAgentData.brands
  ) {
    shell = { kind: 'browser', browser: (navigator as any).userAgentData.brands[0] || null };
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
