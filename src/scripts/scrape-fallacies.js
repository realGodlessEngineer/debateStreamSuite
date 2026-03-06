#!/usr/bin/env node
/**
 * Fallacy Scraper
 * Parses the local index HTML and fetches additional batches from the website
 * to build a complete database of logical fallacies.
 *
 * Usage: node src/scripts/scrape-fallacies.js
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const INDEX_FILE = path.join(__dirname, '../../data/LogicallyFallacious-index.htm');
const DB_FILE = path.join(__dirname, '../../fallacies-db.json');
const BATCH_URL = 'https://www.logicallyfallacious.com/welcome';
const BASE_URL = 'https://www.logicallyfallacious.com/logicalfallacies/';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Sleep for a random duration to simulate human browsing
 * @param {number} minMs - Minimum milliseconds
 * @param {number} maxMs - Maximum milliseconds
 */
function sleep(minMs = 2000, maxMs = 5000) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  console.log(`  Pausing ${(ms / 1000).toFixed(1)}s...`);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extracts fallacy entries from HTML containing list-group-item links
 * @param {string} html - HTML content to parse
 * @returns {Array} Array of fallacy objects
 */
function extractFallaciesFromHtml(html) {
  const $ = cheerio.load(html);
  const fallacies = [];

  $('a.list-group-item').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href') || '';
    const name = $el.find('h4').text().trim();
    const definition = $el.find('p.mb-2 b').text().trim();
    const aliasesRaw = $el.find('.small i').text().trim();
    const aliases = aliasesRaw
      ? aliasesRaw.split(',').map((a) => a.trim()).filter(Boolean)
      : [];

    // Extract slug from URL
    const slug = href.replace(BASE_URL, '').replace(/^\//, '');

    if (name && definition) {
      fallacies.push({
        name,
        slug,
        definition,
        aliases,
        url: href,
      });
    }
  });

  return fallacies;
}

/**
 * Extracts the next batch number from HTML
 * @param {string} html - HTML content
 * @returns {number|null} Next batch number or null if no more
 */
function extractNextBatch(html) {
  const $ = cheerio.load(html);
  const batchInput = $('input#batch');
  if (batchInput.length) {
    const val = parseInt(batchInput.val(), 10);
    return isNaN(val) ? null : val;
  }
  return null;
}

/**
 * Fetches a batch of fallacies from the website
 * @param {number} batch - Batch offset number
 * @returns {Promise<string>} HTML response
 */
async function fetchBatch(batch) {
  const body = `viaajax=1&batch=${batch}&pageSearch=`;
  const response = await fetch(BATCH_URL, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'text/html',
      'Referer': 'https://www.logicallyfallacious.com/logicalfallacies/search',
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching batch ${batch}`);
  }

  return response.text();
}

/**
 * Main scraper function
 */
async function main() {
  console.log('=== Logical Fallacies Scraper ===\n');

  // Step 1: Parse the local index file
  console.log('Step 1: Parsing local index file...');
  if (!fs.existsSync(INDEX_FILE)) {
    console.error(`Index file not found: ${INDEX_FILE}`);
    process.exit(1);
  }

  const indexHtml = fs.readFileSync(INDEX_FILE, 'utf8');
  let allFallacies = extractFallaciesFromHtml(indexHtml);
  let nextBatch = extractNextBatch(indexHtml);

  console.log(`  Found ${allFallacies.length} fallacies in local index`);
  console.log(`  Next batch: ${nextBatch}`);

  // Step 2: Fetch additional batches from the website
  console.log('\nStep 2: Fetching additional batches from website...');
  const seenSlugs = new Set(allFallacies.map((f) => f.slug));
  let batchCount = 0;
  const MAX_BATCHES = 20; // Safety limit

  while (nextBatch !== null && batchCount < MAX_BATCHES) {
    batchCount++;
    console.log(`\n  Fetching batch ${nextBatch} (request ${batchCount})...`);

    try {
      await sleep(2000, 4000);
      const batchHtml = await fetchBatch(nextBatch);
      const batchFallacies = extractFallaciesFromHtml(batchHtml);
      const newNextBatch = extractNextBatch(batchHtml);

      // Add only new fallacies (deduplicate)
      let newCount = 0;
      for (const f of batchFallacies) {
        if (!seenSlugs.has(f.slug)) {
          seenSlugs.add(f.slug);
          allFallacies.push(f);
          newCount++;
        }
      }

      console.log(`  Got ${batchFallacies.length} entries (${newCount} new)`);
      console.log(`  Total so far: ${allFallacies.length}`);

      // Check if there are more batches
      if (newNextBatch === null || newNextBatch === nextBatch || batchFallacies.length === 0) {
        console.log('  No more batches to fetch.');
        break;
      }

      nextBatch = newNextBatch;
    } catch (error) {
      console.error(`  Error fetching batch ${nextBatch}: ${error.message}`);
      console.log('  Continuing with what we have...');
      break;
    }
  }

  // Step 3: Save to database
  console.log(`\n=== Results ===`);
  console.log(`Total fallacies scraped: ${allFallacies.length}`);

  // Sort alphabetically by name
  allFallacies.sort((a, b) => a.name.localeCompare(b.name));

  // Build the database object keyed by slug
  const db = {};
  for (const f of allFallacies) {
    db[f.slug] = {
      name: f.name,
      slug: f.slug,
      definition: f.definition,
      aliases: f.aliases,
      url: f.url,
      scrapedAt: Date.now(),
    };
  }

  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  console.log(`\nDatabase saved to: ${DB_FILE}`);
  console.log(`Entries: ${Object.keys(db).length}`);

  // Show first few entries as sample
  console.log('\nSample entries:');
  const sample = allFallacies.slice(0, 3);
  for (const f of sample) {
    console.log(`  - ${f.name}: ${f.definition.substring(0, 80)}...`);
  }
}

main().catch((error) => {
  console.error('Scraper failed:', error);
  process.exit(1);
});
