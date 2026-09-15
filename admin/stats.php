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
?>
<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Statistik — Nørholm Vildmark Admin</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <link rel="stylesheet" href="admin.css">
  <link rel="stylesheet" href="stats.css">
</head>
<body class="bg-[#f4f7f2] text-[#1a3a32]">
  <header class="bg-emerald-900 text-white shadow-lg">
    <div class="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between gap-4">
      <div class="flex items-center gap-3 min-w-0">
        <img src="https://naturaudio.dk/vildmarken/Norholm_Vildmark.png" alt="Nørholm Vildmark" class="h-10 w-auto shrink-0">
        <div class="min-w-0">
          <h1 class="text-lg font-black leading-tight truncate">Statistik</h1>
          <p class="text-emerald-200/80 text-xs">Besøg og lytning i lydguiden</p>
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <a href="index.php" class="text-sm font-bold px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">Lydpunkter</a>
        <a href="boundary.php" class="text-sm font-bold px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">Grænse-editor</a>
        <a href="logout.php" class="text-sm font-bold px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">Log ud</a>
      </div>
    </div>
    <div id="load-error" class="hidden max-w-[1800px] mx-auto px-4 pb-3">
      <div class="rounded-xl bg-red-600 text-white text-sm font-medium px-4 py-3"></div>
    </div>
  </header>

  <main class="stats-page p-3 lg:p-4">
    <div class="stats-toolbar">
      <div>
        <h2 class="text-xl font-black text-[#1a3a32]">Besøgsstatistik</h2>
        <p class="text-sm text-stone-500 mt-1">Anonymiserede besøg fra lydguide-appen med enhed, browser og lytte-tid pr. punkt.</p>
      </div>
      <div class="stats-toolbar-actions">
        <div class="stats-range" aria-label="Vælg periode">
          <button type="button" data-range="7">7 dage</button>
          <button type="button" data-range="30" class="is-active">30 dage</button>
          <button type="button" data-range="90">90 dage</button>
          <button type="button" data-range="all">Alt</button>
        </div>
        <div class="stats-action-group">
          <button type="button" id="btn-export-csv" class="stats-action-btn">Eksporter CSV</button>
          <button type="button" id="btn-export-json" class="stats-action-btn">Eksporter JSON</button>
          <button type="button" id="btn-reset-stats" class="stats-action-btn stats-action-btn-danger">Nulstil statistik</button>
        </div>
      </div>
    </div>

    <div class="stats-grid">
      <section class="stats-cards">
        <article class="stat-card">
          <div class="stat-card-label">Besøg</div>
          <div id="stat-total-visits" class="stat-card-value">0</div>
          <div class="stat-card-sub">App-sessioner i perioden</div>
        </article>
        <article class="stat-card">
          <div class="stat-card-label">Unikke besøgende</div>
          <div id="stat-unique-visitors" class="stat-card-value">0</div>
          <div class="stat-card-sub">Anonymiseret IP-hash</div>
        </article>
        <article class="stat-card">
          <div class="stat-card-label">Lytte-tid</div>
          <div id="stat-total-listen" class="stat-card-value">0 sek</div>
          <div class="stat-card-sub">Samlet afspilning i perioden</div>
        </article>
        <article class="stat-card">
          <div class="stat-card-label">GPS-besøg</div>
          <div id="stat-gps-visits" class="stat-card-value">0</div>
          <div class="stat-card-sub">Besøgende der aktiverede GPS</div>
        </article>
      </section>

      <section class="stats-charts stats-charts-three">
        <article class="stats-panel">
          <h2>Besøg pr. dag</h2>
          <div class="chart-wrap">
            <canvas id="chart-visits"></canvas>
          </div>
        </article>
        <article class="stats-panel">
          <h2>Enheder</h2>
          <div class="chart-wrap chart-wrap-sm">
            <canvas id="chart-devices"></canvas>
          </div>
        </article>
        <article class="stats-panel">
          <h2>Browsere</h2>
          <div class="chart-wrap chart-wrap-sm">
            <canvas id="chart-browsers"></canvas>
          </div>
        </article>
      </section>

      <section class="stats-panel stats-panel-wide">
        <h2>Lytning pr. lydpunkt</h2>
        <p class="stats-panel-note">Total lytte-tid og antal afspilninger — søjlerne viser samme tal som kolonnen «Total tid».</p>
        <div class="stats-table-wrap">
          <table class="stats-table">
            <thead>
              <tr>
                <th>Punkt</th>
                <th>Afspilninger</th>
                <th>Total tid</th>
                <th>Gns. pr. afspilning</th>
              </tr>
            </thead>
            <tbody id="listen-table-body">
              <tr><td colspan="4" class="stats-empty">Indlæser…</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="stats-panel stats-panel-wide">
        <h2>Seneste besøg</h2>
        <div class="stats-table-wrap">
          <table class="stats-table">
            <thead>
              <tr>
                <th>Tidspunkt</th>
                <th>Startpunkt</th>
                <th>Enhed</th>
                <th>Browser</th>
                <th>OS</th>
              </tr>
            </thead>
            <tbody id="recent-table-body">
              <tr><td colspan="5" class="stats-empty">Indlæser…</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </main>

  <script src="stats.js"></script>
</body>
</html>
