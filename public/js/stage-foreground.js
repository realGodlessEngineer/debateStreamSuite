/**
 * Consolidated Foreground Stage Application
 * OBS overlay for everything that paints OVER the host cams: the show title
 * bar, the caller card, the "Up Next" pill, the claim strip, the scoreboard,
 * the segment countdown and the ticker crawl.
 *
 * This is the render logic of six standalone modules (caller-display,
 * display-claim, display-scoreboard, display-segment, display-ticker) behind
 * ONE socket connection instead of six. Each of those pages is unchanged and
 * still works standalone - this exists so an operator who doesn't need to
 * position each overlay separately can add a single browser source.
 *
 * Every socket contract is identical to the standalone pages, and the server
 * replays all of them on connect, so a source added mid-show fills itself in.
 *
 * Layout (landscape vs portrait) is settled entirely in CSS by an aspect-ratio
 * media query. The one thing JS owns is the `has-ticker` body class, because a
 * lower third that must clear the crawl band needs to know whether the band is
 * actually up - see the note on that toggle below.
 * @module js/stage-foreground
 */

(function () {
  'use strict';

  // ============================================
  // Timings + thresholds
  // ============================================

  const ANIM_BOUNCE_IN = 700;  // ms - matches CSS stageBounceIn
  const ANIM_SLIDE_OUT = 400;  // ms - matches CSS stageSlideOut
  const MAX_TRANSITION_RETRIES = 20;

  // Call-timer color thresholds (mirror CALLER.TIMER_* in src/config/constants.js)
  const CALL_WARN_SECONDS = 300;    // 5:00 → amber
  const CALL_DANGER_SECONDS = 600;  // 10:00 → red

  // Segment-countdown thresholds (mirror SCENE.TIMER_* — remaining, not elapsed)
  const SEGMENT_WARN_SECONDS = 60;
  const SEGMENT_DANGER_SECONDS = 10;

  // Constant crawl speed (px/sec) - keeps the pace steady whether 2 items or
  // 20 are loaded, rather than a fixed duration that would crawl agonizingly
  // slowly with little content or blur past with a lot.
  const TICKER_PIXELS_PER_SECOND = 120;

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
    // Title bar
    titleBar: document.getElementById('titleBar'),
    titleBarTwoHost: document.getElementById('titleBarTwoHost'),
    titleBarOneHost: document.getElementById('titleBarOneHost'),
    host1Name: document.getElementById('host1NameDisplay'),
    host1Pronouns: document.getElementById('host1PronounsDisplay'),
    host2Name: document.getElementById('host2NameDisplay'),
    host2Pronouns: document.getElementById('host2PronounsDisplay'),
    showTitle: document.getElementById('showTitleDisplay'),
    soloHostName: document.getElementById('soloHostNameDisplay'),
    soloHostPronouns: document.getElementById('soloHostPronounsDisplay'),
    soloShowTitle: document.getElementById('soloShowTitleDisplay'),

    // Caller card
    callerDisplay: document.getElementById('callerDisplay'),
    callerCardTwoHost: document.getElementById('callerCardTwoHost'),
    callerCardOneHost: document.getElementById('callerCardOneHost'),
    callerNameTwoHost: document.getElementById('callerNameTwoHost'),
    callerPronounsTwoHost: document.getElementById('callerPronounsTwoHost'),
    callerNameOneHost: document.getElementById('callerNameOneHost'),
    callerPronounsOneHost: document.getElementById('callerPronounsOneHost'),
    callerStanceTwoHost: document.getElementById('callerStanceTwoHost'),
    callerStanceOneHost: document.getElementById('callerStanceOneHost'),
    callerTimerTwoHost: document.getElementById('callerTimerTwoHost'),
    callerTimerOneHost: document.getElementById('callerTimerOneHost'),

    // On-deck (up next) pill
    onDeck: document.getElementById('onDeck'),
    onDeckName: document.getElementById('onDeckName'),
    onDeckStance: document.getElementById('onDeckStance'),

    // Claim strip
    claimBanner: document.getElementById('claimBanner'),
    claimText: document.getElementById('claimText'),
    claimSubtext: document.getElementById('claimSubtext'),

    // Scoreboard
    scoreboardCard: document.getElementById('scoreboardCard'),
    scoreboardRows: document.getElementById('scoreboardRows'),

    // Segment countdown
    segmentTimer: document.getElementById('segmentTimer'),
    segmentLabel: document.getElementById('segmentLabel'),
    segmentClock: document.getElementById('segmentClock'),

    // Ticker
    tickerBar: document.getElementById('tickerBar'),
    tickerTrack: document.getElementById('tickerTrack'),
    tickerRunA: document.getElementById('tickerRunA'),
    tickerRunB: document.getElementById('tickerRunB'),
  };

  // ============================================
  // Module state
  // ============================================

  let showConfig = { showTitle: '', hosts: [] };
  let titleBarVisible = false;
  let callerVisible = false;
  let transitioning = false;
  let currentTimerStartedAt = null;  // server-clock ms, or null when stopped
  let lastScores = {};
  let segment = { label: '', endsAt: null, remainingMs: 0, running: false };

  // ============================================
  // Socket Connection — one for the whole stage
  // ============================================

  const connection = createSocketConnection();
  const socket = connection.socket;

  // ============================================
  // Shared: stance chip rendering
  // ============================================

  /**
   * Render a stance chip: sets label, data-stance (drives CSS color), visibility
   * @param {HTMLElement} el - Chip element
   * @param {string} stance - Stance key or ''
   */
  function renderStance(el, stance) {
    if (!el) return;
    const key = stance || '';
    const label = STANCE_LABELS[key] || '';
    el.textContent = label;
    el.setAttribute('data-stance', key);
    el.classList.toggle('visible', !!label);
  }

  // ============================================
  // Title bar / caller card — host count mode
  // ============================================

  function getHostCount() {
    const validHosts = (showConfig.hosts || []).filter(h => h && h.name);
    return validHosts.length;
  }

  function hasShowConfig() {
    return !!(showConfig.showTitle || getHostCount() > 0);
  }

  function isTwoHostMode() {
    return getHostCount() >= 2;
  }

  function activateLayout() {
    const twoHost = isTwoHostMode();

    elements.titleBarTwoHost.classList.toggle('active', twoHost);
    elements.titleBarOneHost.classList.toggle('active', !twoHost && hasShowConfig());

    elements.callerCardTwoHost.classList.toggle('active', twoHost);
    elements.callerCardOneHost.classList.toggle('active', !twoHost);
  }

  function populateShowConfig() {
    const hosts = showConfig.hosts || [];

    if (isTwoHostMode()) {
      elements.host1Name.textContent = hosts[0] ? hosts[0].name : '';
      elements.host1Pronouns.textContent = hosts[0] && hosts[0].pronouns ? '(' + hosts[0].pronouns + ')' : '';
      elements.host2Name.textContent = hosts[1] ? hosts[1].name : '';
      elements.host2Pronouns.textContent = hosts[1] && hosts[1].pronouns ? '(' + hosts[1].pronouns + ')' : '';
      elements.showTitle.textContent = showConfig.showTitle || '';

      // Hide show title row if empty
      const showRow = elements.showTitle.parentElement;
      showRow.style.display = showConfig.showTitle ? '' : 'none';
    } else {
      const host = hosts[0];
      elements.soloHostName.textContent = host ? host.name : '';
      elements.soloHostPronouns.textContent = host && host.pronouns ? '(' + host.pronouns + ')' : '';
      elements.soloShowTitle.textContent = showConfig.showTitle || '';
      elements.soloShowTitle.style.display = showConfig.showTitle ? '' : 'none';
    }
  }

  function populateCaller(data) {
    const name = data.name || '';
    // No parentheses - the pronouns render as their own pill beside the name
    const pronouns = data.pronouns || '';

    elements.callerNameTwoHost.textContent = name;
    elements.callerPronounsTwoHost.textContent = pronouns;
    elements.callerNameOneHost.textContent = name;
    elements.callerPronounsOneHost.textContent = pronouns;

    renderStance(elements.callerStanceTwoHost, data.stance);
    renderStance(elements.callerStanceOneHost, data.stance);

    // The card's own data-stance drives its accent edge color
    elements.callerCardTwoHost.setAttribute('data-stance', data.stance || '');
    elements.callerCardOneHost.setAttribute('data-stance', data.stance || '');

    currentTimerStartedAt = typeof data.timerStartedAt === 'number' ? data.timerStartedAt : null;
    renderCallTimer();
  }

  /**
   * Format elapsed seconds as MM:SS, rolling over to H:MM:SS past an hour.
   * Minutes are zero-padded so the readout keeps a constant width as it ticks.
   * @param {number} totalSeconds
   * @returns {string}
   */
  function formatElapsed(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const mm = (m < 10 ? '0' : '') + m;
    const ss = (s < 10 ? '0' : '') + s;
    return h > 0 ? h + ':' + mm + ':' + ss : mm + ':' + ss;
  }

  /**
   * Repaint the call timer from currentTimerStartedAt. Called once per second
   * and whenever caller state changes; amber past WARN, red past DANGER.
   */
  function renderCallTimer() {
    const timers = [elements.callerTimerTwoHost, elements.callerTimerOneHost];

    if (currentTimerStartedAt == null) {
      timers.forEach(function (el) {
        if (!el) return;
        el.textContent = '';
        el.classList.remove('visible', 'warn', 'danger');
      });
      return;
    }

    const elapsed = Math.max(0, Math.floor((Date.now() - currentTimerStartedAt) / 1000));
    const text = formatElapsed(elapsed);
    const danger = elapsed >= CALL_DANGER_SECONDS;
    const warn = !danger && elapsed >= CALL_WARN_SECONDS;

    timers.forEach(function (el) {
      if (!el) return;
      el.textContent = text;
      el.classList.add('visible');
      el.classList.toggle('warn', warn);
      el.classList.toggle('danger', danger);
    });
  }

  // ============================================
  // On-deck (Up Next) pill
  // ============================================

  function renderOnDeck(queue) {
    const items = (queue && queue.items) || [];
    if (!items.length) {
      elements.onDeck.classList.remove('visible');
      return;
    }
    const next = items[0];
    elements.onDeckName.textContent = next.name || '';
    renderStance(elements.onDeckStance, next.stance);
    elements.onDeck.classList.add('visible');
  }

  // ============================================
  // Lower-third transitions
  // ============================================

  function showElement(el) {
    el.classList.remove('hiding');
    el.classList.add('visible');
  }

  function hideElement(el) {
    return new Promise(function (resolve) {
      el.classList.remove('visible');
      el.classList.add('hiding');
      setTimeout(function () {
        el.classList.remove('hiding');
        resolve();
      }, ANIM_SLIDE_OUT);
    });
  }

  /** Show the title bar (when no caller is active and show config exists) */
  function showTitleBar() {
    if (titleBarVisible || !hasShowConfig() || transitioning) return;
    transitioning = true;

    populateShowConfig();
    activateLayout();
    showElement(elements.titleBar);
    titleBarVisible = true;

    setTimeout(function () { transitioning = false; }, ANIM_BOUNCE_IN);
  }

  function hideTitleBar() {
    if (!titleBarVisible || transitioning) return Promise.resolve();
    transitioning = true;

    return hideElement(elements.titleBar).then(function () {
      titleBarVisible = false;
      transitioning = false;
    });
  }

  function showCallerCard(data, retries) {
    retries = retries || 0;

    if (transitioning) {
      if (retries >= MAX_TRANSITION_RETRIES) {
        console.warn('Max transition retries reached for showCallerCard, forcing transition');
        transitioning = false;
      } else {
        setTimeout(function () { showCallerCard(data, retries + 1); }, 100);
        return;
      }
    }
    transitioning = true;

    function doShow() {
      populateCaller(data);
      activateLayout();
      showElement(elements.callerDisplay);
      callerVisible = true;
      setTimeout(function () { transitioning = false; }, ANIM_BOUNCE_IN);
    }

    // Hide title bar first if visible
    if (titleBarVisible) {
      hideElement(elements.titleBar).then(function () {
        titleBarVisible = false;
        doShow();
      });
    } else {
      doShow();
    }
  }

  function hideCallerCard(retries) {
    if (!callerVisible) {
      // No caller visible, just ensure title bar state is correct
      if (hasShowConfig() && !titleBarVisible) {
        showTitleBar();
      }
      return;
    }

    retries = retries || 0;

    if (transitioning) {
      if (retries >= MAX_TRANSITION_RETRIES) {
        console.warn('Max transition retries reached for hideCallerCard, forcing transition');
        transitioning = false;
      } else {
        setTimeout(function () { hideCallerCard(retries + 1); }, 100);
        return;
      }
    }
    transitioning = true;

    hideElement(elements.callerDisplay).then(function () {
      callerVisible = false;

      // Clear caller text after hide animation
      populateCaller({ name: '', pronouns: '' });

      transitioning = false;

      if (hasShowConfig()) {
        showTitleBar();
      }
    });
  }

  // ============================================
  // Claim strip
  // ============================================

  /**
   * Render the claim banner. Hidden when !visible or the proposition text is
   * empty. The subtext line only shows when it has content, even while the
   * banner itself is visible. Operator text goes in via textContent.
   * @param {{ text: string, subtext: string, visible: boolean }} data
   */
  function renderClaim(data) {
    const text = (data && data.text) || '';
    const subtext = (data && data.subtext) || '';
    const visible = !!(data && data.visible);

    if (!visible || !text) {
      elements.claimBanner.classList.remove('visible');
      return;
    }

    elements.claimText.textContent = text;
    elements.claimSubtext.textContent = subtext;
    elements.claimSubtext.classList.toggle('has-subtext', !!subtext);
    elements.claimBanner.classList.add('visible');
  }

  // ============================================
  // Scoreboard
  // ============================================

  /**
   * Render the scoreboard card. Hidden when !visible or every side is 0 - an
   * untouched board should stay invisible instead of showing a wall of zeros
   * for every possible stance. Rows are rebuilt from scratch on every update,
   * so a freshly created element always plays the pulse on insertion; no need
   * to force a reflow to restart it.
   * @param {{ scores: Object<string, number>, visible: boolean }} data
   */
  function renderScoreboard(data) {
    const scores = (data && data.scores) || {};
    const visible = !!(data && data.visible);
    const activeSides = Object.keys(scores).filter(function (side) { return scores[side] !== 0; });

    if (!visible || !activeSides.length) {
      elements.scoreboardCard.classList.remove('visible');
      lastScores = Object.assign({}, scores);
      return;
    }

    elements.scoreboardRows.textContent = '';
    activeSides.forEach(function (side) {
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

      elements.scoreboardRows.appendChild(row);
    });

    elements.scoreboardCard.classList.add('visible');
    lastScores = Object.assign({}, scores);
  }

  // ============================================
  // Segment countdown
  // ============================================

  function formatClock(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return mins + ':' + secs.toString().padStart(2, '0');
  }

  /**
   * Repaint the countdown from the current synced state (called on a tick).
   * `endsAt` is a server-clock ms timestamp - remaining time is computed as
   * `endsAt - Date.now()` locally rather than ticked down from a local value,
   * so every overlay and the dock agree on the same instant.
   */
  function renderSegment() {
    const hasContent = segment.running || segment.remainingMs > 0 || !!segment.label;
    if (!hasContent) {
      elements.segmentTimer.classList.remove('visible');
      return;
    }

    const remainingMs = segment.running && segment.endsAt
      ? Math.max(0, segment.endsAt - Date.now())
      : Math.max(0, segment.remainingMs);
    const remainingSeconds = Math.ceil(remainingMs / 1000);

    elements.segmentLabel.textContent = segment.label;
    elements.segmentClock.textContent = formatClock(remainingSeconds);

    const danger = remainingSeconds <= SEGMENT_DANGER_SECONDS;
    const warn = !danger && remainingSeconds <= SEGMENT_WARN_SECONDS;
    elements.segmentClock.classList.toggle('danger', danger);
    elements.segmentClock.classList.toggle('warn', warn);

    elements.segmentTimer.classList.add('visible');
  }

  /**
   * Adopt the authoritative segment-timer state from the server
   * @param {{ label: string, endsAt: number|null, remainingMs: number, running: boolean }} data
   */
  function onSegmentTimerUpdate(data) {
    segment = {
      label: (data && data.label) || '',
      endsAt: (data && typeof data.endsAt === 'number') ? data.endsAt : null,
      remainingMs: (data && typeof data.remainingMs === 'number') ? data.remainingMs : 0,
      running: !!(data && data.running),
    };
    renderSegment();
  }

  // ============================================
  // Ticker
  // ============================================

  /**
   * Fill one run element with the items, each followed by a delimiter glyph
   * (including after the last item) so the seam between the two copies reads
   * as one continuous list rather than two runs butted together.
   * Operator text goes in via textContent, never innerHTML.
   * @param {HTMLElement} run
   * @param {string[]} items
   */
  function buildTickerRun(run, items) {
    run.textContent = '';
    items.forEach(function (item) {
      const span = document.createElement('span');
      span.className = 'ticker-item';
      span.textContent = item;
      run.appendChild(span);

      const sep = document.createElement('span');
      sep.className = 'ticker-sep';
      sep.textContent = '◆'; // diamond
      sep.setAttribute('aria-hidden', 'true');
      run.appendChild(sep);
    });
  }

  /**
   * Recompute the crawl duration from the rendered run width at a fixed px/sec
   * speed, then (re)start the animation so a change in item count takes effect
   * immediately instead of finishing out whatever duration was already in
   * flight. A CSS animation (not a rAF loop) drives the motion, since OBS
   * composites CSS transforms far more cheaply than a per-frame JS loop in a
   * background source; the only JS work here is the width measurement.
   */
  function resyncTicker() {
    const width = elements.tickerRunA.getBoundingClientRect().width;
    const duration = width > 0 ? width / TICKER_PIXELS_PER_SECOND : 0;

    elements.tickerTrack.style.animation = 'none';
    // Force a reflow so the next animation assignment restarts at frame 0
    // instead of resuming whatever cycle position the browser cached.
    void elements.tickerTrack.offsetHeight;
    elements.tickerTrack.style.animation = duration > 0
      ? 'ticker-crawl ' + duration + 's linear infinite'
      : 'none';
  }

  /**
   * Render the ticker band. Hidden when !visible or the list is empty.
   *
   * The `has-ticker` body class is the one piece of cross-overlay coordination
   * this page owns: the crawl band is pinned flush to the bottom edge and the
   * lower third sits just above it, so the card has to lift when the band
   * appears. CSS can't ask "is that other element visible?" without :has(),
   * whose support in older OBS/CEF builds isn't safe to assume, so the class
   * is set here instead.
   * @param {{ items: string[], visible: boolean }} data
   */
  function renderTicker(data) {
    const items = (data && data.items) || [];
    const visible = !!(data && data.visible);
    const showing = visible && items.length > 0;

    document.body.classList.toggle('has-ticker', showing);

    if (!showing) {
      elements.tickerBar.classList.remove('visible');
      elements.tickerTrack.style.animation = 'none';
      return;
    }

    buildTickerRun(elements.tickerRunA, items);
    buildTickerRun(elements.tickerRunB, items);
    elements.tickerBar.classList.add('visible');

    // Wait a frame so the freshly-built DOM has a real layout to measure.
    requestAnimationFrame(resyncTicker);
  }

  // ============================================
  // Socket Event Handlers
  // ============================================

  socket.on('callerUpdate', function (data) {
    if (data.name) {
      showCallerCard(data);
    } else {
      hideCallerCard();
    }
  });

  socket.on('queueUpdate', renderOnDeck);

  socket.on('showConfigUpdate', function (config) {
    showConfig = config;

    // If a caller is live, just keep the new config in hand - the layout picks
    // it up the next time the title bar is shown.
    if (!callerVisible) {
      if (hasShowConfig()) {
        if (titleBarVisible) {
          activateLayout();
          populateShowConfig();
        } else {
          showTitleBar();
        }
      } else if (titleBarVisible) {
        hideTitleBar();
      }
    }
  });

  socket.on('claimUpdate', renderClaim);
  socket.on('scoreboardUpdate', renderScoreboard);
  socket.on('segmentTimerUpdate', onSegmentTimerUpdate);
  socket.on('tickerUpdate', renderTicker);

  // ============================================
  // Initialization
  // ============================================

  // Call timer ticks once per second; the countdown repaints every 250ms so
  // its last second still reads smoothly.
  setInterval(renderCallTimer, 1000);
  setInterval(renderSegment, 250);

  // The bundled Futura face loads with font-display: swap, so the very first
  // ticker render can measure the narrower fallback (Impact) width before the
  // webfont arrives and reflows the text wider - silently locking in a
  // too-short duration (too-fast crawl) for the rest of that page load.
  // Re-running the measurement once the real font is ready corrects for that
  // swap; with no items loaded it is a harmless no-op.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(resyncTicker);
  }

  console.log('Consolidated foreground stage initialized - waiting for data...');
})();
