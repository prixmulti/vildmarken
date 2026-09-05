<?php

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/api/bootstrap.php';

if (session_status() === PHP_SESSION_NONE) {
  session_start();
}

if (empty($_SESSION['vildmarken_admin'])) {
  header('Location: login.php');
  exit;
}

$initialPoints = readPointsData();
$initialBoundary = readBoundaryData();
$initialAudioFiles = scanAudioFiles();
?>
<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nørholm Vildmark Admin</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css">
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css">
  <link rel="stylesheet" href="admin.css">
</head>
<body class="bg-[#f4f7f2] text-[#1a3a32]">
  <header class="bg-emerald-900 text-white shadow-lg">
    <div class="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between gap-4">
      <div class="flex items-center gap-3 min-w-0">
        <img src="https://naturaudio.dk/vildmarken/Norholm_Vildmark.png" alt="Nørholm Vildmark" class="h-10 w-auto shrink-0">
        <div class="min-w-0">
          <h1 class="text-lg font-black leading-tight truncate">Vildmarken Admin</h1>
          <p class="text-emerald-200/80 text-xs">Rediger lydpunkter</p>
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <a href="boundary.php" class="text-sm font-bold px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">Grænse-editor</a>
        <span id="status-badge" class="hidden text-xs font-bold px-3 py-1 rounded-full"></span>
        <a href="logout.php" class="text-sm font-bold px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">Log ud</a>
      </div>
    </div>
    <div id="load-error" class="hidden max-w-[1800px] mx-auto px-4 pb-3">
      <div class="rounded-xl bg-red-600 text-white text-sm font-medium px-4 py-3"></div>
    </div>
  </header>

  <main class="w-full mx-auto p-3 lg:p-4">
    <div class="admin-grid grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_340px] gap-3 lg:gap-4">
      <section class="bg-white rounded-[1.5rem] shadow-sm border border-stone-200 overflow-hidden flex flex-col admin-panel">
        <div class="px-3 py-2 border-b border-stone-100 flex items-center justify-between gap-2">
          <div>
            <h2 class="font-black text-[#1a3a32] text-sm">Punkter</h2>
            <p id="point-count" class="text-[11px] text-stone-500">Indlæser…</p>
          </div>
          <button id="btn-new" type="button" class="px-3 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition-colors shrink-0">
            + Nyt
          </button>
        </div>
        <div id="point-list" class="flex-1 overflow-y-auto"></div>
      </section>

      <section class="bg-white rounded-[1.5rem] shadow-sm border border-stone-200 overflow-hidden flex flex-col admin-panel map-panel">
        <div class="px-4 py-3 border-b border-stone-100 flex items-start justify-between gap-3">
          <div>
            <h2 class="font-black text-[#1a3a32]">Kort</h2>
            <p class="text-xs text-stone-500">Grønt område = Vildmarken. Skift kortlag oppe til højre for mere naturdetalje.</p>
          </div>
        </div>
        <div id="map" class="map-container map-style-standard"></div>
      </section>

      <section class="bg-white rounded-[1.5rem] shadow-sm border border-stone-200 overflow-hidden flex flex-col admin-panel">
        <div class="px-4 py-3 border-b border-stone-100">
          <h2 class="font-black text-[#1a3a32]">Rediger punkt</h2>
          <p id="editor-subtitle" class="text-xs text-stone-500">Vælg et punkt på kortet</p>
        </div>

        <form id="point-form" class="p-4 space-y-4 flex-1 overflow-y-auto">
          <input type="hidden" id="point-id" value="">

          <div>
            <label for="point-title" class="field-label">Titel</label>
            <input id="point-title" type="text" required class="field-input" placeholder="Punktets overskrift">
          </div>

          <div>
            <label for="point-description" class="field-label">Beskrivelse</label>
            <textarea id="point-description" rows="6" required class="field-input resize-y min-h-[120px]" placeholder="Tekst der vises i lydguiden"></textarea>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="point-category" class="field-label">Kategori</label>
              <select id="point-category" class="field-input">
                <option value="Historie">Historie</option>
                <option value="Natur">Natur</option>
                <option value="Rewild">Rewild</option>
              </select>
            </div>
            <div class="lg:col-span-1">
              <label for="point-audio" class="field-label">Lydfil</label>
              <div class="audio-picker">
                <select id="point-audio" class="field-input audio-select"></select>
                <button type="button" id="btn-audio-play" class="audio-play-btn" title="Afspil lydfil" disabled aria-label="Afspil lydfil">
                  <svg class="icon-play" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><polygon points="8 5 19 12 8 19 8 5"></polygon></svg>
                  <svg class="icon-pause hidden" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><rect x="7" y="5" width="4" height="14"></rect><rect x="13" y="5" width="4" height="14"></rect></svg>
                </button>
              </div>
            </div>
          </div>

          <audio id="audio-preview" preload="none"></audio>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="point-lat" class="field-label">Breddegrad</label>
              <input id="point-lat" type="number" step="any" required class="field-input">
            </div>
            <div>
              <label for="point-lng" class="field-label">Længdegrad</label>
              <input id="point-lng" type="number" step="any" required class="field-input">
            </div>
          </div>

          <div class="flex flex-wrap gap-2 pt-2">
            <button id="btn-save" type="submit" class="flex-1 min-w-[120px] px-4 py-3 rounded-xl bg-[#1a3a32] text-white font-bold hover:bg-emerald-900 transition-colors disabled:opacity-40" disabled>
              Gem
            </button>
            <button id="btn-delete" type="button" class="px-4 py-3 rounded-xl bg-red-50 text-red-700 font-bold hover:bg-red-100 transition-colors disabled:opacity-40" disabled>
              Slet
            </button>
          </div>
        </form>
      </section>
    </div>
  </main>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
  <script>
    window.__INITIAL_DATA__ = <?= json_encode([
      'audioPoints' => $initialPoints['audioPoints'] ?? [],
      'forestBoundary' => $initialBoundary['forestBoundary'] ?? [],
      'audioFiles' => $initialAudioFiles,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
  </script>
  <script src="admin.js"></script>
</body>
</html>
