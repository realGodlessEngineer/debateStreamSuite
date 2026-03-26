/**
 * Fallacy database service
 * Handles loading and querying the logical fallacies database via SQLite
 * @module services/fallacy
 */

const createLogger = require('../utils/logger');
const DatabaseService = require('./database.service');

const log = createLogger('Fallacy');

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
 * Converts a database row to a fallacy object
 * @param {Object} row - Database row
 * @returns {Object} Fallacy object
 */
const rowToFallacy = (row) => ({
  name: row.name,
  slug: row.slug,
  definition: row.definition,
  aliases: safeParse(row.aliases_json),
  url: row.url,
  scrapedAt: row.scraped_at,
});

const FallacyService = {
  /**
   * Loads fallacies (validates table access, kept for API compatibility)
   * @returns {boolean} Success status
   */
  load() {
    try {
      const db = DatabaseService.getDb();
      const count = db.prepare('SELECT COUNT(*) as count FROM fallacies').get().count;
      log.info(`${count} fallacies available`);
      return true;
    } catch (error) {
      log.error('Failed to access fallacies:', error.message);
      return false;
    }
  },

  /**
   * Gets all fallacies sorted alphabetically
   * @returns {Array} Array of fallacy objects
   */
  getAll() {
    const db = DatabaseService.getDb();
    const rows = db.prepare('SELECT * FROM fallacies ORDER BY name COLLATE NOCASE').all();
    return rows.map(rowToFallacy);
  },

  /**
   * Gets a fallacy by its slug
   * @param {string} slug - URL slug
   * @returns {Object|null} Fallacy or null
   */
  getBySlug(slug) {
    const db = DatabaseService.getDb();
    const row = db.prepare('SELECT * FROM fallacies WHERE slug = ?').get(slug);
    return row ? rowToFallacy(row) : null;
  },

  /**
   * Searches fallacies by name, definition, or aliases
   * @param {string} query - Search query
   * @returns {Array} Matching fallacies
   */
  search(query) {
    if (!query) return this.getAll();

    const db = DatabaseService.getDb();
    const escaped = query.toLowerCase().replace(/[%_]/g, '\\$&');
    const term = `%${escaped}%`;

    const rows = db.prepare(`
      SELECT * FROM fallacies
      WHERE LOWER(name) LIKE ? ESCAPE '\\' OR LOWER(definition) LIKE ? ESCAPE '\\' OR LOWER(aliases_json) LIKE ? ESCAPE '\\'
      ORDER BY
        CASE WHEN LOWER(name) LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END,
        name COLLATE NOCASE
    `).all(term, term, term, term);

    return rows.map(rowToFallacy);
  },

  /**
   * Gets count of fallacies
   * @returns {number} Total count
   */
  getCount() {
    const db = DatabaseService.getDb();
    return db.prepare('SELECT COUNT(*) as count FROM fallacies').get().count;
  },
};

module.exports = FallacyService;
