/**
 * Lexicon service
 * Fetches Strong's number definitions from Bolls.life BDBT dictionary
 * @module services/lexicon
 */

const createLogger = require('../utils/logger');

const log = createLogger('Lexicon');

const BOLLS_BASE_URL = 'https://bolls.life';

/**
 * Strips HTML tags from a string, preserving text content
 * @param {string} html - HTML string
 * @returns {string} Plain text
 */
const stripHtml = (html) => {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '')
    .replace(/<li>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/**
 * Extracts the original word from the HTML definition
 * @param {string} definition - Raw HTML definition from API
 * @returns {string|null} Original word text
 */
const extractOriginalWord = (definition) => {
  const match = definition.match(/<(?:he|el)>([^<]+)<\/(?:he|el)>/);
  return match ? match[1] : null;
};

/**
 * Normalizes a Strong's number for API lookup
 * Ensures format like "H7225" or "G3056"
 * @param {string} strongs - Strong's number
 * @returns {string} Normalized number
 */
const normalizeStrongs = (strongs) => {
  const trimmed = strongs.trim().toUpperCase();
  if (/^[HG]\d+$/.test(trimmed)) return trimmed;
  // If just a number, can't determine prefix
  return trimmed;
};

/**
 * Lexicon Service API
 */
const LexiconService = {
  /**
   * Fetches a lexicon entry for a Strong's number
   * @param {string} strongsNumber - e.g., "H7225" or "G3056"
   * @returns {Promise<Object>} Lexicon entry
   */
  async fetch(strongsNumber) {
    const normalized = normalizeStrongs(strongsNumber);
    const url = `${BOLLS_BASE_URL}/dictionary-definition/BDBT/${normalized}/`;
    log.debug('Fetching lexicon entry:', url);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Lexicon API error: ${response.status} for ${normalized}`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error(`No lexicon entry found for ${normalized}`);
    }

    const entry = data[0];
    const originalWord = extractOriginalWord(entry.definition || '');

    return {
      strongsNumber: entry.topic || normalized,
      definition: entry.definition ? stripHtml(entry.definition) : '',
      definitionHtml: entry.definition || '',
      shortDefinition: entry.short_definition || '',
      transliteration: entry.transliteration || '',
      pronunciation: entry.pronunciation || '',
      lemma: entry.lexeme || originalWord || '',
    };
  },

  /**
   * Fetches lexicon entries for multiple Strong's numbers (batch with concurrency limit)
   * @param {string[]} strongsNumbers - Array of Strong's numbers
   * @param {number} concurrency - Max concurrent requests
   * @returns {Promise<Object>} Map of strongsNumber -> entry
   */
  async fetchBatch(strongsNumbers, concurrency = 5) {
    const unique = [...new Set(strongsNumbers.filter(Boolean))];
    const results = {};
    const queue = [...unique];

    const worker = async () => {
      while (queue.length > 0) {
        const strongs = queue.shift();
        try {
          results[strongs] = await this.fetch(strongs);
        } catch (error) {
          log.warn(`Failed to fetch lexicon entry for ${strongs}: ${error.message}`);
          results[strongs] = null;
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, unique.length) }, () => worker());
    await Promise.all(workers);

    return results;
  },

  /**
   * Checks if lexicon data has content
   * @param {Object} data - Lexicon entry
   * @returns {boolean}
   */
  hasContent(data) {
    return !!(data && (data.definition || data.shortDefinition));
  },
};

module.exports = LexiconService;
