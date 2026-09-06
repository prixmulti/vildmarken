<?php

require_once __DIR__ . '/bootstrap.php';

requireAuth();

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'POST') {
  respond(false, null, 'Metoden understøttes ikke.', 405);
}

$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
$isMultipart = stripos($contentType, 'multipart/form-data') !== false;

if ($isMultipart) {
  handleUpload();
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
  respond(false, null, 'Ugyldigt input.', 400);
}

$action = (string) ($input['action'] ?? '');

if ($action === 'delete') {
  handleDelete($input);
}

respond(false, null, 'Ukendt handling.', 400);

function handleUpload(): void
{
  if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
    respond(false, null, 'Ingen fil modtaget.', 400);
  }

  $pointId = (int) ($_POST['pointId'] ?? 0);
  if ($pointId <= 0) {
    respond(false, null, 'Gem punktet først — derefter kan du uploade lydfil.', 400);
  }

  $point = findPointById($pointId);
  if ($point === null) {
    respond(false, null, 'Punkt ikke fundet.', 404);
  }

  $upload = $_FILES['file'];
  if (($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    respond(false, null, 'Upload fejlede (kode ' . ($upload['error'] ?? '?') . ').', 400);
  }

  $size = (int) ($upload['size'] ?? 0);
  if ($size <= 0 || $size > AUDIO_MAX_BYTES) {
    respond(false, null, 'Filen er tom eller overstiger 20 MB.', 400);
  }

  $originalName = (string) ($upload['name'] ?? '');
  if (!preg_match('/\.mp3$/i', $originalName)) {
    respond(false, null, 'Kun .mp3-filer er tilladt.', 400);
  }

  $finfo = finfo_open(FILEINFO_MIME_TYPE);
  $mime = $finfo ? finfo_file($finfo, $upload['tmp_name']) : '';
  if ($finfo) {
    finfo_close($finfo);
  }

  $allowedMimes = ['audio/mpeg', 'audio/mp3', 'audio/x-mpeg', 'audio/mpeg3', 'application/octet-stream'];
  if ($mime !== '' && !in_array($mime, $allowedMimes, true)) {
    respond(false, null, 'Filen er ikke en gyldig MP3.', 400);
  }

  $filename = pointAudioFilename($pointId);
  $targetPath = AUDIO_DIR . '/' . $filename;
  $previousSrc = (string) ($point['audioSrc'] ?? '');

  if (!is_dir(AUDIO_DIR)) {
    mkdir(AUDIO_DIR, 0755, true);
  }

  if (!move_uploaded_file($upload['tmp_name'], $targetPath)) {
    respond(false, null, 'Kunne ikke gemme filen.', 500);
  }

  $label = trim((string) ($_POST['label'] ?? ''));
  if ($label === '') {
    $label = trim((string) ($point['title'] ?? ''));
  }

  try {
    $entry = upsertRegistryEntryForPoint($pointId, $label !== '' ? $label : null);
    $updatedPoint = setPointAudioSrc($pointId, $entry['url']);
  } catch (RuntimeException $e) {
    @unlink($targetPath);
    respond(false, null, $e->getMessage(), 500);
  }

  if ($updatedPoint === null) {
    @unlink($targetPath);
    respond(false, null, 'Kunne ikke opdatere punktet.', 500);
  }

  if ($previousSrc !== '' && $previousSrc !== $entry['url']) {
    $previousFilename = basename(parse_url($previousSrc, PHP_URL_PATH) ?: '');
    if ($previousFilename !== '' && $previousFilename !== $filename) {
      $previousPath = AUDIO_DIR . '/' . $previousFilename;
      if (file_exists($previousPath)) {
        @unlink($previousPath);
      }
      $registry = readAudioRegistry();
      $registry['files'] = array_values(array_filter($registry['files'], function ($item) use ($previousFilename, $pointId) {
        if ((int) ($item['pointId'] ?? 0) === $pointId) {
          return true;
        }
        return ($item['filename'] ?? '') !== $previousFilename;
      }));
      writeAudioRegistry($registry);
    }
  }

  respond(true, [
    'point' => $updatedPoint,
    'audioSrc' => $entry['url'],
    'filename' => $entry['filename'],
  ], 'Lydfil uploadet til punktet.');
}

function handleDelete(array $input): void
{
  $pointId = (int) ($input['pointId'] ?? 0);
  if ($pointId <= 0) {
    respond(false, null, 'Ugyldigt punkt-id.', 400);
  }

  $point = findPointById($pointId);
  if ($point === null) {
    respond(false, null, 'Punkt ikke fundet.', 404);
  }

  $filename = pointAudioFilename($pointId);
  $path = AUDIO_DIR . '/' . $filename;
  if (file_exists($path)) {
    @unlink($path);
  }

  $registry = readAudioRegistry();
  $registry['files'] = array_values(array_filter($registry['files'], function ($item) use ($pointId, $filename) {
    if ((int) ($item['pointId'] ?? 0) === $pointId) {
      return false;
    }
    return ($item['filename'] ?? '') !== $filename;
  }));
  writeAudioRegistry($registry);

  try {
    $updatedPoint = setPointAudioSrc($pointId, '');
  } catch (RuntimeException $e) {
    respond(false, null, $e->getMessage(), 500);
  }

  respond(true, ['point' => $updatedPoint], 'Lydfil fjernet fra punktet.');
}
