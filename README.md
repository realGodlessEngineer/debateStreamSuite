# DebateStreamSuite (DSS)

A comprehensive real-time streaming toolkit for debate and discussion livestreams, built with Node.js, Express, Socket.io, and Electron.

Manage dynamic OBS overlays during live streams — including caller information, Bible verses, logical fallacies, and a soundboard — all controlled from browser-based panels and rendered as transparent OBS browser sources.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [OBS Integration](#obs-integration)
- [Usage Guide](#usage-guide)
- [API Reference](#api-reference)
- [Socket.io Events](#socketio-events)
- [Configuration](#configuration)
- [Themes](#themes)
- [Desktop App (Electron)](#desktop-app-electron)
- [Scripts Reference](#scripts-reference)
- [Data Storage](#data-storage)
- [Security](#security)

## Features

### Caller Info Display
- Show caller name and pronouns as a live overlay
- Configurable show title and up to 2 host names with pronouns
- Two-host (full width) and one-host (compact) layout modes
- Title bar displayed when no caller is active

### Bible Verse Display
- Fetch verses from Bible Gateway in real-time
- Multiple Bible versions supported (NIV, NRSVUE, KJV, ESV, and more)
- Paginated display with configurable verses per page (default: 3)
- Persistent verse cache with atomic writes and automatic backups
- Cache management via REST API (list, fetch, delete, clear)

### Fallacy Display
- Search and display logical fallacies from a 400+ entry database
- Full-text search across name, definition, and aliases
- Database built from LogicallyFallacious.com via included scraper script

### Soundboard
- Upload and manage audio files (MP3, WAV, OGG, WebM, M4A — max 10MB each)
- Drag-and-drop upload and reordering
- Emoji icons per sound button
- Paginated grid (12 buttons per page by default)
- WebSocket-triggered playback across all connected displays

## Architecture

```
┌─────────────────┐     Socket.io      ┌─────────────────┐
│  Control Panel  │ ◄─────────────────► │     Server      │
│   (browser)     │                     │   (Node.js)     │
└─────────────────┘                     └────────┬────────┘
                                                 │ Socket.io
                                                 ▼
                                        ┌─────────────────┐
                                        │   OBS Browser    │
                                        │     Source       │
                                        └─────────────────┘
```

- **Server** — Express.js web server with Socket.io for real-time state broadcasting
- **Control Panels** — Browser-based UIs for managing each overlay module
- **OBS Displays** — Transparent browser source pages rendered inside OBS scenes
- **Electron** — Optional desktop wrapper with system tray and native menus

All state changes flow through the server, which validates input, updates state, and broadcasts to every connected client in real-time.

## Project Structure

```
debate-stream-suite/
├── src/
│   ├── server.js                  # Express server entry point
│   ├── config/
│   │   └── constants.js           # Ports, paths, limits, Bible book order
│   ├── state/
│   │   └── index.js               # Immutable state manager
│   ├── services/
│   │   ├── bible-gateway.service.js   # Bible Gateway scraper (Cheerio)
│   │   ├── cache.service.js           # Verse caching with atomic writes
│   │   ├── fallacy.service.js         # Fallacy database & search
│   │   ├── hosts.service.js           # Windows hosts file mapping
│   │   ├── show-config.service.js     # Show title & host persistence
│   │   └── soundboard.service.js      # Sound file & config management
│   ├── routes/
│   │   ├── api.routes.js          # REST API for verses, fallacies, config
│   │   └── soundboard.routes.js   # Sound upload & management endpoints
│   ├── sockets/
│   │   └── handlers.js            # Socket.io event handlers & validation
│   ├── scripts/
│   │   └── scrape-fallacies.js    # Fallacy database scraper
│   └── utils/
│       ├── logger.js              # Structured logging with namespaces
│       └── safe-file.js           # Atomic JSON writes with backups
│
├── electron/
│   ├── main.js                    # Electron main process
│   ├── preload.js                 # Context bridge / security boundary
│   ├── index.html                 # Desktop app interface
│   └── icons/                     # App icons (PNG, ICO, ICNS)
│
├── public/                        # Frontend (served by Express)
│   ├── dock.html                  # Caller info control panel
│   ├── display.html               # Caller info OBS display
│   ├── bible-control.html         # Bible verse control panel
│   ├── bible-display.html         # Bible verse OBS display
│   ├── soundboard.html            # Soundboard control panel
│   ├── css/                       # Stylesheets
│   │   ├── shared.css
│   │   ├── display.css
│   │   ├── control.css
│   │   ├── bible-display.css
│   │   ├── bible-control.css
│   │   ├── soundboard.css
│   │   └── themes/
│   │       ├── godless-engineer.css
│   │       └── the-bible-guy.css
│   └── js/                        # Client-side scripts
│       ├── socket-connection.js
│       ├── caller-display.js
│       ├── caller-control.js
│       ├── bible-display.js
│       ├── bible-control.js
│       ├── soundboard-control.js
│       ├── sanitize.js
│       ├── theme-loader.js
│       ├── settings-modal.js
│       ├── show-config-modal.js
│       └── status-message.js
│
├── data/                          # Source data for scrapers
├── sounds/                        # User-uploaded audio files
├── .env                           # Environment variables
└── package.json
```

## Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **OBS Studio** (for live streaming use)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd debate-stream-suite

# Install dependencies
npm install
```

### Running the Server

```bash
# Production
npm start

# Development (auto-reload with nodemon)
npm run dev
```

The server starts at **http://localhost:3666** by default.

### Access Points

| Page | URL | Purpose |
|------|-----|---------|
| Caller Control | `/dock.html` | Manage caller name & pronouns |
| Caller Display | `/display.html` | OBS overlay for caller info |
| Bible Control | `/bible-control.html` | Search & display Bible verses |
| Bible Display | `/bible-display.html` | OBS overlay for verses |
| Soundboard | `/soundboard.html` | Upload & trigger sounds |

## OBS Integration

1. In OBS, add a **Browser Source** to your scene
2. Set the URL to one of the display pages:
   - `http://localhost:3666/display.html` — Caller info overlay
   - `http://localhost:3666/bible-display.html` — Bible verse overlay
3. Set dimensions to **1920 x 1080**
4. Optionally enable **Shutdown source when not visible**
5. The background is transparent — overlays render on top of your scene

### Hostname Mapping (Optional)

The app can map the hostname `getools` to `127.0.0.1` in your system hosts file, allowing you to use `http://getools:3666/` instead of `localhost`. This requires admin/root privileges.

## Usage Guide

### Caller Info

1. Open the control panel at `/dock.html`
2. Enter the caller's name and pronouns
3. Click **Send** to display the overlay in OBS
4. Click **Clear** to remove it
5. Configure show title and hosts via the settings modal

### Bible Verses

1. Open `/bible-control.html`
2. Enter a reference (e.g., "John 3:16") and select a Bible version
3. Click **Fetch** — the verse is retrieved from Bible Gateway (or cache)
4. Click **Display** to send it to the OBS overlay
5. Use pagination controls for multi-verse passages
6. Manage cached verses from the cache panel

### Fallacies

1. Search for a logical fallacy by name or keyword
2. Select from results to display the fallacy name and definition as an overlay
3. Clear when done

### Soundboard

1. Open `/soundboard.html`
2. Upload audio files (drag-and-drop or file picker, max 10MB)
3. Assign emoji icons and reorder buttons as needed
4. Click a sound button to trigger playback on all connected displays

## API Reference

### Bible Verses

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/fetch-verse` | Fetch verse from Bible Gateway (cache-aware) |
| `GET` | `/api/cached-verses` | List all cached verses grouped by book |
| `GET` | `/api/cached-verse/:key` | Get a specific cached verse |
| `DELETE` | `/api/cached-verse/:key` | Delete a cached verse |
| `DELETE` | `/api/cached-verses` | Clear entire verse cache |
| `GET` | `/api/cache-stats` | Cache statistics |

**Example — Fetch a verse:**

```
POST /api/fetch-verse
Content-Type: application/json

{ "reference": "John 3:16", "version": "NIV" }
```

```json
{
  "reference": "John 3:16",
  "version": "NIV",
  "versionName": "New International Version",
  "text": "For God so loved the world...",
  "verses": [{ "number": "16", "text": "For God so loved..." }],
  "totalVerses": 1,
  "fromCache": false
}
```

### Fallacies

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/fallacies` | List all fallacies (search with `?q=`) |
| `GET` | `/api/fallacies/count` | Total fallacy count |
| `GET` | `/api/fallacy/:slug` | Get a specific fallacy by slug |

### Soundboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/soundboard/sounds` | List all sounds |
| `POST` | `/api/soundboard/sounds` | Upload a sound (multipart/form-data) |
| `PUT` | `/api/soundboard/sounds/:id` | Update sound metadata |
| `DELETE` | `/api/soundboard/sounds/:id` | Delete a sound |
| `PUT` | `/api/soundboard/reorder` | Reorder sounds by ID array |

### Configuration

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/config` | Get display/soundboard config & Bible book order |

## Socket.io Events

### Caller

| Event | Direction | Payload |
|-------|-----------|---------|
| `updateCaller` | Client -> Server | `{ name, pronouns }` |
| `clearCaller` | Client -> Server | — |
| `callerUpdate` | Server -> All | `{ name, pronouns }` |

### Bible Verses

| Event | Direction | Payload |
|-------|-----------|---------|
| `displayVerse` | Client -> Server | `{ reference, version, versionName, text, verses }` |
| `clearVerse` | Client -> Server | — |
| `changePage` | Client -> Server | `{ direction: 'prev' \| 'next' \| 'first' \| 'last' }` or page number |
| `verseUpdate` | Server -> All | Full verse state with pagination info |

### Fallacies

| Event | Direction | Payload |
|-------|-----------|---------|
| `displayFallacy` | Client -> Server | `{ name, definition, slug }` |
| `clearFallacy` | Client -> Server | — |
| `fallacyUpdate` | Server -> All | `{ name, definition, slug, type }` |

### Soundboard

| Event | Direction | Payload |
|-------|-----------|---------|
| `playSound` | Client -> Server | `{ id }` |
| `stopSound` | Client -> Server | — |
| `soundboardPlay` | Server -> All | Sound object |
| `soundboardStop` | Server -> All | — |
| `soundboardUpdate` | Server -> All | `{ currentSound, currentPage, buttonsPerPage, sounds }` |

### Show Config

| Event | Direction | Payload |
|-------|-----------|---------|
| `updateShowConfig` | Client -> Server | `{ showTitle, hosts }` |
| `showConfigUpdate` | Server -> All | `{ showTitle, hosts }` |

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3666` | Server port |

Set via `.env` file or system environment.

### Application Constants

Defined in `src/config/constants.js`:

| Setting | Value | Description |
|---------|-------|-------------|
| Verses per page | 3 | Number of verses shown at once |
| Soundboard buttons per page | 12 | Buttons in the soundboard grid |
| Max sound file size | 10 MB | Upload limit per sound |
| Allowed audio formats | MP3, WAV, OGG, WebM, M4A | Accepted upload types |

### Common Customizations

**Change verses per page** — Edit `DISPLAY.VERSES_PER_PAGE` in `src/config/constants.js`.

**Change colors** — The default red/black theme uses:
| Color | Hex | Usage |
|-------|-----|-------|
| Primary red | `#e63946` | Headers, buttons, accents |
| Dark red | `#b52d39` | Gradients, hover states |
| Near black | `#0d0d0d` | Backgrounds |
| Dark red-black | `#1a0808` | Gradient endpoints |

**Add a Bible version** — Add an `<option>` to the version `<select>` in `public/bible-control.html`:
```html
<option value="VERSION_CODE">Version Name (CODE)</option>
```

## Themes

The app includes a dynamic theme system:

- **Base styles** — `public/css/shared.css`
- **Theme overrides** — `public/css/themes/`
  - `godless-engineer.css` — Red/black theme (default)
  - `the-bible-guy.css` — Alternate theme
- **Runtime switching** — Handled by `public/js/theme-loader.js`

## Desktop App (Electron)

The project can be packaged as a standalone desktop application using Electron.

```bash
# Run in development
npm run electron
npm run electron:dev    # with NODE_ENV=development

# Build for distribution
npm run build:win       # Windows (.exe via NSIS)
npm run build:mac       # macOS (.dmg)
npm run build:linux     # Linux (.AppImage)
```

The Electron wrapper provides:
- Native window with embedded server
- System tray integration
- Application menu
- Auto-starts the Express server internally

**App ID:** `com.debatestreamsuite.app`

## Scripts Reference

| Script | Command | Description |
|--------|---------|-------------|
| `start` | `node src/server.js` | Start the web server |
| `dev` | `nodemon src/server.js` | Start with auto-reload |
| `electron` | `electron .` | Launch desktop app |
| `electron:dev` | `cross-env NODE_ENV=development electron .` | Desktop app (dev mode) |
| `build` | `electron-builder` | Build for all platforms |
| `build:win` | `electron-builder --win` | Windows build |
| `build:mac` | `electron-builder --mac` | macOS build |
| `build:linux` | `electron-builder --linux` | Linux build |
| `release` | Version patch + Windows build | Patch release |
| `release:minor` | Version minor + Windows build | Minor release |
| `release:major` | Version major + Windows build | Major release |

**Rebuild the fallacy database:**
```bash
node src/scripts/scrape-fallacies.js
```

## Data Storage

The application persists data in JSON files at the project root:

| File | Purpose |
|------|---------|
| `verse-cache.json` | Cached Bible verses (keyed by `"reference\|version"`) |
| `verse-cache.json.bak` | Automatic backup from atomic writes |
| `fallacies-db.json` | Logical fallacies database (~400 entries) |
| `soundboard.json` | Soundboard configuration and sound metadata |
| `show-config.json` | Show title and host information |
| `sounds/` | Directory containing uploaded audio files |

All JSON writes use atomic operations (write to temp file, then rename) with automatic `.bak` backups to prevent data corruption.

## Security

- **Input sanitization** — All Socket.io payloads are validated for type and string length (200 char default, up to 50KB for verse text)
- **XSS protection** — Client-side sanitization via `public/js/sanitize.js`
- **File upload restrictions** — Whitelist of allowed audio MIME types and extensions, 10MB size limit
- **Atomic file writes** — Temp file + rename pattern prevents partial writes; automatic backups enable recovery
- **Electron security** — Context isolation via `preload.js` security boundary

## Tech Stack

- **Runtime:** Node.js
- **Server:** Express.js
- **Real-time:** Socket.io
- **Web Scraping:** Cheerio
- **File Uploads:** Multer
- **Desktop:** Electron + electron-builder
- **Development:** Nodemon, cross-env, dotenv

## License

See [package.json](package.json) for version and metadata.
