<?php

require_once dirname(__DIR__) . '/config.php';

function readPointsData(bool $failOnError = true): array
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
    if ($failOnError) {
      throw new RuntimeException('Kunne ikke læse points.json.');
    }
    return [
      'version' => 1,
      'updatedAt' => date('c'),
      'audioPoints' => [],
    ];
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
    throw new RuntimeException('Kunne ikke serialisere data.');
  }

  $tmpFile = DATA_FILE . '.tmp';
  if (file_put_contents($tmpFile, $json . "\n", LOCK_EX) === false) {
    throw new RuntimeException('Kunne ikke skrive midlertidig fil.');
  }

  if (!rename($tmpFile, DATA_FILE)) {
    @unlink($tmpFile);
    throw new RuntimeException('Kunne ikke gemme points.json.');
  }
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
    throw new RuntimeException('Kunne ikke serialisere grænsedata.');
  }

  $tmpFile = BOUNDARY_FILE . '.tmp';
  if (file_put_contents($tmpFile, $json . "\n", LOCK_EX) === false) {
    throw new RuntimeException('Kunne ikke skrive midlertidig fil.');
  }

  if (!rename($tmpFile, BOUNDARY_FILE)) {
    @unlink($tmpFile);
    throw new RuntimeException('Kunne ikke gemme boundary.json.');
  }
}

function readAudioRegistry(): array
{
  if (!file_exists(AUDIO_REGISTRY)) {
    return ['files' => []];
  }

  $raw = file_get_contents(AUDIO_REGISTRY);
  $data = json_decode($raw, true);
  if (!is_array($data) || !isset($data['files']) || !is_array($data['files'])) {
    return ['files' => []];
  }

  return $data;
}

function writeAudioRegistry(array $data): void
{
  if (!is_dir(AUDIO_DIR)) {
    mkdir(AUDIO_DIR, 0755, true);
  }

  $payload = [
    'files' => array_values($data['files'] ?? []),
  ];

  $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  if ($json === false) {
    throw new RuntimeException('Kunne ikke serialisere registry.json.');
  }

  $tmpFile = AUDIO_REGISTRY . '.tmp';
  if (file_put_contents($tmpFile, $json . "\n", LOCK_EX) === false) {
    throw new RuntimeException('Kunne ikke skrive midlertidig fil.');
  }

  if (!rename($tmpFile, AUDIO_REGISTRY)) {
    @unlink($tmpFile);
    throw new RuntimeException('Kunne ikke gemme registry.json.');
  }
}

function sanitizeAudioFilename(string $name): string
{
  $name = strtolower(trim($name));
  $name = preg_replace('/\.mp3$/i', '', $name);
  $name = preg_replace('/[^a-z0-9._-]+/', '-', $name);
  $name = trim($name, '.-_');

  if ($name === '') {
    $name = 'lydfil';
  }

  return $name . '.mp3';
}

function audioFileUrl(string $filename): string
{
  return AUDIO_BASE_URL . '/' . rawurlencode($filename);
}

function labelFromFilename(string $filename): string
{
  $base = preg_replace('/\.mp3$/i', '', $filename);
  $base = str_replace(['-', '_'], ' ', $base);
  return ucfirst(trim($base));
}

function registryEntryFromFile(string $filename, ?string $label = null): array
{
  $id = preg_replace('/\.mp3$/i', '', $filename);

  return [
    'id' => $id,
    'filename' => $filename,
    'label' => $label !== null && trim($label) !== '' ? trim($label) : labelFromFilename($filename),
    'url' => audioFileUrl($filename),
    'uploadedAt' => date('c'),
  ];
}

function pointAudioFilename(int $pointId): string
{
  return 'point-' . $pointId . '.mp3';
}

function findPointById(int $pointId): ?array
{
  $data = readPointsData(false);
  foreach ($data['audioPoints'] as $point) {
    if ((int) ($point['id'] ?? 0) === $pointId) {
      return $point;
    }
  }
  return null;
}

function setPointAudioSrc(int $pointId, string $url): ?array
{
  return setPointField($pointId, 'audioSrc', $url);
}

function pointImageFilename(int $pointId): string
{
  return 'point-' . $pointId . '.jpg';
}

function imageFileUrl(string $filename): string
{
  return IMAGE_BASE_URL . '/' . rawurlencode($filename);
}

function setPointImageSrc(int $pointId, string $url): ?array
{
  return setPointField($pointId, 'imageSrc', $url);
}

function setPointField(int $pointId, string $field, string $value): ?array
{
  $data = readPointsData(true);
  $updated = null;

  foreach ($data['audioPoints'] as &$point) {
    if ((int) ($point['id'] ?? 0) !== $pointId) {
      continue;
    }
    if ($value === '') {
      unset($point[$field]);
    } else {
      $point[$field] = $value;
    }
    $updated = $point;
    break;
  }
  unset($point);

  if ($updated === null) {
    return null;
  }

  writePointsData($data);
  return $updated;
}

function resizeImageFile(string $path, int $maxWidth = IMAGE_MAX_WIDTH): bool
{
  if (!function_exists('imagecreatefromjpeg')) {
    return true;
  }

  $info = @getimagesize($path);
  if ($info === false) {
    return false;
  }

  $mime = $info['mime'] ?? '';
  if ($mime !== 'image/jpeg' && $mime !== 'image/jpg') {
    return false;
  }

  $width = (int) $info[0];
  $height = (int) $info[1];
  if ($width <= 0 || $height <= 0) {
    return false;
  }

  $source = @imagecreatefromjpeg($path);
  if ($source === false) {
    return false;
  }

  if ($width > $maxWidth) {
    $newWidth = $maxWidth;
    $newHeight = (int) round($height * ($maxWidth / $width));
    $resized = imagecreatetruecolor($newWidth, $newHeight);
    imagecopyresampled($resized, $source, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
    imagedestroy($source);
    $source = $resized;
    $width = $newWidth;
    $height = $newHeight;
  }

  $result = imagejpeg($source, $path, 85);
  imagedestroy($source);

  return $result;
}

function registryEntryForPoint(int $pointId, ?string $label = null): array
{
  $filename = pointAudioFilename($pointId);

  return [
    'pointId' => $pointId,
    'id' => 'point-' . $pointId,
    'filename' => $filename,
    'label' => $label !== null && trim($label) !== '' ? trim($label) : ('Punkt #' . $pointId),
    'url' => audioFileUrl($filename),
    'uploadedAt' => date('c'),
  ];
}

function upsertRegistryEntryForPoint(int $pointId, ?string $label = null): array
{
  $entry = registryEntryForPoint($pointId, $label);
  $registry = readAudioRegistry();
  $found = false;

  foreach ($registry['files'] as &$item) {
    if ((int) ($item['pointId'] ?? 0) === $pointId || ($item['filename'] ?? '') === $entry['filename']) {
      $item = $entry;
      $found = true;
      break;
    }
  }
  unset($item);

  if (!$found) {
    $registry['files'][] = $entry;
  }

  writeAudioRegistry($registry);
  return $entry;
}

function scanAudioFiles(): array
{
  $files = [];

  $registry = readAudioRegistry();
  if (!empty($registry['files'])) {
    foreach ($registry['files'] as $entry) {
      if (!isset($entry['filename'], $entry['url'])) {
        continue;
      }
      $files[] = [
        'label' => $entry['label'] ?? $entry['filename'],
        'value' => $entry['url'],
        'filename' => $entry['filename'],
        'pointId' => $entry['pointId'] ?? null,
      ];
    }
  } elseif (is_dir(AUDIO_DIR)) {
    $mp3s = glob(AUDIO_DIR . '/*.mp3') ?: [];
    foreach ($mp3s as $mp3) {
      $filename = basename($mp3);
      $files[] = [
        'label' => labelFromFilename($filename),
        'value' => audioFileUrl($filename),
        'filename' => $filename,
      ];
    }
  }

  if (count($files) === 0 && file_exists(AUDIO_MANIFEST)) {
    $manifest = json_decode(file_get_contents(AUDIO_MANIFEST), true);
    if (is_array($manifest) && isset($manifest['files']) && is_array($manifest['files'])) {
      return array_values(array_filter($manifest['files'], function ($file) {
        return ($file['value'] ?? '') !== 'urne';
      }));
    }
  }

  usort($files, function ($a, $b) {
    return strcmp($a['label'], $b['label']);
  });

  return $files;
}

function isAudioFileInUse(string $url): bool
{
  $data = readPointsData(false);
  foreach ($data['audioPoints'] as $point) {
    if (($point['audioSrc'] ?? '') === $url) {
      return true;
    }
  }
  return false;
}
