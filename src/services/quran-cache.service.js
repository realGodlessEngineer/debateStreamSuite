/**
 * Quran verse cache service
 * Handles persistent storage and retrieval of Quran verses via SQLite
 * @module services/quran-cache
 */

const { QURAN_SURAH_ORDER } = require('../config/constants');
const createLogger = require('../utils/logger');
const DatabaseService = require('./database.service');

const log = createLogger('QuranCache');

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
 * Safely parses JSON with a fallback for corrupt data
 * @param {string} json - JSON string
 * @param {*} fallback - Fallback value
 * @returns {*} Parsed value or fallback
 */
const safeParse = (json, fallback = []) => {
  try {
    return JSON.parse(json || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
};

/**
 * Converts a database row to a verse object
 * @param {Object} row - Database row
 * @returns {Object} Verse object
 */
const rowToVerse = (row) => ({
  key: row.key,
  reference: row.reference,
  version: row.version,
  versionName: row.version_name,
  text: row.text,
  surahName: row.surah_name,
  surahNumber: row.surah_number,
  verses: safeParse(row.verses_json),
  totalVerses: row.total_verses,
  timestamp: row.timestamp,
});

/**
 * Quran Cache Service API
 */
const QuranCacheService = {
  /**
   * Loads cache (no-op for SQLite, kept for API compatibility)
   * @returns {boolean} Success status
   */
  load() {
    try {
      const db = DatabaseService.getDb();
      const count = db.prepare('SELECT COUNT(*) as count FROM quran_verses').get().count;
      log.info(`${count} cached Quran verses available`);
      return true;
    } catch (error) {
      log.error('Failed to access Quran verse cache:', error.message);
      return false;
    }
  },

  /**
   * Checks if a verse exists in cache
   * @param {string} reference - Quran reference
   * @param {string} edition - Edition code
   * @returns {boolean} Exists in cache
   */
  has(reference, edition) {
    const db = DatabaseService.getDb();
    const row = db.prepare('SELECT 1 FROM quran_verses WHERE key = ?').get(createKey(reference, edition));
    return !!row;
  },

  /**
   * Gets a verse from cache
   * @param {string} reference - Quran reference
   * @param {string} edition - Edition code
   * @returns {Object|null} Cached verse or null
   */
  get(reference, edition) {
    const db = DatabaseService.getDb();
    const row = db.prepare('SELECT * FROM quran_verses WHERE key = ?').get(createKey(reference, edition));
    return row ? rowToVerse(row) : null;
  },

  /**
   * Gets a verse by its cache key
   * @param {string} key - Cache key
   * @returns {Object|null} Cached verse or null
   */
  getByKey(key) {
    const db = DatabaseService.getDb();
    const row = db.prepare('SELECT * FROM quran_verses WHERE key = ?').get(key);
    return row ? rowToVerse(row) : null;
  },

  /**
   * Adds a verse to cache
   * @param {Object} verseData - Verse data to cache
   * @returns {Object} Cached verse with metadata
   */
  add(verseData) {
    const db = DatabaseService.getDb();
    const key = createKey(verseData.reference, verseData.version);
    const surahName = verseData.surahName || extractSurahName(verseData.reference);
    const timestamp = Date.now();

    db.prepare(`
      INSERT OR REPLACE INTO quran_verses (key, reference, version, version_name, text, surah_name, surah_number, verses_json, total_verses, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      key, verseData.reference, verseData.version, verseData.versionName || '',
      verseData.text || '', surahName, verseData.surahNumber || 0,
      verseData.verses ? JSON.stringify(verseData.verses) : '[]',
      verseData.totalVerses || 0, timestamp
    );

    return { ...verseData, key, surahName, timestamp };
  },

  /**
   * Removes a verse from cache
   * @param {string} key - Cache key to remove
   * @returns {boolean} Success status
   */
  remove(key) {
    const db = DatabaseService.getDb();
    const result = db.prepare('DELETE FROM quran_verses WHERE key = ?').run(key);
    return result.changes > 0;
  },

  /**
   * Clears all cached verses
   * @returns {boolean} Success status
   */
  clear() {
    const db = DatabaseService.getDb();
    db.prepare('DELETE FROM quran_verses').run();
    return true;
  },

  /**
   * Gets all cached verses organized by surah in canonical order
   * @returns {Object} Verses grouped by surah
   */
  getAllBySurah() {
    const db = DatabaseService.getDb();
    const rows = db.prepare('SELECT * FROM quran_verses ORDER BY surah_name, reference').all();

    const bySurah = {};
    for (const row of rows) {
      const verse = rowToVerse(row);
      const surah = verse.surahName || extractSurahName(verse.reference);
      if (!bySurah[surah]) bySurah[surah] = [];
      bySurah[surah].push(verse);
    }

    const sortedSurahNames = Object.keys(bySurah).sort((a, b) => {
      const indexA = getSurahIndex(a);
      const indexB = getSurahIndex(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    const result = {};
    for (const surah of sortedSurahNames) {
      result[surah] = bySurah[surah].sort(sortByAyah);
    }
    return result;
  },

  /**
   * Gets cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    const db = DatabaseService.getDb();
    const stats = db.prepare(`
      SELECT COUNT(*) as totalVerses, MIN(timestamp) as oldestEntry, MAX(timestamp) as newestEntry
      FROM quran_verses
    `).get();

    return {
      totalVerses: stats.totalVerses,
      oldestEntry: stats.totalVerses > 0 ? stats.oldestEntry : null,
      newestEntry: stats.totalVerses > 0 ? stats.newestEntry : null,
    };
  },
};

module.exports = QuranCacheService;
