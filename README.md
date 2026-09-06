# Nørholm Vildmark — Lydguide + Admin

Interaktiv GPS-baseret lydguide for [Nørholm Vildmark](https://naturaudio.dk/vildmarken/) med admin-backend til punkter, grænse og lydfiler.

## Krav

- PHP 8+
- Node.js 18+ (til app-build)

## Start lokalt

```bash
cd /Users/pallerix/Desktop/vildmarken
php -S localhost:8080
```

Åbn:

- Landing page: http://localhost:8080/
- Lydguide (dev): `cd app && npm run dev` → http://localhost:3000/vildmarken/app/
- Admin: http://localhost:8080/admin/
- Grænse-editor: http://localhost:8080/admin/boundary.php

Login: adgangskode `dev123` (fra `admin/config.local.php`).

## Mappestruktur

```
vildmarken/
├── index.html           Landing page
├── api/                 Public read API til appen
├── admin/               Admin UI + autentificerede API'er
├── app/                 React/Vite lydguide (kildekode)
├── audio/               MP3-filer + registry.json
├── images/              JPEG-billeder pr. punkt (point-{id}.jpg)
├── data/                points.json + boundary.json (beskyttet)
└── nørholm-5.zip        Original Google AI Studio eksport
```

## Public API (ingen login)

- `GET /vildmarken/api/points.php` → `{ "audioPoints": [...] }`
- `GET /vildmarken/api/boundary.php` → `{ "forestBoundary": [...] }`

`data/` er stadig blokeret via `.htaccess` — kun PHP-endpoints eksponerer JSON.

## Admin API

- `GET admin/api/points.php` — hent alle punkter (kræver login)
- `POST admin/api/points.php` — `{ action: "create"|"update"|"delete", ... }`
- `GET admin/api/audio-files.php` — liste over lydfiler
- `POST admin/api/audio-upload.php` — upload MP3 til et punkt (`pointId` + fil) eller fjern (`{ action: "delete", pointId }`)
- `POST admin/api/image-upload.php` — upload JPEG til et punkt (`pointId` + fil efter crop) eller fjern (`{ action: "delete", pointId }`)
- `GET admin/api/boundary.php` — hent skovgrænse
- `POST admin/api/boundary.php` — `{ forestBoundary: [[[lat,lng],...], ...] }`

## Lydfiler

Hver lydpunkt har sin egen dedikerede MP3-fil (`point-{id}.mp3`). Upload sker direkte på punktet i admin — gem punktet først, vælg fil, og klik **Upload lydfil**.

## Punktbilleder

Hvert punkt kan have ét JPEG-billede i 16:9 (`point-{id}.jpg`). I admin vælges og beskæres billedet med Cropper.js, skaleres til max 1200px bredde og uploades via **Upload billede**.

Engangsmigration fra gamle undermapper (hvis relevant):

```bash
php admin/migrate-audio.php          # kør migration
php admin/migrate-audio.php --dry-run # preview
```

## App-build

```bash
cd app
npm install
npm run build
```

Output i `app/dist/` — upload til `/vildmarken/app/` på serveren.

## Deploy til produktion

Rækkefølge:

1. Upload `api/` → `/vildmarken/api/`
2. Upload opdateret `admin/` → `/vildmarken/admin/`
3. Kør migration på serveren: `php admin/migrate-audio.php` (eller besøg `/vildmarken/admin/migrate-audio.php` mens du er logget ind)
4. Upload `audio/registry.json` og fladede MP3'er → `/vildmarken/audio/`
5. Opret skrivbar `images/` mappe på serveren → `/vildmarken/images/` (JPEG pr. punkt)
6. Upload `data/` → `/vildmarken/data/` (hvis points.json er opdateret med nye URLs)
7. Build app lokalt og upload `app/dist/` → `/vildmarken/app/`

`admin/config.local.php` på serveren:

```php
<?php
define('ADMIN_PASSWORD', 'din-stærke-adgangskode');
define('DEBUG', false);
define('DATAFORSYNINGEN_TOKEN', 'din-api-noegle');
```

## Test flow

**Admin — lydpunkter:** Log ind → vælg punkt → rediger → Gem → verificer `data/points.json`.

**Admin — lydupload:** Vælg punkt → upload MP3 under Lydfil-kortet.

**Admin — billede:** Vælg punkt → vælg billede → crop 16:9 → upload → verificer `images/point-{id}.jpg`.

**App:** Åbn lydguiden → punkter og grænse hentes fra `/vildmarken/api/` → afspil lyd ved punkt → popup viser billede og kompakt player.
