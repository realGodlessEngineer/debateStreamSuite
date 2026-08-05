/**
 * Ticker Control
 * Manages the bottom-of-screen scrolling ticker band (social handles, next
 * topic, stream announcements) for the dock. Mirrors the Stage
 * topics/call-in interaction pattern in caller-control.js: a textarea of
 * one item per line, an Update button that replaces the whole list, and a
 * Show/Hide toggle that re-sends the current list with flipped visibility.
 *
 * Self-initializes on DOMContentLoaded and reuses the socket exposed by
 * caller-control.js at window.CallerControl.socket rather than opening its
 * own connection - caller-control.js's <script> tag loads before this
 * file's, so window.CallerControl already exists by the time this module's
 * own script executes (dock.html cannot be edited to add an explicit init
 * call here, so this file finds the socket itself instead of exposing a
 * public init() the way show-config-modal.js does).
 * @module js/ticker-control
 */

(function () {
  'use strict';

  let socket = null;
  let visible = false;

  const refs = {};

  /**
   * Split the ticker textarea into a trimmed, non-empty list of items
   * @returns {string[]}
   */
  function readItems() {
    return refs.input.value
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /** Emit the current ticker items + visibility to the server */
  function emitTicker() {
    socket.emit('updateTicker', { items: readItems(), visible: visible });
  }

  /**
   * Adopt the authoritative ticker state from the server
   * @param {Object} data - { items: string[], visible: boolean }
   */
  function onTickerUpdate(data) {
    const items = (data && data.items) || [];
    visible = !!(data && data.visible);

    refs.toggleBtn.textContent = visible ? 'Hide' : 'Show';
    refs.toggleBtn.classList.toggle('active', visible);

    // Don't clobber the operator mid-type
    if (document.activeElement !== refs.input) {
      refs.input.value = items.join('\n');
    }
  }

  function init() {
    socket = window.CallerControl && window.CallerControl.socket;
    if (!socket) return;

    refs.input = document.getElementById('tickerInput');
    refs.updateBtn = document.getElementById('updateTickerBtn');
    refs.clearBtn = document.getElementById('clearTickerBtn');
    refs.toggleBtn = document.getElementById('toggleTickerBtn');

    if (!refs.input || !refs.updateBtn || !refs.clearBtn || !refs.toggleBtn) return;

    refs.updateBtn.addEventListener('click', emitTicker);
    refs.clearBtn.addEventListener('click', () => {
      refs.input.value = '';
      socket.emit('updateTicker', { items: [], visible: visible });
    });
    refs.toggleBtn.addEventListener('click', () => {
      visible = !visible;
      emitTicker();
    });

    socket.on('tickerUpdate', onTickerUpdate);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
