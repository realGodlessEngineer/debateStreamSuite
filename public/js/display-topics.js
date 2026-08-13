/**
 * Stage Overlay Application
 * OBS overlay for the numbered topic list and the call-in link/number pill.
 * Split out of caller-display.js so the topic list is its own browser source
 * and can be positioned, scaled, and toggled independently of the caller
 * lower-third. Listens to 'topicsUpdate', 'callInUpdate' and 'showConfigUpdate';
 * the server replays all three on connect, so a source added mid-show fills
 * itself in. The show config is read for its host count alone - a one-host show
 * moves the stack to the right corner, which CSS cannot decide on its own.
 * @module js/display-topics
 */

(function () {
  'use strict';

  const elements = {
    stageTopics: document.getElementById('stageTopics'),
    stageTopicsList: document.getElementById('stageTopicsList'),
    stageCallIn: document.getElementById('stageCallIn'),
    stageCallInText: document.getElementById('stageCallInText'),
  };

  const connection = createSocketConnection();
  const socket = connection.socket;

  /**
   * Render the topic list. Hidden when !visible or the list is empty.
   * Each row is a flex pair - a fixed-width number cell ("1.") plus a text
   * cell - so the numbers form a flush column and every topic shares one
   * left edge. The number is plain stroked text (not an ::marker) so the
   * text-stroke applies. Operator text goes in via textContent, never innerHTML.
   * @param {{ items: string[], visible: boolean }} data
   */
  function renderTopics(data) {
    const items = (data && data.items) || [];
    const visible = !!(data && data.visible);

    if (!visible || !items.length) {
      elements.stageTopics.classList.remove('visible');
      return;
    }

    elements.stageTopicsList.textContent = '';
    items.forEach(function (item, i) {
      const row = document.createElement('div');
      row.className = 'stage-topic';

      const num = document.createElement('span');
      num.className = 'stage-topic-num';
      num.textContent = (i + 1) + '.';

      const text = document.createElement('span');
      text.className = 'stage-topic-text';
      text.textContent = item;

      row.appendChild(num);
      row.appendChild(text);
      elements.stageTopicsList.appendChild(row);
    });
    elements.stageTopics.classList.add('visible');
  }

  /**
   * Render the call-in pill. Hidden when !visible or text is empty.
   * @param {{ text: string, visible: boolean }} data
   */
  function renderCallIn(data) {
    const text = (data && data.text) || '';
    const visible = !!(data && data.visible);

    if (!visible || !text) {
      elements.stageCallIn.classList.remove('visible');
      return;
    }

    elements.stageCallInText.textContent = text;
    elements.stageCallIn.classList.add('visible');
  }

  /**
   * Flag a one-host show so the stack moves to the right corner.
   * Counts hosts the way caller-display.js does - an entry only counts once it
   * has a name, so a half-filled row in the dock doesn't shift the layout.
   * Exactly one moves it; zero means nothing is configured yet, where the
   * centered default is the safer guess.
   * @param {{ hosts: Array<{ name: string }> }} config
   */
  function applyHostCount(config) {
    const hosts = (config && config.hosts) || [];
    const named = hosts.filter(function (host) { return host && host.name; });
    document.body.classList.toggle('solo-host', named.length === 1);
  }

  socket.on('topicsUpdate', renderTopics);
  socket.on('callInUpdate', renderCallIn);
  socket.on('showConfigUpdate', applyHostCount);

  console.log('Stage overlay display initialized - waiting for data...');
})();
