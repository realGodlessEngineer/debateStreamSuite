#!/usr/bin/env node
/**
 * MorphHB Importer
 * Reads the morphhb npm package JSON data and imports all Hebrew Bible words
 * into the hebrew_words SQLite table.
 *
 * Usage: node src/scripts/import-morphhb.js
 *
 * Can also be called programmatically via importMorphhb(db)
 * @module scripts/import-morphhb
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../references.db');

/**
 * Imports all morphhb data into the hebrew_words table
 * @param {Database} db - better-sqlite3 database instance
 * @returns {number} Total words imported
 */
const importMorphhb = (db) => {
  // Require morphhb only during import — this is the large JSON load we want to do once
  const morphhb = require('morphhb');
  const books = Object.keys(morphhb);

  const insert = db.prepare(`
    INSERT INTO hebrew_words (book, chapter, verse, position, hebrew, strongs, morph)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  let totalWords = 0;

  const insertAll = db.transaction(() => {
    for (const book of books) {
      const chapters = morphhb[book];
      for (let ch = 0; ch < chapters.length; ch++) {
        const verses = chapters[ch];
        for (let v = 0; v < verses.length; v++) {
          const words = verses[v];
          for (let pos = 0; pos < words.length; pos++) {
            const [hebrew, strongs, morph] = words[pos];
            insert.run(book, ch + 1, v + 1, pos, hebrew, strongs, morph || '');
            totalWords++;
          }
        }
      }
    }
  });

  insertAll();
  return totalWords;
};

// Run standalone
if (require.main === module) {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS hebrew_words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book TEXT NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      position INTEGER NOT NULL,
      hebrew TEXT NOT NULL,
      strongs TEXT NOT NULL,
      morph TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_hebrew_words_bcv ON hebrew_words(book, chapter, verse);
  `);

  const existing = db.prepare('SELECT COUNT(*) as count FROM hebrew_words').get();
  if (existing.count > 0) {
    console.log(`hebrew_words already has ${existing.count} rows. Clearing for re-import...`);
    db.exec('DELETE FROM hebrew_words');
  }

  console.log('Importing morphhb data into SQLite...');
  const start = Date.now();
  const total = importMorphhb(db);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`Done! Imported ${total} words in ${elapsed}s`);

  db.close();
}

module.exports = { importMorphhb };
