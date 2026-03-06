/**
 * Soundboard API Routes
 * REST endpoints for sound management
 * @module routes/soundboard
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const SoundboardService = require('../services/soundboard.service');
const { SOUNDBOARD } = require('../config/constants');
const createLogger = require('../utils/logger');

const log = createLogger('Soundboard');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    SoundboardService.ensureSoundsDir();
    cb(null, SoundboardService.getSoundsDir());
  },
  filename: (req, file, cb) => {
    // Generate unique filename preserving extension
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (SOUNDBOARD.ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed: ${SOUNDBOARD.ALLOWED_EXTENSIONS.join(', ')}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: SOUNDBOARD.MAX_FILE_SIZE },
});

/**
 * GET /api/soundboard/sounds
 * Returns all sounds
 */
router.get('/sounds', (req, res) => {
  res.json(SoundboardService.getAll());
});

/**
 * POST /api/soundboard/sounds
 * Upload a new sound
 */
router.post('/sounds', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided' });
  }

  const name = req.body.name || path.basename(req.file.originalname, path.extname(req.file.originalname));
  const emoji = req.body.emoji || '🔊';

  const sound = SoundboardService.add({
    name,
    emoji,
    filename: req.file.filename,
    originalName: req.file.originalname,
  });

  log.info('Sound uploaded:', sound.name, '-', req.file.filename);
  res.json(sound);
});

/**
 * PUT /api/soundboard/sounds/:id
 * Update a sound's metadata
 */
router.put('/sounds/:id', (req, res) => {
  const { name, emoji } = req.body;
  const updated = SoundboardService.update(req.params.id, { name, emoji });

  if (updated) {
    res.json(updated);
  } else {
    res.status(404).json({ error: 'Sound not found' });
  }
});

/**
 * DELETE /api/soundboard/sounds/:id
 * Delete a sound
 */
router.delete('/sounds/:id', (req, res) => {
  const removed = SoundboardService.remove(req.params.id);

  if (removed) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Sound not found' });
  }
});

/**
 * PUT /api/soundboard/reorder
 * Reorder sounds
 */
router.put('/reorder', (req, res) => {
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds)) {
    return res.status(400).json({ error: 'orderedIds must be an array' });
  }
  if (orderedIds.length === 0) {
    return res.status(400).json({ error: 'orderedIds must not be empty' });
  }
  if (!orderedIds.every(id => typeof id === 'string')) {
    return res.status(400).json({ error: 'orderedIds must contain only strings' });
  }
  const sounds = SoundboardService.reorder(orderedIds);
  res.json(sounds);
});

// Error handling for multer
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: `File too large. Maximum size: ${SOUNDBOARD.MAX_FILE_SIZE / 1024 / 1024}MB` });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

module.exports = router;
