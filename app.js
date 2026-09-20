/**
 * Breeze Liquid Album - Core Application Script
 */

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  let albumData = [];
  let selectedIds = new Set();
  let pendingUploadFile = null;
  let holdTimer = null;
  let holdStartTime = 0;
  const HOLD_DURATION_MS = 1500;

  // DOM Elements
  const albumFeed = document.getElementById('album-feed');
  const addBtn = document.getElementById('add-btn');
  const mediaFileInput = document.getElementById('media-file-input');
  const selectionBar = document.getElementById('selection-bar');
  const selectedCount = document.getElementById('selected-count');
  const downloadSelectedBtn = document.getElementById('download-selected-btn');
  const deleteSelectedBtn = document.getElementById('delete-selected-btn');

  // Modal Elements
  const uploadModal = document.getElementById('upload-modal');
  const cancelUploadBtn = document.getElementById('cancel-upload-btn');
  const confirmUploadBtn = document.getElementById('confirm-upload-btn');
  const uploadPreviewContainer = document.getElementById('upload-preview-container');
  const uploadPreviewImg = document.getElementById('upload-preview-img');
  const uploadPreviewVideo = document.getElementById('upload-preview-video');
  const uploadSensitiveCheck = document.getElementById('upload-sensitive-check');

  const downloadModal = document.getElementById('download-modal');
  const cancelDownloadBtn = document.getElementById('cancel-download-btn');
  const confirmDownloadBtn = document.getElementById('confirm-download-btn');

  const deleteModal = document.getElementById('delete-modal');
  const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
  const holdDeleteBtn = document.getElementById('hold-delete-btn');
  const holdProgressFill = document.getElementById('hold-progress-fill');

  const toastContainer = document.getElementById('toast-container');

  // Initialize App
  init();

  async function init() {
    await fetchAlbumData();
    renderFeed();
    attachEventListeners();
  }

  // Fetch initial media metadata from photos.json in root folder
  async function fetchAlbumData() {
    try {
      const response = await fetch('photos.json');
      if (response.ok) {
        albumData = await response.json();
      } else {
        albumData = getFallbackData();
      }
    } catch (e) {
      console.warn('Could not load photos.json, using default sample data.');
      albumData = getFallbackData();
    }
  }

  // Render dynamic Date-grouped feed
  function renderFeed() {
    albumFeed.innerHTML = '';

    if (albumData.length === 0) {
      albumFeed.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; opacity: 0.7;">
          <p style="font-size: 1.1rem; font-weight: 600;">No media in the album yet.</p>
          <p style="font-size: 0.85rem; margin-top: 6px;">Click "ADD YOURS NOW" to upload the first photo or video!</p>
        </div>
      `;
      updateSelectionUI();
      return;
    }

    // Group items by date string
    const groups = {};
    albumData.forEach(item => {
      const dateKey = item.date || 'UNSPECIFIED DATE';
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(item);
    });

    // Render grouped sections
    Object.keys(groups).forEach(dateKey => {
      const section = document.createElement('section');
      section.className = 'date-section';

      const header = document.createElement('div');
      header.className = 'date-header';
      header.innerHTML = `<span class="date-dot">•</span> <span>${escapeHtml(dateKey)}</span>`;
      section.appendChild(header);

      const grid = document.createElement('div');
      grid.className = 'media-grid';

      groups[dateKey].forEach(item => {
        const card = createMediaCard(item);
        grid.appendChild(card);
      });

      section.appendChild(grid);
      albumFeed.appendChild(section);
    });

    updateSelectionUI();
  }

  // Create single media element card
  function createMediaCard(item) {
    const card = document.createElement('div');
    card.className = `media-card ${selectedIds.has(item.id) ? 'selected' : ''}`;
    card.dataset.id = item.id;

    let mediaTag = '';
    if (item.type === 'video') {
      mediaTag = `<video src="${item.url}" class="media-content" muted preload="metadata"></video>
                  <div class="video-badge">
                    <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    <span>VIDEO</span>
                  </div>`;
    } else {
      mediaTag = `<img src="${item.url}" alt="Album media" class="media-content" loading="lazy">`;
    }

    const checkbox = `
      <div class="checkbox-indicator">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
    `;

    card.innerHTML = mediaTag + checkbox;

    // Toggle Selection on Card Click
    card.addEventListener('click', () => {
      if (selectedIds.has(item.id)) {
        selectedIds.delete(item.id);
      } else {
        selectedIds.add(item.id);
      }
      card.classList.toggle('selected', selectedIds.has(item.id));
      updateSelectionUI();
    });

    return card;
  }

  // Update Header UI for Selection Mode
  function updateSelectionUI() {
    const count = selectedIds.size;
    if (count > 0) {
      addBtn.classList.add('hidden');
      selectionBar.classList.remove('hidden');
      selectedCount.textContent = `${count} Selected`;
    } else {
      addBtn.classList.remove('hidden');
      selectionBar.classList.add('hidden');
    }
  }

  // Event Listeners Registration
  function attachEventListeners() {
    // Add Media Flow
    addBtn.addEventListener('click', () => mediaFileInput.click());
    mediaFileInput.addEventListener('change', handleFileSelected);
    cancelUploadBtn.addEventListener('click', closeUploadModal);
    confirmUploadBtn.addEventListener('click', processUpload);

    // Download Flow
    downloadSelectedBtn.addEventListener('click', () => downloadModal.classList.remove('hidden'));
    cancelDownloadBtn.addEventListener('click', () => downloadModal.classList.add('hidden'));
    confirmDownloadBtn.addEventListener('click', processDownload);

    // Delete Flow
    deleteSelectedBtn.addEventListener('click', () => deleteModal.classList.remove('hidden'));
    cancelDeleteBtn.addEventListener('click', closeDeleteModal);

    // Hold To Delete Listeners (Touch + Mouse)
    setupHoldToDelete();
  }

  // Handle Local File Selection
  function handleFileSelected(e) {
    const file = e.target.files[0];
    if (!file) return;

    pendingUploadFile = file;
    const fileUrl = URL.createObjectURL(file);
    const isVideo = file.type.startsWith('video/');

    uploadPreviewContainer.classList.remove('hidden');
    if (isVideo) {
      uploadPreviewImg.classList.add('hidden');
      uploadPreviewVideo.classList.remove('hidden');
      uploadPreviewVideo.src = fileUrl;
    } else {
      uploadPreviewVideo.classList.add('hidden');
      uploadPreviewImg.classList.remove('hidden');
      uploadPreviewImg.src = fileUrl;
    }

    uploadModal.classList.remove('hidden');
  }

  function closeUploadModal() {
    uploadModal.classList.add('hidden');
    uploadPreviewContainer.classList.add('hidden');
    uploadPreviewImg.src = '';
    uploadPreviewVideo.src = '';
    uploadSensitiveCheck.checked = false;
    pendingUploadFile = null;
    mediaFileInput.value = '';
  }

  // Process Media Upload
  function processUpload() {
    if (!pendingUploadFile) return;

    const isVideo = pendingUploadFile.type.startsWith('video/');
    const fileUrl = URL.createObjectURL(pendingUploadFile);
    const todayStr = getTodayFormatted();

    const newItem = {
      id: 'media_' + Date.now(),
      type: isVideo ? 'video' : 'photo',
      url: fileUrl,
      date: todayStr,
      isSensitive: uploadSensitiveCheck.checked
    };

    albumData.unshift(newItem); // Place newest upload at top
    closeUploadModal();
    renderFeed();
  }

  // Process Selected Downloads & Freak Toast Trigger
  function processDownload() {
    downloadModal.classList.add('hidden');

    let triggeredFreakToast = false;

    selectedIds.forEach(id => {
      const item = albumData.find(m => m.id === id);
      if (item) {
        if (item.isSensitive) {
          triggeredFreakToast = true;
        }
        // Trigger browser file save
        const a = document.createElement('a');
        a.href = item.url;
        a.download = `breeze_media_${item.id}.${item.type === 'video' ? 'mp4' : 'jpg'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    });

    if (triggeredFreakToast) {
      showToast("you're a freak");
    }

    selectedIds.clear();
    updateSelectionUI();
    renderFeed();
  }

  // Setup Hold-to-Delete Precision Timer Logic
  function setupHoldToDelete() {
    let animationFrameId = null;

    const startHold = (e) => {
      e.preventDefault();
      holdStartTime = Date.now();
      updateHoldProgress();
    };

    const updateHoldProgress = () => {
      const elapsed = Date.now() - holdStartTime;
      const progress = Math.min((elapsed / HOLD_DURATION_MS) * 100, 100);
      holdProgressFill.style.width = `${progress}%`;

      if (progress >= 100) {
        cancelAnimationFrame(animationFrameId);
        executeDeletion();
      } else {
        animationFrameId = requestAnimationFrame(updateHoldProgress);
      }
    };

    const cancelHold = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      holdProgressFill.style.width = '0%';
    };

    // Events
    holdDeleteBtn.addEventListener('mousedown', startHold);
    holdDeleteBtn.addEventListener('touchstart', startHold);

    holdDeleteBtn.addEventListener('mouseup', cancelHold);
    holdDeleteBtn.addEventListener('mouseleave', cancelHold);
    holdDeleteBtn.addEventListener('touchend', cancelHold);
  }

  function executeDeletion() {
    albumData = albumData.filter(item => !selectedIds.has(item.id));
    selectedIds.clear();
    closeDeleteModal();
    renderFeed();
  }

  function closeDeleteModal() {
    deleteModal.classList.add('hidden');
    holdProgressFill.style.width = '0%';
  }

  // Toast Notification Display
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'liquid-toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  // Utilities
  function getTodayFormatted() {
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return 'TODAY • ' + new Date().toLocaleDateString('en-US', options).toUpperCase();
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    })[m]);
  }

  // Fallback Sample Data if photos.json is missing or running locally without web server
  function getFallbackData() {
    return [
      {
        id: "demo_1",
        type: "photo",
        url: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80",
        date: "TODAY",
        isSensitive: false
      },
      {
        id: "demo_2",
        type: "photo",
        url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80",
        date: "TODAY",
        isSensitive: false
      },
      {
        id: "demo_3",
        type: "photo",
        url: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80",
        date: "TODAY",
        isSensitive: true
      },
      {
        id: "demo_4",
        type: "video",
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        date: "YESTERDAY",
        isSensitive: false
      },
      {
        id: "demo_5",
        type: "photo",
        url: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&auto=format&fit=crop&q=80",
        date: "YESTERDAY",
        isSensitive: false
      },
      {
        id: "demo_6",
        type: "photo",
        url: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&auto=format&fit=crop&q=80",
        date: "YESTERDAY",
        isSensitive: false
      },
      {
        id: "demo_7",
        type: "photo",
        url: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&auto=format&fit=crop&q=80",
        date: "SEPT 15, 2026",
        isSensitive: true
      }
    ];
  }
});
