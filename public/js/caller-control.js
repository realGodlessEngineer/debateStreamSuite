/**
 * Caller Control Panel Application
 * Manages caller info updates for OBS overlay
 * @module js/caller-control
 */

(function () {
  'use strict';

  // ============================================
  // Constants
  // ============================================

  const MAX_CALL_LOG_ENTRIES = 50;

  // Call-timer color thresholds (mirror CALLER.TIMER_* in src/config/constants.js)
  const TIMER_WARN_SECONDS = 300;    // 5:00 → amber
  const TIMER_DANGER_SECONDS = 600;  // 10:00 → red

  // Stance key → display label (keys validated server-side against CALLER.STANCES)
  const STANCE_LABELS = {
    theist: 'Theist', atheist: 'Atheist', agnostic: 'Agnostic',
    christian: 'Christian', muslim: 'Muslim', jewish: 'Jewish',
    undecided: 'Undecided', other: 'Other',
  };

  // ============================================
  // DOM Elements
  // ============================================

  const elements = {
    form: document.getElementById('callerForm'),
    clearBtn: document.getElementById('clearBtn'),
    currentName: document.getElementById('currentName'),
    currentPronouns: document.getElementById('currentPronouns'),
    currentStance: document.getElementById('currentStance'),
    // Support both index.html and dock.html status elements
    statusIndicator: document.getElementById('statusIndicator'),
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),
    nameInput: document.getElementById('name'),
    pronounsInput: document.getElementById('pronouns'),
    stanceInput: document.getElementById('stance'),
    // Dock-specific elements
    callLog: document.getElementById('callLog'),
    clearLogBtn: document.getElementById('clearLogBtn'),
    exportLogBtn: document.getElementById('exportLogBtn'),
    timerDisplay: document.getElementById('timerDisplay'),
    timerStatus: document.getElementById('timerStatus'),
    startTimerBtn: document.getElementById('startTimerBtn'),
    stopTimerBtn: document.getElementById('stopTimerBtn'),
    // Queue elements
    queueForm: document.getElementById('queueForm'),
    queueName: document.getElementById('queueName'),
    queuePronouns: document.getElementById('queuePronouns'),
    queueStance: document.getElementById('queueStance'),
    queueTopic: document.getElementById('queueTopic'),
    queuePlatform: document.getElementById('queuePlatform'),
    queueList: document.getElementById('queueList'),
    queueCount: document.getElementById('queueCount'),
    clearQueueBtn: document.getElementById('clearQueueBtn'),
    // Stage elements (topics + call-in)
    topicsInput: document.getElementById('topicsInput'),
    updateTopicsBtn: document.getElementById('updateTopicsBtn'),
    clearTopicsBtn: document.getElementById('clearTopicsBtn'),
    toggleTopicsBtn: document.getElementById('toggleTopicsBtn'),
    callInInput: document.getElementById('callInInput'),
    updateCallInBtn: document.getElementById('updateCallInBtn'),
    toggleCallInBtn: document.getElementById('toggleCallInBtn'),
  };

  // ============================================
  // Call Log State
  // ============================================
  let callHistory = [];

  // ============================================
  // Timer State (server-synced via caller.timerStartedAt)
  // ============================================
  let timerStartedAt = null;  // server-clock ms, or null when stopped

  // ============================================
  // Stage State (server-synced via topics/callIn)
  // ============================================
  let topicsVisible = false;
  let callInVisible = false;

  // ============================================
  // Socket Connection
  // ============================================

  const connection = createSocketConnection({
    statusElementId: 'statusIndicator',
    statusDotId: 'statusDot',
  });
  const socket = connection.socket;

  // ============================================
  // Call Log Functions
  // ============================================

  function formatTime(date) {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  function addToCallLog(data, isCleared = false) {
    if (!elements.callLog) return;

    const entry = {
      name: data.name || '',
      pronouns: data.pronouns || '',
      time: new Date(),
      isCleared: isCleared
    };
    callHistory.unshift(entry);

    // Keep only last 50 entries
    if (callHistory.length > 50) {
      callHistory = callHistory.slice(0, MAX_CALL_LOG_ENTRIES);
    }

    renderCallLog();
  }

  function renderCallLog() {
    if (!elements.callLog) return;

    if (callHistory.length === 0) {
      elements.callLog.innerHTML = '<div class="log-empty-compact">No calls logged yet</div>';
      return;
    }

    elements.callLog.innerHTML = callHistory.map(entry => {
      const clearClass = entry.isCleared ? 'log-item-clear' : '';
      const displayText = entry.isCleared
        ? '<span style="color: #666; font-style: italic;">Display cleared</span>'
        : `${escapeHtml(entry.name)}${entry.pronouns ? ' (' + escapeHtml(entry.pronouns) + ')' : ''}`;

      return `
        <div class="log-item ${clearClass}">
          <div class="log-time">${escapeHtml(formatTime(entry.time))}</div>
          <div class="log-caller-compact">${displayText}</div>
        </div>
      `;
    }).join('');
  }

  function clearCallLog() {
    callHistory = [];
    renderCallLog();
  }

  function exportCallLog() {
    if (callHistory.length === 0) return;

    // Filter out "cleared" entries and format for export
    const lines = callHistory
      .filter(entry => !entry.isCleared)
      .map(entry => {
        const timestamp = entry.time.toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
        const pronouns = entry.pronouns ? ` (${entry.pronouns})` : '';
        return `${timestamp}\t${entry.name}${pronouns}`;
      });

    if (lines.length === 0) return;

    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().slice(0, 10);
    a.download = `call-log-${date}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ============================================
  // Timer Functions
  // ============================================

  function formatTimer(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Repaint the timer display from timerStartedAt (called once per second and
   * whenever caller state changes). Mirrors the overlay's amber/red thresholds.
   */
  function renderTimerDisplay() {
    if (!elements.timerDisplay) return;

    if (timerStartedAt == null) {
      elements.timerDisplay.textContent = '00:00';
      elements.timerDisplay.classList.remove('warn', 'danger');
      if (elements.timerStatus) {
        elements.timerStatus.textContent = 'STOPPED';
        elements.timerStatus.classList.remove('active');
      }
      return;
    }

    const elapsed = Math.max(0, Math.floor((Date.now() - timerStartedAt) / 1000));
    const danger = elapsed >= TIMER_DANGER_SECONDS;
    const warn = !danger && elapsed >= TIMER_WARN_SECONDS;

    elements.timerDisplay.textContent = formatTimer(elapsed);
    elements.timerDisplay.classList.toggle('warn', warn);
    elements.timerDisplay.classList.toggle('danger', danger);
    if (elements.timerStatus) {
      elements.timerStatus.textContent = 'RUNNING';
      elements.timerStatus.classList.add('active');
    }
  }

  /**
   * Adopt the authoritative timer start from caller state and repaint
   * @param {number|null} startedAt - server-clock ms, or null
   */
  function syncTimer(startedAt) {
    timerStartedAt = typeof startedAt === 'number' ? startedAt : null;
    renderTimerDisplay();
  }

  // ============================================
  // Display Functions
  // ============================================

  /**
   * Updates the current caller display
   * @param {Object} data - Caller data { name, pronouns, stance, timerStartedAt }
   */
  function updateCallerDisplay(data) {
    elements.currentName.textContent = data.name || '-';
    elements.currentPronouns.textContent = data.pronouns || '-';

    if (elements.currentStance) {
      const label = STANCE_LABELS[data.stance] || '';
      elements.currentStance.textContent = label;
      elements.currentStance.setAttribute('data-stance', data.stance || '');
      elements.currentStance.classList.toggle('visible', !!label);
    }

    syncTimer(data.timerStartedAt);
  }

  // ============================================
  // Queue Functions
  // ============================================

  /**
   * Render the caller queue list; the first item is highlighted as "on deck"
   * @param {Object} queue - { items: [{ id, name, pronouns, stance, topic, platform }] }
   */
  function renderQueue(queue) {
    const items = (queue && queue.items) || [];

    if (elements.queueCount) {
      elements.queueCount.textContent = '(' + items.length + ')';
    }
    if (!elements.queueList) return;

    if (!items.length) {
      elements.queueList.innerHTML = '<div class="queue-empty">Queue is empty</div>';
      return;
    }

    elements.queueList.innerHTML = items.map((item, idx) => {
      const id = escapeHtml(item.id);
      const stanceLabel = STANCE_LABELS[item.stance] || '';
      const stanceChip = stanceLabel
        ? `<span class="queue-stance" data-stance="${escapeHtml(item.stance)}">${escapeHtml(stanceLabel)}</span>`
        : '';
      const pronouns = item.pronouns
        ? `<span class="queue-pronouns">(${escapeHtml(item.pronouns)})</span>`
        : '';
      const meta = [];
      if (item.topic) meta.push(escapeHtml(item.topic));
      if (item.platform) meta.push(escapeHtml(item.platform));
      const metaLine = meta.length ? `<div class="queue-meta">${meta.join(' &middot; ')}</div>` : '';
      const posLabel = idx === 0
        ? '<span class="queue-ondeck-label">On deck</span>'
        : `<span class="queue-pos">${idx + 1}</span>`;

      return `
        <div class="queue-item${idx === 0 ? ' on-deck' : ''}" data-id="${id}">
          <div class="queue-item-main">
            <div class="queue-item-head">
              ${posLabel}
              <span class="queue-name">${escapeHtml(item.name)}</span>
              ${pronouns}
              ${stanceChip}
            </div>
            ${metaLine}
          </div>
          <div class="queue-item-actions">
            <button class="queue-btn queue-go" data-action="promote" data-id="${id}" title="Put live">&#9654;</button>
            <button class="queue-btn" data-action="up" data-id="${id}" title="Move up">&#9650;</button>
            <button class="queue-btn" data-action="down" data-id="${id}" title="Move down">&#9660;</button>
            <button class="queue-btn queue-remove" data-action="remove" data-id="${id}" title="Remove">&times;</button>
          </div>
        </div>`;
    }).join('');
  }

  /**
   * Handles a click within the queue list (event delegation over action buttons)
   * @param {Event} event - Click event
   */
  function handleQueueListClick(event) {
    const btn = event.target.closest('[data-action]');
    if (!btn) return;

    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');
    if (!id) return;

    if (action === 'promote') {
      socket.emit('queuePromote', { id });
    } else if (action === 'remove') {
      socket.emit('queueRemove', { id });
    } else if (action === 'up' || action === 'down') {
      socket.emit('queueReorder', { id, direction: action });
    }
  }

  /**
   * Handles the "Add to Queue" form submission
   * @param {Event} event - Submit event
   */
  function handleQueueSubmit(event) {
    event.preventDefault();

    const name = (elements.queueName.value || '').trim();
    if (!name) return;

    socket.emit('queueAdd', {
      name,
      pronouns: elements.queuePronouns.value,
      stance: elements.queueStance.value,
      topic: elements.queueTopic.value,
      platform: elements.queuePlatform.value,
    });

    elements.queueForm.reset();
    elements.queueName.focus();
  }

  /**
   * Clears the entire queue after confirmation
   */
  function handleClearQueue() {
    if (window.confirm('Clear the entire caller queue?')) {
      socket.emit('queueClear');
    }
  }

  // ============================================
  // Stage Functions (topics + call-in)
  // ============================================

  /**
   * Split the topics textarea into a trimmed, non-empty list of topics
   * @returns {string[]}
   */
  function readTopics() {
    return elements.topicsInput.value
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /** Emit the current topics list + visibility to the server */
  function emitTopics() {
    socket.emit('updateTopics', { items: readTopics(), visible: topicsVisible });
  }

  /** Emit the current call-in text + visibility to the server */
  function emitCallIn() {
    socket.emit('updateCallIn', { text: elements.callInInput.value.trim(), visible: callInVisible });
  }

  /**
   * Adopt the authoritative topics state from the server
   * @param {Object} data - { items: string[], visible: boolean }
   */
  function onTopicsUpdate({ items, visible }) {
    topicsVisible = !!visible;
    if (elements.toggleTopicsBtn) {
      elements.toggleTopicsBtn.textContent = topicsVisible ? 'Hide' : 'Show';
      elements.toggleTopicsBtn.classList.toggle('active', topicsVisible);
    }
    // Don't clobber the operator mid-type
    if (elements.topicsInput && document.activeElement !== elements.topicsInput) {
      elements.topicsInput.value = (items || []).join('\n');
    }
  }

  /**
   * Adopt the authoritative call-in state from the server
   * @param {Object} data - { text: string, visible: boolean }
   */
  function onCallInUpdate({ text, visible }) {
    callInVisible = !!visible;
    if (elements.toggleCallInBtn) {
      elements.toggleCallInBtn.textContent = callInVisible ? 'Hide' : 'Show';
      elements.toggleCallInBtn.classList.toggle('active', callInVisible);
    }
    // Don't clobber the operator mid-type
    if (elements.callInInput && document.activeElement !== elements.callInInput) {
      elements.callInInput.value = text || '';
    }
  }

  // ============================================
  // Event Handlers
  // ============================================

  /**
   * Handles form submission
   * @param {Event} event - Submit event
   */
  function handleFormSubmit(event) {
    event.preventDefault();

    const formData = new FormData(elements.form);
    const data = {
      name: formData.get('name'),
      pronouns: formData.get('pronouns'),
      stance: formData.get('stance') || '',
    };

    // Server auto-starts the call timer for a new caller and broadcasts it back,
    // which drives the timer display via updateCallerDisplay -> syncTimer.
    socket.emit('updateCaller', data);

    // Add to call log (dock only)
    addToCallLog(data, false);
  }

  /**
   * Handles clear button click
   */
  function handleClear() {
    socket.emit('clearCaller');
    elements.form.reset();

    // Add to call log (dock only); the server clears the timer on clearCaller
    addToCallLog({}, true);
  }

  // ============================================
  // Socket Event Handlers
  // ============================================

  socket.on('callerUpdate', updateCallerDisplay);
  socket.on('queueUpdate', renderQueue);
  socket.on('topicsUpdate', onTopicsUpdate);
  socket.on('callInUpdate', onCallInUpdate);

  // ============================================
  // Initialization
  // ============================================

  function init() {
    elements.form.addEventListener('submit', handleFormSubmit);
    elements.clearBtn.addEventListener('click', handleClear);

    // Dock-specific event listeners
    if (elements.clearLogBtn) {
      elements.clearLogBtn.addEventListener('click', clearCallLog);
    }
    if (elements.exportLogBtn) {
      elements.exportLogBtn.addEventListener('click', exportCallLog);
    }
    // Timer buttons manually override the server-synced call timer
    if (elements.startTimerBtn) {
      elements.startTimerBtn.addEventListener('click', () => socket.emit('startCallerTimer'));
    }
    if (elements.stopTimerBtn) {
      elements.stopTimerBtn.addEventListener('click', () => socket.emit('stopCallerTimer'));
    }

    // Queue event listeners
    if (elements.queueForm) {
      elements.queueForm.addEventListener('submit', handleQueueSubmit);
    }
    if (elements.queueList) {
      elements.queueList.addEventListener('click', handleQueueListClick);
    }
    if (elements.clearQueueBtn) {
      elements.clearQueueBtn.addEventListener('click', handleClearQueue);
    }

    // Stage event listeners (topics + call-in)
    if (elements.updateTopicsBtn) {
      elements.updateTopicsBtn.addEventListener('click', emitTopics);
    }
    if (elements.clearTopicsBtn) {
      elements.clearTopicsBtn.addEventListener('click', () => {
        elements.topicsInput.value = '';
        socket.emit('updateTopics', { items: [], visible: topicsVisible });
      });
    }
    if (elements.toggleTopicsBtn) {
      elements.toggleTopicsBtn.addEventListener('click', () => {
        topicsVisible = !topicsVisible;
        emitTopics();
      });
    }
    if (elements.updateCallInBtn) {
      elements.updateCallInBtn.addEventListener('click', emitCallIn);
    }
    if (elements.toggleCallInBtn) {
      elements.toggleCallInBtn.addEventListener('click', () => {
        callInVisible = !callInVisible;
        emitCallIn();
      });
    }

    // Repaint the timer once per second from the synced start time
    setInterval(renderTimerDisplay, 1000);
  }

  // Start application when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose socket for shared use by other modules on the same page
  window.CallerControl = { socket };
})();