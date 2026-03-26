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
  QURAN_CACHE_FILE: path.join(__dirname, '../../quran-cache.json'),
  DICTIONARY_CACHE_FILE: path.join(__dirname, '../../dictionary-cache.json'),
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

/**
 * Quran editions (scholarly translations)
 */
const QURAN_EDITIONS = Object.freeze({
  'en.sahih': 'Sahih International',
  'en.pickthall': 'Pickthall',
  'en.yusufali': 'Yusuf Ali',
});

/**
 * Quran surahs in canonical order
 * Each entry: { number, name (Arabic transliteration), englishName, ayahCount }
 */
const QURAN_SURAH_ORDER = Object.freeze([
  { number: 1, name: 'Al-Fatihah', englishName: 'The Opening', ayahCount: 7 },
  { number: 2, name: 'Al-Baqarah', englishName: 'The Cow', ayahCount: 286 },
  { number: 3, name: 'Aal-Imran', englishName: 'The Family of Imran', ayahCount: 200 },
  { number: 4, name: 'An-Nisa', englishName: 'The Women', ayahCount: 176 },
  { number: 5, name: 'Al-Ma\'idah', englishName: 'The Table Spread', ayahCount: 120 },
  { number: 6, name: 'Al-An\'am', englishName: 'The Cattle', ayahCount: 165 },
  { number: 7, name: 'Al-A\'raf', englishName: 'The Heights', ayahCount: 206 },
  { number: 8, name: 'Al-Anfal', englishName: 'The Spoils of War', ayahCount: 75 },
  { number: 9, name: 'At-Tawbah', englishName: 'The Repentance', ayahCount: 129 },
  { number: 10, name: 'Yunus', englishName: 'Jonah', ayahCount: 109 },
  { number: 11, name: 'Hud', englishName: 'Hud', ayahCount: 123 },
  { number: 12, name: 'Yusuf', englishName: 'Joseph', ayahCount: 111 },
  { number: 13, name: 'Ar-Ra\'d', englishName: 'The Thunder', ayahCount: 43 },
  { number: 14, name: 'Ibrahim', englishName: 'Abraham', ayahCount: 52 },
  { number: 15, name: 'Al-Hijr', englishName: 'The Rocky Tract', ayahCount: 99 },
  { number: 16, name: 'An-Nahl', englishName: 'The Bee', ayahCount: 128 },
  { number: 17, name: 'Al-Isra', englishName: 'The Night Journey', ayahCount: 111 },
  { number: 18, name: 'Al-Kahf', englishName: 'The Cave', ayahCount: 110 },
  { number: 19, name: 'Maryam', englishName: 'Mary', ayahCount: 98 },
  { number: 20, name: 'Ta-Ha', englishName: 'Ta-Ha', ayahCount: 135 },
  { number: 21, name: 'Al-Anbiya', englishName: 'The Prophets', ayahCount: 112 },
  { number: 22, name: 'Al-Hajj', englishName: 'The Pilgrimage', ayahCount: 78 },
  { number: 23, name: 'Al-Mu\'minun', englishName: 'The Believers', ayahCount: 118 },
  { number: 24, name: 'An-Nur', englishName: 'The Light', ayahCount: 64 },
  { number: 25, name: 'Al-Furqan', englishName: 'The Criterion', ayahCount: 77 },
  { number: 26, name: 'Ash-Shu\'ara', englishName: 'The Poets', ayahCount: 227 },
  { number: 27, name: 'An-Naml', englishName: 'The Ants', ayahCount: 93 },
  { number: 28, name: 'Al-Qasas', englishName: 'The Stories', ayahCount: 88 },
  { number: 29, name: 'Al-Ankabut', englishName: 'The Spider', ayahCount: 69 },
  { number: 30, name: 'Ar-Rum', englishName: 'The Romans', ayahCount: 60 },
  { number: 31, name: 'Luqman', englishName: 'Luqman', ayahCount: 34 },
  { number: 32, name: 'As-Sajdah', englishName: 'The Prostration', ayahCount: 30 },
  { number: 33, name: 'Al-Ahzab', englishName: 'The Combined Forces', ayahCount: 73 },
  { number: 34, name: 'Saba', englishName: 'Sheba', ayahCount: 54 },
  { number: 35, name: 'Fatir', englishName: 'Originator', ayahCount: 45 },
  { number: 36, name: 'Ya-Sin', englishName: 'Ya-Sin', ayahCount: 83 },
  { number: 37, name: 'As-Saffat', englishName: 'Those Who Set the Ranks', ayahCount: 182 },
  { number: 38, name: 'Sad', englishName: 'Sad', ayahCount: 88 },
  { number: 39, name: 'Az-Zumar', englishName: 'The Troops', ayahCount: 75 },
  { number: 40, name: 'Ghafir', englishName: 'The Forgiver', ayahCount: 85 },
  { number: 41, name: 'Fussilat', englishName: 'Explained in Detail', ayahCount: 54 },
  { number: 42, name: 'Ash-Shura', englishName: 'The Consultation', ayahCount: 53 },
  { number: 43, name: 'Az-Zukhruf', englishName: 'The Ornaments of Gold', ayahCount: 89 },
  { number: 44, name: 'Ad-Dukhan', englishName: 'The Smoke', ayahCount: 59 },
  { number: 45, name: 'Al-Jathiyah', englishName: 'The Crouching', ayahCount: 37 },
  { number: 46, name: 'Al-Ahqaf', englishName: 'The Wind-Curved Sandhills', ayahCount: 35 },
  { number: 47, name: 'Muhammad', englishName: 'Muhammad', ayahCount: 38 },
  { number: 48, name: 'Al-Fath', englishName: 'The Victory', ayahCount: 29 },
  { number: 49, name: 'Al-Hujurat', englishName: 'The Rooms', ayahCount: 18 },
  { number: 50, name: 'Qaf', englishName: 'Qaf', ayahCount: 45 },
  { number: 51, name: 'Adh-Dhariyat', englishName: 'The Winnowing Winds', ayahCount: 60 },
  { number: 52, name: 'At-Tur', englishName: 'The Mount', ayahCount: 49 },
  { number: 53, name: 'An-Najm', englishName: 'The Star', ayahCount: 62 },
  { number: 54, name: 'Al-Qamar', englishName: 'The Moon', ayahCount: 55 },
  { number: 55, name: 'Ar-Rahman', englishName: 'The Beneficent', ayahCount: 78 },
  { number: 56, name: 'Al-Waqi\'ah', englishName: 'The Inevitable', ayahCount: 96 },
  { number: 57, name: 'Al-Hadid', englishName: 'The Iron', ayahCount: 29 },
  { number: 58, name: 'Al-Mujadila', englishName: 'The Pleading Woman', ayahCount: 22 },
  { number: 59, name: 'Al-Hashr', englishName: 'The Exile', ayahCount: 24 },
  { number: 60, name: 'Al-Mumtahanah', englishName: 'She That is to Be Examined', ayahCount: 13 },
  { number: 61, name: 'As-Saff', englishName: 'The Ranks', ayahCount: 14 },
  { number: 62, name: 'Al-Jumu\'ah', englishName: 'The Congregation', ayahCount: 11 },
  { number: 63, name: 'Al-Munafiqun', englishName: 'The Hypocrites', ayahCount: 11 },
  { number: 64, name: 'At-Taghabun', englishName: 'The Mutual Disillusion', ayahCount: 18 },
  { number: 65, name: 'At-Talaq', englishName: 'The Divorce', ayahCount: 12 },
  { number: 66, name: 'At-Tahrim', englishName: 'The Prohibition', ayahCount: 12 },
  { number: 67, name: 'Al-Mulk', englishName: 'The Sovereignty', ayahCount: 30 },
  { number: 68, name: 'Al-Qalam', englishName: 'The Pen', ayahCount: 52 },
  { number: 69, name: 'Al-Haqqah', englishName: 'The Reality', ayahCount: 52 },
  { number: 70, name: 'Al-Ma\'arij', englishName: 'The Ascending Stairways', ayahCount: 44 },
  { number: 71, name: 'Nuh', englishName: 'Noah', ayahCount: 28 },
  { number: 72, name: 'Al-Jinn', englishName: 'The Jinn', ayahCount: 28 },
  { number: 73, name: 'Al-Muzzammil', englishName: 'The Enshrouded One', ayahCount: 20 },
  { number: 74, name: 'Al-Muddaththir', englishName: 'The Cloaked One', ayahCount: 56 },
  { number: 75, name: 'Al-Qiyamah', englishName: 'The Resurrection', ayahCount: 40 },
  { number: 76, name: 'Al-Insan', englishName: 'The Man', ayahCount: 31 },
  { number: 77, name: 'Al-Mursalat', englishName: 'The Emissaries', ayahCount: 50 },
  { number: 78, name: 'An-Naba', englishName: 'The Tidings', ayahCount: 40 },
  { number: 79, name: 'An-Nazi\'at', englishName: 'Those Who Drag Forth', ayahCount: 46 },
  { number: 80, name: 'Abasa', englishName: 'He Frowned', ayahCount: 42 },
  { number: 81, name: 'At-Takwir', englishName: 'The Overthrowing', ayahCount: 29 },
  { number: 82, name: 'Al-Infitar', englishName: 'The Cleaving', ayahCount: 19 },
  { number: 83, name: 'Al-Mutaffifin', englishName: 'The Defrauding', ayahCount: 36 },
  { number: 84, name: 'Al-Inshiqaq', englishName: 'The Sundering', ayahCount: 25 },
  { number: 85, name: 'Al-Buruj', englishName: 'The Mansions of the Stars', ayahCount: 22 },
  { number: 86, name: 'At-Tariq', englishName: 'The Nightcomer', ayahCount: 17 },
  { number: 87, name: 'Al-A\'la', englishName: 'The Most High', ayahCount: 19 },
  { number: 88, name: 'Al-Ghashiyah', englishName: 'The Overwhelming', ayahCount: 26 },
  { number: 89, name: 'Al-Fajr', englishName: 'The Dawn', ayahCount: 30 },
  { number: 90, name: 'Al-Balad', englishName: 'The City', ayahCount: 20 },
  { number: 91, name: 'Ash-Shams', englishName: 'The Sun', ayahCount: 15 },
  { number: 92, name: 'Al-Layl', englishName: 'The Night', ayahCount: 21 },
  { number: 93, name: 'Ad-Duhaa', englishName: 'The Morning Hours', ayahCount: 11 },
  { number: 94, name: 'Ash-Sharh', englishName: 'The Relief', ayahCount: 8 },
  { number: 95, name: 'At-Tin', englishName: 'The Fig', ayahCount: 8 },
  { number: 96, name: 'Al-Alaq', englishName: 'The Clot', ayahCount: 19 },
  { number: 97, name: 'Al-Qadr', englishName: 'The Power', ayahCount: 5 },
  { number: 98, name: 'Al-Bayyinah', englishName: 'The Clear Proof', ayahCount: 8 },
  { number: 99, name: 'Az-Zalzalah', englishName: 'The Earthquake', ayahCount: 8 },
  { number: 100, name: 'Al-Adiyat', englishName: 'The Courser', ayahCount: 11 },
  { number: 101, name: 'Al-Qari\'ah', englishName: 'The Calamity', ayahCount: 11 },
  { number: 102, name: 'At-Takathur', englishName: 'The Rivalry in World Increase', ayahCount: 8 },
  { number: 103, name: 'Al-Asr', englishName: 'The Declining Day', ayahCount: 3 },
  { number: 104, name: 'Al-Humazah', englishName: 'The Traducer', ayahCount: 9 },
  { number: 105, name: 'Al-Fil', englishName: 'The Elephant', ayahCount: 5 },
  { number: 106, name: 'Quraysh', englishName: 'Quraysh', ayahCount: 4 },
  { number: 107, name: 'Al-Ma\'un', englishName: 'The Small Kindnesses', ayahCount: 7 },
  { number: 108, name: 'Al-Kawthar', englishName: 'The Abundance', ayahCount: 3 },
  { number: 109, name: 'Al-Kafirun', englishName: 'The Disbelievers', ayahCount: 6 },
  { number: 110, name: 'An-Nasr', englishName: 'The Divine Support', ayahCount: 3 },
  { number: 111, name: 'Al-Masad', englishName: 'The Palm Fiber', ayahCount: 5 },
  { number: 112, name: 'Al-Ikhlas', englishName: 'The Sincerity', ayahCount: 4 },
  { number: 113, name: 'Al-Falaq', englishName: 'The Daybreak', ayahCount: 5 },
  { number: 114, name: 'An-Nas', englishName: 'Mankind', ayahCount: 6 },
]);

module.exports = {
  SERVER,
  DISPLAY,
  SOUNDBOARD,
  BIBLE_BOOK_ORDER,
  QURAN_EDITIONS,
  QURAN_SURAH_ORDER,
};