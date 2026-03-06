/**
 * Settings Modal
 * Shared settings modal for theme selection and configuration
 */

(function() {
  'use strict';

  let modalElement = null;
  let isInitialized = false;

  /**
   * Create the settings modal HTML
   */
  function createModalHTML() {
    return `
      <div class="modal-overlay settings-modal-overlay" id="settingsModal">
        <div class="modal settings-modal">
          <div class="modal-header">
            <h2>⚙️ Settings</h2>
            <button class="btn-close" id="closeSettingsBtn">&times;</button>
          </div>
          <div class="modal-body">
            <h3>Theme</h3>
            <div class="theme-list" id="themeList"></div>

            <div class="settings-info">
              <p>Theme changes apply to all control panels and displays.</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Loads the settings modal CSS stylesheet
   */
  function loadModalStyles() {
    if (document.getElementById('settings-modal-styles')) return;
    const link = document.createElement('link');
    link.id = 'settings-modal-styles';
    link.rel = 'stylesheet';
    link.href = 'css/settings-modal.css';
    document.head.appendChild(link);
  }

  /**
   * Render the theme list
   */
  function renderThemeList() {
    const themeList = document.getElementById('themeList');
    if (!themeList) return;

    const themes = ThemeLoader.getAvailableThemes();

    themeList.innerHTML = themes.map(theme => `
      <div class="theme-item ${theme.isCurrent ? 'active' : ''}" data-theme-id="${theme.id}">
        <div class="theme-item-radio"></div>
        <div class="theme-item-content">
          <div class="theme-item-name">
            ${theme.name}
            ${theme.isDefault ? '<span class="theme-default-badge">Default</span>' : ''}
          </div>
          <div class="theme-item-description">${theme.description}</div>
        </div>
        <div class="theme-item-actions">
          <button class="btn-set-default ${theme.isDefault ? 'is-default' : ''}"
                  data-theme-id="${theme.id}"
                  ${theme.isDefault ? 'disabled' : ''}>
            ${theme.isDefault ? '★ Default' : 'Set Default'}
          </button>
        </div>
      </div>
    `).join('');

    // Add click handlers for theme selection
    themeList.querySelectorAll('.theme-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Don't trigger if clicking on the default button
        if (e.target.closest('.btn-set-default')) return;

        const themeId = item.dataset.themeId;
        ThemeLoader.setTheme(themeId);
        renderThemeList();
      });
    });

    // Add click handlers for set default buttons
    themeList.querySelectorAll('.btn-set-default').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const themeId = btn.dataset.themeId;
        ThemeLoader.setDefaultTheme(themeId);
        renderThemeList();
      });
    });
  }

  /**
   * Open the settings modal
   */
  function open() {
    if (!isInitialized) init();

    renderThemeList();
    modalElement.classList.add('active');
  }

  /**
   * Close the settings modal
   */
  function close() {
    if (modalElement) {
      modalElement.classList.remove('active');
    }
  }

  /**
   * Initialize the settings modal
   */
  function init() {
    if (isInitialized) return;

    // Add styles
    loadModalStyles();

    // Add modal HTML
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = createModalHTML();
    document.body.appendChild(modalContainer.firstElementChild);

    modalElement = document.getElementById('settingsModal');

    // Close button
    document.getElementById('closeSettingsBtn').addEventListener('click', close);

    // Click outside to close
    modalElement.addEventListener('click', (e) => {
      if (e.target === modalElement) {
        close();
      }
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalElement.classList.contains('active')) {
        close();
      }
    });

    // Listen for theme changes to update the list
    window.addEventListener('themechange', () => {
      if (modalElement.classList.contains('active')) {
        renderThemeList();
      }
    });

    isInitialized = true;
  }

  // Export API
  window.SettingsModal = {
    init,
    open,
    close
  };
})();
