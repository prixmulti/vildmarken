<?php

require_once __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
  requireAuth();
  respond(true, readBoundaryData());
}

if ($method !== 'POST') {
  respond(false, null, 'Metoden understøttes ikke.', 405);
}

requireAuth();

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
  respond(false, null, 'Ugyldigt JSON.', 400);
}

$validated = validateBoundaryInput($input);
writeBoundaryDataOrFail($validated);

respond(true, $validated, 'Grænse gemt.');
