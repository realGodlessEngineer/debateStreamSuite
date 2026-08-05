/**
 * Segment Countdown Overlay
 * OBS overlay for the operator-armed segment countdown. Listens only to
 * 'segmentTimerUpdate'; the server replays it on connect, so a source added
 * mid-countdown picks up the correct remaining time immediately.
 * `endsAt` is a server-clock ms timestamp - every client computes
 * `endsAt - Date.now()` locally rather than trusting a locally-ticked
 * value, so all overlays (and the dock) agree on the same instant.
 * @module js/display-segment
 */

(function () {
  'use strict';

  // Mirrors SCENE.TIMER_WARN_SECONDS / SCENE.TIMER_DANGER_SECONDS in
  // src/config/constants.js (remaining-time thresholds, not elapsed-time).
  const TIMER_WARN_SECONDS = 60;
  const TIMER_DANGER_SECONDS = 10;

  const elements = {
    segmentTimer: document.getElementById('segmentTimer'),
    segmentLabel: document.getElementById('segmentLabel'),
    segmentClock: document.getElementById('segmentClock'),
  };

  const connection = createSocketConnection();
  const socket = connection.socket;

  let current = { label: '', endsAt: null, remainingMs: 0, running: false };

  function formatClock(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return mins + ':' + secs.toString().padStart(2, '0');
  }

  /** Repaint the clock from the current synced state (called on a tick). */
  function renderClock() {
    const hasContent = current.running || current.remainingMs > 0 || !!current.label;
    if (!hasContent) {
      elements.segmentTimer.classList.remove('visible');
      return;
    }

    const remainingMs = current.running && current.endsAt
      ? Math.max(0, current.endsAt - Date.now())
      : Math.max(0, current.remainingMs);
    const remainingSeconds = Math.ceil(remainingMs / 1000);

    elements.segmentLabel.textContent = current.label;
    elements.segmentClock.textContent = formatClock(remainingSeconds);

    const danger = remainingSeconds <= TIMER_DANGER_SECONDS;
    const warn = !danger && remainingSeconds <= TIMER_WARN_SECONDS;
    elements.segmentClock.classList.toggle('danger', danger);
    elements.segmentClock.classList.toggle('warn', warn);

    elements.segmentTimer.classList.add('visible');
  }

  /**
   * Adopt the authoritative segment-timer state from the server
   * @param {{ label: string, endsAt: number|null, remainingMs: number, running: boolean }} data
   */
  function onSegmentTimerUpdate(data) {
    current = {
      label: (data && data.label) || '',
      endsAt: (data && typeof data.endsAt === 'number') ? data.endsAt : null,
      remainingMs: (data && typeof data.remainingMs === 'number') ? data.remainingMs : 0,
      running: !!(data && data.running),
    };
    renderClock();
  }

  socket.on('segmentTimerUpdate', onSegmentTimerUpdate);

  // Repaint every 250ms so the last second still reads smoothly.
  setInterval(renderClock, 250);

  console.log('Segment timer display initialized - waiting for data...');
})();
