/**
 * Dock On-Air Strip
 * Renders one line naming every overlay currently on screen, so "what am I
 * putting on air?" stays answerable without leaving the current tab. Clicking
 * an item switches to the tab that owns it and focuses the control that takes
 * it off air.
 *
 * Attaches its own handlers to the socket caller-control.js exports
 * (window.CallerControl.socket) — Socket.IO allows many handlers per event, so
 * this module needs no edits to the five existing control modules. It also
 * keeps each Show/Hide toggle's aria-label in step with the state those modules
 * put in the toggle's label, which they do not do themselves.
 *
 * Runs immediately (the strip and the toggles are above this script tag) so no
 * broadcast can arrive before the handlers are attached.
 * @module js/dock-onair
 */

(function () {
  'use strict';

  // One entry per overlay that can be on screen, in reading order.
  // `event`      - the broadcast carrying its visibility
  // `tab`        - the tab holding its controls
  // `control`    - id of the button focus lands on when the strip item is
  //                clicked
  // `offControl` - selector for where focus goes instead while the overlay is
  //                not on air, for the one entry whose `control` is destructive
  // `noun`       - completes "Show …" / "Hide …" for that button's aria-label
  const OVERLAYS = [
    { key: 'topics', label: 'Topics', event: 'topicsUpdate', tab: 'overlays', control: 'toggleTopicsBtn', noun: 'topics overlay' },
    { key: 'callin', label: 'Call-in', event: 'callInUpdate', tab: 'overlays', control: 'toggleCallInBtn', noun: 'call-in overlay' },
    { key: 'claim', label: 'Claim', event: 'claimUpdate', tab: 'overlays', control: 'toggleClaimBtn', noun: 'claim banner' },
    { key: 'ticker', label: 'Ticker', event: 'tickerUpdate', tab: 'overlays', control: 'toggleTickerBtn', noun: 'ticker' },
    { key: 'score', label: 'Score', event: 'scoreboardUpdate', tab: 'score', control: 'toggleScoreboardBtn', noun: 'scoreboard overlay' },
    // The scene card has no Show/Hide pair — a scene is live whenever a key is
    // selected — so Clear Scene is what takes it off air, and there is no
    // toggle label to keep in step. It is also the one destructive control in
    // this table, hence offControl.
    { key: 'scene', label: 'Scene', event: 'sceneUpdate', tab: 'scene', control: 'sceneClearBtn', offControl: '.scene-btn', noun: null },
  ];

  const strip = document.getElementById('onAirStrip');
  const socket = window.CallerControl && window.CallerControl.socket;

  // data-onair key -> { button, state, live } for in-place updates.
  // `live` is null until a broadcast says otherwise — see build().
  const items = {};

  // ============================================
  // Rendering
  // ============================================

  /**
   * Build the six items once. They are updated in place from then on: they are
   * buttons, so rebuilding them would drop focus mid-click, and the strip is an
   * aria-live region, so rebuilding would re-announce every item every time.
   */
  function build() {
    const title = document.createElement('span');
    title.className = 'onair-title';
    title.textContent = 'On air';
    strip.appendChild(title);

    OVERLAYS.forEach((overlay) => {
      const button = document.createElement('button');
      button.type = 'button';
      // `pending`, not `off air`. handlers.js does broadcast all six on
      // connect, so the window is short — but if the socket never connects,
      // which is the failure the connection pill exists for, seeding "off air"
      // has the strip confidently reporting an empty screen while overlays are
      // live on it. Only a broadcast is allowed to claim on or off.
      button.className = 'onair-item pending';
      button.setAttribute('data-onair', overlay.key);
      // The live region announces only the node that changed, and the node that
      // changes here is the state span — "— on air", with no subject. Atomic on
      // the button is what makes that announce "Topics — on air".
      button.setAttribute('aria-atomic', 'true');

      const dot = document.createElement('span');
      dot.className = 'onair-dot';
      dot.setAttribute('aria-hidden', 'true');

      // The state rides as text inside the button rather than as an aria-label,
      // so the accessible name still starts with the visible word (WCAG 2.5.3)
      // and a change to it is a text change the live region will announce. It
      // carries the unknown state too — the dashed dot is a shape, and a shape
      // on its own is exactly the kind of cue this sweep exists to replace.
      const state = document.createElement('span');
      state.className = 'sr-only';
      state.textContent = ' — state unknown';

      button.appendChild(dot);
      button.appendChild(document.createTextNode(overlay.label));
      button.appendChild(state);
      button.addEventListener('click', () => reveal(overlay));

      items[overlay.key] = { button, state, live: null };
      strip.appendChild(button);
    });
  }

  /**
   * Switch to the tab that owns an overlay and focus the control that acts on
   * it. Where that control is destructive — Clear Scene, which kills a live
   * holding card — focus goes to the first control that turns the overlay ON
   * instead while it is not on air, so a reflexive Space after clicking the
   * strip cannot clear a scene that was never up. An overlay whose state is
   * still unknown counts as not on air.
   * @param {Object} overlay - entry from OVERLAYS
   */
  function reveal(overlay) {
    if (window.DockTabs) window.DockTabs.select(overlay.tab);

    const item = items[overlay.key];
    const control = (overlay.offControl && !(item && item.live))
      ? document.querySelector(overlay.offControl)
      : document.getElementById(overlay.control);

    if (control) control.focus();
  }

  /**
   * @param {Object} overlay - entry from OVERLAYS
   * @param {boolean} live - is this overlay on screen right now
   */
  function setLive(overlay, live) {
    const item = items[overlay.key];
    if (!item) return;

    item.live = live;
    item.button.classList.remove('pending');
    item.button.classList.toggle('live', live);
    item.state.textContent = live ? ' — on air' : ' — off air';
  }

  /**
   * Keep a Show/Hide toggle's accessible name naming what it toggles. The
   * control modules flip only the visible label, so this is the one place the
   * two stay in step — and "Hide topics overlay" still contains the visible
   * word "Hide".
   * @param {Object} overlay - entry from OVERLAYS
   * @param {boolean} live - is this overlay on screen right now
   */
  function labelToggle(overlay, live) {
    if (!overlay.noun) return;

    const button = document.getElementById(overlay.control);
    if (!button) return;

    button.setAttribute('aria-label', (live ? 'Hide ' : 'Show ') + overlay.noun);
  }

  // ============================================
  // Initialization
  // ============================================

  if (!strip || !socket) return;

  build();

  OVERLAYS.forEach((overlay) => {
    socket.on(overlay.event, (data) => {
      // A scene is live only when a card is actually selected; the other five
      // carry their own visible flag.
      const live = overlay.key === 'scene'
        ? !!(data && data.visible && data.key)
        : !!(data && data.visible);

      setLive(overlay, live);
      labelToggle(overlay, live);
    });
  });
})();
