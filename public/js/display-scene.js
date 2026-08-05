/**
 * Scene Card Overlay
 * OBS overlay for the full-screen holding cards shown between segments
 * ("Starting Soon" / "BRB" / "Ending"). Listens only to 'sceneUpdate'; the
 * server replays it on connect, so a source added mid-show fills itself in.
 * @module js/display-scene
 */

(function () {
  'use strict';

  const SCENE_LABELS = {
    'starting-soon': 'Starting Soon',
    'brb': 'Be Right Back',
    'ending': 'Ending',
  };

  const elements = {
    sceneCard: document.getElementById('sceneCard'),
    sceneHeadline: document.getElementById('sceneHeadline'),
    sceneMessage: document.getElementById('sceneMessage'),
  };

  const connection = createSocketConnection();
  const socket = connection.socket;

  /**
   * Render the scene card. Hidden when !visible or no recognized key.
   * Operator text goes in via textContent, never innerHTML.
   * @param {{ key: string, message: string, visible: boolean }} data
   */
  function renderScene(data) {
    const key = (data && data.key) || '';
    const message = (data && data.message) || '';
    const visible = !!(data && data.visible);
    const label = SCENE_LABELS[key];

    if (!visible || !label) {
      elements.sceneCard.classList.remove('visible');
      return;
    }

    elements.sceneHeadline.textContent = label;
    elements.sceneMessage.textContent = message;
    elements.sceneMessage.classList.toggle('visible', !!message);
    elements.sceneCard.classList.add('visible');
  }

  socket.on('sceneUpdate', renderScene);

  console.log('Scene card display initialized - waiting for data...');
})();
