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

export function decidePermission(permission: string, origin: string, _url: string): boolean {
  return permission === 'midi' && isAppOrigin(origin);
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
