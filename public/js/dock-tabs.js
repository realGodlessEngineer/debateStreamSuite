/**
 * Dock Tab Bar
 * Drives the dock's four sections (Callers / Overlays / Scene / Score) to the
 * WAI-ARIA APG Tabs pattern — roving tabindex, arrow/Home/End keys, automatic
 * activation — and remembers the operator's tab and open disclosures across
 * reloads (an OBS dock reloads whenever OBS restarts).
 *
 * Every panel stays in the DOM and is hidden with the `hidden` attribute, never
 * removed or lazily rendered: the control modules build their element maps
 * eagerly at load, so a node that is absent at load is a node nothing is wired
 * to for the rest of the session.
 *
 * No socket. Runs immediately rather than on DOMContentLoaded so the stored tab
 * is applied before the panels first paint.
 * @module js/dock-tabs
 */

(function () {
  'use strict';

  // Same shape as theme-loader.js: an obs- prefixed key holding a plain value,
  // validated against the known set on read with a fallback.
  const TAB_KEY = 'obs-dock-active-tab';
  const DISC_KEY = 'obs-dock-disclosures';

  // Ordered by how often the operator touches each during a live segment, so
  // the most-used section is both leftmost and Alt+1. A tab stored by an older
  // build is still one of these four, so it is still honoured on reload.
  const TABS = ['callers', 'overlays', 'scene', 'score'];
  const DEFAULT_TAB = 'callers';

  const tabButtons = Array.prototype.slice.call(
    document.querySelectorAll('.tab-bar [role="tab"]')
  );
  const disclosures = Array.prototype.slice.call(
    document.querySelectorAll('details[data-disclosure]')
  );

  // ============================================
  // Persistence
  // ============================================

  function readTab() {
    const stored = localStorage.getItem(TAB_KEY);
    return TABS.indexOf(stored) !== -1 ? stored : DEFAULT_TAB;
  }

  /**
   * Read the list of open disclosures. Two keys rather than one blob so a
   * corrupt value here cannot take the tab selection down with it.
   * @returns {string[]} data-disclosure values that were open
   */
  function readDisclosures() {
    try {
      const value = JSON.parse(localStorage.getItem(DISC_KEY));
      return Array.isArray(value) ? value : [];
    } catch (err) {
      return [];
    }
  }

  function saveDisclosures() {
    const open = disclosures
      .filter((el) => el.open)
      .map((el) => el.getAttribute('data-disclosure'));
    localStorage.setItem(DISC_KEY, JSON.stringify(open));
  }

  // ============================================
  // Tab Selection
  // ============================================

  /**
   * Show one tab and its panel, hide the rest
   * @param {string} name - data-tab value
   * @param {boolean} moveFocus - move focus to the tab button (keyboard paths)
   */
  function selectTab(name, moveFocus) {
    if (TABS.indexOf(name) === -1) return;

    tabButtons.forEach((btn) => {
      const selected = btn.getAttribute('data-tab') === name;

      btn.setAttribute('aria-selected', selected ? 'true' : 'false');
      btn.tabIndex = selected ? 0 : -1;
      btn.classList.toggle('active', selected);

      const panel = document.getElementById(btn.getAttribute('aria-controls'));
      if (panel) {
        panel.classList.toggle('active', selected);
        panel.hidden = !selected;
      }

      if (selected && moveFocus) btn.focus();
    });

    localStorage.setItem(TAB_KEY, name);
  }

  // ============================================
  // Keyboard
  // ============================================

  /**
   * Arrow keys move between tabs (wrapping), Home/End jump to the ends.
   * Activation is automatic — every panel's content is already in the DOM, so
   * selecting on focus costs nothing and saves the operator a keystroke.
   * @param {KeyboardEvent} event
   */
  function handleTabKeydown(event) {
    const index = tabButtons.indexOf(event.currentTarget);
    const last = tabButtons.length - 1;
    let next;

    if (event.key === 'ArrowRight') next = index === last ? 0 : index + 1;
    else if (event.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    else return;

    event.preventDefault();
    selectTab(tabButtons[next].getAttribute('data-tab'), true);
  }

  /**
   * Alt+1/2/3/4 from anywhere in the dock. Alt rather than a bare digit: bare
   * digits would type into the segment duration field and every text input,
   * and WCAG 2.1.4 requires bare single-character shortcuts to be remappable
   * or focus-scoped. Alt+digit collides with nothing inside an OBS dock.
   *
   * Matched on event.code, not event.key. code is the physical key, so this
   * fires for the top digit row only and never for the numpad — and Alt+numpad
   * is the Windows Alt-code input method, whose digit presses do arrive as
   * keydowns with altKey set and event.key '1'. It is layout-proof for free:
   * the top row reports Digit1..Digit4 whatever the keyboard prints on it.
   *
   * Requiring Alt keeps the digit out of a text field, but it does not stop
   * .focus() from yanking the caret out of one, so the focus move is dropped
   * when the shortcut fires from inside a field AND lands on the tab already
   * showing. When it switches tab, that field is about to be hidden - a hidden
   * element is not rendered and so is not a focusable area, and what the
   * browser then does with the orphaned focus is its own business. The new tab
   * button is the only landing place this code controls.
   * @param {KeyboardEvent} event
   */
  function handleShortcut(event) {
    if (!event.altKey || event.ctrlKey || event.metaKey) return;

    let index = -1;
    for (let i = 0; i < TABS.length; i += 1) {
      if (event.code === 'Digit' + (i + 1)) {
        index = i;
        break;
      }
    }
    if (index === -1) return;

    event.preventDefault();

    const inField = event.target.closest
      && event.target.closest('input, textarea, select, [contenteditable]');

    const target = TABS[index];
    const current = tabButtons.find(
      (btn) => btn.getAttribute('aria-selected') === 'true'
    );
    const changing = !current || current.getAttribute('data-tab') !== target;

    selectTab(target, changing || !inField);
  }

  // ============================================
  // Initialization
  // ============================================

  function init() {
    if (!tabButtons.length) return;

    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        selectTab(btn.getAttribute('data-tab'), false);
      });
      btn.addEventListener('keydown', handleTabKeydown);
    });

    document.addEventListener('keydown', handleShortcut);

    const open = readDisclosures();
    disclosures.forEach((el) => {
      el.open = open.indexOf(el.getAttribute('data-disclosure')) !== -1;
      el.addEventListener('toggle', saveDisclosures);
    });

    selectTab(readTab(), false);
  }

  init();

  // Exposed so js/dock-onair.js can jump to the tab that owns an overlay.
  window.DockTabs = {
    select: (name) => selectTab(name, false),
  };
})();
