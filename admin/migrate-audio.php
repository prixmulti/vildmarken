<?php

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/api/data-store.php';

function migrateAudio(bool $dryRun = false): array
{
  $report = [
    'moved' => [],
    'skipped' => [],
    'urlUpdates' => [],
    'errors' => [],
  ];

  if (!is_dir(AUDIO_DIR)) {
    mkdir(AUDIO_DIR, 0755, true);
  }

  $registry = readAudioRegistry();
  $existingFilenames = [];
  foreach ($registry['files'] as $entry) {
    if (!empty($entry['filename'])) {
      $existingFilenames[$entry['filename']] = true;
    }
  }

  $subdirs = glob(AUDIO_DIR . '/*', GLOB_ONLYDIR) ?: [];
  foreach ($subdirs as $subdir) {
    $mp3s = glob($subdir . '/*.mp3') ?: [];
    foreach ($mp3s as $mp3Path) {
      $filename = basename($mp3Path);
      $targetPath = AUDIO_DIR . '/' . $filename;

      if (file_exists($targetPath)) {
        $report['skipped'][] = $filename . ' (findes allerede i roden)';
        continue;
      }

      if (!$dryRun) {
        if (!rename($mp3Path, $targetPath)) {
          $report['errors'][] = 'Kunne ikke flytte ' . $filename;
          continue;
        }
      }

      $report['moved'][] = basename($subdir) . '/' . $filename . ' → ' . $filename;

      if (!isset($existingFilenames[$filename])) {
        $registry['files'][] = registryEntryFromFile($filename);
        $existingFilenames[$filename] = true;
      }
    }
  }

  $flatMp3s = glob(AUDIO_DIR . '/*.mp3') ?: [];
  foreach ($flatMp3s as $mp3Path) {
    $filename = basename($mp3Path);
    if (!isset($existingFilenames[$filename])) {
      $registry['files'][] = registryEntryFromFile($filename);
      $existingFilenames[$filename] = true;
      $report['moved'][] = 'Registreret: ' . $filename;
    }
  }

  if (!$dryRun && !empty($registry['files'])) {
    writeAudioRegistry($registry);
  }

  try {
    $pointsData = readPointsData(false);
    $updated = false;

    foreach ($pointsData['audioPoints'] as &$point) {
      $src = (string) ($point['audioSrc'] ?? '');
      if ($src === '' || $src === 'urne') {
        continue;
      }

      if (preg_match('#/audio/[^/]+/([^/]+\.mp3)$#i', $src, $matches)) {
        $filename = $matches[1];
        $newUrl = audioFileUrl($filename);
        if ($newUrl !== $src) {
          $report['urlUpdates'][] = $src . ' → ' . $newUrl;
          if (!$dryRun) {
            $point['audioSrc'] = $newUrl;
            $updated = true;
          }
        }
      }
    }
    unset($point);

    if (!$dryRun && $updated) {
      writePointsData($pointsData);
    }
  } catch (Throwable $e) {
    $report['errors'][] = 'points.json: ' . $e->getMessage();
  }

  if (!$dryRun) {
    $subdirs = glob(AUDIO_DIR . '/*', GLOB_ONLYDIR) ?: [];
    foreach ($subdirs as $subdir) {
      $remaining = glob($subdir . '/*') ?: [];
      if (count($remaining) === 0) {
        @rmdir($subdir);
      }
    }
  }

  return $report;
}

if (PHP_SAPI === 'cli') {
  $dryRun = in_array('--dry-run', $argv, true);
  $report = migrateAudio($dryRun);

  echo ($dryRun ? "DRY RUN\n" : "MIGRATION\n") . str_repeat('-', 40) . "\n";
  echo 'Flyttet: ' . count($report['moved']) . "\n";
  foreach ($report['moved'] as $line) {
    echo "  - $line\n";
  }
  echo 'URL-opdateringer: ' . count($report['urlUpdates']) . "\n";
  foreach ($report['urlUpdates'] as $line) {
    echo "  - $line\n";
  }
  if (!empty($report['skipped'])) {
    echo "Sprunget over:\n";
    foreach ($report['skipped'] as $line) {
      echo "  - $line\n";
    }
  }
  if (!empty($report['errors'])) {
    echo "Fejl:\n";
    foreach ($report['errors'] as $line) {
      echo "  - $line\n";
    }
    exit(1);
  }
  exit(0);
}

require_once __DIR__ . '/api/bootstrap.php';
requireAuth();

$dryRun = isset($_GET['dry-run']);
$report = migrateAudio($dryRun);
respond(true, $report, $dryRun ? 'Dry run fuldført.' : 'Migration fuldført.');
