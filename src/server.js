/**
 * DebateStreamSuite - Main Server
 * A comprehensive real-time streaming toolkit for debate and discussion livestreams
 * 
 * @module server
 */

// Load environment variables first
require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Configuration
const { SERVER } = require('./config/constants');

// Services
const DatabaseService = require('./services/database.service');
const CacheService = require('./services/cache.service');
const QuranCacheService = require('./services/quran-cache.service');
const DictionaryCacheService = require('./services/dictionary-cache.service');
const FallacyService = require('./services/fallacy.service');
const HostsService = require('./services/hosts.service');
const SoundboardService = require('./services/soundboard.service');
const ShowConfigService = require('./services/show-config.service');

// Routes
const apiRoutes = require('./routes/api.routes');
const soundboardRoutes = require('./routes/soundboard.routes');

// Socket handlers
const createSocketHandlers = require('./sockets/handlers');

// ============================================
// Application Setup
// ============================================

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// ============================================
// Middleware
// ============================================

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/sounds', express.static(path.join(__dirname, '../sounds')));

// ============================================
// Routes
// ============================================

app.use('/api', apiRoutes);
app.use('/api/soundboard', soundboardRoutes);

// ============================================
// Socket.io
// ============================================

io.on('connection', createSocketHandlers(io));

// ============================================
// Initialization
// ============================================

// Ensure hosts file mapping exists
HostsService.ensureHostsMapping();

// Load services with error handling
const createLogger = require('./utils/logger');
const initLog = createLogger('Init');

// Initialize database first (all cache services depend on it)
if (!DatabaseService.initialize()) {
  initLog.error('Fatal: database initialization failed. Exiting.');
  process.exit(1);
}

const services = [
  { name: 'Cache', fn: () => CacheService.load() },
  { name: 'QuranCache', fn: () => QuranCacheService.load() },
  { name: 'DictionaryCache', fn: () => DictionaryCacheService.load() },
  { name: 'Fallacies', fn: () => FallacyService.load() },
  { name: 'Soundboard', fn: () => SoundboardService.load() },
  { name: 'ShowConfig', fn: () => ShowConfigService.load() },
];

for (const { name, fn } of services) {
  try {
    fn();
    initLog.info(`${name} loaded successfully`);
  } catch (error) {
    initLog.error(`Failed to load ${name}: ${error.message}`);
  }
}

// Initialize show config state from persisted data
const StateManager = require('./state');
StateManager.updateShowConfig(ShowConfigService.get());

// ============================================
// Start Server
// ============================================

server.listen(SERVER.PORT, () => {
  const hostname = HostsService.getHostname();
  const hasHostsMapping = HostsService.hasHostsMapping();
  const hostUrl = hasHostsMapping ? `http://${hostname}:${SERVER.PORT}` : null;

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║              DebateStreamSuite                                ║
╠══════════════════════════════════════════════════════════════╣
║  Server running on http://localhost:${SERVER.PORT}                    ║${hostUrl ? `
║                    ${hostUrl}                        ║` : ''}
╠══════════════════════════════════════════════════════════════╣
║  Caller Display:                                             ║
║    Control Panel: http://localhost:${SERVER.PORT}/dock.html           ║
║    OBS Display:   http://localhost:${SERVER.PORT}/display.html        ║
╠══════════════════════════════════════════════════════════════╣
║  Reference Repository:                                       ║
║    Control Panel: http://localhost:${SERVER.PORT}/reference-control.html ║
║    OBS Display:   http://localhost:${SERVER.PORT}/bible-display.html  ║
╠══════════════════════════════════════════════════════════════╣
║  Soundboard:                                                 ║
║    Control Panel: http://localhost:${SERVER.PORT}/soundboard.html     ║
╚══════════════════════════════════════════════════════════════╝
  `);

  // Show warning if hosts mapping is missing
  if (!hasHostsMapping) {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║  ⚠️  HOSTS MAPPING NOT CONFIGURED                            ║
╠══════════════════════════════════════════════════════════════╣
║  The '${hostname}' hostname is not mapped to localhost.          ║
║                                                              ║
║  To enable http://${hostname}:${SERVER.PORT}/:                           ║
║    1. Stop this server (Ctrl+C)                              ║
║    2. Run as Administrator / sudo                            ║
║    3. Start the server again                                 ║
║                                                              ║
║  Or manually add this line to your hosts file:               ║
║    127.0.0.1    ${hostname}                                      ║
╚══════════════════════════════════════════════════════════════╝
    `);
  }
});

// ============================================
// Graceful Shutdown
// ============================================

const shutdown = () => {
  console.log('\nShutting down gracefully...');
  DatabaseService.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = { app, server, io };