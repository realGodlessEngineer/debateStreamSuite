/**
 * Consolidated Background Stage Application
 * OBS overlay for everything that belongs BEHIND the host cams: the numbered
 * topic list and the call-in link/phone pill.
 *
 * Same socket contract as display-topics.js, which remains the standalone
 * one-source-per-overlay version - this page exists so an operator who doesn't
 * need to position them separately can add a single source instead. Listens to
 * 'topicsUpdate', 'callInUpdate' and 'showConfigUpdate'; the server replays all
 * three on connect, so a source added mid-show fills itself in.
 *
 * Layout (landscape vs portrait) is settled entirely in CSS by an aspect-ratio
 * media query - there is deliberately no orientation logic here. The one thing
 * JS owns is the `solo-host` body class, because CSS cannot see the host count.
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

  /**
   * Flag a one-host show so landscape can move the stack to the right corner.
   * Counts hosts the way stage-foreground.js does - an entry only counts once
   * it has a name, so a half-filled row in the dock doesn't shift the layout.
   * Exactly one moves it; zero means nothing is configured yet, where the
   * centred default is the safer guess. Portrait ignores the class.
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

  console.log('Consolidated background stage initialized - waiting for data...');
})();
