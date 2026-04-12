# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

DebateStreamSuite (DSS) — a real-time streaming toolkit for debate livestreams. Manages OBS overlays (caller info, Bible/Quran verses, logical fallacies, dictionary definitions, soundboard) via browser-based control panels and transparent OBS browser sources.

**Stack:** Node.js, Express, Socket.io, Electron, SQLite (better-sqlite3), Cheerio

## Commands

```bash
npm run dev              # Start server with nodemon auto-reload (port 3666)
npm start                # Production server
npm run electron:dev     # Electron app in development mode
npm run electron         # Electron app in production mode
npm run build:win        # Build Windows installer
npm run release          # Patch bump + Windows build
npm run release:minor    # Minor bump + Windows build
npm run release:major    # Major bump + Windows build
node src/scripts/scrape-fallacies.js  # Rebuild fallacy database from source HTML
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

New connections receive full current state on connect. **Display mutex:** verse (Bible, Quran, or dictionary) and fallacy share the same display area — showing one clears the other.

### Service Pattern

Every domain has a singleton service in `src/services/` with a consistent API: `load()`, `get()`, `add()`, `remove()`, `clear()`. Services own their data and are the only layer that touches the database or external APIs.

- **Database:** `database.service.js` — SQLite (references.db) with tables: `bible_verses`, `quran_verses`, `dictionary_entries`, `fallacies`
- **Fetch services:** `bible-gateway.service.js` (web scraping), `alquran.service.js` (AlQuran.Cloud API), `dictionary.service.js` (Free Dictionary API)
- **Cache services:** `cache.service.js`, `quran-cache.service.js`, `dictionary-cache.service.js` — read/write SQLite
- **Other:** `fallacy.service.js`, `soundboard.service.js`, `show-config.service.js`, `hosts.service.js`

### Initialization Order (src/server.js)

DatabaseService must initialize before all cache services. The startup loop loads each service independently — one failure doesn't block others.

### State Management (src/state/index.js)

Centralized ephemeral state for display data. Domains: `caller`, `verse`, `fallacy`, `soundboard`, `showConfig`. State resets on server restart; persistent data lives in services/SQLite. The `verse` state has a `source` field that distinguishes Bible, Quran, and dictionary references sharing the same display area.

### Routes

- `src/routes/api.routes.js` — Bible verses, Quran verses, dictionary definitions, fallacies, cache management, and config endpoints
- `src/routes/soundboard.routes.js` — Sound CRUD, file upload, reorder

Routes are thin — validate input, call service, return result. Each reference type (Bible, Quran, dictionary) follows the same endpoint pattern: `POST /api/fetch-*`, `GET/DELETE /api/cached-*`, `GET /api/*-cache-stats`.

### Frontend Pages

- **Caller**: `dock.html` (control), `display.html` / `vertical-display.html` (OBS overlays)
- **References**: `reference-control.html` (unified Bible/Quran/dictionary control), `bible-display.html` (OBS overlay for all reference types)
- **Soundboard**: `soundboard.html` (control + playback)

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
- Constants/config in `src/config/constants.js`, all `Object.freeze()`
- File naming: `name.service.js`, `name.routes.js`
- Socket validation pattern: validate → return `null` if bad → caller does `if (!validated) return`
- Reference caching (Bible, Quran, dictionary) uses SQLite via `database.service.js`; soundboard and show-config still use JSON persistence via `src/utils/safe-file.js` (write queue, .tmp, .bak)

## Adding Features

**New display type:** state domain → socket handlers → broadcast function → OBS display HTML → control panel HTML. If it shares screen space with verse/fallacy, add to display mutex.

**New service:** create `src/services/name.service.js` → register in `src/server.js` init loop → add routes if needed → add data file to `.gitignore`.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3666` | Server port |
| `LOG_LEVEL` | `debug` (dev) / `info` (prod) | Minimum log level |
| `NODE_ENV` | — | `production` for prod log level |

## Key Files

- `fallacies-db.json` — Pre-built fallacy database (checked in, 400+ entries)
- `references.db` — SQLite database for all cached references (gitignored, auto-created with migration from legacy JSON files)
- `electron/main.js` — Electron shell that `require('../src/server')` then opens a window; context isolation enforced
