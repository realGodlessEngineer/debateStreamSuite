/**
 * API Routes
 * REST endpoints for verse fetching and cache management
 * @module routes/api
 */

const express = require('express');
const CacheService = require('../services/cache.service');
const BibleGatewayService = require('../services/bible-gateway.service');
const AlQuranService = require('../services/alquran.service');
const QuranCacheService = require('../services/quran-cache.service');
const DictionaryService = require('../services/dictionary.service');
const DictionaryCacheService = require('../services/dictionary-cache.service');
const FallacyService = require('../services/fallacy.service');
const { DISPLAY, SOUNDBOARD, BIBLE_BOOK_ORDER, QURAN_SURAH_ORDER, QURAN_EDITIONS } = require('../config/constants');
const createLogger = require('../utils/logger');

const log = createLogger('API');

const router = express.Router();

/**
 * POST /api/fetch-verse
 * Fetches a verse from cache or Bible Gateway
 */
router.post('/fetch-verse', async (req, res) => {
  const { reference, version } = req.body;

  if (!reference || typeof reference !== 'string') {
    return res.status(400).json({ error: 'Reference is required' });
  }

  if (reference.length > 200) {
    return res.status(400).json({ error: 'Reference is too long (max 200 characters)' });
  }

  if (version && (typeof version !== 'string' || version.length > 20)) {
    return res.status(400).json({ error: 'Invalid version' });
  }

  const effectiveVersion = version || BibleGatewayService.getDefaultVersion();

  // Check cache first
  const cached = CacheService.get(reference, effectiveVersion);
  if (cached) {
    log.debug('Cache hit:', reference, effectiveVersion);
    return res.json({ ...cached, fromCache: true });
  }

  // Fetch from Bible Gateway
  try {
    const verseData = await BibleGatewayService.fetch(reference, effectiveVersion);

    if (!BibleGatewayService.hasContent(verseData)) {
      return res.status(404).json({ error: 'No verse text found. Check the reference.' });
    }

    const cachedVerse = CacheService.add(verseData);
    res.json({ ...cachedVerse, fromCache: false });
  } catch (error) {
    log.error('Error fetching verse:', error.message);
    res.status(500).json({ error: 'Failed to fetch verse. Please try again.' });
  }
});

/**
 * GET /api/cached-verses
 * Returns all cached verses organized by book
 */
router.get('/cached-verses', (req, res) => {
  const organizedCache = CacheService.getAllByBook();
  res.json(organizedCache);
});

/**
 * GET /api/cached-verse/:key
 * Gets a specific cached verse by key
 */
router.get('/cached-verse/:key', (req, res) => {
  const key = decodeURIComponent(req.params.key);
  const verse = CacheService.getByKey(key);

  if (verse) {
    res.json(verse);
  } else {
    res.status(404).json({ error: 'Verse not found in cache' });
  }
});

/**
 * DELETE /api/cached-verse/:key
 * Deletes a specific cached verse
 */
router.delete('/cached-verse/:key', (req, res) => {
  const key = decodeURIComponent(req.params.key);
  const removed = CacheService.remove(key);

  if (removed) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Verse not found in cache' });
  }
});

/**
 * DELETE /api/cached-verses
 * Clears all cached verses
 */
router.delete('/cached-verses', async (req, res) => {
  await CacheService.clear();
  res.json({ success: true });
});

/**
 * GET /api/cache-stats
 * Returns cache statistics
 */
router.get('/cache-stats', (req, res) => {
  res.json(CacheService.getStats());
});

/**
 * GET /api/config
 * Returns shared configuration constants for frontend use
 */
router.get('/config', (req, res) => {
  res.json({
    display: DISPLAY,
    soundboard: {
      buttonsPerPage: SOUNDBOARD.BUTTONS_PER_PAGE,
      maxFileSize: SOUNDBOARD.MAX_FILE_SIZE,
      allowedExtensions: SOUNDBOARD.ALLOWED_EXTENSIONS,
    },
    bibleBookOrder: BIBLE_BOOK_ORDER,
    quranSurahOrder: QURAN_SURAH_ORDER,
    quranEditions: QURAN_EDITIONS,
  });
});

// ============================================
// Quran Endpoints
// ============================================

/**
 * POST /api/fetch-quran-verse
 * Fetches a Quran verse from cache or AlQuran.Cloud
 */
router.post('/fetch-quran-verse', async (req, res) => {
  const { reference, edition } = req.body;

  if (!reference || typeof reference !== 'string') {
    return res.status(400).json({ error: 'Reference is required' });
  }

  if (reference.length > 200) {
    return res.status(400).json({ error: 'Reference is too long (max 200 characters)' });
  }

  if (edition && (typeof edition !== 'string' || edition.length > 50)) {
    return res.status(400).json({ error: 'Invalid edition' });
  }

  const effectiveEdition = edition || AlQuranService.getDefaultEdition();

  // Check cache first
  const parsed = AlQuranService.parseReference(reference);
  if (!parsed) {
    return res.status(400).json({ error: 'Invalid Quran reference. Use format: surah:ayah (e.g., 2:255)' });
  }

  const cached = QuranCacheService.get(reference, effectiveEdition);
  if (cached) {
    log.debug('Quran cache hit:', reference, effectiveEdition);
    return res.json({ ...cached, fromCache: true });
  }

  try {
    const verseData = await AlQuranService.fetch(reference, effectiveEdition);

    if (!AlQuranService.hasContent(verseData)) {
      return res.status(404).json({ error: 'No verse text found. Check the reference.' });
    }

    const cachedVerse = QuranCacheService.add(verseData);
    res.json({ ...cachedVerse, fromCache: false });
  } catch (error) {
    log.error('Error fetching Quran verse:', error.message);
    const isUserError = error.message.includes('not found') || error.message.includes('Invalid');
    res.status(isUserError ? 400 : 500)
      .json({ error: isUserError ? error.message : 'Failed to fetch Quran verse. Please try again.' });
  }
});

/**
 * GET /api/cached-quran-verses
 * Returns all cached Quran verses organized by surah
 */
router.get('/cached-quran-verses', (req, res) => {
  res.json(QuranCacheService.getAllBySurah());
});

/**
 * GET /api/cached-quran-verse/:key
 * Gets a specific cached Quran verse by key
 */
router.get('/cached-quran-verse/:key', (req, res) => {
  const key = decodeURIComponent(req.params.key);
  const verse = QuranCacheService.getByKey(key);

  if (verse) {
    res.json(verse);
  } else {
    res.status(404).json({ error: 'Quran verse not found in cache' });
  }
});

/**
 * DELETE /api/cached-quran-verse/:key
 * Deletes a specific cached Quran verse
 */
router.delete('/cached-quran-verse/:key', (req, res) => {
  const key = decodeURIComponent(req.params.key);
  const removed = QuranCacheService.remove(key);

  if (removed) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Quran verse not found in cache' });
  }
});

/**
 * DELETE /api/cached-quran-verses
 * Clears all cached Quran verses
 */
router.delete('/cached-quran-verses', async (req, res) => {
  await QuranCacheService.clear();
  res.json({ success: true });
});

/**
 * GET /api/quran-cache-stats
 * Returns Quran cache statistics
 */
router.get('/quran-cache-stats', (req, res) => {
  res.json(QuranCacheService.getStats());
});

// ============================================
// Dictionary Endpoints
// ============================================

/**
 * POST /api/fetch-definition
 * Fetches a word definition from cache or Free Dictionary API
 */
router.post('/fetch-definition', async (req, res) => {
  const { word } = req.body;

  if (!word || typeof word !== 'string') {
    return res.status(400).json({ error: 'Word is required' });
  }

  if (word.length > 50) {
    return res.status(400).json({ error: 'Word is too long (max 50 characters)' });
  }

  const normalizedWord = word.trim().toLowerCase();

  // Check cache first
  const cached = DictionaryCacheService.get(normalizedWord, 'en');
  if (cached) {
    log.debug('Dictionary cache hit:', normalizedWord);
    return res.json({ ...cached, fromCache: true });
  }

  try {
    const definitionData = await DictionaryService.fetch(word);

    if (!DictionaryService.hasContent(definitionData)) {
      return res.status(404).json({ error: 'No definitions found. Check the spelling.' });
    }

    const cachedEntry = DictionaryCacheService.add(definitionData);
    res.json({ ...cachedEntry, fromCache: false });
  } catch (error) {
    log.error('Error fetching definition:', error.message);
    const isNotFound = error.message.includes('not found');
    res.status(isNotFound ? 404 : 500)
      .json({ error: isNotFound ? 'Word not found. Check the spelling.' : 'Failed to fetch definition. Please try again.' });
  }
});

/**
 * GET /api/cached-definitions
 * Returns all cached definitions organized by first letter
 */
router.get('/cached-definitions', (req, res) => {
  res.json(DictionaryCacheService.getAllByLetter());
});

/**
 * GET /api/cached-definition/:key
 * Gets a specific cached definition by key
 */
router.get('/cached-definition/:key', (req, res) => {
  const key = decodeURIComponent(req.params.key);
  const entry = DictionaryCacheService.getByKey(key);

  if (entry) {
    res.json(entry);
  } else {
    res.status(404).json({ error: 'Definition not found in cache' });
  }
});

/**
 * DELETE /api/cached-definition/:key
 * Deletes a specific cached definition
 */
router.delete('/cached-definition/:key', (req, res) => {
  const key = decodeURIComponent(req.params.key);
  const removed = DictionaryCacheService.remove(key);

  if (removed) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Definition not found in cache' });
  }
});

/**
 * DELETE /api/cached-definitions
 * Clears all cached definitions
 */
router.delete('/cached-definitions', async (req, res) => {
  await DictionaryCacheService.clear();
  res.json({ success: true });
});

/**
 * GET /api/dictionary-cache-stats
 * Returns dictionary cache statistics
 */
router.get('/dictionary-cache-stats', (req, res) => {
  res.json(DictionaryCacheService.getStats());
});

// ============================================
// Fallacy Endpoints
// ============================================

/**
 * GET /api/fallacies
 * Returns all fallacies, optionally filtered by search query
 */
router.get('/fallacies', (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.slice(0, 200) : '';
  const results = query ? FallacyService.search(query) : FallacyService.getAll();
  res.json(results);
});

/**
 * GET /api/fallacies/count
 * Returns the total number of fallacies
 */
router.get('/fallacies/count', (req, res) => {
  res.json({ count: FallacyService.getCount() });
});

/**
 * GET /api/fallacy/:slug
 * Gets a specific fallacy by slug
 */
router.get('/fallacy/:slug', (req, res) => {
  const fallacy = FallacyService.getBySlug(req.params.slug);
  if (fallacy) {
    res.json(fallacy);
  } else {
    res.status(404).json({ error: 'Fallacy not found' });
  }
});

module.exports = router;