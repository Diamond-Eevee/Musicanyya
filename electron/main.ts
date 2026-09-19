import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { app, BrowserWindow, net, protocol, shell } from 'electron';
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

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
      preload: path.join(_dirname, 'preload.cjs'),
    },
  });

  if (process.env.MUSICANYYA_DEV_URL) {
    mainWindow.loadURL(process.env.MUSICANYYA_DEV_URL);
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
