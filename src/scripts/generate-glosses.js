#!/usr/bin/env node
/**
 * AI Gloss Generator
 * Two-phase script:
 *   Phase 1: Fetches missing lexicon definitions from Bolls.life API
 *   Phase 2: Sends definitions to Claude to generate concise glosses
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node src/scripts/generate-glosses.js
 *
 * Options:
 *   --batch-size N       Entries per Claude API call (default: 50)
 *   --model MODEL        Claude model (default: claude-haiku-4-5-20251001)
 *   --fetch-concurrency  Concurrent Bolls.life API requests (default: 5)
 *   --force              Re-generate glosses for entries that already have one
 *   --skip-fetch         Skip phase 1, only generate glosses for existing entries
 *   --fetch-only         Only fetch lexicon entries, skip gloss generation
 *   --dry-run            Preview without calling any APIs
 *
 * @module scripts/generate-glosses
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const Database = require('better-sqlite3');
const Anthropic = require('@anthropic-ai/sdk').default;

const DB_PATH = path.join(__dirname, '../../references.db');

const BOLLS_BASE_URL = 'https://bolls.life';

const SYSTEM_PROMPT = `You are a biblical languages expert generating concise glosses for a Bible study interlinear display.

For each Strong's number and its definition, provide a single concise English gloss (1-3 words, max 4 words for phrases).

Rules:
- The gloss should be the PRIMARY, most common meaning of the word
- For verbs, use the infinitive form: "to create", "to know", "to live"
- For nouns, use the base form: "woman", "heaven", "earth"
- For particles/conjunctions, use the English equivalent: "and", "not", "which"
- For the definite article or object markers, use a functional label: "(definite article)", "(object marker)"
- Prefer concrete, common English words over technical or archaic terms
- Do NOT include Strong's numbers, transliterations, or parenthetical notes in the gloss
- Do NOT include multiple unrelated meanings — pick the most representative one

Respond with ONLY a JSON object mapping each Strong's number to its gloss. No explanation, no markdown, no code fences.

Example input:
H7225: "first, beginning, best, chief"
H1254: "to create, shape, form"
H430: "(plural) rulers, judges, divine ones, angels, gods, (plural intensive) god, goddess"

Example output:
{"H7225":"beginning","H1254":"to create","H430":"God"}`;

// ============================================
// CLI Argument Parsing
// ============================================

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    batchSize: 50,
    model: 'claude-haiku-4-5-20251001',
    fetchConcurrency: 5,
    force: false,
    skipFetch: false,
    fetchOnly: false,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--batch-size':
        opts.batchSize = parseInt(args[++i], 10) || 50;
        break;
      case '--model':
        opts.model = args[++i];
        break;
      case '--fetch-concurrency':
        opts.fetchConcurrency = parseInt(args[++i], 10) || 5;
        break;
      case '--force':
        opts.force = true;
        break;
      case '--skip-fetch':
        opts.skipFetch = true;
        break;
      case '--fetch-only':
        opts.fetchOnly = true;
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
    }
  }

  return opts;
}

// ============================================
// Phase 1: Fetch Lexicon Definitions
// ============================================

/**
 * Strips HTML tags, preserving text content
 */
function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '')
    .replace(/<li>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extracts the original word from the HTML definition
 */
function extractOriginalWord(definition) {
  const match = definition.match(/<(?:he|el)>([^<]+)<\/(?:he|el)>/);
  return match ? match[1] : null;
}

/**
 * Fetches a single lexicon entry from Bolls.life
 */
async function fetchLexiconEntry(strongsNumber) {
  const url = `${BOLLS_BASE_URL}/dictionary-definition/BDBT/${strongsNumber}/`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API error ${response.status} for ${strongsNumber}`);
  }

  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`No entry found for ${strongsNumber}`);
  }

  const entry = data[0];
  const originalWord = extractOriginalWord(entry.definition || '');

  return {
    strongsNumber: entry.topic || strongsNumber,
    definition: entry.definition ? stripHtml(entry.definition) : '',
    shortDefinition: entry.short_definition || '',
    transliteration: entry.transliteration || '',
    pronunciation: entry.pronunciation || '',
    lemma: entry.lexeme || originalWord || '',
  };
}

/**
 * Fetches all missing lexicon entries from the API
 */
async function fetchMissingLexicon(db, missingStrongs, concurrency, dryRun) {
  console.log(`\n=== Phase 1: Fetch Lexicon Definitions ===`);
  console.log(`Missing entries: ${missingStrongs.length}`);

  if (missingStrongs.length === 0) {
    console.log('All lexicon entries already cached.');
    return;
  }

  if (dryRun) {
    console.log(`Would fetch ${missingStrongs.length} entries from Bolls.life API`);
    console.log(`Sample: ${missingStrongs.slice(0, 10).join(', ')}...`);
    return;
  }

  const insert = db.prepare(`
    INSERT OR IGNORE INTO lexicon_entries (strongs_number, definition, short_definition, transliteration, pronunciation, lemma, response_json, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const queue = [...missingStrongs];
  let fetched = 0;
  let errors = 0;
  const startTime = Date.now();

  const worker = async () => {
    while (queue.length > 0) {
      const strongs = queue.shift();
      try {
        const entry = await fetchLexiconEntry(strongs);
        insert.run(
          entry.strongsNumber, entry.definition, entry.shortDefinition,
          entry.transliteration, entry.pronunciation, entry.lemma,
          JSON.stringify(entry), Date.now()
        );
        fetched++;
        if (fetched % 100 === 0) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
          const remaining = queue.length;
          console.log(`  Fetched: ${fetched} | Remaining: ${remaining} | Errors: ${errors} | ${elapsed}s elapsed`);
        }
      } catch (error) {
        errors++;
        if (errors <= 10) {
          console.log(`  Warning: ${strongs}: ${error.message}`);
        } else if (errors === 11) {
          console.log('  (suppressing further error messages)');
        }
      }
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, queue.length) },
    () => worker()
  );
  await Promise.all(workers);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`  Done! Fetched: ${fetched} | Errors: ${errors} | ${elapsed}s`);
}

// ============================================
// Phase 2: Generate AI Glosses
// ============================================

/**
 * Extracts a condensed definition summary for the Claude prompt
 */
function extractMeanings(definition) {
  if (!definition) return '';

  // Hebrew BDB format
  const bdbMatch = definition.match(/(?:BDB )?Definition[:\s]*-\s*([\s\S]+?)(?:\n\s*(?:Origin|TWOT|Part))/i);
  if (bdbMatch) {
    return bdbMatch[1]
      .split(/\s*-\s*/)
      .map(s => s.trim().replace(/\n/g, ' ').replace(/\s+/g, ' '))
      .filter(Boolean)
      .join(', ')
      .slice(0, 300);
  }

  // Greek numbered format
  const lines = definition.split('\n').map(l => l.trim()).filter(Boolean);
  const defs = [];
  for (const line of lines) {
    const match = line.match(/^\d+\.\s+(.+)/);
    if (match) defs.push(match[1].trim());
  }
  if (defs.length > 0) return defs.join(', ').slice(0, 300);

  // Fallback: strip metadata
  return definition
    .replace(/^.*?Definition[:\s]*/i, '')
    .replace(/\s*-?\s*Origin:[\s\S]*/i, '')
    .replace(/\s*-?\s*TDNT[\s\S]*/i, '')
    .replace(/\s*-?\s*TWOT[\s\S]*/i, '')
    .replace(/\s*-?\s*Part\(s\)[\s\S]*/i, '')
    .replace(/\s*-?\s*Strongs:[\s\S]*/i, '')
    .replace(/^-\s*Original:.*?\n/im, '')
    .replace(/^-\s*Transliteration:.*?\n/im, '')
    .replace(/^-\s*Phonetic:.*?\n/im, '')
    .trim()
    .slice(0, 300);
}

/**
 * Sends a batch of entries to Claude and returns the glosses
 */
async function processBatch(client, entries, model) {
  let prompt = '';
  for (const entry of entries) {
    const meanings = extractMeanings(entry.definition);
    prompt += `${entry.strongs_number}: "${meanings}"\n`;
  }

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text.trim();
  const jsonStr = text.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  return JSON.parse(jsonStr);
}

/**
 * Generates AI glosses for all lexicon entries
 */
async function generateGlosses(db, opts) {
  console.log(`\n=== Phase 2: Generate AI Glosses ===`);

  const query = opts.force
    ? "SELECT strongs_number, definition, short_definition FROM lexicon_entries WHERE definition != '' ORDER BY strongs_number"
    : "SELECT strongs_number, definition, short_definition FROM lexicon_entries WHERE ai_gloss IS NULL AND definition != '' ORDER BY strongs_number";
  const entries = db.prepare(query).all();

  if (entries.length === 0) {
    console.log('All entries already have AI glosses. Use --force to regenerate.');
    return;
  }

  console.log(`Entries to process: ${entries.length}`);
  console.log(`Batch size: ${opts.batchSize} | Model: ${opts.model}`);

  if (opts.dryRun) {
    console.log(`Would send ${Math.ceil(entries.length / opts.batchSize)} API requests`);
    const sample = entries.slice(0, 5);
    for (const e of sample) {
      console.log(`  ${e.strongs_number}: "${extractMeanings(e.definition).slice(0, 60)}..."`);
    }
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is required for Phase 2.');
    console.error('Run with --fetch-only to skip gloss generation, or set the key.');
    return;
  }

  const client = new Anthropic();
  const update = db.prepare('UPDATE lexicon_entries SET ai_gloss = ? WHERE strongs_number = ?');

  const batches = [];
  for (let i = 0; i < entries.length; i += opts.batchSize) {
    batches.push(entries.slice(i, i + opts.batchSize));
  }

  let totalProcessed = 0;
  let totalErrors = 0;
  const startTime = Date.now();

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchNum = i + 1;
    process.stdout.write(`  Batch ${batchNum}/${batches.length} (${batch[0].strongs_number}-${batch[batch.length - 1].strongs_number})...`);

    try {
      const glosses = await processBatch(client, batch, opts.model);

      const updateMany = db.transaction((results) => {
        for (const [strongs, gloss] of Object.entries(results)) {
          if (typeof gloss === 'string' && gloss.length > 0) {
            update.run(gloss, strongs);
          }
        }
      });

      updateMany(glosses);
      const count = Object.keys(glosses).length;
      totalProcessed += count;
      console.log(` ${count} glosses`);

      // Rate limit between batches
      if (i < batches.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (error) {
      console.log(` ERROR: ${error.message}`);
      totalErrors++;
      // Back off on error
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n  Done! Processed: ${totalProcessed} | Errors: ${totalErrors} | ${elapsed}s`);
}

// ============================================
// Main
// ============================================

async function main() {
  const opts = parseArgs();

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // Ensure ai_gloss column exists
  const cols = db.prepare('PRAGMA table_info(lexicon_entries)').all();
  if (!cols.find(c => c.name === 'ai_gloss')) {
    db.exec('ALTER TABLE lexicon_entries ADD COLUMN ai_gloss TEXT DEFAULT NULL');
    console.log('Added ai_gloss column to lexicon_entries');
  }

  // Get all unique Hebrew Strong's numbers from hebrew_words
  const rows = db.prepare("SELECT DISTINCT strongs FROM hebrew_words WHERE strongs != ''").all();
  const hebrewStrongs = new Set();
  for (const row of rows) {
    for (const part of row.strongs.split('/')) {
      if (/^H\d+$/.test(part)) hebrewStrongs.add(part);
    }
  }

  // Greek Strong's numbers: G1 through G5624 (standard NT range)
  const GREEK_MAX = 5624;
  const greekStrongs = new Set();
  for (let i = 1; i <= GREEK_MAX; i++) {
    greekStrongs.add(`G${i}`);
  }

  const allStrongs = new Set([...hebrewStrongs, ...greekStrongs]);

  // Find which ones we're missing lexicon entries for
  const cachedStrongs = new Set(
    db.prepare('SELECT strongs_number FROM lexicon_entries').all().map(r => r.strongs_number)
  );
  const missingStrongs = [...allStrongs].filter(s => !cachedStrongs.has(s)).sort((a, b) => {
    const prefA = a[0], prefB = b[0];
    if (prefA !== prefB) return prefA.localeCompare(prefB);
    return parseInt(a.slice(1)) - parseInt(b.slice(1));
  });

  console.log(`Hebrew: ${hebrewStrongs.size} | Greek: ${greekStrongs.size} | Total: ${allStrongs.size} unique Strong's numbers`);
  console.log(`Lexicon cached: ${cachedStrongs.size} | Missing: ${missingStrongs.length}`);

  // Phase 1: Fetch missing lexicon definitions
  if (!opts.skipFetch) {
    await fetchMissingLexicon(db, missingStrongs, opts.fetchConcurrency, opts.dryRun);
  }

  // Phase 2: Generate AI glosses
  if (!opts.fetchOnly) {
    await generateGlosses(db, opts);
  }

  // Summary
  const total = db.prepare('SELECT COUNT(*) as c FROM lexicon_entries').get().c;
  const withGloss = db.prepare('SELECT COUNT(*) as c FROM lexicon_entries WHERE ai_gloss IS NOT NULL').get().c;
  console.log(`\n=== Summary ===`);
  console.log(`Lexicon entries: ${total}`);
  console.log(`With AI gloss: ${withGloss}/${total}`);

  db.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
