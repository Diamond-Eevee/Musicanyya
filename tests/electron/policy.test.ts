import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  decideNavigation,
  decidePermission,
  decideWindowOpen,
  isAppOrigin,
  resolveAppPath,
} from '../../electron/policy.js';

describe('Electron Policy', () => {
  describe('isAppOrigin', () => {
    it('allows app://musicanyya', () => {
      expect(isAppOrigin('app://musicanyya')).toBe(true);
      expect(isAppOrigin('app://musicanyya/index.html')).toBe(true);
    });
    it('rejects other origins', () => {
      expect(isAppOrigin('https://musicanyya.com')).toBe(false);
      expect(isAppOrigin('app://other')).toBe(false);
    });
  });

  describe('resolveAppPath', () => {
    const distPath = path.resolve('/fake/dist');

    it('resolves valid paths inside dist', () => {
      expect(resolveAppPath('app://musicanyya/index.html', distPath)).toBe(path.join(distPath, 'index.html'));
      expect(resolveAppPath('app://musicanyya/assets/main.js', distPath)).toBe(
        path.join(distPath, 'assets', 'main.js'),
      );
    });

    it('defaults to index.html for the root', () => {
      expect(resolveAppPath('app://musicanyya/', distPath)).toBe(path.join(distPath, 'index.html'));
    });

    it('rejects other hosts or schemes', () => {
      expect(resolveAppPath('https://musicanyya/index.html', distPath)).toBeNull();
      expect(resolveAppPath('app://other/index.html', distPath)).toBeNull();
    });
  });

  describe('decidePermission', () => {
    it('allows midi for app origin', () => {
      expect(decidePermission('midi', 'app://musicanyya', 'app://musicanyya/')).toBe(true);
    });
    it('rejects midiSysex for app origin', () => {
      expect(decidePermission('midiSysex', 'app://musicanyya', 'app://musicanyya/')).toBe(false);
    });
    it('rejects other permissions for app origin', () => {
      expect(decidePermission('media', 'app://musicanyya', 'app://musicanyya/')).toBe(false);
      expect(decidePermission('geolocation', 'app://musicanyya', 'app://musicanyya/')).toBe(false);
    });
    it('rejects everything for other origins', () => {
      expect(decidePermission('midi', 'https://example.com', 'https://example.com')).toBe(false);
    });
  });

  describe('decideNavigation', () => {
    it('allows navigation within app origin', () => {
      expect(decideNavigation('app://musicanyya/index.html')).toBe('allow');
      expect(decideNavigation('app://musicanyya/about.html')).toBe('allow');
    });
    it('blocks navigation to other origins', () => {
      expect(decideNavigation('https://example.com')).toBe('deny');
      expect(decideNavigation('file:///C:/secret.txt')).toBe('deny');
    });
    // We only allow external links via window.open, not direct navigation, though let's just deny anything non-app.
  });

  describe('decideWindowOpen', () => {
    it('opens https links externally', () => {
      expect(decideWindowOpen('https://github.com/')).toBe('external');
    });
    it('blocks http links', () => {
      expect(decideWindowOpen('http://github.com/')).toBe('deny');
    });
    it('blocks file links', () => {
      expect(decideWindowOpen('file:///C:/secret.txt')).toBe('deny');
    });
    it('blocks app links', () => {
      expect(decideWindowOpen('app://musicanyya/index.html')).toBe('deny');
    });
  });
});
