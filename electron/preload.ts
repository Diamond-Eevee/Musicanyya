import { contextBridge } from 'electron';

export function createShellBridge(
  bridgeVersion: '1.0.0',
  appVersion: string,
  electronVersion: string,
  chromeVersion: string,
  platform: 'win32' | 'darwin' | 'linux' | string,
) {
  const bridge = {
    kind: 'electron' as const,
    bridgeVersion,
    appVersion,
    electronVersion,
    chromeVersion,
    platform: platform as 'win32' | 'darwin' | 'linux',
    audioPlugin: Object.freeze({ available: false as const, reason: 'notYetAvailable' as const }),
  };

  return Object.freeze(bridge);
}

// Ensure contextBridge is available (it isn't in tests where we just import the factory)
if (typeof contextBridge !== 'undefined') {
  const bridge = createShellBridge(
    '1.0.0',
    process.env.APP_VERSION || 'unknown',
    process.versions.electron,
    process.versions.chrome,
    process.platform,
  );

  contextBridge.exposeInMainWorld('musicanyyaShell', bridge);
}
