<?php

require_once dirname(__DIR__) . '/admin/api/data-store.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=60');

$data = readBoundaryData();
echo json_encode([
  'forestBoundary' => $data['forestBoundary'],
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
