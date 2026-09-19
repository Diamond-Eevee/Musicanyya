export const fakeShellBridge = {
  kind: 'electron' as const,
  bridgeVersion: '1.0.0' as const,
  appVersion: '1.0.0',
  electronVersion: '1.0.0',
  chromeVersion: '1.0.0',
  platform: 'win32' as const,
  audioPlugin: { available: false as const, reason: 'notYetAvailable' as const },
};
