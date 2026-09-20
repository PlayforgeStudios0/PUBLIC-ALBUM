/**
 * Public Liquid Album - Cloudinary Integration (Playable Videos)
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Cloudinary Credentials
const CLOUDINARY_CLOUD_NAME = "vvachyus";
const CLOUDINARY_UPLOAD_PRESET = "public_album";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCsfoXhvNojL14d9UmfAVqtiHAUECKkSNM",
  authDomain: "album-76794.firebaseapp.com",
  projectId: "album-76794",
  storageBucket: "album-76794.firebasestorage.app",
  messagingSenderId: "239576375532",
  appId: "1:239576375532:web:9abf1a4a392962e38685c9"
};

// Initialize Firebase & Firestore Database
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const photosCollection = collection(db, "photos");

// App State
let albumData = [];
let selectedIds = new Set();
let pendingUploadFile = null;
let activePreviewItem = null;
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
const uploadStatusText = document.getElementById('upload-status-text');

const downloadModal = document.getElementById('download-modal');
const cancelDownloadBtn = document.getElementById('cancel-download-btn');
const confirmDownloadBtn = document.getElementById('confirm-download-btn');

const deleteModal = document.getElementById('delete-modal');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
const holdDeleteBtn = document.getElementById('hold-delete-btn');
const holdProgressFill = document.getElementById('hold-progress-fill');

const lightboxModal = document.getElementById('lightbox-modal');
const lightboxCloseBtn = document.getElementById('lightbox-close-btn');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxVideo = document.getElementById('lightbox-video');
const lightboxDateText = document.getElementById('lightbox-date-text');
const lightboxDownloadBtn = document.getElementById('lightbox-download-btn');

const toastContainer = document.getElementById('toast-container');

initRealtimeListener();
attachEventListeners();

function initRealtimeListener() {
  const q = query(photosCollection, orderBy("timestamp", "desc"));
  
  onSnapshot(q, (snapshot) => {
    albumData = [];
    snapshot.forEach((docSnap) => {
      albumData.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });
    renderFeed();
  }, (error) => {
    console.error("Firestore connection error:", error);
    showToast("Failed to load global feed");
  });
}

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

  const groups = {};
  albumData.forEach(item => {
    const dateKey = item.date || 'UNSPECIFIED DATE';
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(item);
  });

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

function createMediaCard(item) {
  const card = document.createElement('div');
  card.className = `media-card ${selectedIds.has(item.id) ? 'selected' : ''}`;
  card.dataset.id = item.id;

  let mediaTag = '';
  if (item.type === 'video') {
    mediaTag = `<video src="${item.url}" class="media-content" muted playsinline preload="metadata"></video>
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

  card.addEventListener('click', (e) => {
    const isCheckboxClick = e.target.closest('.checkbox-indicator');

    if (isCheckboxClick || selectedIds.size > 0) {
      if (selectedIds.has(item.id)) {
        selectedIds.delete(item.id);
      } else {
        selectedIds.add(item.id);
      }
      card.classList.toggle('selected', selectedIds.has(item.id));
      updateSelectionUI();
    } else {
      openLightbox(item);
    }
  });

  return card;
}

function openLightbox(item) {
  activePreviewItem = item;
  lightboxDateText.textContent = item.date || 'PUBLIC ALBUM';

  if (item.type === 'video') {
    lightboxImg.classList.add('hidden');
    lightboxVideo.classList.remove('hidden');
    lightboxVideo.src = item.url;
    lightboxVideo.controls = true;
    lightboxVideo.play().catch(() => {});
  } else {
    lightboxVideo.classList.add('hidden');
    lightboxVideo.pause();
    lightboxVideo.src = '';
    lightboxImg.classList.remove('hidden');
    lightboxImg.src = item.url;
  }

  lightboxModal.classList.remove('hidden');
}

function closeLightbox() {
  lightboxModal.classList.add('hidden');
  lightboxVideo.pause();
  lightboxVideo.src = '';
  lightboxImg.src = '';
  activePreviewItem = null;
}

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

function attachEventListeners() {
  addBtn.addEventListener('click', () => mediaFileInput.click());
  mediaFileInput.addEventListener('change', handleFileSelected);
  cancelUploadBtn.addEventListener('click', closeUploadModal);
  confirmUploadBtn.addEventListener('click', processUpload);

  downloadSelectedBtn.addEventListener('click', () => downloadModal.classList.remove('hidden'));
  cancelDownloadBtn.addEventListener('click', () => downloadModal.classList.add('hidden'));
  confirmDownloadBtn.addEventListener('click', () => processDownload(Array.from(selectedIds)));

  lightboxDownloadBtn.addEventListener('click', () => {
    if (activePreviewItem) downloadModal.classList.remove('hidden');
  });
  lightboxCloseBtn.addEventListener('click', closeLightbox);

  deleteSelectedBtn.addEventListener('click', () => deleteModal.classList.remove('hidden'));
  cancelDeleteBtn.addEventListener('click', closeDeleteModal);

  setupHoldToDelete();
}

function handleFileSelected(e) {
  const file = e.target.files[0];
  if (!file) return;

  pendingUploadFile = file;
  const isVideo = file.type.startsWith('video/');
  const localPreviewUrl = URL.createObjectURL(file);

  uploadPreviewContainer.classList.remove('hidden');
  if (isVideo) {
    uploadPreviewImg.classList.add('hidden');
    uploadPreviewVideo.classList.remove('hidden');
    uploadPreviewVideo.src = localPreviewUrl;
    uploadPreviewVideo.controls = true;
  } else {
    uploadPreviewVideo.classList.add('hidden');
    uploadPreviewImg.classList.remove('hidden');
    uploadPreviewImg.src = localPreviewUrl;
  }

  uploadModal.classList.remove('hidden');
}

function closeUploadModal() {
  uploadModal.classList.add('hidden');
  uploadPreviewContainer.classList.add('hidden');
  uploadStatusText.classList.add('hidden');
  uploadPreviewImg.src = '';
  uploadPreviewVideo.src = '';
  uploadSensitiveCheck.checked = false;
  pendingUploadFile = null;
  mediaFileInput.value = '';
  confirmUploadBtn.disabled = false;
}

// Upload File directly to Cloudinary REST API
async function processUpload() {
  if (!pendingUploadFile) return;

  confirmUploadBtn.disabled = true;
  uploadStatusText.classList.remove('hidden');
  uploadStatusText.textContent = "Uploading media to Cloudinary...";

  try {
    const isVideo = pendingUploadFile.type.startsWith('video/');
    const resourceType = isVideo ? 'video' : 'image';
    
    const formData = new FormData();
    formData.append('file', pendingUploadFile);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Cloudinary upload failed");

    const fileUrl = data.secure_url;
    const todayStr = getTodayFormatted();

    await addDoc(photosCollection, {
      type: isVideo ? 'video' : 'photo',
      url: fileUrl,
      date: todayStr,
      isSensitive: uploadSensitiveCheck.checked,
      timestamp: serverTimestamp()
    });

    showToast("Uploaded successfully!");
    closeUploadModal();
  } catch (err) {
    console.error("Upload error details:", err);
    uploadStatusText.textContent = err.message || "Upload failed. Check Cloudinary settings.";
    confirmUploadBtn.disabled = false;
  }
}

function processDownload(idsToDownload) {
  downloadModal.classList.add('hidden');

  const downloadList = idsToDownload.length > 0 ? idsToDownload : (activePreviewItem ? [activePreviewItem.id] : []);
  let triggeredFreakToast = false;

  downloadList.forEach(id => {
    const item = albumData.find(m => m.id === id);
    if (item) {
      if (item.isSensitive) triggeredFreakToast = true;

      const a = document.createElement('a');
      a.href = item.url;
      a.download = `breeze_media_${item.id}.${item.type === 'video' ? 'mp4' : 'jpg'}`;
      a.target = '_blank';
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
}

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
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    holdProgressFill.style.width = '0%';
  };

  holdDeleteBtn.addEventListener('mousedown', startHold);
  holdDeleteBtn.addEventListener('touchstart', startHold);

  holdDeleteBtn.addEventListener('mouseup', cancelHold);
  holdDeleteBtn.addEventListener('mouseleave', cancelHold);
  holdDeleteBtn.addEventListener('touchend', cancelHold);
}

async function executeDeletion() {
  const idsToDelete = Array.from(selectedIds);
  selectedIds.clear();
  closeDeleteModal();

  for (const id of idsToDelete) {
    try {
      await deleteDoc(doc(db, "photos", id));
    } catch (err) {
      console.error("Failed to delete document:", id, err);
    }
  }

  showToast("Deleted selected item(s)");
}

function closeDeleteModal() {
  deleteModal.classList.add('hidden');
  holdProgressFill.style.width = '0%';
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'liquid-toast';
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

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

