/**
 * Consolidated Background Stage Application
 * OBS overlay for everything that belongs BEHIND the host cams: the numbered
 * topic list and the call-in link/phone pill.
 *
 * Same socket contract as display-topics.js, which remains the standalone
 * one-source-per-overlay version - this page exists so an operator who doesn't
 * need to position them separately can add a single source instead. Listens
 * only to 'topicsUpdate' and 'callInUpdate'; the server replays both on
 * connect, so a source added mid-show fills itself in.
 *
 * Layout (landscape vs portrait) is settled entirely in CSS by an aspect-ratio
 * media query - there is deliberately no orientation logic here.
 * @module js/stage-background
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

  socket.on('topicsUpdate', renderTopics);
  socket.on('callInUpdate', renderCallIn);

  console.log('Consolidated background stage initialized - waiting for data...');
})();
