/**
 * Ticker Overlay Application
 * OBS overlay for the bottom-of-screen scrolling ticker band (social
 * handles, next-topic teaser, stream announcements). Split out as its own
 * browser source so it can be positioned, scaled, and toggled independently
 * of the topic list and the caller lower-third. Listens only to
 * 'tickerUpdate'; the server replays it on connect, so a source added
 * mid-show fills itself in.
 *
 * Loop mechanics: two identical copies of the item run sit side by side in
 * the track (see buildRun()), and a single CSS animation moves the track by
 * exactly -50% - since both copies are the same width, that lands precisely
 * on the seam between them, so the reset to 0% is invisible. A CSS
 * animation (not a rAF loop) drives the motion itself, since OBS composites
 * CSS transforms far more cheaply than a per-frame JS loop in a background
 * source; the only JS-driven work here is a one-time width measurement per
 * item-list change, used to derive the animation's duration.
 * @module js/display-ticker
 */

(function () {
  'use strict';

  // Constant crawl speed (px/sec) - keeps the pace steady whether 2 items
  // or 20 are loaded, rather than a fixed duration that would crawl
  // agonizingly slowly with little content or blur past with a lot.
  const PIXELS_PER_SECOND = 120;

  const elements = {
    bar: document.getElementById('tickerBar'),
    track: document.getElementById('tickerTrack'),
    runA: document.getElementById('tickerRunA'),
    runB: document.getElementById('tickerRunB'),
  };

  const connection = createSocketConnection();
  const socket = connection.socket;

  /**
   * Fill one run element with the items, each followed by a delimiter glyph
   * (including after the last item) so the seam between the two copies
   * reads as one continuous list rather than two runs butted together.
   * Operator text goes in via textContent, never innerHTML.
   * @param {HTMLElement} run
   * @param {string[]} items
   */
  function buildRun(run, items) {
    run.textContent = '';
    items.forEach(function (item) {
      const span = document.createElement('span');
      span.className = 'ticker-item';
      span.textContent = item;
      run.appendChild(span);

      const sep = document.createElement('span');
      sep.className = 'ticker-sep';
      sep.textContent = '◆'; // diamond
      sep.setAttribute('aria-hidden', 'true');
      run.appendChild(sep);
    });
  }

  /**
   * Recompute the crawl duration from the rendered run width at a fixed
   * px/sec speed, then (re)start the animation so a change in item count
   * takes effect immediately instead of finishing out whatever duration was
   * already in flight.
   */
  function resyncAnimation() {
    const width = elements.runA.getBoundingClientRect().width;
    const duration = width > 0 ? width / PIXELS_PER_SECOND : 0;

    elements.track.style.animation = 'none';
    // Force a reflow so the next animation assignment restarts at frame 0
    // instead of resuming whatever cycle position the browser cached.
    void elements.track.offsetHeight;
    elements.track.style.animation = duration > 0
      ? 'ticker-crawl ' + duration + 's linear infinite'
      : 'none';
  }

  /**
   * Render the ticker band. Hidden when !visible or the list is empty.
   * @param {{ items: string[], visible: boolean }} data
   */
  function renderTicker(data) {
    const items = (data && data.items) || [];
    const visible = !!(data && data.visible);

    if (!visible || !items.length) {
      elements.bar.classList.remove('visible');
      elements.track.style.animation = 'none';
      return;
    }

    buildRun(elements.runA, items);
    buildRun(elements.runB, items);
    elements.bar.classList.add('visible');

    // Wait a frame so the freshly-built DOM has a real layout to measure.
    requestAnimationFrame(resyncAnimation);
  }

  socket.on('tickerUpdate', renderTicker);

  // The bundled Futura face loads with font-display: swap, so the very
  // first render can measure the narrower fallback (Impact) width before
  // the webfont arrives and reflows the text wider - silently locking in a
  // too-short duration (too-fast crawl) for the rest of that page load.
  // Re-running the same measurement once the real font is ready corrects
  // for that swap; if items haven't loaded yet this is a harmless no-op
  // (resyncAnimation leaves the animation at 'none' when width is 0), and
  // if the font was already ready by the first measurement this just
  // reapplies the same duration.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(resyncAnimation);
  }

  console.log('Ticker overlay display initialized - waiting for data...');
})();
