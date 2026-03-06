/**
 * Verse cache service
 * Handles persistent storage and retrieval of Bible verses
 * @module services/cache
 */

const fs = require('fs');
const { SERVER, BIBLE_BOOK_ORDER } = require('../config/constants');
const createLogger = require('../utils/logger');
const { readJsonSafe, createWriteQueue } = require('../utils/safe-file');

const log = createLogger('Cache');

// Serialized write queue for atomic saves
const saveQueued = createWriteQueue(SERVER.CACHE_FILE);

// In-memory cache store
let cache = {};

/**
 * Extracts book name from a Bible reference
 * @param {string} reference - e.g., "1 John 3:16", "Genesis 1:1"
 * @returns {string} Book name
 */
const extractBookName = (reference) => {
  const match = reference.match(/^(\d?\s?[A-Za-z]+(?:\s+of\s+[A-Za-z]+)?)/);
  return match ? match[1].trim() : 'Unknown';
};

/**
 * Generates a cache key from reference and version
 * @param {string} reference - Bible reference
 * @param {string} version - Bible version code
 * @returns {string} Cache key
 */
const createKey = (reference, version) => `${reference}|${version}`;

/**
 * Parses a cache key into reference and version
 * @param {string} key - Cache key
 * @returns {Object} { reference, version }
 */
const parseKey = (key) => {
  const [reference, version] = key.split('|');
  return { reference, version };
};

/**
 * Gets the biblical order index for a book
 * @param {string} bookName - Book name to look up
 * @returns {number} Index or -1 if not found
 */
const getBookIndex = (bookName) => {
  return BIBLE_BOOK_ORDER.findIndex(
    (book) => bookName.toLowerCase().startsWith(book.toLowerCase())
  );
};

/**
 * Sorts references by chapter and verse
 * @param {Object} a - First verse object
 * @param {Object} b - Second verse object
 * @returns {number} Sort comparison result
 */
const sortByChapterVerse = (a, b) => {
  const matchA = a.reference.match(/:?(\d+):(\d+)/);
  const matchB = b.reference.match(/:?(\d+):(\d+)/);

  if (matchA && matchB) {
    const chapterA = parseInt(matchA[1], 10);
    const chapterB = parseInt(matchB[1], 10);
    if (chapterA !== chapterB) return chapterA - chapterB;
    return parseInt(matchA[2], 10) - parseInt(matchB[2], 10);
  }
  return a.reference.localeCompare(b.reference);
};

/**
 * Cache Service API
 */
const CacheService = {
  /**
   * Loads cache from disk with backup fallback
   * @returns {boolean} Success status
   */
  load() {
    const { data, source } = readJsonSafe(SERVER.CACHE_FILE);

    if (!data) {
      log.info('No existing cache found, starting fresh');
      return false;
    }

    if (source === 'backup') {
      log.warn('Loaded cache from backup file — primary was corrupted');
    }

    // Validate it's an object (cache is a dict, not an array)
    if (typeof data !== 'object' || Array.isArray(data)) {
      log.error('Loaded cache is not a valid object, ignoring');
      return false;
    }

    cache = data;
    log.info(`Loaded ${Object.keys(cache).length} cached verses`);
    return true;
  },

  /**
   * Saves cache to disk using atomic write queue
   * @returns {Promise<boolean>} Success status
   */
  async save() {
    const ok = await saveQueued(cache);
    if (!ok) log.error('Failed to save cache');
    return ok;
  },

  /**
   * Checks if a verse exists in cache
   * @param {string} reference - Bible reference
   * @param {string} version - Bible version
   * @returns {boolean} Exists in cache
   */
  has(reference, version) {
    const key = createKey(reference, version);
    return key in cache;
  },

  /**
   * Gets a verse from cache
   * @param {string} reference - Bible reference
   * @param {string} version - Bible version
   * @returns {Object|null} Cached verse or null
   */
  get(reference, version) {
    const key = createKey(reference, version);
    return cache[key] || null;
  },

  /**
   * Gets a verse by its cache key
   * @param {string} key - Cache key
   * @returns {Object|null} Cached verse or null
   */
  getByKey(key) {
    return cache[key] || null;
  },

  /**
   * Adds a verse to cache
   * @param {Object} verseData - Verse data to cache
   * @returns {Object} Cached verse with metadata
   */
  add(verseData) {
    const key = createKey(verseData.reference, verseData.version);
    const book = extractBookName(verseData.reference);

    const cachedVerse = {
      ...verseData,
      book,
      timestamp: Date.now(),
    };

    cache = { ...cache, [key]: cachedVerse };
    this.save();

    return cachedVerse;
  },

  /**
   * Removes a verse from cache
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
   * Clears all cached verses
   * @returns {Promise<boolean>} Success status
   */
  async clear() {
    cache = {};
    return this.save();
  },

  /**
   * Gets all cached verses organized by book in biblical order
   * @returns {Object} Verses grouped by book
   */
  getAllByBook() {
    // Group by book
    const byBook = Object.entries(cache).reduce((acc, [key, verse]) => {
      const book = verse.book || extractBookName(verse.reference);
      const existing = acc[book] || [];
      return {
        ...acc,
        [book]: [...existing, { key, ...verse }],
      };
    }, {});

    // Sort books by biblical order
    const sortedBookNames = Object.keys(byBook).sort((a, b) => {
      const indexA = getBookIndex(a);
      const indexB = getBookIndex(b);

      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    // Build result with sorted verses within each book
    return sortedBookNames.reduce((acc, book) => ({
      ...acc,
      [book]: byBook[book].sort(sortByChapterVerse),
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

module.exports = CacheService;
