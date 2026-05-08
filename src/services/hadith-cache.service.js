/**
 * Hadith cache service
 * Persistent storage of fetched hadith narrations via SQLite
 * @module services/hadith-cache
 */

const createLogger = require('../utils/logger');
const DatabaseService = require('./database.service');
const HadithService = require('./hadith.service');

const log = createLogger('HadithCache');

/**
 * Generates a cache key from collection slug and hadith number
 * Mirrors the (reference, version) pattern used by other caches but uses the
 * collection slug + canonical number, so "bukhari 3208" and "Sahih al-Bukhari 3208"
 * collapse to the same key.
 *
 * @param {string} collection - Canonical collection slug
 * @param {string} hadithNumber - Hadith number with optional letter suffix
 * @returns {string} Cache key
 */
const createKey = (collection, hadithNumber) => `${collection}|${hadithNumber}`;

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
 * Rebuilds the chunked verses array from the stored full text
 * @param {string} text - Full narration text
 * @param {string} hadithNumber - Hadith number for the first chunk's verse marker
 * @returns {Array<{number: string, text: string}>}
 */
const rebuildVerses = (text, hadithNumber) => {
  return HadithService.chunkText(text).map((chunk, idx) => ({
    number: idx === 0 ? String(hadithNumber) : '',
    text: chunk,
  }));
};

/**
 * Converts a database row to a hadith object
 * @param {Object} row - Database row
 * @returns {Object} Hadith object
 */
const rowToHadith = (row) => {
  const meta = HadithService.getCollection(row.collection);
  const versionName = meta ? `${meta.name} (English)` : row.collection_name;
  return {
    key: row.key,
    reference: row.reference,
    version: meta ? meta.edition : `eng-${row.collection}`,
    versionName,
    text: row.text,
    verses: rebuildVerses(row.text, row.hadith_number),
    totalVerses: undefined,
    collection: row.collection,
    collectionName: row.collection_name,
    hadithNumber: row.hadith_number,
    arabicNumber: row.arabic_number || '',
    grades: safeParse(row.grades_json, []),
    bookNumber: row.book_number,
    bookName: row.book_name,
    hadithInBook: row.hadith_in_book,
    timestamp: row.timestamp,
  };
};

/**
 * Hadith Cache Service API
 */
const HadithCacheService = {
  /**
   * Reports availability of cached hadiths
   * @returns {boolean} Success status
   */
  load() {
    try {
      const db = DatabaseService.getDb();
      const count = db.prepare('SELECT COUNT(*) as count FROM hadiths').get().count;
      log.info(`${count} cached hadiths available`);
      return true;
    } catch (error) {
      log.error('Failed to access hadith cache:', error.message);
      return false;
    }
  },

  /**
   * Gets a hadith from cache by collection + number
   * @param {string} collection - Canonical collection slug
   * @param {string} hadithNumber - Hadith number with optional suffix
   * @returns {Object|null} Cached hadith or null
   */
  get(collection, hadithNumber) {
    const db = DatabaseService.getDb();
    const row = db.prepare('SELECT * FROM hadiths WHERE key = ?').get(createKey(collection, hadithNumber));
    if (!row) return null;
    const hadith = rowToHadith(row);
    hadith.totalVerses = hadith.verses.length;
    return hadith;
  },

  /**
   * Gets a hadith by its cache key
   * @param {string} key - Cache key
   * @returns {Object|null} Cached hadith or null
   */
  getByKey(key) {
    const db = DatabaseService.getDb();
    const row = db.prepare('SELECT * FROM hadiths WHERE key = ?').get(key);
    if (!row) return null;
    const hadith = rowToHadith(row);
    hadith.totalVerses = hadith.verses.length;
    return hadith;
  },

  /**
   * Adds a hadith to the cache
   * @param {Object} hadithData - Normalized hadith data
   * @returns {Object} Cached hadith with metadata
   */
  add(hadithData) {
    const db = DatabaseService.getDb();
    const key = createKey(hadithData.collection, hadithData.hadithNumber);
    const timestamp = Date.now();

    db.prepare(`
      INSERT OR REPLACE INTO hadiths (
        key, reference, collection, collection_name, hadith_number,
        text, arabic_number, grades_json, book_number, book_name, hadith_in_book, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      key,
      hadithData.reference,
      hadithData.collection,
      hadithData.collectionName,
      hadithData.hadithNumber,
      hadithData.text || '',
      hadithData.arabicNumber || '',
      JSON.stringify(hadithData.grades || []),
      hadithData.bookNumber || null,
      hadithData.bookName || '',
      hadithData.hadithInBook != null ? hadithData.hadithInBook : null,
      timestamp
    );

    return { ...hadithData, key, timestamp };
  },

  /**
   * Removes a hadith from cache by key
   * @param {string} key - Cache key
   * @returns {boolean} Success status
   */
  remove(key) {
    const db = DatabaseService.getDb();
    const result = db.prepare('DELETE FROM hadiths WHERE key = ?').run(key);
    return result.changes > 0;
  },

  /**
   * Clears all cached hadiths
   * @returns {boolean} Success status
   */
  clear() {
    const db = DatabaseService.getDb();
    db.prepare('DELETE FROM hadiths').run();
    return true;
  },

  /**
   * Gets all cached hadiths grouped by collection in canonical order
   * @returns {Object} Hadiths grouped by collection display name
   */
  getAllByCollection() {
    const db = DatabaseService.getDb();
    const rows = db.prepare(`
      SELECT * FROM hadiths
      ORDER BY collection,
        CAST(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(hadith_number, 'a', ''), 'b', ''), 'c', ''), 'd', ''), 'e', ''), 'f', ''), 'g', ''), 'h', ''), 'i', ''), 'j', ''), 'k', ''), 'l', ''), 'm', ''), 'n', ''), 'o', ''), 'p', ''), 'q', ''), 'r', ''), 's', ''), 't', ''), 'u', ''), 'v', ''), 'w', ''), 'x', ''), 'y', ''), 'z', '') AS INTEGER),
        hadith_number
    `).all();

    const ordered = HadithService.listCollections();
    const slugOrder = new Map(ordered.map((c, idx) => [c.slug, idx]));

    const byCollection = {};
    for (const row of rows) {
      const hadith = rowToHadith(row);
      hadith.totalVerses = hadith.verses.length;
      const label = row.collection_name;
      if (!byCollection[label]) byCollection[label] = { _slug: row.collection, items: [] };
      byCollection[label].items.push(hadith);
    }

    const labels = Object.keys(byCollection).sort((a, b) => {
      const ai = slugOrder.has(byCollection[a]._slug) ? slugOrder.get(byCollection[a]._slug) : Infinity;
      const bi = slugOrder.has(byCollection[b]._slug) ? slugOrder.get(byCollection[b]._slug) : Infinity;
      return ai - bi || a.localeCompare(b);
    });

    const result = {};
    for (const label of labels) {
      result[label] = byCollection[label].items;
    }
    return result;
  },

  /**
   * Returns cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    const db = DatabaseService.getDb();
    const stats = db.prepare(`
      SELECT COUNT(*) as totalHadiths, MIN(timestamp) as oldestEntry, MAX(timestamp) as newestEntry
      FROM hadiths
    `).get();

    return {
      totalHadiths: stats.totalHadiths,
      oldestEntry: stats.totalHadiths > 0 ? stats.oldestEntry : null,
      newestEntry: stats.totalHadiths > 0 ? stats.newestEntry : null,
    };
  },
};

module.exports = HadithCacheService;
