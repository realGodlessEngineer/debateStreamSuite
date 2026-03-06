/**
 * Electron Preload Script
 * Exposes safe APIs to the renderer process
 */

const { contextBridge } = require('electron');
const path = require('path');

const PORT = process.env.PORT || 3666;
const BASE_URL = `http://localhost:${PORT}`;
const pkg = require(path.join(__dirname, '..', 'package.json'));

contextBridge.exposeInMainWorld('electronAPI', {
  getBaseUrl: () => BASE_URL,
  version: pkg.version,
  urls: {
    callerControl: `${BASE_URL}/dock.html`,
    callerDisplay: `${BASE_URL}/display.html`,
    bibleControl: `${BASE_URL}/bible-control.html`,
    bibleDisplay: `${BASE_URL}/bible-display.html`,
    soundboard: `${BASE_URL}/soundboard.html`
  }
});
