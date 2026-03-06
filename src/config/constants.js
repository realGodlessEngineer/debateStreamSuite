/**
 * Application configuration and constants
 * @module config/constants
 */

const path = require('path');

/**
 * Server configuration
 */
const SERVER = Object.freeze({
  PORT: process.env.PORT || 3666,
  CACHE_FILE: path.join(__dirname, '../../verse-cache.json'),
  FALLACY_DB_FILE: path.join(__dirname, '../../fallacies-db.json'),
});

/**
 * Display settings
 */
const DISPLAY = Object.freeze({
  VERSES_PER_PAGE: 3,
});

/**
 * Soundboard settings
 */
const SOUNDBOARD = Object.freeze({
  BUTTONS_PER_PAGE: 12,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/x-m4a'],
  ALLOWED_EXTENSIONS: ['.mp3', '.wav', '.ogg', '.webm', '.m4a'],
});

/**
 * Bible books in canonical order for sorting
 */
const BIBLE_BOOK_ORDER = Object.freeze([
  // Old Testament
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
  'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
  '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles',
  'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalm', 'Psalms',
  'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Song of Songs',
  'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel',
  'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah',
  'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
  // New Testament
  'Matthew', 'Mark', 'Luke', 'John', 'Acts',
  'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
  'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
  '1 Timothy', '2 Timothy', 'Titus', 'Philemon',
  'Hebrews', 'James', '1 Peter', '2 Peter',
  '1 John', '2 John', '3 John', 'Jude', 'Revelation',
]);

module.exports = {
  SERVER,
  DISPLAY,
  SOUNDBOARD,
  BIBLE_BOOK_ORDER,
};