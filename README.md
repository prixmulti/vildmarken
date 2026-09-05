# Nørholm Vildmark — Admin

Backend til at redigere lydpunkter og skovgrænsen for [Vildmarken lydguiden](https://naturaudio.dk/vildmarken/app/).

Frontenden røres ikke i fase 1. Admin gemmer data i `data/points.json` og `data/boundary.json`, som senere kan bruges af appen.

## Krav

- PHP 8+

## Start lokalt

```bash
cd /Users/pallerix/Desktop/vildmarken
php -S localhost:8080
```

Åbn:

- Lydpunkter: http://localhost:8080/admin/
- Grænse-editor: http://localhost:8080/admin/boundary.php
- Login: adgangskode `dev123` (fra `admin/config.local.php`)

## Test flow — lydpunkter

1. Log ind på admin-siden
2. Klik et punkt på kortet — formularen udfyldes
3. Træk markøren — lat/lng opdateres
4. Ret titel/beskrivelse og klik **Gem**
5. Opret nyt punkt med **+ Nyt punkt**
6. Slet et punkt med **Slet**
7. Genindlæs siden og verificer at ændringerne ligger i `data/points.json`

## Test flow — grænse-editor

1. Gå til **Grænse-editor** fra admin-headeren
2. Tegn eller rediger polygoner med værktøjerne på kortet
3. Slå **Matrikelkort** til (kræver `DATAFORSYNINGEN_TOKEN` i config)
4. Slå **Klik for at importere jordstykke** til og klik på et matrikel
5. Klik **Gem grænse** og verificer `data/boundary.json`

## Mappestruktur

```
vildmarken/
├── admin/           Admin UI + PHP API
├── audio/           manifest.json (fallback til lydfil-liste)
├── data/            points.json + boundary.json (beskyttet mod direkte adgang)
└── nørholm-5.zip    Original Google AI Studio eksport
```

## Produktion

Upload til serveren:

- `admin/` → `/vildmarken/admin/`
- `data/` → `/vildmarken/data/`

Opret `admin/config.local.php` på serveren:

```php
<?php
define('ADMIN_PASSWORD', 'din-stærke-adgangskode');
define('DEBUG', false);

// Datafordeler / Dataforsyningen API-nøgle til matrikelkort (WMS)
define('DATAFORSYNINGEN_TOKEN', 'din-api-noegle');
```

Alternativt via miljøvariabel: `VILDMARKEN_ADMIN_PASSWORD` og `DATAFORSYNINGEN_TOKEN`.

## API

- `GET admin/api/points.php` — hent alle punkter (kræver login)
- `POST admin/api/points.php` — `{ action: "create"|"update"|"delete", ... }`
- `GET admin/api/audio-files.php` — liste over lydfiler
- `GET admin/api/boundary.php` — hent skovgrænse (kræver login)
- `POST admin/api/boundary.php` — `{ forestBoundary: [[[lat,lng],...], ...] }`

## Næste skridt (fase 2)

- Frontend henter `points.json` og `boundary.json` i stedet for `constants.ts`
- Upload af nye lydfiler via admin
