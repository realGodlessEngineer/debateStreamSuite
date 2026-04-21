/**
 * Interlinear cache service
 * Handles persistent storage of interlinear passages and lexicon entries via SQLite
 * @module services/interlinear-cache
 */

const { BIBLE_BOOK_ORDER } = require('../config/constants');
const createLogger = require('../utils/logger');
const DatabaseService = require('./database.service');

const log = createLogger('InterlinearCache');

/**
 * Generates a cache key from reference and language
 * @param {string} reference - Bible reference
 * @param {string} language - 'hebrew' or 'greek'
 * @returns {string} Cache key
 */
const createKey = (reference, language) => `${reference}|${language}`;

/**
 * Safely parses JSON with a fallback
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
 * Converts a database row to a passage object
 * @param {Object} row - Database row
 * @returns {Object} Passage object
 */
const rowToPassage = (row) => ({
  key: row.key,
  reference: row.reference,
  language: row.language,
  book: row.book,
  words: safeParse(row.words_json),
  totalWords: row.total_words,
  timestamp: row.timestamp,
});

/**
 * Converts a database row to a lexicon entry
 * @param {Object} row - Database row
 * @returns {Object} Lexicon entry
 */
const rowToLexicon = (row) => ({
  strongsNumber: row.strongs_number,
  definition: row.definition,
  shortDefinition: row.short_definition,
  transliteration: row.transliteration,
  pronunciation: row.pronunciation,
  lemma: row.lemma,
  aiGloss: row.ai_gloss || null,
  timestamp: row.timestamp,
});

/**
 * Gets the canonical book index for sorting
 * @param {string} bookName - Book name
 * @returns {number} Index or 999 if not found
 */
const getBookIndex = (bookName) => {
  const idx = BIBLE_BOOK_ORDER.indexOf(bookName);
  return idx >= 0 ? idx : 999;
};

/**
 * Interlinear Cache Service API
 */
const InterlinearCacheService = {
  /**
   * Loads cache (logs count for diagnostics)
   * @returns {boolean} Success status
   */
  load() {
    try {
      const db = DatabaseService.getDb();
      const passageCount = db.prepare('SELECT COUNT(*) as count FROM interlinear_passages').get().count;
      const lexiconCount = db.prepare('SELECT COUNT(*) as count FROM lexicon_entries').get().count;
      log.info(`${passageCount} cached interlinear passages, ${lexiconCount} lexicon entries available`);
      return true;
    } catch (error) {
      log.error('Failed to access interlinear cache:', error.message);
      return false;
    }
  },

  // ========================================
  // Passage Cache
  // ========================================

  /**
   * Gets a passage from cache
   * @param {string} reference - Bible reference
   * @param {string} language - 'hebrew' or 'greek'
   * @returns {Object|null} Cached passage or null
   */
  getPassage(reference, language) {
    const db = DatabaseService.getDb();
    const row = db.prepare('SELECT * FROM interlinear_passages WHERE key = ?').get(createKey(reference, language));
    return row ? rowToPassage(row) : null;
  },

  /**
   * Gets a passage by its cache key
   * @param {string} key - Cache key
   * @returns {Object|null} Cached passage or null
   */
  getPassageByKey(key) {
    const db = DatabaseService.getDb();
    const row = db.prepare('SELECT * FROM interlinear_passages WHERE key = ?').get(key);
    return row ? rowToPassage(row) : null;
  },

  /**
   * Adds a passage to cache
   * @param {Object} data - Interlinear passage data
   * @returns {Object} Cached passage with metadata
   */
  addPassage(data) {
    const db = DatabaseService.getDb();
    const key = createKey(data.reference, data.language);
    const timestamp = Date.now();

    db.prepare(`
      INSERT OR REPLACE INTO interlinear_passages (key, reference, language, book, words_json, total_words, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      key, data.reference, data.language, data.book || '',
      JSON.stringify(data.words || []),
      data.totalWords || 0, timestamp
    );

    return { ...data, key, timestamp };
  },

  /**
   * Removes a passage from cache
   * @param {string} key - Cache key
   * @returns {boolean} Success status
   */
  removePassage(key) {
    const db = DatabaseService.getDb();
    const result = db.prepare('DELETE FROM interlinear_passages WHERE key = ?').run(key);
    return result.changes > 0;
  },

  /**
   * Clears all cached passages
   * @returns {boolean}
   */
  clearPassages() {
    const db = DatabaseService.getDb();
    db.prepare('DELETE FROM interlinear_passages').run();
    return true;
  },

  /**
   * Gets all cached passages organized by book in canonical order
   * @returns {Object} Passages grouped by book
   */
  getAllByBook() {
    const db = DatabaseService.getDb();
    const rows = db.prepare('SELECT * FROM interlinear_passages ORDER BY book, reference').all();

    const byBook = {};
    for (const row of rows) {
      const passage = rowToPassage(row);
      const book = passage.book || 'Unknown';
      if (!byBook[book]) byBook[book] = [];
      byBook[book].push(passage);
    }

    const sortedBooks = Object.keys(byBook).sort((a, b) => getBookIndex(a) - getBookIndex(b));
    const result = {};
    for (const book of sortedBooks) {
      result[book] = byBook[book];
    }
    return result;
  },

  /**
   * Gets passage cache statistics
   * @returns {Object} Cache stats
   */
  getPassageStats() {
    const db = DatabaseService.getDb();
    const stats = db.prepare(`
      SELECT COUNT(*) as total, MIN(timestamp) as oldest, MAX(timestamp) as newest
      FROM interlinear_passages
    `).get();

    return {
      totalPassages: stats.total,
      oldestEntry: stats.total > 0 ? stats.oldest : null,
      newestEntry: stats.total > 0 ? stats.newest : null,
    };
  },

  // ========================================
  // Lexicon Cache
  // ========================================

  /**
   * Gets a lexicon entry from cache
   * @param {string} strongsNumber - e.g., "H7225"
   * @returns {Object|null} Cached entry or null
   */
  getLexicon(strongsNumber) {
    const db = DatabaseService.getDb();
    const row = db.prepare('SELECT * FROM lexicon_entries WHERE strongs_number = ?').get(strongsNumber);
    return row ? rowToLexicon(row) : null;
  },

  /**
   * Adds a lexicon entry to cache
   * @param {Object} data - Lexicon entry data
   * @returns {Object} Cached entry
   */
  addLexicon(data) {
    const db = DatabaseService.getDb();
    const timestamp = Date.now();

    db.prepare(`
      INSERT OR REPLACE INTO lexicon_entries (strongs_number, definition, short_definition, transliteration, pronunciation, lemma, response_json, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.strongsNumber, data.definition || '', data.shortDefinition || '',
      data.transliteration || '', data.pronunciation || '', data.lemma || '',
      JSON.stringify(data), timestamp
    );

    return { ...data, timestamp };
  },

  /**
   * Adds multiple lexicon entries in a transaction
   * @param {Object} entriesMap - Map of strongsNumber -> entry
   */
  addLexiconBatch(entriesMap) {
    const db = DatabaseService.getDb();
    const insert = db.prepare(`
      INSERT OR REPLACE INTO lexicon_entries (strongs_number, definition, short_definition, transliteration, pronunciation, lemma, response_json, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const timestamp = Date.now();
    const insertMany = db.transaction((entries) => {
      for (const [strongs, data] of entries) {
        if (!data) continue;
        insert.run(
          data.strongsNumber || strongs, data.definition || '', data.shortDefinition || '',
          data.transliteration || '', data.pronunciation || '', data.lemma || '',
          JSON.stringify(data), timestamp
        );
      }
    });

    insertMany(Object.entries(entriesMap));
  },

  /**
   * Clears all lexicon entries
   * @returns {boolean}
   */
  clearLexicon() {
    const db = DatabaseService.getDb();
    db.prepare('DELETE FROM lexicon_entries').run();
    return true;
  },
};

module.exports = InterlinearCacheService;
