/**
 * Electron Main Process
 * DebateStreamSuite - Electron Main Process
 */

const { app, BrowserWindow, Tray, Menu, clipboard, nativeImage, shell } = require('electron');
const path = require('path');

// Start the Express server
require('../src/server');

// Configuration
const PORT = process.env.PORT || 3666;
const BASE_URL = `http://localhost:${PORT}`;

// Global references to prevent garbage collection
let mainWindow = null;
let tray = null;

/**
 * Create the main application window
 */
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    title: 'DebateStreamSuite',
    icon: path.join(__dirname, 'icons', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

/**
 * Create the system tray icon and menu
 */
function createTray() {
  const iconPath = path.join(__dirname, 'icons', 'tray-icon.png');

  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      trayIcon = createFallbackIcon();
    }
  } catch (e) {
    trayIcon = createFallbackIcon();
  }

  trayIcon = trayIcon.resize({ width: 16, height: 16 });

  tray = new Tray(trayIcon);
  tray.setToolTip('DebateStreamSuite');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Window',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Copy Caller Control URL',
      click: () => {
        clipboard.writeText(`${BASE_URL}/dock.html`);
      }
    },
    {
      label: 'Copy Caller Display URL',
      click: () => {
        clipboard.writeText(`${BASE_URL}/display.html`);
      }
    },
    { type: 'separator' },
    {
      label: 'Copy Reference Control URL',
      click: () => {
        clipboard.writeText(`${BASE_URL}/reference-control.html`);
      }
    },
    {
      label: 'Copy Bible Display URL',
      click: () => {
        clipboard.writeText(`${BASE_URL}/bible-display.html`);
      }
    },
    { type: 'separator' },
    {
      label: 'Copy Soundboard URL',
      click: () => {
        clipboard.writeText(`${BASE_URL}/soundboard.html`);
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

/**
 * Create a fallback icon if no icon file exists
 */
function createFallbackIcon() {
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);

  for (let i = 0; i < size * size; i++) {
    const offset = i * 4;
    canvas[offset] = 230;     // R
    canvas[offset + 1] = 57;  // G
    canvas[offset + 2] = 70;  // B
    canvas[offset + 3] = 255; // A
  }

  return nativeImage.createFromBuffer(canvas, {
    width: size,
    height: size
  });
}

// App lifecycle events
app.whenReady().then(() => {
  createMainWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
});
