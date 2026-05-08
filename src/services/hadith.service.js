/**
 * Hadith fetch service
 * Fetches hadith narrations from fawazahmed0/hadith-api (English editions)
 * @module services/hadith
 */

const createLogger = require('../utils/logger');

const log = createLogger('Hadith');

const BASE_URL = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions';

/**
 * Map of normalized collection slug → API edition key + display name
 * Aliases (alternate spellings) all collapse to the same canonical slug.
 */
const COLLECTIONS = Object.freeze({
  bukhari:    { edition: 'eng-bukhari',  name: 'Sahih al-Bukhari' },
  muslim:     { edition: 'eng-muslim',   name: 'Sahih Muslim' },
  abudawud:   { edition: 'eng-abudawud', name: 'Sunan Abi Dawud' },
  tirmidhi:   { edition: 'eng-tirmidhi', name: 'Jami at-Tirmidhi' },
  ibnmajah:   { edition: 'eng-ibnmajah', name: 'Sunan Ibn Majah' },
  nasai:      { edition: 'eng-nasai',    name: "Sunan an-Nasa'i" },
  malik:      { edition: 'eng-malik',    name: 'Muwatta Malik' },
  nawawi:     { edition: 'eng-nawawi',   name: 'Forty Hadith of an-Nawawi' },
  qudsi:      { edition: 'eng-qudsi',    name: 'Forty Hadith Qudsi' },
});

const ALIASES = Object.freeze({
  'sahihbukhari':    'bukhari',
  'sahihalbukhari':  'bukhari',
  'sahihmuslim':     'muslim',
  'abudaud':         'abudawud',
  'abudawood':       'abudawud',
  'sunanabidawud':   'abudawud',
  'sunanabudawud':   'abudawud',
  'tirmidi':         'tirmidhi',
  'jamitirmidhi':    'tirmidhi',
  'jamiattirmidhi':  'tirmidhi',
  'ibnumajah':       'ibnmajah',
  'sunanibnmajah':   'ibnmajah',
  'annasai':         'nasai',
  'sunannasai':      'nasai',
  'sunanannasai':    'nasai',
  'muwatta':         'malik',
  'muwattamalik':    'malik',
  'fortyhadith':     'nawawi',
  'nawawi40':        'nawawi',
  'qudsi40':         'qudsi',
});

/**
 * Normalizes a collection name to a canonical slug
 * @param {string} name - Raw collection name (any case, with/without spaces/punctuation)
 * @returns {string|null} Canonical slug (e.g., 'bukhari') or null
 */
const resolveCollection = (name) => {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (COLLECTIONS[normalized]) return normalized;
  if (ALIASES[normalized]) return ALIASES[normalized];
  return null;
};

/**
 * Parses a hadith reference into structured components
 * Accepts: "bukhari 3208", "muslim 2662c", "Sahih Muslim 2662", "abu dawud 100",
 *          "bukhari:3208", "Ibn Majah 1"
 * Suffix letters (e.g., "2662c") are preserved in the canonical reference but
 * stripped when looking up the source data, since fawazahmed0/hadith-api uses
 * integer hadithnumbers without sub-narration suffixes.
 *
 * @param {string} input - Raw reference string
 * @returns {Object|null} { collection, hadithNumber, lookupNumber } or null
 */
const parseReference = (input) => {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();

  const match = trimmed.match(/^([A-Za-z][A-Za-z'\s-]*?)\s*[:\s]\s*(\d{1,5})([a-z])?\s*$/i);
  if (!match) return null;

  const slug = resolveCollection(match[1]);
  if (!slug) return null;

  const baseNumber = match[2];
  const suffix = match[3] ? match[3].toLowerCase() : '';

  return {
    collection: slug,
    hadithNumber: baseNumber + suffix,
    lookupNumber: baseNumber,
  };
};

/**
 * Builds a human-readable reference string
 * @param {string} collection - Canonical collection slug
 * @param {string} hadithNumber - Hadith number (with optional letter suffix)
 * @returns {string} e.g., "Sahih al-Bukhari 3208"
 */
const buildReference = (collection, hadithNumber) => {
  const meta = COLLECTIONS[collection];
  return `${meta.name} ${hadithNumber}`;
};

/**
 * Splits a hadith narration into display chunks at sentence boundaries.
 * Targets ~280 chars per chunk so the OBS pagination (3 chunks/page) reads cleanly.
 * @param {string} text - Full narration text
 * @returns {string[]} Array of chunked text segments
 */
const chunkText = (text) => {
  const TARGET = 280;
  const MIN_LAST = 80;

  const sentences = text
    .split(/(?<=[.!?])\s+(?=[A-Z"'(])/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length === 0) return [text];

  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    if (!current) {
      current = sentence;
      continue;
    }
    if (current.length + 1 + sentence.length <= TARGET) {
      current += ' ' + sentence;
    } else {
      chunks.push(current);
      current = sentence;
    }
  }
  if (current) chunks.push(current);

  // Merge a tiny trailing chunk back into the previous one
  if (chunks.length >= 2 && chunks[chunks.length - 1].length < MIN_LAST) {
    const tail = chunks.pop();
    chunks[chunks.length - 1] += ' ' + tail;
  }

  return chunks;
};

/**
 * Normalizes the API response into the standard verse-shaped format used by displays
 * @param {Object} apiData - Raw response from hadith-api
 * @param {Object} ref - Parsed reference
 * @returns {Object} Normalized hadith data
 */
const normalizeResponse = (apiData, ref) => {
  const meta = COLLECTIONS[ref.collection];
  const hadith = (apiData.hadiths && apiData.hadiths[0]) || null;
  if (!hadith) {
    throw new Error(`Hadith ${ref.hadithNumber} not found in ${meta.name}`);
  }

  const reference = buildReference(ref.collection, ref.hadithNumber);
  const chunks = chunkText(hadith.text || '');
  const verses = chunks.map((chunk, idx) => ({
    number: idx === 0 ? String(ref.hadithNumber) : '',
    text: chunk,
  }));

  const sectionId = hadith.reference && hadith.reference.book;
  const sectionName = sectionId && apiData.metadata && apiData.metadata.section
    ? apiData.metadata.section[String(sectionId)]
    : null;

  return {
    reference,
    version: meta.edition,
    versionName: `${meta.name} (English)`,
    text: hadith.text || '',
    verses,
    totalVerses: verses.length,
    collection: ref.collection,
    collectionName: meta.name,
    hadithNumber: ref.hadithNumber,
    arabicNumber: hadith.arabicnumber != null ? String(hadith.arabicnumber) : '',
    grades: Array.isArray(hadith.grades) ? hadith.grades : [],
    bookNumber: sectionId || null,
    bookName: sectionName || '',
    hadithInBook: hadith.reference && hadith.reference.hadith != null
      ? Number(hadith.reference.hadith)
      : null,
  };
};

/**
 * Hadith Service API
 */
const HadithService = {
  /**
   * Fetches a hadith by reference string
   * @param {string} reference - e.g., "bukhari 3208" or "muslim 2662c"
   * @returns {Promise<Object>} Normalized hadith data
   * @throws {Error} On invalid reference, network failure, or missing hadith
   */
  async fetch(reference) {
    const parsed = parseReference(reference);
    if (!parsed) {
      throw new Error(`Invalid hadith reference: "${reference}". Use format: collection number (e.g., bukhari 3208, muslim 2662c)`);
    }

    const meta = COLLECTIONS[parsed.collection];
    const url = `${BASE_URL}/${meta.edition}/${parsed.lookupNumber}.json`;
    log.debug('Fetching hadith:', url);

    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404 || response.status === 403) {
        throw new Error(`Hadith ${parsed.hadithNumber} not found in ${meta.name}`);
      }
      throw new Error(`Hadith API error: ${response.status}`);
    }

    const json = await response.json();
    return normalizeResponse(json, parsed);
  },

  /**
   * Validates that a hadith response has content
   * @param {Object} hadithData - Normalized hadith data
   * @returns {boolean}
   */
  hasContent(hadithData) {
    return !!(hadithData && hadithData.text && hadithData.verses && hadithData.verses.length > 0);
  },

  /**
   * Returns the canonical collection metadata for a slug
   * @param {string} slug - Canonical collection slug
   * @returns {Object|null} { edition, name } or null
   */
  getCollection(slug) {
    return COLLECTIONS[slug] || null;
  },

  /**
   * Returns the list of supported collections
   * @returns {Array<{slug: string, name: string}>}
   */
  listCollections() {
    return Object.entries(COLLECTIONS).map(([slug, meta]) => ({ slug, name: meta.name }));
  },

  /**
   * Parses a reference string (exposed for validation in routes)
   * @param {string} input - Raw reference string
   * @returns {Object|null} Parsed reference or null
   */
  parseReference,

  /**
   * Splits a hadith narration into display-sized chunks at sentence boundaries
   * (exposed so the cache service can re-chunk on read without re-fetching).
   * @param {string} text - Full narration text
   * @returns {string[]} Array of chunked text segments
   */
  chunkText,
};

module.exports = HadithService;
