<?php

require_once __DIR__ . '/bootstrap.php';

requireAuth();

$token = defined('DATAFORSYNINGEN_TOKEN') ? trim((string) DATAFORSYNINGEN_TOKEN) : '';

respond(true, [
  'matrikelAvailable' => $token !== '',
  'wmsUrl' => $token !== ''
    ? 'https://api.dataforsyningen.dk/wms/MatGaeldendeOgForeloebigWMS?token=' . rawurlencode($token)
    : '',
  'wmsLayers' => 'matrikel_gaeldende',
]);
