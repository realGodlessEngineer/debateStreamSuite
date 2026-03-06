/**
 * Bible Control Panel Application
 * Manages verse fetching, caching, and display control
 * @module js/bible-control
 */

(function () {
  'use strict';

  // ============================================
  // Constants (loaded from server via /api/config)
  // ============================================

  let OLD_TESTAMENT_BOOKS = [
    'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
    'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
    '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles',
    'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalm', 'Psalms',
    'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Song of Songs',
    'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel',
    'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah',
    'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
  ];

  /**
   * Loads shared constants from the server
   */
  async function loadConfig() {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const config = await response.json();
        // OT books are those up to Malachi in the canonical order
        const malachiIndex = config.bibleBookOrder.indexOf('Malachi');
        if (malachiIndex !== -1) {
          OLD_TESTAMENT_BOOKS = config.bibleBookOrder.slice(0, malachiIndex + 1);
        }
      }
    } catch (error) {
      console.error('Error loading config, using defaults:', error);
    }
  }

  // ============================================
  // State
  // ============================================

  const state = {
    lastFetchedVerse: null,
    cachedVerses: {},
    selectedCacheKey: null,
    paging: {
      currentPage: 0,
      totalPages: 1,
      totalVerses: 0,
      versesPerPage: 3,
    },
    // Fallacy state
    allFallacies: [],
    selectedFallacySlug: null,
  };

  // ============================================
  // DOM Elements
  // ============================================

  const elements = {
    // Form inputs
    reference: document.getElementById('reference'),
    version: document.getElementById('version'),

    // Buttons
    fetchBtn: document.getElementById('fetchBtn'),
    fetchOnlyBtn: document.getElementById('fetchOnlyBtn'),
    clearBtn: document.getElementById('clearBtn'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    refreshCache: document.getElementById('refreshCache'),
    clearCache: document.getElementById('clearCache'),

    // Display elements
    status: document.getElementById('status'),
    previewContent: document.getElementById('previewContent'),
    pagingControls: document.getElementById('pagingControls'),
    currentPage: document.getElementById('currentPage'),
    totalPages: document.getElementById('totalPages'),
    verseRange: document.getElementById('verseRange'),
    cacheList: document.getElementById('cacheList'),
    cacheCount: document.getElementById('cacheCount'),
    cacheSearch: document.getElementById('cacheSearch'),

    // Modal elements
    cacheModal: document.getElementById('cacheModal'),
    showCacheBtn: document.getElementById('showCacheBtn'),
    closeCacheBtn: document.getElementById('closeCacheBtn'),
    helpModal: document.getElementById('helpModal'),
    showHelpBtn: document.getElementById('showHelpBtn'),
    closeHelpBtn: document.getElementById('closeHelpBtn'),
    displayUrl: document.getElementById('displayUrl'),
    controlUrl: document.getElementById('controlUrl'),

    // Fallacy modal elements
    fallacyModal: document.getElementById('fallacyModal'),
    showFallacyBtn: document.getElementById('showFallacyBtn'),
    closeFallacyBtn: document.getElementById('closeFallacyBtn'),
    fallacySearch: document.getElementById('fallacySearch'),
    fallacyList: document.getElementById('fallacyList'),
    fallacyCount: document.getElementById('fallacyCount'),
  };

  // ============================================
  // Services
  // ============================================

  const connection = createSocketConnection();
  const status = createStatusManager('status');

  // ============================================
  // Cache Functions
  // ============================================

  /**
   * Checks if a book is in the Old Testament
   * @param {string} bookName - Book name to check
   * @returns {boolean} Is Old Testament book
   */
  const isOldTestamentBook = (bookName) => {
    return OLD_TESTAMENT_BOOKS.some(
      (otBook) => bookName.toLowerCase().startsWith(otBook.toLowerCase())
    );
  };

  /**
   * Loads cached verses from the API
   */
  async function loadCachedVerses() {
    try {
      const response = await fetch('/api/cached-verses');
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      state.cachedVerses = await response.json();
      renderCacheList();
    } catch (error) {
      console.error('Error loading cache:', error);
      elements.cacheList.innerHTML = '<div class="cache-empty">Error loading cache</div>';
    }
  }

  /**
   * Renders the cache list with optional filtering
   * @param {string} filter - Search filter string
   */
  function renderCacheList(filter = '') {
    const searchTerm = filter.toLowerCase();
    const books = Object.keys(state.cachedVerses);

    if (books.length === 0) {
      elements.cacheList.innerHTML =
        '<div class="cache-empty">No cached verses yet.<br>Fetch a verse to add it to the cache.</div>';
      elements.cacheCount.textContent = '';
      return;
    }

    let totalVerses = 0;
    let html = '';
    let inOT = true;
    let addedNTDivider = false;

    for (const book of books) {
      const verses = state.cachedVerses[book].filter((v) => {
        if (!searchTerm) return true;
        return (
          v.reference.toLowerCase().includes(searchTerm) ||
          v.text.toLowerCase().includes(searchTerm) ||
          v.version.toLowerCase().includes(searchTerm)
        );
      });

      if (verses.length === 0) continue;

      const isOTBook = isOldTestamentBook(book);

      // Add testament dividers
      if (inOT && !isOTBook && !addedNTDivider) {
        if (html !== '') {
          html += '<div class="testament-divider">New Testament</div>';
        }
        addedNTDivider = true;
        inOT = false;
      } else if (!addedNTDivider && html === '' && isOTBook) {
        html += '<div class="testament-divider">Old Testament</div>';
      } else if (!addedNTDivider && html === '' && !isOTBook) {
        html += '<div class="testament-divider">New Testament</div>';
        addedNTDivider = true;
        inOT = false;
      }

      totalVerses += verses.length;

      html += `
        <div class="book-group">
          <div class="book-header" data-book="${escapeHtml(book)}">
            <span>${escapeHtml(book)} (${verses.length})</span>
            <span class="toggle">▼</span>
          </div>
          <div class="book-verses">
      `;

      for (const verse of verses) {
        const isSelected = state.selectedCacheKey === verse.key;
        const encodedKey = encodeURIComponent(verse.key);
        html += `
          <div class="cached-verse ${isSelected ? 'selected' : ''}" data-key="${encodedKey}">
            <div class="cached-verse-content" data-action="select">
              <div class="cached-verse-ref">${escapeHtml(verse.reference)}</div>
              <div class="cached-verse-version">${escapeHtml(verse.version)}</div>
            </div>
            <button class="btn-delete" data-action="delete" title="Delete from cache">×</button>
          </div>
        `;
      }

      html += '</div></div>';
    }

    if (html === '') {
      elements.cacheList.innerHTML = '<div class="cache-empty">No verses match your search.</div>';
      elements.cacheCount.textContent = '';
    } else {
      elements.cacheList.innerHTML = html;
      elements.cacheCount.textContent = totalVerses;
    }
  }

  /**
   * Toggles a book group collapse state
   * @param {HTMLElement} header - Book header element
   */
  function toggleBook(header) {
    header.classList.toggle('collapsed');
    const verses = header.nextElementSibling;
    verses.classList.toggle('hidden');
  }

  /**
   * Selects a cached verse and displays it
   * @param {string} encodedKey - URL-encoded cache key
   */
  async function selectCachedVerse(encodedKey) {
    const key = decodeURIComponent(encodedKey);
    state.selectedCacheKey = key;

    // Update selection UI
    document.querySelectorAll('.cached-verse').forEach((el) => {
      const elKey = decodeURIComponent(el.dataset.key);
      el.classList.toggle('selected', elKey === key);
    });

    // Find and display the verse
    for (const book of Object.values(state.cachedVerses)) {
      for (const verse of book) {
        if (verse.key === key) {
          state.lastFetchedVerse = verse;
          showPreview(verse);
          elements.reference.value = verse.reference;
          elements.version.value = verse.version;
          displayVerse(verse);
          return;
        }
      }
    }
  }

  /**
   * Deletes a cached verse
   * @param {string} encodedKey - URL-encoded cache key
   */
  async function deleteCachedVerse(encodedKey) {
    const key = decodeURIComponent(encodedKey);

    try {
      await fetch(`/api/cached-verse/${encodedKey}`, { method: 'DELETE' });

      if (state.selectedCacheKey === key) {
        state.selectedCacheKey = null;
      }

      await loadCachedVerses();
      status.success('Verse removed from cache');
    } catch (error) {
      status.error('Error deleting verse');
    }
  }

  /**
   * Clears all cached verses
   */
  async function clearAllCache() {
    if (!confirm('Clear ALL cached verses? This cannot be undone.')) return;

    try {
      await fetch('/api/cached-verses', { method: 'DELETE' });
      await loadCachedVerses();
      status.success('Cache cleared');
    } catch (error) {
      status.error('Error clearing cache');
    }
  }

  // ============================================
  // Verse Functions
  // ============================================

  /**
   * Fetches a verse from the API
   * @returns {Object|null} Verse data or null on error
   */
  async function fetchVerse() {
    const reference = elements.reference.value.trim();
    const version = elements.version.value;

    if (!reference) {
      status.error('Please enter a Bible reference');
      return null;
    }

    status.loading('Fetching verse...');

    try {
      const response = await fetch('/api/fetch-verse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference, version }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch verse');
      }

      if (!data.text && (!data.verses || data.verses.length === 0)) {
        throw new Error('No verse text found. Check the reference.');
      }

      state.lastFetchedVerse = data;
      showPreview(data);

      const cacheStatus = data.fromCache ? ' (from cache)' : ' (fetched & cached)';
      const verseCount = data.verses ? ` - ${data.verses.length} verses` : '';
      status.success('Verse loaded' + cacheStatus + verseCount);

      if (!data.fromCache) {
        await loadCachedVerses();
      }

      return data;
    } catch (error) {
      status.error(error.message);
      return null;
    }
  }

  /**
   * Sends verse to display via socket
   * @param {Object} data - Verse data
   */
  function displayVerse(data) {
    if (data) {
      connection.emit('displayVerse', data);
      status.success('Verse sent to display');
    }
  }

  /**
   * Clears the display
   */
  function clearDisplay() {
    connection.emit('clearVerse');
    connection.emit('clearFallacy');
    elements.pagingControls.classList.remove('visible');
    status.success('Display cleared');
  }

  /**
   * Shows verse preview
   * @param {Object} data - Verse data
   */
  function showPreview(data) {
    const fromCache = data.fromCache
      ? '<span style="color: #51cf66;">(cached)</span>'
      : '';
    const verseCount = data.verses
      ? `<div class="preview-stats">${data.verses.length} verse(s) - will display 3 per page</div>`
      : '';

    elements.previewContent.innerHTML = `
      <div class="preview-reference">${escapeHtml(data.reference)} ${fromCache}</div>
      <div class="preview-text">${escapeHtml(data.text)}</div>
      <div class="preview-version">${escapeHtml(data.versionName || data.version)}</div>
      ${verseCount}
    `;
  }

  // ============================================
  // Fallacy Functions
  // ============================================

  /**
   * Loads all fallacies from the API
   */
  async function loadFallacies() {
    try {
      const response = await fetch('/api/fallacies');
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      state.allFallacies = await response.json();
      elements.fallacyCount.textContent = state.allFallacies.length;
      renderFallacyList();
    } catch (error) {
      console.error('Error loading fallacies:', error);
      elements.fallacyList.innerHTML = '<div class="cache-empty">Error loading fallacies</div>';
    }
  }

  /**
   * Renders the fallacy list with optional search filtering
   * @param {string} filter - Search filter string
   */
  function renderFallacyList(filter = '') {
    const searchTerm = filter.toLowerCase();
    const filtered = searchTerm
      ? state.allFallacies.filter((f) =>
          f.name.toLowerCase().includes(searchTerm) ||
          f.definition.toLowerCase().includes(searchTerm) ||
          (f.aliases && f.aliases.some((a) => a.toLowerCase().includes(searchTerm)))
        )
      : state.allFallacies;

    if (filtered.length === 0) {
      elements.fallacyList.innerHTML = searchTerm
        ? '<div class="cache-empty">No fallacies match your search.</div>'
        : '<div class="cache-empty">No fallacies loaded.<br>Run the scraper to build the database.</div>';
      return;
    }

    let html = '';
    for (const fallacy of filtered) {
      const isSelected = state.selectedFallacySlug === fallacy.slug;
      const aliasText = fallacy.aliases && fallacy.aliases.length > 0
        ? fallacy.aliases.join(', ')
        : '';

      html += `
        <div class="fallacy-item ${isSelected ? 'selected' : ''}" data-slug="${escapeHtml(fallacy.slug)}">
          <div class="fallacy-item-content">
            <div class="fallacy-item-name">${escapeHtml(fallacy.name)}</div>
            <div class="fallacy-item-def">${escapeHtml(fallacy.definition)}</div>
            ${aliasText ? `<div class="fallacy-item-aliases">${escapeHtml(aliasText)}</div>` : ''}
          </div>
        </div>
      `;
    }

    elements.fallacyList.innerHTML = html;
  }

  /**
   * Selects a fallacy and sends it to the display
   * @param {string} slug - Fallacy slug
   */
  function selectFallacy(slug) {
    const fallacy = state.allFallacies.find((f) => f.slug === slug);
    if (!fallacy) return;

    // Toggle off if already selected
    if (state.selectedFallacySlug === slug) {
      state.selectedFallacySlug = null;
      document.querySelectorAll('.fallacy-item').forEach((el) => {
        el.classList.remove('selected');
      });
      connection.emit('clearFallacy');
      status.success('Fallacy cleared');
      return;
    }

    state.selectedFallacySlug = slug;

    // Update selection UI
    document.querySelectorAll('.fallacy-item').forEach((el) => {
      el.classList.toggle('selected', el.dataset.slug === slug);
    });

    // Send to display
    connection.emit('displayFallacy', {
      name: fallacy.name,
      definition: fallacy.definition,
      slug: fallacy.slug,
    });

    status.success(`Fallacy displayed: ${fallacy.name}`);
  }

  /**
   * Handles fallacy list click events via delegation
   * @param {Event} event - Click event
   */
  function handleFallacyListClick(event) {
    const fallacyItem = event.target.closest('.fallacy-item');
    if (fallacyItem && fallacyItem.dataset.slug) {
      selectFallacy(fallacyItem.dataset.slug);
    }
  }

  // ============================================
  // Paging Functions
  // ============================================

  /**
   * Updates paging UI from verse update
   * @param {Object} data - Verse update data
   */
  function updatePagingUI(data) {
    console.log('verseUpdate received:', data);

    if (data.verses && data.verses.length > 0 && data.reference) {
      const totalVerses = data.verses.length;
      const versesPerPage = data.versesPerPage || 3;
      const totalPages = Math.ceil(totalVerses / versesPerPage);
      const currentPage = data.currentPage || 0;

      // Update state
      state.paging = { currentPage, totalPages, totalVerses, versesPerPage };

      // Update display info
      const startVerse = currentPage * versesPerPage + 1;
      const endVerse = Math.min((currentPage + 1) * versesPerPage, totalVerses);

      // Show/hide paging controls
      if (totalPages > 1) {
        elements.pagingControls.classList.add('visible');
        elements.currentPage.textContent = currentPage + 1;
        elements.totalPages.textContent = totalPages;
        elements.verseRange.textContent = ` (verses ${startVerse}-${endVerse} of ${totalVerses})`;

        elements.prevPageBtn.disabled = currentPage === 0;
        elements.nextPageBtn.disabled = currentPage >= totalPages - 1;
      } else {
        elements.pagingControls.classList.remove('visible');
      }
    } else {
      elements.pagingControls.classList.remove('visible');
    }
  }

  /**
   * Navigates to previous page
   */
  function goToPrevPage() {
    if (state.paging.currentPage > 0) {
      connection.emit('changePage', { direction: 'prev' });
    }
  }

  /**
   * Navigates to next page
   */
  function goToNextPage() {
    if (state.paging.currentPage < state.paging.totalPages - 1) {
      connection.emit('changePage', { direction: 'next' });
    }
  }

  // ============================================
  // Event Handlers
  // ============================================

  /**
   * Handles cache list click events via delegation
   * @param {Event} event - Click event
   */
  function handleCacheListClick(event) {
    const target = event.target;

    // Book header toggle
    const bookHeader = target.closest('.book-header');
    if (bookHeader) {
      toggleBook(bookHeader);
      return;
    }

    // Verse select
    const selectTarget = target.closest('[data-action="select"]');
    if (selectTarget) {
      const verseEl = target.closest('.cached-verse');
      if (verseEl) {
        selectCachedVerse(verseEl.dataset.key);
      }
      return;
    }

    // Verse delete
    const deleteTarget = target.closest('[data-action="delete"]');
    if (deleteTarget) {
      event.stopPropagation();
      const verseEl = target.closest('.cached-verse');
      if (verseEl) {
        deleteCachedVerse(verseEl.dataset.key);
      }
    }
  }

  /**
   * Handles keyboard shortcuts in reference input
   * @param {KeyboardEvent} event - Keyboard event
   */
  async function handleKeyboardShortcut(event) {
    if (event.key === 'Enter') {
      if (event.shiftKey) {
        await fetchVerse();
      } else {
        const data = await fetchVerse();
        if (data) {
          displayVerse(data);
        }
      }
    } else if (event.key === 'Escape') {
      clearDisplay();
    }
  }

  // ============================================
  // Modal Functions
  // ============================================

  function openCacheModal() {
    elements.cacheModal.classList.add('active');
  }

  function closeCacheModal() {
    elements.cacheModal.classList.remove('active');
    // Clear search and show full cache
    elements.cacheSearch.value = '';
    renderCacheList();
  }

  function openHelpModal() {
    // Update URLs based on current location
    const baseUrl = window.location.origin;
    elements.displayUrl.textContent = baseUrl + '/bible-display.html';
    elements.controlUrl.textContent = baseUrl + '/bible-control.html';
    elements.helpModal.classList.add('active');
  }

  function closeHelpModal() {
    elements.helpModal.classList.remove('active');
  }

  function openFallacyModal() {
    elements.fallacyModal.classList.add('active');
    elements.fallacySearch.focus();
  }

  function closeFallacyModal() {
    elements.fallacyModal.classList.remove('active');
    elements.fallacySearch.value = '';
    renderFallacyList();
  }

  // ============================================
  // Initialization
  // ============================================

  function init() {
    // Socket event handlers
    connection.on('verseUpdate', updatePagingUI);

    // Button event handlers
    elements.fetchBtn.addEventListener('click', async () => {
      const data = await fetchVerse();
      if (data) displayVerse(data);
    });

    elements.fetchOnlyBtn.addEventListener('click', fetchVerse);
    elements.clearBtn.addEventListener('click', clearDisplay);
    elements.prevPageBtn.addEventListener('click', goToPrevPage);
    elements.nextPageBtn.addEventListener('click', goToNextPage);
    elements.refreshCache.addEventListener('click', () => {
      loadCachedVerses();
      status.success('Cache refreshed');
    });
    elements.clearCache.addEventListener('click', clearAllCache);

    // Cache list event delegation
    elements.cacheList.addEventListener('click', handleCacheListClick);

    // Search filter
    elements.cacheSearch.addEventListener('input', (e) => {
      renderCacheList(e.target.value);
    });

    // Keyboard shortcuts
    elements.reference.addEventListener('keydown', handleKeyboardShortcut);

    // Fallacy list event delegation and search
    elements.fallacyList.addEventListener('click', handleFallacyListClick);
    elements.fallacySearch.addEventListener('input', (e) => {
      renderFallacyList(e.target.value);
    });

    // Modal event handlers
    elements.showCacheBtn.addEventListener('click', openCacheModal);
    elements.closeCacheBtn.addEventListener('click', closeCacheModal);
    elements.showFallacyBtn.addEventListener('click', openFallacyModal);
    elements.closeFallacyBtn.addEventListener('click', closeFallacyModal);
    elements.showHelpBtn.addEventListener('click', openHelpModal);
    elements.closeHelpBtn.addEventListener('click', closeHelpModal);

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // Check for settings modal first (highest z-index)
        const settingsModal = document.getElementById('settingsModal');
        if (settingsModal && settingsModal.classList.contains('active')) {
          // Let settings-modal.js handle its own escape
          return;
        }

        // Then check our modals
        if (elements.fallacyModal.classList.contains('active')) {
          if (document.activeElement !== elements.fallacySearch) {
            closeFallacyModal();
          }
        } else if (elements.cacheModal.classList.contains('active')) {
          if (document.activeElement !== elements.cacheSearch) {
            closeCacheModal();
          }
        } else if (elements.helpModal.classList.contains('active')) {
          closeHelpModal();
        } else {
          // No modal open - clear the display
          clearDisplay();
        }
      }
    });

    // Focus reference input
    elements.reference.focus();

    // Load shared config from server, then load cache and fallacies
    loadConfig().then(() => {
      loadCachedVerses();
      loadFallacies();
    });
  }

  // Start application when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();