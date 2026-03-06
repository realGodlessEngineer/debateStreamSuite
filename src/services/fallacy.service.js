/**
 * Fallacy database service
 * Handles loading and querying the logical fallacies database
 * @module services/fallacy
 */

const fs = require('fs');
const { SERVER } = require('../config/constants');
const createLogger = require('../utils/logger');

const log = createLogger('Fallacy');

// In-memory fallacy store
let fallacies = {};

const FallacyService = {
  /**
   * Loads fallacies from disk (synchronous, called at startup only)
   * @returns {boolean} Success status
   */
  load() {
    try {
      if (fs.existsSync(SERVER.FALLACY_DB_FILE)) {
        const data = fs.readFileSync(SERVER.FALLACY_DB_FILE, 'utf8');
        fallacies = JSON.parse(data);
        log.info(`Loaded ${Object.keys(fallacies).length} fallacies`);
        return true;
      }
      log.warn('Fallacy database not found. Run: node src/scripts/scrape-fallacies.js');
      return false;
    } catch (error) {
      log.error('Error loading fallacies:', error.message);
      fallacies = {};
      return false;
    }
  },

  /**
   * Gets all fallacies sorted alphabetically
   * @returns {Array} Array of fallacy objects
   */
  getAll() {
    return Object.values(fallacies).sort((a, b) => a.name.localeCompare(b.name));
  },

  /**
   * Gets a fallacy by its slug
   * @param {string} slug - URL slug
   * @returns {Object|null} Fallacy or null
   */
  getBySlug(slug) {
    return fallacies[slug] || null;
  },

  /**
   * Searches fallacies by name, definition, or aliases
   * @param {string} query - Search query
   * @returns {Array} Matching fallacies
   */
  search(query) {
    if (!query) return this.getAll();

    const term = query.toLowerCase();
    return Object.values(fallacies)
      .filter((f) => {
        return (
          f.name.toLowerCase().includes(term) ||
          f.definition.toLowerCase().includes(term) ||
          f.aliases.some((a) => a.toLowerCase().includes(term))
        );
      })
      .sort((a, b) => {
        // Prioritize name matches
        const aNameMatch = a.name.toLowerCase().includes(term);
        const bNameMatch = b.name.toLowerCase().includes(term);
        if (aNameMatch && !bNameMatch) return -1;
        if (!aNameMatch && bNameMatch) return 1;
        return a.name.localeCompare(b.name);
      });
  },

  /**
   * Gets count of fallacies
   * @returns {number} Total count
   */
  getCount() {
    return Object.keys(fallacies).length;
  },
};

module.exports = FallacyService;
