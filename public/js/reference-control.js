/**
 * Reference Repository Control Panel
 * Unified control for Bible verses, Quran verses, and logical fallacies
 * @module js/reference-control
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

  async function loadConfig() {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const config = await response.json();
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
    activeTab: 'bible',
    // Bible state
    lastFetchedVerse: null,
    cachedVerses: {},
    selectedCacheKey: null,
    // Quran state
    lastFetchedQuranVerse: null,
    cachedQuranVerses: {},
    selectedQuranCacheKey: null,
    // Dictionary state
    lastFetchedDefinition: null,
    cachedDefinitions: {},
    selectedDictCacheKey: null,
    // Shared paging
    paging: {
      currentPage: 0,
      totalPages: 1,
      totalVerses: 0,
      versesPerPage: 3,
    },
    // Interlinear state
    lastFetchedInterlinear: null,
    cachedInterlinear: {},
    selectedInterlinearKey: null,
    selectedWord: null,
    selectedLexicon: null,
    // Fallacy state
    allFallacies: [],
    selectedFallacySlug: null,
  };

  // ============================================
  // DOM Elements
  // ============================================

  const elements = {
    // Tab elements
    tabs: document.querySelectorAll('.tab'),
    tabContents: document.querySelectorAll('.tab-content'),

    // Bible inputs
    reference: document.getElementById('reference'),
    version: document.getElementById('version'),
    fetchBibleBtn: document.getElementById('fetchBibleBtn'),
    fetchBibleOnlyBtn: document.getElementById('fetchBibleOnlyBtn'),
    clearBibleBtn: document.getElementById('clearBibleBtn'),

    // Quran inputs
    quranReference: document.getElementById('quranReference'),
    quranEdition: document.getElementById('quranEdition'),
    fetchQuranBtn: document.getElementById('fetchQuranBtn'),
    fetchQuranOnlyBtn: document.getElementById('fetchQuranOnlyBtn'),
    clearQuranBtn: document.getElementById('clearQuranBtn'),

    // Dictionary inputs
    dictionaryWord: document.getElementById('dictionaryWord'),
    fetchDictBtn: document.getElementById('fetchDictBtn'),
    fetchDictOnlyBtn: document.getElementById('fetchDictOnlyBtn'),
    clearDictBtn: document.getElementById('clearDictBtn'),

    // Paging
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    pagingControls: document.getElementById('pagingControls'),
    currentPage: document.getElementById('currentPage'),
    totalPages: document.getElementById('totalPages'),
    verseRange: document.getElementById('verseRange'),

    // Shared display
    status: document.getElementById('status'),
    previewContent: document.getElementById('previewContent'),
    cacheCount: document.getElementById('cacheCount'),

    // Cache modal
    cacheModal: document.getElementById('cacheModal'),
    cacheModalTitle: document.getElementById('cacheModalTitle'),
    showCacheBtn: document.getElementById('showCacheBtn'),
    closeCacheBtn: document.getElementById('closeCacheBtn'),
    cacheSearch: document.getElementById('cacheSearch'),
    cacheList: document.getElementById('cacheList'),
    refreshCache: document.getElementById('refreshCache'),
    clearCache: document.getElementById('clearCache'),

    // Help modal
    helpModal: document.getElementById('helpModal'),
    showHelpBtn: document.getElementById('showHelpBtn'),
    closeHelpBtn: document.getElementById('closeHelpBtn'),
    displayUrl: document.getElementById('displayUrl'),
    controlUrl: document.getElementById('controlUrl'),

    // Interlinear elements
    interlinearReference: document.getElementById('interlinearReference'),
    fetchInterlinearBtn: document.getElementById('fetchInterlinearBtn'),
    clearInterlinearBtn: document.getElementById('clearInterlinearBtn'),
    interlinearResults: document.getElementById('interlinearResults'),
    interlinearHeader: document.getElementById('interlinearHeader'),
    interlinearGrid: document.getElementById('interlinearGrid'),

    // Fallacy elements
    fallacySearch: document.getElementById('fallacySearch'),
    fallacyList: document.getElementById('fallacyList'),
    fallacyCount: document.getElementById('fallacyCount'),
    clearFallacyBtn: document.getElementById('clearFallacyBtn'),
  };

  // ============================================
  // Services
  // ============================================

  const connection = createSocketConnection();
  const status = createStatusManager('status');

  // ============================================
  // Tab Management
  // ============================================

  function switchTab(tabName) {
    state.activeTab = tabName;

    elements.tabs.forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    elements.tabContents.forEach((content) => {
      content.classList.toggle('active', content.id === 'tab-' + tabName);
    });

    // Focus the appropriate input
    if (tabName === 'bible') {
      elements.reference.focus();
    } else if (tabName === 'quran') {
      elements.quranReference.focus();
    } else if (tabName === 'dictionary') {
      elements.dictionaryWord.focus();
    } else if (tabName === 'interlinear') {
      elements.interlinearReference.focus();
    } else if (tabName === 'fallacies') {
      elements.fallacySearch.focus();
    }
  }

  // ============================================
  // Bible Cache Functions
  // ============================================

  const isOldTestamentBook = (bookName) => {
    return OLD_TESTAMENT_BOOKS.some(
      (otBook) => bookName.toLowerCase().startsWith(otBook.toLowerCase())
    );
  };

  async function loadBibleCachedVerses() {
    try {
      const response = await fetch('/api/cached-verses');
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      state.cachedVerses = await response.json();
      updateCacheCount();
    } catch (error) {
      console.error('Error loading Bible cache:', error);
    }
  }

  async function loadQuranCachedVerses() {
    try {
      const response = await fetch('/api/cached-quran-verses');
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      state.cachedQuranVerses = await response.json();
      updateCacheCount();
    } catch (error) {
      console.error('Error loading Quran cache:', error);
    }
  }

  async function loadDictionaryCachedWords() {
    try {
      const response = await fetch('/api/cached-definitions');
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      state.cachedDefinitions = await response.json();
      updateCacheCount();
    } catch (error) {
      console.error('Error loading dictionary cache:', error);
    }
  }

  async function loadInterlinearCached() {
    try {
      const response = await fetch('/api/cached-interlinear');
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      state.cachedInterlinear = await response.json();
      updateCacheCount();
    } catch (error) {
      console.error('Error loading interlinear cache:', error);
    }
  }

  function updateCacheCount() {
    const bibleCount = Object.values(state.cachedVerses)
      .reduce((sum, arr) => sum + arr.length, 0);
    const quranCount = Object.values(state.cachedQuranVerses)
      .reduce((sum, arr) => sum + arr.length, 0);
    const dictCount = Object.values(state.cachedDefinitions)
      .reduce((sum, arr) => sum + arr.length, 0);
    const interlinearCount = Object.values(state.cachedInterlinear)
      .reduce((sum, arr) => sum + arr.length, 0);
    const total = bibleCount + quranCount + dictCount + interlinearCount;
    elements.cacheCount.textContent = total || '';
  }

  function renderCacheList(filter = '') {
    if (state.activeTab === 'quran') {
      renderQuranCacheList(filter);
    } else if (state.activeTab === 'dictionary') {
      renderDictionaryCacheList(filter);
    } else if (state.activeTab === 'interlinear') {
      renderInterlinearCacheList(filter);
    } else {
      renderBibleCacheList(filter);
    }
  }

  function renderBibleCacheList(filter = '') {
    const searchTerm = filter.toLowerCase();
    const books = Object.keys(state.cachedVerses);

    if (books.length === 0) {
      elements.cacheList.innerHTML =
        '<div class="cache-empty">No cached Bible verses yet.<br>Fetch a verse to add it to the cache.</div>';
      return;
    }

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

      if (inOT && !isOTBook && !addedNTDivider) {
        if (html !== '') html += '<div class="testament-divider">New Testament</div>';
        addedNTDivider = true;
        inOT = false;
      } else if (!addedNTDivider && html === '' && isOTBook) {
        html += '<div class="testament-divider">Old Testament</div>';
      } else if (!addedNTDivider && html === '' && !isOTBook) {
        html += '<div class="testament-divider">New Testament</div>';
        addedNTDivider = true;
        inOT = false;
      }

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
          <div class="cached-verse ${isSelected ? 'selected' : ''}" data-key="${encodedKey}" data-source="bible">
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

    elements.cacheList.innerHTML = html || '<div class="cache-empty">No verses match your search.</div>';
  }

  function renderQuranCacheList(filter = '') {
    const searchTerm = filter.toLowerCase();
    const surahs = Object.keys(state.cachedQuranVerses);

    if (surahs.length === 0) {
      elements.cacheList.innerHTML =
        '<div class="cache-empty">No cached Quran verses yet.<br>Fetch a verse to add it to the cache.</div>';
      return;
    }

    let html = '';

    for (const surah of surahs) {
      const verses = state.cachedQuranVerses[surah].filter((v) => {
        if (!searchTerm) return true;
        return (
          v.reference.toLowerCase().includes(searchTerm) ||
          v.text.toLowerCase().includes(searchTerm) ||
          v.version.toLowerCase().includes(searchTerm)
        );
      });

      if (verses.length === 0) continue;

      html += `
        <div class="book-group">
          <div class="book-header quran-header" data-book="${escapeHtml(surah)}">
            <span>${escapeHtml(surah)} (${verses.length})</span>
            <span class="toggle">▼</span>
          </div>
          <div class="book-verses">
      `;

      for (const verse of verses) {
        const isSelected = state.selectedQuranCacheKey === verse.key;
        const encodedKey = encodeURIComponent(verse.key);
        html += `
          <div class="cached-verse ${isSelected ? 'selected' : ''}" data-key="${encodedKey}" data-source="quran">
            <div class="cached-verse-content" data-action="select">
              <div class="cached-verse-ref">${escapeHtml(verse.reference)}</div>
              <div class="cached-verse-version">${escapeHtml(verse.versionName || verse.version)}</div>
            </div>
            <button class="btn-delete" data-action="delete" title="Delete from cache">×</button>
          </div>
        `;
      }

      html += '</div></div>';
    }

    elements.cacheList.innerHTML = html || '<div class="cache-empty">No verses match your search.</div>';
  }

  function renderDictionaryCacheList(filter = '') {
    const searchTerm = filter.toLowerCase();
    const letters = Object.keys(state.cachedDefinitions);

    if (letters.length === 0) {
      elements.cacheList.innerHTML =
        '<div class="cache-empty">No cached definitions yet.<br>Look up a word to add it to the cache.</div>';
      return;
    }

    let html = '';

    for (const letter of letters) {
      const words = state.cachedDefinitions[letter].filter((w) => {
        if (!searchTerm) return true;
        return (
          w.reference.toLowerCase().includes(searchTerm) ||
          w.text.toLowerCase().includes(searchTerm)
        );
      });

      if (words.length === 0) continue;

      html += `
        <div class="book-group">
          <div class="book-header" data-book="${escapeHtml(letter)}">
            <span>${escapeHtml(letter)} (${words.length})</span>
            <span class="toggle">▼</span>
          </div>
          <div class="book-verses">
      `;

      for (const word of words) {
        const isSelected = state.selectedDictCacheKey === word.key;
        const encodedKey = encodeURIComponent(word.key);
        html += `
          <div class="cached-verse ${isSelected ? 'selected' : ''}" data-key="${encodedKey}" data-source="dictionary">
            <div class="cached-verse-content" data-action="select">
              <div class="cached-verse-ref">${escapeHtml(word.reference)}</div>
              <div class="cached-verse-version">${escapeHtml(word.phonetic || 'Dictionary')}</div>
            </div>
            <button class="btn-delete" data-action="delete" title="Delete from cache">×</button>
          </div>
        `;
      }

      html += '</div></div>';
    }

    elements.cacheList.innerHTML = html || '<div class="cache-empty">No definitions match your search.</div>';
  }

  function toggleBook(header) {
    header.classList.toggle('collapsed');
    header.nextElementSibling.classList.toggle('hidden');
  }

  async function selectCachedVerse(encodedKey, source) {
    const key = decodeURIComponent(encodedKey);

    // Handle interlinear cache selection separately
    if (source === 'interlinear') {
      state.selectedInterlinearKey = key;
      document.querySelectorAll('.cached-verse').forEach((el) => {
        const elKey = decodeURIComponent(el.dataset.key);
        el.classList.toggle('selected', elKey === key && el.dataset.source === source);
      });

      try {
        const response = await fetch('/api/cached-interlinear/' + encodeURIComponent(key));
        if (response.ok) {
          const data = await response.json();
          state.lastFetchedInterlinear = data;
          elements.interlinearReference.value = data.reference;
          renderInterlinearGrid(data);
          displayInterlinearOnOBS();
        }
      } catch (error) {
        console.error('Error loading cached interlinear:', error);
      }
      return;
    }

    const cacheMap = {
      quran: state.cachedQuranVerses,
      dictionary: state.cachedDefinitions,
    };
    const cache = cacheMap[source] || state.cachedVerses;

    // Update selection state
    if (source === 'quran') {
      state.selectedQuranCacheKey = key;
    } else if (source === 'dictionary') {
      state.selectedDictCacheKey = key;
    } else {
      state.selectedCacheKey = key;
    }

    document.querySelectorAll('.cached-verse').forEach((el) => {
      const elKey = decodeURIComponent(el.dataset.key);
      el.classList.toggle('selected', elKey === key && el.dataset.source === source);
    });

    for (const group of Object.values(cache)) {
      for (const verse of group) {
        if (verse.key === key) {
          if (source === 'quran') {
            state.lastFetchedQuranVerse = verse;
            elements.quranReference.value = verse.reference;
            elements.quranEdition.value = verse.version;
          } else if (source === 'dictionary') {
            state.lastFetchedDefinition = verse;
            elements.dictionaryWord.value = verse.reference;
          } else {
            state.lastFetchedVerse = verse;
            elements.reference.value = verse.reference;
            elements.version.value = verse.version;
          }
          showPreview(verse, source);
          displayVerse(verse, source);
          return;
        }
      }
    }
  }

  async function deleteCachedVerse(encodedKey, source) {
    const key = decodeURIComponent(encodedKey);
    const endpointMap = {
      quran: '/api/cached-quran-verse/',
      dictionary: '/api/cached-definition/',
      interlinear: '/api/cached-interlinear/',
    };
    const endpoint = endpointMap[source] || '/api/cached-verse/';

    try {
      await fetch(endpoint + encodedKey, { method: 'DELETE' });

      if (source === 'quran') {
        if (state.selectedQuranCacheKey === key) state.selectedQuranCacheKey = null;
        await loadQuranCachedVerses();
      } else if (source === 'dictionary') {
        if (state.selectedDictCacheKey === key) state.selectedDictCacheKey = null;
        await loadDictionaryCachedWords();
      } else if (source === 'interlinear') {
        if (state.selectedInterlinearKey === key) state.selectedInterlinearKey = null;
        await loadInterlinearCached();
      } else {
        if (state.selectedCacheKey === key) state.selectedCacheKey = null;
        await loadBibleCachedVerses();
      }
      renderCacheList();
      status.success('Entry removed from cache');
    } catch (error) {
      status.error('Error deleting entry');
    }
  }

  async function clearAllCache() {
    const labelMap = { quran: 'Quran', dictionary: 'Dictionary', interlinear: 'Interlinear' };
    const label = labelMap[state.activeTab] || 'Bible';
    if (!confirm(`Clear ALL cached ${label} entries? This cannot be undone.`)) return;

    const endpointMap = {
      quran: '/api/cached-quran-verses',
      dictionary: '/api/cached-definitions',
      interlinear: '/api/cached-interlinear',
    };
    const endpoint = endpointMap[state.activeTab] || '/api/cached-verses';

    try {
      await fetch(endpoint, { method: 'DELETE' });
      if (state.activeTab === 'quran') {
        await loadQuranCachedVerses();
      } else if (state.activeTab === 'dictionary') {
        await loadDictionaryCachedWords();
      } else if (state.activeTab === 'interlinear') {
        await loadInterlinearCached();
      } else {
        await loadBibleCachedVerses();
      }
      renderCacheList();
      status.success(`${label} cache cleared`);
    } catch (error) {
      status.error('Error clearing cache');
    }
  }

  // ============================================
  // Bible Verse Functions
  // ============================================

  async function fetchBibleVerse() {
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
      showPreview(data, 'bible');

      const cacheStatus = data.fromCache ? ' (from cache)' : ' (fetched & cached)';
      const verseCount = data.verses ? ` - ${data.verses.length} verses` : '';
      status.success('Verse loaded' + cacheStatus + verseCount);

      if (!data.fromCache) await loadBibleCachedVerses();

      return data;
    } catch (error) {
      status.error(error.message);
      return null;
    }
  }

  // ============================================
  // Quran Verse Functions
  // ============================================

  async function fetchQuranVerse() {
    const reference = elements.quranReference.value.trim();
    const edition = elements.quranEdition.value;

    if (!reference) {
      status.error('Please enter a Quran reference');
      return null;
    }

    status.loading('Fetching Quran verse...');

    try {
      const response = await fetch('/api/fetch-quran-verse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference, edition }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch Quran verse');
      }

      if (!data.text && (!data.verses || data.verses.length === 0)) {
        throw new Error('No verse text found. Check the reference.');
      }

      state.lastFetchedQuranVerse = data;
      showPreview(data, 'quran');

      const cacheStatus = data.fromCache ? ' (from cache)' : ' (fetched & cached)';
      const verseCount = data.verses ? ` - ${data.verses.length} ayah(s)` : '';
      status.success('Quran verse loaded' + cacheStatus + verseCount);

      if (!data.fromCache) await loadQuranCachedVerses();

      return data;
    } catch (error) {
      status.error(error.message);
      return null;
    }
  }

  // ============================================
  // Dictionary Functions
  // ============================================

  async function fetchDictionaryWord() {
    const word = elements.dictionaryWord.value.trim();

    if (!word) {
      status.error('Please enter a word to look up');
      return null;
    }

    status.loading('Looking up definition...');

    try {
      const response = await fetch('/api/fetch-definition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch definition');
      }

      if (!data.verses || data.verses.length === 0) {
        throw new Error('No definitions found for this word.');
      }

      state.lastFetchedDefinition = data;
      showPreview(data, 'dictionary');

      const cacheStatus = data.fromCache ? ' (from cache)' : ' (fetched & cached)';
      status.success(`Definition loaded${cacheStatus} - ${data.verses.length} definition(s)`);

      if (!data.fromCache) await loadDictionaryCachedWords();

      return data;
    } catch (error) {
      status.error(error.message);
      return null;
    }
  }

  // ============================================
  // Interlinear Functions
  // ============================================

  async function fetchInterlinear() {
    const reference = elements.interlinearReference.value.trim();

    if (!reference) {
      status.error('Please enter a Bible reference');
      return null;
    }

    status.loading('Fetching interlinear data...');

    try {
      const response = await fetch('/api/fetch-interlinear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch interlinear data');
      }

      if (!data.words || data.words.length === 0) {
        throw new Error('No interlinear data found. Check the reference.');
      }

      state.lastFetchedInterlinear = data;
      renderInterlinearGrid(data);
      displayInterlinearOnOBS();

      const cacheStatus = data.fromCache ? ' (from cache)' : ' (fetched & cached)';
      const lang = data.language === 'hebrew' ? 'Hebrew' : 'Greek';
      const langLabel = lang === 'Hebrew' ? 'Hebrew (WLC)' : 'Greek (Tischendorf)';
      const verseNums = [...new Set(data.words.map((w) => w.verseNum))];
      showPreview({
        reference: data.reference,
        text: `${data.words.length} words across ${verseNums.length} verse(s)`,
        version: langLabel,
        versionName: langLabel,
        fromCache: data.fromCache,
      }, 'interlinear');
      status.success(`${lang} interlinear loaded${cacheStatus} - ${data.words.length} words`);

      if (!data.fromCache) await loadInterlinearCached();

      return data;
    } catch (error) {
      status.error(error.message);
      return null;
    }
  }

  function renderInterlinearGrid(data) {
    const isHebrew = data.language === 'hebrew';
    const langClass = isHebrew ? 'hebrew' : 'greek';
    const langLabel = isHebrew ? 'Hebrew (WLC)' : 'Greek (Tischendorf)';

    elements.interlinearHeader.textContent = `${data.reference} — ${langLabel} — ${data.words.length} words`;
    elements.interlinearResults.style.display = 'block';
    elements.interlinearGrid.classList.toggle('rtl', isHebrew);

    let html = '';
    let currentVerse = null;

    for (let i = 0; i < data.words.length; i++) {
      const w = data.words[i];

      if (w.verseNum !== currentVerse) {
        currentVerse = w.verseNum;
        html += `<div class="interlinear-verse-marker">v. ${currentVerse}</div>`;
      }

      const morphTitle = w.morph ? decodeMorph(w.morph) : '';
      html += `
        <div class="interlinear-word ${langClass}" data-index="${i}" data-strongs="${escapeHtml(w.strongs || '')}"${morphTitle ? ` title="${escapeHtml(w.morph + ': ' + morphTitle)}"` : ''}>
          <span class="word-original">${escapeHtml(w.original)}</span>
          <span class="word-translit">${escapeHtml(w.transliteration || '')}</span>
          <span class="word-strongs">${escapeHtml(w.strongs || '')}</span>
          <span class="word-gloss">${escapeHtml(w.gloss || '')}</span>
        </div>
      `;
    }

    elements.interlinearGrid.innerHTML = html;

    // Attach click handlers
    elements.interlinearGrid.querySelectorAll('.interlinear-word').forEach((el) => {
      el.addEventListener('click', () => {
        const index = parseInt(el.dataset.index, 10);
        const word = data.words[index];
        selectInterlinearWord(word, el);
      });
    });
  }

  async function selectInterlinearWord(word, el) {
    // Toggle off if clicking the already-selected word — revert to verse display
    if (el.classList.contains('selected')) {
      el.classList.remove('selected');
      state.selectedWord = null;
      state.selectedLexicon = null;
      displayInterlinearOnOBS();
      // Restore verse preview
      const data = state.lastFetchedInterlinear;
      if (data) {
        const lang = data.language === 'hebrew' ? 'Hebrew' : 'Greek';
        const langLabel = lang === 'Hebrew' ? 'Hebrew (WLC)' : 'Greek (Tischendorf)';
        const verseNums = [...new Set(data.words.map((w) => w.verseNum))];
        showPreview({
          reference: data.reference,
          text: `${data.words.length} words across ${verseNums.length} verse(s)`,
          version: langLabel,
          versionName: langLabel,
        }, 'interlinear');
      }
      status.success('Reverted to verse display');
      return;
    }

    // Update visual selection
    elements.interlinearGrid.querySelectorAll('.interlinear-word').forEach((w) => w.classList.remove('selected'));
    el.classList.add('selected');

    state.selectedWord = word;

    if (!word.strongs) {
      status.error('No Strong\'s number for this word');
      return;
    }

    status.loading('Fetching lexicon entry...');

    try {
      const response = await fetch('/api/fetch-lexicon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strongsNumber: word.strongs }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch lexicon entry');
      }

      state.selectedLexicon = data;
      showLexiconPreview(word, data);
      displayLexiconOnOBS();
      status.success(`Lexicon entry displayed for ${word.strongs}`);
    } catch (error) {
      status.error(error.message);
    }
  }

  function displayInterlinearOnOBS() {
    const data = state.lastFetchedInterlinear;
    if (!data) return;

    // Group words by verse number
    const verseGroups = {};
    for (const w of data.words) {
      const v = w.verseNum || 1;
      if (!verseGroups[v]) verseGroups[v] = [];
      verseGroups[v].push(w);
    }

    // Build one verse object per verse group
    const realVerses = Object.entries(verseGroups).map(([num, words]) => ({
      number: String(num),
      text: words.map((w) => `${w.original} (${w.gloss || w.strongs || ''})`).join('  '),
      words: words.map((w) => ({
        original: w.original,
        transliteration: w.transliteration || '',
        strongs: w.strongs || '',
        gloss: w.gloss || '',
      })),
    }));

    // Pad to 1 verse per page: server uses versesPerPage (3), so create
    // versesPerPage placeholders per real verse. Only the first of each group
    // carries the word data; the display renders 1 interlinear verse per page.
    const vpp = state.paging.versesPerPage;
    const paddedVerses = [];
    for (const verse of realVerses) {
      paddedVerses.push(verse);
      for (let i = 1; i < vpp; i++) {
        paddedVerses.push({ number: '', text: '' });
      }
    }

    const langLabel = data.language === 'hebrew' ? 'Hebrew Interlinear (WLC)' : 'Greek Interlinear (Tischendorf)';

    connection.emit('displayVerse', {
      reference: data.reference,
      version: langLabel,
      versionName: langLabel,
      text: realVerses.map((v) => v.text).join(' '),
      verses: paddedVerses,
      totalVerses: paddedVerses.length,
      source: 'interlinear',
      language: data.language,
      lexicon: null,
    });
    status.success('Interlinear sent to display');
  }

  /**
   * Parses definitions from a raw lexicon definition string
   * Handles both Greek (numbered: "1. ...", "a. ...") and Hebrew (dash-separated) formats
   * @param {string} raw - Raw definition text
   * @returns {string[]} Array of definition strings
   */
  function parseLexiconDefinitions(raw) {
    if (!raw) return [];

    // Strip metadata sections that may follow definitions inline
    const cleaned = raw.replace(/\s*-\s*Origin:[\s\S]*$/i, '')
      .replace(/\s*-\s*TDNT[\s\S]*$/i, '')
      .replace(/\s*-\s*Part\(s\)[\s\S]*$/i, '')
      .replace(/\s*-\s*Strongs:[\s\S]*$/i, '');

    // Try numbered format first (Greek-style): "1. ...", "2. ...", "a. ..."
    const numbered = [];
    const numLines = cleaned.split(/[\n]/).map((l) => l.trim()).filter(Boolean);
    for (const line of numLines) {
      const segments = line.split(/\s+(?=\d+\.\s|[a-z]\.\s)/);
      for (const seg of segments) {
        const match = seg.trim().match(/^(\d+|[a-z])\.\s+(.+)/);
        if (match) numbered.push(match[0].trim());
      }
    }
    if (numbered.length > 0) return numbered;

    // Fallback: Hebrew BDB format — extract between "Definition:" and "Origin:"
    const defMatch = raw.match(/Definition[:\s]*[-\s]*([\s\S]*?)(?:\n\s*Origin:|\n\s*TWOT|\n\s*Part)/i);
    if (!defMatch) return [];

    const items = defMatch[1]
      .split(/\s*-\s*/)
      .map((s) => s.trim().replace(/\n/g, ' ').replace(/\s+/g, ' '))
      .filter(Boolean);

    return items;
  }

  /**
   * Parses metadata fields (origin, part of speech, etc.) from a raw lexicon definition
   * @param {string} raw - Raw definition text
   * @returns {Object} Extracted metadata fields
   */
  function parseLexiconMetadata(raw) {
    if (!raw) return {};
    const meta = {};

    const originMatch = raw.match(/Origin:\s*(.+?)(?:\n|$)/i);
    if (originMatch) meta.origin = originMatch[1].trim().replace(/\s+/g, ' ');

    const posMatch = raw.match(/Part\(s\) of speech:\s*(.+?)(?:\n|$)/i);
    if (posMatch) meta.partOfSpeech = posMatch[1].trim();

    const tdntMatch = raw.match(/TDNT entry:\s*(.+?)(?:\n|$)/i);
    if (tdntMatch) meta.tdnt = tdntMatch[1].trim();

    const twotMatch = raw.match(/TWOT entry:\s*(.+?)(?:\n|$)/i);
    if (twotMatch) meta.twot = twotMatch[1].trim();

    return meta;
  }

  function displayLexiconOnOBS() {
    const word = state.selectedWord;
    const lexicon = state.selectedLexicon;
    if (!word || !lexicon) return;

    const isHebrew = (word.strongs || '').startsWith('H');
    const langLabel = isHebrew ? 'Hebrew Lexicon (BDB)' : "Greek Lexicon (Thayer's)";
    const definitions = parseLexiconDefinitions(lexicon.definition);
    const metadata = parseLexiconMetadata(lexicon.definition);

    // Build placeholder verses so the server paging system calculates the correct page count.
    // Server uses versesPerPage (3), so we create 3 placeholders per definition page.
    const DEFS_PER_PAGE = 8;
    const defPageCount = Math.max(1, Math.ceil(definitions.length / DEFS_PER_PAGE));
    const placeholderCount = defPageCount * state.paging.versesPerPage;
    const defPages = Array.from({ length: placeholderCount }, () => ({ number: '', text: '' }));

    connection.emit('displayVerse', {
      reference: `${word.strongs}: ${word.gloss || word.original}`,
      version: langLabel,
      versionName: langLabel,
      text: lexicon.definition || '',
      verses: defPages,
      totalVerses: defPageCount,
      source: 'interlinear',
      language: isHebrew ? 'hebrew' : 'greek',
      lexicon: {
        lemma: lexicon.lemma || word.original,
        transliteration: lexicon.transliteration || '',
        pronunciation: lexicon.pronunciation || '',
        morph: word.morph || '',
        origin: metadata.origin || '',
        partOfSpeech: metadata.partOfSpeech || '',
        tdnt: metadata.tdnt || '',
        twot: metadata.twot || '',
        definitions,
      },
    });
    status.success('Lexicon entry sent to display');
  }

  function renderInterlinearCacheList(filter = '') {
    const searchTerm = filter.toLowerCase();
    const books = Object.keys(state.cachedInterlinear);

    if (books.length === 0) {
      elements.cacheList.innerHTML =
        '<div class="cache-empty">No cached interlinear passages yet.<br>Fetch a passage to add it to the cache.</div>';
      return;
    }

    let html = '';

    for (const book of books) {
      const passages = state.cachedInterlinear[book].filter((p) => {
        if (!searchTerm) return true;
        return p.reference.toLowerCase().includes(searchTerm) || p.language.toLowerCase().includes(searchTerm);
      });

      if (passages.length === 0) continue;

      html += `
        <div class="book-group">
          <div class="book-header" data-book="${escapeHtml(book)}">
            <span>${escapeHtml(book)} (${passages.length})</span>
            <span class="toggle">▼</span>
          </div>
          <div class="book-verses">
      `;

      for (const passage of passages) {
        const isSelected = state.selectedInterlinearKey === passage.key;
        const encodedKey = encodeURIComponent(passage.key);
        const langLabel = passage.language === 'hebrew' ? 'Hebrew' : 'Greek';
        html += `
          <div class="cached-verse ${isSelected ? 'selected' : ''}" data-key="${encodedKey}" data-source="interlinear">
            <div class="cached-verse-content" data-action="select">
              <div class="cached-verse-ref">${escapeHtml(passage.reference)}</div>
              <div class="cached-verse-version">${escapeHtml(langLabel)}</div>
            </div>
            <button class="btn-delete" data-action="delete" title="Delete from cache">×</button>
          </div>
        `;
      }

      html += '</div></div>';
    }

    elements.cacheList.innerHTML = html || '<div class="cache-empty">No passages match your search.</div>';
  }

  async function handleInterlinearKeyboard(event) {
    if (event.key === 'Enter') {
      await fetchInterlinear();
    } else if (event.key === 'Escape') {
      clearDisplay();
    }
  }

  // ============================================
  // Shared Display Functions
  // ============================================

  function displayVerse(data, source) {
    if (data) {
      connection.emit('displayVerse', { ...data, source });
      const labelMap = { quran: 'Quran verse', dictionary: 'Definition' };
      status.success(`${labelMap[source] || 'Verse'} sent to display`);
    }
  }

  function clearDisplay() {
    connection.emit('clearVerse');
    connection.emit('clearFallacy');
    elements.pagingControls.classList.remove('visible');
    status.success('Display cleared');
  }

  function showPreview(data, source) {
    const fromCache = data.fromCache
      ? '<span style="color: #51cf66;">(cached)</span>'
      : '';

    const labelMap = { quran: 'ayah(s)', dictionary: 'definition(s)' };
    const label = labelMap[source] || 'verse(s)';
    const verseCount = data.verses
      ? `<div class="preview-stats">${data.verses.length} ${label} - will display 3 per page</div>`
      : '';

    const phonetic = source === 'dictionary' && data.phonetic
      ? `<div class="preview-phonetic" style="color: #f59e0b; font-style: italic;">${escapeHtml(data.phonetic)}</div>`
      : '';

    const etymology = source === 'dictionary' && data.etymology
      ? `<div class="preview-etymology" style="color: var(--color-text-dim); font-size: 0.85em; margin-top: 4px;">Origin: ${escapeHtml(data.etymology)}</div>`
      : '';

    elements.previewContent.innerHTML = `
      <div class="preview-reference">${escapeHtml(data.reference)} ${fromCache}</div>
      ${phonetic}
      <div class="preview-text">${escapeHtml(data.text)}</div>
      <div class="preview-version">${escapeHtml(data.versionName || data.version)}</div>
      ${etymology}
      ${verseCount}
    `;
  }

  /**
   * Shows a lexicon info grid with definitions in the preview card
   * @param {Object} word - Selected word data
   * @param {Object} lexicon - Lexicon entry data
   */
  function showLexiconPreview(word, lexicon) {
    const isHebrew = (word.strongs || '').startsWith('H');

    let html = `<div class="preview-reference">${escapeHtml(word.strongs)}: ${escapeHtml(word.gloss || word.original)}</div>`;
    html += '<div class="preview-info-grid">';

    html += `
      <div class="preview-info-item">
        <div class="preview-info-label">Original</div>
        <div class="preview-info-value ${isHebrew ? 'preview-script-hebrew' : 'preview-script-greek'}">${escapeHtml(lexicon.lemma || word.original)}</div>
      </div>
      <div class="preview-info-item">
        <div class="preview-info-label">Transliteration</div>
        <div class="preview-info-value">${escapeHtml(lexicon.transliteration || '')}</div>
      </div>
    `;

    if (lexicon.pronunciation) {
      html += `
        <div class="preview-info-item">
          <div class="preview-info-label">Pronunciation</div>
          <div class="preview-info-value">${escapeHtml(lexicon.pronunciation)}</div>
        </div>
      `;
    }

    if (word.morph) {
      html += `
        <div class="preview-info-item">
          <div class="preview-info-label">Morphology</div>
          <div class="preview-info-value" title="${escapeHtml(word.morph)}">${escapeHtml(decodeMorph(word.morph))}</div>
        </div>
      `;
    }

    const metadata = parseLexiconMetadata(lexicon.definition);
    if (metadata.partOfSpeech) {
      html += `
        <div class="preview-info-item">
          <div class="preview-info-label">Part of Speech</div>
          <div class="preview-info-value">${escapeHtml(metadata.partOfSpeech)}</div>
        </div>
      `;
    }

    if (metadata.origin) {
      html += `
        <div class="preview-info-item">
          <div class="preview-info-label">Origin</div>
          <div class="preview-info-value preview-info-small">${escapeHtml(metadata.origin)}</div>
        </div>
      `;
    }

    html += '</div>';

    // Definition list
    const definitions = parseLexiconDefinitions(lexicon.definition);
    if (definitions.length > 0) {
      const hasNumbered = definitions.some((d) => /^\d+\.\s/.test(d));
      html += '<div class="preview-def-list">';
      for (const def of definitions) {
        if (hasNumbered) {
          const subMatch = def.match(/^[a-z]\.\s+(.+)/);
          const mainMatch = def.match(/^\d+\.\s+(.+)/);
          if (subMatch) {
            html += `<div class="preview-def-sub">${escapeHtml(subMatch[1])}</div>`;
          } else if (mainMatch) {
            html += `<div class="preview-def-main">${escapeHtml(mainMatch[1])}</div>`;
          } else {
            html += `<div class="preview-def-main">${escapeHtml(def)}</div>`;
          }
        } else {
          html += `<div class="preview-def-main">${escapeHtml(def)}</div>`;
        }
      }
      html += '</div>';
    }

    const langLabel = isHebrew ? 'Hebrew Lexicon (BDB)' : "Greek Lexicon (Thayer's)";
    html += `<div class="preview-version">${escapeHtml(langLabel)}</div>`;

    elements.previewContent.innerHTML = html;
  }

  // ============================================
  // Fallacy Functions
  // ============================================

  async function loadFallacies() {
    try {
      const response = await fetch('/api/fallacies');
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      state.allFallacies = await response.json();
      elements.fallacyCount.textContent = state.allFallacies.length;
      renderFallacyList();
    } catch (error) {
      console.error('Error loading fallacies:', error);
      elements.fallacyList.innerHTML = '<div class="cache-empty">Error loading fallacies</div>';
    }
  }

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

  function selectFallacy(slug) {
    const fallacy = state.allFallacies.find((f) => f.slug === slug);
    if (!fallacy) return;

    if (state.selectedFallacySlug === slug) {
      state.selectedFallacySlug = null;
      document.querySelectorAll('.fallacy-item').forEach((el) => el.classList.remove('selected'));
      connection.emit('clearFallacy');
      status.success('Fallacy cleared');
      return;
    }

    state.selectedFallacySlug = slug;

    document.querySelectorAll('.fallacy-item').forEach((el) => {
      el.classList.toggle('selected', el.dataset.slug === slug);
    });

    connection.emit('displayFallacy', {
      name: fallacy.name,
      definition: fallacy.definition,
      slug: fallacy.slug,
    });

    status.success(`Fallacy displayed: ${fallacy.name}`);
  }

  // ============================================
  // Paging Functions
  // ============================================

  function updatePagingUI(data) {
    if (data.verses && data.verses.length > 0 && data.reference) {
      const totalVerses = data.verses.length;
      const versesPerPage = data.versesPerPage || 3;
      const totalPages = Math.ceil(totalVerses / versesPerPage);
      const currentPage = data.currentPage || 0;

      state.paging = { currentPage, totalPages, totalVerses, versesPerPage };

      const startVerse = currentPage * versesPerPage + 1;
      const endVerse = Math.min((currentPage + 1) * versesPerPage, totalVerses);

      if (totalPages > 1) {
        elements.pagingControls.classList.add('visible');
        elements.currentPage.textContent = currentPage + 1;
        elements.totalPages.textContent = totalPages;
        const isInterlinear = data.source === 'interlinear';
        elements.verseRange.textContent = isInterlinear ? '' : ` (verses ${startVerse}-${endVerse} of ${totalVerses})`;
        elements.prevPageBtn.disabled = currentPage === 0;
        elements.nextPageBtn.disabled = currentPage >= totalPages - 1;
      } else {
        elements.pagingControls.classList.remove('visible');
      }
    } else {
      elements.pagingControls.classList.remove('visible');
    }
  }

  // ============================================
  // Event Handlers
  // ============================================

  function handleCacheListClick(event) {
    const target = event.target;

    const bookHeader = target.closest('.book-header');
    if (bookHeader) {
      toggleBook(bookHeader);
      return;
    }

    const selectTarget = target.closest('[data-action="select"]');
    if (selectTarget) {
      const verseEl = target.closest('.cached-verse');
      if (verseEl) {
        selectCachedVerse(verseEl.dataset.key, verseEl.dataset.source);
      }
      return;
    }

    const deleteTarget = target.closest('[data-action="delete"]');
    if (deleteTarget) {
      event.stopPropagation();
      const verseEl = target.closest('.cached-verse');
      if (verseEl) {
        deleteCachedVerse(verseEl.dataset.key, verseEl.dataset.source);
      }
    }
  }

  async function handleBibleKeyboard(event) {
    if (event.key === 'Enter') {
      if (event.shiftKey) {
        await fetchBibleVerse();
      } else {
        const data = await fetchBibleVerse();
        if (data) displayVerse(data, 'bible');
      }
    } else if (event.key === 'Escape') {
      clearDisplay();
    }
  }

  async function handleQuranKeyboard(event) {
    if (event.key === 'Enter') {
      if (event.shiftKey) {
        await fetchQuranVerse();
      } else {
        const data = await fetchQuranVerse();
        if (data) displayVerse(data, 'quran');
      }
    } else if (event.key === 'Escape') {
      clearDisplay();
    }
  }

  async function handleDictionaryKeyboard(event) {
    if (event.key === 'Enter') {
      if (event.shiftKey) {
        await fetchDictionaryWord();
      } else {
        const data = await fetchDictionaryWord();
        if (data) displayVerse(data, 'dictionary');
      }
    } else if (event.key === 'Escape') {
      clearDisplay();
    }
  }

  // ============================================
  // Modal Functions
  // ============================================

  function openCacheModal() {
    const titleMap = {
      quran: '📖 Cached Quran Verses',
      dictionary: '📖 Cached Definitions',
      interlinear: '📖 Cached Interlinear Passages',
    };
    elements.cacheModalTitle.textContent = titleMap[state.activeTab] || '📚 Cached Bible Verses';
    renderCacheList();
    elements.cacheModal.classList.add('active');
  }

  function closeCacheModal() {
    elements.cacheModal.classList.remove('active');
    elements.cacheSearch.value = '';
  }

  function openHelpModal() {
    const baseUrl = window.location.origin;
    elements.displayUrl.textContent = baseUrl + '/bible-display.html';
    elements.controlUrl.textContent = baseUrl + '/reference-control.html';
    elements.helpModal.classList.add('active');
  }

  function closeHelpModal() {
    elements.helpModal.classList.remove('active');
  }

  // ============================================
  // Initialization
  // ============================================

  function init() {
    // Socket events
    connection.on('verseUpdate', updatePagingUI);

    // Tab switching
    elements.tabs.forEach((tab) => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Bible buttons
    elements.fetchBibleBtn.addEventListener('click', async () => {
      const data = await fetchBibleVerse();
      if (data) displayVerse(data, 'bible');
    });
    elements.fetchBibleOnlyBtn.addEventListener('click', fetchBibleVerse);
    elements.clearBibleBtn.addEventListener('click', clearDisplay);

    // Quran buttons
    elements.fetchQuranBtn.addEventListener('click', async () => {
      const data = await fetchQuranVerse();
      if (data) displayVerse(data, 'quran');
    });
    elements.fetchQuranOnlyBtn.addEventListener('click', fetchQuranVerse);
    elements.clearQuranBtn.addEventListener('click', clearDisplay);

    // Dictionary buttons
    elements.fetchDictBtn.addEventListener('click', async () => {
      const data = await fetchDictionaryWord();
      if (data) displayVerse(data, 'dictionary');
    });
    elements.fetchDictOnlyBtn.addEventListener('click', fetchDictionaryWord);
    elements.clearDictBtn.addEventListener('click', clearDisplay);

    // Interlinear buttons
    elements.fetchInterlinearBtn.addEventListener('click', fetchInterlinear);
    elements.clearInterlinearBtn.addEventListener('click', () => {
      clearDisplay();
      elements.interlinearResults.style.display = 'none';
      state.lastFetchedInterlinear = null;
      state.selectedWord = null;
      state.selectedLexicon = null;
    });

    // Fallacy
    elements.clearFallacyBtn.addEventListener('click', clearDisplay);
    elements.fallacyList.addEventListener('click', (event) => {
      const item = event.target.closest('.fallacy-item');
      if (item && item.dataset.slug) selectFallacy(item.dataset.slug);
    });
    elements.fallacySearch.addEventListener('input', (e) => {
      renderFallacyList(e.target.value);
    });

    // Paging
    elements.prevPageBtn.addEventListener('click', () => {
      if (state.paging.currentPage > 0) {
        connection.emit('changePage', { direction: 'prev' });
      }
    });
    elements.nextPageBtn.addEventListener('click', () => {
      if (state.paging.currentPage < state.paging.totalPages - 1) {
        connection.emit('changePage', { direction: 'next' });
      }
    });

    // Cache modal
    elements.showCacheBtn.addEventListener('click', openCacheModal);
    elements.closeCacheBtn.addEventListener('click', closeCacheModal);
    elements.refreshCache.addEventListener('click', () => {
      const loaderMap = {
        quran: loadQuranCachedVerses,
        dictionary: loadDictionaryCachedWords,
        interlinear: loadInterlinearCached,
      };
      const loader = loaderMap[state.activeTab] || loadBibleCachedVerses;
      loader().then(() => renderCacheList());
      status.success('Cache refreshed');
    });
    elements.clearCache.addEventListener('click', clearAllCache);
    elements.cacheList.addEventListener('click', handleCacheListClick);
    elements.cacheSearch.addEventListener('input', (e) => renderCacheList(e.target.value));

    // Help modal
    elements.showHelpBtn.addEventListener('click', openHelpModal);
    elements.closeHelpBtn.addEventListener('click', closeHelpModal);

    // Keyboard shortcuts
    elements.reference.addEventListener('keydown', handleBibleKeyboard);
    elements.quranReference.addEventListener('keydown', handleQuranKeyboard);
    elements.dictionaryWord.addEventListener('keydown', handleDictionaryKeyboard);
    elements.interlinearReference.addEventListener('keydown', handleInterlinearKeyboard);

    // Global escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const settingsModal = document.getElementById('settingsModal');
        if (settingsModal && settingsModal.classList.contains('active')) return;

        if (elements.cacheModal.classList.contains('active')) {
          if (document.activeElement !== elements.cacheSearch) closeCacheModal();
        } else if (elements.helpModal.classList.contains('active')) {
          closeHelpModal();
        } else {
          clearDisplay();
        }
      }
    });

    // Focus default input
    elements.reference.focus();

    // Load data
    loadConfig().then(() => {
      loadBibleCachedVerses();
      loadQuranCachedVerses();
      loadDictionaryCachedWords();
      loadInterlinearCached();
      loadFallacies();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
