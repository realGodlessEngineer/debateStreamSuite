/**
 * SQLite database service
 * Provides a single database for all reference caching and storage
 * @module services/database
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { SERVER } = require('../config/constants');
const createLogger = require('../utils/logger');

const log = createLogger('Database');

let db = null;

/**
 * Creates all required tables if they don't exist
 */
const createTables = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bible_verses (
      key TEXT PRIMARY KEY,
      reference TEXT NOT NULL,
      version TEXT NOT NULL,
      version_name TEXT,
      text TEXT,
      book TEXT,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quran_verses (
      key TEXT PRIMARY KEY,
      reference TEXT NOT NULL,
      version TEXT NOT NULL,
      version_name TEXT,
      text TEXT,
      surah_name TEXT,
      surah_number INTEGER,
      verses_json TEXT,
      total_verses INTEGER,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dictionary_entries (
      key TEXT PRIMARY KEY,
      reference TEXT NOT NULL,
      version TEXT NOT NULL,
      version_name TEXT,
      text TEXT,
      first_letter TEXT,
      phonetic TEXT,
      etymology TEXT,
      audio_url TEXT,
      verses_json TEXT,
      total_verses INTEGER,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fallacies (
      slug TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      definition TEXT NOT NULL,
      aliases_json TEXT,
      url TEXT,
      scraped_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_bible_book ON bible_verses(book);
    CREATE INDEX IF NOT EXISTS idx_bible_reference ON bible_verses(reference);
    CREATE INDEX IF NOT EXISTS idx_quran_surah ON quran_verses(surah_name);
    CREATE INDEX IF NOT EXISTS idx_quran_reference ON quran_verses(reference);
    CREATE INDEX IF NOT EXISTS idx_dict_letter ON dictionary_entries(first_letter);
    CREATE INDEX IF NOT EXISTS idx_dict_reference ON dictionary_entries(reference);
    CREATE INDEX IF NOT EXISTS idx_fallacy_name ON fallacies(name);
  `);
};

/**
 * Migrates existing JSON cache files into SQLite
 */
const migrateJsonData = () => {
  const migrated = { bible: 0, quran: 0, dictionary: 0, fallacies: 0 };

  // Migrate Bible verse cache
  const biblePath = SERVER.CACHE_FILE;
  if (fs.existsSync(biblePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(biblePath, 'utf8'));
      const insert = db.prepare(`
        INSERT OR IGNORE INTO bible_verses (key, reference, version, version_name, text, book, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const insertMany = db.transaction((entries) => {
        for (const [key, v] of entries) {
          insert.run(key, v.reference, v.version, v.versionName || '', v.text || '', v.book || '', v.timestamp || Date.now());
        }
      });
      const entries = Object.entries(data);
      insertMany(entries);
      migrated.bible = entries.length;
      log.info(`Migrated ${entries.length} Bible verses from JSON`);
    } catch (err) {
      log.warn(`Failed to migrate Bible cache: ${err.message}`);
    }
  }

  // Migrate Quran verse cache
  const quranPath = SERVER.QURAN_CACHE_FILE;
  if (fs.existsSync(quranPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(quranPath, 'utf8'));
      const insert = db.prepare(`
        INSERT OR IGNORE INTO quran_verses (key, reference, version, version_name, text, surah_name, surah_number, verses_json, total_verses, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertMany = db.transaction((entries) => {
        for (const [key, v] of entries) {
          insert.run(
            key, v.reference, v.version, v.versionName || '',
            v.text || '', v.surahName || '', v.surahNumber || 0,
            v.verses ? JSON.stringify(v.verses) : '[]',
            v.totalVerses || 0, v.timestamp || Date.now()
          );
        }
      });
      const entries = Object.entries(data);
      insertMany(entries);
      migrated.quran = entries.length;
      log.info(`Migrated ${entries.length} Quran verses from JSON`);
    } catch (err) {
      log.warn(`Failed to migrate Quran cache: ${err.message}`);
    }
  }

  // Migrate Dictionary cache
  const dictPath = SERVER.DICTIONARY_CACHE_FILE;
  if (fs.existsSync(dictPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(dictPath, 'utf8'));
      const insert = db.prepare(`
        INSERT OR IGNORE INTO dictionary_entries (key, reference, version, version_name, text, first_letter, phonetic, etymology, audio_url, verses_json, total_verses, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertMany = db.transaction((entries) => {
        for (const [key, v] of entries) {
          insert.run(
            key, v.reference, v.version, v.versionName || '',
            v.text || '', v.firstLetter || '', v.phonetic || '',
            v.etymology || '', v.audioUrl || '',
            v.verses ? JSON.stringify(v.verses) : '[]',
            v.totalVerses || 0, v.timestamp || Date.now()
          );
        }
      });
      const entries = Object.entries(data);
      insertMany(entries);
      migrated.dictionary = entries.length;
      log.info(`Migrated ${entries.length} dictionary entries from JSON`);
    } catch (err) {
      log.warn(`Failed to migrate dictionary cache: ${err.message}`);
    }
  }

  // Migrate Fallacies database
  const fallacyPath = SERVER.FALLACY_DB_FILE;
  if (fs.existsSync(fallacyPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(fallacyPath, 'utf8'));
      const insert = db.prepare(`
        INSERT OR IGNORE INTO fallacies (slug, name, definition, aliases_json, url, scraped_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const insertMany = db.transaction((entries) => {
        for (const [slug, f] of entries) {
          insert.run(
            slug, f.name, f.definition,
            f.aliases ? JSON.stringify(f.aliases) : '[]',
            f.url || '', f.scrapedAt || null
          );
        }
      });
      const entries = Object.entries(data);
      insertMany(entries);
      migrated.fallacies = entries.length;
      log.info(`Migrated ${entries.length} fallacies from JSON`);
    } catch (err) {
      log.warn(`Failed to migrate fallacies: ${err.message}`);
    }
  }

  return migrated;
};

const DatabaseService = {
  /**
   * Initializes the database connection, creates tables, and migrates data
   * @returns {boolean} Success status
   */
  initialize() {
    try {
      const dbPath = SERVER.DB_FILE;
      const isNewDb = !fs.existsSync(dbPath);

      db = new Database(dbPath);
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');

      createTables();

      if (isNewDb) {
        log.info('New database created, migrating existing JSON data...');
        const migrated = migrateJsonData();
        const total = migrated.bible + migrated.quran + migrated.dictionary + migrated.fallacies;
        if (total > 0) {
          log.info(`Migration complete: ${total} total records imported`);
        }
      }

      log.info(`Database initialized at ${dbPath}`);
      return true;
    } catch (error) {
      log.error(`Failed to initialize database: ${error.message}`);
      return false;
    }
  },

  /**
   * Returns the database instance
   * @returns {Database} better-sqlite3 database instance
   */
  getDb() {
    if (!db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return db;
  },

  /**
   * Closes the database connection gracefully
   */
  close() {
    if (db) {
      db.close();
      db = null;
      log.info('Database connection closed');
    }
  },
};

module.exports = DatabaseService;
