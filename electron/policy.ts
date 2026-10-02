import * as path from 'node:path';

export function isAppOrigin(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'app:' && u.hostname === 'musicanyya';
  } catch {
    return false;
  }
}

export function resolveAppPath(requestUrl: string, distPath: string): string | null {
  if (!isAppOrigin(requestUrl)) return null;

  try {
    const urlObj = new URL(requestUrl);
    let pathname = decodeURIComponent(urlObj.pathname);
    if (pathname === '/') {
      pathname = '/index.html';
    }

    // Remove leading slash for path.join
    const normalizedPath = path.normalize(pathname.replace(/^\/+/, ''));
    const resolved = path.join(distPath, normalizedPath);

    // Prevent directory traversal
    const relative = path.relative(distPath, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return null;
    }

    return resolved;
  } catch {
    return null;
  }
}

/** The app's own origin, or - in development only - the Vite dev server's (`devOrigin`, `MUSICANYYA_DEV_URL`). */
function isTrustedOrigin(url: string, devOrigin?: string): boolean {
  if (isAppOrigin(url)) return true;
  if (devOrigin === undefined) return false;
  try {
    return new URL(url).origin === devOrigin;
  } catch {
    return false;
  }
}

/**
 * The permission *requests* the desktop app grants (electron-bridge 1.1.0): Web MIDI for the app's own page, and nothing
 * else - `media` (the microphone) stays refused, so `getUserMedia` rejects. Chromium asks for `midiSysex` when the page calls
 * `requestMIDIAccess()` in this Electron (feature 021 spike T053, owner decision 2026-10-02); the app sends no SysEx.
 */
export function decidePermission(permission: string, origin: string, _url: string, devOrigin?: string): boolean {
  return (permission === 'midi' || permission === 'midiSysex') && isTrustedOrigin(origin, devOrigin);
}

/**
 * The permission *check*, which decides whether the page may see output-device labels and move its audio context to a
 * device (feature 021 US5, audio-setup.md section 3): audio `media` for the app's own page. It grants no capture: that is
 * a request, and `decidePermission` refuses it.
 */
export function decidePermissionCheck(
  permission: string,
  origin: string,
  details: { mediaType?: string | undefined },
  devOrigin?: string,
): boolean {
  if (permission !== 'media' || !isTrustedOrigin(origin, devOrigin)) return false;
  return details.mediaType === undefined || details.mediaType === 'audio' || details.mediaType === 'unknown';
}

export function decideNavigation(url: string): 'allow' | 'deny' | 'external' {
  return isAppOrigin(url) ? 'allow' : 'deny';
}

export function decideWindowOpen(url: string): 'allow' | 'deny' | 'external' {
  try {
    const u = new URL(url);
    if (u.protocol === 'https:') return 'external';
    return 'deny';
  } catch {
    return 'deny';
  }
}
