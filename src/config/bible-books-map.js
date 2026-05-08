/**
 * Bible books mapping for interlinear text analysis
 * Maps canonical book names to morphhb keys, Bolls.life numbers, and testament
 * @module config/bible-books-map
 */

/**
 * Mapping of canonical book names to data source identifiers
 * - morphhbKey: key used in the morphhb npm package (OT only)
 * - bollsNumber: book number used by Bolls.life API (1-66)
 * - testament: 'OT' or 'NT'
 */
const BIBLE_BOOKS_MAP = Object.freeze({
  'Genesis':        { morphhbKey: 'Genesis',          bollsNumber: 1,  testament: 'OT' },
  'Exodus':         { morphhbKey: 'Exodus',           bollsNumber: 2,  testament: 'OT' },
  'Leviticus':      { morphhbKey: 'Leviticus',        bollsNumber: 3,  testament: 'OT' },
  'Numbers':        { morphhbKey: 'Numbers',          bollsNumber: 4,  testament: 'OT' },
  'Deuteronomy':    { morphhbKey: 'Deuteronomy',      bollsNumber: 5,  testament: 'OT' },
  'Joshua':         { morphhbKey: 'Joshua',           bollsNumber: 6,  testament: 'OT' },
  'Judges':         { morphhbKey: 'Judges',           bollsNumber: 7,  testament: 'OT' },
  'Ruth':           { morphhbKey: 'Ruth',             bollsNumber: 8,  testament: 'OT' },
  '1 Samuel':       { morphhbKey: 'I Samuel',         bollsNumber: 9,  testament: 'OT' },
  '2 Samuel':       { morphhbKey: 'II Samuel',        bollsNumber: 10, testament: 'OT' },
  '1 Kings':        { morphhbKey: 'I Kings',          bollsNumber: 11, testament: 'OT' },
  '2 Kings':        { morphhbKey: 'II Kings',         bollsNumber: 12, testament: 'OT' },
  '1 Chronicles':   { morphhbKey: 'I Chronicles',     bollsNumber: 13, testament: 'OT' },
  '2 Chronicles':   { morphhbKey: 'II Chronicles',    bollsNumber: 14, testament: 'OT' },
  'Ezra':           { morphhbKey: 'Ezra',             bollsNumber: 15, testament: 'OT' },
  'Nehemiah':       { morphhbKey: 'Nehemiah',         bollsNumber: 16, testament: 'OT' },
  'Esther':         { morphhbKey: 'Esther',           bollsNumber: 17, testament: 'OT' },
  'Job':            { morphhbKey: 'Job',              bollsNumber: 18, testament: 'OT' },
  'Psalms':         { morphhbKey: 'Psalms',           bollsNumber: 19, testament: 'OT' },
  'Psalm':          { morphhbKey: 'Psalms',           bollsNumber: 19, testament: 'OT' },
  'Proverbs':       { morphhbKey: 'Proverbs',         bollsNumber: 20, testament: 'OT' },
  'Ecclesiastes':   { morphhbKey: 'Ecclesiastes',     bollsNumber: 21, testament: 'OT' },
  'Song of Solomon': { morphhbKey: 'Song of Solomon', bollsNumber: 22, testament: 'OT' },
  'Song of Songs':  { morphhbKey: 'Song of Solomon',  bollsNumber: 22, testament: 'OT' },
  'Isaiah':         { morphhbKey: 'Isaiah',           bollsNumber: 23, testament: 'OT' },
  'Jeremiah':       { morphhbKey: 'Jeremiah',         bollsNumber: 24, testament: 'OT' },
  'Lamentations':   { morphhbKey: 'Lamentations',     bollsNumber: 25, testament: 'OT' },
  'Ezekiel':        { morphhbKey: 'Ezekiel',          bollsNumber: 26, testament: 'OT' },
  'Daniel':         { morphhbKey: 'Daniel',           bollsNumber: 27, testament: 'OT' },
  'Hosea':          { morphhbKey: 'Hosea',            bollsNumber: 28, testament: 'OT' },
  'Joel':           { morphhbKey: 'Joel',             bollsNumber: 29, testament: 'OT' },
  'Amos':           { morphhbKey: 'Amos',             bollsNumber: 30, testament: 'OT' },
  'Obadiah':        { morphhbKey: 'Obadiah',          bollsNumber: 31, testament: 'OT' },
  'Jonah':          { morphhbKey: 'Jonah',            bollsNumber: 32, testament: 'OT' },
  'Micah':          { morphhbKey: 'Micah',            bollsNumber: 33, testament: 'OT' },
  'Nahum':          { morphhbKey: 'Nahum',            bollsNumber: 34, testament: 'OT' },
  'Habakkuk':       { morphhbKey: 'Habakkuk',         bollsNumber: 35, testament: 'OT' },
  'Zephaniah':      { morphhbKey: 'Zephaniah',        bollsNumber: 36, testament: 'OT' },
  'Haggai':         { morphhbKey: 'Haggai',           bollsNumber: 37, testament: 'OT' },
  'Zechariah':      { morphhbKey: 'Zechariah',        bollsNumber: 38, testament: 'OT' },
  'Malachi':        { morphhbKey: 'Malachi',          bollsNumber: 39, testament: 'OT' },
  'Matthew':        { morphhbKey: null, bollsNumber: 40, testament: 'NT' },
  'Mark':           { morphhbKey: null, bollsNumber: 41, testament: 'NT' },
  'Luke':           { morphhbKey: null, bollsNumber: 42, testament: 'NT' },
  'John':           { morphhbKey: null, bollsNumber: 43, testament: 'NT' },
  'Acts':           { morphhbKey: null, bollsNumber: 44, testament: 'NT' },
  'Romans':         { morphhbKey: null, bollsNumber: 45, testament: 'NT' },
  '1 Corinthians':  { morphhbKey: null, bollsNumber: 46, testament: 'NT' },
  '2 Corinthians':  { morphhbKey: null, bollsNumber: 47, testament: 'NT' },
  'Galatians':      { morphhbKey: null, bollsNumber: 48, testament: 'NT' },
  'Ephesians':      { morphhbKey: null, bollsNumber: 49, testament: 'NT' },
  'Philippians':    { morphhbKey: null, bollsNumber: 50, testament: 'NT' },
  'Colossians':     { morphhbKey: null, bollsNumber: 51, testament: 'NT' },
  '1 Thessalonians': { morphhbKey: null, bollsNumber: 52, testament: 'NT' },
  '2 Thessalonians': { morphhbKey: null, bollsNumber: 53, testament: 'NT' },
  '1 Timothy':      { morphhbKey: null, bollsNumber: 54, testament: 'NT' },
  '2 Timothy':      { morphhbKey: null, bollsNumber: 55, testament: 'NT' },
  'Titus':          { morphhbKey: null, bollsNumber: 56, testament: 'NT' },
  'Philemon':       { morphhbKey: null, bollsNumber: 57, testament: 'NT' },
  'Hebrews':        { morphhbKey: null, bollsNumber: 58, testament: 'NT' },
  'James':          { morphhbKey: null, bollsNumber: 59, testament: 'NT' },
  '1 Peter':        { morphhbKey: null, bollsNumber: 60, testament: 'NT' },
  '2 Peter':        { morphhbKey: null, bollsNumber: 61, testament: 'NT' },
  '1 John':         { morphhbKey: null, bollsNumber: 62, testament: 'NT' },
  '2 John':         { morphhbKey: null, bollsNumber: 63, testament: 'NT' },
  '3 John':         { morphhbKey: null, bollsNumber: 64, testament: 'NT' },
  'Jude':           { morphhbKey: null, bollsNumber: 65, testament: 'NT' },
  'Revelation':     { morphhbKey: null, bollsNumber: 66, testament: 'NT' },
});

/**
 * Looks up a book by name (case-insensitive, partial match)
 * @param {string} name - Book name to look up
 * @returns {Object|null} { canonical, morphhbKey, bollsNumber, testament } or null
 */
const lookupBook = (name) => {
  const trimmed = name.trim();

  // Direct match first
  if (BIBLE_BOOKS_MAP[trimmed]) {
    return { canonical: trimmed, ...BIBLE_BOOKS_MAP[trimmed] };
  }

  // Case-insensitive match
  const lower = trimmed.toLowerCase();
  for (const [canonical, data] of Object.entries(BIBLE_BOOKS_MAP)) {
    if (canonical.toLowerCase() === lower) {
      return { canonical, ...data };
    }
  }

  // Partial match (starts with)
  for (const [canonical, data] of Object.entries(BIBLE_BOOKS_MAP)) {
    if (canonical.toLowerCase().startsWith(lower)) {
      return { canonical, ...data };
    }
  }

  return null;
};

module.exports = { BIBLE_BOOKS_MAP, lookupBook };
