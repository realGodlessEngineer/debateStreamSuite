/**
 * Claim / Resolution Banner Overlay Application
 * OBS overlay for the persistent proposition banner ("RESOLVED: ..."). Its
 * own standalone browser source - independent of the verse/fallacy display
 * mutex - so it can sit on screen while verses and fallacies come and go
 * beneath it. Listens only to 'claimUpdate'; the server replays it on
 * connect, so a source added mid-show fills itself in.
 * @module js/display-claim
 */

(function () {
  'use strict';

  const elements = {
    claimBanner: document.getElementById('claimBanner'),
    claimText: document.getElementById('claimText'),
    claimSubtext: document.getElementById('claimSubtext'),
  };

  const connection = createSocketConnection();
  const socket = connection.socket;

  /**
   * Render the claim banner. Hidden when !visible or the proposition text
   * is empty. The subtext line only shows when it has content, even while
   * the banner itself is visible. Operator text goes in via textContent.
   * @param {{ text: string, subtext: string, visible: boolean }} data
   */
  function renderClaim(data) {
    const text = (data && data.text) || '';
    const subtext = (data && data.subtext) || '';
    const visible = !!(data && data.visible);

    if (!visible || !text) {
      elements.claimBanner.classList.remove('visible');
      return;
    }

    elements.claimText.textContent = text;
    elements.claimSubtext.textContent = subtext;
    elements.claimSubtext.classList.toggle('has-subtext', !!subtext);
    elements.claimBanner.classList.add('visible');
  }

  socket.on('claimUpdate', renderClaim);

  console.log('Claim banner overlay initialized - waiting for data...');
})();
