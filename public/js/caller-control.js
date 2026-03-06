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

  // ============================================
  // DOM Elements
  // ============================================

  const elements = {
    form: document.getElementById('callerForm'),
    clearBtn: document.getElementById('clearBtn'),
    currentName: document.getElementById('currentName'),
    currentPronouns: document.getElementById('currentPronouns'),
    // Support both index.html and dock.html status elements
    statusIndicator: document.getElementById('statusIndicator'),
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),
    nameInput: document.getElementById('name'),
    pronounsInput: document.getElementById('pronouns'),
    // Dock-specific elements
    callLog: document.getElementById('callLog'),
    clearLogBtn: document.getElementById('clearLogBtn'),
    exportLogBtn: document.getElementById('exportLogBtn'),
    timerDisplay: document.getElementById('timerDisplay'),
    timerStatus: document.getElementById('timerStatus'),
    startTimerBtn: document.getElementById('startTimerBtn'),
    stopTimerBtn: document.getElementById('stopTimerBtn'),
  };

  // ============================================
  // Call Log State
  // ============================================
  let callHistory = [];

  // ============================================
  // Timer State
  // ============================================
  let timerInterval = null;
  let timerSeconds = 0;
  let timerRunning = false;

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

  function updateTimerDisplay() {
    if (elements.timerDisplay) {
      elements.timerDisplay.textContent = formatTimer(timerSeconds);
    }
  }

  function startTimer() {
    if (timerRunning || !elements.timerDisplay) return;
    timerRunning = true;
    timerSeconds = 0;
    updateTimerDisplay();

    if (elements.timerStatus) {
      elements.timerStatus.textContent = 'RUNNING';
      elements.timerStatus.classList.add('active');
    }

    timerInterval = setInterval(() => {
      timerSeconds++;
      updateTimerDisplay();
    }, 1000);
  }

  function stopTimer() {
    if (!timerRunning) return;
    timerRunning = false;
    clearInterval(timerInterval);
    timerInterval = null;

    if (elements.timerStatus) {
      elements.timerStatus.textContent = 'STOPPED';
      elements.timerStatus.classList.remove('active');
    }
  }

  // ============================================
  // Display Functions
  // ============================================

  /**
   * Updates the current caller display
   * @param {Object} data - Caller data { name, pronouns }
   */
  function updateCallerDisplay(data) {
    elements.currentName.textContent = data.name || '-';
    elements.currentPronouns.textContent = data.pronouns || '-';
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
    };

    socket.emit('updateCaller', data);

    // Add to call log and start timer (dock only)
    addToCallLog(data, false);
    startTimer();
  }

  /**
   * Handles clear button click
   */
  function handleClear() {
    socket.emit('clearCaller');
    elements.form.reset();

    // Add to call log and stop timer (dock only)
    addToCallLog({}, true);
    stopTimer();
  }

  // ============================================
  // Socket Event Handlers
  // ============================================

  socket.on('callerUpdate', updateCallerDisplay);

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
    if (elements.startTimerBtn) {
      elements.startTimerBtn.addEventListener('click', startTimer);
    }
    if (elements.stopTimerBtn) {
      elements.stopTimerBtn.addEventListener('click', stopTimer);
    }

    // Clean up timer on page unload
    window.addEventListener('beforeunload', stopTimer);
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