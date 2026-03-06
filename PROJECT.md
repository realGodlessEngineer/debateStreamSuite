# DebateStreamSuite - Developer Guide

This document is the internal development reference for DebateStreamSuite. For user-facing documentation, setup instructions, API reference, and usage guides, see [README.md](README.md).

---

## Development Philosophy

### Keep It Simple

- Solve the problem at hand. Don't build for hypothetical futures.
- Three similar lines are better than a premature abstraction.
- If a function is only used once, it probably doesn't need to be extracted.
- No feature flags, no backwards-compatibility shims — just change the code.

### Validate at Boundaries, Trust Internally

- All external input (socket events, HTTP requests, file reads) is validated and sanitized at the boundary where it enters the system.
- Internal code trusts the data it receives — no redundant checks deep in the call stack.
- Socket handlers validate type, length, and shape of every payload before acting on it.
- REST routes check required fields and reject bad input with appropriate HTTP status codes.

### Fail Gracefully, Don't Crash

- Services return `null` or `false` on failure rather than throwing.
- File I/O failures are logged and recovered from (backup files, empty defaults).
- The server startup sequence loads each service independently — one failure doesn't block the others.
- Atomic file writes ensure data integrity even on unexpected shutdowns.

### Immutability Where It Matters

- Application state uses `Object.freeze()` to prevent accidental mutation.
- State updates create new objects rather than mutating in place.
- Cache updates use spread/destructuring (`{ ...cache, [key]: value }`) instead of `cache[key] = value`.

### Security as Default

- HTML is escaped server-side in socket handlers (`escapeHtml()`) before broadcast.
- File uploads use allowlists for both MIME types and extensions.
- Path traversal is blocked by validating filenames contain no `/`, `\`, or `..`.
- Electron uses context isolation — no `nodeIntegration`, IPC goes through `preload.js`.
- External URLs opened from Electron are restricted to `http://` and `https://` protocols.

---

## Architecture Patterns

### Service Pattern

Every domain has a service module in `src/services/` that owns its data and exposes a consistent API:

```
ServiceName = {
  load()          — Read from disk at startup (synchronous)
  get() / getAll() — Read current state
  add(data)       — Create a new entry
  update(id, data) — Modify an existing entry
  remove(id)      — Delete an entry
  save()          — Persist to disk (async, queued)
}
```

Services hold their data in module-scoped variables (e.g., `let cache = {}`). They are singletons by nature of Node's module system.

### State Management (`src/state/index.js`)

Centralized state for all real-time display data. The `StateManager` is the single source of truth for what's currently shown on screen.

State domains: `caller`, `verse`, `fallacy`, `soundboard`, `showConfig`

Pattern for updates:
```js
state = {
  ...state,
  domain: Object.freeze({ ...state.domain, ...updates }),
};
```

State is never persisted to disk — it's ephemeral and resets on server restart. Persistent data lives in services.

### Atomic File Writes (`src/utils/safe-file.js`)

All JSON persistence uses the write queue pattern:

1. Serialize data to JSON string (fails fast if data is bad)
2. Write to a `.tmp` file
3. Read back and parse the `.tmp` file to verify integrity
4. Copy existing file to `.bak` backup
5. Rename `.tmp` over the target file (atomic on most filesystems)

The `createWriteQueue(filePath)` function returns a `saveQueued(data)` function that serializes writes — only one write operation runs at a time per file.

### Socket Event Flow

```
Client emits event
  -> handlers.js validates/sanitizes payload
  -> StateManager updates state (immutable)
  -> io.emit() broadcasts new state to ALL connected clients
```

New connections receive the full current state immediately on connect. This means any client can join at any time and be in sync.

**Display mutex:** Verse and fallacy share the same display area. Showing one automatically clears the other.

### Route Organization

- `src/routes/api.routes.js` — Bible verses, cache, fallacies, config
- `src/routes/soundboard.routes.js` — Sound CRUD, file upload, reorder

Routes are thin — they validate input, call the appropriate service, and return the result. Business logic lives in services.

---

## Coding Conventions

### Module Headers

Every module starts with a JSDoc block:
```js
/**
 * Brief description of the module
 * @module path/name
 */
```

### Logging

Use the namespaced logger, not raw `console.log`:
```js
const createLogger = require('../utils/logger');
const log = createLogger('ServiceName');

log.info('Something happened');
log.error('Something broke:', error.message);
```

Log levels: `debug`, `info`, `warn`, `error`. Controlled by `LOG_LEVEL` env var. Development defaults to `debug`, production to `info`.

### Error Messages

- Log the error `.message`, not the full stack trace (unless debugging).
- User-facing error responses should be generic: `"Failed to fetch verse. Please try again."` — not internal details.

### Constants

All magic numbers and configuration values live in `src/config/constants.js`. Everything is wrapped in `Object.freeze()`.

### Input Validation (Socket Handlers)

Socket handlers use local validation helpers in `src/sockets/handlers.js`:

- `sanitizeString(value, fallback, maxLen)` — type check, trim, truncate, HTML-escape
- `validateCallerData(data)` — returns sanitized object or `null`
- `validateVerseData(data)` — returns sanitized object or `null`
- `validatePageDirection(data)` — returns valid direction or `null`
- `validateShowConfigData(data)` — returns sanitized object or `null`

Pattern: validate, return `null` if bad, caller does `if (!validated) return;`.

### File Naming

- Services: `name.service.js`
- Routes: `name.routes.js`
- Config: `name.js` (in `config/`)
- Utils: `name.js` (in `utils/`)

---

## Adding New Features

### Adding a New Display Type

1. **State** — Add a new domain in `src/state/index.js` (create factory, add to `state` object, add getter/updater/clear methods)
2. **Socket handlers** — Add display/clear events in `src/sockets/handlers.js` with validation
3. **Broadcast** — Add a `broadcastX()` function and wire it into the connection handler
4. **OBS display** — Create `public/new-display.html` (transparent background, listens for socket events)
5. **Control panel** — Create `public/new-control.html` or add to existing dock

If the new display shares screen space with verse/fallacy, add it to the display mutex (clear others when showing).

### Adding a New Service

1. Create `src/services/name.service.js` following the service pattern
2. If persistent, use `createWriteQueue()` for writes and `readJsonSafe()` for loading
3. Register in `src/server.js` initialization loop
4. Add routes in `src/routes/` if REST endpoints are needed
5. Add the data file to `.gitignore` if it's generated at runtime

### Adding a New API Endpoint

1. Add the route to the appropriate router in `src/routes/`
2. Validate all input at the route level
3. Call the service — don't put business logic in the route
4. Return appropriate HTTP status codes (400 for bad input, 404 for not found, 500 for server errors)

---

## Electron Integration

The Electron shell (`electron/main.js`) simply `require('../src/server')` to start Express, then opens a window. The entire web app works identically whether accessed through Electron or a browser.

Key constraints:
- `contextIsolation: true`, `nodeIntegration: false` — all IPC goes through `preload.js`
- The preload script exposes only `copy-to-clipboard` and `open-external` IPC channels
- External link handling validates protocol (http/https only)
- System tray provides quick access to control panels and copy display URLs

Build targets are configured in `package.json` under the `build` key. App ID: `com.debatestreamsuite.app`.

---

## File Persistence Map

| Runtime Data File | Service | gitignored | Notes |
|-------------------|---------|------------|-------|
| `verse-cache.json` | CacheService | Yes | Keyed by `reference\|version` |
| `verse-cache.json.bak` | (auto) | Yes | Automatic backup |
| `soundboard.json` | SoundboardService | Yes | Sound metadata + order |
| `show-config.json` | ShowConfigService | Yes | Show title + hosts (max 2) |
| `sounds/` | SoundboardService | Yes | Uploaded audio files |
| `fallacies-db.json` | FallacyService | No | Pre-built database, checked in |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3666` | Server port |
| `LOG_LEVEL` | `debug` (dev) / `info` (prod) | Minimum log level |
| `NODE_ENV` | — | Set to `production` for prod log level |

---

## Common Development Tasks

```bash
# Start with auto-reload
npm run dev

# Run Electron in development mode
npm run electron:dev

# Rebuild fallacy database from source HTML
node src/scripts/scrape-fallacies.js

# Build Windows installer
npm run build:win

# Patch release (bump version + build)
npm run release
```

---

## Version

Current: **2.2.0**
