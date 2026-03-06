/**
 * Electron Preload Script
 * Exposes safe APIs to the renderer process
 */

const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

// Configuration
const PORT = process.env.PORT || 3666;
const BASE_URL = `http://localhost:${PORT}`;

// Read version from package.json
const pkg = require(path.join(__dirname, '..', 'package.json'));

// Expose protected methods to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Get base URL for the server
  getBaseUrl: () => BASE_URL,

  // App version from package.json
  version: pkg.version,

  // Clipboard operations (via IPC to main process)
  copyToClipboard: (text) => {
    ipcRenderer.send('copy-to-clipboard', text);
  },

  // Open external links (via IPC to main process)
  openExternal: (url) => {
    ipcRenderer.send('open-external', url);
  },

  // Get URLs
  urls: {
    callerControl: `${BASE_URL}/dock.html`,
    callerDisplay: `${BASE_URL}/display.html`,
    bibleControl: `${BASE_URL}/bible-control.html`,
    bibleDisplay: `${BASE_URL}/bible-display.html`,
    soundboard: `${BASE_URL}/soundboard.html`
  }
});
