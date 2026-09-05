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

$initialBoundary = readBoundaryData();
$initialPoints = readPointsData();
?>
<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Grænse-editor — Nørholm Vildmark Admin</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <link rel="stylesheet" href="https://unpkg.com/@geoman-io/leaflet-geoman-free@2.18.3/dist/leaflet-geoman.css">
  <link rel="stylesheet" href="admin.css">
  <link rel="stylesheet" href="boundary.css">
</head>
<body class="bg-[#f4f7f2] text-[#1a3a32]">
  <header class="bg-emerald-900 text-white shadow-lg">
    <div class="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between gap-4">
      <div class="flex items-center gap-3 min-w-0">
        <img src="https://naturaudio.dk/vildmarken/Norholm_Vildmark.png" alt="Nørholm Vildmark" class="h-10 w-auto shrink-0">
        <div class="min-w-0">
          <h1 class="text-lg font-black leading-tight truncate">Grænse-editor</h1>
          <p class="text-emerald-200/80 text-xs">Rediger Vildmarkens område</p>
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <a href="index.php" class="text-sm font-bold px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">Lydpunkter</a>
        <span id="status-badge" class="hidden text-xs font-bold px-3 py-1 rounded-full"></span>
        <a href="logout.php" class="text-sm font-bold px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">Log ud</a>
      </div>
    </div>
    <div id="load-error" class="hidden max-w-[1800px] mx-auto px-4 pb-3">
      <div class="rounded-xl bg-red-600 text-white text-sm font-medium px-4 py-3"></div>
    </div>
  </header>

  <main class="w-full mx-auto p-3 lg:p-4">
    <div class="admin-grid grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_300px] gap-3 lg:gap-4">
      <section class="bg-white rounded-[1.5rem] shadow-sm border border-stone-200 overflow-hidden flex flex-col admin-panel">
        <div class="px-3 py-2 border-b border-stone-100">
          <h2 class="font-black text-[#1a3a32] text-sm">Segmenter</h2>
          <p id="segment-count" class="text-[11px] text-stone-500">Indlæser…</p>
        </div>
        <div id="segment-list" class="flex-1 overflow-y-auto"></div>
      </section>

      <section class="bg-white rounded-[1.5rem] shadow-sm border border-stone-200 overflow-hidden flex flex-col admin-panel map-panel">
        <div class="px-4 py-3 border-b border-stone-100 flex items-start justify-between gap-3">
          <div>
            <h2 class="font-black text-[#1a3a32]">Kort</h2>
            <p class="text-xs text-stone-500">Tegn polygoner med værktøjerne øverst til venstre. Grønt = Vildmarken.</p>
          </div>
        </div>
        <div id="map" class="map-container map-style-standard"></div>
      </section>

      <section class="bg-white rounded-[1.5rem] shadow-sm border border-stone-200 overflow-hidden flex flex-col admin-panel">
        <div class="px-4 py-3 border-b border-stone-100">
          <h2 class="font-black text-[#1a3a32]">Handlinger</h2>
          <p id="editor-subtitle" class="text-xs text-stone-500">Vælg et segment eller tegn et nyt</p>
        </div>

        <div class="p-4 space-y-4 flex-1 overflow-y-auto">
          <div class="space-y-2">
            <label class="toggle-row">
              <input id="toggle-matrikel" type="checkbox">
              <span>Matrikelkort (jordstykker)</span>
            </label>
            <label class="toggle-row">
              <input id="toggle-click-import" type="checkbox">
              <span>Klik for at importere jordstykke</span>
            </label>
            <label class="toggle-row">
              <input id="toggle-mask" type="checkbox" checked>
              <span>Preview-maske (som appen)</span>
            </label>
            <label class="toggle-row">
              <input id="toggle-points" type="checkbox" checked>
              <span>Vis lydpunkter</span>
            </label>
          </div>

          <p id="matrikel-hint" class="text-[11px] text-stone-500 leading-relaxed hidden">
            Zoom ind til niveau 14+ for at se jordstykker.
          </p>

          <div class="flex flex-col gap-2 pt-2">
            <button id="btn-save" type="button" class="w-full px-4 py-3 rounded-xl bg-[#1a3a32] text-white font-bold hover:bg-emerald-900 transition-colors">
              Gem grænse
            </button>
            <button id="btn-undo" type="button" class="w-full px-4 py-3 rounded-xl bg-stone-100 text-[#1a3a32] font-bold hover:bg-stone-200 transition-colors disabled:opacity-40" disabled>
              Fortryd
            </button>
            <button id="btn-delete-segment" type="button" class="w-full px-4 py-3 rounded-xl bg-red-50 text-red-700 font-bold hover:bg-red-100 transition-colors disabled:opacity-40" disabled>
              Slet valgt segment
            </button>
          </div>

          <div class="rounded-xl bg-stone-50 border border-stone-100 p-3 text-[11px] text-stone-600 leading-relaxed">
            <p class="font-bold text-stone-700 mb-1">Tip</p>
            <ul class="list-disc pl-4 space-y-1">
              <li>Hvert polygon = ét segment i grænsen</li>
              <li>Slå matrikel til og zoom ind for at se jordstykker</li>
              <li>Slå klik-import til og klik på et jordstykke</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  </main>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/@geoman-io/leaflet-geoman-free@2.18.3/dist/leaflet-geoman.min.js"></script>
  <script>
    window.__INITIAL_DATA__ = <?= json_encode([
      'forestBoundary' => $initialBoundary['forestBoundary'] ?? [],
      'audioPoints' => $initialPoints['audioPoints'] ?? [],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
  </script>
  <script src="boundary.js"></script>
</body>
</html>
