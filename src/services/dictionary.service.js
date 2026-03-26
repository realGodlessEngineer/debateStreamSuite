/**
 * Free Dictionary API service
 * Fetches and normalizes word definitions from dictionaryapi.dev
 * @module services/dictionary
 */

const createLogger = require('../utils/logger');

const log = createLogger('Dictionary');

const BASE_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en';

/**
 * Capitalizes the first letter of a word
 * @param {string} word - Word to capitalize
 * @returns {string} Capitalized word
 */
const capitalize = (word) => word.charAt(0).toUpperCase() + word.slice(1);

/**
 * Extracts the first available audio URL from phonetics
 * @param {Array} phonetics - Phonetics array from API
 * @returns {string} Audio URL or empty string
 */
const extractAudioUrl = (phonetics) => {
  if (!Array.isArray(phonetics)) return '';
  const withAudio = phonetics.find((p) => p.audio && p.audio.length > 0);
  return withAudio ? withAudio.audio : '';
};

/**
 * Extracts phonetic text from API response
 * @param {Object} entry - API entry object
 * @returns {string} Phonetic string or empty
 */
const extractPhonetic = (entry) => {
  if (entry.phonetic) return entry.phonetic;
  if (Array.isArray(entry.phonetics)) {
    const withText = entry.phonetics.find((p) => p.text);
    return withText ? withText.text : '';
  }
  return '';
};

/**
 * Flattens API meanings into the verse format
 * Each definition becomes a verse with part-of-speech as the number
 * @param {Array} entries - Array of API entry objects
 * @returns {Array} Array of { number, text } objects
 */
const flattenDefinitions = (entries) => {
  // Collect all meanings across entries (API can return multiple entries)
  const allMeanings = entries.flatMap((entry) => entry.meanings || []);

  // Count definitions per part of speech for indexed labels
  const posCounts = {};
  const verses = [];

  for (const meaning of allMeanings) {
    const pos = meaning.partOfSpeech || 'unknown';
    const defs = meaning.definitions || [];

    if (!posCounts[pos]) posCounts[pos] = 0;

    for (const def of defs) {
      posCounts[pos]++;
      let text = def.definition;

      if (def.example) {
        text += ` (e.g., "${def.example}")`;
      }

      verses.push({ pos, index: posCounts[pos], text });
    }
  }

  // Build final verse labels: "noun" if only one, "noun 1"/"noun 2" if multiple
  return verses.map((v) => ({
    number: posCounts[v.pos] > 1 ? `${v.pos} ${v.index}` : v.pos,
    text: v.text,
  }));
};

/**
 * Normalizes API response into the standard verse display format
 * @param {Array} entries - Raw API response (array of entry objects)
 * @returns {Object} Normalized data
 */
const normalizeResponse = (entries) => {
  const primary = entries[0];
  const word = capitalize(primary.word);
  const verses = flattenDefinitions(entries);

  return {
    reference: word,
    version: 'en',
    versionName: 'Dictionary',
    text: verses.map((v) => `${v.number}: ${v.text}`).join(' | '),
    verses,
    totalVerses: verses.length,
    phonetic: extractPhonetic(primary),
    etymology: primary.origin || '',
    audioUrl: extractAudioUrl(primary.phonetics),
  };
};

/**
 * Dictionary Service API
 */
const DictionaryService = {
  /**
   * Fetches a word definition from the Free Dictionary API
   * @param {string} word - Word to look up
   * @returns {Promise<Object>} Normalized definition data
   * @throws {Error} On invalid word, not found, or fetch failure
   */
  async fetch(word) {
    const trimmed = word.trim().toLowerCase();

    if (!trimmed) {
      throw new Error('Please enter a word to look up.');
    }

    if (trimmed.length > 50) {
      throw new Error('Word is too long (max 50 characters).');
    }

    const url = `${BASE_URL}/${encodeURIComponent(trimmed)}`;
    log.debug('Fetching:', url);

    const response = await fetch(url);

    if (response.status === 404) {
      throw new Error(`Word not found: "${word}". Check the spelling.`);
    }

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error(`No definitions found for "${word}".`);
    }

    return normalizeResponse(data);
  },

  /**
   * Validates a definition response has content
   * @param {Object} data - Normalized definition data
   * @returns {boolean} Has valid content
   */
  hasContent(data) {
    return !!(data.text || (data.verses && data.verses.length > 0));
  },

  /**
   * Gets the default version/language code
   * @returns {string} Default version
   */
  getDefaultVersion() {
    return 'en';
  },
};

module.exports = DictionaryService;
