/**
 * Show Config Modal
 * Manages the show configuration modal (title + hosts) for the dock
 * @module js/show-config-modal
 */

(function () {
  'use strict';

  let isInitialized = false;
  let socket = null;

  // ============================================
  // DOM Element References (populated on init)
  // ============================================

  const refs = {};

  // ============================================
  // Modal Controls
  // ============================================

  function openModal() {
    refs.modal.classList.add('active');
  }

  function closeModal() {
    refs.modal.classList.remove('active');
  }

  // ============================================
  // Show Config Bar
  // ============================================

  function updateShowConfigBar(config) {
    if (!config || (!config.showTitle && (!config.hosts || config.hosts.length === 0))) {
      refs.barText.textContent = 'No show configured';
      refs.bar.classList.remove('configured');
      return;
    }
    const parts = [];
    if (config.showTitle) parts.push(config.showTitle);
    if (config.hosts && config.hosts.length > 0) {
      const hostNames = config.hosts.filter(h => h.name).map(h => h.name);
      if (hostNames.length > 0) parts.push(hostNames.join(' & '));
    }
    refs.barText.textContent = parts.join(' \u2014 ');
    refs.bar.classList.add('configured');
  }

  // ============================================
  // Form Population
  // ============================================

  function populateForm(config) {
    refs.showTitleInput.value = config.showTitle || '';
    refs.host1Name.value = (config.hosts && config.hosts[0]) ? config.hosts[0].name : '';
    refs.host1Pronouns.value = (config.hosts && config.hosts[0]) ? config.hosts[0].pronouns : '';
    refs.host2Name.value = (config.hosts && config.hosts[1]) ? config.hosts[1].name : '';
    refs.host2Pronouns.value = (config.hosts && config.hosts[1]) ? config.hosts[1].pronouns : '';
  }

  // ============================================
  // Save / Clear
  // ============================================

  function saveConfig() {
    const hosts = [];
    if (refs.host1Name.value.trim()) {
      hosts.push({ name: refs.host1Name.value.trim(), pronouns: refs.host1Pronouns.value.trim() });
    }
    if (refs.host2Name.value.trim()) {
      hosts.push({ name: refs.host2Name.value.trim(), pronouns: refs.host2Pronouns.value.trim() });
    }
    const config = {
      showTitle: refs.showTitleInput.value.trim(),
      hosts: hosts,
    };
    socket.emit('updateShowConfig', config);
    closeModal();
  }

  function clearConfig() {
    const config = { showTitle: '', hosts: [] };
    socket.emit('updateShowConfig', config);
    refs.showTitleInput.value = '';
    refs.host1Name.value = '';
    refs.host1Pronouns.value = '';
    refs.host2Name.value = '';
    refs.host2Pronouns.value = '';
    closeModal();
  }

  // ============================================
  // Initialization
  // ============================================

  function init(socketInstance) {
    if (isInitialized) return;

    socket = socketInstance;

    // Cache DOM references
    refs.modal = document.getElementById('showConfigModal');
    refs.bar = document.getElementById('showConfigBar');
    refs.barText = document.getElementById('showConfigBarText');
    refs.barEdit = document.getElementById('showConfigBarEdit');
    refs.openBtn = document.getElementById('showConfigBtn');
    refs.closeBtn = document.getElementById('closeShowConfigBtn');
    refs.saveBtn = document.getElementById('saveShowConfigBtn');
    refs.clearBtn = document.getElementById('clearShowConfigBtn');
    refs.showTitleInput = document.getElementById('showTitleInput');
    refs.host1Name = document.getElementById('host1Name');
    refs.host1Pronouns = document.getElementById('host1Pronouns');
    refs.host2Name = document.getElementById('host2Name');
    refs.host2Pronouns = document.getElementById('host2Pronouns');

    // Event listeners
    refs.openBtn.addEventListener('click', openModal);
    refs.barEdit.addEventListener('click', openModal);
    refs.closeBtn.addEventListener('click', closeModal);
    refs.saveBtn.addEventListener('click', saveConfig);
    refs.clearBtn.addEventListener('click', clearConfig);

    refs.modal.addEventListener('click', (e) => {
      if (e.target === refs.modal) closeModal();
    });

    // Socket event - update bar and form on config changes
    socket.on('showConfigUpdate', (config) => {
      updateShowConfigBar(config);
      populateForm(config);
    });

    isInitialized = true;
  }

  // ============================================
  // Public API
  // ============================================

  window.ShowConfigModal = {
    init,
    open: openModal,
    close: closeModal,
  };
})();
