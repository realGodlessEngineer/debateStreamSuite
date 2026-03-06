/**
 * Safe File Operations
 * Atomic writes with backup to prevent data loss
 * @module utils/safe-file
 */

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const createLogger = require('./logger');

const log = createLogger('SafeFile');

/**
 * Writes JSON data atomically: serialize → write to temp file → rename over target.
 * If the target file already exists, a .bak backup is created first.
 * @param {string} filePath - Target file path
 * @param {*} data - Data to serialize as JSON
 * @returns {Promise<boolean>} True if successful
 */
async function writeJsonAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  const tmpFile = path.join(dir, `.${path.basename(filePath)}.tmp`);
  const bakFile = filePath + '.bak';

  try {
    // Sanity check: data must be a non-null object or array
    if (data === null || typeof data !== 'object') {
      log.error(`Refusing to write non-object data to ${filePath}`);
      return false;
    }

    // Serialize — if this throws, we haven't touched any files
    const json = JSON.stringify(data, null, 2);

    // Write to temp file
    await fsPromises.writeFile(tmpFile, json, 'utf-8');

    // Verify the temp file was written correctly by reading it back
    const verification = await fsPromises.readFile(tmpFile, 'utf-8');
    JSON.parse(verification); // Throws if corrupted

    // Backup existing file (best-effort, don't fail if missing)
    try {
      await fsPromises.copyFile(filePath, bakFile);
    } catch {
      // No existing file to back up — that's fine
    }

    // Atomic rename temp → target
    await fsPromises.rename(tmpFile, filePath);
    return true;
  } catch (error) {
    log.error(`Atomic write failed for ${filePath}:`, error.message);

    // Clean up temp file if it exists
    try {
      await fsPromises.unlink(tmpFile);
    } catch {
      // Already gone or never created
    }
    return false;
  }
}

/**
 * Reads a JSON file with fallback to .bak if the primary is corrupted/missing.
 * @param {string} filePath - Target file path
 * @returns {{ data: *|null, source: string }} Parsed data and which file it came from
 */
function readJsonSafe(filePath) {
  const bakFile = filePath + '.bak';

  // Try primary file
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      if (raw.trim().length > 0) {
        const data = JSON.parse(raw);
        return { data, source: 'primary' };
      }
    }
  } catch (error) {
    log.warn(`Primary file corrupted (${filePath}): ${error.message}`);
  }

  // Try backup
  try {
    if (fs.existsSync(bakFile)) {
      const raw = fs.readFileSync(bakFile, 'utf-8');
      if (raw.trim().length > 0) {
        const data = JSON.parse(raw);
        log.warn(`Recovered from backup: ${bakFile}`);
        return { data, source: 'backup' };
      }
    }
  } catch (error) {
    log.warn(`Backup file also corrupted (${bakFile}): ${error.message}`);
  }

  return { data: null, source: 'none' };
}

/**
 * Creates a serialized write queue for a given file path.
 * Ensures only one write at a time — later writes wait for earlier ones.
 * @param {string} filePath - The file to manage writes for
 * @returns {Function} saveQueued(data) — queues an atomic write, returns Promise<boolean>
 */
function createWriteQueue(filePath) {
  let pending = Promise.resolve(true);

  return function saveQueued(data) {
    pending = pending
      .catch(() => {}) // Don't let prior failures block the queue
      .then(() => writeJsonAtomic(filePath, data));
    return pending;
  };
}

module.exports = {
  writeJsonAtomic,
  readJsonSafe,
  createWriteQueue,
};
