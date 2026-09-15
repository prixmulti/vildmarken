const API_BASE = 'api';
let currentRange = '30';
let charts = {};

const els = {
  rangeButtons: document.querySelectorAll('[data-range]'),
  exportCsv: document.getElementById('btn-export-csv'),
  exportJson: document.getElementById('btn-export-json'),
  resetStats: document.getElementById('btn-reset-stats'),
  totalVisits: document.getElementById('stat-total-visits'),
  uniqueVisitors: document.getElementById('stat-unique-visitors'),
  totalListen: document.getElementById('stat-total-listen'),
  gpsVisits: document.getElementById('stat-gps-visits'),
  listenTableBody: document.getElementById('listen-table-body'),
  recentTableBody: document.getElementById('recent-table-body'),
  loadError: document.getElementById('load-error'),
};

async function api(url, options = {}) {
  const response = await fetch(`${API_BASE}/${url}`, {
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (response.status === 401) {
    window.location.href = 'login.php';
    throw new Error('Ikke logget ind.');
  }

  if (options.raw) {
    if (!response.ok) {
      throw new Error('Kunne ikke hente fil.');
    }
    return response;
  }

  const payload = await response.json();
  if (!payload.success) {
    throw new Error(payload.message || 'Kunne ikke hente data.');
  }

  return payload.data;
}

function exportUrl(format) {
  return `${API_BASE}/stats.php?range=${encodeURIComponent(currentRange)}&format=${encodeURIComponent(format)}`;
}

function triggerDownload(url) {
  const link = document.createElement('a');
  link.href = url;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function resetStats() {
  const confirmed = window.confirm(
    'Er du sikker? Al gemt statistik (besøg, lytning og GPS) slettes permanent.',
  );
  if (!confirmed) {
    return;
  }

  await api('stats.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'reset' }),
  });

  await loadStats();
}

function showError(message) {
  if (!els.loadError) {
    return;
  }
  els.loadError.classList.remove('hidden');
  els.loadError.querySelector('div').textContent = message;
}

function hideError() {
  if (!els.loadError) {
    return;
  }
  els.loadError.classList.add('hidden');
}

function formatDateTime(value) {
  try {
    return new Intl.DateTimeFormat('da-DK', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatDayLabel(value) {
  try {
    return new Intl.DateTimeFormat('da-DK', {
      day: 'numeric',
      month: 'short',
    }).format(new Date(`${value}T12:00:00`));
  } catch {
    return value;
  }
}

function deviceLabel(value) {
  switch (value) {
    case 'mobile':
      return 'Mobil';
    case 'tablet':
      return 'Tablet';
    case 'desktop':
      return 'Desktop';
    default:
      return value || 'Ukendt';
  }
}

function formatStartPoint(row) {
  if (!row.nearestPointTitle) {
    return 'Ingen GPS';
  }

  if (row.nearestDistanceM != null) {
    return `${row.nearestPointTitle} (${row.nearestDistanceM} m)`;
  }

  return row.nearestPointTitle;
}

function destroyCharts() {
  Object.values(charts).forEach((chart) => {
    if (chart) {
      chart.destroy();
    }
  });
  charts = {};
}

function renderCharts(data) {
  destroyCharts();

  const visitsCtx = document.getElementById('chart-visits');
  const devicesCtx = document.getElementById('chart-devices');
  const browsersCtx = document.getElementById('chart-browsers');

  const visitLabels = (data.visitsByDay || []).map((row) => formatDayLabel(row.day));
  const visitCounts = (data.visitsByDay || []).map((row) => row.count);

  if (visitsCtx) {
    charts.visits = new Chart(visitsCtx, {
      type: 'line',
      data: {
        labels: visitLabels,
        datasets: [{
          label: 'Besøg',
          data: visitCounts,
          borderColor: '#059669',
          backgroundColor: 'rgba(5, 150, 105, 0.12)',
          fill: true,
          tension: 0.35,
          pointRadius: 3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, ticks: { precision: 0 } },
        },
      },
    });
  }

  if (devicesCtx) {
    charts.devices = new Chart(devicesCtx, {
      type: 'doughnut',
      data: {
        labels: (data.devices || []).map((row) => deviceLabel(row.label)),
        datasets: [{
          data: (data.devices || []).map((row) => row.count),
          backgroundColor: ['#059669', '#0d9488', '#14b8a6', '#64748b'],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
      },
    });
  }

  if (browsersCtx) {
    charts.browsers = new Chart(browsersCtx, {
      type: 'bar',
      data: {
        labels: (data.browsers || []).map((row) => row.label),
        datasets: [{
          label: 'Besøg',
          data: (data.browsers || []).map((row) => row.count),
          backgroundColor: '#065f46',
          borderRadius: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, ticks: { precision: 0 } },
        },
      },
    });
  }
}

function renderListenTable(rows) {
  if (!els.listenTableBody) {
    return;
  }

  if (!rows.length) {
    els.listenTableBody.innerHTML = '<tr><td colspan="4" class="stats-empty">Ingen lytninger i perioden endnu.</td></tr>';
    return;
  }

  const maxSeconds = Math.max(...rows.map((row) => row.totalSeconds || 0), 1);

  els.listenTableBody.innerHTML = rows.map((row) => {
    const width = Math.max(6, Math.round(((row.totalSeconds || 0) / maxSeconds) * 100));
    return `
      <tr>
        <td>${row.title}</td>
        <td>${row.plays}</td>
        <td>
          <div class="listen-bar-cell">
            <span>${row.totalFormatted}</span>
            <div class="listen-bar-track"><div class="listen-bar-fill" style="width:${width}%"></div></div>
          </div>
        </td>
        <td>${row.avgFormatted}</td>
      </tr>
    `;
  }).join('');
}

function renderRecentTable(rows) {
  if (!els.recentTableBody) {
    return;
  }

  if (!rows.length) {
    els.recentTableBody.innerHTML = '<tr><td colspan="5" class="stats-empty">Ingen besøg i perioden endnu.</td></tr>';
    return;
  }

  els.recentTableBody.innerHTML = rows.map((row) => `
    <tr>
      <td>${formatDateTime(row.ts)}</td>
      <td>${formatStartPoint(row)}</td>
      <td>${deviceLabel(row.device)}</td>
      <td>${row.browser}</td>
      <td>${row.os}</td>
    </tr>
  `).join('');
}

function renderSummary(summary) {
  if (els.totalVisits) {
    els.totalVisits.textContent = String(summary.totalVisits ?? 0);
  }
  if (els.uniqueVisitors) {
    els.uniqueVisitors.textContent = String(summary.uniqueVisitors ?? 0);
  }
  if (els.totalListen) {
    els.totalListen.textContent = summary.totalListenFormatted || '0 sek';
  }
  if (els.gpsVisits) {
    els.gpsVisits.textContent = String(summary.gpsVisits ?? 0);
  }
}

async function loadStats() {
  hideError();

  els.rangeButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.range === currentRange);
  });

  try {
    const data = await api(`stats.php?range=${encodeURIComponent(currentRange)}`);
    renderSummary(data.summary || {});
    renderCharts(data);
    renderListenTable(data.listenStats || []);
    renderRecentTable(data.recentVisits || []);
  } catch (error) {
    showError(error.message || 'Kunne ikke hente statistik.');
  }
}

els.rangeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    currentRange = button.dataset.range || '30';
    loadStats();
  });
});

if (els.exportCsv) {
  els.exportCsv.addEventListener('click', () => {
    triggerDownload(exportUrl('csv'));
  });
}

if (els.exportJson) {
  els.exportJson.addEventListener('click', () => {
    triggerDownload(exportUrl('json'));
  });
}

if (els.resetStats) {
  els.resetStats.addEventListener('click', () => {
    resetStats().catch((error) => {
      showError(error.message || 'Kunne ikke nulstille statistik.');
    });
  });
}

loadStats();
