<?php

require_once __DIR__ . '/bootstrap.php';

requireAuth();
respond(true, ['files' => scanAudioFiles()]);
