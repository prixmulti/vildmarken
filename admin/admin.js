const API_BASE = 'api';
const START_CENTER = [55.685, 8.605];
const START_ZOOM = 13;

const CATEGORY_COLORS = {
  Historie: '#78350f',
  Natur: '#065f46',
  Rewild: '#1e40af',
};

const state = {
  map: null,
  clusterGroup: null,
  baseLayers: {},
  markers: {},
  boundaryLayers: [],
  points: [],
  forestBoundary: [],
  selectedId: null,
  isNew: false,
  isReplacingAudio: false,
  isReplacingImage: false,
  statusTimer: null,
  currentAudioSrc: '',
  currentImageSrc: '',
  isUploadingImage: false,
};

const els = {
  map: document.getElementById('map'),
  pointList: document.getElementById('point-list'),
  pointCount: document.getElementById('point-count'),
  loadError: document.getElementById('load-error'),
  form: document.getElementById('point-form'),
  subtitle: document.getElementById('editor-subtitle'),
  pointBadge: document.getElementById('editor-point-badge'),
  statusBadge: document.getElementById('status-badge'),
  id: document.getElementById('point-id'),
  title: document.getElementById('point-title'),
  description: document.getElementById('point-description'),
  category: document.getElementById('point-category'),
  audioSrc: document.getElementById('point-audio-src'),
  audioIdle: document.getElementById('audio-panel-idle'),
  audioLocked: document.getElementById('audio-panel-locked'),
  audioAttached: document.getElementById('audio-panel-attached'),
  audioUpload: document.getElementById('audio-panel-upload'),
  audioPending: document.getElementById('audio-panel-pending'),
  audioAttachedName: document.getElementById('audio-attached-name'),
  audioPendingName: document.getElementById('audio-pending-name'),
  audioFile: document.getElementById('point-audio-file'),
  audioPick: document.getElementById('btn-audio-pick'),
  audioUploadBtn: document.getElementById('btn-point-audio-upload'),
  audioCancel: document.getElementById('btn-audio-cancel'),
  audioReplace: document.getElementById('btn-audio-replace'),
  audioReplaceCancel: document.getElementById('btn-audio-replace-cancel'),
  audioDropzoneTitle: document.getElementById('audio-dropzone-title'),
  audioDropzoneSub: document.getElementById('audio-dropzone-sub'),
  audioRemove: document.getElementById('btn-point-audio-remove'),
  audioPlay: document.getElementById('btn-audio-play'),
  audioPreview: document.getElementById('audio-preview'),
  imageIdle: document.getElementById('image-panel-idle'),
  imageLocked: document.getElementById('image-panel-locked'),
  imageAttached: document.getElementById('image-panel-attached'),
  imageUpload: document.getElementById('image-panel-upload'),
  imageAttachedPreview: document.getElementById('image-attached-preview'),
  imageFile: document.getElementById('point-image-file'),
  imagePick: document.getElementById('btn-image-pick'),
  imageReplace: document.getElementById('btn-image-replace'),
  imageReplaceCancel: document.getElementById('btn-image-replace-cancel'),
  imageDropzoneTitle: document.getElementById('image-dropzone-title'),
  imageDropzoneSub: document.getElementById('image-dropzone-sub'),
  imageRemove: document.getElementById('btn-point-image-remove'),
  lat: document.getElementById('point-lat'),
  lng: document.getElementById('point-lng'),
  save: document.getElementById('btn-save'),
  delete: document.getElementById('btn-delete'),
  newBtn: document.getElementById('btn-new'),
};

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}/${path}`, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) {
    if (response.status === 401) {
      window.location.href = 'login.php';
    }
    throw new Error(payload.message || 'Der opstod en fejl.');
  }

  return payload.data;
}

function showStatus(message, type = 'success') {
  els.statusBadge.textContent = message;
  els.statusBadge.className = type;
  clearTimeout(state.statusTimer);
  state.statusTimer = setTimeout(() => {
    els.statusBadge.className = 'hidden';
    els.statusBadge.textContent = '';
  }, 2600);
}

function showLoadError(message) {
  if (!els.loadError) {
    return;
  }
  els.loadError.classList.remove('hidden');
  els.loadError.querySelector('div').textContent = message;
}

function hideLoadError() {
  if (!els.loadError) {
    return;
  }
  els.loadError.classList.add('hidden');
}

function createMarkerIcon(point, isActive = false) {
  const color = CATEGORY_COLORS[point.category] || '#1a3a32';
  const audioIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;

  return L.divIcon({
    className: `custom-div-icon ${isActive ? 'marker-active' : ''}`,
    html: `<div class="marker-circle" style="background-color:${color}">${audioIcon}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function initMap() {
  if (typeof L === 'undefined') {
    throw new Error('Leaflet kunne ikke indlæses. Tjek internetforbindelse og genindlæs siden.');
  }

  if (typeof L.markerClusterGroup !== 'function') {
    throw new Error('Leaflet MarkerCluster kunne ikke indlæses. Genindlæs siden.');
  }

  state.map = L.map(els.map, {
    center: START_CENTER,
    zoom: START_ZOOM,
    zoomControl: true,
    attributionControl: true,
  });

  state.baseLayers = {
    Standard: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }),
    Topografisk: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>, &copy; OpenStreetMap',
    }),
    'Stier & natur': L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
      maxZoom: 20,
      attribution: '&copy; <a href="https://www.cyclosm.org">CyclOSM</a>, &copy; OpenStreetMap',
    }),
    Satellit: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: '&copy; Esri, Maxar, Earthstar Geographics',
    }),
  };

  state.baseLayers.Standard.addTo(state.map);

  L.control.layers(state.baseLayers, null, {
    collapsed: false,
    position: 'topright',
  }).addTo(state.map);

  state.map.on('baselayerchange', (event) => {
    if (!els.map) {
      return;
    }
    els.map.classList.toggle('map-style-standard', event.name === 'Standard');
  });

  state.clusterGroup = L.markerClusterGroup({
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    maxClusterRadius: 40,
    iconCreateFunction(cluster) {
      const count = cluster.getChildCount();
      return L.divIcon({
        html: `<div class="cluster-marker"><span>${count}</span></div>`,
        className: 'custom-cluster-icon',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });
    },
  }).addTo(state.map);
}

function refreshMapSize() {
  if (!state.map) {
    return;
  }
  state.map.invalidateSize();
}

function renderBoundary() {
  state.boundaryLayers.forEach((layer) => layer.remove());
  state.boundaryLayers = [];

  const segments = state.forestBoundary.filter((segment) => segment.length >= 3);
  if (segments.length === 0) {
    return;
  }

  segments.forEach((segment) => {
    const areaLayer = L.polygon(segment, {
      color: '#1a3a32',
      weight: 2,
      opacity: 0.55,
      fillColor: '#059669',
      fillOpacity: 0.18,
      interactive: false,
    });
    areaLayer.addTo(state.map);
    state.boundaryLayers.push(areaLayer);
  });

  const maskLayer = L.polygon(
    [
      [[90, -180], [90, 180], [-90, 180], [-90, -180]],
      ...segments,
    ],
    {
      color: '#1a3a32',
      weight: 1.5,
      opacity: 0.2,
      fillColor: '#061612',
      fillOpacity: 0.45,
      interactive: false,
    },
  );
  maskLayer.addTo(state.map);
  state.boundaryLayers.push(maskLayer);
}

function renderPointList() {
  els.pointCount.textContent = `${state.points.length} punkt${state.points.length === 1 ? '' : 'er'}`;
  els.pointList.innerHTML = '';

  const sorted = [...state.points].sort((a, b) => a.id - b.id);
  sorted.forEach((point) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `point-list-item${point.id === state.selectedId ? ' active' : ''}`;
    button.innerHTML = `
      <div class="point-list-meta">
        <span class="point-id">#${point.id}</span>
        <span class="point-category" style="background-color:${CATEGORY_COLORS[point.category] || '#1a3a32'}">${escapeHtml(point.category)}</span>
      </div>
      <div class="point-title">${escapeHtml(point.title)}</div>
    `;
    button.addEventListener('click', () => {
      selectPoint(point.id);
      state.map.panTo([point.lat, point.lng], { animate: true });
    });
    els.pointList.appendChild(button);
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderMarkers() {
  if (state.clusterGroup) {
    state.clusterGroup.clearLayers();
  }

  Object.entries(state.markers).forEach(([id, marker]) => {
    if (id !== 'new') {
      marker.remove();
      delete state.markers[id];
    }
  });

  state.points.forEach((point) => {
    const marker = L.marker([point.lat, point.lng], {
      draggable: true,
      icon: createMarkerIcon(point, point.id === state.selectedId),
    });

    marker.on('click', () => selectPoint(point.id));
    marker.on('dragend', () => {
      const { lat, lng } = marker.getLatLng();
      updateFormCoords(lat, lng);
      if (state.selectedId === point.id) {
        point.lat = lat;
        point.lng = lng;
      }
    });

    state.markers[point.id] = marker;
    state.clusterGroup.addLayer(marker);
  });

  renderPointList();
}

function audioFilenameFromSrc(src) {
  if (!src) {
    return '';
  }
  try {
    return decodeURIComponent(src.split('/').pop() || '');
  } catch (error) {
    return src.split('/').pop() || '';
  }
}

function setPanelVisible(panel, visible) {
  if (!panel) {
    return;
  }
  panel.classList.toggle('hidden', !visible);
}

function clearPendingImageSelection() {
  if (els.imageFile) {
    els.imageFile.value = '';
  }
  state.isReplacingImage = false;
}

function updatePointImageUI() {
  const hasSelection = state.selectedId && state.selectedId !== 'new';
  const imageSrc = state.currentImageSrc || '';

  setPanelVisible(els.imageIdle, !state.selectedId);
  setPanelVisible(els.imageLocked, state.isNew);
  setPanelVisible(
    els.imageAttached,
    hasSelection && Boolean(imageSrc) && !state.isReplacingImage && !state.isUploadingImage,
  );
  setPanelVisible(
    els.imageUpload,
    hasSelection && (!imageSrc || state.isReplacingImage || state.isUploadingImage),
  );

  if (hasSelection && imageSrc && els.imageAttachedPreview) {
    els.imageAttachedPreview.src = imageSrc;
  }

  if (els.imageDropzoneTitle) {
    if (state.isUploadingImage) {
      els.imageDropzoneTitle.textContent = 'Uploader billede…';
    } else {
      els.imageDropzoneTitle.textContent = state.isReplacingImage ? 'Vælg nyt billede' : 'Vælg billede';
    }
  }
  if (els.imageDropzoneSub) {
    els.imageDropzoneSub.textContent = state.isUploadingImage
      ? 'Vent et øjeblik'
      : state.isReplacingImage
        ? 'Erstatter det nuværende billede'
        : 'Beskær og upload i ét trin';
  }
  setPanelVisible(
    els.imageReplaceCancel,
    hasSelection && state.isReplacingImage && !state.isUploadingImage && Boolean(imageSrc),
  );

  if (els.imagePick) {
    els.imagePick.disabled = state.isUploadingImage;
  }
  if (els.imageReplace) {
    els.imageReplace.disabled = state.isUploadingImage;
  }
}

async function uploadPointImage(blob) {
  if (state.isNew || !state.selectedId) {
    showStatus('Gem punktet først — derefter kan du uploade billede.', 'error');
    return false;
  }

  if (!(blob instanceof Blob)) {
    showStatus('Vælg et billede først.', 'error');
    return false;
  }

  const formData = new FormData();
  formData.append('file', blob, `point-${state.selectedId}.jpg`);
  formData.append('pointId', String(state.selectedId));

  state.isUploadingImage = true;
  updatePointImageUI();

  try {
    const response = await fetch(`${API_BASE}/image-upload.php`, {
      method: 'POST',
      credentials: 'same-origin',
      body: formData,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.success) {
      if (response.status === 401) {
        window.location.href = 'login.php';
      }
      throw new Error(payload.message || 'Upload fejlede.');
    }

    const updatedPoint = payload.data.point;
    if (updatedPoint) {
      state.points = state.points.map((point) => (
        point.id === updatedPoint.id ? updatedPoint : point
      ));
      state.currentImageSrc = updatedPoint.imageSrc || payload.data.imageSrc || '';
    } else {
      state.currentImageSrc = payload.data.imageSrc || '';
    }

    clearPendingImageSelection();
    updatePointImageUI();
    showStatus('Billede uploadet til punktet.');
    return true;
  } catch (error) {
    showStatus(error.message, 'error');
    return false;
  } finally {
    state.isUploadingImage = false;
    updatePointImageUI();
  }
}

async function removePointImage() {
  if (state.isNew || !state.selectedId) {
    return;
  }

  const confirmed = window.confirm('Fjern billedet fra dette punkt?');
  if (!confirmed) {
    return;
  }

  try {
    const result = await api('image-upload.php', {
      method: 'POST',
      body: JSON.stringify({
        action: 'delete',
        pointId: state.selectedId,
      }),
    });

    const updatedPoint = result.point;
    if (updatedPoint) {
      state.points = state.points.map((point) => (
        point.id === updatedPoint.id ? updatedPoint : point
      ));
      state.currentImageSrc = updatedPoint.imageSrc || '';
    } else {
      state.currentImageSrc = '';
    }

    clearPendingImageSelection();
    updatePointImageUI();
    showStatus('Billede fjernet.');
  } catch (error) {
    showStatus(error.message, 'error');
  }
}

async function handleImageFileSelected(file) {
  if (!file) {
    updatePointImageUI();
    return;
  }

  if (!window.ImageCropper) {
    showStatus('Billede-cropper kunne ikke indlæses.', 'error');
    return;
  }

  try {
    const blob = await window.ImageCropper.open(file);
    await uploadPointImage(blob);
  } catch (error) {
    if (error.message !== 'Crop annulleret.') {
      showStatus(error.message, 'error');
    }
    clearPendingImageSelection();
    updatePointImageUI();
  }
}

if (els.imageRemove) {
  els.imageRemove.addEventListener('click', removePointImage);
}

if (els.imagePick) {
  els.imagePick.addEventListener('click', () => {
    els.imageFile?.click();
  });
}

if (els.imageFile) {
  els.imageFile.addEventListener('change', () => {
    const file = els.imageFile.files?.[0];
    if (!file) {
      updatePointImageUI();
      return;
    }
    handleImageFileSelected(file);
  });
}

if (els.imageReplace) {
  els.imageReplace.addEventListener('click', () => {
    state.isReplacingImage = true;
    if (els.imageFile) {
      els.imageFile.value = '';
    }
    updatePointImageUI();
    els.imageFile?.click();
  });
}

if (els.imageReplaceCancel) {
  els.imageReplaceCancel.addEventListener('click', () => {
    clearPendingImageSelection();
    updatePointImageUI();
  });
}

function clearPendingAudioSelection() {
  if (els.audioFile) {
    els.audioFile.value = '';
  }
  state.isReplacingAudio = false;
}

function updateEditorBadge() {
  if (!els.pointBadge) {
    return;
  }

  if (state.selectedId && state.selectedId !== 'new') {
    els.pointBadge.textContent = `#${state.selectedId}`;
    els.pointBadge.classList.remove('hidden');
    return;
  }

  els.pointBadge.classList.add('hidden');
}

function updatePointAudioUI() {
  const hasSelection = state.selectedId && state.selectedId !== 'new';
  const audioSrc = state.currentAudioSrc || '';
  const hasPendingFile = Boolean(els.audioFile?.files?.length);

  if (els.audioSrc) {
    els.audioSrc.value = audioSrc;
  }

  setPanelVisible(els.audioIdle, !state.selectedId);
  setPanelVisible(els.audioLocked, state.isNew);
  setPanelVisible(els.audioAttached, hasSelection && Boolean(audioSrc) && !hasPendingFile && !state.isReplacingAudio);
  setPanelVisible(els.audioUpload, hasSelection && (!audioSrc || state.isReplacingAudio) && !hasPendingFile);
  setPanelVisible(els.audioPending, hasSelection && hasPendingFile);

  if (hasSelection && audioSrc && els.audioAttachedName) {
    els.audioAttachedName.textContent = audioFilenameFromSrc(audioSrc);
  }

  if (hasPendingFile && els.audioPendingName && els.audioFile?.files?.[0]) {
    els.audioPendingName.textContent = els.audioFile.files[0].name;
  }

  if (els.audioDropzoneTitle) {
    els.audioDropzoneTitle.textContent = state.isReplacingAudio ? 'Vælg ny lydfil' : 'Vælg lydfil';
  }
  if (els.audioDropzoneSub) {
    els.audioDropzoneSub.textContent = state.isReplacingAudio
      ? 'Erstatter den nuværende MP3'
      : 'Klik for at vælge MP3';
  }
  setPanelVisible(
    els.audioReplaceCancel,
    hasSelection && state.isReplacingAudio && !hasPendingFile && Boolean(audioSrc),
  );

  updateEditorBadge();
  updateAudioPlayButton();
}

async function uploadPointAudio() {
  if (state.isNew || !state.selectedId) {
    showStatus('Gem punktet først — derefter kan du uploade lydfil.', 'error');
    return;
  }

  if (!els.audioFile?.files?.length) {
    showStatus('Vælg en MP3-fil først.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('file', els.audioFile.files[0]);
  formData.append('pointId', String(state.selectedId));
  if (els.title?.value.trim()) {
    formData.append('label', els.title.value.trim());
  }

  els.audioUploadBtn.disabled = true;

  try {
    const response = await fetch(`${API_BASE}/audio-upload.php`, {
      method: 'POST',
      credentials: 'same-origin',
      body: formData,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.success) {
      if (response.status === 401) {
        window.location.href = 'login.php';
      }
      throw new Error(payload.message || 'Upload fejlede.');
    }

    const updatedPoint = payload.data.point;
    if (updatedPoint) {
      state.points = state.points.map((point) => (
        point.id === updatedPoint.id ? updatedPoint : point
      ));
      state.currentAudioSrc = updatedPoint.audioSrc || payload.data.audioSrc || '';
    } else {
      state.currentAudioSrc = payload.data.audioSrc || '';
    }

    els.audioFile.value = '';
    clearPendingAudioSelection();
    updatePointAudioUI();
    renderMarkers();
    showStatus('Lydfil uploadet til punktet.');
  } catch (error) {
    showStatus(error.message, 'error');
  } finally {
    els.audioUploadBtn.disabled = false;
  }
}

async function removePointAudio() {
  if (state.isNew || !state.selectedId) {
    return;
  }

  const confirmed = window.confirm('Fjern lydfilen fra dette punkt?');
  if (!confirmed) {
    return;
  }

  try {
    const result = await api('audio-upload.php', {
      method: 'POST',
      body: JSON.stringify({
        action: 'delete',
        pointId: state.selectedId,
      }),
    });

    const updatedPoint = result.point;
    if (updatedPoint) {
      state.points = state.points.map((point) => (
        point.id === updatedPoint.id ? updatedPoint : point
      ));
      state.currentAudioSrc = updatedPoint.audioSrc || '';
    } else {
      state.currentAudioSrc = '';
    }

    stopAudioPreview();
    clearPendingAudioSelection();
    updatePointAudioUI();
    renderMarkers();
    showStatus('Lydfil fjernet.');
  } catch (error) {
    showStatus(error.message, 'error');
  }
}

function stopAudioPreview() {
  if (!els.audioPreview) {
    return;
  }
  els.audioPreview.pause();
  els.audioPreview.currentTime = 0;
  setAudioPlayState(false);
}

function setAudioPlayState(isPlaying) {
  if (!els.audioPlay) {
    return;
  }
  els.audioPlay.classList.toggle('is-playing', isPlaying);
}

function updateAudioPlayButton() {
  if (!els.audioPlay) {
    return;
  }
  const canPlay = Boolean(state.currentAudioSrc);
  els.audioPlay.disabled = !canPlay;
  if (!canPlay) {
    stopAudioPreview();
  }
}

function toggleAudioPreview() {
  if (!els.audioPreview || els.audioPlay?.disabled) {
    return;
  }

  if (!els.audioPreview.paused && !els.audioPreview.ended) {
    stopAudioPreview();
    return;
  }

  const src = state.currentAudioSrc;
  if (!src) {
    return;
  }

  if (els.audioPreview.src !== src) {
    els.audioPreview.src = src;
  }

  els.audioPreview.play()
    .then(() => setAudioPlayState(true))
    .catch(() => showStatus('Kunne ikke afspille lydfilen.', 'error'));
}

if (els.audioPreview) {
  els.audioPreview.addEventListener('ended', () => setAudioPlayState(false));
}

if (els.audioPlay) {
  els.audioPlay.addEventListener('click', toggleAudioPreview);
}

if (els.audioUploadBtn) {
  els.audioUploadBtn.addEventListener('click', uploadPointAudio);
}

if (els.audioRemove) {
  els.audioRemove.addEventListener('click', removePointAudio);
}

if (els.audioPick) {
  els.audioPick.addEventListener('click', () => {
    els.audioFile?.click();
  });
}

if (els.audioFile) {
  els.audioFile.addEventListener('change', () => {
    if (!els.audioFile.files?.length) {
      updatePointAudioUI();
      return;
    }
    updatePointAudioUI();
  });
}

if (els.audioCancel) {
  els.audioCancel.addEventListener('click', () => {
    clearPendingAudioSelection();
    updatePointAudioUI();
  });
}

if (els.audioReplace) {
  els.audioReplace.addEventListener('click', () => {
    state.isReplacingAudio = true;
    if (els.audioFile) {
      els.audioFile.value = '';
    }
    updatePointAudioUI();
    els.audioFile?.click();
  });
}

if (els.audioReplaceCancel) {
  els.audioReplaceCancel.addEventListener('click', () => {
    clearPendingAudioSelection();
    updatePointAudioUI();
  });
}

function setEditorEnabled(enabled) {
  els.save.disabled = !enabled;
  els.delete.disabled = !enabled || state.isNew;
}

function clearForm() {
  if (state.markers.new) {
    state.markers.new.remove();
    delete state.markers.new;
  }

  stopAudioPreview();
  clearPendingImageSelection();
  state.selectedId = null;
  state.isNew = false;
  state.currentAudioSrc = '';
  state.currentImageSrc = '';
  state.isReplacingAudio = false;
  els.id.value = '';
  els.title.value = '';
  els.description.value = '';
  els.category.value = 'Historie';
  els.lat.value = '';
  els.lng.value = '';
  els.subtitle.textContent = 'Vælg et punkt på kortet eller i listen';
  if (els.audioFile) {
    els.audioFile.value = '';
  }
  setEditorEnabled(false);
  updatePointAudioUI();
  updatePointImageUI();
  renderMarkers();
}

function fillForm(point) {
  stopAudioPreview();
  clearPendingAudioSelection();
  clearPendingImageSelection();
  state.selectedId = point.id;
  state.isNew = false;
  state.isReplacingAudio = false;
  els.id.value = String(point.id);
  els.title.value = point.title;
  els.description.value = point.description;
  els.category.value = point.category;
  state.currentAudioSrc = point.audioSrc || '';
  state.currentImageSrc = point.imageSrc || '';
  els.lat.value = point.lat;
  els.lng.value = point.lng;
  els.subtitle.textContent = `Redigerer punkt #${point.id}`;
  if (els.audioFile) {
    els.audioFile.value = '';
  }
  setEditorEnabled(true);
  updatePointAudioUI();
  updatePointImageUI();
  renderMarkers();
}

function selectPoint(id) {
  const point = state.points.find((item) => item.id === id);
  if (!point) {
    return;
  }
  fillForm(point);
}

function updateFormCoords(lat, lng) {
  els.lat.value = Number(lat).toFixed(8);
  els.lng.value = Number(lng).toFixed(8);
}

function getFormData() {
  return {
    id: Number(els.id.value) || undefined,
    title: els.title.value.trim(),
    description: els.description.value.trim(),
    category: els.category.value,
    audioSrc: state.currentAudioSrc,
    lat: Number(els.lat.value),
    lng: Number(els.lng.value),
  };
}

function fitMapToContent() {
  if (!state.map) {
    return;
  }

  const bounds = L.latLngBounds([]);

  state.points.forEach((point) => {
    bounds.extend([point.lat, point.lng]);
  });

  state.forestBoundary.forEach((segment) => {
    segment.forEach((coord) => bounds.extend(coord));
  });

  if (bounds.isValid()) {
    state.map.fitBounds(bounds, {
      padding: [10, 10],
      maxZoom: 15,
    });
  }
}

function refreshMapSizeAndFit() {
  refreshMapSize();
  fitMapToContent();
}

async function loadInitialData() {
  hideLoadError();

  const embedded = window.__INITIAL_DATA__;
  if (embedded) {
    state.points = embedded.audioPoints || [];
    state.forestBoundary = embedded.forestBoundary || [];
  } else {
    const pointsData = await api('points.php');
    state.points = pointsData.audioPoints || [];

    try {
      const boundaryData = await api('boundary.php');
      state.forestBoundary = boundaryData.forestBoundary || [];
    } catch (error) {
      showStatus(`Områdegrænse kunne ikke hentes: ${error.message}`, 'error');
      state.forestBoundary = [];
    }
  }

  updatePointAudioUI();
  updatePointImageUI();
  renderBoundary();
  renderMarkers();
  fitMapToContent();

  requestAnimationFrame(() => {
    refreshMapSizeAndFit();
    setTimeout(refreshMapSizeAndFit, 150);
  });
}

els.newBtn.addEventListener('click', () => {
  stopAudioPreview();
  clearPendingImageSelection();

  if (state.clusterGroup) {
    state.clusterGroup.clearLayers();
  }

  Object.entries(state.markers).forEach(([id, marker]) => {
    marker.remove();
    delete state.markers[id];
  });

  const center = state.map.getCenter();
  state.selectedId = 'new';
  state.isNew = true;

  els.id.value = '';
  els.title.value = '';
  els.description.value = '';
  els.category.value = 'Historie';
  state.currentAudioSrc = '';
  state.currentImageSrc = '';
  updateFormCoords(center.lat, center.lng);
  els.subtitle.textContent = 'Nyt punkt — udfyld felter og gem';
  state.isReplacingAudio = false;
  if (els.audioFile) {
    els.audioFile.value = '';
  }
  setEditorEnabled(true);
  updatePointAudioUI();
  updatePointImageUI();
  renderPointList();

  const draftPoint = {
    id: 'new',
    lat: center.lat,
    lng: center.lng,
    category: 'Historie',
    audioSrc: '',
  };

  const marker = L.marker([center.lat, center.lng], {
    draggable: true,
    icon: createMarkerIcon(draftPoint, true),
  });

  marker.on('dragend', () => {
    const { lat, lng } = marker.getLatLng();
    updateFormCoords(lat, lng);
  });

  marker.addTo(state.map);
  state.markers.new = marker;
});

els.form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const data = getFormData();
  if (!data.title || !data.description) {
    showStatus('Udfyld titel og beskrivelse.', 'error');
    return;
  }

  try {
    if (state.isNew) {
      const result = await api('points.php', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create',
          ...data,
        }),
      });
      state.points = result.audioPoints;
      state.isNew = false;
      if (state.markers.new) {
        state.markers.new.remove();
        delete state.markers.new;
      }
      if (result.point) {
        state.selectedId = result.point.id;
        state.currentAudioSrc = result.point.audioSrc || state.currentAudioSrc;
      }
      showStatus('Nyt punkt oprettet.');
    } else {
      const result = await api('points.php', {
        method: 'POST',
        body: JSON.stringify({
          action: 'update',
          ...data,
        }),
      });
      state.points = result.audioPoints;
      showStatus('Punkt gemt.');
    }

    renderMarkers();
    if (state.selectedId) {
      selectPoint(state.selectedId);
    } else {
      updatePointAudioUI();
      updatePointImageUI();
    }
  } catch (error) {
    showStatus(error.message, 'error');
  }
});

els.delete.addEventListener('click', async () => {
  if (!state.selectedId || state.isNew) {
    return;
  }

  const point = state.points.find((item) => item.id === state.selectedId);
  if (!point) {
    return;
  }

  const confirmed = window.confirm(`Slet "${point.title}"?`);
  if (!confirmed) {
    return;
  }

  try {
    const result = await api('points.php', {
      method: 'POST',
      body: JSON.stringify({
        action: 'delete',
        id: state.selectedId,
      }),
    });
    state.points = result.audioPoints;
    clearForm();
    showStatus('Punkt slettet.');
  } catch (error) {
    showStatus(error.message, 'error');
  }
});

try {
  initMap();
  loadInitialData().catch((error) => {
    showLoadError(error.message);
    if (els.pointCount) {
      els.pointCount.textContent = 'Kunne ikke indlæse';
    }
  });
} catch (error) {
  showLoadError(error.message);
  if (els.pointCount) {
    els.pointCount.textContent = 'Kunne ikke indlæse';
  }
}

window.addEventListener('resize', () => {
  refreshMapSizeAndFit();
});
