<?php

require_once __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
  requireAuth();
  $data = readPointsData();
  respond(true, $data);
}

if ($method !== 'POST') {
  respond(false, null, 'Metoden understøttes ikke.', 405);
}

requireAuth();

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
  respond(false, null, 'Ugyldigt JSON.', 400);
}

$action = (string) ($input['action'] ?? '');

if ($action === 'create') {
  handleCreate($input);
}

if ($action === 'update') {
  handleUpdate($input);
}

if ($action === 'delete') {
  handleDelete($input);
}

respond(false, null, 'Ukendt handling.', 400);

function handleCreate(array $input): void
{
  $validated = validatePointInput($input, true);
  $data = readPointsData();
  $points = $data['audioPoints'];

  $newPoint = [
    'id' => nextPointId($points),
    'lat' => $validated['lat'] ?? 55.685,
    'lng' => $validated['lng'] ?? 8.605,
    'title' => $validated['title'],
    'description' => $validated['description'],
    'audioSrc' => $validated['audioSrc'],
    'category' => $validated['category'],
  ];

  $points[] = $newPoint;
  sortPointsById($points);
  $data['audioPoints'] = $points;
  writePointsData($data);

  respond(true, ['point' => $newPoint, 'audioPoints' => $points], 'Punkt oprettet.');
}

function handleUpdate(array $input): void
{
  $id = (int) ($input['id'] ?? 0);
  if ($id <= 0) {
    respond(false, null, 'Ugyldigt punkt-id.');
  }

  $validated = validatePointInput($input, false);
  $data = readPointsData();
  $points = $data['audioPoints'];
  $found = false;

  foreach ($points as &$point) {
    if ((int) ($point['id'] ?? 0) !== $id) {
      continue;
    }

    if ($validated['title'] !== '') {
      $point['title'] = $validated['title'];
    }
    if ($validated['description'] !== '') {
      $point['description'] = $validated['description'];
    }
    if ($validated['audioSrc'] !== '') {
      $point['audioSrc'] = $validated['audioSrc'];
    }
    if ($validated['category'] !== '') {
      $point['category'] = $validated['category'];
    }
    if ($validated['lat'] !== null) {
      $point['lat'] = $validated['lat'];
    }
    if ($validated['lng'] !== null) {
      $point['lng'] = $validated['lng'];
    }

    $found = true;
    break;
  }
  unset($point);

  if (!$found) {
    respond(false, null, 'Punkt ikke fundet.', 404);
  }

  sortPointsById($points);
  $data['audioPoints'] = $points;
  writePointsData($data);

  respond(true, ['audioPoints' => $points], 'Punkt opdateret.');
}

function handleDelete(array $input): void
{
  $id = (int) ($input['id'] ?? 0);
  if ($id <= 0) {
    respond(false, null, 'Ugyldigt punkt-id.');
  }

  $data = readPointsData();
  $points = $data['audioPoints'];
  $before = count($points);
  $points = array_values(array_filter($points, function ($point) use ($id) {
    return (int) ($point['id'] ?? 0) !== $id;
  }));

  if (count($points) === $before) {
    respond(false, null, 'Punkt ikke fundet.', 404);
  }

  $data['audioPoints'] = $points;
  writePointsData($data);

  respond(true, ['audioPoints' => $points], 'Punkt slettet.');
}
