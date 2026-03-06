/**
 * Status Message Utility
 * Displays temporary status messages with auto-dismiss
 * @module js/status-message
 */

/**
 * Creates a status message manager
 * @param {string} elementId - ID of status element
 * @param {Object} options - Configuration options
 * @returns {Object} Status message API
 */
function createStatusManager(elementId, options = {}) {
  const {
    successDuration = 3000,
    errorDuration = 0,
    loadingDuration = 0,
  } = options;
  
  const element = document.getElementById(elementId);
  let dismissTimer = null;
  
  if (!element) {
    console.warn(`Status element not found: ${elementId}`);
    return {
      show: () => {},
      success: () => {},
      error: () => {},
      loading: () => {},
      clear: () => {},
    };
  }
  
  /**
   * Clears any pending dismiss timer
   */
  const clearTimer = () => {
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
  };
  
  /**
   * Shows a status message
   * @param {string} message - Message text
   * @param {string} type - Message type (success, error, loading)
   * @param {number} duration - Auto-dismiss duration (0 = no auto-dismiss)
   */
  const show = (message, type, duration) => {
    clearTimer();
    
    element.textContent = message;
    element.className = `status ${type}`;
    
    if (duration > 0) {
      dismissTimer = setTimeout(() => {
        element.className = 'status';
      }, duration);
    }
  };
  
  return {
    /**
     * Shows a custom status message
     * @param {string} message - Message text
     * @param {string} type - Message type
     * @param {number} [duration] - Auto-dismiss duration
     */
    show(message, type, duration = 0) {
      show(message, type, duration);
    },
    
    /**
     * Shows a success message
     * @param {string} message - Message text
     */
    success(message) {
      show(message, 'success', successDuration);
    },
    
    /**
     * Shows an error message
     * @param {string} message - Message text
     */
    error(message) {
      show(message, 'error', errorDuration);
    },
    
    /**
     * Shows a loading message
     * @param {string} message - Message text
     */
    loading(message) {
      show(message, 'loading', loadingDuration);
    },
    
    /**
     * Clears the status message
     */
    clear() {
      clearTimer();
      element.className = 'status';
    },
  };
}

// Export for module usage or attach to window for script tag usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = createStatusManager;
} else {
  window.createStatusManager = createStatusManager;
}