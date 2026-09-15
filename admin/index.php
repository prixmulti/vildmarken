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
        <a href="stats.php" class="text-sm font-bold px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">Statistik</a>
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
        <div class="editor-panel-header px-4 py-2.5 border-b border-stone-100">
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0">
              <h2 class="font-black text-[#1a3a32] text-base leading-tight">Rediger punkt</h2>
              <p id="editor-subtitle" class="text-xs text-stone-500 truncate">Vælg et punkt på kortet</p>
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
              <div class="editor-fields-row-2">
                <div class="editor-field-grow">
                  <label for="point-title" class="field-label">Titel</label>
                  <input id="point-title" type="text" required class="field-input field-input-compact" placeholder="Punktets overskrift">
                </div>
                <div class="editor-field-category">
                  <label for="point-category" class="field-label">Kategori</label>
                  <select id="point-category" class="field-input field-input-compact">
                    <option value="Historie">Historie</option>
                    <option value="Natur">Natur</option>
                    <option value="Rewild">Rewild</option>
                  </select>
                </div>
              </div>

              <div>
                <label for="point-description" class="field-label">Beskrivelse</label>
                <textarea id="point-description" rows="3" required class="field-input field-input-compact resize-y min-h-[72px]" placeholder="Tekst der vises i lydguiden"></textarea>
              </div>

              <div class="editor-fields-coords">
                <div>
                  <label for="point-lat" class="field-label">Breddegrad</label>
                  <input id="point-lat" type="number" step="any" required class="field-input field-input-compact field-input-mono">
                </div>
                <div>
                  <label for="point-lng" class="field-label">Længdegrad</label>
                  <input id="point-lng" type="number" step="any" required class="field-input field-input-compact field-input-mono">
                </div>
              </div>
            </div>
          </div>

          <div class="editor-section">
            <h3 class="editor-section-title">Medier</h3>

            <div class="media-grid media-grid-compact">
              <div class="media-card media-card-audio media-card-compact">
                <p class="media-card-label media-card-label-inline">Lydfil <span class="media-card-hint">· MP3</span></p>

                <div id="audio-panel-idle" class="media-empty">
                  Vælg et punkt for at administrere lydfil.
                </div>

                <div id="audio-panel-locked" class="media-empty hidden">
                  Gem punktet først — derefter kan du tilknytte en lydfil.
                </div>

                <div id="audio-panel-attached" class="media-attached media-attached-compact hidden">
                  <div class="media-attached-main media-attached-main-compact">
                    <button type="button" id="btn-audio-play" class="media-icon-btn media-icon-btn-sm" title="Afspil" disabled aria-label="Afspil lydfil">
                      <svg class="icon-play" viewBox="0 0 24 24" aria-hidden="true"><polygon points="8 5 19 12 8 19 8 5"></polygon></svg>
                      <svg class="icon-pause" viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="5" width="4" height="14"></rect><rect x="13" y="5" width="4" height="14"></rect></svg>
                    </button>
                    <p id="audio-attached-name" class="media-attached-name media-attached-name-compact">fil.mp3</p>
                  </div>
                  <div class="media-attached-actions media-attached-actions-inline media-attached-actions-audio">
                    <button type="button" id="btn-audio-replace" class="media-text-btn">Udskift</button>
                    <button type="button" id="btn-point-audio-remove" class="media-text-btn danger">Fjern</button>
                  </div>
                </div>

                <div id="audio-panel-upload" class="media-upload hidden">
                  <input id="point-audio-file" type="file" accept=".mp3,audio/mpeg" class="sr-only">
                  <button type="button" id="btn-audio-pick" class="media-dropzone">
                    <span class="media-dropzone-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"></path></svg>
                    </span>
                    <span class="media-dropzone-copy">
                      <span id="audio-dropzone-title" class="media-dropzone-title">Vælg lydfil</span>
                      <span id="audio-dropzone-sub" class="media-dropzone-sub">MP3</span>
                    </span>
                  </button>
                  <button type="button" id="btn-audio-replace-cancel" class="media-text-btn media-replace-cancel hidden">Behold nuværende fil</button>
                </div>
              </div>

              <div class="media-card media-card-image media-card-compact">
                <p class="media-card-label media-card-label-inline">Billede <span class="media-card-hint">· 16:9 JPEG</span></p>

                <div id="image-panel-idle" class="media-empty">
                  Vælg et punkt for at administrere billede.
                </div>

                <div id="image-panel-locked" class="media-empty hidden">
                  Gem punktet først — derefter kan du uploade billede.
                </div>

                <div id="image-panel-attached" class="media-attached media-attached-compact hidden">
                  <div class="media-image-preview-wrap media-image-preview-wrap-compact">
                    <img id="image-attached-preview" class="media-image-preview media-image-preview-compact" alt="Aktivt punktbillede">
                  </div>
                  <p id="image-attached-name" class="media-attached-name media-attached-name-compact media-image-attached-name"></p>
                  <div class="media-attached-actions media-attached-actions-inline media-attached-actions-image">
                    <button type="button" id="btn-image-replace" class="media-text-btn">Udskift</button>
                    <button type="button" id="btn-point-image-remove" class="media-text-btn danger">Fjern</button>
                  </div>
                </div>

                <div id="image-panel-upload" class="media-upload hidden">
                  <input id="point-image-file" type="file" accept="image/jpeg,image/png,image/webp" class="sr-only">
                  <button type="button" id="btn-image-pick" class="media-dropzone">
                    <span class="media-dropzone-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"></path></svg>
                    </span>
                    <span class="media-dropzone-copy">
                      <span id="image-dropzone-title" class="media-dropzone-title">Vælg billede</span>
                      <span id="image-dropzone-sub" class="media-dropzone-sub">Crop + upload</span>
                    </span>
                  </button>
                  <button type="button" id="btn-image-replace-cancel" class="media-text-btn media-replace-cancel hidden">Behold nuværende billede</button>
                </div>
              </div>
            </div>

            <audio id="audio-preview" preload="none"></audio>
          </div>

          <div class="editor-actions editor-actions-sticky">
            <p id="editor-unsaved-hint" class="editor-unsaved-hint hidden" role="status">
              Du har ændringer, der ikke er gemt
            </p>
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
