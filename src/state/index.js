/**
 * Application state management with immutable updates
 * @module state
 */

const { DISPLAY, SOUNDBOARD } = require('../config/constants');

/**
 * Creates initial caller state
 * @returns {Object} Fresh caller state
 */
const createCallerState = () => Object.freeze({
  name: '',
  pronouns: '',
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
 * Creates initial fallacy state
 * @returns {Object} Fresh fallacy state
 */
const createFallacyState = () => Object.freeze({
  name: '',
  definition: '',
  slug: '',
  type: 'fallacy',
});

// Application state container
let state = {
  caller: createCallerState(),
  verse: createVerseState(),
  fallacy: createFallacyState(),
  soundboard: createSoundboardState(),
  showConfig: createShowConfigState(),
};

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