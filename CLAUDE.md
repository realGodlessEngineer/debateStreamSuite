# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

DebateStreamSuite (DSS) — a real-time streaming toolkit for debate livestreams. Manages OBS overlays (caller info, Bible/Quran verses, hadith narrations, logical fallacies, dictionary definitions, Hebrew/Greek interlinear analysis with Strong's lexicon, soundboard) via browser-based control panels and transparent OBS browser sources.

**Stack:** Node.js, Express, Socket.io, Electron, SQLite (better-sqlite3), Cheerio, Multer, dotenv, `@anthropic-ai/sdk` (AI gloss generation), `morphhb` (Hebrew OT data)

## Commands

```bash
npm run dev              # Start server with nodemon auto-reload (port 3666)
npm start                # Production server
npm run electron:dev     # Electron app in development mode
npm run electron         # Electron app in production mode
npm run build            # electron-builder (current platform)
npm run build:win        # Build Windows installer
npm run build:mac        # Build macOS dmg
npm run build:linux      # Build Linux AppImage
npm run release          # Patch bump + Windows build
npm run release:minor    # Minor bump + Windows build
npm run release:major    # Major bump + Windows build
node src/scripts/scrape-fallacies.js    # Rebuild fallacy database from source HTML
node src/scripts/import-morphhb.js      # Import Hebrew OT word data into SQLite
node src/scripts/generate-glosses.js    # Fetch lexicon entries + generate AI glosses (needs ANTHROPIC_API_KEY)
```

No test framework is configured. No linter is configured.

## Architecture

### Data Flow

```
Client emits socket event
  → src/sockets/handlers.js validates/sanitizes payload
  → src/state/index.js updates immutable state (Object.freeze)
  → io.emit() broadcasts to ALL connected clients
```

New connections receive full current state on connect. **Display mutex:** verse (Bible, Quran, hadith, or dictionary) and fallacy share the same display area — showing one clears the other. Interlinear data rides on the verse channel as an extra payload alongside Bible verses. Allowed `verse.source` values: `bible`, `quran`, `hadith`, `dictionary`, `interlinear`, `''` (cleared); the socket handler validates against this allowlist.

### Service Pattern

Every domain has a singleton service in `src/services/` with a consistent API: `load()`, `get()`, `add()`, `remove()`, `clear()`. Services own their data and are the only layer that touches the database or external APIs.

- **Database:** `database.service.js` — SQLite (references.db) with tables: `bible_verses`, `quran_verses`, `hadiths`, `dictionary_entries`, `fallacies`, `interlinear_passages`, `lexicon_entries`, `hebrew_words`
- **Fetch services:** `bible-gateway.service.js` (web scraping), `alquran.service.js` (AlQuran.Cloud API), `hadith.service.js` (fawazahmed0/hadith-api via jsDelivr — 9 English collections; sub-narration suffixes like "muslim 2662c" are accepted but the API has no separate sub-entries, so the base number is fetched), `dictionary.service.js` (Free Dictionary API), `interlinear.service.js` (Hebrew via local morphhb import; Greek via Bolls.life TISCH), `lexicon.service.js` (Strong's definitions via Bolls.life BDBT)
- **Cache services:** `cache.service.js`, `quran-cache.service.js`, `hadith-cache.service.js`, `dictionary-cache.service.js`, `interlinear-cache.service.js` — read/write SQLite (interlinear-cache also stores lexicon entries with optional AI glosses)
- **Other:** `fallacy.service.js`, `soundboard.service.js`, `show-config.service.js`, `hosts.service.js`

### Initialization Order (src/server.js)

DatabaseService must initialize before all cache services. The startup loop loads each service independently — one failure doesn't block others. Order: Cache → QuranCache → HadithCache → DictionaryCache → Fallacies → InterlinearCache → Soundboard → ShowConfig.

### State Management (src/state/index.js)

Centralized ephemeral state for display data. Domains: `caller`, `verse`, `fallacy`, `soundboard`, `showConfig`. State resets on server restart; persistent data lives in services/SQLite. The `verse` state has a `source` field that distinguishes Bible, Quran, and dictionary references sharing the same display area.

### Routes

- `src/routes/api.routes.js` — Bible verses, Quran verses, hadith narrations, dictionary definitions, fallacies, interlinear passages, lexicon entries, cache management, and config endpoints
- `src/routes/soundboard.routes.js` — Sound CRUD, file upload (multer), reorder

Routes are thin — validate input, call service, return result. Each reference type (Bible, Quran, dictionary, interlinear) follows the same endpoint pattern: `POST /api/fetch-*`, `GET/DELETE /api/cached-*`, `GET /api/*-cache-stats`. Lexicon enrichment for interlinear words happens in `api.routes.js` via `extractGloss()` (prefers `aiGloss`, falls back to BDB/Greek-numbered parsing of the raw definition).

### Frontend Pages

- **Caller**: `dock.html` (control), `display.html` / `vertical-display.html` (OBS overlays)
- **References**: `reference-control.html` (unified Bible/Quran+Hadith/dictionary/interlinear control — the Quran tab accepts both Quran references like "2:255" and hadith references like "bukhari 3208" or "muslim 2662c"; the translation dropdown auto-hides when a hadith reference is detected), `bible-display.html` (OBS overlay for all reference types). `bible-control.html` is a legacy redirect to `reference-control.html`.
- **Soundboard**: `soundboard.html` (control + playback)
- **Themes**: OBS displays support swappable themes via `public/js/theme-loader.js` — current themes are `godless-engineer` (red/black) and `the-bible-guy` (orange/gold + sky blue). Theme files live in `public/css/themes/`. Selection persists in `localStorage`.

## Development Philosophy (from PROJECT.md)

- **Keep it simple.** Three similar lines are better than a premature abstraction. Don't build for hypothetical futures.
- **Validate at boundaries, trust internally.** All external input validated/sanitized in socket handlers and route handlers. Internal code trusts the data.
- **Fail gracefully.** Services return `null`/`false` on failure rather than throwing.
- **Immutability where it matters.** State uses `Object.freeze()`, updates via spread+freeze.
- **Security as default.** HTML escaped server-side, file upload allowlists, path traversal blocked, Electron context isolation.

## Coding Conventions

- Every module starts with a JSDoc header (`@module path/name`)
- Use namespaced logger: `const log = createLogger('ServiceName')` — never raw `console.log`
- Log levels: `debug`, `info`, `warn`, `error` (controlled by `LOG_LEVEL` env var)
- Constants/config in `src/config/constants.js`, all `Object.freeze()`. Bible book name lookup/canonicalization lives in `src/config/bible-books-map.js` (canonical name, testament, morphhb key, Bolls.life book number).
- File naming: `name.service.js`, `name.routes.js`
- Socket validation pattern: validate → return `null` if bad → caller does `if (!validated) return`
- Reference caching (Bible, Quran, dictionary, interlinear, lexicon) and morphhb Hebrew word data use SQLite via `database.service.js`; soundboard and show-config still use JSON persistence via `src/utils/safe-file.js` (write queue, .tmp, .bak)

## Adding Features

**New display type:** state domain → socket handlers → broadcast function → OBS display HTML → control panel HTML. If it shares screen space with verse/fallacy, add to display mutex.

**New service:** create `src/services/name.service.js` → register in `src/server.js` init loop → add routes if needed → add data file to `.gitignore`.

**New theme:** add CSS file under `public/css/themes/` → register in the `THEMES` map in `public/js/theme-loader.js`.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3666` | Server port |
| `LOG_LEVEL` | `debug` (dev) / `info` (prod) | Minimum log level |
| `NODE_ENV` | — | `production` for prod log level |
| `ANTHROPIC_API_KEY` | — | Required only for `src/scripts/generate-glosses.js` (AI gloss generation for Strong's lexicon). Loaded from `.env` via dotenv. |

## Key Files

- `fallacies-db.json` — Pre-built fallacy database (checked in, 400+ entries; migrated into SQLite on first run)
- `references.db` — SQLite database for all cached references and morphhb Hebrew word data (gitignored, auto-created with migration from legacy JSON files)
- `verse-cache.json`, `quran-cache.json`, `dictionary-cache.json` — Legacy JSON caches kept on disk for one-shot migration into SQLite; safe to delete after first successful run
- `electron/main.js` — Electron shell that `require('../src/server')` then opens a window; context isolation enforced (preload at `electron/preload.js`)
- `src/scripts/import-morphhb.js` — Imports Open Scriptures Hebrew Bible word/morphology data from the `morphhb` npm package into the `hebrew_words` table; invoked lazily by `interlinear.service.js` if the table is empty
- `src/scripts/generate-glosses.js` — Two-phase script: fetches missing Bolls.life lexicon entries, then asks Claude (default `claude-haiku-4-5`) to produce concise glosses stored in `lexicon_entries.ai_gloss`
