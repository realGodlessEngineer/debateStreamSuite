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
   * @param {Object} verse - Verse data { number, text }
   * @returns {HTMLElement} Verse DOM element
   */
  function createVerseElement(verse) {
    const verseEl = document.createElement('div');
    verseEl.className = 'verse';

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

  /**
   * Renders paginated verses
   * @param {Object} data - Verse data with pagination info
   */
  function renderPaginatedVerses(data) {
    const { verses, versesPerPage = 3, currentPage = 0, reference, version, versionName } = data;
    const totalPages = Math.ceil(verses.length / versesPerPage);

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

    // Clear and render verses
    elements.versesContainer.innerHTML = '';
    pageVerses.forEach((verse) => {
      elements.versesContainer.appendChild(createVerseElement(verse));
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
    elements.container.classList.remove('fallacy-mode');
    handleVerseUpdate(data);
  });

  socket.on('fallacyUpdate', handleFallacyUpdate);
})();