/**
 * Scoreboard Control Module
 * Manages the dock's live per-side score tally: a +/- pair and running
 * total per debate side, a Reset-All, and the overlay visibility toggle.
 * Reuses the shared socket from caller-control.js (window.CallerControl.socket)
 * rather than opening a second connection - see public/js/show-config-modal.js
 * for the same pattern.
 * @module js/scoreboard-control
 */

(function () {
  'use strict';

  // Debate-side keys, in display order. Mirrors CALLER.STANCES in
  // src/config/constants.js, which is the actual source of truth server-side
  // (scoreboardAdjust rejects anything outside it) - this local copy only
  // decides the order the dock rows are built in, same as the duplicated
  // STANCE_LABELS map every other front-end page already carries.
  const STANCES = [
    'theist', 'atheist', 'agnostic',
    'christian', 'muslim', 'jewish',
    'undecided', 'other',
  ];

  // Stance key -> display label (same mapping used in caller-control.js)
  const STANCE_LABELS = {
    theist: 'Theist', atheist: 'Atheist', agnostic: 'Agnostic',
    christian: 'Christian', muslim: 'Muslim', jewish: 'Jewish',
    undecided: 'Undecided', other: 'Other',
  };

  let isInitialized = false;
  let socket = null;

  const refs = {};

  // ============================================
  // Row Construction
  // ============================================

  /**
   * Builds the eight per-side control rows once. Each tally span gets a
   * stable id so renderScores() can update it in place on every
   * 'scoreboardUpdate' without rebuilding the DOM (and losing button focus
   * mid-click during a live show).
   */
  function buildRows() {
    refs.rows.textContent = '';

    STANCES.forEach((side) => {
      const row = document.createElement('div');
      row.className = 'scoreboard-row-control';
      row.setAttribute('data-stance', side);

      const label = document.createElement('span');
      label.className = 'scoreboard-row-label';
      label.textContent = STANCE_LABELS[side];

      const minusBtn = document.createElement('button');
      minusBtn.type = 'button';
      minusBtn.className = 'scoreboard-adj-btn';
      minusBtn.setAttribute('aria-label', `Decrease ${STANCE_LABELS[side]} score`);
      minusBtn.textContent = '−';
      minusBtn.addEventListener('click', () => adjust(side, -1));

      const tally = document.createElement('span');
      tally.className = 'scoreboard-row-tally';
      tally.id = `scoreTally-${side}`;
      tally.textContent = '0';

      const plusBtn = document.createElement('button');
      plusBtn.type = 'button';
      plusBtn.className = 'scoreboard-adj-btn';
      plusBtn.setAttribute('aria-label', `Increase ${STANCE_LABELS[side]} score`);
      plusBtn.textContent = '+';
      plusBtn.addEventListener('click', () => adjust(side, 1));

      row.appendChild(label);
      row.appendChild(minusBtn);
      row.appendChild(tally);
      row.appendChild(plusBtn);
      refs.rows.appendChild(row);
    });
  }

  // ============================================
  // Socket Actions
  // ============================================

  function adjust(side, delta) {
    socket.emit('scoreboardAdjust', { side, delta });
  }

  // ============================================
  // Rendering (server is the source of truth for every score)
  // ============================================

  function renderScores(data) {
    const scores = (data && data.scores) || {};

    STANCES.forEach((side) => {
      const el = document.getElementById(`scoreTally-${side}`);
      if (el) el.textContent = String(scores[side] || 0);
    });

    const visible = !!(data && data.visible);
    refs.toggleBtn.textContent = visible ? 'Hide' : 'Show';
    refs.toggleBtn.classList.toggle('active', visible);
  }

  // ============================================
  // Initialization
  // ============================================

  function init(socketInstance) {
    if (isInitialized) return;

    socket = socketInstance;

    refs.rows = document.getElementById('scoreboardControlRows');
    refs.resetBtn = document.getElementById('resetScoreboardBtn');
    refs.toggleBtn = document.getElementById('toggleScoreboardBtn');

    if (!refs.rows || !refs.resetBtn || !refs.toggleBtn) return;

    buildRows();

    refs.resetBtn.addEventListener('click', () => {
      socket.emit('scoreboardReset');
    });

    refs.toggleBtn.addEventListener('click', () => {
      socket.emit('scoreboardToggleVisibility');
    });

    socket.on('scoreboardUpdate', renderScores);

    isInitialized = true;
  }

  // ============================================
  // Public API
  // ============================================

  window.ScoreboardControl = { init };
})();
