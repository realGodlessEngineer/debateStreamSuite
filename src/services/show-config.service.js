/**
 * Show Config Service
 * Manages persistent show title and host configuration
 * @module services/showconfig
 */

const path = require('path');
const createLogger = require('../utils/logger');
const { readJsonSafe, createWriteQueue } = require('../utils/safe-file');

const log = createLogger('ShowConfig');

const CONFIG_FILE = path.join(__dirname, '../../show-config.json');

// Serialized write queue for atomic saves
const saveQueued = createWriteQueue(CONFIG_FILE);

const DEFAULT_CONFIG = {
  showTitle: '',
  hosts: [],
};

let config = { ...DEFAULT_CONFIG };

/**
 * Loads configuration from disk with backup fallback
 */
function load() {
  const { data, source } = readJsonSafe(CONFIG_FILE);

  if (!data) {
    log.info('No existing show config found, using defaults');
    return;
  }

  if (source === 'backup') {
    log.warn('Loaded show config from backup file — primary was corrupted');
  }

  config = { ...DEFAULT_CONFIG, ...data };
}

/**
 * Saves configuration to disk using atomic write queue
 */
function save() {
  saveQueued(config)
    .then(ok => {
      if (!ok) log.error('Failed to save show config');
    });
}

/**
 * Gets the current show config
 * @returns {Object} Show config
 */
function get() {
  return { ...config };
}

/**
 * Updates the show config
 * @param {Object} updates - Partial config updates
 * @returns {Object} Updated config
 */
function update(updates) {
  if (updates.showTitle !== undefined) {
    config.showTitle = updates.showTitle;
  }
  if (updates.hosts !== undefined) {
    // Validate hosts array (max 2)
    config.hosts = updates.hosts.slice(0, 2).map(h => ({
      name: h.name || '',
      pronouns: h.pronouns || '',
    }));
  }
  save();
  return get();
}

/**
 * Resets config to defaults
 * @returns {Object} Default config
 */
function reset() {
  config = { ...DEFAULT_CONFIG };
  save();
  return get();
}

const ShowConfigService = {
  load,
  get,
  update,
  reset,
};

module.exports = ShowConfigService;
