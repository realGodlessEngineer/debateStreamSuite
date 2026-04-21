/**
 * Interlinear text analysis service
 * Fetches Hebrew (OT via morphhb) and Greek (NT via Bolls.life) interlinear data
 * @module services/interlinear
 */

const { lookupBook } = require('../config/bible-books-map');
const DatabaseService = require('./database.service');
const { importMorphhb } = require('../scripts/import-morphhb');
const createLogger = require('../utils/logger');

const log = createLogger('Interlinear');

let hebrewQuery = null;

/**
 * Ensures hebrew_words table is populated, importing from morphhb if needed.
 * Lazily initializes the prepared query statement.
 */
const ensureHebrewData = () => {
  if (hebrewQuery) return;

  const db = DatabaseService.getDb();
  const count = db.prepare('SELECT COUNT(*) as count FROM hebrew_words').get().count;

  if (count === 0) {
    log.info('hebrew_words table is empty, importing morphhb data...');
    const total = importMorphhb(db);
    log.info(`Imported ${total} Hebrew words into SQLite`);
  }

  hebrewQuery = db.prepare(
    'SELECT hebrew, strongs, morph, position FROM hebrew_words WHERE book = ? AND chapter = ? AND verse = ? ORDER BY position'
  );
};

const BOLLS_BASE_URL = 'https://bolls.life';

/**
 * Parses a Bible reference into structured components
 * Accepts: "Genesis 1:1", "John 3:16-18", "1 Samuel 1:1-5", "Psalm 23:1"
 * @param {string} input - Raw reference string
 * @returns {Object|null} { book, chapter, startVerse, endVerse } or null
 */
const parseReference = (input) => {
  const trimmed = input.trim();

  // Pattern: optional numbered prefix + book name, chapter:verse or chapter:start-end
  const match = trimmed.match(
    /^(\d?\s*[A-Za-z][A-Za-z\s]+?)\s+(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?$/
  );

  if (!match) return null;

  const bookName = match[1].trim();
  const bookData = lookupBook(bookName);
  if (!bookData) return null;

  return {
    book: bookData.canonical,
    chapter: parseInt(match[2], 10),
    startVerse: parseInt(match[3], 10),
    endVerse: match[4] ? parseInt(match[4], 10) : parseInt(match[3], 10),
    testament: bookData.testament,
    morphhbKey: bookData.morphhbKey,
    bollsNumber: bookData.bollsNumber,
  };
};

/**
 * Extracts the primary Strong's number from a morphhb strong field
 * e.g., "Hb/H7225" -> "H7225", "H1254" -> "H1254", "Hc/H853" -> "H853"
 * @param {string} strongsField - Raw strongs field from morphhb
 * @returns {string} Primary Strong's number
 */
const extractStrongsNumber = (strongsField) => {
  const parts = strongsField.split('/');
  // Find the part that starts with H (Hebrew Strong's)
  for (const part of parts) {
    if (/^H\d+$/.test(part)) return part;
  }
  return parts[parts.length - 1];
};

/**
 * Extracts morphology code from morphhb morph field
 * e.g., "R/Ncfsa" -> "R/Ncfsa", "Vqp3ms" -> "Vqp3ms"
 * @param {string} morphField - Raw morph field
 * @returns {string} Morphology code
 */
const extractMorphCode = (morphField) => morphField || '';

/**
 * Fetches Hebrew interlinear data from morphhb for OT passages
 * @param {Object} ref - Parsed reference
 * @returns {Object} Interlinear data
 */
const fetchHebrew = (ref) => {
  ensureHebrewData();

  const words = [];

  for (let v = ref.startVerse; v <= ref.endVerse; v++) {
    const rows = hebrewQuery.all(ref.morphhbKey, ref.chapter, v);
    if (rows.length === 0) {
      log.warn(`Verse ${v} not found for ${ref.book} ${ref.chapter}`);
      continue;
    }

    for (const row of rows) {
      words.push({
        original: row.hebrew.replace(/\//g, ''),
        originalWithMarks: row.hebrew,
        strongs: extractStrongsNumber(row.strongs),
        morph: extractMorphCode(row.morph),
        verseNum: v,
      });
    }
  }

  return {
    reference: buildReference(ref),
    language: 'hebrew',
    book: ref.book,
    words,
    totalWords: words.length,
  };
};

/**
 * Fetches Greek interlinear data from Bolls.life for NT passages
 * @param {Object} ref - Parsed reference
 * @returns {Promise<Object>} Interlinear data
 */
const fetchGreek = async (ref) => {
  const url = `${BOLLS_BASE_URL}/get-text/TISCH/${ref.bollsNumber}/${ref.chapter}/`;
  log.debug('Fetching Greek text:', url);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Bolls.life API error: ${response.status}`);
  }

  const verses = await response.json();
  const words = [];

  for (let v = ref.startVerse; v <= ref.endVerse; v++) {
    const verseData = verses.find((vd) => vd.verse === v);
    if (!verseData) {
      log.warn(`Verse ${v} not found in API response for ${ref.book} ${ref.chapter}`);
      continue;
    }

    const parsed = parseGreekStrongsText(verseData.text, v);
    words.push(...parsed);
  }

  return {
    reference: buildReference(ref),
    language: 'greek',
    book: ref.book,
    words,
    totalWords: words.length,
  };
};

/**
 * Parses Bolls.life Greek text with inline <S>NNNN</S> Strong's tags
 * e.g., "Ἐν<S>1722</S> ἀρχῇ<S>746</S>" -> word objects
 * @param {string} text - Greek text with Strong's tags
 * @param {number} verseNum - Verse number
 * @returns {Array} Array of word objects
 */
const parseGreekStrongsText = (text, verseNum) => {
  const words = [];
  // Split on word boundaries while preserving Strong's tags
  const regex = /([^\s<]+)(?:<S>(\d+)<\/S>)?/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const greekWord = match[1].replace(/[,.;·:]+$/, '');
    const strongsNum = match[2] ? `G${match[2]}` : null;

    if (greekWord && strongsNum) {
      words.push({
        original: greekWord,
        originalWithMarks: greekWord,
        strongs: strongsNum,
        morph: '',
        verseNum,
      });
    }
  }

  return words;
};

/**
 * Builds a display reference string
 * @param {Object} ref - Parsed reference
 * @returns {string} e.g., "Genesis 1:1" or "John 3:16-18"
 */
const buildReference = (ref) => {
  const versePart = ref.startVerse === ref.endVerse
    ? `${ref.startVerse}`
    : `${ref.startVerse}-${ref.endVerse}`;
  return `${ref.book} ${ref.chapter}:${versePart}`;
};

/**
 * Interlinear Service API
 */
const InterlinearService = {
  /**
   * Fetches interlinear word data for a Bible reference
   * @param {string} reference - Bible reference string
   * @returns {Promise<Object>} Interlinear data with word array
   */
  async fetch(reference) {
    const ref = parseReference(reference);
    if (!ref) {
      throw new Error(`Invalid Bible reference: "${reference}". Use format: Book Chapter:Verse (e.g., Genesis 1:1)`);
    }

    if (ref.testament === 'OT') {
      return fetchHebrew(ref);
    }

    return fetchGreek(ref);
  },

  /**
   * Checks if interlinear data has content
   * @param {Object} data - Interlinear data
   * @returns {boolean}
   */
  hasContent(data) {
    return !!(data && data.words && data.words.length > 0);
  },

  /**
   * Gets the language for a given book
   * @param {string} bookName - Book name
   * @returns {string} 'hebrew' or 'greek'
   */
  getLanguageForBook(bookName) {
    const bookData = lookupBook(bookName);
    return bookData && bookData.testament === 'OT' ? 'hebrew' : 'greek';
  },

  /**
   * Parses a reference string (exposed for validation in routes)
   * @param {string} input - Raw reference
   * @returns {Object|null}
   */
  parseReference,
};

module.exports = InterlinearService;
