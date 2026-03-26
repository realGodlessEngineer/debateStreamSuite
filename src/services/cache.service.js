/**
 * Verse cache service
 * Handles persistent storage and retrieval of Bible verses via SQLite
 * @module services/cache
 */

const { BIBLE_BOOK_ORDER } = require('../config/constants');
const createLogger = require('../utils/logger');
const DatabaseService = require('./database.service');

const log = createLogger('Cache');

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
  book: row.book,
  timestamp: row.timestamp,
});

/**
 * Cache Service API
 */
const CacheService = {
  /**
   * Loads cache (no-op for SQLite, kept for API compatibility)
   * @returns {boolean} Success status
   */
  load() {
    try {
      const db = DatabaseService.getDb();
      const count = db.prepare('SELECT COUNT(*) as count FROM bible_verses').get().count;
      log.info(`${count} cached Bible verses available`);
      return true;
    } catch (error) {
      log.error('Failed to access Bible verse cache:', error.message);
      return false;
    }
  },

  /**
   * Checks if a verse exists in cache
   * @param {string} reference - Bible reference
   * @param {string} version - Bible version
   * @returns {boolean} Exists in cache
   */
  has(reference, version) {
    const db = DatabaseService.getDb();
    const row = db.prepare('SELECT 1 FROM bible_verses WHERE key = ?').get(createKey(reference, version));
    return !!row;
  },

  /**
   * Gets a verse from cache
   * @param {string} reference - Bible reference
   * @param {string} version - Bible version
   * @returns {Object|null} Cached verse or null
   */
  get(reference, version) {
    const db = DatabaseService.getDb();
    const row = db.prepare('SELECT * FROM bible_verses WHERE key = ?').get(createKey(reference, version));
    return row ? rowToVerse(row) : null;
  },

  /**
   * Gets a verse by its cache key
   * @param {string} key - Cache key
   * @returns {Object|null} Cached verse or null
   */
  getByKey(key) {
    const db = DatabaseService.getDb();
    const row = db.prepare('SELECT * FROM bible_verses WHERE key = ?').get(key);
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
    const book = extractBookName(verseData.reference);
    const timestamp = Date.now();

    db.prepare(`
      INSERT OR REPLACE INTO bible_verses (key, reference, version, version_name, text, book, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(key, verseData.reference, verseData.version, verseData.versionName || '', verseData.text || '', book, timestamp);

    return { ...verseData, key, book, timestamp };
  },

  /**
   * Removes a verse from cache
   * @param {string} key - Cache key to remove
   * @returns {boolean} Success status
   */
  remove(key) {
    const db = DatabaseService.getDb();
    const result = db.prepare('DELETE FROM bible_verses WHERE key = ?').run(key);
    return result.changes > 0;
  },

  /**
   * Clears all cached verses
   * @returns {boolean} Success status
   */
  clear() {
    const db = DatabaseService.getDb();
    db.prepare('DELETE FROM bible_verses').run();
    return true;
  },

  /**
   * Gets all cached verses organized by book in biblical order
   * @returns {Object} Verses grouped by book
   */
  getAllByBook() {
    const db = DatabaseService.getDb();
    const rows = db.prepare('SELECT * FROM bible_verses ORDER BY book, reference').all();

    const byBook = {};
    for (const row of rows) {
      const verse = rowToVerse(row);
      const book = verse.book || extractBookName(verse.reference);
      if (!byBook[book]) byBook[book] = [];
      byBook[book].push(verse);
    }

    const sortedBookNames = Object.keys(byBook).sort((a, b) => {
      const indexA = getBookIndex(a);
      const indexB = getBookIndex(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    const result = {};
    for (const book of sortedBookNames) {
      result[book] = byBook[book].sort(sortByChapterVerse);
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
      FROM bible_verses
    `).get();

    return {
      totalVerses: stats.totalVerses,
      oldestEntry: stats.totalVerses > 0 ? stats.oldestEntry : null,
      newestEntry: stats.totalVerses > 0 ? stats.newestEntry : null,
    };
  },
};

module.exports = CacheService;
