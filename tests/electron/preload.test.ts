import { describe, expect, it } from 'vitest';
import { createShellBridge } from '../../electron/preload.js';

describe('Electron Preload', () => {
  it('exposes a frozen object matching the contract', () => {
    const bridge = createShellBridge('1.0.0', '1.2.3', '44.0.0', '128.0.0', 'win32');

    expect(bridge.kind).toBe('electron');
    expect(bridge.bridgeVersion).toBe('1.0.0');
    expect(bridge.appVersion).toBe('1.2.3');
    expect(bridge.electronVersion).toBe('44.0.0');
    expect(bridge.chromeVersion).toBe('128.0.0');
    expect(bridge.platform).toBe('win32');
    expect(bridge.audioPlugin).toEqual({ available: false, reason: 'notYetAvailable' });

    expect(Object.isFrozen(bridge)).toBe(true);
    expect(Object.isFrozen(bridge.audioPlugin)).toBe(true);
  });
});
