/**
 * Socket Connection Utility
 * Manages Socket.io connection and status display
 * @module js/socket-connection
 */

/**
 * Creates a managed socket connection with status indicator
 * @param {Object} options - Configuration options
 * @param {string} [options.statusElementId] - ID of status indicator element
 * @returns {Object} Socket instance and utilities
 */
function createSocketConnection(options = {}) {
  const { statusElementId = 'connectionStatus', statusDotId = 'statusDot' } = options;

  // Initialize socket
  const socket = io();

  // Status elements (may not exist on all pages)
  const statusElement = document.getElementById(statusElementId);
  const statusDot = document.getElementById(statusDotId);

  /**
   * Updates the connection status display
   * @param {boolean} connected - Connection state
   */
  const updateStatusDisplay = (connected) => {
    // Support old-style connection-status element
    if (statusElement) {
      statusElement.textContent = connected ? 'Connected' : 'Disconnected';
      statusElement.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
    }
    // Support new status-dot element
    if (statusDot) {
      statusDot.className = `status-dot ${connected ? 'connected' : 'disconnected'}`;
    }
  };
  
  // Connection event handlers
  socket.on('connect', () => {
    console.log('Socket connected');
    updateStatusDisplay(true);
  });
  
  socket.on('disconnect', () => {
    console.log('Socket disconnected');
    updateStatusDisplay(false);
  });
  
  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
    updateStatusDisplay(false);
  });
  
  return {
    socket,
    
    /**
     * Checks if socket is connected
     * @returns {boolean} Connection state
     */
    isConnected() {
      return socket.connected;
    },
    
    /**
     * Emits an event with optional callback
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    emit(event, data) {
      socket.emit(event, data);
    },
    
    /**
     * Registers an event handler
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     */
    on(event, handler) {
      socket.on(event, handler);
    },
    
    /**
     * Removes an event handler
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     */
    off(event, handler) {
      socket.off(event, handler);
    },
  };
}

// Export for module usage or attach to window for script tag usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = createSocketConnection;
} else {
  window.createSocketConnection = createSocketConnection;
}