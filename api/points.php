<?php

require_once dirname(__DIR__) . '/admin/api/data-store.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=60');

try {
  $data = readPointsData(false);
  echo json_encode([
    'audioPoints' => $data['audioPoints'],
  ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['error' => 'Kunne ikke hente punkter.'], JSON_UNESCAPED_UNICODE);
}
