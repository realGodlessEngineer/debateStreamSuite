/**
 * Scene & Segment Timer Control
 * Dock module for the holding-scene cards (Starting Soon / BRB / Ending) and
 * the segment countdown timer. Reuses the socket already opened by
 * caller-control.js (window.CallerControl.socket) rather than opening a
 * second connection.
 * @module js/scene-control
 */

(function () {
  'use strict';

  // Mirrors SCENE.KEYS / SCENE.TIMER_WARN_SECONDS / SCENE.TIMER_DANGER_SECONDS
  // in src/config/constants.js (remaining-time thresholds on the countdown).
  const SCENE_KEYS = ['starting-soon', 'brb', 'ending'];
  const TIMER_WARN_SECONDS = 60;
  const TIMER_DANGER_SECONDS = 10;

  const SCENE_LABELS = {
    'starting-soon': 'Starting Soon',
    'brb': 'Be Right Back',
    'ending': 'Ending',
  };

  // ============================================
  // DOM Elements
  // ============================================

  const elements = {
    sceneButtons: document.querySelectorAll('.scene-btn'),
    sceneMessageInput: document.getElementById('sceneMessageInput'),
    sceneClearBtn: document.getElementById('sceneClearBtn'),
    sceneStatus: document.getElementById('sceneStatus'),
    segmentLabelInput: document.getElementById('segmentLabelInput'),
    segmentDurationInput: document.getElementById('segmentDurationInput'),
    segmentStartBtn: document.getElementById('segmentStartBtn'),
    segmentStopBtn: document.getElementById('segmentStopBtn'),
    segmentResetBtn: document.getElementById('segmentResetBtn'),
    segmentTimerDisplay: document.getElementById('segmentTimerDisplay'),
    segmentTimerStatus: document.getElementById('segmentTimerStatus'),
  };

  // ============================================
  // Socket Connection (shared with caller-control.js)
  // ============================================

  const socket = window.CallerControl.socket;

  // ============================================
  // Scene Card Functions
  // ============================================

  /**
   * Emits the clicked scene key immediately (selecting a card shows it),
   * carrying whatever subline text is currently in the message field.
   * @param {Event} event - Click event
   */
  function handleSceneButtonClick(event) {
    const key = event.currentTarget.getAttribute('data-scene-key');
    if (!SCENE_KEYS.includes(key)) return;

    socket.emit('updateScene', {
      key,
      message: elements.sceneMessageInput.value,
      visible: true,
    });
  }

  function handleSceneClear() {
    socket.emit('clearScene');
  }

  /**
   * Adopt the authoritative scene state; highlight the active button and
   * report which scene (if any) is currently live.
   * @param {{ key: string, message: string, visible: boolean }} data
   */
  function onSceneUpdate(data) {
    const key = (data && data.key) || '';
    const visible = !!(data && data.visible);

    elements.sceneButtons.forEach((btn) => {
      btn.classList.toggle('active', visible && btn.getAttribute('data-scene-key') === key);
    });

    if (elements.sceneStatus) {
      elements.sceneStatus.textContent = (visible && SCENE_LABELS[key])
        ? 'Showing: ' + SCENE_LABELS[key]
        : 'No scene showing';
    }

    // Don't clobber the operator mid-type
    if (elements.sceneMessageInput && document.activeElement !== elements.sceneMessageInput) {
      elements.sceneMessageInput.value = (data && data.message) || '';
    }
  }

  // ============================================
  // Segment Timer State (server-synced via segmentTimer.endsAt/remainingMs)
  // ============================================

  let current = { label: '', endsAt: null, remainingMs: 0, running: false };

  function formatClock(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return mins + ':' + secs.toString().padStart(2, '0');
  }

  /**
   * Repaint the dock's countdown readout from the synced state (called once
   * per tick and whenever segmentTimer state changes).
   */
  function renderSegmentDisplay() {
    if (!elements.segmentTimerDisplay) return;

    const hasContent = current.running || current.remainingMs > 0 || !!current.label;
    const remainingMs = current.running && current.endsAt
      ? Math.max(0, current.endsAt - Date.now())
      : Math.max(0, current.remainingMs);
    const remainingSeconds = Math.ceil(remainingMs / 1000);

    elements.segmentTimerDisplay.textContent = formatClock(remainingSeconds);

    const danger = hasContent && remainingSeconds <= TIMER_DANGER_SECONDS;
    const warn = !danger && hasContent && remainingSeconds <= TIMER_WARN_SECONDS;
    elements.segmentTimerDisplay.classList.toggle('warn', warn);
    elements.segmentTimerDisplay.classList.toggle('danger', danger);

    if (elements.segmentTimerStatus) {
      elements.segmentTimerStatus.textContent = current.running ? 'RUNNING' : 'STOPPED';
      elements.segmentTimerStatus.classList.toggle('active', current.running);
    }
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

    // Don't clobber the operator mid-type; only backfill the label field
    // when it's empty so a fresh page load shows the armed segment's name.
    if (elements.segmentLabelInput
      && document.activeElement !== elements.segmentLabelInput
      && !elements.segmentLabelInput.value) {
      elements.segmentLabelInput.value = current.label;
    }

    renderSegmentDisplay();
  }

  function handleSegmentStart() {
    const minutes = parseFloat(elements.segmentDurationInput.value);
    if (!Number.isFinite(minutes) || minutes <= 0) return;

    socket.emit('startSegmentTimer', {
      label: elements.segmentLabelInput.value,
      durationMs: Math.round(minutes * 60 * 1000),
    });
  }

  function handleSegmentStop() {
    socket.emit('stopSegmentTimer');
  }

  function handleSegmentReset() {
    socket.emit('segmentTimerReset');
    elements.segmentLabelInput.value = '';
  }

  // ============================================
  // Socket Event Handlers
  // ============================================

  socket.on('sceneUpdate', onSceneUpdate);
  socket.on('segmentTimerUpdate', onSegmentTimerUpdate);

  // ============================================
  // Initialization
  // ============================================

  function init() {
    elements.sceneButtons.forEach((btn) => {
      btn.addEventListener('click', handleSceneButtonClick);
    });
    if (elements.sceneClearBtn) {
      elements.sceneClearBtn.addEventListener('click', handleSceneClear);
    }
    if (elements.segmentStartBtn) {
      elements.segmentStartBtn.addEventListener('click', handleSegmentStart);
    }
    if (elements.segmentStopBtn) {
      elements.segmentStopBtn.addEventListener('click', handleSegmentStop);
    }
    if (elements.segmentResetBtn) {
      elements.segmentResetBtn.addEventListener('click', handleSegmentReset);
    }

    // Repaint the countdown once per second from the synced end time
    setInterval(renderSegmentDisplay, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
