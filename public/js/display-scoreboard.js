/**
 * Scoreboard Overlay Application
 * OBS overlay for the live per-side score tally. Split into its own browser
 * source (mirrors display-topics.js) so it can be positioned, scaled, and
 * toggled independently of the caller lower-third and the stage topic stack.
 * Listens only to 'scoreboardUpdate'; the server replays it on connect, so a
 * source added mid-show fills itself in immediately.
 * @module js/display-scoreboard
 */

(function () {
  'use strict';

  // Stance key -> display label (keys validated server-side against
  // CALLER.STANCES; same mapping every other front-end page duplicates).
  const STANCE_LABELS = {
    theist: 'Theist', atheist: 'Atheist', agnostic: 'Agnostic',
    christian: 'Christian', muslim: 'Muslim', jewish: 'Jewish',
    undecided: 'Undecided', other: 'Other',
  };

  const PULSE_DURATION_MS = 650; // matches the CSS scoreboardPulse animation

  const elements = {
    card: document.getElementById('scoreboardCard'),
    rows: document.getElementById('scoreboardRows'),
  };

  const connection = createSocketConnection();
  const socket = connection.socket;

  // Last-seen scores, used to flag which side just changed so only that
  // row gets the pulse cue - the only signal a viewer gets that a point
  // landed. Rows are rebuilt from scratch on every update (see below), so a
  // freshly created element always plays the animation on insertion; no
  // need to force a reflow to restart it.
  let lastScores = {};

  /**
   * Render the scoreboard card. Hidden when !visible or every side is 0 -
   * an untouched board should stay invisible instead of showing a wall of
   * zeros for every possible stance.
   * @param {{ scores: Object<string, number>, visible: boolean }} data
   */
  function renderScoreboard(data) {
    const scores = (data && data.scores) || {};
    const visible = !!(data && data.visible);
    const activeSides = Object.keys(scores).filter((side) => scores[side] !== 0);

    if (!visible || !activeSides.length) {
      elements.card.classList.remove('visible');
      lastScores = { ...scores };
      return;
    }

    elements.rows.textContent = '';
    activeSides.forEach((side) => {
      const row = document.createElement('div');
      row.className = 'scoreboard-row';
      row.setAttribute('data-stance', side);

      const label = document.createElement('span');
      label.className = 'scoreboard-side';
      label.textContent = STANCE_LABELS[side] || side;

      const score = document.createElement('span');
      score.className = 'scoreboard-score';
      score.textContent = String(scores[side]);

      row.appendChild(label);
      row.appendChild(score);

      if (lastScores[side] !== undefined && lastScores[side] !== scores[side]) {
        row.classList.add('pulse');
      }

      elements.rows.appendChild(row);
    });

    elements.card.classList.add('visible');
    lastScores = { ...scores };
  }

  socket.on('scoreboardUpdate', renderScoreboard);

  console.log('Scoreboard overlay display initialized - waiting for data...');
})();
