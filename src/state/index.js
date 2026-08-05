/**
 * Application state management with immutable updates
 * @module state
 */

const { DISPLAY, SOUNDBOARD, QUEUE, CALLER, SCOREBOARD } = require('../config/constants');

/**
 * Creates initial caller state
 * @returns {Object} Fresh caller state
 * `stance` is a debate-side key (see CALLER.STANCES); `timerStartedAt` is the
 * server-clock ms timestamp the call went live (null = timer stopped), letting
 * every client render the same elapsed call time.
 */
const createCallerState = () => Object.freeze({
  name: '',
  pronouns: '',
  stance: '',
  timerStartedAt: null,
});

/**
 * Creates initial caller-queue state
 * @returns {Object} Fresh queue state
 * Each item: { id, name, pronouns, stance, topic, platform }
 */
const createQueueState = () => Object.freeze({
  items: Object.freeze([]),
});

/**
 * Creates initial stage-topics state
 * @returns {Object} Fresh topics state
 * `items` is the operator's debate-topics list; `visible` toggles the overlay.
 */
const createTopicsState = () => Object.freeze({
  items: Object.freeze([]),
  visible: false,
});

/**
 * Creates initial call-in state
 * @returns {Object} Fresh call-in state
 * `text` is the call-in pill line; `visible` toggles the overlay.
 */
const createCallInState = () => Object.freeze({
  text: '',
  visible: false,
});

/**
 * Creates initial verse state
 * @returns {Object} Fresh verse state
 */
const createVerseState = () => Object.freeze({
  reference: '',
  version: '',
  versionName: '',
  text: '',
  verses: [],
  totalVerses: 0,
  currentPage: 0,
  versesPerPage: DISPLAY.VERSES_PER_PAGE,
  source: '',
});

/**
 * Creates initial soundboard state
 * @returns {Object} Fresh soundboard state
 */
const createSoundboardState = () => Object.freeze({
  currentSound: null, // { id, name, emoji }
  currentPage: 0,
  buttonsPerPage: SOUNDBOARD.BUTTONS_PER_PAGE,
});

/**
 * Creates initial show config state
 * @returns {Object} Fresh show config state
 */
const createShowConfigState = () => Object.freeze({
  showTitle: '',
  hosts: [], // Array of { name, pronouns }, max 2
});

/**
 * Creates initial claim (resolution banner) state
 * @returns {Object} Fresh claim state
 * `text` is the proposition under debate (e.g. "RESOLVED: ..."); `subtext`
 * is an optional attribution/qualifier line; `visible` toggles the overlay.
 * Independent of the verse/fallacy display mutex - this is its own channel.
 */
const createClaimState = () => Object.freeze({
  text: '',
  subtext: '',
  visible: false,
});

/**
 * Creates initial fallacy state
 * @returns {Object} Fresh fallacy state
 */
const createFallacyState = () => Object.freeze({
  name: '',
  definition: '',
  slug: '',
  type: 'fallacy',
});

/**
 * Creates initial scene-card state
 * @returns {Object} Fresh scene state
 * `key` is one of SCENE.KEYS ('starting-soon' | 'brb' | 'ending'), or '' when
 * cleared; `message` is an optional operator-supplied subline.
 */
const createSceneState = () => Object.freeze({
  key: '',
  message: '',
  visible: false,
});

/**
 * Creates initial segment-countdown state
 * @returns {Object} Fresh segment-timer state
 * `endsAt` is the server-clock ms timestamp the countdown reaches zero
 * (null when stopped); `remainingMs` holds the frozen remainder while
 * stopped, so every client renders the same instant.
 */
const createSegmentTimerState = () => Object.freeze({
  label: '',
  endsAt: null,
  remainingMs: 0,
  running: false,
});

/**
 * Creates initial scoreboard state
 * @returns {Object} Fresh scoreboard state
 * `scores` is keyed by debate-stance (see CALLER.STANCES), one int per side,
 * so a side's tally reuses the exact key/color already used for its stance
 * chip elsewhere in the app rather than a parallel side vocabulary.
 */
const createScoreboardState = () => Object.freeze({
  scores: Object.freeze(
    CALLER.STANCES.reduce((scores, key) => {
      scores[key] = 0;
      return scores;
    }, {})
  ),
  visible: false,
});

/**
 * Creates initial ticker state
 * @returns {Object} Fresh ticker state
 * `items` is the operator's bottom-of-screen crawl strings (social handles,
 * next-topic teaser, announcements); `visible` toggles the overlay.
 */
const createTickerState = () => Object.freeze({
  items: Object.freeze([]),
  visible: false,
});

// Application state container
let state = {
  caller: createCallerState(),
  queue: createQueueState(),
  topics: createTopicsState(),
  callIn: createCallInState(),
  verse: createVerseState(),
  fallacy: createFallacyState(),
  soundboard: createSoundboardState(),
  showConfig: createShowConfigState(),
  scene: createSceneState(),
  segmentTimer: createSegmentTimerState(),
  scoreboard: createScoreboardState(),
  claim: createClaimState(),
  ticker: createTickerState(),
};

// Monotonic counter for queue item ids (stable across a server run)
let queueIdCounter = 0;

/**
 * State accessor and mutator functions
 * Using getter/setter pattern for controlled access
 */
const StateManager = {
  /**
   * Get current caller state
   * @returns {Object} Immutable caller state
   */
  getCaller() {
    return state.caller;
  },

  /**
   * Update caller state with new values
   * @param {Object} updates - Partial caller updates
   * @returns {Object} New caller state
   */
  updateCaller(updates) {
    state = {
      ...state,
      caller: Object.freeze({
        ...state.caller,
        ...updates,
      }),
    };
    return state.caller;
  },

  /**
   * Reset caller to initial state
   * @returns {Object} Fresh caller state
   */
  clearCaller() {
    state = {
      ...state,
      caller: createCallerState(),
    };
    return state.caller;
  },

  // ========================================
  // Caller Queue State
  // ========================================

  /**
   * Get current queue state
   * @returns {Object} Immutable queue state
   */
  getQueue() {
    return state.queue;
  },

  /**
   * Replace the queue items (frozen) and return the new queue state
   * @param {Array} items - New items array
   * @returns {Object} New queue state
   */
  _setQueueItems(items) {
    state = {
      ...state,
      queue: Object.freeze({ items: Object.freeze(items) }),
    };
    return state.queue;
  },

  /**
   * Append a caller to the queue (assigns an id, enforces max size)
   * @param {Object} item - { name, pronouns, stance, topic, platform }
   * @returns {Object} New queue state
   */
  addToQueue(item) {
    queueIdCounter += 1;
    const entry = { id: `q${queueIdCounter}`, ...item };
    return this._setQueueItems([...state.queue.items, entry].slice(0, QUEUE.MAX_SIZE));
  },

  /**
   * Remove a queued caller by id
   * @param {string} id - Queue item id
   * @returns {Object} New queue state
   */
  removeFromQueue(id) {
    return this._setQueueItems(state.queue.items.filter(i => i.id !== id));
  },

  /**
   * Move a queued caller within the list
   * @param {string} id - Queue item id
   * @param {string} direction - 'up', 'down', or 'top'
   * @returns {Object} New queue state
   */
  reorderQueue(id, direction) {
    const items = [...state.queue.items];
    const idx = items.findIndex(i => i.id === id);
    if (idx === -1) return state.queue;

    if (direction === 'top') {
      const [moved] = items.splice(idx, 1);
      items.unshift(moved);
    } else if (direction === 'up' && idx > 0) {
      [items[idx - 1], items[idx]] = [items[idx], items[idx - 1]];
    } else if (direction === 'down' && idx < items.length - 1) {
      [items[idx + 1], items[idx]] = [items[idx], items[idx + 1]];
    } else {
      return state.queue;
    }
    return this._setQueueItems(items);
  },

  /**
   * Remove and return a queued caller (used when promoting to live)
   * @param {string} id - Queue item id
   * @returns {Object|null} The removed item, or null if not found
   */
  promoteFromQueue(id) {
    const item = state.queue.items.find(i => i.id === id);
    if (!item) return null;
    this.removeFromQueue(id);
    return item;
  },

  /**
   * Empty the queue
   * @returns {Object} Fresh queue state
   */
  clearQueue() {
    state = {
      ...state,
      queue: createQueueState(),
    };
    return state.queue;
  },

  // ========================================
  // Stage Topics State
  // ========================================

  /**
   * Get current stage-topics state
   * @returns {Object} Immutable topics state
   */
  getTopics() {
    return state.topics;
  },

  /**
   * Update stage-topics state with new values
   * @param {Object} updates - { items, visible }
   * @returns {Object} New topics state
   */
  updateTopics({ items, visible }) {
    state = {
      ...state,
      topics: Object.freeze({
        items: Object.freeze(Array.isArray(items) ? [...items] : []),
        visible: Boolean(visible),
      }),
    };
    return state.topics;
  },

  // ========================================
  // Call-In State
  // ========================================

  /**
   * Get current call-in state
   * @returns {Object} Immutable call-in state
   */
  getCallIn() {
    return state.callIn;
  },

  /**
   * Update call-in state with new values
   * @param {Object} updates - { text, visible }
   * @returns {Object} New call-in state
   */
  updateCallIn({ text, visible }) {
    state = {
      ...state,
      callIn: Object.freeze({
        text: typeof text === 'string' ? text : '',
        visible: Boolean(visible),
      }),
    };
    return state.callIn;
  },

  /**
   * Get current verse state
   * @returns {Object} Immutable verse state
   */
  getVerse() {
    return state.verse;
  },

  /**
   * Update verse state with new values
   * @param {Object} updates - Partial verse updates
   * @returns {Object} New verse state
   */
  updateVerse(updates) {
    const newVerseState = {
      ...state.verse,
      ...updates,
    };
    
    // Ensure totalVerses is calculated if verses array is provided
    if (updates.verses && !updates.totalVerses) {
      newVerseState.totalVerses = updates.verses.length;
    }
    
    state = {
      ...state,
      verse: Object.freeze(newVerseState),
    };
    return state.verse;
  },

  /**
   * Reset verse to initial state
   * @returns {Object} Fresh verse state
   */
  clearVerse() {
    state = {
      ...state,
      verse: createVerseState(),
    };
    return state.verse;
  },

  /**
   * Navigate to a specific page
   * @param {string|number} direction - 'prev', 'next', 'first', 'last', or page number
   * @returns {Object} Updated verse state
   */
  changePage(direction) {
    const { totalVerses, versesPerPage, currentPage } = state.verse;
    const totalPages = Math.ceil(totalVerses / versesPerPage);
    
    let newPage = currentPage;
    
    switch (direction) {
      case 'next':
        newPage = Math.min(currentPage + 1, totalPages - 1);
        break;
      case 'prev':
        newPage = Math.max(currentPage - 1, 0);
        break;
      case 'first':
        newPage = 0;
        break;
      case 'last':
        newPage = Math.max(totalPages - 1, 0);
        break;
      default:
        if (typeof direction === 'number') {
          newPage = Math.max(0, Math.min(direction, totalPages - 1));
        }
    }
    
    return this.updateVerse({ currentPage: newPage });
  },

  // ========================================
  // Fallacy State
  // ========================================

  /**
   * Get current fallacy state
   * @returns {Object} Immutable fallacy state
   */
  getFallacy() {
    return state.fallacy;
  },

  /**
   * Update fallacy state with new values
   * @param {Object} updates - Fallacy data
   * @returns {Object} New fallacy state
   */
  updateFallacy(updates) {
    state = {
      ...state,
      fallacy: Object.freeze({
        ...state.fallacy,
        ...updates,
        type: 'fallacy',
      }),
    };
    return state.fallacy;
  },

  /**
   * Reset fallacy to initial state
   * @returns {Object} Fresh fallacy state
   */
  clearFallacy() {
    state = {
      ...state,
      fallacy: createFallacyState(),
    };
    return state.fallacy;
  },

  // ========================================
  // Soundboard State
  // ========================================

  /**
   * Get current soundboard state
   * @returns {Object} Immutable soundboard state
   */
  getSoundboard() {
    return state.soundboard;
  },

  /**
   * Update soundboard state
   * @param {Object} updates - Partial soundboard updates
   * @returns {Object} New soundboard state
   */
  updateSoundboard(updates) {
    state = {
      ...state,
      soundboard: Object.freeze({
        ...state.soundboard,
        ...updates,
      }),
    };
    return state.soundboard;
  },

  /**
   * Reset soundboard to initial state
   * @returns {Object} Fresh soundboard state
   */
  clearSoundboard() {
    state = {
      ...state,
      soundboard: createSoundboardState(),
    };
    return state.soundboard;
  },

  // ========================================
  // Show Config State
  // ========================================

  /**
   * Get current show config state
   * @returns {Object} Immutable show config state
   */
  getShowConfig() {
    return state.showConfig;
  },

  /**
   * Update show config state
   * @param {Object} updates - Partial show config updates
   * @returns {Object} New show config state
   */
  updateShowConfig(updates) {
    state = {
      ...state,
      showConfig: Object.freeze({
        ...state.showConfig,
        ...updates,
      }),
    };
    return state.showConfig;
  },

  // ========================================
  // Scene Card State
  // ========================================

  /**
   * Get current scene-card state
   * @returns {Object} Immutable scene state
   */
  getScene() {
    return state.scene;
  },

  /**
   * Update scene-card state with new values
   * @param {Object} updates - { key, message, visible }
   * @returns {Object} New scene state
   */
  updateScene(updates) {
    state = {
      ...state,
      scene: Object.freeze({
        ...state.scene,
        ...updates,
      }),
    };
    return state.scene;
  },

  /**
   * Reset scene card to its initial (cleared) state
   * @returns {Object} Fresh scene state
   */
  clearScene() {
    state = {
      ...state,
      scene: createSceneState(),
    };
    return state.scene;
  },

  // ========================================
  // Segment Countdown Timer State
  // ========================================

  /**
   * Get current segment-timer state
   * @returns {Object} Immutable segment-timer state
   */
  getSegmentTimer() {
    return state.segmentTimer;
  },

  /**
   * Arm and start the segment countdown
   * @param {string} label - Operator-supplied segment label
   * @param {number} durationMs - Countdown length in ms
   * @returns {Object} New segment-timer state
   */
  startSegmentTimer(label, durationMs) {
    state = {
      ...state,
      segmentTimer: Object.freeze({
        label,
        endsAt: Date.now() + durationMs,
        remainingMs: durationMs,
        running: true,
      }),
    };
    return state.segmentTimer;
  },

  /**
   * Stop the countdown, freezing the remaining time at the moment of stop
   * @returns {Object} New segment-timer state
   */
  stopSegmentTimer() {
    const { endsAt, running, remainingMs } = state.segmentTimer;
    const frozenRemainingMs = running && endsAt
      ? Math.max(0, endsAt - Date.now())
      : remainingMs;

    state = {
      ...state,
      segmentTimer: Object.freeze({
        ...state.segmentTimer,
        endsAt: null,
        remainingMs: frozenRemainingMs,
        running: false,
      }),
    };
    return state.segmentTimer;
  },

  /**
   * Reset the segment timer to its initial (cleared) state
   * @returns {Object} Fresh segment-timer state
   */
  resetSegmentTimer() {
    state = {
      ...state,
      segmentTimer: createSegmentTimerState(),
    };
    return state.segmentTimer;
  },

  // ========================================
  // Scoreboard State
  // ========================================

  /**
   * Get current scoreboard state
   * @returns {Object} Immutable scoreboard state
   */
  getScoreboard() {
    return state.scoreboard;
  },

  /**
   * Adjust one side's score by a signed delta, clamped to
   * SCOREBOARD.MIN_SCORE/MAX_SCORE so a stuck key can't run the display off
   * the edge. Unknown sides are ignored (caller validates against
   * CALLER.STANCES before this is reached).
   * @param {string} side - A CALLER.STANCES key
   * @param {number} delta - Signed integer adjustment
   * @returns {Object} New scoreboard state
   */
  adjustScore(side, delta) {
    if (!Object.prototype.hasOwnProperty.call(state.scoreboard.scores, side)) return state.scoreboard;

    const current = state.scoreboard.scores[side];
    const next = Math.max(SCOREBOARD.MIN_SCORE, Math.min(SCOREBOARD.MAX_SCORE, current + delta));
    state = {
      ...state,
      scoreboard: Object.freeze({
        ...state.scoreboard,
        scores: Object.freeze({ ...state.scoreboard.scores, [side]: next }),
      }),
    };
    return state.scoreboard;
  },

  /**
   * Zero every side's score (visibility is left untouched)
   * @returns {Object} New scoreboard state
   */
  resetScoreboard() {
    state = {
      ...state,
      scoreboard: Object.freeze({
        ...state.scoreboard,
        scores: createScoreboardState().scores,
      }),
    };
    return state.scoreboard;
  },

  /**
   * Toggle the scoreboard overlay's visibility
   * @param {boolean} visible
   * @returns {Object} New scoreboard state
   */
  setScoreboardVisible(visible) {
    state = {
      ...state,
      scoreboard: Object.freeze({
        ...state.scoreboard,
        visible: Boolean(visible),
      }),
    };
    return state.scoreboard;
  },

  // ========================================
  // Claim (Resolution Banner) State
  // ========================================

  /**
   * Get current claim state
   * @returns {Object} Immutable claim state
   */
  getClaim() {
    return state.claim;
  },

  /**
   * Update claim state with new values
   * @param {Object} updates - { text, subtext, visible }
   * @returns {Object} New claim state
   */
  updateClaim({ text, subtext, visible }) {
    state = {
      ...state,
      claim: Object.freeze({
        text: typeof text === 'string' ? text : '',
        subtext: typeof subtext === 'string' ? subtext : '',
        visible: Boolean(visible),
      }),
    };
    return state.claim;
  },

  /**
   * Reset claim to initial (empty) state
   * @returns {Object} Fresh claim state
   */
  clearClaim() {
    state = {
      ...state,
      claim: createClaimState(),
    };
    return state.claim;
  },

  // ========================================
  // Ticker State
  // ========================================

  /**
   * Get current ticker state
   * @returns {Object} Immutable ticker state
   */
  getTicker() {
    return state.ticker;
  },

  /**
   * Update ticker state with new values
   * @param {Object} updates - { items, visible }
   * @returns {Object} New ticker state
   */
  updateTicker({ items, visible }) {
    state = {
      ...state,
      ticker: Object.freeze({
        items: Object.freeze(Array.isArray(items) ? [...items] : []),
        visible: Boolean(visible),
      }),
    };
    return state.ticker;
  },

  /**
   * Get pagination info for current verse
   * @returns {Object} Pagination details
   */
  getPaginationInfo() {
    const { totalVerses, versesPerPage, currentPage } = state.verse;
    const totalPages = Math.ceil(totalVerses / versesPerPage);
    
    return {
      currentPage,
      totalPages,
      totalVerses,
      versesPerPage,
      hasNext: currentPage < totalPages - 1,
      hasPrev: currentPage > 0,
    };
  },
};

module.exports = StateManager;