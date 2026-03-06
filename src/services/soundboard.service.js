/**
 * Soundboard Service
 * Manages sound files and soundboard configuration
 * @module services/soundboard
 */

const fs = require('fs');
const path = require('path');
const createLogger = require('../utils/logger');
const { readJsonSafe, createWriteQueue } = require('../utils/safe-file');

const log = createLogger('Soundboard');

const SOUNDS_DIR = path.join(__dirname, '../../sounds');
const CONFIG_FILE = path.join(__dirname, '../../soundboard.json');

// Serialized write queue — prevents concurrent writes from corrupting the file
const saveQueued = createWriteQueue(CONFIG_FILE);

// In-memory config
let config = {
  sounds: [],
  buttonsPerPage: 12,
};

/**
 * Ensures the sounds directory exists
 */
function ensureSoundsDir() {
  if (!fs.existsSync(SOUNDS_DIR)) {
    fs.mkdirSync(SOUNDS_DIR, { recursive: true });
  }
}

/**
 * Loads configuration from disk with backup fallback
 */
function load() {
  ensureSoundsDir();

  const { data, source } = readJsonSafe(CONFIG_FILE);

  if (!data) {
    log.info('No existing soundboard config found, starting fresh');
    return;
  }

  if (source === 'backup') {
    log.warn('Loaded soundboard config from backup file — primary was corrupted');
  }

  // Validate the loaded data has a sounds array
  if (!Array.isArray(data.sounds)) {
    log.error('Loaded config has no sounds array, ignoring');
    return;
  }

  config = { ...config, ...data };

  // Validate that referenced sound files still exist and have safe filenames
  const before = config.sounds.length;
  config.sounds = config.sounds.filter(sound => {
    if (!isValidFilename(sound.filename)) {
      log.warn(`Invalid filename in config, removing: ${sound.filename}`);
      return false;
    }
    const filePath = path.join(SOUNDS_DIR, sound.filename);
    if (!fs.existsSync(filePath)) {
      log.warn(`Sound file missing, removing from config: ${sound.filename}`);
      return false;
    }
    return true;
  });

  const removed = before - config.sounds.length;
  if (removed > 0) {
    log.info(`Removed ${removed} orphaned entries, saving updated config`);
    save();
  }

  log.info(`Loaded ${config.sounds.length} sounds`);
}

/**
 * Saves configuration to disk using atomic write queue
 */
function save() {
  saveQueued(config)
    .then(ok => {
      if (!ok) log.error('Failed to save soundboard config');
    });
}

/**
 * Gets all sounds
 * @returns {Array} Array of sound objects
 */
function getAll() {
  return config.sounds;
}

/**
 * Gets a sound by ID
 * @param {string} id - Sound ID
 * @returns {Object|null} Sound object or null
 */
function getById(id) {
  return config.sounds.find(s => s.id === id) || null;
}

/**
 * Adds a new sound
 * @param {Object} soundData - Sound metadata
 * @param {string} soundData.name - Display name
 * @param {string} soundData.emoji - Emoji icon
 * @param {string} soundData.filename - File name in sounds directory
 * @param {string} soundData.originalName - Original uploaded file name
 * @returns {Object} The created sound entry
 */
function add(soundData) {
  const sound = {
    id: generateId(),
    name: soundData.name,
    emoji: soundData.emoji || '🔊',
    filename: soundData.filename,
    originalName: soundData.originalName || soundData.filename,
    createdAt: new Date().toISOString(),
  };
  config.sounds.push(sound);
  save();
  return sound;
}

/**
 * Updates a sound's metadata
 * @param {string} id - Sound ID
 * @param {Object} updates - Fields to update (name, emoji)
 * @returns {Object|null} Updated sound or null
 */
function update(id, updates) {
  const index = config.sounds.findIndex(s => s.id === id);
  if (index === -1) return null;

  const allowed = ['name', 'emoji'];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      config.sounds[index][key] = updates[key];
    }
  }
  save();
  return config.sounds[index];
}

/**
 * Removes a sound and deletes its file
 * @param {string} id - Sound ID
 * @returns {boolean} Whether the sound was removed
 */
function remove(id) {
  const index = config.sounds.findIndex(s => s.id === id);
  if (index === -1) return false;

  const sound = config.sounds[index];

  // Validate filename before constructing file path to prevent path traversal
  if (isValidFilename(sound.filename)) {
    const filePath = path.join(SOUNDS_DIR, sound.filename);
    const resolvedPath = path.resolve(filePath);
    const resolvedDir = path.resolve(SOUNDS_DIR);

    if (resolvedPath.startsWith(resolvedDir + path.sep)) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        log.error('Error deleting sound file:', error.message);
      }
    } else {
      log.error('Path traversal attempt blocked in remove:', sound.filename);
    }
  } else {
    log.error('Invalid filename, skipping file deletion:', sound.filename);
  }

  config.sounds.splice(index, 1);
  save();
  return true;
}

/**
 * Reorders sounds — validates that all existing sounds are preserved
 * @param {Array<string>} orderedIds - Array of sound IDs in desired order
 * @returns {Array} Reordered sounds array
 */
function reorder(orderedIds) {
  // Build the reordered list from known IDs
  const reordered = [];
  const seen = new Set();

  for (const id of orderedIds) {
    if (seen.has(id)) continue; // Skip duplicates
    const sound = config.sounds.find(s => s.id === id);
    if (sound) {
      reordered.push(sound);
      seen.add(id);
    }
  }

  // Append any sounds not in the ordered list (safety net — never lose sounds)
  for (const sound of config.sounds) {
    if (!seen.has(sound.id)) {
      reordered.push(sound);
    }
  }

  // Sanity check: reordered must have same count as original
  if (reordered.length !== config.sounds.length) {
    log.error(`Reorder sanity check failed: expected ${config.sounds.length}, got ${reordered.length}`);
    return config.sounds;
  }

  config.sounds = reordered;
  save();
  return config.sounds;
}

/**
 * Gets the sounds directory path
 * @returns {string} Path to sounds directory
 */
function getSoundsDir() {
  return SOUNDS_DIR;
}

/**
 * Validates that a filename has no path traversal components
 * @param {string} filename - Filename to validate
 * @returns {boolean} True if safe
 */
function isValidFilename(filename) {
  if (typeof filename !== 'string' || filename.length === 0) return false;
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) return false;
  if (filename !== path.basename(filename)) return false;
  return true;
}

/**
 * Generates a unique ID using crypto-safe random bytes
 * @returns {string} Unique identifier
 */
function generateId() {
  const { randomBytes } = require('crypto');
  return Date.now().toString(36) + randomBytes(4).toString('hex');
}

const SoundboardService = {
  load,
  getAll,
  getById,
  add,
  update,
  remove,
  reorder,
  getSoundsDir,
  ensureSoundsDir,
};

module.exports = SoundboardService;
