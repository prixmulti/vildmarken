<?php

require_once __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
  requireAuth();

  $input = json_decode(file_get_contents('php://input'), true);
  if (!is_array($input)) {
    respond(false, null, 'Ugyldigt JSON.', 400);
  }

  $action = trim((string) ($input['action'] ?? ''));
  if ($action !== 'reset') {
    respond(false, null, 'Ukendt handling.', 400);
  }

  try {
    resetAnalyticsData();
    respond(true, null, 'Al statistik er nulstillet.');
  } catch (Throwable $e) {
    respond(false, null, 'Kunne ikke nulstille statistik.', 500);
  }
}

if ($method !== 'GET') {
  respond(false, null, 'Metoden understøttes ikke.', 405);
}

requireAuth();

$range = trim((string) ($_GET['range'] ?? '30'));
$allowed = ['7', '30', '90', 'all'];
if (!in_array($range, $allowed, true)) {
  $range = '30';
}

$format = strtolower(trim((string) ($_GET['format'] ?? '')));

try {
  if ($format === 'csv') {
    $export = buildAnalyticsExportPayload($range);
    $csv = analyticsStatsToCsv($export);
    $filename = analyticsExportFilename($range, 'csv');

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: no-store');
    echo $csv;
    exit;
  }

  if ($format === 'json') {
    $export = buildAnalyticsExportPayload($range);
    $filename = analyticsExportFilename($range, 'json');

    header('Content-Type: application/json; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: no-store');
    echo json_encode($export, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
  }

  $stats = aggregateAnalyticsStats($range);
  respond(true, $stats);
} catch (Throwable $e) {
  respond(false, null, 'Kunne ikke hente statistik.', 500);
}
