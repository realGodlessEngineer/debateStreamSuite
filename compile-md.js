#!/usr/bin/env node

/**
 * Compile all project files into a single markdown document
 * for use in a Claude project knowledge base.
 * 
 * Run with: node compile-md.js
 * Output: PROJECT-KNOWLEDGE.md
 */

const fs = require('fs');
const path = require('path');

const projectDir = __dirname;
const outputFile = path.join(projectDir, 'PROJECT-KNOWLEDGE.md');

// Files to include (in order)
const filesToInclude = [
    // Configuration
    { path: 'package.json', language: 'json', description: 'Node.js dependencies and scripts' },
    { path: '.env', language: 'env', description: 'Environment variables template' },
    
    // Server-side source
    { path: 'src/server.js', language: 'javascript', description: 'Main Express/Socket.io server entry point' },
    { path: 'src/config/constants.js', language: 'javascript', description: 'Application configuration and constants' },
    { path: 'src/state/index.js', language: 'javascript', description: 'Immutable state management' },
    { path: 'src/services/cache.service.js', language: 'javascript', description: 'Verse caching with persistence' },
    { path: 'src/services/bible-gateway.service.js', language: 'javascript', description: 'Bible Gateway scraping and parsing' },
    { path: 'src/routes/api.routes.js', language: 'javascript', description: 'REST API endpoints' },
    { path: 'src/sockets/handlers.js', language: 'javascript', description: 'Socket.io event handlers' },
    
    // Client-side shared utilities
    { path: 'public/js/socket-connection.js', language: 'javascript', description: 'Shared socket connection utility' },
    { path: 'public/js/status-message.js', language: 'javascript', description: 'Shared status message utility' },
    
    // Caller info feature
    { path: 'public/index.html', language: 'html', description: 'Caller info control panel' },
    { path: 'public/js/caller-control.js', language: 'javascript', description: 'Caller control panel application' },
    { path: 'public/display.html', language: 'html', description: 'Caller info OBS display overlay' },
    { path: 'public/js/caller-display.js', language: 'javascript', description: 'Caller display application' },
    
    // Bible verse feature
    { path: 'public/bible-control.html', language: 'html', description: 'Bible verse control panel' },
    { path: 'public/js/bible-control.js', language: 'javascript', description: 'Bible control panel application' },
    { path: 'public/bible-display.html', language: 'html', description: 'Bible verse OBS display overlay' },
    { path: 'public/js/bible-display.js', language: 'javascript', description: 'Bible display application' },
    
    // Stylesheets
    { path: 'public/css/shared.css', language: 'css', description: 'CSS variables and base styles' },
    { path: 'public/css/control.css', language: 'css', description: 'Caller control panel styles' },
    { path: 'public/css/display.css', language: 'css', description: 'Caller display overlay styles' },
    { path: 'public/css/bible-control.css', language: 'css', description: 'Bible control panel styles' },
    { path: 'public/css/bible-display.css', language: 'css', description: 'Bible display overlay styles' },
];

// Read file safely
function readFile(filePath) {
    try {
        return fs.readFileSync(path.join(projectDir, filePath), 'utf8');
    } catch (e) {
        return null;
    }
}

// Count lines in a string
function countLines(str) {
    return str.split('\n').length;
}

// Generate the compiled document
function generateDocument() {
    const timestamp = new Date().toISOString();
    
    let markdown = `# DebateStreamSuite - Complete Project Reference

> **Generated:** ${timestamp}
>
> This document contains the complete source code and documentation for the DebateStreamSuite project.
> Use this as context for making updates and modifications to the codebase.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [File Structure](#file-structure)
4. [Design Principles](#design-principles)
5. [Configuration Reference](#configuration-reference)
6. [API Reference](#api-reference)
7. [Socket.io Events](#socketio-events)
8. [Common Modifications](#common-modifications)
9. [Complete Source Code](#complete-source-code)

---

## Project Overview

This is a Node.js application providing real-time display overlays for OBS Studio livestreaming:

- **Caller Info Display** - Shows caller name and pronouns during calls
- **Bible Verse Display** - Fetches verses from Bible Gateway with multi-verse paging support

**Tech Stack:**
- Node.js with Express.js web server
- Socket.io for real-time bidirectional communication
- Cheerio for HTML parsing (Bible Gateway scraping)
- Vanilla JavaScript frontends (no framework dependencies)

---

## Architecture

\`\`\`
┌─────────────────────┐         ┌─────────────────────┐
│   Control Panel     │         │    OBS Browser      │
│   (bible-control)   │         │    Source           │
│                     │         │   (bible-display)   │
└──────────┬──────────┘         └──────────┬──────────┘
           │                               │
           │ Socket.io                     │ Socket.io
           │                               │
           ▼                               ▼
┌─────────────────────────────────────────────────────────┐
│                    Server (Node.js)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Routes    │  │  Sockets    │  │  Services   │     │
│  │ (api.routes)│  │ (handlers)  │  │(cache, bg)  │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                          │                              │
│         ┌────────────────┴────────────────┐            │
│         │          State Manager          │            │
│         │     (immutable updates)         │            │
│         └─────────────────────────────────┘            │
│                          │                              │
│                    ┌─────┴─────┐                       │
│                    │   Cache   │                       │
│                    │   (JSON)  │                       │
│                    └───────────┘                       │
└─────────────────────────────────────────────────────────┘
\`\`\`

**Data Flow:**
1. User enters verse reference in control panel
2. Server fetches from Bible Gateway (or cache) via services
3. Server parses HTML, extracts individual verses
4. State manager updates with immutable patterns
5. Socket handlers broadcast verse data via Socket.io
6. Display renders current page of verses
7. Paging commands update state, trigger re-broadcast

---

## File Structure

\`\`\`
debate-stream-suite/
├── package.json              # Dependencies and scripts
├── .env.example              # Environment variables template
├── verse-cache.json          # Persistent verse cache (auto-generated)
├── compile-md.js             # Documentation generator (this script)
├── PROJECT-KNOWLEDGE.md      # Generated project documentation
│
├── src/                      # Server-side source code
│   ├── server.js             # Main entry point (minimal wiring)
│   ├── config/
│   │   └── constants.js      # Configuration and constants
│   ├── state/
│   │   └── index.js          # Immutable state management
│   ├── services/
│   │   ├── cache.service.js  # Verse caching logic
│   │   └── bible-gateway.service.js  # API scraping
│   ├── routes/
│   │   └── api.routes.js     # REST endpoints
│   └── sockets/
│       └── handlers.js       # Socket.io event handlers
│
└── public/                   # Client-side files
    ├── index.html            # Caller control panel
    ├── display.html          # Caller OBS display
    ├── bible-control.html    # Bible control panel
    ├── bible-display.html    # Bible OBS display
    │
    ├── css/
    │   ├── shared.css        # CSS variables & base styles
    │   ├── control.css       # Caller control styles
    │   ├── display.css       # Caller display styles
    │   ├── bible-control.css # Bible control styles
    │   └── bible-display.css # Bible display styles
    │
    └── js/
        ├── socket-connection.js  # Shared socket utility
        ├── status-message.js     # Shared status utility
        ├── caller-control.js     # Caller control app
        ├── caller-display.js     # Caller display app
        ├── bible-control.js      # Bible control app
        └── bible-display.js      # Bible display app
\`\`\`

---

## Design Principles

### Separation of Concerns
- **Server logic** (API, WebSocket, services) in \`src/\`
- **Client logic** self-contained in HTML/JS files
- **Shared styles** in CSS variables for consistency

### Single Responsibility
- Each module/service handles one concern
- API endpoints handle one resource/action
- Socket events are granular and specific

### Immutability Preference
- State management uses immutable updates via \`Object.freeze()\`
- Functions return new objects instead of mutating
- Spread operators for state updates

---

## Configuration Reference

### Environment Variables (.env)
\`\`\`env
PORT=3000    # Server port (default: 3000)
\`\`\`

### Verses Per Page
\`\`\`javascript
// src/config/constants.js
const DISPLAY = Object.freeze({
  VERSES_PER_PAGE: 3,
});
\`\`\`

### Theme Colors (CSS Variables)
\`\`\`css
/* public/css/shared.css */
:root {
  --color-primary: #e63946;        /* Primary red */
  --color-primary-dark: #b52d39;   /* Darker red */
  --color-bg-primary: #0a0a0a;     /* Near black */
  --color-bg-tinted: #1a0808;      /* Dark red-tinted */
  --color-text-primary: #ffffff;   /* White text */
}
\`\`\`

### Display Font Sizes
\`\`\`css
/* public/css/bible-display.css */
.verse-text { font-size: 2.2em; }      /* Main scripture text */
.reference { font-size: 1.6em; }        /* "John 3:16" header */
.version { font-size: 1.1em; }          /* "NIV" footer */
.verse-number { font-size: 0.6em; }     /* Superscript numbers */
\`\`\`

---

## API Reference

### POST /api/fetch-verse
Fetch a verse from Bible Gateway (checks cache first).

**Request:**
\`\`\`json
{
  "reference": "John 3:16",
  "version": "NIV"
}
\`\`\`

**Response:**
\`\`\`json
{
  "reference": "John 3:16",
  "version": "NIV",
  "versionName": "New International Version",
  "text": "For God so loved the world...",
  "verses": [
    { "number": "16", "text": "For God so loved the world..." }
  ],
  "totalVerses": 1,
  "book": "John",
  "timestamp": 1705678901234,
  "fromCache": false
}
\`\`\`

### GET /api/cached-verses
Returns all cached verses organized by book in biblical order.

### GET /api/cached-verse/:key
Get specific cached verse. Key format: \`reference|version\` (URL encoded).

### DELETE /api/cached-verse/:key
Delete a specific cached verse.

### DELETE /api/cached-verses
Clear all cached verses.

### GET /api/cache-stats
Returns cache statistics (total verses, oldest/newest entries).

---

## Socket.io Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| \`displayVerse\` | \`{reference, version, versionName, text, verses, totalVerses}\` | Display a verse |
| \`clearVerse\` | — | Clear the display |
| \`changePage\` | \`{direction: 'prev'\\|'next'\\|'first'\\|'last'}\` | Navigate pages |
| \`updateCaller\` | \`{name, pronouns}\` | Update caller info |
| \`clearCaller\` | — | Clear caller display |

### Server → Client (Broadcast)

| Event | Payload | Description |
|-------|---------|-------------|
| \`verseUpdate\` | Full verse object with \`currentPage\`, \`versesPerPage\` | Verse state changed |
| \`callerUpdate\` | \`{name, pronouns}\` | Caller info changed |

---

## Common Modifications

### Change Verses Per Page
Edit \`src/config/constants.js\`:
\`\`\`javascript
const DISPLAY = Object.freeze({
  VERSES_PER_PAGE: 5,  // Change from 3 to desired number
});
\`\`\`

Then update button labels in \`public/bible-control.html\` and \`public/js/bible-control.js\`.

### Change Font Sizes
Edit \`public/css/bible-display.css\`:
\`\`\`css
.verse-text { font-size: 2.5em; }  /* Larger text */
\`\`\`

### Change Display Position
Edit \`public/css/bible-display.css\` body rule:
\`\`\`css
body {
  align-items: flex-end;    /* Bottom (default) */
  align-items: flex-start;  /* Top */
  align-items: center;      /* Center */
}
\`\`\`

### Add Bible Version
Edit \`public/bible-control.html\`, add to \`<select id="version">\`:
\`\`\`html
<option value="CODE">Full Name (CODE)</option>
\`\`\`

### Change Theme Colors
Edit CSS variables in \`public/css/shared.css\`:
\`\`\`css
:root {
  --color-primary: #3498db;  /* Change to blue */
}
\`\`\`

---

## Complete Source Code

`;

    // Add each file
    let totalLines = 0;
    let fileCount = 0;
    
    for (const file of filesToInclude) {
        const content = readFile(file.path);
        
        if (content) {
            const lines = countLines(content);
            totalLines += lines;
            fileCount++;
            
            markdown += `
### ${file.path}

> ${file.description}
> **${lines} lines**

\`\`\`${file.language}
${content}
\`\`\`

---

`;
        } else {
            markdown += `
### ${file.path}

> ⚠️ File not found

---

`;
        }
    }

    markdown += `
## Usage

### Installation
\`\`\`bash
npm install
cp .env.example .env  # Optional: configure environment
\`\`\`

### Run Server
\`\`\`bash
# Production
npm start

# Development (with auto-reload)
npm run dev
\`\`\`

### URLs
| Interface | URL |
|-----------|-----|
| Caller Control Panel | http://localhost:3000 |
| Caller OBS Display | http://localhost:3000/display.html |
| Bible Control Panel | http://localhost:3000/bible-control.html |
| Bible OBS Display | http://localhost:3000/bible-display.html |

### OBS Setup

#### Browser Source
1. Add a **Browser Source** in OBS
2. Set URL to the appropriate display URL
3. Set dimensions:
   - Caller Display: 1080 x 1920 (portrait)
   - Bible Display: 1920 x 1080 (landscape)
4. Enable "Shutdown source when not visible"

#### Custom Dock
1. Go to **Docks → Custom Browser Docks...**
2. Add control panel URL
3. Click **Apply**

---

*Total source code: ${totalLines} lines across ${fileCount} files*
*Compiled on ${timestamp}*
`;

    return markdown;
}

// Main
const document = generateDocument();
fs.writeFileSync(outputFile, document);

const stats = {
    lines: document.split('\n').length,
    chars: document.length,
    kb: (document.length / 1024).toFixed(1)
};

console.log(`✅ Compiled project document: ${outputFile}`);
console.log(`   ${stats.lines} lines, ${stats.chars} characters (${stats.kb} KB)`);