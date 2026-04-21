/**
 * Bible Display Application
 * OBS overlay for displaying Bible verses with pagination
 * @module js/bible-display
 */

(function () {
  'use strict';

  // ============================================
  // DOM Elements
  // ============================================

  const elements = {
    container: document.getElementById('container'),
    reference: document.getElementById('reference'),
    pageIndicator: document.getElementById('pageIndicator'),
    versesContainer: document.getElementById('versesContainer'),
    version: document.getElementById('version'),
  };

  // ============================================
  // Socket Connection
  // ============================================

  const socket = io();

  socket.on('connect', () => {
    console.log('Display connected to server');
  });

  socket.on('disconnect', () => {
    console.log('Display disconnected from server');
  });

  // ============================================
  // Display Functions
  // ============================================

  /**
   * Creates a verse element
   * @param {Object} verse - Verse data { number, text, words? }
   * @param {Object} options - Rendering options { interlinear, language }
   * @returns {HTMLElement} Verse DOM element
   */
  function createVerseElement(verse, options = {}) {
    const verseEl = document.createElement('div');
    verseEl.className = 'verse';

    // Interlinear mode: render word grid instead of plain text
    if (options.interlinear && verse.words && verse.words.length > 0) {
      const langClass = options.language === 'hebrew' ? 'hebrew' : 'greek';
      let html = '';

      if (verse.number) {
        html += `<span class="verse-number">${escapeHtml(verse.number)}</span>`;
      }

      html += `<div class="interlinear-word-grid ${langClass}">`;
      for (const w of verse.words) {
        html += `
          <div class="il-word">
            <span class="il-original">${escapeHtml(w.original)}</span>
            <span class="il-translit">${escapeHtml(w.transliteration)}</span>
            <span class="il-strongs">${escapeHtml(w.strongs)}</span>
            <span class="il-gloss">${escapeHtml(w.gloss)}</span>
          </div>
        `;
      }
      html += '</div>';

      verseEl.innerHTML = html;
      return verseEl;
    }

    if (verse.number) {
      verseEl.innerHTML = `
        <span class="verse-number">${escapeHtml(verse.number)}</span>
        <span class="verse-text">${escapeHtml(verse.text)}</span>
      `;
    } else {
      verseEl.innerHTML = `<span class="verse-text">${escapeHtml(verse.text)}</span>`;
    }

    return verseEl;
  }

  /**
   * Shows the verse container with animation
   */
  function showContainer() {
    elements.container.classList.remove('hidden');
    elements.container.classList.add('visible');
  }

  /**
   * Hides the verse container with animation
   */
  function hideContainer() {
    elements.container.classList.remove('visible');
    elements.container.classList.add('hidden');
    document.body.classList.remove('short-content');
  }

  /**
   * Adjusts body class based on content height
   */
  function adjustForContentHeight() {
    requestAnimationFrame(() => {
      const boxHeight = elements.container.offsetHeight;
      const viewportHeight = window.innerHeight;
      
      if (boxHeight < viewportHeight * 0.4) {
        document.body.classList.add('short-content');
      } else {
        document.body.classList.remove('short-content');
      }
    });
  }

  // Lexicon paging state
  const DEFS_PER_PAGE = 8;
  let lexiconState = null;

  /**
   * Builds the info grid HTML for a lexicon entry
   * @param {Object} lexicon - Lexicon data
   * @param {string} scriptClass - 'hebrew' or 'greek'
   * @returns {string} HTML string
   */
  function buildLexiconInfoGrid(lexicon, scriptClass) {
    let html = '<div class="lexicon-info-grid">';
    html += `
      <div class="lexicon-info-item">
        <div class="lexicon-info-label">Original</div>
        <div class="lexicon-info-value lexicon-script-${scriptClass}">${escapeHtml(lexicon.lemma)}</div>
      </div>
      <div class="lexicon-info-item">
        <div class="lexicon-info-label">Transliteration</div>
        <div class="lexicon-info-value">${escapeHtml(lexicon.transliteration)}</div>
      </div>
    `;
    if (lexicon.pronunciation) {
      html += `
        <div class="lexicon-info-item">
          <div class="lexicon-info-label">Pronunciation</div>
          <div class="lexicon-info-value">${escapeHtml(lexicon.pronunciation)}</div>
        </div>
      `;
    }
    if (lexicon.morph) {
      html += `
        <div class="lexicon-info-item">
          <div class="lexicon-info-label">Morphology</div>
          <div class="lexicon-info-value">${escapeHtml(lexicon.morph)}</div>
          <div class="lexicon-info-decoded">${escapeHtml(decodeMorph(lexicon.morph))}</div>
        </div>
      `;
    }
    if (lexicon.partOfSpeech) {
      html += `
        <div class="lexicon-info-item">
          <div class="lexicon-info-label">Part of Speech</div>
          <div class="lexicon-info-value">${escapeHtml(lexicon.partOfSpeech)}</div>
        </div>
      `;
    }
    if (lexicon.origin) {
      html += `
        <div class="lexicon-info-item">
          <div class="lexicon-info-label">Origin</div>
          <div class="lexicon-info-value lexicon-info-small">${escapeHtml(lexicon.origin)}</div>
        </div>
      `;
    }
    html += '</div>';
    return html;
  }

  /**
   * Builds the definition list HTML for a page of definitions
   * @param {string[]} defs - Definitions for current page
   * @param {boolean} hasNumbered - Whether definitions use numbered format
   * @param {number} startIndex - 0-based index of first definition on this page
   * @returns {string} HTML string
   */
  function buildLexiconDefList(defs, hasNumbered, startIndex) {
    if (!defs || defs.length === 0) return '';
    let html = `<ol class="lexicon-def-list" style="counter-reset: def-counter ${startIndex};">`;
    for (const def of defs) {
      if (hasNumbered) {
        const subMatch = def.match(/^[a-z]\.\s+(.+)/);
        const mainMatch = def.match(/^\d+\.\s+(.+)/);
        if (subMatch) {
          html += `<li class="lexicon-def-sub">${escapeHtml(subMatch[1])}</li>`;
        } else if (mainMatch) {
          html += `<li class="lexicon-def-main">${escapeHtml(mainMatch[1])}</li>`;
        } else {
          html += `<li class="lexicon-def-main">${escapeHtml(def)}</li>`;
        }
      } else {
        html += `<li class="lexicon-def-main">${escapeHtml(def)}</li>`;
      }
    }
    html += '</ol>';
    return html;
  }

  /**
   * Builds the full lexicon card with info grid and a definition container
   */
  function renderLexiconCard() {
    if (!lexiconState) return;
    const { lexicon, scriptClass } = lexiconState;

    let html = '<div class="lexicon-display">';
    html += buildLexiconInfoGrid(lexicon, scriptClass);
    html += '<div id="lexiconDefContainer"></div>';
    html += '</div>';

    elements.versesContainer.innerHTML = '';
    const el = document.createElement('div');
    el.className = 'verse';
    el.innerHTML = html;
    elements.versesContainer.appendChild(el);

    showContainer();
  }

  /**
   * Swaps only the definition list for the given page
   * @param {number} page - Page index (0-based)
   */
  function renderLexiconPage(page) {
    if (!lexiconState) return;
    const { totalPages, hasNumbered, lexicon } = lexiconState;
    const defs = lexicon.definitions || [];

    const currentPage = Math.max(0, Math.min(page, totalPages - 1));
    lexiconState.currentPage = currentPage;

    // Page indicator
    if (totalPages > 1) {
      elements.pageIndicator.textContent = `${currentPage + 1} / ${totalPages}`;
      elements.pageIndicator.style.display = 'block';
    } else {
      elements.pageIndicator.style.display = 'none';
    }

    // Swap only the definitions
    const startIdx = currentPage * DEFS_PER_PAGE;
    const pageDefs = defs.slice(startIdx, startIdx + DEFS_PER_PAGE);
    const container = document.getElementById('lexiconDefContainer');
    if (container) {
      container.innerHTML = buildLexiconDefList(pageDefs, hasNumbered, startIdx);
    }

    adjustForContentHeight();
  }

  /**
   * Renders a structured lexicon entry on the display
   * @param {Object} data - Verse data with lexicon object
   */
  function renderLexiconEntry(data) {
    const { reference, version, versionName, lexicon, language } = data;
    const isHebrew = language === 'hebrew';
    const scriptClass = isHebrew ? 'hebrew' : 'greek';
    const defs = lexicon.definitions || [];
    const totalPages = Math.max(1, Math.ceil(defs.length / DEFS_PER_PAGE));
    const hasNumbered = defs.some((d) => /^\d+\.\s/.test(d));

    elements.reference.textContent = reference;
    elements.version.textContent = versionName || version;

    // Store state for paging — only rebuild the card if it's a different lexicon entry
    const isNewEntry = !lexiconState || lexiconState.reference !== reference;
    lexiconState = { lexicon, scriptClass, totalPages, hasNumbered, reference };

    if (isNewEntry) {
      renderLexiconCard();
    }
    renderLexiconPage(data.currentPage || 0);
  }

  /**
   * Renders paginated verses
   * @param {Object} data - Verse data with pagination info
   */
  function renderPaginatedVerses(data) {
    const { verses, versesPerPage = 3, currentPage = 0, reference, version, versionName } = data;
    const totalPages = Math.ceil(verses.length / versesPerPage);
    const isInterlinear = data.source === 'interlinear';

    // Update header
    elements.reference.textContent = reference;
    elements.version.textContent = versionName || version;

    // Update page indicator
    if (totalPages > 1) {
      elements.pageIndicator.textContent = `${currentPage + 1} / ${totalPages}`;
      elements.pageIndicator.style.display = 'block';
    } else {
      elements.pageIndicator.style.display = 'none';
    }

    // Get verses for current page
    const startIndex = currentPage * versesPerPage;
    const endIndex = Math.min(startIndex + versesPerPage, verses.length);
    const pageVerses = verses.slice(startIndex, endIndex);

    // Build render options
    const options = isInterlinear
      ? { interlinear: true, language: data.language || 'hebrew' }
      : {};

    // Clear and render verses (skip empty placeholders for interlinear)
    elements.versesContainer.innerHTML = '';
    pageVerses.forEach((verse) => {
      if (isInterlinear && !verse.words && !verse.text) return;
      elements.versesContainer.appendChild(createVerseElement(verse, options));
    });

    showContainer();
    adjustForContentHeight();
  }

  /**
   * Renders a single verse (fallback for old format)
   * @param {Object} data - Verse data
   */
  function renderSingleVerse(data) {
    const { text, reference, version, versionName } = data;

    elements.reference.textContent = reference;
    elements.version.textContent = versionName || version;
    elements.pageIndicator.style.display = 'none';

    elements.versesContainer.innerHTML = '';
    elements.versesContainer.appendChild(
      createVerseElement({ number: '', text })
    );

    showContainer();
    document.body.classList.add('short-content');
  }

  /**
   * Handles verse update events
   * @param {Object} data - Verse update data from server
   */
  function handleVerseUpdate(data) {
    console.log('Received verseUpdate:', data);

    // Check for structured lexicon entry
    if (data.lexicon && data.reference) {
      renderLexiconEntry(data);
      return;
    }

    // Clear lexicon paging state when showing non-lexicon content
    lexiconState = null;

    // Check for paginated verses
    if (data.verses && data.verses.length > 0 && data.reference) {
      renderPaginatedVerses(data);
      return;
    }

    // Check for single verse (old format)
    if (data.text && data.reference) {
      renderSingleVerse(data);
      return;
    }

    // No content - hide container
    hideContainer();
  }

  // ============================================
  // Fallacy Display Functions
  // ============================================

  /**
   * Calculates dynamic font size based on text length
   * @param {string} text - The text to display
   * @returns {string} CSS font-size value
   */
  function calculateFallacyFontSize(text) {
    const len = text.length;
    if (len < 80) return '2.8em';
    if (len < 150) return '2.4em';
    if (len < 250) return '2.0em';
    if (len < 400) return '1.7em';
    if (len < 600) return '1.4em';
    return '1.2em';
  }

  /**
   * Renders a fallacy on the display
   * @param {Object} data - Fallacy data { name, definition, slug, type }
   */
  function renderFallacy(data) {
    const { name, definition } = data;

    // Set the title
    elements.reference.textContent = name;
    elements.version.textContent = 'Logical Fallacy';
    elements.pageIndicator.style.display = 'none';

    // Calculate dynamic font size
    const fontSize = calculateFallacyFontSize(definition);

    // Render definition as the content
    elements.versesContainer.innerHTML = '';
    const defEl = document.createElement('div');
    defEl.className = 'verse fallacy-definition';
    defEl.innerHTML = `<span class="verse-text" style="font-size: ${fontSize};">${escapeHtml(definition)}</span>`;
    elements.versesContainer.appendChild(defEl);

    // Add fallacy class to container for styling
    elements.container.classList.add('fallacy-mode');

    showContainer();
    adjustForContentHeight();
  }

  /**
   * Handles fallacy update events
   * @param {Object} data - Fallacy data from server
   */
  function handleFallacyUpdate(data) {
    console.log('Received fallacyUpdate:', data);

    if (data.name && data.definition) {
      renderFallacy(data);
      return;
    }

    // No content - hide if no verse is showing either
    elements.container.classList.remove('fallacy-mode');
    hideContainer();
  }

  // ============================================
  // Event Handlers
  // ============================================

  socket.on('verseUpdate', (data) => {
    elements.container.classList.remove('fallacy-mode', 'quran-mode', 'dictionary-mode', 'interlinear-mode');

    if (data.source === 'quran') {
      elements.container.classList.add('quran-mode');
    } else if (data.source === 'dictionary') {
      elements.container.classList.add('dictionary-mode');
    } else if (data.source === 'interlinear') {
      elements.container.classList.add('interlinear-mode');
    }

    handleVerseUpdate(data);
  });

  socket.on('fallacyUpdate', handleFallacyUpdate);
})();