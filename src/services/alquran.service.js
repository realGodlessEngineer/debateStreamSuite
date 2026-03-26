/**
 * AlQuran.Cloud API service
 * Fetches and parses Quran verses from the AlQuran.Cloud API
 * @module services/alquran
 */

const { QURAN_SURAH_ORDER, QURAN_EDITIONS } = require('../config/constants');
const createLogger = require('../utils/logger');

const log = createLogger('AlQuran');

const BASE_URL = 'https://api.alquran.cloud/v1';
const DEFAULT_EDITION = 'en.sahih';

/**
 * Resolves a surah name to its number using QURAN_SURAH_ORDER
 * @param {string} name - Surah name (case-insensitive, partial match)
 * @returns {number|null} Surah number or null
 */
const resolveSurahName = (name) => {
  const normalized = name.toLowerCase().replace(/[^a-z]/g, '');
  const surah = QURAN_SURAH_ORDER.find((s) => {
    const surahNorm = s.name.toLowerCase().replace(/[^a-z]/g, '');
    return surahNorm === normalized || surahNorm.includes(normalized);
  });
  return surah ? surah.number : null;
};

/**
 * Parses a Quran reference string into structured components
 * Accepts: "2:255", "2:255-260", "Al-Baqarah 2:255", "Al-Baqarah:255"
 * @param {string} input - Raw reference string
 * @returns {Object|null} { surah, startAyah, endAyah } or null if invalid
 */
const parseReference = (input) => {
  const trimmed = input.trim();

  // Pattern: optional name, then surah:ayah or surah:start-end
  const match = trimmed.match(
    /^(?:([A-Za-z'-]+(?:\s+[A-Za-z'-]+)*)\s+)?(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?$/
  );

  if (!match) {
    // Try name-only format: "Al-Baqarah:255" or "Al-Baqarah:255-260"
    const nameMatch = trimmed.match(
      /^([A-Za-z'-]+(?:\s+[A-Za-z'-]+)*):(\d{1,3})(?:-(\d{1,3}))?$/
    );
    if (nameMatch) {
      const surahNum = resolveSurahName(nameMatch[1]);
      if (!surahNum) return null;
      return {
        surah: surahNum,
        startAyah: parseInt(nameMatch[2], 10),
        endAyah: nameMatch[3] ? parseInt(nameMatch[3], 10) : parseInt(nameMatch[2], 10),
      };
    }
    return null;
  }

  let surah;
  if (match[1]) {
    // Has a name prefix — try to resolve, but use the number from the reference
    surah = parseInt(match[2], 10);
  } else {
    surah = parseInt(match[2], 10);
  }

  return {
    surah,
    startAyah: parseInt(match[3], 10),
    endAyah: match[4] ? parseInt(match[4], 10) : parseInt(match[3], 10),
  };
};

/**
 * Validates parsed reference against surah data
 * @param {Object} ref - Parsed reference { surah, startAyah, endAyah }
 * @returns {string|null} Error message or null if valid
 */
const validateReference = (ref) => {
  if (ref.surah < 1 || ref.surah > 114) {
    return `Invalid surah number: ${ref.surah}. Must be 1-114.`;
  }

  const surahData = QURAN_SURAH_ORDER[ref.surah - 1];

  if (ref.startAyah < 1 || ref.startAyah > surahData.ayahCount) {
    return `Invalid ayah ${ref.startAyah} for ${surahData.name}. Must be 1-${surahData.ayahCount}.`;
  }

  if (ref.endAyah < ref.startAyah || ref.endAyah > surahData.ayahCount) {
    return `Invalid ayah range ${ref.startAyah}-${ref.endAyah} for ${surahData.name}. Max is ${surahData.ayahCount}.`;
  }

  return null;
};

/**
 * Builds a human-readable reference string
 * @param {number} surah - Surah number
 * @param {number} startAyah - Start ayah
 * @param {number} endAyah - End ayah
 * @returns {string} e.g., "Al-Baqarah 2:255" or "Al-Baqarah 2:255-260"
 */
const buildReference = (surah, startAyah, endAyah) => {
  const surahData = QURAN_SURAH_ORDER[surah - 1];
  const ayahPart = startAyah === endAyah ? `${startAyah}` : `${startAyah}-${endAyah}`;
  return `${surahData.name} ${surah}:${ayahPart}`;
};

/**
 * Fetches a single ayah from the API
 * @param {number} surah - Surah number
 * @param {number} ayah - Ayah number
 * @param {string} edition - Edition identifier
 * @returns {Promise<Object>} API response data
 */
const fetchSingleAyah = async (surah, ayah, edition) => {
  const url = `${BASE_URL}/ayah/${surah}:${ayah}/${edition}`;
  log.debug('Fetching:', url);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const json = await response.json();

  if (json.code !== 200 || !json.data) {
    throw new Error(json.data || 'Invalid API response');
  }

  return json.data;
};

/**
 * Fetches a surah and extracts an ayah range
 * @param {number} surah - Surah number
 * @param {number} startAyah - Start ayah
 * @param {number} endAyah - End ayah
 * @param {string} edition - Edition identifier
 * @returns {Promise<Array>} Array of ayah data objects
 */
const fetchAyahRange = async (surah, startAyah, endAyah, edition) => {
  const url = `${BASE_URL}/surah/${surah}/${edition}`;
  log.debug('Fetching surah for range:', url);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const json = await response.json();

  if (json.code !== 200 || !json.data || !json.data.ayahs) {
    throw new Error(json.data || 'Invalid API response');
  }

  return json.data.ayahs.filter(
    (a) => a.numberInSurah >= startAyah && a.numberInSurah <= endAyah
  );
};

/**
 * Normalizes API response into the standard verse format
 * @param {Object|Array} data - Single ayah data or array of ayahs
 * @param {Object} ref - Parsed reference { surah, startAyah, endAyah }
 * @param {string} edition - Edition identifier
 * @returns {Object} Normalized verse data
 */
const normalizeResponse = (data, ref, edition) => {
  const surahData = QURAN_SURAH_ORDER[ref.surah - 1];
  const editionName = QURAN_EDITIONS[edition] || edition;
  const reference = buildReference(ref.surah, ref.startAyah, ref.endAyah);

  let verses;
  if (Array.isArray(data)) {
    verses = data.map((a) => ({
      number: String(a.numberInSurah),
      text: a.text,
    }));
  } else {
    verses = [{
      number: String(data.numberInSurah),
      text: data.text,
    }];
  }

  return {
    reference,
    version: edition,
    versionName: editionName,
    text: verses.map((v) => v.text).join(' '),
    verses,
    totalVerses: verses.length,
    surahName: surahData.name,
    surahNumber: ref.surah,
  };
};

/**
 * AlQuran Service API
 */
const AlQuranService = {
  /**
   * Fetches Quran verse(s) by reference string
   * @param {string} reference - Reference string (e.g., "2:255", "2:1-7")
   * @param {string} edition - Edition identifier
   * @returns {Promise<Object>} Normalized verse data
   * @throws {Error} On invalid reference or fetch failure
   */
  async fetch(reference, edition = DEFAULT_EDITION) {
    const parsed = parseReference(reference);
    if (!parsed) {
      throw new Error(`Invalid Quran reference: "${reference}". Use format: surah:ayah (e.g., 2:255)`);
    }

    const validationError = validateReference(parsed);
    if (validationError) {
      throw new Error(validationError);
    }

    const isRange = parsed.startAyah !== parsed.endAyah;

    if (isRange) {
      const ayahs = await fetchAyahRange(parsed.surah, parsed.startAyah, parsed.endAyah, edition);
      return normalizeResponse(ayahs, parsed, edition);
    }

    const ayah = await fetchSingleAyah(parsed.surah, parsed.startAyah, edition);
    return normalizeResponse(ayah, parsed, edition);
  },

  /**
   * Validates a verse response has content
   * @param {Object} verseData - Parsed verse data
   * @returns {boolean} Has valid content
   */
  hasContent(verseData) {
    return !!(verseData.text || (verseData.verses && verseData.verses.length > 0));
  },

  /**
   * Gets the default edition code
   * @returns {string} Default edition
   */
  getDefaultEdition() {
    return DEFAULT_EDITION;
  },

  /**
   * Parses a reference string (exposed for validation in routes)
   * @param {string} input - Raw reference string
   * @returns {Object|null} Parsed reference or null
   */
  parseReference,
};

module.exports = AlQuranService;
