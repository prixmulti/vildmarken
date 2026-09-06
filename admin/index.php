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
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.css">
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
    <div class="admin-grid grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_460px] gap-3 lg:gap-4">
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

      <section class="editor-panel bg-white rounded-[1.5rem] shadow-sm border border-stone-200 overflow-hidden flex flex-col admin-panel">
        <div class="editor-panel-header px-5 py-4 border-b border-stone-100">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="font-black text-[#1a3a32] text-lg">Rediger punkt</h2>
              <p id="editor-subtitle" class="text-sm text-stone-500 mt-0.5">Vælg et punkt på kortet</p>
            </div>
            <span id="editor-point-badge" class="editor-point-badge hidden">#0</span>
          </div>
        </div>

        <form id="point-form" class="editor-form flex-1 overflow-y-auto">
          <input type="hidden" id="point-id" value="">
          <input type="hidden" id="point-audio-src" value="">

          <div class="editor-section">
            <h3 class="editor-section-title">Grunddata</h3>
            <div class="editor-fields">
              <div>
                <label for="point-title" class="field-label">Titel</label>
                <input id="point-title" type="text" required class="field-input" placeholder="Punktets overskrift">
              </div>

              <div>
                <label for="point-description" class="field-label">Beskrivelse</label>
                <textarea id="point-description" rows="5" required class="field-input resize-y min-h-[110px]" placeholder="Tekst der vises i lydguiden"></textarea>
              </div>

              <div>
                <label for="point-category" class="field-label">Kategori</label>
                <select id="point-category" class="field-input">
                  <option value="Historie">Historie</option>
                  <option value="Natur">Natur</option>
                  <option value="Rewild">Rewild</option>
                </select>
              </div>
            </div>
          </div>

          <div class="editor-section">
            <h3 class="editor-section-title">Medier</h3>
            <p class="editor-section-desc">Hvert punkt har sin egen lydfil og ét billede i bredformat.</p>

            <div class="media-grid">
              <div class="media-card media-card-audio">
                <div class="media-card-head">
                  <div class="media-card-icon media-card-icon-audio" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                  </div>
                  <div>
                    <p class="media-card-label">Lydfil</p>
                    <p class="media-card-hint">MP3 · max 20 MB</p>
                  </div>
                </div>

                <div id="audio-panel-idle" class="media-empty">
                  Vælg et punkt for at administrere lydfil.
                </div>

                <div id="audio-panel-locked" class="media-empty hidden">
                  Gem punktet først — derefter kan du tilknytte en lydfil.
                </div>

                <div id="audio-panel-attached" class="media-attached hidden">
                  <div class="media-attached-main">
                    <div class="media-attached-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                    </div>
                    <div class="media-attached-meta">
                      <span class="media-attached-badge">Aktiv lydfil</span>
                      <p id="audio-attached-name" class="media-attached-name">fil.mp3</p>
                    </div>
                    <button type="button" id="btn-audio-play" class="media-icon-btn" title="Afspil" disabled aria-label="Afspil lydfil">
                      <svg class="icon-play" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><polygon points="8 5 19 12 8 19 8 5"></polygon></svg>
                      <svg class="icon-pause hidden" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><rect x="7" y="5" width="4" height="14"></rect><rect x="13" y="5" width="4" height="14"></rect></svg>
                    </button>
                  </div>
                  <div class="media-attached-actions">
                    <button type="button" id="btn-audio-replace" class="media-text-btn">Udskift lydfil</button>
                    <button type="button" id="btn-point-audio-remove" class="media-text-btn danger">Fjern</button>
                  </div>
                </div>

                <div id="audio-panel-upload" class="media-upload hidden">
                  <input id="point-audio-file" type="file" accept=".mp3,audio/mpeg" class="sr-only">
                  <button type="button" id="btn-audio-pick" class="media-dropzone">
                    <span class="media-dropzone-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"></path></svg>
                    </span>
                    <span id="audio-dropzone-title" class="media-dropzone-title">Vælg lydfil</span>
                    <span id="audio-dropzone-sub" class="media-dropzone-sub">Klik for at vælge MP3</span>
                  </button>
                  <button type="button" id="btn-audio-replace-cancel" class="media-text-btn media-replace-cancel hidden">Behold nuværende fil</button>
                </div>

                <div id="audio-panel-pending" class="media-pending hidden">
                  <div class="media-pending-info">
                    <span class="media-pending-label">Klar til upload</span>
                    <p id="audio-pending-name" class="media-pending-name">fil.mp3</p>
                  </div>
                  <div class="media-pending-actions">
                    <button type="button" id="btn-point-audio-upload" class="media-btn primary">Upload lydfil</button>
                    <button type="button" id="btn-audio-cancel" class="media-btn">Annuller</button>
                  </div>
                </div>
              </div>

              <div class="media-card media-card-image">
                <div class="media-card-head">
                  <div class="media-card-icon media-card-icon-image" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"></rect><circle cx="9" cy="10" r="1.5"></circle><path d="m3 16 5-5 4 4 3-3 6 6"></path></svg>
                  </div>
                  <div>
                    <p class="media-card-label">Billede</p>
                    <p class="media-card-hint">JPEG · 16:9 · max 1200px bred</p>
                  </div>
                </div>

                <div id="image-panel-idle" class="media-empty">
                  Vælg et punkt for at administrere billede.
                </div>

                <div id="image-panel-locked" class="media-empty hidden">
                  Gem punktet først — derefter kan du uploade billede.
                </div>

                <div id="image-panel-attached" class="media-attached hidden">
                  <div class="media-image-preview-wrap">
                    <img id="image-attached-preview" class="media-image-preview" alt="Aktivt punktbillede">
                  </div>
                  <div class="media-attached-actions">
                    <button type="button" id="btn-image-replace" class="media-text-btn">Udskift billede</button>
                    <button type="button" id="btn-point-image-remove" class="media-text-btn danger">Fjern</button>
                  </div>
                </div>

                <div id="image-panel-upload" class="media-upload hidden">
                  <input id="point-image-file" type="file" accept="image/jpeg,image/png,image/webp" class="sr-only">
                  <button type="button" id="btn-image-pick" class="media-dropzone">
                    <span class="media-dropzone-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"></path></svg>
                    </span>
                    <span id="image-dropzone-title" class="media-dropzone-title">Vælg billede</span>
                    <span id="image-dropzone-sub" class="media-dropzone-sub">Beskær og upload i ét trin</span>
                  </button>
                  <button type="button" id="btn-image-replace-cancel" class="media-text-btn media-replace-cancel hidden">Behold nuværende billede</button>
                </div>
              </div>
            </div>

            <audio id="audio-preview" preload="none"></audio>
          </div>

          <div class="editor-section">
            <h3 class="editor-section-title">Placering</h3>
            <div class="editor-fields editor-fields-coords">
              <div>
                <label for="point-lat" class="field-label">Breddegrad</label>
                <input id="point-lat" type="number" step="any" required class="field-input field-input-mono">
              </div>
              <div>
                <label for="point-lng" class="field-label">Længdegrad</label>
                <input id="point-lng" type="number" step="any" required class="field-input field-input-mono">
              </div>
            </div>
          </div>

          <div class="editor-actions">
            <button id="btn-save" type="submit" class="editor-btn editor-btn-primary" disabled>
              Gem ændringer
            </button>
            <button id="btn-delete" type="button" class="editor-btn editor-btn-danger" disabled>
              Slet punkt
            </button>
          </div>
        </form>
      </section>
    </div>
  </main>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.js"></script>
  <script>
    window.__INITIAL_DATA__ = <?= json_encode([
      'audioPoints' => $initialPoints['audioPoints'] ?? [],
      'forestBoundary' => $initialBoundary['forestBoundary'] ?? [],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
  </script>
  <script src="image-crop.js"></script>
  <script src="admin.js"></script>
</body>
</html>
