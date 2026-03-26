/**
 * Quran verse cache service
 * Handles persistent storage and retrieval of Quran verses
 * @module services/quran-cache
 */

const { SERVER, QURAN_SURAH_ORDER } = require('../config/constants');
const createLogger = require('../utils/logger');
const { readJsonSafe, createWriteQueue } = require('../utils/safe-file');

const log = createLogger('QuranCache');

// Serialized write queue for atomic saves
const saveQueued = createWriteQueue(SERVER.QURAN_CACHE_FILE);

// In-memory cache store
let cache = {};

/**
 * Extracts surah name from a Quran reference
 * @param {string} reference - e.g., "Al-Baqarah 2:255"
 * @returns {string} Surah name
 */
const extractSurahName = (reference) => {
  const match = reference.match(/^([A-Za-z'-]+(?:\s+[A-Za-z'-]+)*)\s+\d/);
  return match ? match[1].trim() : 'Unknown';
};

/**
 * Generates a cache key from reference and edition
 * @param {string} reference - Quran reference
 * @param {string} edition - Edition code
 * @returns {string} Cache key
 */
const createKey = (reference, edition) => `${reference}|${edition}`;

/**
 * Gets the canonical surah index for sorting
 * @param {string} surahName - Surah name to look up
 * @returns {number} Index or -1 if not found
 */
const getSurahIndex = (surahName) => {
  return QURAN_SURAH_ORDER.findIndex(
    (s) => surahName.toLowerCase().startsWith(s.name.toLowerCase())
  );
};

/**
 * Sorts references by surah number and ayah
 * @param {Object} a - First verse object
 * @param {Object} b - Second verse object
 * @returns {number} Sort comparison result
 */
const sortByAyah = (a, b) => {
  const matchA = a.reference.match(/(\d+):(\d+)/);
  const matchB = b.reference.match(/(\d+):(\d+)/);

  if (matchA && matchB) {
    const surahA = parseInt(matchA[1], 10);
    const surahB = parseInt(matchB[1], 10);
    if (surahA !== surahB) return surahA - surahB;
    return parseInt(matchA[2], 10) - parseInt(matchB[2], 10);
  }
  return a.reference.localeCompare(b.reference);
};

/**
 * Quran Cache Service API
 */
const QuranCacheService = {
  /**
   * Loads cache from disk with backup fallback
   * @returns {boolean} Success status
   */
  load() {
    const { data, source } = readJsonSafe(SERVER.QURAN_CACHE_FILE);

    if (!data) {
      log.info('No existing Quran cache found, starting fresh');
      return false;
    }

    if (source === 'backup') {
      log.warn('Loaded Quran cache from backup file — primary was corrupted');
    }

    if (typeof data !== 'object' || Array.isArray(data)) {
      log.error('Loaded Quran cache is not a valid object, ignoring');
      return false;
    }

    cache = data;
    log.info(`Loaded ${Object.keys(cache).length} cached Quran verses`);
    return true;
  },

  /**
   * Saves cache to disk using atomic write queue
   * @returns {Promise<boolean>} Success status
   */
  async save() {
    const ok = await saveQueued(cache);
    if (!ok) log.error('Failed to save Quran cache');
    return ok;
  },

  /**
   * Checks if a verse exists in cache
   * @param {string} reference - Quran reference
   * @param {string} edition - Edition code
   * @returns {boolean} Exists in cache
   */
  has(reference, edition) {
    return createKey(reference, edition) in cache;
  },

  /**
   * Gets a verse from cache
   * @param {string} reference - Quran reference
   * @param {string} edition - Edition code
   * @returns {Object|null} Cached verse or null
   */
  get(reference, edition) {
    return cache[createKey(reference, edition)] || null;
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
    const surahName = verseData.surahName || extractSurahName(verseData.reference);

    const cachedVerse = {
      ...verseData,
      surahName,
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
   * Gets all cached verses organized by surah in canonical order
   * @returns {Object} Verses grouped by surah
   */
  getAllBySurah() {
    const bySurah = Object.entries(cache).reduce((acc, [key, verse]) => {
      const surah = verse.surahName || extractSurahName(verse.reference);
      const existing = acc[surah] || [];
      return {
        ...acc,
        [surah]: [...existing, { key, ...verse }],
      };
    }, {});

    const sortedSurahNames = Object.keys(bySurah).sort((a, b) => {
      const indexA = getSurahIndex(a);
      const indexB = getSurahIndex(b);

      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    return sortedSurahNames.reduce((acc, surah) => ({
      ...acc,
      [surah]: bySurah[surah].sort(sortByAyah),
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

module.exports = QuranCacheService;
