/**
 * Theme Loader
 * Manages theme loading and switching for DebateStreamSuite
 */

(function() {
  'use strict';

  const THEME_STORAGE_KEY = 'obs-display-theme';
  const DEFAULT_THEME_KEY = 'obs-display-default-theme';
  const FALLBACK_THEME = 'godless-engineer';

  // Available themes - add new themes here
  const THEMES = {
    'godless-engineer': {
      name: 'Godless Engineer',
      description: 'Sleek red/black dark theme',
      file: 'css/themes/godless-engineer.css'
    },
    'the-bible-guy': {
      name: 'The Bible Guy',
      description: 'Warm orange/gold theme with sky blue accents',
      file: 'css/themes/the-bible-guy.css'
    }
  };

  /**
   * Get the default theme ID
   * @returns {string} Default theme ID
   */
  function getDefaultTheme() {
    const stored = localStorage.getItem(DEFAULT_THEME_KEY);
    if (stored && THEMES[stored]) {
      return stored;
    }
    return FALLBACK_THEME;
  }

  /**
   * Set the default theme
   * @param {string} themeId - Theme identifier
   */
  function setDefaultTheme(themeId) {
    if (!THEMES[themeId]) {
      console.warn(`Theme "${themeId}" not found.`);
      return false;
    }
    localStorage.setItem(DEFAULT_THEME_KEY, themeId);
    return true;
  }

  /**
   * Get the currently selected theme ID
   * @returns {string} Theme ID
   */
  function getCurrentTheme() {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && THEMES[stored]) {
      return stored;
    }
    return getDefaultTheme();
  }

  /**
   * Set the current theme
   * @param {string} themeId - Theme identifier
   */
  function setTheme(themeId) {
    if (!THEMES[themeId]) {
      console.warn(`Theme "${themeId}" not found. Using default.`);
      themeId = FALLBACK_THEME;
    }

    localStorage.setItem(THEME_STORAGE_KEY, themeId);
    applyTheme(themeId);
  }

  /**
   * Apply a theme by loading its CSS
   * @param {string} themeId - Theme identifier
   */
  function applyTheme(themeId) {
    const theme = THEMES[themeId];
    if (!theme) return;

    // Find existing theme stylesheet (either our dynamic one or the hardcoded one in HTML)
    let existingTheme = document.getElementById('theme-stylesheet');

    // Also check for any hardcoded theme link in the HTML
    if (!existingTheme) {
      existingTheme = document.querySelector('link[rel="stylesheet"][href*="css/themes/"]');
    }

    if (existingTheme) {
      // Just update the href of the existing link element
      existingTheme.id = 'theme-stylesheet';
      existingTheme.href = theme.file;
    } else {
      // No existing theme link, create a new one
      const link = document.createElement('link');
      link.id = 'theme-stylesheet';
      link.rel = 'stylesheet';
      link.href = theme.file;

      // Insert theme at the beginning of head
      const firstChild = document.head.firstChild;
      if (firstChild) {
        document.head.insertBefore(link, firstChild);
      } else {
        document.head.appendChild(link);
      }
    }

    // Update body attribute for CSS hooks
    if (document.body) {
      document.body.setAttribute('data-theme', themeId);
    }

    // Dispatch event for any listeners
    window.dispatchEvent(new CustomEvent('themechange', { detail: { themeId, theme } }));
  }

  /**
   * Get list of available themes
   * @returns {Array} Array of theme objects with id, name, description
   */
  function getAvailableThemes() {
    const currentTheme = getCurrentTheme();
    const defaultTheme = getDefaultTheme();
    return Object.entries(THEMES).map(([id, theme]) => ({
      id,
      name: theme.name,
      description: theme.description,
      isCurrent: id === currentTheme,
      isDefault: id === defaultTheme
    }));
  }

  /**
   * Initialize theme on page load
   */
  function init() {
    const currentTheme = getCurrentTheme();
    applyTheme(currentTheme);
  }

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export API
  window.ThemeLoader = {
    getCurrentTheme,
    setTheme,
    getDefaultTheme,
    setDefaultTheme,
    getAvailableThemes,
    THEMES
  };
})();
