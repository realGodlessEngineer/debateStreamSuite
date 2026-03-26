/**
 * Dictionary cache service
 * Handles persistent storage and retrieval of word definitions
 * @module services/dictionary-cache
 */

const { SERVER } = require('../config/constants');
const createLogger = require('../utils/logger');
const { readJsonSafe, createWriteQueue } = require('../utils/safe-file');

const log = createLogger('DictCache');

// Serialized write queue for atomic saves
const saveQueued = createWriteQueue(SERVER.DICTIONARY_CACHE_FILE);

// In-memory cache store
let cache = {};

/**
 * Extracts uppercase first letter for grouping
 * @param {string} word - Word to extract from
 * @returns {string} Uppercase first letter or '#'
 */
const extractFirstLetter = (word) => {
  const first = word.charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : '#';
};

/**
 * Generates a cache key from word and language
 * @param {string} word - Word (lowercased)
 * @param {string} lang - Language code
 * @returns {string} Cache key
 */
const createKey = (word, lang) => `${word.toLowerCase()}|${lang}`;

/**
 * Dictionary Cache Service API
 */
const DictionaryCacheService = {
  /**
   * Loads cache from disk with backup fallback
   * @returns {boolean} Success status
   */
  load() {
    const { data, source } = readJsonSafe(SERVER.DICTIONARY_CACHE_FILE);

    if (!data) {
      log.info('No existing dictionary cache found, starting fresh');
      return false;
    }

    if (source === 'backup') {
      log.warn('Loaded dictionary cache from backup file — primary was corrupted');
    }

    if (typeof data !== 'object' || Array.isArray(data)) {
      log.error('Loaded dictionary cache is not a valid object, ignoring');
      return false;
    }

    cache = data;
    log.info(`Loaded ${Object.keys(cache).length} cached definitions`);
    return true;
  },

  /**
   * Saves cache to disk using atomic write queue
   * @returns {Promise<boolean>} Success status
   */
  async save() {
    const ok = await saveQueued(cache);
    if (!ok) log.error('Failed to save dictionary cache');
    return ok;
  },

  /**
   * Checks if a word exists in cache
   * @param {string} word - Word to check
   * @param {string} lang - Language code
   * @returns {boolean} Exists in cache
   */
  has(word, lang) {
    return createKey(word, lang) in cache;
  },

  /**
   * Gets a word from cache
   * @param {string} word - Word to get
   * @param {string} lang - Language code
   * @returns {Object|null} Cached definition or null
   */
  get(word, lang) {
    return cache[createKey(word, lang)] || null;
  },

  /**
   * Gets a definition by its cache key
   * @param {string} key - Cache key
   * @returns {Object|null} Cached definition or null
   */
  getByKey(key) {
    return cache[key] || null;
  },

  /**
   * Adds a definition to cache
   * @param {Object} wordData - Definition data to cache
   * @returns {Object} Cached definition with metadata
   */
  add(wordData) {
    const key = createKey(wordData.reference, wordData.version);
    const firstLetter = extractFirstLetter(wordData.reference);

    const cachedEntry = {
      ...wordData,
      firstLetter,
      timestamp: Date.now(),
    };

    cache = { ...cache, [key]: cachedEntry };
    this.save();

    return cachedEntry;
  },

  /**
   * Removes a definition from cache
   * @param {string} key - Cache key to remove
   * @returns {boolean} Success status
   */
  remove(key) {
    if (!(key in cache)) return false;

    const { [key]: _removed, ...remaining } = cache;
    cache = remaining;
    this.save();

    return true;
  },

  /**
   * Clears all cached definitions
   * @returns {Promise<boolean>} Success status
   */
  async clear() {
    cache = {};
    return this.save();
  },

  /**
   * Gets all cached definitions organized by first letter A-Z
   * @returns {Object} Definitions grouped by letter
   */
  getAllByLetter() {
    const byLetter = Object.entries(cache).reduce((acc, [key, entry]) => {
      const letter = entry.firstLetter || extractFirstLetter(entry.reference);
      const existing = acc[letter] || [];
      return {
        ...acc,
        [letter]: [...existing, { key, ...entry }],
      };
    }, {});

    const sortedLetters = Object.keys(byLetter).sort();

    return sortedLetters.reduce((acc, letter) => ({
      ...acc,
      [letter]: byLetter[letter].sort((a, b) =>
        a.reference.toLowerCase().localeCompare(b.reference.toLowerCase())
      ),
    }), {});
  },

  /**
   * Gets cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    const entries = Object.values(cache);
    return {
      totalVerses: entries.length,
      oldestEntry: entries.length
        ? Math.min(...entries.map((v) => v.timestamp))
        : null,
      newestEntry: entries.length
        ? Math.max(...entries.map((v) => v.timestamp))
        : null,
    };
  },
};

module.exports = DictionaryCacheService;
