import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { app, BrowserWindow, nativeTheme, net, protocol, shell } from 'electron';
import { decideNavigation, decidePermission, decideWindowOpen, resolveAppPath } from './policy.js';

const _dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(_dirname, '../dist');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
    },
  },
]);

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // Register app:// scheme
    protocol.handle('app', (request) => {
      const resolvedPath = resolveAppPath(request.url, distPath);
      if (!resolvedPath) {
        console.log('app:// 404 for:', request.url);
        return new Response('Not Found', { status: 404 });
      }
      const fileUrl = pathToFileURL(resolvedPath).href;
      console.log('app:// mapping:', request.url, '->', fileUrl);
      return net.fetch(fileUrl).catch((err) => {
        console.error('net.fetch failed for', fileUrl, err);
        throw err;
      });
    });

    // Permissions
    app.on('session-created', (session) => {
      session.setPermissionRequestHandler((webContents, permission, callback, details) => {
        const origin = new URL(webContents.getURL()).origin;
        const allowed = decidePermission(permission, origin, details.requestingUrl);
        callback(allowed);
      });
    });

    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

/**
 * The window's colour until the renderer's first paint (research R-3): the desk colour of the theme Automatic
 * resolves to - Paper while the OS is light, Night while it is dark (research R-5, src/ui/styles/themes.css; a unit
 * test keeps them equal). The window shows only once the first frame, already in the stored theme, is ready.
 */
const START_BACKGROUND_LIGHT = '#e9e5dc';
const START_BACKGROUND_DARK = '#111214';

function createWindow() {
  const devUrl = process.env.MUSICANYYA_DEV_URL;
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? START_BACKGROUND_DARK : START_BACKGROUND_LIGHT,
    // In dev the window and taskbar show the app icon from build/ (brand.md section 2); packaged, the exe's icon is used.
    ...(devUrl ? { icon: path.join(app.getAppPath(), 'build', 'icon.png') } : {}),
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
      // The Audio engine starts with no click, so the keyboard sounds from start-up (electron-bridge 1.1.0, feature 021)
      autoplayPolicy: 'no-user-gesture-required',
      preload: path.join(_dirname, 'preload.cjs'),
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.setMenu(null); // No menu in production
    mainWindow.loadURL('app://musicanyya/');
  }

  // Navigation and window open policy
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const decision = decideNavigation(url);
    if (decision === 'deny') {
      event.preventDefault();
    } else if (decision === 'external') {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.webContents.on('will-redirect', (event, url) => {
    const decision = decideNavigation(url);
    if (decision !== 'allow') {
      event.preventDefault();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const decision = decideWindowOpen(url);
    if (decision === 'external') {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}
