/**
 * Soundboard Control Panel Application
 * Manages soundboard with emoji buttons, paging, and sound management
 * @module js/soundboard-control
 */

(function () {
  'use strict';

  // ============================================
  // Constants (defaults, overridden by /api/config)
  // ============================================

  let BUTTONS_PER_PAGE = 12;
  let MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  let ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.webm', '.m4a'];

  /**
   * Loads shared constants from the server
   */
  async function loadConfig() {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const config = await response.json();
        BUTTONS_PER_PAGE = config.soundboard.buttonsPerPage;
        MAX_FILE_SIZE = config.soundboard.maxFileSize;
        ALLOWED_EXTENSIONS = config.soundboard.allowedExtensions;
      }
    } catch (error) {
      console.error('Error loading config, using defaults:', error);
    }
  }

  const EMOJI_LIST = [
    '🔊', '🎵', '🎶', '🎸', '🥁', '🎺', '🎷', '🎹',
    '🎤', '🎧', '📢', '📣', '🔔', '🔕', '💥', '💣',
    '🚨', '⚡', '🔥', '💀', '👻', '👽', '🤖', '🎃',
    '😂', '🤣', '😱', '😡', '🤯', '🥳', '😎', '🤔',
    '👍', '👎', '👏', '🙌', '✋', '🤝', '💪', '🫡',
    '❤️', '💔', '💯', '⭐', '🌟', '✨', '🎉', '🎊',
    '🏆', '🥇', '🎯', '🎮', '🕹️', '🃏', '🐶', '🐱',
    '🦄', '🐉', '🌈', '☀️', '🌙', '🌊', '🍕', '🍺',
    '☕', '🧊', '🚀', '✈️', '🚗', '🏠', '⏰', '⏱️',
    '📱', '💻', '🖥️', '📺', '🎬', '📷', '🎭', '🎪',
    '👑', '💎', '🗡️', '🛡️', '🏹', '⚔️', '💊', '🧪',
    '🐸', '🦆', '🐔', '🦅', '🐍', '🦈', '🐙', '🦑',
  ];

  // ============================================
  // DOM Elements
  // ============================================

  const elements = {
    // Title bar
    statusDot: document.getElementById('statusDot'),
    showManageBtn: document.getElementById('showManageBtn'),

    // Soundboard grid
    soundboardGrid: document.getElementById('soundboardGrid'),

    // Paging
    pagingBar: document.getElementById('pagingBar'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    currentPage: document.getElementById('currentPage'),
    totalPages: document.getElementById('totalPages'),

    // Now playing
    nowPlaying: document.getElementById('nowPlaying'),
    nowPlayingEmoji: document.getElementById('nowPlayingEmoji'),
    nowPlayingName: document.getElementById('nowPlayingName'),
    stopSoundBtn: document.getElementById('stopSoundBtn'),

    // Audio
    audioPlayer: document.getElementById('audioPlayer'),

    // Manage modal
    manageModal: document.getElementById('manageModal'),
    closeManageBtn: document.getElementById('closeManageBtn'),
    uploadForm: document.getElementById('uploadForm'),
    uploadArea: document.getElementById('uploadArea'),
    audioFile: document.getElementById('audioFile'),
    uploadFileName: document.getElementById('uploadFileName'),
    soundName: document.getElementById('soundName'),
    soundEmoji: document.getElementById('soundEmoji'),
    emojiPickerBtn: document.getElementById('emojiPickerBtn'),
    emojiPicker: document.getElementById('emojiPicker'),
    emojiGrid: document.getElementById('emojiGrid'),
    closeEmojiPicker: document.getElementById('closeEmojiPicker'),
    uploadBtn: document.getElementById('uploadBtn'),
    soundCount: document.getElementById('soundCount'),
    soundList: document.getElementById('soundList'),

    // Edit modal
    editModal: document.getElementById('editModal'),
    closeEditBtn: document.getElementById('closeEditBtn'),
    editSoundName: document.getElementById('editSoundName'),
    editSoundEmoji: document.getElementById('editSoundEmoji'),
    editEmojiPickerBtn: document.getElementById('editEmojiPickerBtn'),
    editEmojiPicker: document.getElementById('editEmojiPicker'),
    editEmojiGrid: document.getElementById('editEmojiGrid'),
    closeEditEmojiPicker: document.getElementById('closeEditEmojiPicker'),
    saveEditBtn: document.getElementById('saveEditBtn'),
    cancelEditBtn: document.getElementById('cancelEditBtn'),
    editSoundId: document.getElementById('editSoundId'),
  };

  // ============================================
  // State
  // ============================================

  let sounds = [];
  let currentPage = 0;
  let currentlyPlaying = null;
  let selectedFile = null;

  // ============================================
  // Socket Connection
  // ============================================

  const connection = createSocketConnection({ statusDotId: 'statusDot' });
  const socket = connection.socket;

  // ============================================
  // Sound Loading
  // ============================================

  async function loadSounds() {
    try {
      const response = await fetch('/api/soundboard/sounds');
      if (!response.ok) {
        console.error('Failed to load sounds:', response.status);
        return;
      }
      sounds = await response.json();
      renderSoundboard();
      renderSoundList();
    } catch (error) {
      console.error('Error loading sounds:', error);
    }
  }

  // ============================================
  // Soundboard Grid Rendering
  // ============================================

  function renderSoundboard() {
    const totalPages = Math.max(1, Math.ceil(sounds.length / BUTTONS_PER_PAGE));

    // Clamp page
    if (currentPage >= totalPages) currentPage = totalPages - 1;
    if (currentPage < 0) currentPage = 0;

    const start = currentPage * BUTTONS_PER_PAGE;
    const pageSounds = sounds.slice(start, start + BUTTONS_PER_PAGE);

    if (sounds.length === 0) {
      elements.soundboardGrid.innerHTML = `
        <div class="soundboard-empty">
          <div class="soundboard-empty-icon">&#128266;</div>
          <div>No sounds added yet</div>
          <div class="soundboard-empty-hint">Click "Manage" to add sounds</div>
        </div>
      `;
    } else {
      elements.soundboardGrid.innerHTML = pageSounds.map(sound => `
        <button class="sound-btn ${currentlyPlaying === sound.id ? 'playing' : ''}"
                data-sound-id="${escapeHtml(sound.id)}"
                title="${escapeHtml(sound.name)}">
          <span class="sound-btn-emoji">${escapeHtml(sound.emoji)}</span>
          <span class="sound-btn-name">${escapeHtml(sound.name)}</span>
        </button>
      `).join('');

      // Add click handlers
      elements.soundboardGrid.querySelectorAll('.sound-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const soundId = btn.dataset.soundId;
          if (currentlyPlaying === soundId) {
            stopSound();
          } else {
            playSound(soundId);
          }
        });
      });
    }

    // Update paging
    updatePaging(totalPages);
  }

  function updatePaging(totalPages) {
    if (totalPages <= 1) {
      elements.pagingBar.classList.remove('visible');
    } else {
      elements.pagingBar.classList.add('visible');
      elements.currentPage.textContent = currentPage + 1;
      elements.totalPages.textContent = totalPages;
      elements.prevPageBtn.disabled = currentPage <= 0;
      elements.nextPageBtn.disabled = currentPage >= totalPages - 1;
    }
  }

  // ============================================
  // Sound Playback
  // ============================================

  function playSound(soundId) {
    const sound = sounds.find(s => s.id === soundId);
    if (!sound) return;

    // Stop current sound if any
    elements.audioPlayer.pause();
    elements.audioPlayer.currentTime = 0;

    // Play new sound
    elements.audioPlayer.src = `/sounds/${sound.filename}`;
    elements.audioPlayer.play().catch(err => {
      console.error('Error playing sound:', err);
    });

    currentlyPlaying = soundId;
    socket.emit('playSound', { id: soundId });

    // Update UI
    showNowPlaying(sound);
    renderSoundboard();
  }

  function stopSound() {
    elements.audioPlayer.pause();
    elements.audioPlayer.currentTime = 0;
    currentlyPlaying = null;
    socket.emit('stopSound');

    hideNowPlaying();
    renderSoundboard();
  }

  function showNowPlaying(sound) {
    elements.nowPlaying.classList.add('visible');
    elements.nowPlayingEmoji.textContent = sound.emoji;
    elements.nowPlayingName.textContent = sound.name;
  }

  function hideNowPlaying() {
    elements.nowPlaying.classList.remove('visible');
  }

  // ============================================
  // Upload Handling
  // ============================================

  function setupUploadArea() {
    // Click to select file
    elements.uploadArea.addEventListener('click', () => {
      elements.audioFile.click();
    });

    // File input change
    elements.audioFile.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
      }
    });

    // Drag and drop
    elements.uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      elements.uploadArea.classList.add('dragover');
    });

    elements.uploadArea.addEventListener('dragleave', () => {
      elements.uploadArea.classList.remove('dragover');
    });

    elements.uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      elements.uploadArea.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    });
  }

  function handleFileSelect(file) {
    const ext = '.' + file.name.split('.').pop().toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      alert(`Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
      return;
    }

    selectedFile = file;
    elements.uploadArea.classList.add('has-file');
    elements.uploadFileName.textContent = file.name;
    elements.uploadFileName.classList.add('visible');
    elements.uploadBtn.disabled = false;

    // Auto-fill name from filename
    if (!elements.soundName.value) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      elements.soundName.value = nameWithoutExt;
    }
  }

  async function handleUpload(e) {
    e.preventDefault();

    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('audio', selectedFile);
    formData.append('name', elements.soundName.value || 'Untitled');
    formData.append('emoji', elements.soundEmoji.value || '🔊');

    elements.uploadBtn.disabled = true;
    elements.uploadBtn.textContent = 'Uploading...';

    try {
      const response = await fetch('/api/soundboard/sounds', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        // Reset form
        resetUploadForm();
        // Reload sounds
        await loadSounds();
        socket.emit('refreshSounds');
      } else {
        const error = await response.json();
        alert(error.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed. Please try again.');
    } finally {
      elements.uploadBtn.disabled = false;
      elements.uploadBtn.textContent = 'Upload Sound';
    }
  }

  function resetUploadForm() {
    selectedFile = null;
    elements.audioFile.value = '';
    elements.soundName.value = '';
    elements.soundEmoji.value = '🔊';
    elements.emojiPickerBtn.textContent = '🔊';
    elements.uploadArea.classList.remove('has-file');
    elements.uploadFileName.classList.remove('visible');
    elements.uploadFileName.textContent = '';
    elements.uploadBtn.disabled = true;
    elements.emojiPicker.classList.remove('active');
  }

  // ============================================
  // Emoji Picker
  // ============================================

  /**
   * Applies a selected emoji to the picker UI and hidden input
   */
  function applyEmoji(emoji, hiddenInputEl, triggerBtnEl, pickerEl, gridEl) {
    hiddenInputEl.value = emoji;
    triggerBtnEl.textContent = emoji;
    pickerEl.classList.remove('active');
    updateSelectedEmoji(gridEl, emoji);
  }

  /**
   * Resolves custom emoji input - supports direct emoji paste or Unicode code points
   * e.g. "U+1F600", "1F600", "U+1F1FA U+1F1F8" (flag sequences)
   * @param {string} raw - User input
   * @returns {string|null} Resolved emoji or null if invalid
   */
  function resolveCustomEmoji(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    // Check if it's a Unicode code point pattern like "U+1F600" or "1F600" or "U+1F1FA U+1F1F8"
    const codePointPattern = /^(?:U\+)?([0-9A-Fa-f]{4,6})(?:\s+(?:U\+)?([0-9A-Fa-f]{4,6}))*$/;
    if (codePointPattern.test(trimmed)) {
      try {
        const parts = trimmed.split(/\s+/).map(p => p.replace(/^U\+/i, ''));
        const codePoints = parts.map(p => parseInt(p, 16));
        return String.fromCodePoint(...codePoints);
      } catch {
        return null;
      }
    }

    // Otherwise treat as a direct emoji character (pasted)
    // Basic validation: should be short (emoji are 1-4 code points typically)
    if ([...trimmed].length <= 10) {
      return trimmed;
    }

    return null;
  }

  function setupEmojiPicker(gridEl, pickerEl, closeBtnEl, triggerBtnEl, hiddenInputEl) {
    // Populate grid
    gridEl.innerHTML = EMOJI_LIST.map(emoji => `
      <button class="emoji-option" data-emoji="${emoji}" type="button">${emoji}</button>
    `).join('');

    // Custom emoji input elements
    const customInput = pickerEl.querySelector('.emoji-custom-input input');
    const customBtn = pickerEl.querySelector('.emoji-custom-input .btn-custom-emoji');

    // Toggle picker
    triggerBtnEl.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      pickerEl.classList.toggle('active');
      updateSelectedEmoji(gridEl, hiddenInputEl.value);
      if (customInput) customInput.value = '';
    });

    // Close picker
    closeBtnEl.addEventListener('click', () => {
      pickerEl.classList.remove('active');
    });

    // Select emoji from grid
    gridEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.emoji-option');
      if (!btn) return;
      applyEmoji(btn.dataset.emoji, hiddenInputEl, triggerBtnEl, pickerEl, gridEl);
    });

    // Custom emoji input
    if (customInput && customBtn) {
      customBtn.addEventListener('click', () => {
        const emoji = resolveCustomEmoji(customInput.value);
        if (emoji) {
          applyEmoji(emoji, hiddenInputEl, triggerBtnEl, pickerEl, gridEl);
          customInput.value = '';
        } else {
          customInput.classList.add('input-error');
          setTimeout(() => customInput.classList.remove('input-error'), 600);
        }
      });

      customInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          customBtn.click();
        }
      });
    }
  }

  function updateSelectedEmoji(gridEl, selectedEmoji) {
    gridEl.querySelectorAll('.emoji-option').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.emoji === selectedEmoji);
    });
  }

  // ============================================
  // Sound List (Manage Modal)
  // ============================================

  function renderSoundList() {
    elements.soundCount.textContent = `(${sounds.length})`;

    if (sounds.length === 0) {
      elements.soundList.innerHTML = '<div class="sound-list-empty">No sounds uploaded yet</div>';
      return;
    }

    elements.soundList.innerHTML = sounds.map(sound => `
      <div class="sound-list-item" data-sound-id="${escapeHtml(sound.id)}">
        <span class="sound-list-emoji">${escapeHtml(sound.emoji)}</span>
        <div class="sound-list-info">
          <div class="sound-list-name">${escapeHtml(sound.name)}</div>
          <div class="sound-list-file">${escapeHtml(sound.originalName || sound.filename)}</div>
        </div>
        <div class="sound-list-actions">
          <button class="sound-action-btn btn-preview" title="Preview" data-sound-id="${escapeHtml(sound.id)}">&#9654;</button>
          <button class="sound-action-btn btn-edit" title="Edit" data-sound-id="${escapeHtml(sound.id)}">&#9998;</button>
          <button class="sound-action-btn btn-delete" title="Delete" data-sound-id="${escapeHtml(sound.id)}">&#128465;</button>
        </div>
      </div>
    `).join('');

    // Preview handlers
    elements.soundList.querySelectorAll('.btn-preview').forEach(btn => {
      btn.addEventListener('click', () => {
        playSound(btn.dataset.soundId);
      });
    });

    // Edit handlers
    elements.soundList.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        openEditModal(btn.dataset.soundId);
      });
    });

    // Delete handlers
    elements.soundList.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        deleteSound(btn.dataset.soundId);
      });
    });
  }

  // ============================================
  // Edit Sound
  // ============================================

  function openEditModal(soundId) {
    const sound = sounds.find(s => s.id === soundId);
    if (!sound) return;

    elements.editSoundId.value = soundId;
    elements.editSoundName.value = sound.name;
    elements.editSoundEmoji.value = sound.emoji;
    elements.editEmojiPickerBtn.textContent = sound.emoji;
    elements.editEmojiPicker.classList.remove('active');

    elements.editModal.classList.add('active');
  }

  function closeEditModal() {
    elements.editModal.classList.remove('active');
    elements.editEmojiPicker.classList.remove('active');
  }

  async function saveEdit() {
    const id = elements.editSoundId.value;
    const name = elements.editSoundName.value.trim();
    const emoji = elements.editSoundEmoji.value;

    if (!name) return;

    try {
      const response = await fetch(`/api/soundboard/sounds/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, emoji }),
      });

      if (response.ok) {
        closeEditModal();
        await loadSounds();
        socket.emit('refreshSounds');
      }
    } catch (error) {
      console.error('Error updating sound:', error);
    }
  }

  // ============================================
  // Delete Sound
  // ============================================

  async function deleteSound(soundId) {
    const sound = sounds.find(s => s.id === soundId);
    if (!sound) return;

    if (!confirm(`Delete "${sound.name}"? This will also remove the sound file.`)) return;

    // Stop if currently playing
    if (currentlyPlaying === soundId) {
      stopSound();
    }

    try {
      const response = await fetch(`/api/soundboard/sounds/${soundId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadSounds();
        socket.emit('refreshSounds');
      }
    } catch (error) {
      console.error('Error deleting sound:', error);
    }
  }

  // ============================================
  // Modal Helpers
  // ============================================

  function openModal(modalEl) {
    modalEl.classList.add('active');
  }

  function closeModal(modalEl) {
    modalEl.classList.remove('active');
  }

  // ============================================
  // Socket Event Handlers
  // ============================================

  socket.on('soundboardUpdate', (data) => {
    if (data.sounds) {
      sounds = data.sounds;
      renderSoundboard();
      renderSoundList();
    }
  });

  socket.on('soundboardPlay', (sound) => {
    // Another client triggered playback - update UI
    currentlyPlaying = sound.id;
    showNowPlaying(sound);
    renderSoundboard();
  });

  socket.on('soundboardStop', () => {
    currentlyPlaying = null;
    hideNowPlaying();
    renderSoundboard();
  });

  // Audio ended handler
  elements.audioPlayer.addEventListener('ended', () => {
    currentlyPlaying = null;
    socket.emit('stopSound');
    hideNowPlaying();
    renderSoundboard();
  });

  // ============================================
  // Initialization
  // ============================================

  function init() {
    // Setup upload area
    setupUploadArea();

    // Setup emoji pickers
    setupEmojiPicker(
      elements.emojiGrid,
      elements.emojiPicker,
      elements.closeEmojiPicker,
      elements.emojiPickerBtn,
      elements.soundEmoji
    );

    setupEmojiPicker(
      elements.editEmojiGrid,
      elements.editEmojiPicker,
      elements.closeEditEmojiPicker,
      elements.editEmojiPickerBtn,
      elements.editSoundEmoji
    );

    // Upload form
    elements.uploadForm.addEventListener('submit', handleUpload);

    // Manage modal
    elements.showManageBtn.addEventListener('click', () => {
      openModal(elements.manageModal);
      renderSoundList();
    });
    elements.closeManageBtn.addEventListener('click', () => closeModal(elements.manageModal));
    elements.manageModal.addEventListener('click', (e) => {
      if (e.target === elements.manageModal) closeModal(elements.manageModal);
    });

    // Edit modal
    elements.closeEditBtn.addEventListener('click', closeEditModal);
    elements.cancelEditBtn.addEventListener('click', closeEditModal);
    elements.saveEditBtn.addEventListener('click', saveEdit);
    elements.editModal.addEventListener('click', (e) => {
      if (e.target === elements.editModal) closeEditModal();
    });

    // Paging
    elements.prevPageBtn.addEventListener('click', () => {
      if (currentPage > 0) {
        currentPage--;
        renderSoundboard();
      }
    });
    elements.nextPageBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(sounds.length / BUTTONS_PER_PAGE);
      if (currentPage < totalPages - 1) {
        currentPage++;
        renderSoundboard();
      }
    });

    // Stop sound
    elements.stopSoundBtn.addEventListener('click', stopSound);

    // Escape to close modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (elements.editModal.classList.contains('active')) {
          closeEditModal();
        } else if (elements.manageModal.classList.contains('active')) {
          closeModal(elements.manageModal);
        }
      }
    });

    // Load config then sounds
    loadConfig().then(() => loadSounds());
  }

  // Start application when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
