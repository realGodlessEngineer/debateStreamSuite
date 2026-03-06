/**
 * API Routes
 * REST endpoints for verse fetching and cache management
 * @module routes/api
 */

const express = require('express');
const CacheService = require('../services/cache.service');
const BibleGatewayService = require('../services/bible-gateway.service');
const FallacyService = require('../services/fallacy.service');
const { DISPLAY, SOUNDBOARD, BIBLE_BOOK_ORDER } = require('../config/constants');
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
  });
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