/**
 * Claim / Resolution Banner Dock Control
 * Manages the dock's Claim section: a proposition field, an optional
 * attribution/qualifier field, and Update/Show-Hide buttons — the same
 * shape as the Stage (topics/call-in) controls. A standalone module so it
 * owns its own DOM refs and socket listeners without editing caller-control.js.
 * Self-initializes using the socket CallerControl exports, so this script
 * tag must load after js/caller-control.js.
 * @module js/claim-control
 */

(function () {
  'use strict';

  let isInitialized = false;
  let socket = null;
  let claimVisible = false;

  const refs = {};

  /** Emit the current text/subtext + visibility to the server */
  function emitClaim() {
    socket.emit('updateClaim', {
      text: refs.textInput.value.trim(),
      subtext: refs.subtextInput.value.trim(),
      visible: claimVisible,
    });
  }

  /**
   * Adopt the authoritative claim state from the server
   * @param {{ text: string, subtext: string, visible: boolean }} data
   */
  function onClaimUpdate(data) {
    const text = (data && data.text) || '';
    const subtext = (data && data.subtext) || '';
    claimVisible = !!(data && data.visible);

    if (refs.toggleBtn) {
      refs.toggleBtn.textContent = claimVisible ? 'Hide' : 'Show';
      refs.toggleBtn.classList.toggle('active', claimVisible);
    }
    // Don't clobber the operator mid-type
    if (refs.textInput && document.activeElement !== refs.textInput) {
      refs.textInput.value = text;
    }
    if (refs.subtextInput && document.activeElement !== refs.subtextInput) {
      refs.subtextInput.value = subtext;
    }
  }

  /**
   * Initialize the claim dock section with the shared socket
   * @param {SocketIOClient.Socket} socketInstance - Shared socket (CallerControl.socket)
   */
  function init(socketInstance) {
    if (isInitialized || !socketInstance) return;

    socket = socketInstance;

    refs.textInput = document.getElementById('claimTextInput');
    refs.subtextInput = document.getElementById('claimSubtextInput');
    refs.updateBtn = document.getElementById('updateClaimBtn');
    refs.toggleBtn = document.getElementById('toggleClaimBtn');

    // Section may not be present on every page that loads this script
    if (!refs.textInput || !refs.subtextInput || !refs.updateBtn) return;

    refs.updateBtn.addEventListener('click', emitClaim);
    if (refs.toggleBtn) {
      refs.toggleBtn.addEventListener('click', () => {
        claimVisible = !claimVisible;
        emitClaim();
      });
    }

    socket.on('claimUpdate', onClaimUpdate);

    isInitialized = true;
  }

  window.ClaimControl = { init };

  // Auto-initialize using the socket CallerControl exports once it's loaded.
  if (window.CallerControl && window.CallerControl.socket) {
    init(window.CallerControl.socket);
  }
})();
