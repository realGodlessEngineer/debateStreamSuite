/**
 * HTML Sanitization Utility
 * Prevents XSS by escaping HTML special characters
 * @module js/sanitize
 */

(function () {
  'use strict';

  const ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  const ESCAPE_REGEX = /[&<>"']/g;

  /**
   * Escapes HTML special characters in a string
   * @param {string} str - Untrusted string
   * @returns {string} Escaped string safe for innerHTML
   */
  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(ESCAPE_REGEX, (char) => ESCAPE_MAP[char]);
  }

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = escapeHtml;
  } else {
    window.escapeHtml = escapeHtml;
  }
})();
