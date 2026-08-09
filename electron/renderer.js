/**
 * Electron Renderer Script
 * Populates URLs and version info in the main window
 */

document.addEventListener('DOMContentLoaded', () => {
  if (!window.electronAPI) return;

  const urls = window.electronAPI.urls;
  const baseUrl = window.electronAPI.getBaseUrl();
  const port = baseUrl.split(':').pop();

  document.getElementById('port').textContent = port;
  document.getElementById('serverUrl').textContent = baseUrl;

  if (window.electronAPI.version) {
    document.getElementById('appVersion').textContent = 'v' + window.electronAPI.version;
  }

  document.getElementById('callerDisplayUrl').textContent = urls.callerDisplay;
  document.getElementById('topicsDisplayUrl').textContent = urls.topicsDisplay;
  document.getElementById('sceneDisplayUrl').textContent = urls.sceneDisplay;
  document.getElementById('segmentDisplayUrl').textContent = urls.segmentDisplay;
  document.getElementById('scoreboardDisplayUrl').textContent = urls.scoreboardDisplay;
  document.getElementById('claimDisplayUrl').textContent = urls.claimDisplay;
  document.getElementById('tickerDisplayUrl').textContent = urls.tickerDisplay;
  document.getElementById('stageForegroundUrl').textContent = urls.stageForeground;
  document.getElementById('stageBackgroundUrl').textContent = urls.stageBackground;
  document.getElementById('callerControlUrl').textContent = urls.callerControl;
  document.getElementById('bibleDisplayUrl').textContent = urls.bibleDisplay;
  document.getElementById('bibleControlUrl').textContent = urls.bibleControl;
  document.getElementById('soundboardUrl').textContent = urls.soundboard;
});
