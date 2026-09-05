const API_BASE = 'api';
const START_CENTER = [55.685, 8.605];
const START_ZOOM = 13;
const MAX_UNDO = 30;

const MIN_ZOOM_FOR_MATRIKEL = 14;
const SNAP_OPTIONS = {
  snappable: true,
  snapDistance: 20,
  snapSegment: true,
  snapMiddle: true,
};
const MATRIKEL_STYLE = {
  color: '#92400e',
  weight: 1.5,
  opacity: 0.95,
  fillColor: '#d97706',
  fillOpacity: 0.06,
  interactive: false,
};

function getParcelStyle(layer) {
  const isSelected = state.selectedParcelLayers.has(layer);
  const isHovered = state.hoveredParcelLayer === layer && state.parcelSelectMode;

  if (isSelected) {
    return {
      color: '#b45309',
      weight: 2.5,
      opacity: 1,
      fillColor: '#f59e0b',
      fillOpacity: 0.28,
      interactive: state.parcelSelectMode,
    };
  }

  if (isHovered) {
    return {
      color: '#c2410c',
      weight: 2,
      opacity: 1,
      fillColor: '#fb923c',
      fillOpacity: 0.2,
      interactive: state.parcelSelectMode,
    };
  }

  return {
    ...MATRIKEL_STYLE,
    interactive: state.parcelSelectMode,
  };
}

const CATEGORY_COLORS = {
  Historie: '#78350f',
  Natur: '#065f46',
  Rewild: '#1e40af',
};

const state = {
  map: null,
  baseLayers: {},
  matrikelGroup: null,
  matrikelEnabled: false,
  matrikelFetchTimer: null,
  matrikelRequestId: 0,
  selectedParcelLayers: new Set(),
  hoveredParcelLayer: null,
  parcelSelectMode: false,
  editGroup: null,
  maskLayer: null,
  pointMarkers: [],
  forestBoundary: [],
  audioPoints: [],
  selectedIndex: null,
  undoStack: [],
  isSyncing: false,
  statusTimer: null,
};

const els = {
  map: document.getElementById('map'),
  segmentList: document.getElementById('segment-list'),
  segmentCount: document.getElementById('segment-count'),
  subtitle: document.getElementById('editor-subtitle'),
  statusBadge: document.getElementById('status-badge'),
  loadError: document.getElementById('load-error'),
  toggleMatrikel: document.getElementById('toggle-matrikel'),
  toggleParcelSelect: document.getElementById('toggle-parcel-select'),
  parcelSelectionInfo: document.getElementById('parcel-selection-info'),
  importParcels: document.getElementById('btn-import-parcels'),
  clearParcelSelection: document.getElementById('btn-clear-parcel-selection'),
  toggleMask: document.getElementById('toggle-mask'),
  togglePoints: document.getElementById('toggle-points'),
  matrikelHint: document.getElementById('matrikel-hint'),
  save: document.getElementById('btn-save'),
  undo: document.getElementById('btn-undo'),
  deleteSegment: document.getElementById('btn-delete-segment'),
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

function cloneBoundary(data) {
  return JSON.parse(JSON.stringify(data));
}

function pushUndoSnapshot() {
  if (state.isSyncing) {
    return;
  }
  state.undoStack.push(cloneBoundary(state.forestBoundary));
  if (state.undoStack.length > MAX_UNDO) {
    state.undoStack.shift();
  }
  els.undo.disabled = state.undoStack.length === 0;
}

function layerStyle(index) {
  const isActive = index === state.selectedIndex;
  return {
    color: isActive ? '#047857' : '#1a3a32',
    weight: isActive ? 3 : 2,
    opacity: 0.85,
    fillColor: '#059669',
    fillOpacity: isActive ? 0.3 : 0.22,
  };
}

function ringFromLayer(layer) {
  const latlngs = layer.getLatLngs();
  const ring = Array.isArray(latlngs[0]) ? latlngs[0] : latlngs;
  return ring.map((ll) => [ll.lat, ll.lng]);
}

function syncFromMap() {
  if (!state.editGroup) {
    return;
  }

  state.isSyncing = true;
  const segments = [];
  state.editGroup.eachLayer((layer) => {
    const ring = ringFromLayer(layer);
    if (ring.length >= 3) {
      segments.push(ring);
    }
  });

  state.forestBoundary = segments;

  if (state.selectedIndex !== null && state.selectedIndex >= segments.length) {
    state.selectedIndex = segments.length > 0 ? segments.length - 1 : null;
  }

  renderSegmentList();
  renderMask();
  updateActionButtons();
  state.isSyncing = false;
}

function bindLayerEvents(layer) {
  layer.on('click', () => {
    const index = getLayerIndex(layer);
    if (index >= 0) {
      selectSegment(index, false);
    }
  });

  ['pm:edit', 'pm:dragend', 'pm:vertexadded', 'pm:vertexremoved', 'pm:rotateend', 'pm:markerdragend'].forEach((eventName) => {
    layer.on(eventName, () => {
      pushUndoSnapshot();
      syncFromMap();
      refreshLayerStyles();
    });
  });

  layer.on('pm:enable', () => {
    attachMatrikelSnapTargets(layer.pm);
  });
}

function getLayerIndex(layer) {
  let index = 0;
  let found = -1;
  state.editGroup.eachLayer((item) => {
    if (item === layer) {
      found = index;
    }
    index += 1;
  });
  return found;
}

function refreshLayerStyles() {
  let index = 0;
  state.editGroup.eachLayer((layer) => {
    layer.setStyle(layerStyle(index));
    index += 1;
  });
}

function rebuildEditableLayers() {
  if (!state.editGroup) {
    return;
  }

  state.isSyncing = true;
  state.editGroup.clearLayers();

  state.forestBoundary.forEach((segment, index) => {
    if (segment.length < 3) {
      return;
    }
    const layer = L.polygon(segment, layerStyle(index));
    bindLayerEvents(layer);
    state.editGroup.addLayer(layer);
  });

  if (state.editGroup.pm) {
    state.editGroup.pm.enable({
      allowSelfIntersection: false,
      ...SNAP_OPTIONS,
    });
  }

  attachMatrikelSnapTargetsToEditLayers();

  renderMask();
  renderSegmentList();
  updateActionButtons();
  state.isSyncing = false;
}

function renderSegmentList() {
  const count = state.forestBoundary.length;
  els.segmentCount.textContent = `${count} segment${count === 1 ? '' : 'er'}`;
  els.segmentList.innerHTML = '';

  if (count === 0) {
    const empty = document.createElement('p');
    empty.className = 'px-3 py-4 text-xs text-stone-500';
    empty.textContent = 'Ingen segmenter endnu. Tegn et polygon med værktøjerne på kortet.';
    els.segmentList.appendChild(empty);
    return;
  }

  state.forestBoundary.forEach((segment, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `segment-list-item${index === state.selectedIndex ? ' active' : ''}`;
    const pointCount = segment.length;
    button.innerHTML = `
      <div class="segment-meta">
        <span class="segment-id">Segment #${index + 1}</span>
        <span class="segment-points">${pointCount} pt</span>
      </div>
      <div class="segment-label">${pointCount >= 3 ? 'Polygon' : 'For få punkter'}</div>
    `;
    button.addEventListener('click', () => {
      selectSegment(index, true);
    });
    els.segmentList.appendChild(button);
  });
}

function renderMask() {
  if (state.maskLayer) {
    state.maskLayer.remove();
    state.maskLayer = null;
  }

  if (!els.toggleMask.checked || !state.map) {
    return;
  }

  const segments = state.forestBoundary.filter((segment) => segment.length >= 3);
  if (segments.length === 0) {
    return;
  }

  state.maskLayer = L.polygon(
    [
      [[90, -180], [90, 180], [-90, 180], [-90, -180]],
      ...segments,
    ],
    {
      color: '#1a3a32',
      weight: 1,
      opacity: 0.15,
      fillColor: '#061612',
      fillOpacity: 0.45,
      interactive: false,
      pmIgnore: true,
    },
  );
  state.maskLayer.addTo(state.map);
  state.maskLayer.bringToBack();
}

function renderPointMarkers() {
  state.pointMarkers.forEach((marker) => marker.remove());
  state.pointMarkers = [];

  if (!els.togglePoints.checked || !state.map) {
    return;
  }

  state.audioPoints.forEach((point) => {
    const color = CATEGORY_COLORS[point.category] || '#78716c';
    const marker = L.marker([point.lat, point.lng], {
      interactive: false,
      pmIgnore: true,
      icon: L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="boundary-point-marker" style="background:${color}"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      }),
    });
    marker.addTo(state.map);
    state.pointMarkers.push(marker);
  });
}

function selectSegment(index, panTo = false) {
  state.selectedIndex = index;
  renderSegmentList();
  refreshLayerStyles();
  updateActionButtons();

  if (index === null || index < 0) {
    els.subtitle.textContent = 'Vælg et segment eller tegn et nyt';
    return;
  }

  els.subtitle.textContent = `Valgt: segment #${index + 1}`;

  if (panTo && state.editGroup) {
    let layer = null;
    let i = 0;
    state.editGroup.eachLayer((item) => {
      if (i === index) {
        layer = item;
      }
      i += 1;
    });
    if (layer) {
      state.map.fitBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 16 });
    }
  }
}

function updateActionButtons() {
  els.deleteSegment.disabled = state.selectedIndex === null || state.forestBoundary.length === 0;
}

function boundsToPolygon(bounds) {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return JSON.stringify([[
    [sw.lng, sw.lat],
    [ne.lng, sw.lat],
    [ne.lng, ne.lat],
    [sw.lng, ne.lat],
    [sw.lng, sw.lat],
  ]]);
}

function ensureMatrikelGroup() {
  if (state.matrikelGroup) {
    return state.matrikelGroup;
  }

  if (!state.map.getPane('matrikelPane')) {
    state.map.createPane('matrikelPane');
    state.map.getPane('matrikelPane').style.zIndex = 350;
  }

  state.matrikelGroup = L.geoJSON(null, {
    pane: 'matrikelPane',
    style: () => ({
      ...MATRIKEL_STYLE,
      interactive: state.parcelSelectMode,
    }),
    onEachFeature: bindMatrikelFeature,
  });

  return state.matrikelGroup;
}

function bindMatrikelFeature(feature, layer) {
  layer._jordstykkeFeature = feature;
  layer.options.pmIgnore = true;
  layer.options.snapIgnore = false;

  layer.on('click', (event) => {
    if (!state.parcelSelectMode) {
      return;
    }
    L.DomEvent.stopPropagation(event);
    toggleParcelSelection(layer);
  });

  layer.on('mouseover', () => {
    if (!state.parcelSelectMode) {
      return;
    }
    state.hoveredParcelLayer = layer;
    updateParcelLayerStyle(layer);
  });

  layer.on('mouseout', () => {
    if (state.hoveredParcelLayer === layer) {
      state.hoveredParcelLayer = null;
    }
    updateParcelLayerStyle(layer);
  });

  updateParcelLayerStyle(layer);
}

function attachMatrikelSnapTargets(pmInstance) {
  if (!pmInstance || !state.matrikelGroup || !state.matrikelEnabled) {
    return;
  }

  pmInstance._otherSnapLayers = pmInstance._otherSnapLayers || [];
  state.matrikelGroup.eachLayer((layer) => {
    layer.options.snapIgnore = false;
    if (!pmInstance._otherSnapLayers.includes(layer)) {
      pmInstance._otherSnapLayers.push(layer);
    }
  });

  if (typeof pmInstance._createSnapList === 'function') {
    pmInstance._createSnapList();
  }
}

function attachMatrikelSnapTargetsToEditLayers() {
  if (!state.editGroup) {
    return;
  }
  state.editGroup.eachLayer((layer) => {
    if (layer.pm) {
      attachMatrikelSnapTargets(layer.pm);
    }
  });
}

function updateParcelLayerStyle(layer) {
  if (!layer?.setStyle) {
    return;
  }
  layer.setStyle(getParcelStyle(layer));
}

function refreshAllParcelStyles() {
  if (!state.matrikelGroup) {
    return;
  }
  state.matrikelGroup.eachLayer(updateParcelLayerStyle);
}

function updateParcelSelectionUI() {
  const count = state.selectedParcelLayers.size;
  if (els.parcelSelectionInfo) {
    els.parcelSelectionInfo.textContent = `${count} jordstykke${count === 1 ? '' : 'r'} valgt`;
  }
  if (els.importParcels) {
    els.importParcels.disabled = count === 0;
  }
  if (els.clearParcelSelection) {
    els.clearParcelSelection.disabled = count === 0;
  }
}

function toggleParcelSelection(layer) {
  if (state.selectedParcelLayers.has(layer)) {
    state.selectedParcelLayers.delete(layer);
  } else {
    state.selectedParcelLayers.add(layer);
  }
  updateParcelLayerStyle(layer);
  updateParcelSelectionUI();
}

function clearParcelSelection() {
  state.selectedParcelLayers.clear();
  state.hoveredParcelLayer = null;
  refreshAllParcelStyles();
  updateParcelSelectionUI();
}

function importSelectedParcels() {
  if (state.selectedParcelLayers.size === 0) {
    return;
  }

  const newSegments = [];
  state.selectedParcelLayers.forEach((layer) => {
    const geometry = layer._jordstykkeFeature?.geometry;
    if (geometry) {
      newSegments.push(...geoJsonToSegments(geometry));
    }
  });

  if (newSegments.length === 0) {
    showStatus('Ingen brugbar geometri i valgte jordstykker.', 'error');
    return;
  }

  pushUndoSnapshot();
  newSegments.forEach((segment) => {
    state.forestBoundary.push(segment);
  });
  clearParcelSelection();
  rebuildEditableLayers();
  selectSegment(state.forestBoundary.length - newSegments.length, true);
  showStatus(`${newSegments.length} segment${newSegments.length === 1 ? '' : 'er'} importeret.`);
}

function setParcelSelectMode(enabled) {
  if (enabled && !state.matrikelEnabled) {
    if (els.toggleParcelSelect) {
      els.toggleParcelSelect.checked = false;
    }
    showStatus('Slå matrikelkort til først.', 'error');
    return;
  }

  state.parcelSelectMode = enabled;
  if (els.map) {
    els.map.classList.toggle('map-parcel-select', enabled);
  }

  if (!enabled) {
    clearParcelSelection();
  } else {
    refreshAllParcelStyles();
    showStatus('Klik på jordstykker for at vælge dem.');
  }
}

async function refreshMatrikelLayer() {
  if (!state.matrikelEnabled || !state.map) {
    return;
  }

  const zoom = state.map.getZoom();
  if (zoom < MIN_ZOOM_FOR_MATRIKEL) {
    if (state.matrikelGroup) {
      state.matrikelGroup.clearLayers();
    }
    clearParcelSelection();
    els.matrikelHint.textContent = `Zoom ind til niveau ${MIN_ZOOM_FOR_MATRIKEL}+ for at se jordstykker.`;
    els.matrikelHint.classList.remove('hidden');
    return;
  }

  els.matrikelHint.classList.add('hidden');

  const bounds = state.map.getBounds();
  const requestId = ++state.matrikelRequestId;
  const polygon = boundsToPolygon(bounds);
  const url = `https://api.dataforsyningen.dk/jordstykker?polygon=${encodeURIComponent(polygon)}&format=geojson&per_side=500`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Kunne ikke hente jordstykker.');
    }

    const geoJson = await response.json();
    if (requestId !== state.matrikelRequestId) {
      return;
    }

    const group = ensureMatrikelGroup();
    clearParcelSelection();
    group.clearLayers();
    group.addData(geoJson);

    if (!state.map.hasLayer(group)) {
      group.addTo(state.map);
    }

    group.bringToBack();
    attachMatrikelSnapTargetsToEditLayers();
  } catch (error) {
    if (requestId === state.matrikelRequestId) {
      showStatus(error.message, 'error');
    }
  }
}

function scheduleMatrikelRefresh() {
  clearTimeout(state.matrikelFetchTimer);
  state.matrikelFetchTimer = setTimeout(() => {
    refreshMatrikelLayer();
  }, 350);
}


function toggleMatrikel(checked) {
  state.matrikelEnabled = checked;

  if (checked) {
    els.matrikelHint.classList.add('hidden');
    scheduleMatrikelRefresh();
  } else {
    clearTimeout(state.matrikelFetchTimer);
    state.matrikelRequestId += 1;
    if (state.parcelSelectMode && els.toggleParcelSelect) {
      els.toggleParcelSelect.checked = false;
      setParcelSelectMode(false);
    }
    clearParcelSelection();
    if (state.matrikelGroup) {
      state.matrikelGroup.clearLayers();
      state.matrikelGroup.remove();
    }
    els.matrikelHint.classList.add('hidden');
  }
}

function geoJsonToSegments(geometry) {
  const segments = [];

  function addRing(ring) {
    if (!Array.isArray(ring) || ring.length < 3) {
      return;
    }
    segments.push(ring.map(([lng, lat]) => [lat, lng]));
  }

  if (!geometry || !geometry.type) {
    return segments;
  }

  if (geometry.type === 'Polygon') {
    addRing(geometry.coordinates[0]);
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach((polygon) => addRing(polygon[0]));
  }

  return segments;
}

function initMap() {
  if (typeof L === 'undefined') {
    throw new Error('Leaflet kunne ikke indlæses.');
  }
  if (!L.PM) {
    throw new Error('Leaflet-Geoman kunne ikke indlæses.');
  }

  state.map = L.map(els.map, {
    center: START_CENTER,
    zoom: START_ZOOM,
    zoomControl: true,
  });

  state.baseLayers = {
    Standard: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }),
    Topografisk: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: '&copy; OpenTopoMap',
    }),
    Satellit: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: '&copy; Esri',
    }),
  };

  state.baseLayers.Standard.addTo(state.map);
  L.control.layers(state.baseLayers, null, { collapsed: false, position: 'topright' }).addTo(state.map);

  state.map.on('baselayerchange', (event) => {
    els.map.classList.toggle('map-style-standard', event.name === 'Standard');
  });

  state.editGroup = L.featureGroup().addTo(state.map);

  state.map.pm.setGlobalOptions(SNAP_OPTIONS);

  state.map.pm.addControls({
    position: 'topleft',
    drawMarker: false,
    drawCircleMarker: false,
    drawPolyline: false,
    drawRectangle: false,
    drawCircle: false,
    drawText: false,
    cutPolygon: false,
    rotateMode: false,
    snappingOption: true,
  });

  state.map.on('pm:drawstart', (event) => {
    const drawTool = state.map.pm.Draw[event.shape];
    attachMatrikelSnapTargets(drawTool);
  });

  state.map.on('pm:globaleditmodetoggled', (event) => {
    if (event.enabled) {
      attachMatrikelSnapTargetsToEditLayers();
    }
  });

  state.map.on('pm:create', (event) => {
    pushUndoSnapshot();
    const layer = event.layer;
    bindLayerEvents(layer);
    state.editGroup.addLayer(layer);
    syncFromMap();
    selectSegment(state.forestBoundary.length - 1, false);
    refreshLayerStyles();
  });

  state.map.on('pm:remove', () => {
    pushUndoSnapshot();
    syncFromMap();
    refreshLayerStyles();
  });

  state.map.on('moveend zoomend', () => {
    if (state.matrikelEnabled) {
      scheduleMatrikelRefresh();
    }
  });
}

function fitMapToContent() {
  const bounds = L.latLngBounds([]);

  state.forestBoundary.forEach((segment) => {
    segment.forEach((coord) => bounds.extend(coord));
  });

  state.audioPoints.forEach((point) => {
    bounds.extend([point.lat, point.lng]);
  });

  if (bounds.isValid()) {
    state.map.fitBounds(bounds, { padding: [20, 20], maxZoom: 15 });
  }
}

function refreshMapSize() {
  if (state.map) {
    state.map.invalidateSize();
  }
}

function updateMatrikelHint() {
  els.matrikelHint.classList.add('hidden');
}

function loadInitialData() {
  const embedded = window.__INITIAL_DATA__ || {};
  state.forestBoundary = cloneBoundary(embedded.forestBoundary || []);
  state.audioPoints = embedded.audioPoints || [];

  updateMatrikelHint();
  updateParcelSelectionUI();

  rebuildEditableLayers();
  renderPointMarkers();
  fitMapToContent();

  requestAnimationFrame(() => {
    refreshMapSize();
    fitMapToContent();
    setTimeout(() => {
      refreshMapSize();
      fitMapToContent();
    }, 150);
  });
}

async function saveBoundary() {
  try {
    els.save.disabled = true;
    const result = await api('boundary.php', {
      method: 'POST',
      body: JSON.stringify({
        forestBoundary: state.forestBoundary,
      }),
    });
    state.forestBoundary = result.forestBoundary || state.forestBoundary;
    state.undoStack = [];
    els.undo.disabled = true;
    rebuildEditableLayers();
    showStatus('Grænse gemt.');
  } catch (error) {
    showStatus(error.message, 'error');
  } finally {
    els.save.disabled = false;
  }
}

function undoLastChange() {
  if (state.undoStack.length === 0) {
    return;
  }
  state.forestBoundary = state.undoStack.pop();
  els.undo.disabled = state.undoStack.length === 0;
  state.selectedIndex = null;
  rebuildEditableLayers();
  showStatus('Fortryd udført.');
}

function deleteSelectedSegment() {
  if (state.selectedIndex === null) {
    return;
  }

  const confirmed = window.confirm(`Slet segment #${state.selectedIndex + 1}?`);
  if (!confirmed) {
    return;
  }

  pushUndoSnapshot();
  state.forestBoundary.splice(state.selectedIndex, 1);
  state.selectedIndex = null;
  rebuildEditableLayers();
  showStatus('Segment slettet.');
}

els.save.addEventListener('click', saveBoundary);
els.undo.addEventListener('click', undoLastChange);
els.deleteSegment.addEventListener('click', deleteSelectedSegment);

els.toggleMatrikel.addEventListener('change', (event) => {
  toggleMatrikel(event.target.checked);
});

if (els.toggleParcelSelect) {
  els.toggleParcelSelect.addEventListener('change', (event) => {
    setParcelSelectMode(event.target.checked);
  });
}

if (els.importParcels) {
  els.importParcels.addEventListener('click', importSelectedParcels);
}

if (els.clearParcelSelection) {
  els.clearParcelSelection.addEventListener('click', clearParcelSelection);
}

els.toggleMask.addEventListener('change', () => {
  renderMask();
});

els.togglePoints.addEventListener('change', () => {
  renderPointMarkers();
});

try {
  initMap();
  loadInitialData();
} catch (error) {
  showLoadError(error.message);
  if (els.segmentCount) {
    els.segmentCount.textContent = 'Kunne ikke indlæse';
  }
}

window.addEventListener('resize', () => {
  refreshMapSize();
});
