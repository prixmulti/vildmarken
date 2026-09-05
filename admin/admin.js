const API_BASE = 'api';
const START_CENTER = [55.685, 8.605];
const START_ZOOM = 13;

const CATEGORY_COLORS = {
  Historie: '#78350f',
  Natur: '#065f46',
  Rewild: '#1e40af',
};

const URN_PATH = 'M5.42,1.11c0,.74,1.73,2.21,3.94,3.5,3.7,1.84,3.45,3.14-2.71,12.36L0,27.3l6.41,8.67c3.7,4.61,6.16,9.96,5.92,11.62-.49,2.58,1.48,3.14,10.35,3.14s10.84-.55,10.35-3.14c-.25-1.66,2.22-7.01,5.92-11.62l6.41-8.67-6.65-10.33c-6.16-9.22-6.41-10.51-2.71-12.36C42.89.74,40.42,0,22.68,0,13.31,0,5.42.55,5.42,1.11Z';

const state = {
  map: null,
  clusterGroup: null,
  baseLayers: {},
  markers: {},
  boundaryLayers: [],
  points: [],
  forestBoundary: [],
  audioFiles: [],
  selectedId: null,
  isNew: false,
  statusTimer: null,
};

const els = {
  map: document.getElementById('map'),
  pointList: document.getElementById('point-list'),
  pointCount: document.getElementById('point-count'),
  loadError: document.getElementById('load-error'),
  form: document.getElementById('point-form'),
  subtitle: document.getElementById('editor-subtitle'),
  statusBadge: document.getElementById('status-badge'),
  id: document.getElementById('point-id'),
  title: document.getElementById('point-title'),
  description: document.getElementById('point-description'),
  category: document.getElementById('point-category'),
  audio: document.getElementById('point-audio'),
  audioPlay: document.getElementById('btn-audio-play'),
  audioPreview: document.getElementById('audio-preview'),
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
  const isArchaeology = point.audioSrc === 'urne';
  const urnIcon = `<svg viewBox="0 0 45.35 50.73" width="18" height="18" fill="white"><path d="${URN_PATH}" /></svg>`;
  const audioIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;

  return L.divIcon({
    className: `custom-div-icon ${isActive ? 'marker-active' : ''}`,
    html: `<div class="marker-circle" style="background-color:${color}">${isArchaeology ? urnIcon : audioIcon}</div>`,
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

function populateAudioSelect(selectedValue = '') {
  els.audio.innerHTML = '';
  state.audioFiles.forEach((file) => {
    const option = document.createElement('option');
    option.value = file.value;
    option.textContent = file.label;
    if (file.value === selectedValue) {
      option.selected = true;
    }
    els.audio.appendChild(option);
  });
  updateAudioPlayButton();
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
  const canPlay = els.audio.value && els.audio.value !== 'urne';
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

  const src = els.audio.value;
  if (!src || src === 'urne') {
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

if (els.audio) {
  els.audio.addEventListener('change', () => {
    stopAudioPreview();
    updateAudioPlayButton();
  });
}

if (els.audioPlay) {
  els.audioPlay.addEventListener('click', toggleAudioPreview);
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
  state.selectedId = null;
  state.isNew = false;
  els.id.value = '';
  els.title.value = '';
  els.description.value = '';
  els.category.value = 'Historie';
  populateAudioSelect(state.audioFiles[0]?.value || 'urne');
  els.lat.value = '';
  els.lng.value = '';
  els.subtitle.textContent = 'Vælg et punkt på kortet eller i listen';
  setEditorEnabled(false);
  renderMarkers();
}

function fillForm(point) {
  stopAudioPreview();
  state.selectedId = point.id;
  state.isNew = false;
  els.id.value = String(point.id);
  els.title.value = point.title;
  els.description.value = point.description;
  els.category.value = point.category;
  populateAudioSelect(point.audioSrc);
  els.lat.value = point.lat;
  els.lng.value = point.lng;
  els.subtitle.textContent = `Redigerer punkt #${point.id}`;
  setEditorEnabled(true);
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
    audioSrc: els.audio.value,
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
    state.audioFiles = embedded.audioFiles || [];
  } else {
    const pointsData = await api('points.php');
    state.points = pointsData.audioPoints || [];

    try {
      const audioData = await api('audio-files.php');
      state.audioFiles = audioData.files || [];
    } catch (error) {
      showStatus(`Lydfiler kunne ikke hentes: ${error.message}`, 'error');
      state.audioFiles = [{ label: 'Arkæologisk fund (ingen lyd)', value: 'urne' }];
    }

    try {
      const boundaryData = await api('boundary.php');
      state.forestBoundary = boundaryData.forestBoundary || [];
    } catch (error) {
      showStatus(`Områdegrænse kunne ikke hentes: ${error.message}`, 'error');
      state.forestBoundary = [];
    }
  }

  populateAudioSelect();
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
  populateAudioSelect(state.audioFiles[0]?.value || 'urne');
  updateFormCoords(center.lat, center.lng);
  els.subtitle.textContent = 'Nyt punkt — udfyld felter og gem';
  setEditorEnabled(true);
  renderPointList();

  const draftPoint = {
    id: 'new',
    lat: center.lat,
    lng: center.lng,
    category: 'Historie',
    audioSrc: els.audio.value,
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
  if (!data.title || !data.description || !data.audioSrc) {
    showStatus('Udfyld alle felter.', 'error');
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
