/**
 * Bible Gateway scraping service
 * Fetches and parses Bible verses from Bible Gateway
 * @module services/bible-gateway
 */

const cheerio = require('cheerio');
const createLogger = require('../utils/logger');

const log = createLogger('BibleGateway');

const BASE_URL = 'https://www.biblegateway.com/passage/';
const DEFAULT_VERSION = 'NRSVUE';

/**
 * User agent for requests
 */
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Builds a Bible Gateway URL for a reference
 * @param {string} reference - Bible reference (e.g., "John 3:16")
 * @param {string} version - Bible version code (e.g., "NIV")
 * @returns {string} Complete URL
 */
const buildUrl = (reference, version = DEFAULT_VERSION) => {
  const encodedRef = encodeURIComponent(reference);
  return `${BASE_URL}?search=${encodedRef}&version=${version}`;
};

/**
 * Extracts version code from URL
 * @param {string} url - Bible Gateway URL
 * @returns {string} Version code or empty string
 */
const extractVersionFromUrl = (url) => {
  try {
    const urlParams = new URL(url).searchParams;
    return urlParams.get('version') || '';
  } catch {
    return '';
  }
};

/**
 * Cleans and normalizes whitespace in text
 * @param {string} text - Text to clean
 * @returns {string} Cleaned text
 */
const cleanText = (text) => text.replace(/\s+/g, ' ').trim();

/**
 * Parses verse numbers and text from passage content
 * @param {string} fullText - Raw passage text
 * @returns {Array} Array of { number, text } objects
 */
const parseVerses = (fullText) => {
  const verseRegex = /\b(\d+)\s+/g;
  const parts = fullText.split(verseRegex);
  const verses = [];

  // Parts array: ['', '27', 'text...', '28', 'text...', ...]
  for (let i = 1; i < parts.length; i += 2) {
    const verseNum = parts[i];
    const verseText = parts[i + 1]?.trim() || '';

    if (verseText) {
      verses.push({
        number: verseNum,
        text: verseText,
      });
    }
  }

  // Fallback for single verse without number
  if (verses.length === 0 && fullText) {
    verses.push({
      number: '',
      text: fullText,
    });
  }

  return verses;
};

/**
 * Removes unwanted elements from passage HTML
 * @param {cheerio.Cheerio} $passage - Cheerio passage element
 * @returns {cheerio.Cheerio} Cleaned passage
 */
const cleanPassageHtml = ($passage) => {
  const elementsToRemove = [
    '.footnotes',
    '.crossrefs',
    '.crossreference',
    '.footnote',
    'h1', 'h2', 'h3', 'h4',
    '.passage-display',
    '.full-chap-link',
    '.publisher-info-bottom',
  ];

  elementsToRemove.forEach((selector) => $passage.find(selector).remove());
  return $passage;
};

/**
 * Extracts text content from passage HTML
 * @param {cheerio.CheerioAPI} $ - Cheerio instance
 * @param {cheerio.Cheerio} $passage - Cleaned passage element
 * @returns {string} Extracted text
 */
const extractPassageText = ($, $passage) => {
  let text = '';

  $passage.find('p').each((_, el) => {
    text += $(el).text() + ' ';
  });

  if (!text.trim()) {
    text = $passage.text();
  }

  return cleanText(text);
};

/**
 * Parses Bible Gateway HTML response
 * @param {string} html - Raw HTML content
 * @param {string} url - Source URL (for version extraction)
 * @returns {Object} Parsed verse data
 */
const parseHtml = (html, url = '') => {
  const $ = cheerio.load(html);

  // Extract version name from dropdown
  const versionName =
    $('.dropdown-display-text').first().text().trim() ||
    $('meta[property="og:title"]').attr('content')?.split(' - ').pop()?.trim() ||
    '';

  // Extract reference from header
  const reference =
    $('h1.passage-display span.passage-display-bcv').text().trim() ||
    $('h1')
      .first()
      .text()
      .replace(/New Revised.*|King James.*|English Standard.*/gi, '')
      .trim();

  // Process passage content
  const passageContent = $('.passage-content');
  let verses = [];
  let combinedText = '';

  if (passageContent.length) {
    const passageClone = passageContent.clone();
    cleanPassageHtml(passageClone);

    const fullText = extractPassageText($, passageClone);
    verses = parseVerses(fullText);
    combinedText = verses.map((v) => v.text).join(' ');
  }

  return {
    version: extractVersionFromUrl(url),
    versionName,
    reference,
    text: combinedText,
    verses,
    totalVerses: verses.length,
  };
};

/**
 * Bible Gateway Service API
 */
const BibleGatewayService = {
  /**
   * Fetches a verse from Bible Gateway
   * @param {string} reference - Bible reference
   * @param {string} version - Bible version code
   * @returns {Promise<Object>} Parsed verse data
   * @throws {Error} On fetch failure or invalid response
   */
  async fetch(reference, version = DEFAULT_VERSION) {
    const url = buildUrl(reference, version);
    log.debug('Fetching:', url);

    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    return parseHtml(html, url);
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
   * Gets the default version code
   * @returns {string} Default version
   */
  getDefaultVersion() {
    return DEFAULT_VERSION;
  },
};

module.exports = BibleGatewayService;