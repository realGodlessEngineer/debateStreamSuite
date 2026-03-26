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
    callerName: document.getElementById('callerNameDisplay'),
    callerPronouns: document.getElementById('callerPronounsDisplay'),
  };

  // ============================================
  // State
  // ============================================

  let showConfig = { showTitle: '', hosts: [] };
  let showInfoVisible = false;
  let callerVisible = false;

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
    var pronouns = data.pronouns ? '(' + data.pronouns + ')' : '';

    elements.callerName.textContent = name;
    elements.callerPronouns.textContent = pronouns;

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
    });
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
  // Initialization
  // ============================================

  console.log('Vertical display initialized - waiting for data...');
})();
