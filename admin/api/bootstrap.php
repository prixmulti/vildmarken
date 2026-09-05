<?php

require_once dirname(__DIR__) . '/config.php';

if (session_status() === PHP_SESSION_NONE) {
  session_start();
}

function respond(bool $success, $data = null, string $message = '', int $status = 200): void
{
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode([
    'success' => $success,
    'data' => $data,
    'message' => $message,
  ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

function requireAuth(): void
{
  if (empty($_SESSION['vildmarken_admin'])) {
    respond(false, null, 'Ikke logget ind.', 401);
  }
}

function readPointsData(): array
{
  if (!file_exists(DATA_FILE)) {
    return [
      'version' => 1,
      'updatedAt' => date('c'),
      'audioPoints' => [],
    ];
  }

  $raw = file_get_contents(DATA_FILE);
  $data = json_decode($raw, true);
  if (!is_array($data)) {
    respond(false, null, 'Kunne ikke læse points.json.', 500);
  }

  if (!isset($data['audioPoints']) || !is_array($data['audioPoints'])) {
    $data['audioPoints'] = [];
  }

  return $data;
}

function writePointsData(array $data): void
{
  $dataDir = dirname(DATA_FILE);
  if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
  }

  $data['version'] = 1;
  $data['updatedAt'] = date('c');

  $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  if ($json === false) {
    respond(false, null, 'Kunne ikke serialisere data.', 500);
  }

  $tmpFile = DATA_FILE . '.tmp';
  if (file_put_contents($tmpFile, $json . "\n", LOCK_EX) === false) {
    respond(false, null, 'Kunne ikke skrive midlertidig fil.', 500);
  }

  if (!rename($tmpFile, DATA_FILE)) {
    @unlink($tmpFile);
    respond(false, null, 'Kunne ikke gemme points.json.', 500);
  }
}

function validCategories(): array
{
  return ['Historie', 'Natur', 'Rewild'];
}

function validatePointInput(array $input, bool $requireAll = true): array
{
  $title = trim((string) ($input['title'] ?? ''));
  $description = trim((string) ($input['description'] ?? ''));
  $audioSrc = trim((string) ($input['audioSrc'] ?? ''));
  $category = trim((string) ($input['category'] ?? ''));
  $lat = $input['lat'] ?? null;
  $lng = $input['lng'] ?? null;

  if ($requireAll && ($title === '' || $description === '' || $audioSrc === '' || $category === '')) {
    respond(false, null, 'Udfyld titel, beskrivelse, kategori og lydfil.');
  }

  if ($category !== '' && !in_array($category, validCategories(), true)) {
    respond(false, null, 'Ugyldig kategori.');
  }

  if ($lat !== null && !is_numeric($lat)) {
    respond(false, null, 'Ugyldig breddegrad.');
  }

  if ($lng !== null && !is_numeric($lng)) {
    respond(false, null, 'Ugyldig længdegrad.');
  }

  return [
    'title' => $title,
    'description' => $description,
    'audioSrc' => $audioSrc,
    'category' => $category,
    'lat' => $lat !== null ? (float) $lat : null,
    'lng' => $lng !== null ? (float) $lng : null,
  ];
}

function nextPointId(array $points): int
{
  $max = 0;
  foreach ($points as $point) {
    if (isset($point['id']) && (int) $point['id'] > $max) {
      $max = (int) $point['id'];
    }
  }
  return $max + 1;
}

function sortPointsById(array &$points): void
{
  usort($points, function ($a, $b) {
    return ($a['id'] ?? 0) <=> ($b['id'] ?? 0);
  });
}

function scanAudioFiles(): array
{
  $files = [
    ['label' => 'Arkæologisk fund (ingen lyd)', 'value' => 'urne'],
  ];

  if (is_dir(AUDIO_DIR)) {
    $subdirs = glob(AUDIO_DIR . '/*', GLOB_ONLYDIR) ?: [];
    foreach ($subdirs as $subdir) {
      $folder = basename($subdir);
      $mp3s = glob($subdir . '/*.mp3') ?: [];
      foreach ($mp3s as $mp3) {
        $filename = basename($mp3);
        $relative = $folder . '/' . $filename;
        $files[] = [
          'label' => $relative,
          'value' => AUDIO_BASE_URL . '/' . $relative,
        ];
      }
    }
  }

  if (count($files) === 1 && file_exists(AUDIO_MANIFEST)) {
    $manifest = json_decode(file_get_contents(AUDIO_MANIFEST), true);
    if (is_array($manifest) && isset($manifest['files']) && is_array($manifest['files'])) {
      return $manifest['files'];
    }
  }

  usort($files, function ($a, $b) {
    if ($a['value'] === 'urne') {
      return -1;
    }
    if ($b['value'] === 'urne') {
      return 1;
    }
    return strcmp($a['label'], $b['label']);
  });

  return $files;
}

function readBoundaryData(): array
{
  if (!file_exists(BOUNDARY_FILE)) {
    return ['forestBoundary' => []];
  }

  $raw = file_get_contents(BOUNDARY_FILE);
  $data = json_decode($raw, true);
  if (!is_array($data) || !isset($data['forestBoundary']) || !is_array($data['forestBoundary'])) {
    return ['forestBoundary' => []];
  }

  return $data;
}

function validateBoundaryInput(array $input): array
{
  if (!isset($input['forestBoundary']) || !is_array($input['forestBoundary'])) {
    respond(false, null, 'Mangler forestBoundary.', 400);
  }

  $segments = [];
  foreach ($input['forestBoundary'] as $segmentIndex => $segment) {
    if (!is_array($segment)) {
      respond(false, null, 'Segment ' . ($segmentIndex + 1) . ' er ugyldigt.', 400);
    }

    $ring = [];
    foreach ($segment as $pointIndex => $point) {
      if (!is_array($point) || count($point) < 2) {
        respond(false, null, 'Punkt ' . ($pointIndex + 1) . ' i segment ' . ($segmentIndex + 1) . ' er ugyldigt.', 400);
      }

      $lat = $point[0];
      $lng = $point[1];
      if (!is_numeric($lat) || !is_numeric($lng)) {
        respond(false, null, 'Koordinater skal være tal i segment ' . ($segmentIndex + 1) . '.', 400);
      }

      $lat = (float) $lat;
      $lng = (float) $lng;
      if ($lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
        respond(false, null, 'Koordinater uden for gyldigt interval i segment ' . ($segmentIndex + 1) . '.', 400);
      }

      $ring[] = [$lat, $lng];
    }

    if (count($ring) < 3) {
      respond(false, null, 'Segment ' . ($segmentIndex + 1) . ' skal have mindst 3 punkter.', 400);
    }

    $first = $ring[0];
    $last = $ring[count($ring) - 1];
    if ($first[0] !== $last[0] || $first[1] !== $last[1]) {
      $ring[] = [$first[0], $first[1]];
    }

    $segments[] = $ring;
  }

  return ['forestBoundary' => $segments];
}

function writeBoundaryData(array $data): void
{
  $dataDir = dirname(BOUNDARY_FILE);
  if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
  }

  $payload = [
    'forestBoundary' => $data['forestBoundary'] ?? [],
  ];

  $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  if ($json === false) {
    respond(false, null, 'Kunne ikke serialisere grænsedata.', 500);
  }

  $tmpFile = BOUNDARY_FILE . '.tmp';
  if (file_put_contents($tmpFile, $json . "\n", LOCK_EX) === false) {
    respond(false, null, 'Kunne ikke skrive midlertidig fil.', 500);
  }

  if (!rename($tmpFile, BOUNDARY_FILE)) {
    @unlink($tmpFile);
    respond(false, null, 'Kunne ikke gemme boundary.json.', 500);
  }
}
