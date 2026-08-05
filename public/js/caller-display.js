/**
 * Caller Display Application
 * OBS overlay for displaying caller information and show title/hosts
 * Supports 1-host (right-aligned popup) and 2-host (full-width lower third) layouts
 * @module js/caller-display
 */

(function () {
  'use strict';

  // ============================================
  // Animation Timing
  // ============================================

  const ANIM_BOUNCE_IN = 700;  // ms - matches CSS bounceIn
  const ANIM_SLIDE_OUT = 400;  // ms - matches CSS slideOut
  const MAX_TRANSITION_RETRIES = 20;

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

    // Caller display
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
  };

  // ============================================
  // State
  // ============================================

  let showConfig = { showTitle: '', hosts: [] };
  let titleBarVisible = false;
  let callerVisible = false;
  let transitioning = false;
  let currentTimerStartedAt = null;  // server-clock ms, or null when stopped

  // ============================================
  // Socket Connection
  // ============================================

  const connection = createSocketConnection();
  const socket = connection.socket;

  // ============================================
  // Helper: Host Count Mode
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

  // ============================================
  // Layout Activation
  // ============================================

  function activateLayout() {
    const twoHost = isTwoHostMode();

    // Title bar layout
    elements.titleBarTwoHost.classList.toggle('active', twoHost);
    elements.titleBarOneHost.classList.toggle('active', !twoHost && hasShowConfig());

    // Caller card layout
    elements.callerCardTwoHost.classList.toggle('active', twoHost);
    elements.callerCardOneHost.classList.toggle('active', !twoHost);
  }

  // ============================================
  // Show Config Population
  // ============================================

  function populateShowConfig() {
    const hosts = showConfig.hosts || [];

    if (isTwoHostMode()) {
      // 2-host mode
      elements.host1Name.textContent = hosts[0] ? hosts[0].name : '';
      elements.host1Pronouns.textContent = hosts[0] && hosts[0].pronouns ? '(' + hosts[0].pronouns + ')' : '';
      elements.host2Name.textContent = hosts[1] ? hosts[1].name : '';
      elements.host2Pronouns.textContent = hosts[1] && hosts[1].pronouns ? '(' + hosts[1].pronouns + ')' : '';
      elements.showTitle.textContent = showConfig.showTitle || '';

      // Hide show title row if empty
      const showRow = elements.showTitle.parentElement;
      showRow.style.display = showConfig.showTitle ? '' : 'none';
    } else {
      // 1-host mode
      const host = hosts[0];
      elements.soloHostName.textContent = host ? host.name : '';
      elements.soloHostPronouns.textContent = host && host.pronouns ? '(' + host.pronouns + ')' : '';
      elements.soloShowTitle.textContent = showConfig.showTitle || '';

      // Hide show title if empty
      elements.soloShowTitle.style.display = showConfig.showTitle ? '' : 'none';
    }
  }

  // ============================================
  // Caller Population
  // ============================================

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
    renderTimer();
  }

  // ============================================
  // Stance Chip + Call Timer Rendering
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

  /**
   * Format elapsed seconds as MM:SS, rolling over to H:MM:SS past an hour
   * (the old MM:SS-only form showed a 65-minute call as "65:00"). Minutes
   * are zero-padded so the readout keeps a constant width as it ticks.
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
  function renderTimer() {
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
    const danger = elapsed >= TIMER_DANGER_SECONDS;
    const warn = !danger && elapsed >= TIMER_WARN_SECONDS;

    timers.forEach(function (el) {
      if (!el) return;
      el.textContent = text;
      el.classList.add('visible');
      el.classList.toggle('warn', warn);
      el.classList.toggle('danger', danger);
    });
  }

  // ============================================
  // On-Deck (Up Next) Rendering
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
  // Animation Helpers
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

  // ============================================
  // Transition Logic
  // ============================================

  /**
   * Show the title bar (when no caller is active and show config exists)
   */
  function showTitleBar() {
    if (titleBarVisible || !hasShowConfig() || transitioning) return;
    transitioning = true;

    populateShowConfig();
    activateLayout();
    showElement(elements.titleBar);
    titleBarVisible = true;

    setTimeout(function () { transitioning = false; }, ANIM_BOUNCE_IN);
  }

  /**
   * Hide the title bar
   */
  function hideTitleBar() {
    if (!titleBarVisible || transitioning) return Promise.resolve();
    transitioning = true;

    return hideElement(elements.titleBar).then(function () {
      titleBarVisible = false;
      transitioning = false;
    });
  }

  /**
   * Show the caller card
   */
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

  /**
   * Hide the caller card and show title bar if config exists
   */
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

      // Show title bar if config exists
      if (hasShowConfig()) {
        showTitleBar();
      }
    });
  }

  // ============================================
  // Socket Event Handlers
  // ============================================

  /**
   * Handle caller update events
   */
  socket.on('callerUpdate', function (data) {
    if (data.name) {
      showCallerCard(data);
    } else {
      hideCallerCard();
    }
  });

  /**
   * Handle caller-queue update events (drives the on-deck pill)
   */
  socket.on('queueUpdate', renderOnDeck);

  /**
   * Handle show config update events
   */
  socket.on('showConfigUpdate', function (config) {
    showConfig = config;

    // If caller is visible, just update internal state
    // The layout will update next time we show something
    if (!callerVisible) {
      if (hasShowConfig()) {
        // Update and re-show the title bar with new config
        if (titleBarVisible) {
          // Update in place
          activateLayout();
          populateShowConfig();
        } else {
          showTitleBar();
        }
      } else if (titleBarVisible) {
        // Config was cleared, hide title bar
        hideTitleBar();
      }
    }
  });

  // ============================================
  // Initialization
  // ============================================

  // Tick the call timer once per second (reads currentTimerStartedAt)
  setInterval(renderTimer, 1000);

  console.log('Caller display initialized - waiting for data...');
})();
