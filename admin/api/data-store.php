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
  $url = AUDIO_BASE_URL . '/' . rawurlencode($filename);
  $path = AUDIO_DIR . '/' . $filename;

  if (is_file($path)) {
    $url .= '?v=' . filemtime($path);
  }

  return $url;
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

function audioFilenameFromUrl(string $url): ?string
{
  $path = parse_url($url, PHP_URL_PATH);
  if (!is_string($path) || $path === '') {
    return null;
  }

  $filename = basename($path);
  if (!preg_match('/\.mp3$/i', $filename)) {
    return null;
  }

  return $filename;
}

function resolvePointAudioFilename(int $pointId, array $point): ?string
{
  $canonical = pointAudioFilename($pointId);
  if (is_file(AUDIO_DIR . '/' . $canonical)) {
    return $canonical;
  }

  $storedSrc = (string) ($point['audioSrc'] ?? '');
  if ($storedSrc !== '' && $storedSrc !== 'urne') {
    $fromStored = audioFilenameFromUrl($storedSrc);
    if ($fromStored !== null && is_file(AUDIO_DIR . '/' . $fromStored)) {
      return $fromStored;
    }
  }

  foreach (readAudioRegistry()['files'] as $entry) {
    if ((int) ($entry['pointId'] ?? 0) !== $pointId) {
      continue;
    }

    $filename = basename((string) ($entry['filename'] ?? ''));
    if ($filename !== '' && is_file(AUDIO_DIR . '/' . $filename)) {
      return $filename;
    }
  }

  return null;
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

function sanitizeOriginalFileName(string $name): string
{
  $name = basename(str_replace('\\', '/', trim($name)));
  if ($name === '' || $name === '.' || $name === '..') {
    return '';
  }

  return function_exists('mb_substr') ? mb_substr($name, 0, 200) : substr($name, 0, 200);
}

function updatePointMediaFields(int $pointId, array $fields): ?array
{
  $allowed = ['imageSrc', 'imageFileName', 'audioSrc', 'audioFileName'];
  $data = readPointsData(true);
  $updated = null;

  foreach ($data['audioPoints'] as &$point) {
    if ((int) ($point['id'] ?? 0) !== $pointId) {
      continue;
    }

    foreach ($fields as $field => $value) {
      if (!in_array($field, $allowed, true)) {
        continue;
      }
      if ($value === '' || $value === null) {
        unset($point[$field]);
      } else {
        $point[$field] = (string) $value;
      }
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

function setPointAudioMedia(int $pointId, string $url, string $originalFileName): ?array
{
  return updatePointMediaFields($pointId, [
    'audioSrc' => $url,
    'audioFileName' => sanitizeOriginalFileName($originalFileName),
  ]);
}

function clearPointAudioMedia(int $pointId): ?array
{
  return updatePointMediaFields($pointId, [
    'audioSrc' => '',
    'audioFileName' => '',
  ]);
}

function pointImageFilename(int $pointId): string
{
  return 'point-' . $pointId . '.jpg';
}

function imageFileUrl(string $filename): string
{
  $url = IMAGE_BASE_URL . '/' . rawurlencode($filename);
  $path = IMAGE_DIR . '/' . $filename;

  if (is_file($path)) {
    $url .= '?v=' . filemtime($path);
  }

  return $url;
}

function hydratePointMediaUrls(array $point): array
{
  $pointId = (int) ($point['id'] ?? 0);
  if ($pointId <= 0) {
    return $point;
  }

  $imageFilename = pointImageFilename($pointId);
  $imagePath = IMAGE_DIR . '/' . $imageFilename;

  if (is_file($imagePath)) {
    $point['imageSrc'] = imageFileUrl($imageFilename);
  } else {
    unset($point['imageSrc']);
    unset($point['imageFileName']);
  }

  $audioFilename = resolvePointAudioFilename($pointId, $point);
  if ($audioFilename !== null) {
    $point['audioSrc'] = audioFileUrl($audioFilename);
  } else {
    unset($point['audioSrc']);
    unset($point['audioFileName']);
  }

  return $point;
}

function hydratePointImageSrc(array $point): array
{
  return hydratePointMediaUrls($point);
}

function hydratePointsData(array $data): array
{
  if (!isset($data['audioPoints']) || !is_array($data['audioPoints'])) {
    return $data;
  }

  $data['audioPoints'] = array_map('hydratePointMediaUrls', $data['audioPoints']);

  return $data;
}

function setPointImageSrc(int $pointId, string $url): ?array
{
  return setPointField($pointId, 'imageSrc', $url);
}

function setPointImageMedia(int $pointId, string $url, string $originalFileName): ?array
{
  return updatePointMediaFields($pointId, [
    'imageSrc' => $url,
    'imageFileName' => sanitizeOriginalFileName($originalFileName),
  ]);
}

function clearPointImageMedia(int $pointId): ?array
{
  return updatePointMediaFields($pointId, [
    'imageSrc' => '',
    'imageFileName' => '',
  ]);
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
        'value' => audioFileUrl($entry['filename']),
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

function analyticsVisitsFile(): string
{
  return ANALYTICS_DIR . '/visits.jsonl';
}

function analyticsListensFile(): string
{
  return ANALYTICS_DIR . '/listens.jsonl';
}

function analyticsLocationsFile(): string
{
  return ANALYTICS_DIR . '/locations.jsonl';
}

function analyticsRateLimitFile(): string
{
  return ANALYTICS_DIR . '/rate-limit.json';
}

function ensureAnalyticsDir(): void
{
  if (!is_dir(ANALYTICS_DIR)) {
    mkdir(ANALYTICS_DIR, 0755, true);
  }
}

function clientIpAddress(): string
{
  $forwarded = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
  if (is_string($forwarded) && $forwarded !== '') {
    $parts = explode(',', $forwarded);
    $ip = trim($parts[0]);
    if ($ip !== '') {
      return $ip;
    }
  }

  return (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
}

function anonymizeIp(string $ip): string
{
  $ip = trim($ip);
  if ($ip === '') {
    $ip = '0.0.0.0';
  }

  if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
    $parts = explode('.', $ip);
    if (count($parts) === 4) {
      $parts[3] = '0';
      $ip = implode('.', $parts);
    }
  } elseif (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
    $segments = explode(':', $ip);
    $count = count($segments);
    if ($count > 1) {
      $segments[$count - 1] = '0';
      $ip = implode(':', $segments);
    }
  }

  return hash('sha256', 'vildmarken-analytics:' . $ip);
}

function isValidAnalyticsSessionId(string $sessionId): bool
{
  return (bool) preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $sessionId);
}

function parseUserAgent(string $ua): array
{
  $ua = trim($ua);
  $device = 'desktop';
  $browser = 'Ukendt';
  $os = 'Ukendt';

  if ($ua === '') {
    return compact('device', 'browser', 'os');
  }

  if (preg_match('/iPad|Tablet|PlayBook|Silk/i', $ua)) {
    $device = 'tablet';
  } elseif (preg_match('/Mobile|Android|iPhone|iPod|IEMobile|Opera Mini/i', $ua)) {
    $device = 'mobile';
  }

  if (preg_match('/Edg\/(\d+)/', $ua, $m)) {
    $browser = 'Edge ' . $m[1];
  } elseif (preg_match('/OPR\/(\d+)/', $ua, $m)) {
    $browser = 'Opera ' . $m[1];
  } elseif (preg_match('/Chrome\/(\d+)/', $ua, $m) && !preg_match('/Edg|OPR/i', $ua)) {
    $browser = 'Chrome ' . $m[1];
  } elseif (preg_match('/Version\/(\d+).*Safari/', $ua, $m) && preg_match('/Safari/', $ua)) {
    $browser = 'Safari ' . $m[1];
  } elseif (preg_match('/Firefox\/(\d+)/', $ua, $m)) {
    $browser = 'Firefox ' . $m[1];
  }

  if (preg_match('/iPhone OS (\d+[_\d]*)/', $ua, $m)) {
    $os = 'iOS ' . str_replace('_', '.', $m[1]);
  } elseif (preg_match('/iPad; CPU OS (\d+[_\d]*)/', $ua, $m)) {
    $os = 'iPadOS ' . str_replace('_', '.', $m[1]);
  } elseif (preg_match('/Android (\d+(?:\.\d+)?)/', $ua, $m)) {
    $os = 'Android ' . $m[1];
  } elseif (preg_match('/Windows NT (\d+\.\d+)/', $ua, $m)) {
    $os = 'Windows ' . $m[1];
  } elseif (preg_match('/Mac OS X (\d+[._\d]*)/', $ua, $m)) {
    $os = 'macOS ' . str_replace('_', '.', $m[1]);
  } elseif (preg_match('/Linux/', $ua)) {
    $os = 'Linux';
  }

  return compact('device', 'browser', 'os');
}

function analyticsRetentionCutoff(): DateTimeImmutable
{
  $days = defined('ANALYTICS_RETENTION_DAYS') ? (int) ANALYTICS_RETENTION_DAYS : 90;
  if ($days <= 0) {
    $days = 90;
  }

  return new DateTimeImmutable('-' . $days . ' days');
}

function readAnalyticsJsonl(string $path, ?DateTimeInterface $since = null): array
{
  if (!is_file($path)) {
    return [];
  }

  $events = [];
  $handle = fopen($path, 'rb');
  if ($handle === false) {
    return [];
  }

  while (($line = fgets($handle)) !== false) {
    $line = trim($line);
    if ($line === '') {
      continue;
    }

    $event = json_decode($line, true);
    if (!is_array($event)) {
      continue;
    }

    if ($since !== null) {
      $ts = (string) ($event['ts'] ?? '');
      if ($ts === '') {
        continue;
      }
      try {
        $eventTime = new DateTimeImmutable($ts);
        if ($eventTime < $since) {
          continue;
        }
      } catch (Exception $e) {
        continue;
      }
    }

    $events[] = $event;
  }

  fclose($handle);
  return $events;
}

function rotateAnalyticsJsonl(string $path): void
{
  if (!is_file($path)) {
    return;
  }

  $cutoff = analyticsRetentionCutoff();
  $kept = [];
  foreach (readAnalyticsJsonl($path) as $event) {
    $ts = (string) ($event['ts'] ?? '');
    if ($ts === '') {
      continue;
    }
    try {
      if (new DateTimeImmutable($ts) >= $cutoff) {
        $kept[] = $event;
      }
    } catch (Exception $e) {
      continue;
    }
  }

  $tmp = $path . '.tmp';
  $handle = fopen($tmp, 'wb');
  if ($handle === false) {
    return;
  }

  foreach ($kept as $event) {
    fwrite($handle, json_encode($event, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n");
  }
  fclose($handle);
  rename($tmp, $path);
}

function appendAnalyticsEvent(string $path, array $event): void
{
  ensureAnalyticsDir();
  $event['ts'] = $event['ts'] ?? date('c');

  $line = json_encode($event, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  if ($line === false) {
    throw new RuntimeException('Kunne ikke serialisere analytics-event.');
  }

  file_put_contents($path, $line . "\n", FILE_APPEND | LOCK_EX);

  static $lastRotation = 0;
  $now = time();
  if ($now - $lastRotation > 300) {
    rotateAnalyticsJsonl($path);
    $lastRotation = $now;
  }
}

function checkAnalyticsRateLimit(string $ipHash, int $maxPerHour = 60): bool
{
  ensureAnalyticsDir();
  $path = analyticsRateLimitFile();
  $now = time();
  $windowStart = $now - 3600;
  $data = [];

  if (is_file($path)) {
    $raw = file_get_contents($path);
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) {
      $data = $decoded;
    }
  }

  $counts = [];
  foreach ($data as $hash => $entries) {
    if (!is_array($entries)) {
      continue;
    }
    $filtered = array_values(array_filter($entries, function ($ts) use ($windowStart) {
      return is_int($ts) && $ts >= $windowStart;
    }));
    if (!empty($filtered)) {
      $counts[$hash] = $filtered;
    }
  }

  $entries = $counts[$ipHash] ?? [];
  if (count($entries) >= $maxPerHour) {
    return false;
  }

  $entries[] = $now;
  $counts[$ipHash] = $entries;
  file_put_contents($path, json_encode($counts), LOCK_EX);
  return true;
}

function recordAnalyticsVisit(array $input): void
{
  $sessionId = trim((string) ($input['sessionId'] ?? ''));
  if (!isValidAnalyticsSessionId($sessionId)) {
    throw new InvalidArgumentException('Ugyldigt sessionId.');
  }

  $ipHash = anonymizeIp(clientIpAddress());
  if (!checkAnalyticsRateLimit($ipHash)) {
    throw new RuntimeException('Rate limit overskredet.');
  }

  $ua = trim((string) ($input['userAgent'] ?? ($_SERVER['HTTP_USER_AGENT'] ?? '')));
  $parsed = parseUserAgent($ua);
  $device = trim((string) ($input['device'] ?? ''));
  $browser = trim((string) ($input['browser'] ?? ''));
  $os = trim((string) ($input['os'] ?? ''));

  appendAnalyticsEvent(analyticsVisitsFile(), [
    'sessionId' => $sessionId,
    'ipHash' => $ipHash,
    'device' => $device !== '' ? $device : $parsed['device'],
    'browser' => $browser !== '' ? $browser : $parsed['browser'],
    'os' => $os !== '' ? $os : $parsed['os'],
    'userAgent' => function_exists('mb_substr') ? mb_substr($ua, 0, 300) : substr($ua, 0, 300),
  ]);
}

function recordAnalyticsListen(array $input): void
{
  $sessionId = trim((string) ($input['sessionId'] ?? ''));
  if (!isValidAnalyticsSessionId($sessionId)) {
    throw new InvalidArgumentException('Ugyldigt sessionId.');
  }

  $pointId = (int) ($input['pointId'] ?? 0);
  if ($pointId <= 0) {
    throw new InvalidArgumentException('Ugyldigt pointId.');
  }

  $seconds = (int) round((float) ($input['seconds'] ?? 0));
  if ($seconds < 1 || $seconds > 7200) {
    throw new InvalidArgumentException('Ugyldig lyttevarighed.');
  }

  $event = trim((string) ($input['event'] ?? 'pause'));
  $allowedEvents = ['play', 'pause', 'ended', 'switch', 'close', 'hidden'];
  if (!in_array($event, $allowedEvents, true)) {
    $event = 'pause';
  }

  $ipHash = anonymizeIp(clientIpAddress());
  if (!checkAnalyticsRateLimit($ipHash)) {
    throw new RuntimeException('Rate limit overskredet.');
  }

  appendAnalyticsEvent(analyticsListensFile(), [
    'sessionId' => $sessionId,
    'pointId' => $pointId,
    'seconds' => $seconds,
    'event' => $event,
  ]);
}

function recordAnalyticsLocation(array $input): void
{
  $sessionId = trim((string) ($input['sessionId'] ?? ''));
  if (!isValidAnalyticsSessionId($sessionId)) {
    throw new InvalidArgumentException('Ugyldigt sessionId.');
  }

  if (!isset($input['lat'], $input['lng']) || !is_numeric($input['lat']) || !is_numeric($input['lng'])) {
    throw new InvalidArgumentException('Ugyldige GPS-koordinater.');
  }

  $lat = round((float) $input['lat'], 4);
  $lng = round((float) $input['lng'], 4);
  if ($lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
    throw new InvalidArgumentException('GPS-koordinater uden for interval.');
  }

  $nearestPointId = (int) ($input['nearestPointId'] ?? 0);
  $nearestDistanceM = (int) round((float) ($input['nearestDistanceM'] ?? 0));
  $nearestPointTitle = trim((string) ($input['nearestPointTitle'] ?? ''));

  if ($nearestDistanceM < 0) {
    $nearestDistanceM = 0;
  }

  $ipHash = anonymizeIp(clientIpAddress());
  if (!checkAnalyticsRateLimit($ipHash)) {
    throw new RuntimeException('Rate limit overskredet.');
  }

  appendAnalyticsEvent(analyticsLocationsFile(), [
    'sessionId' => $sessionId,
    'lat' => $lat,
    'lng' => $lng,
    'nearestPointId' => $nearestPointId > 0 ? $nearestPointId : null,
    'nearestPointTitle' => $nearestPointTitle !== '' ? $nearestPointTitle : null,
    'nearestDistanceM' => $nearestDistanceM > 0 ? $nearestDistanceM : null,
  ]);
}

function analyticsRangeSince(string $range): ?DateTimeImmutable
{
  switch ($range) {
    case '7':
      return new DateTimeImmutable('-7 days');
    case '30':
      return new DateTimeImmutable('-30 days');
    case '90':
      return new DateTimeImmutable('-90 days');
    case 'all':
      return null;
    default:
      return new DateTimeImmutable('-30 days');
  }
}

function formatListenDuration(int $seconds): string
{
  if ($seconds < 60) {
    return $seconds . ' sek';
  }

  $minutes = intdiv($seconds, 60);
  $remaining = $seconds % 60;
  if ($minutes < 60) {
    return $remaining > 0 ? ($minutes . ' min ' . $remaining . ' sek') : ($minutes . ' min');
  }

  $hours = intdiv($minutes, 60);
  $minutes = $minutes % 60;
  return $hours . ' t ' . $minutes . ' min';
}

function aggregateAnalyticsStats(string $range = '30'): array
{
  $since = analyticsRangeSince($range);
  $visits = readAnalyticsJsonl(analyticsVisitsFile(), $since);
  $listens = readAnalyticsJsonl(analyticsListensFile(), $since);
  $locations = readAnalyticsJsonl(analyticsLocationsFile(), $since);

  $pointsData = readPointsData(false);
  $pointTitles = [];
  foreach ($pointsData['audioPoints'] as $point) {
    $pointTitles[(int) ($point['id'] ?? 0)] = (string) ($point['title'] ?? ('Punkt #' . ($point['id'] ?? '?')));
  }

  $locationBySession = [];
  foreach ($locations as $location) {
    $sessionId = (string) ($location['sessionId'] ?? '');
    if ($sessionId === '' || isset($locationBySession[$sessionId])) {
      continue;
    }
    $locationBySession[$sessionId] = $location;
  }

  $visitsByDay = [];
  $uniqueVisitors = [];
  $devices = [];
  $browsers = [];
  $recentVisits = [];
  $qrStarts = [];

  foreach ($visits as $visit) {
    $ts = (string) ($visit['ts'] ?? '');
    if ($ts === '') {
      continue;
    }
    try {
      $day = (new DateTimeImmutable($ts))->format('Y-m-d');
    } catch (Exception $e) {
      continue;
    }

    $sessionId = (string) ($visit['sessionId'] ?? '');
    $location = $locationBySession[$sessionId] ?? null;
    $nearestPointId = (int) ($location['nearestPointId'] ?? 0);
    $nearestPointTitle = (string) ($location['nearestPointTitle'] ?? '');
    if ($nearestPointTitle === '' && $nearestPointId > 0) {
      $nearestPointTitle = $pointTitles[$nearestPointId] ?? ('Punkt #' . $nearestPointId);
    }

    $visitsByDay[$day] = ($visitsByDay[$day] ?? 0) + 1;
    $ipHash = (string) ($visit['ipHash'] ?? '');
    if ($ipHash !== '') {
      $uniqueVisitors[$ipHash] = true;
    }

    $device = (string) ($visit['device'] ?? 'ukendt');
    $browser = (string) ($visit['browser'] ?? 'Ukendt');
    $devices[$device] = ($devices[$device] ?? 0) + 1;
    $browsers[$browser] = ($browsers[$browser] ?? 0) + 1;

    if ($nearestPointId > 0) {
      if (!isset($qrStarts[$nearestPointId])) {
        $qrStarts[$nearestPointId] = [
          'pointId' => $nearestPointId,
          'title' => $nearestPointTitle !== '' ? $nearestPointTitle : ('Punkt #' . $nearestPointId),
          'count' => 0,
        ];
      }
      $qrStarts[$nearestPointId]['count'] += 1;
    }

    $recentVisits[] = [
      'ts' => $ts,
      'device' => $device,
      'browser' => $browser,
      'os' => (string) ($visit['os'] ?? 'Ukendt'),
      'nearestPointTitle' => $nearestPointTitle !== '' ? $nearestPointTitle : null,
      'nearestDistanceM' => isset($location['nearestDistanceM']) ? (int) $location['nearestDistanceM'] : null,
      'lat' => isset($location['lat']) ? (float) $location['lat'] : null,
      'lng' => isset($location['lng']) ? (float) $location['lng'] : null,
    ];
  }

  usort($recentVisits, function ($a, $b) {
    return strcmp($b['ts'], $a['ts']);
  });
  $recentVisits = array_slice($recentVisits, 0, 20);

  ksort($visitsByDay);

  $listenStats = [];
  $totalListenSeconds = 0;
  foreach ($listens as $listen) {
    $pointId = (int) ($listen['pointId'] ?? 0);
    $seconds = (int) ($listen['seconds'] ?? 0);
    if ($pointId <= 0 || $seconds <= 0) {
      continue;
    }

    if (!isset($listenStats[$pointId])) {
      $listenStats[$pointId] = [
        'pointId' => $pointId,
        'title' => $pointTitles[$pointId] ?? ('Punkt #' . $pointId),
        'plays' => 0,
        'totalSeconds' => 0,
      ];
    }

    $listenStats[$pointId]['plays'] += 1;
    $listenStats[$pointId]['totalSeconds'] += $seconds;
    $totalListenSeconds += $seconds;
  }

  usort($listenStats, function ($a, $b) {
    return $b['totalSeconds'] <=> $a['totalSeconds'];
  });

  $listenStats = array_map(function ($row) {
    $avg = $row['plays'] > 0 ? (int) round($row['totalSeconds'] / $row['plays']) : 0;
    $row['avgSeconds'] = $avg;
    $row['totalFormatted'] = formatListenDuration($row['totalSeconds']);
    $row['avgFormatted'] = formatListenDuration($avg);
    return $row;
  }, array_values($listenStats));

  $topPoint = $listenStats[0] ?? null;

  arsort($devices);
  arsort($browsers);

  usort($qrStarts, function ($a, $b) {
    return $b['count'] <=> $a['count'];
  });

  return [
    'range' => $range,
    'summary' => [
      'totalVisits' => count($visits),
      'uniqueVisitors' => count($uniqueVisitors),
      'totalListenSeconds' => $totalListenSeconds,
      'totalListenFormatted' => formatListenDuration($totalListenSeconds),
      'topPointTitle' => $topPoint['title'] ?? '—',
      'topPointSeconds' => $topPoint['totalSeconds'] ?? 0,
      'gpsVisits' => count($locations),
    ],
    'visitsByDay' => array_map(function ($day, $count) {
      return ['day' => $day, 'count' => $count];
    }, array_keys($visitsByDay), array_values($visitsByDay)),
    'devices' => array_map(function ($label, $count) {
      return ['label' => $label, 'count' => $count];
    }, array_keys($devices), array_values($devices)),
    'browsers' => array_map(function ($label, $count) {
      return ['label' => $label, 'count' => $count];
    }, array_keys($browsers), array_values($browsers)),
    'listenStats' => $listenStats,
    'qrStarts' => array_values($qrStarts),
    'recentVisits' => $recentVisits,
  ];
}

function resetAnalyticsData(): void
{
  $files = [
    analyticsVisitsFile(),
    analyticsListensFile(),
    analyticsLocationsFile(),
    analyticsRateLimitFile(),
  ];

  foreach ($files as $file) {
    if (is_file($file)) {
      @unlink($file);
    }
  }
}

function buildAnalyticsExportPayload(string $range): array
{
  $since = analyticsRangeSince($range);
  $stats = aggregateAnalyticsStats($range);

  return [
    'exportedAt' => date('c'),
    'range' => $range,
    'summary' => $stats['summary'] ?? [],
    'visitsByDay' => $stats['visitsByDay'] ?? [],
    'devices' => $stats['devices'] ?? [],
    'browsers' => $stats['browsers'] ?? [],
    'listenStats' => $stats['listenStats'] ?? [],
    'recentVisits' => $stats['recentVisits'] ?? [],
    'rawVisits' => readAnalyticsJsonl(analyticsVisitsFile(), $since),
    'rawListens' => readAnalyticsJsonl(analyticsListensFile(), $since),
    'rawLocations' => readAnalyticsJsonl(analyticsLocationsFile(), $since),
  ];
}

function csvEscapeField($value): string
{
  $value = (string) $value;
  if (strpbrk($value, "\",\n\r") !== false) {
    return '"' . str_replace('"', '""', $value) . '"';
  }

  return $value;
}

function analyticsExportFilename(string $range, string $extension): string
{
  $rangeLabel = $range === 'all' ? 'alt' : ($range . 'd');
  return 'vildmarken-statistik-' . $rangeLabel . '-' . date('Y-m-d') . '.' . $extension;
}

function analyticsStatsToCsv(array $export): string
{
  $lines = [];

  $appendSection = function (string $title, array $headers, array $rows) use (&$lines) {
    $lines[] = csvEscapeField($title);
    $lines[] = implode(',', array_map('csvEscapeField', $headers));
    foreach ($rows as $row) {
      $lines[] = implode(',', array_map('csvEscapeField', $row));
    }
    $lines[] = '';
  };

  $summary = $export['summary'] ?? [];
  $appendSection('Opsummering', ['Nøgle', 'Værdi'], [
    ['Besøg', $summary['totalVisits'] ?? 0],
    ['Unikke besøgende', $summary['uniqueVisitors'] ?? 0],
    ['Lytte-tid', $summary['totalListenFormatted'] ?? '0 sek'],
    ['GPS-besøg', $summary['gpsVisits'] ?? 0],
    ['Mest lyttede punkt', $summary['topPointTitle'] ?? '—'],
  ]);

  $appendSection(
    'Besøg pr. dag',
    ['Dato', 'Antal'],
    array_map(function ($row) {
      return [$row['day'] ?? '', $row['count'] ?? 0];
    }, $export['visitsByDay'] ?? [])
  );

  $appendSection(
    'Enheder',
    ['Enhed', 'Antal'],
    array_map(function ($row) {
      return [$row['label'] ?? '', $row['count'] ?? 0];
    }, $export['devices'] ?? [])
  );

  $appendSection(
    'Browsere',
    ['Browser', 'Antal'],
    array_map(function ($row) {
      return [$row['label'] ?? '', $row['count'] ?? 0];
    }, $export['browsers'] ?? [])
  );

  $appendSection(
    'Lytning pr. lydpunkt',
    ['Punkt', 'Afspilninger', 'Total sekunder', 'Gns. sekunder'],
    array_map(function ($row) {
      return [
        $row['title'] ?? '',
        $row['plays'] ?? 0,
        $row['totalSeconds'] ?? 0,
        $row['avgSeconds'] ?? 0,
      ];
    }, $export['listenStats'] ?? [])
  );

  $appendSection(
    'Seneste besøg',
    ['Tidspunkt', 'Startpunkt', 'Afstand (m)', 'Enhed', 'Browser', 'OS'],
    array_map(function ($row) {
      $start = (string) ($row['nearestPointTitle'] ?? '');
      if ($start === '') {
        $start = 'Ingen GPS';
      }
      return [
        $row['ts'] ?? '',
        $start,
        $row['nearestDistanceM'] ?? '',
        $row['device'] ?? '',
        $row['browser'] ?? '',
        $row['os'] ?? '',
      ];
    }, $export['recentVisits'] ?? [])
  );

  return "\xEF\xBB\xBF" . implode("\n", $lines);
}
