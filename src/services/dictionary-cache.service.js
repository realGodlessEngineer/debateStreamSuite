/**
 * Dictionary cache service
 * Handles persistent storage and retrieval of word definitions via SQLite
 * @module services/dictionary-cache
 */

const createLogger = require('../utils/logger');
const DatabaseService = require('./database.service');

const log = createLogger('DictCache');

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
 * Converts a database row to a definition object
 * @param {Object} row - Database row
 * @returns {Object} Definition object
 */
const rowToEntry = (row) => ({
  key: row.key,
  reference: row.reference,
  version: row.version,
  versionName: row.version_name,
  text: row.text,
  firstLetter: row.first_letter,
  phonetic: row.phonetic,
  etymology: row.etymology,
  audioUrl: row.audio_url,
  verses: safeParse(row.verses_json),
  totalVerses: row.total_verses,
  timestamp: row.timestamp,
});

/**
 * Dictionary Cache Service API
 */
const DictionaryCacheService = {
  /**
   * Loads cache (no-op for SQLite, kept for API compatibility)
   * @returns {boolean} Success status
   */
  load() {
    try {
      const db = DatabaseService.getDb();
      const count = db.prepare('SELECT COUNT(*) as count FROM dictionary_entries').get().count;
      log.info(`${count} cached definitions available`);
      return true;
    } catch (error) {
      log.error('Failed to access dictionary cache:', error.message);
      return false;
    }
  },

  /**
   * Checks if a word exists in cache
   * @param {string} word - Word to check
   * @param {string} lang - Language code
   * @returns {boolean} Exists in cache
   */
  has(word, lang) {
    const db = DatabaseService.getDb();
    const row = db.prepare('SELECT 1 FROM dictionary_entries WHERE key = ?').get(createKey(word, lang));
    return !!row;
  },

  /**
   * Gets a word from cache
   * @param {string} word - Word to get
   * @param {string} lang - Language code
   * @returns {Object|null} Cached definition or null
   */
  get(word, lang) {
    const db = DatabaseService.getDb();
    const row = db.prepare('SELECT * FROM dictionary_entries WHERE key = ?').get(createKey(word, lang));
    return row ? rowToEntry(row) : null;
  },

  /**
   * Gets a definition by its cache key
   * @param {string} key - Cache key
   * @returns {Object|null} Cached definition or null
   */
  getByKey(key) {
    const db = DatabaseService.getDb();
    const row = db.prepare('SELECT * FROM dictionary_entries WHERE key = ?').get(key);
    return row ? rowToEntry(row) : null;
  },

  /**
   * Adds a definition to cache
   * @param {Object} wordData - Definition data to cache
   * @returns {Object} Cached definition with metadata
   */
  add(wordData) {
    const db = DatabaseService.getDb();
    const key = createKey(wordData.reference, wordData.version);
    const firstLetter = extractFirstLetter(wordData.reference);
    const timestamp = Date.now();

    db.prepare(`
      INSERT OR REPLACE INTO dictionary_entries (key, reference, version, version_name, text, first_letter, phonetic, etymology, audio_url, verses_json, total_verses, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      key, wordData.reference, wordData.version, wordData.versionName || '',
      wordData.text || '', firstLetter, wordData.phonetic || '',
      wordData.etymology || '', wordData.audioUrl || '',
      wordData.verses ? JSON.stringify(wordData.verses) : '[]',
      wordData.totalVerses || 0, timestamp
    );

    return { ...wordData, key, firstLetter, timestamp };
  },

  /**
   * Removes a definition from cache
   * @param {string} key - Cache key to remove
   * @returns {boolean} Success status
   */
  remove(key) {
    const db = DatabaseService.getDb();
    const result = db.prepare('DELETE FROM dictionary_entries WHERE key = ?').run(key);
    return result.changes > 0;
  },

  /**
   * Clears all cached definitions
   * @returns {boolean} Success status
   */
  clear() {
    const db = DatabaseService.getDb();
    db.prepare('DELETE FROM dictionary_entries').run();
    return true;
  },

  /**
   * Gets all cached definitions organized by first letter A-Z
   * @returns {Object} Definitions grouped by letter
   */
  getAllByLetter() {
    const db = DatabaseService.getDb();
    const rows = db.prepare('SELECT * FROM dictionary_entries ORDER BY first_letter, reference').all();

    const byLetter = {};
    for (const row of rows) {
      const entry = rowToEntry(row);
      const letter = entry.firstLetter || extractFirstLetter(entry.reference);
      if (!byLetter[letter]) byLetter[letter] = [];
      byLetter[letter].push(entry);
    }

    const sortedLetters = Object.keys(byLetter).sort();

    const result = {};
    for (const letter of sortedLetters) {
      result[letter] = byLetter[letter].sort((a, b) =>
        a.reference.toLowerCase().localeCompare(b.reference.toLowerCase())
      );
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
      FROM dictionary_entries
    `).get();

    return {
      totalVerses: stats.totalVerses,
      oldestEntry: stats.totalVerses > 0 ? stats.oldestEntry : null,
      newestEntry: stats.totalVerses > 0 ? stats.newestEntry : null,
    };
  },
};

module.exports = DictionaryCacheService;
