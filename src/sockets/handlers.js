/**
 * Socket.io Event Handlers
 * Real-time communication handlers for displays and controls
 * @module sockets/handlers
 */

const StateManager = require('../state');
const { DISPLAY, CALLER, QUEUE, STAGE, SCENE, SCOREBOARD, CLAIM, TICKER } = require('../config/constants');
const SoundboardService = require('../services/soundboard.service');
const ShowConfigService = require('../services/show-config.service');
const createLogger = require('../utils/logger');

const log = createLogger('Socket');

// ============================================
// Validation Helpers
// ============================================

const MAX_STRING_LENGTH = 200;

/**
 * Sanitizes a string value: ensures type and enforces max length
 * @param {*} value - Value to sanitize
 * @param {string} fallback - Default if invalid
 * @param {number} maxLen - Maximum allowed length
 * @returns {string} Sanitized string
 */
function sanitizeString(value, fallback = '', maxLen = MAX_STRING_LENGTH) {
  if (typeof value !== 'string') return fallback;
  return value.slice(0, maxLen).trim();
}

/**
 * Validates a debate stance against the allowlist
 * @param {*} value - Raw stance value
 * @returns {string} A valid stance key, or '' if none/invalid
 */
function sanitizeStance(value) {
  const raw = sanitizeString(value, '', 20).toLowerCase();
  return CALLER.STANCES.includes(raw) ? raw : '';
}

/**
 * Validates and sanitizes caller data
 * @param {*} data - Raw socket data
 * @returns {Object|null} Sanitized data or null if invalid
 */
function validateCallerData(data) {
  if (!data || typeof data !== 'object') return null;
  return {
    name: sanitizeString(data.name),
    pronouns: sanitizeString(data.pronouns, '', 50),
    stance: sanitizeStance(data.stance),
  };
}

/**
 * Validates and sanitizes a caller-queue item
 * @param {*} data - Raw socket data
 * @returns {Object|null} Sanitized item or null if invalid (name is required)
 */
function validateQueueItem(data) {
  if (!data || typeof data !== 'object') return null;
  const name = sanitizeString(data.name);
  if (!name) return null;
  return {
    name,
    pronouns: sanitizeString(data.pronouns, '', 50),
    stance: sanitizeStance(data.stance),
    topic: sanitizeString(data.topic, '', 200),
    platform: sanitizeString(data.platform, '', 50),
  };
}

/**
 * Validates and sanitizes stage-topics data
 * @param {*} payload - Raw socket data { items, visible }
 * @returns {Object|null} Sanitized { items, visible } or null if invalid
 */
function validateTopics(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.items)) return null;
  const items = payload.items
    .map(item => String(item).trim())
    .filter(Boolean)
    .slice(0, STAGE.MAX_TOPICS)
    .map(item => item.slice(0, STAGE.TOPIC_MAX_LENGTH));
  return {
    items,
    visible: Boolean(payload.visible),
  };
}

/**
 * Validates and sanitizes call-in data
 * @param {*} payload - Raw socket data { text, visible }
 * @returns {Object|null} Sanitized { text, visible } or null if invalid
 */
function validateCallIn(payload) {
  if (!payload || typeof payload !== 'object') return null;
  return {
    text: String(payload.text || '').trim().slice(0, STAGE.CALLIN_MAX_LENGTH),
    visible: Boolean(payload.visible),
  };
}

/**
 * Validates and sanitizes verse display data
 * @param {*} data - Raw socket data
 * @returns {Object|null} Sanitized data or null if invalid
 */
function validateVerseData(data) {
  if (!data || typeof data !== 'object') return null;

  const VALID_SOURCES = ['bible', 'quran', 'hadith', 'dictionary', 'interlinear', ''];
  const rawSource = sanitizeString(data.source, '', 20);
  const source = VALID_SOURCES.includes(rawSource) ? rawSource : '';
  const isInterlinear = source === 'interlinear';

  const verses = Array.isArray(data.verses)
    ? data.verses.map(v => {
        const verse = {
          number: sanitizeString(String(v.number || ''), '', 10),
          text: sanitizeString(v.text, '', 5000),
        };
        // Preserve word objects for interlinear display
        if (isInterlinear && Array.isArray(v.words)) {
          verse.words = v.words.map(w => ({
            original: sanitizeString(w.original, '', 200),
            transliteration: sanitizeString(w.transliteration, '', 200),
            strongs: sanitizeString(w.strongs, '', 20),
            gloss: sanitizeString(w.gloss, '', 200),
          }));
        }
        return verse;
      })
    : [];

  const VALID_LANGUAGES = ['hebrew', 'greek'];
  const rawLang = sanitizeString(data.language, '', 10);

  const result = {
    reference: sanitizeString(data.reference, '', 100),
    version: sanitizeString(data.version, '', 100),
    versionName: sanitizeString(data.versionName, '', 100),
    text: sanitizeString(data.text, '', 50000),
    verses,
    totalVerses: verses.length,
    currentPage: 0,
    versesPerPage: DISPLAY.VERSES_PER_PAGE,
    source,
    // Second-translation compare column, Bible-only. Always defaulted here
    // (not just left undefined) so a compare column from a previous Bible
    // display can never survive into a later non-compare or non-bible one.
    compareVerses: [],
    compareVersion: '',
    compareVersionName: '',
  };

  if (isInterlinear && VALID_LANGUAGES.includes(rawLang)) {
    result.language = rawLang;
  }

  // Compare payload sanitized with the same discipline as `verses` above:
  // Array.isArray guard, bounded string lengths, capped array size.
  if (source === 'bible' && Array.isArray(data.compareVerses)) {
    result.compareVerses = data.compareVerses
      .slice(0, DISPLAY.MAX_COMPARE_VERSES)
      .map(v => ({
        number: sanitizeString(String(v.number || ''), '', 10),
        text: sanitizeString(v.text, '', 5000),
      }));
    result.compareVersion = sanitizeString(data.compareVersion, '', 100);
    result.compareVersionName = sanitizeString(data.compareVersionName, '', 100);
  }

  // Preserve structured lexicon data for display rendering, or clear it
  if (isInterlinear && data.lexicon && typeof data.lexicon === 'object') {
    result.lexicon = {
      lemma: sanitizeString(data.lexicon.lemma, '', 200),
      transliteration: sanitizeString(data.lexicon.transliteration, '', 200),
      pronunciation: sanitizeString(data.lexicon.pronunciation, '', 200),
      morph: sanitizeString(data.lexicon.morph, '', 100),
      origin: sanitizeString(data.lexicon.origin, '', 500),
      partOfSpeech: sanitizeString(data.lexicon.partOfSpeech, '', 100),
      tdnt: sanitizeString(data.lexicon.tdnt, '', 50),
      twot: sanitizeString(data.lexicon.twot, '', 50),
      definitions: Array.isArray(data.lexicon.definitions)
        ? data.lexicon.definitions.slice(0, 50).map(d => sanitizeString(d, '', 500))
        : [],
    };
  } else {
    result.lexicon = null;
  }

  return result;
}

/**
 * Validates page change data
 * @param {*} data - Raw socket data
 * @returns {string|number|null} Direction or null if invalid
 */
function validatePageDirection(data) {
  if (!data || typeof data !== 'object') return null;
  const direction = data.direction || data.page;
  const validDirections = ['next', 'prev', 'first', 'last'];
  if (typeof direction === 'string' && validDirections.includes(direction)) return direction;
  if (typeof direction === 'number' && Number.isFinite(direction) && direction >= 0 && direction <= 10000) return direction;
  return null;
}

/**
 * Validates show config data
 * @param {*} data - Raw socket data
 * @returns {Object|null} Sanitized data or null if invalid
 */
function validateShowConfigData(data) {
  if (!data || typeof data !== 'object') return null;
  const result = {};
  if (data.showTitle !== undefined) {
    result.showTitle = sanitizeString(data.showTitle, '', 100);
  }
  if (Array.isArray(data.hosts)) {
    result.hosts = data.hosts.slice(0, 2).map(h => ({
      name: sanitizeString(h && h.name, '', 100),
      pronouns: sanitizeString(h && h.pronouns, '', 50),
    }));
  }
  return result;
}

/**
 * Validates and sanitizes scene-card data
 * @param {*} data - Raw socket data { key, message, visible }
 * @returns {Object|null} Sanitized { key, message, visible } or null if invalid
 */
function validateSceneData(data) {
  if (!data || typeof data !== 'object') return null;
  const key = sanitizeString(data.key, '', 20);
  // Reject an unknown key rather than coercing it to '' — '' means "no scene",
  // so coercing would let a malformed payload blank a live scene card. Clearing
  // is what clearScene is for.
  if (!SCENE.KEYS.includes(key)) return null;
  return {
    key,
    message: sanitizeString(data.message, '', SCENE.MESSAGE_MAX_LENGTH),
    visible: Boolean(data.visible),
  };
}

/**
 * Validates and sanitizes claim (resolution banner) data
 * @param {*} data - Raw socket data { text, subtext, visible }
 * @returns {Object|null} Sanitized { text, subtext, visible } or null if invalid
 */
function validateClaimData(data) {
  if (!data || typeof data !== 'object') return null;
  return {
    text: sanitizeString(data.text, '', CLAIM.TEXT_MAX_LENGTH),
    subtext: sanitizeString(data.subtext, '', CLAIM.SUBTEXT_MAX_LENGTH),
    visible: Boolean(data.visible),
  };
}

/**
 * Validates a request to arm the segment countdown
 * @param {*} data - Raw socket data { label, durationMs }
 * @returns {Object|null} Sanitized { label, durationMs } or null if invalid
 */
function validateSegmentTimerStart(data) {
  if (!data || typeof data !== 'object') return null;
  const durationMs = Number(data.durationMs);
  if (!Number.isFinite(durationMs) || durationMs <= 0) return null;

  const maxMs = SCENE.MAX_DURATION_SECONDS * 1000;
  return {
    label: sanitizeString(data.label, '', SCENE.LABEL_MAX_LENGTH),
    durationMs: Math.min(durationMs, maxMs),
  };
}

/**
 * Validates a scoreboard adjustment. Only the message shape is checked here
 * (side is a real stance key, delta is a small nonzero integer) - clamping
 * the resulting score to SCOREBOARD.MIN_SCORE/MAX_SCORE happens once, in
 * StateManager.adjustScore, since that's the only place that knows the
 * current total.
 * @param {*} data - Raw socket data { side, delta }
 * @returns {{ side: string, delta: number }|null} Sanitized data or null if invalid
 */
function validateScoreAdjustment(data) {
  if (!data || typeof data !== 'object') return null;

  const side = sanitizeStance(data.side);
  if (!side) return null;

  const delta = Number(data.delta);
  if (!Number.isInteger(delta) || delta === 0) return null;

  return {
    side,
    delta: Math.max(-SCOREBOARD.MAX_DELTA, Math.min(SCOREBOARD.MAX_DELTA, delta)),
  };
}

/**
 * Validates and sanitizes ticker data
 * @param {*} payload - Raw socket data { items, visible }
 * @returns {Object|null} Sanitized { items, visible } or null if invalid
 */
function validateTicker(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.items)) return null;
  const items = payload.items
    .map(item => String(item).trim())
    .filter(Boolean)
    .slice(0, TICKER.MAX_ITEMS)
    .map(item => item.slice(0, TICKER.ITEM_MAX_LENGTH));
  return {
    items,
    visible: Boolean(payload.visible),
  };
}

/**
 * Creates socket event handlers
 * @param {SocketIO.Server} io - Socket.io server instance
 * @returns {Function} Connection handler
 */
const createSocketHandlers = (io) => {
  const broadcastCaller = () => {
    io.emit('callerUpdate', StateManager.getCaller());
  };

  const broadcastQueue = () => {
    io.emit('queueUpdate', StateManager.getQueue());
  };

  const broadcastTopics = () => {
    io.emit('topicsUpdate', StateManager.getTopics());
  };

  const broadcastCallIn = () => {
    io.emit('callInUpdate', StateManager.getCallIn());
  };

  const broadcastVerse = () => {
    io.emit('verseUpdate', StateManager.getVerse());
  };

  const broadcastFallacy = () => {
    io.emit('fallacyUpdate', StateManager.getFallacy());
  };

  const broadcastShowConfig = () => {
    io.emit('showConfigUpdate', StateManager.getShowConfig());
  };

  const broadcastSoundboard = () => {
    io.emit('soundboardUpdate', {
      ...StateManager.getSoundboard(),
      sounds: SoundboardService.getAll(),
    });
  };

  const broadcastScene = () => {
    io.emit('sceneUpdate', StateManager.getScene());
  };

  const broadcastSegmentTimer = () => {
    io.emit('segmentTimerUpdate', StateManager.getSegmentTimer());
  };

  const broadcastScoreboard = () => {
    io.emit('scoreboardUpdate', StateManager.getScoreboard());
  };

  const broadcastClaim = () => {
    io.emit('claimUpdate', StateManager.getClaim());
  };

  const broadcastTicker = () => {
    io.emit('tickerUpdate', StateManager.getTicker());
  };

  /**
   * Handle new socket connections
   * @param {SocketIO.Socket} socket - Connected socket
   */
  const handleConnection = (socket) => {
    log.debug('Client connected:', socket.id);

    // Send current state to newly connected client
    socket.emit('callerUpdate', StateManager.getCaller());
    socket.emit('queueUpdate', StateManager.getQueue());
    socket.emit('topicsUpdate', StateManager.getTopics());
    socket.emit('callInUpdate', StateManager.getCallIn());
    socket.emit('verseUpdate', StateManager.getVerse());
    socket.emit('fallacyUpdate', StateManager.getFallacy());
    socket.emit('soundboardUpdate', {
      ...StateManager.getSoundboard(),
      sounds: SoundboardService.getAll(),
    });
    socket.emit('showConfigUpdate', StateManager.getShowConfig());
    socket.emit('sceneUpdate', StateManager.getScene());
    socket.emit('segmentTimerUpdate', StateManager.getSegmentTimer());
    socket.emit('scoreboardUpdate', StateManager.getScoreboard());
    socket.emit('claimUpdate', StateManager.getClaim());
    socket.emit('tickerUpdate', StateManager.getTicker());

    // ========================================
    // Caller Event Handlers
    // ========================================

    socket.on('updateCaller', (data) => {
      const validated = validateCallerData(data);
      if (!validated) return;

      // Auto-start (reset) the call timer whenever a new/different caller goes
      // live; leave it untouched when only pronouns/stance of the same caller change.
      const prev = StateManager.getCaller();
      const updates = { ...validated };
      if (validated.name && validated.name !== prev.name) {
        updates.timerStartedAt = Date.now();
      } else if (!validated.name) {
        updates.timerStartedAt = null;
      }

      StateManager.updateCaller(updates);
      log.info('Caller updated:', validated.name);
      broadcastCaller();
    });

    socket.on('clearCaller', () => {
      StateManager.clearCaller();
      log.info('Caller cleared');
      broadcastCaller();
    });

    // Manual call-timer control (overrides the auto start/stop above)
    socket.on('startCallerTimer', () => {
      StateManager.updateCaller({ timerStartedAt: Date.now() });
      broadcastCaller();
    });

    socket.on('stopCallerTimer', () => {
      StateManager.updateCaller({ timerStartedAt: null });
      broadcastCaller();
    });

    // ========================================
    // Caller Queue Event Handlers
    // ========================================

    socket.on('queueAdd', (data) => {
      const item = validateQueueItem(data);
      if (!item) return;

      StateManager.addToQueue(item);
      log.info('Queued caller:', item.name);
      broadcastQueue();
    });

    socket.on('queueRemove', (data) => {
      if (!data || typeof data.id !== 'string') return;

      StateManager.removeFromQueue(data.id);
      broadcastQueue();
    });

    socket.on('queueReorder', (data) => {
      if (!data || typeof data.id !== 'string') return;
      const direction = ['up', 'down', 'top'].includes(data.direction) ? data.direction : null;
      if (!direction) return;

      StateManager.reorderQueue(data.id, direction);
      broadcastQueue();
    });

    socket.on('queuePromote', (data) => {
      if (!data || typeof data.id !== 'string') return;

      const item = StateManager.promoteFromQueue(data.id);
      if (!item) return;

      StateManager.updateCaller({
        name: item.name,
        pronouns: item.pronouns,
        stance: item.stance,
        timerStartedAt: Date.now(),
      });
      log.info('Promoted queued caller to live:', item.name);
      broadcastQueue();
      broadcastCaller();
    });

    socket.on('queueClear', () => {
      StateManager.clearQueue();
      log.info('Queue cleared');
      broadcastQueue();
    });

    // ========================================
    // Stage Overlay Event Handlers
    // ========================================

    socket.on('updateTopics', (data) => {
      const validated = validateTopics(data);
      if (!validated) return;

      StateManager.updateTopics(validated);
      log.info('Topics updated:', validated.items.length, '- Visible:', validated.visible);
      broadcastTopics();
    });

    socket.on('updateCallIn', (data) => {
      const validated = validateCallIn(data);
      if (!validated) return;

      StateManager.updateCallIn(validated);
      log.info('Call-in updated - Visible:', validated.visible);
      broadcastCallIn();
    });

    // ========================================
    // Bible Verse Event Handlers
    // ========================================

    socket.on('displayVerse', (data) => {
      const validated = validateVerseData(data);
      if (!validated) return;

      // Clear fallacy when showing a verse
      StateManager.clearFallacy();
      broadcastFallacy();

      const verse = StateManager.updateVerse(validated);
      log.info('Verse displayed:', verse.reference, '- Total verses:', verse.totalVerses);
      broadcastVerse();
    });

    socket.on('clearVerse', () => {
      StateManager.clearVerse();
      log.info('Verse cleared');
      broadcastVerse();
    });

    socket.on('changePage', (data) => {
      const direction = validatePageDirection(data);
      if (direction === null) return;

      StateManager.changePage(direction);
      broadcastVerse();
    });

    // ========================================
    // Fallacy Event Handlers
    // ========================================

    socket.on('displayFallacy', (data) => {
      if (!data || typeof data !== 'object') return;

      // Clear verse when showing a fallacy
      StateManager.clearVerse();
      broadcastVerse();

      const fallacy = StateManager.updateFallacy({
        name: sanitizeString(data.name, '', 500),
        definition: sanitizeString(data.definition, '', 5000),
        slug: sanitizeString(data.slug, '', 200),
      });
      log.info('Fallacy displayed:', fallacy.name);
      broadcastFallacy();
    });

    socket.on('clearFallacy', () => {
      StateManager.clearFallacy();
      log.info('Fallacy cleared');
      broadcastFallacy();
    });

    // ========================================
    // Show Config Event Handlers
    // ========================================

    socket.on('updateShowConfig', (data) => {
      const validated = validateShowConfigData(data);
      if (!validated) return;

      const updated = ShowConfigService.update(validated);
      StateManager.updateShowConfig(updated);
      log.info('Show config updated:', updated.showTitle, '- Hosts:', updated.hosts.length);
      broadcastShowConfig();
    });

    // ========================================
    // Soundboard Event Handlers
    // ========================================

    socket.on('playSound', (data) => {
      if (!data || typeof data.id !== 'string') return;

      const sound = SoundboardService.getById(data.id);
      if (sound) {
        StateManager.updateSoundboard({ currentSound: sound });
        log.info('Playing sound:', sound.name);
        io.emit('soundboardPlay', sound);
      }
    });

    socket.on('stopSound', () => {
      StateManager.updateSoundboard({ currentSound: null });
      log.info('Sound stopped');
      io.emit('soundboardStop');
    });

    socket.on('refreshSounds', () => {
      broadcastSoundboard();
    });

    // ========================================
    // Scene Card Event Handlers
    // ========================================

    socket.on('updateScene', (data) => {
      const validated = validateSceneData(data);
      if (!validated) return;

      StateManager.updateScene(validated);
      log.info('Scene updated:', validated.key || '(cleared)', '- Visible:', validated.visible);
      broadcastScene();
    });

    socket.on('clearScene', () => {
      StateManager.clearScene();
      log.info('Scene cleared');
      broadcastScene();
    });

    // ========================================
    // Segment Countdown Timer Event Handlers
    // ========================================

    socket.on('startSegmentTimer', (data) => {
      const validated = validateSegmentTimerStart(data);
      if (!validated) return;

      StateManager.startSegmentTimer(validated.label, validated.durationMs);
      log.info('Segment timer started:', validated.label || '(untitled)', '-', validated.durationMs, 'ms');
      broadcastSegmentTimer();
    });

    socket.on('stopSegmentTimer', () => {
      StateManager.stopSegmentTimer();
      log.info('Segment timer stopped');
      broadcastSegmentTimer();
    });

    socket.on('segmentTimerReset', () => {
      StateManager.resetSegmentTimer();
      log.info('Segment timer reset');
      broadcastSegmentTimer();
    });

    // ========================================
    // Scoreboard Event Handlers
    // ========================================

    socket.on('scoreboardAdjust', (data) => {
      const validated = validateScoreAdjustment(data);
      if (!validated) return;

      StateManager.adjustScore(validated.side, validated.delta);
      log.info('Scoreboard adjusted:', validated.side, validated.delta > 0 ? `+${validated.delta}` : validated.delta);
      broadcastScoreboard();
    });

    socket.on('scoreboardReset', () => {
      StateManager.resetScoreboard();
      log.info('Scoreboard reset');
      broadcastScoreboard();
    });

    socket.on('scoreboardToggleVisibility', () => {
      const { visible } = StateManager.getScoreboard();
      StateManager.setScoreboardVisible(!visible);
      broadcastScoreboard();
    });

    // ========================================
    // Claim (Resolution Banner) Event Handlers
    // ========================================

    socket.on('updateClaim', (data) => {
      const validated = validateClaimData(data);
      if (!validated) return;

      StateManager.updateClaim(validated);
      log.info('Claim updated:', validated.text, '- Visible:', validated.visible);
      broadcastClaim();
    });

    socket.on('clearClaim', () => {
      StateManager.clearClaim();
      log.info('Claim cleared');
      broadcastClaim();
    });

    // ========================================
    // Ticker Event Handlers
    // ========================================

    socket.on('updateTicker', (data) => {
      const validated = validateTicker(data);
      if (!validated) return;

      StateManager.updateTicker(validated);
      log.info('Ticker updated:', validated.items.length, '- Visible:', validated.visible);
      broadcastTicker();
    });

    // ========================================
    // Disconnect Handler
    // ========================================

    socket.on('disconnect', () => {
      log.debug('Client disconnected:', socket.id);
    });
  };

  return handleConnection;
};

module.exports = createSocketHandlers;
