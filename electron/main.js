/**
 * Electron Main Process
 * DebateStreamSuite - Electron Main Process
 */

const { app, BrowserWindow, Tray, Menu, clipboard, nativeImage, shell, ipcMain } = require('electron');
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
    show: false // Don't show until ready
  });

  // Load the main page
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Show window when ready
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
  // Create tray icon (use a simple icon or create one)
  const iconPath = path.join(__dirname, 'icons', 'tray-icon.png');

  // Create a simple icon if it doesn't exist
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      // Create a simple colored icon as fallback
      trayIcon = createFallbackIcon();
    }
  } catch (e) {
    trayIcon = createFallbackIcon();
  }

  // Resize for tray (16x16 on most systems)
  trayIcon = trayIcon.resize({ width: 16, height: 16 });

  tray = new Tray(trayIcon);
  tray.setToolTip('DebateStreamSuite');

  // Create context menu
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show OBS Instructions',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Open Caller Control',
      click: () => {
        shell.openExternal(`${BASE_URL}/dock.html`);
      }
    },
    {
      label: 'Copy Caller Display Link',
      click: () => {
        clipboard.writeText(`${BASE_URL}/display.html`);
      }
    },
    { type: 'separator' },
    {
      label: 'Open Bible Control',
      click: () => {
        shell.openExternal(`${BASE_URL}/bible-control.html`);
      }
    },
    {
      label: 'Copy Bible Display Link',
      click: () => {
        clipboard.writeText(`${BASE_URL}/bible-display.html`);
      }
    },
    { type: 'separator' },
    {
      label: 'Open Soundboard',
      click: () => {
        shell.openExternal(`${BASE_URL}/soundboard.html`);
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

  // Show window on double-click
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
  // Create a simple 16x16 icon
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);

  // Fill with a color (red for DebateStreamSuite)
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

// IPC Handlers for renderer process
ipcMain.on('copy-to-clipboard', (event, text) => {
  if (typeof text !== 'string' || text.length > 2000) return;
  clipboard.writeText(text);
});

ipcMain.on('open-external', (event, url) => {
  if (typeof url !== 'string') return;
  // Only allow http/https URLs to prevent file:// or other protocol abuse
  if (url.startsWith('http://') || url.startsWith('https://')) {
    shell.openExternal(url);
  }
});

// App lifecycle events
app.whenReady().then(() => {
  createMainWindow();
  createTray();

  app.on('activate', () => {
    // macOS: Re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else {
      mainWindow.show();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle before-quit to properly close
app.on('before-quit', () => {
  app.isQuitting = true;
});
