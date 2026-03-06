/**
 * Simple structured logger with log levels
 * @module utils/logger
 */

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL] ?? (
  process.env.NODE_ENV === 'production' ? LOG_LEVELS.info : LOG_LEVELS.debug
);

/**
 * Creates a namespaced logger
 * @param {string} namespace - Logger namespace (e.g., 'Hosts', 'Cache')
 * @returns {Object} Logger with debug, info, warn, error methods
 */
function createLogger(namespace) {
  const prefix = namespace ? `[${namespace}]` : '';

  return {
    debug(...args) {
      if (currentLevel <= LOG_LEVELS.debug) console.log(prefix, ...args);
    },
    info(...args) {
      if (currentLevel <= LOG_LEVELS.info) console.log(prefix, ...args);
    },
    warn(...args) {
      if (currentLevel <= LOG_LEVELS.warn) console.warn(prefix, ...args);
    },
    error(...args) {
      if (currentLevel <= LOG_LEVELS.error) console.error(prefix, ...args);
    },
  };
}

module.exports = createLogger;
