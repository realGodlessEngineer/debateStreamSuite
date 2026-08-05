/**
 * Vertical Display Application
 * OBS overlay for portrait (1080x1920) display
 * Show info always visible at top, caller animates independently at bottom
 * @module js/vertical-display
 */

(function () {
  'use strict';

  // ============================================
  // Animation Timing
  // ============================================

  const ANIM_BOUNCE_IN = 700;
  const ANIM_SLIDE_OUT = 400;

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
    showInfo: document.getElementById('showInfo'),
    showTitle: document.getElementById('showTitleDisplay'),
    hostsContainer: document.getElementById('hostsContainer'),
    host1Card: document.getElementById('host1Card'),
    host1Name: document.getElementById('host1NameDisplay'),
    host1Pronouns: document.getElementById('host1PronounsDisplay'),
    host2Card: document.getElementById('host2Card'),
    host2Name: document.getElementById('host2NameDisplay'),
    host2Pronouns: document.getElementById('host2PronounsDisplay'),
    callerDisplay: document.getElementById('callerDisplay'),
    callerCard: document.getElementById('callerCard'),
    callerName: document.getElementById('callerNameDisplay'),
    callerPronouns: document.getElementById('callerPronounsDisplay'),
    callerStance: document.getElementById('callerStanceDisplay'),
    callerTimer: document.getElementById('callerTimerDisplay'),
    stageTopics: document.getElementById('stageTopics'),
    stageTopicsList: document.getElementById('stageTopicsList'),
    stageCallIn: document.getElementById('stageCallIn'),
    stageCallInText: document.getElementById('stageCallInText'),
  };

  // ============================================
  // State
  // ============================================

  let showConfig = { showTitle: '', hosts: [] };
  let showInfoVisible = false;
  let callerVisible = false;
  let currentTimerStartedAt = null;  // server-clock ms, or null when stopped

  // ============================================
  // Socket Connection
  // ============================================

  const connection = createSocketConnection();
  const socket = connection.socket;

  // ============================================
  // Helpers
  // ============================================

  function hasShowConfig() {
    var hosts = (showConfig.hosts || []).filter(function (h) { return h && h.name; });
    return !!(showConfig.showTitle || hosts.length > 0);
  }

  // ============================================
  // Show Info Population
  // ============================================

  function populateShowInfo() {
    var hosts = showConfig.hosts || [];
    var host1 = hosts[0];
    var host2 = hosts[1];
    var hasHost1 = host1 && host1.name;
    var hasHost2 = host2 && host2.name;

    elements.showTitle.textContent = showConfig.showTitle || '';

    elements.host1Name.textContent = hasHost1 ? host1.name : '';
    elements.host1Pronouns.textContent = hasHost1 && host1.pronouns ? '(' + host1.pronouns + ')' : '';
    elements.host1Card.classList.toggle('hidden', !hasHost1);

    elements.host2Name.textContent = hasHost2 ? host2.name : '';
    elements.host2Pronouns.textContent = hasHost2 && host2.pronouns ? '(' + host2.pronouns + ')' : '';
    elements.host2Card.classList.toggle('hidden', !hasHost2);

    // Side-by-side layout when both hosts exist
    elements.hostsContainer.classList.toggle('side-by-side', hasHost1 && hasHost2);
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
  // Show Info Transitions
  // ============================================

  function showShowInfo() {
    if (showInfoVisible || !hasShowConfig()) return;
    populateShowInfo();
    showElement(elements.showInfo);
    showInfoVisible = true;
  }

  function hideShowInfo() {
    if (!showInfoVisible) return;
    hideElement(elements.showInfo).then(function () {
      showInfoVisible = false;
    });
  }

  // ============================================
  // Caller Transitions
  // ============================================

  function showCallerCard(data) {
    var name = data.name || '';
    // No parentheses - the pronouns render as their own pill beside the name
    var pronouns = data.pronouns || '';

    elements.callerName.textContent = name;
    elements.callerPronouns.textContent = pronouns;
    renderStance(elements.callerStance, data.stance);
    // The card's own data-stance drives its accent edge color
    elements.callerCard.setAttribute('data-stance', data.stance || '');
    currentTimerStartedAt = typeof data.timerStartedAt === 'number' ? data.timerStartedAt : null;
    renderTimer();

    if (!callerVisible) {
      showElement(elements.callerDisplay);
      callerVisible = true;
    }
  }

  function hideCallerCard() {
    if (!callerVisible) return;
    hideElement(elements.callerDisplay).then(function () {
      callerVisible = false;
      elements.callerName.textContent = '';
      elements.callerPronouns.textContent = '';
      currentTimerStartedAt = null;
      renderStance(elements.callerStance, '');
      elements.callerCard.setAttribute('data-stance', '');
      renderTimer();
    });
  }

  // ============================================
  // Stance Chip + Call Timer Rendering
  // ============================================

  function renderStance(el, stance) {
    if (!el) return;
    var key = stance || '';
    var label = STANCE_LABELS[key] || '';
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
    var h = Math.floor(totalSeconds / 3600);
    var m = Math.floor((totalSeconds % 3600) / 60);
    var s = totalSeconds % 60;
    var mm = (m < 10 ? '0' : '') + m;
    var ss = (s < 10 ? '0' : '') + s;
    return h > 0 ? h + ':' + mm + ':' + ss : mm + ':' + ss;
  }

  function renderTimer() {
    var el = elements.callerTimer;
    if (!el) return;

    if (currentTimerStartedAt == null) {
      el.textContent = '';
      el.classList.remove('visible', 'warn', 'danger');
      return;
    }

    var elapsed = Math.max(0, Math.floor((Date.now() - currentTimerStartedAt) / 1000));
    var danger = elapsed >= TIMER_DANGER_SECONDS;
    var warn = !danger && elapsed >= TIMER_WARN_SECONDS;

    el.textContent = formatElapsed(elapsed);
    el.classList.add('visible');
    el.classList.toggle('warn', warn);
    el.classList.toggle('danger', danger);
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

  socket.on('showConfigUpdate', function (config) {
    showConfig = config;

    if (hasShowConfig()) {
      if (showInfoVisible) {
        populateShowInfo();
      } else {
        showShowInfo();
      }
    } else {
      hideShowInfo();
    }
  });

  // ============================================
  // Stage: Topics + Call-in Rendering
  // ============================================

  function renderTopics(data) {
    var items = data && data.items;
    var visible = data && data.visible;

    if (!visible || !(items && items.length)) {
      elements.stageTopics.classList.remove('visible');
      return;
    }

    elements.stageTopicsList.textContent = '';
    for (var i = 0; i < items.length; i++) {
      var row = document.createElement('div');
      row.className = 'stage-topic-row';
      row.textContent = (i + 1) + '. ' + items[i];
      elements.stageTopicsList.appendChild(row);
    }
    elements.stageTopics.classList.add('visible');
  }

  function renderCallIn(data) {
    var text = data && data.text;
    var visible = data && data.visible;

    if (!visible || !text) {
      elements.stageCallIn.classList.remove('visible');
      return;
    }

    elements.stageCallInText.textContent = text;
    elements.stageCallIn.classList.add('visible');
  }

  socket.on('topicsUpdate', renderTopics);
  socket.on('callInUpdate', renderCallIn);

  // ============================================
  // Initialization
  // ============================================

  // Tick the call timer once per second (reads currentTimerStartedAt)
  setInterval(renderTimer, 1000);

  console.log('Vertical display initialized - waiting for data...');
})();
