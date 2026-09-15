<?php

require_once dirname(__DIR__) . '/admin/api/data-store.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok' => false, 'error' => 'Metoden understøttes ikke.'], JSON_UNESCAPED_UNICODE);
  exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Ugyldigt JSON.'], JSON_UNESCAPED_UNICODE);
  exit;
}

$type = trim((string) ($input['type'] ?? ''));

try {
  if ($type === 'visit') {
    recordAnalyticsVisit($input);
  } elseif ($type === 'listen') {
    recordAnalyticsListen($input);
  } elseif ($type === 'location') {
    recordAnalyticsLocation($input);
  } else {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Ukendt event-type.'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (InvalidArgumentException $e) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
} catch (RuntimeException $e) {
  http_response_code(429);
  echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Kunne ikke gemme statistik.'], JSON_UNESCAPED_UNICODE);
}
