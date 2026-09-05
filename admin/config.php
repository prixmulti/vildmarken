<?php

define('VILDMARKEN_ROOT', dirname(__DIR__));
define('DATA_FILE', VILDMARKEN_ROOT . '/data/points.json');
define('AUDIO_DIR', VILDMARKEN_ROOT . '/audio');
define('AUDIO_MANIFEST', AUDIO_DIR . '/manifest.json');
define('AUDIO_BASE_URL', 'https://naturaudio.dk/vildmarken/audio');
define('BOUNDARY_FILE', VILDMARKEN_ROOT . '/data/boundary.json');

$localConfig = __DIR__ . '/config.local.php';
if (file_exists($localConfig)) {
  require $localConfig;
}

if (!defined('ADMIN_PASSWORD')) {
  define('ADMIN_PASSWORD', getenv('VILDMARKEN_ADMIN_PASSWORD') ?: 'changeme');
}

if (!defined('DEBUG')) {
  define('DEBUG', false);
}

if (!defined('DATAFORSYNINGEN_TOKEN')) {
  define('DATAFORSYNINGEN_TOKEN', getenv('DATAFORSYNINGEN_TOKEN') ?: '');
}
