/**
 * Hosts File Service
 * Manages local hostname mappings for the application
 *
 * @module services/hosts
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { SERVER } = require('../config/constants');
const createLogger = require('../utils/logger');

const log = createLogger('Hosts');

// Hosts file location based on OS
const HOSTS_FILE = os.platform() === 'win32'
  ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'drivers', 'etc', 'hosts')
  : '/etc/hosts';

// The hostname we want to map
const HOSTNAME = 'getools';
const LOCALHOST_IP = '127.0.0.1';

/**
 * Check if the hosts file contains the getools mapping
 * Note: Reading the hosts file does NOT require admin privileges
 * @returns {boolean} True if mapping exists
 */
function hasHostsMapping() {
  try {
    const content = fs.readFileSync(HOSTS_FILE, 'utf8');
    // Check for the mapping (with various whitespace patterns)
    const regex = new RegExp(`^\\s*${LOCALHOST_IP}\\s+.*\\b${HOSTNAME}\\b`, 'm');
    return regex.test(content);
  } catch (error) {
    log.error(`Error reading hosts file: ${error.message}`);
    return false;
  }
}

/**
 * Add the getools hostname mapping to the hosts file
 * Note: Writing to the hosts file REQUIRES admin privileges
 * @returns {boolean} True if successful
 */
function addHostsMapping() {
  try {
    // Entry to add
    const entry = `\n# DebateStreamSuite\n${LOCALHOST_IP}\t${HOSTNAME}\n`;

    // Append the entry (requires admin)
    fs.appendFileSync(HOSTS_FILE, entry, 'utf8');

    log.info(`Added mapping: ${LOCALHOST_IP} -> ${HOSTNAME}`);
    return true;
  } catch (error) {
    if (error.code === 'EPERM' || error.code === 'EACCES') {
      log.warn(`Cannot add mapping (admin privileges required)`);
      log.warn(`To enable http://${HOSTNAME}:${SERVER.PORT}/, add this line to ${HOSTS_FILE}:`);
      log.warn(`  ${LOCALHOST_IP}\t${HOSTNAME}`);
    } else {
      log.error(`Error writing hosts file: ${error.message}`);
    }
    return false;
  }
}

/**
 * Ensure the getools hostname is mapped to localhost
 * Called on server startup
 */
function ensureHostsMapping() {
  log.info('Checking hostname mapping...');

  if (hasHostsMapping()) {
    log.info(`Mapping exists: ${HOSTNAME} -> ${LOCALHOST_IP}`);
    return true;
  }

  log.info('Mapping not found, attempting to add...');
  return addHostsMapping();
}

/**
 * Get the configured hostname
 * @returns {string} The hostname
 */
function getHostname() {
  return HOSTNAME;
}

const HostsService = {
  ensureHostsMapping,
  hasHostsMapping,
  addHostsMapping,
  getHostname,
  HOSTNAME,
  HOSTS_FILE,
};

module.exports = HostsService;
