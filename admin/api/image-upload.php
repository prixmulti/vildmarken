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
    respond(false, null, 'Gem punktet først — derefter kan du uploade billede.', 400);
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
  if ($size <= 0 || $size > IMAGE_MAX_BYTES) {
    respond(false, null, 'Filen er tom eller overstiger 3 MB.', 400);
  }

  $finfo = finfo_open(FILEINFO_MIME_TYPE);
  $mime = $finfo ? finfo_file($finfo, $upload['tmp_name']) : '';
  if ($finfo) {
    finfo_close($finfo);
  }

  $allowedMimes = ['image/jpeg', 'image/jpg', 'image/pjpeg'];
  if ($mime !== '' && !in_array($mime, $allowedMimes, true)) {
    respond(false, null, 'Kun JPEG-billeder er tilladt efter crop.', 400);
  }

  $filename = pointImageFilename($pointId);
  $targetPath = IMAGE_DIR . '/' . $filename;

  if (!is_dir(IMAGE_DIR)) {
    mkdir(IMAGE_DIR, 0755, true);
  }

  if (!move_uploaded_file($upload['tmp_name'], $targetPath)) {
    respond(false, null, 'Kunne ikke gemme billedet.', 500);
  }

  if (!resizeImageFile($targetPath, IMAGE_MAX_WIDTH)) {
    @unlink($targetPath);
    respond(false, null, 'Kunne ikke behandle billedet.', 500);
  }

  $url = imageFileUrl($filename);

  try {
    $updatedPoint = setPointImageSrc($pointId, $url);
  } catch (RuntimeException $e) {
    @unlink($targetPath);
    respond(false, null, $e->getMessage(), 500);
  }

  if ($updatedPoint === null) {
    @unlink($targetPath);
    respond(false, null, 'Kunne ikke opdatere punktet.', 500);
  }

  respond(true, [
    'point' => $updatedPoint,
    'imageSrc' => $url,
    'filename' => $filename,
  ], 'Billede uploadet til punktet.');
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

  $filename = pointImageFilename($pointId);
  $path = IMAGE_DIR . '/' . $filename;
  if (file_exists($path)) {
    @unlink($path);
  }

  try {
    $updatedPoint = setPointImageSrc($pointId, '');
  } catch (RuntimeException $e) {
    respond(false, null, $e->getMessage(), 500);
  }

  respond(true, ['point' => $updatedPoint], 'Billede fjernet fra punktet.');
}
