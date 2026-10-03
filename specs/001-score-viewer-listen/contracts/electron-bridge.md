# Contract: Electron preload bridge and desktop Shell rules

**Version**: `1.1.0` (the `bridgeVersion` value stays `"1.0.0"`: the bridge object is unchanged). The only way the web
app learns it runs in the desktop Shell (R-3). The web app must work identically when the bridge is absent (browser).

**1.0.0 -> 1.1.0** (feature 021-live-piano-audio-setup, MINOR; full text:
[021 live-sound.md](../../021-live-piano-audio-setup/contracts/live-sound.md) section 2 and
[021 audio-setup.md](../../021-live-piano-audio-setup/contracts/audio-setup.md) section 3): main process rules only
(see the table below): `autoplayPolicy` set explicitly, the permission *check* for audio `media` allowed for the
app origin, and - owner decision of 2026-10-02 after the T053 spike - the permission handlers now **installed on the
default session** (before 1.1.0 they were registered on `session-created`, which never fires for it, so the desktop app
granted every permission, `getUserMedia` included); the permission *request* for `media` is denied.

## `window.musicanyyaShell` (exposed by `electron/preload.ts` via `contextBridge.exposeInMainWorld`)

```ts
interface MusicanyyaShellBridge {
  readonly kind: "electron";
  readonly bridgeVersion: "1.0.0";
  readonly appVersion: string;             // from package.json
  readonly electronVersion: string;        // process.versions.electron
  readonly chromeVersion: string;          // process.versions.chrome
  readonly platform: "win32" | "darwin" | "linux";
  /** Native audio plugin status. Feature 001: always { available: false, reason: "notYetAvailable" }. */
  readonly audioPlugin: { available: false; reason: "notYetAvailable" };
}
declare global { interface Window { musicanyyaShell?: MusicanyyaShellBridge } }
```

- The object is frozen plain data (no functions) in 1.0.0: nothing on it can reach Node, the file system or IPC.
  Later versions add narrowly typed async functions (e.g. plugin connect) with a MINOR version bump.
- The web app treats an unknown `bridgeVersion` major as "desktop app, capabilities unknown" and keeps working.

## Main process rules (`electron/main.ts`)

| Topic | Rule |
|---|---|
| Web preferences | `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true`, `spellcheck: false`, `autoplayPolicy: 'no-user-gesture-required'` (1.1.0, explicit: the Audio engine starts with no click) |
| Content | Production: privileged scheme `app://musicanyya/` served from the packaged `dist/` via `protocol.handle` (path traversal rejected, only files inside `dist/`). Development: the Vite dev server URL from `MUSICANYYA_DEV_URL`. |
| Navigation | `will-navigate` and `will-redirect` blocked for any other origin; `setWindowOpenHandler` denies all, opening `https:` links in the system browser via `shell.openExternal` |
| Permissions | Handlers installed on `session.defaultSession` after `app` is ready. Allowed for the app origin only: the permission **requests** `midi` and `midiSysex` (this Electron asks for `midiSysex` when the page calls `requestMIDIAccess()`; the app sends no SysEx, T053 spike, owner approved 2026-10-02) and, since 1.1.0, the permission **check** `media` with audio (or unspecified) media type, so output devices can be listed and chosen. Denied: the permission **request** for `media` (`getUserMedia` is rejected, no capture) and every other permission |
| CSP | Same CSP as the web build (R-16), delivered via meta tag; `app://` responses add it as a header |
| Menus / devtools | Default menu hidden in production; devtools only in development |
| Single instance | `requestSingleInstanceLock`; a second start focuses the existing window |

## Packaging (ADR-0004)

`pnpm electron:build` runs the web build, the Electron build (Vite lib mode: `dist-electron/main.js`,
`dist-electron/preload.cjs`) and `electron-builder --win --dir` (unpacked) plus an unsigned NSIS installer. The
SoundFont is part of `dist/` and therefore of the package. Signing, auto-update, macOS and Linux targets are out of
scope for feature 001.
