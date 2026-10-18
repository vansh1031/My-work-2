# Architecture

How the app is put together today. For why each choice was made, see `docs/decisions.md`. For the order in which code runs, see `docs/flow.md`.

## 1. The big picture

```
 Desktop app (Tauri, Windows/Linux)          Browser (same app, served by the server)
        |                                             |
        |  HTTPS requests with "Authorization: Bearer <token>"
        v                                             v
 +-----------------------------------------------------------+
 |  Server (Node.js + Fastify)        one server per client   |
 |  - reads /config at startup and checks every field         |
 |  - routes in server/src/routes                             |
 |  - serves the web app from web/dist                        |
 +-----------------------------------------------------------+
        |                                   |
        v                                   v
  PostgreSQL database                 DATA_DIR/files
  (users, factories, machines,        (factory photos, 3D models)
   status, uploads incl. the
   original Excel files, change log)
```

The desktop app and the browser run the same code (`web/`). The desktop app is only a window around it.

## 2. Tech stack

| Part | Choice | Where |
|---|---|---|
| Desktop shell | Tauri 2 | `desktop/src-tauri` |
| Screens | React 19 + TypeScript, built with Vite | `web/src` |
| Data loading | TanStack Query | `web/src/lib/queries.ts` |
| Globe | MapLibre GL 6 (globe projection) | `web/src/background/globe` |
| 3D factory floor | three.js through React Three Fiber | `web/src/background/floor` |
| Card animations | Framer Motion | pages and `BackgroundLayer.tsx` |
| Icons | Lucide (SVG icons) | everywhere |
| Server | Node.js 22 + Fastify 5 + TypeScript | `server/src` |
| Database | PostgreSQL 16, plain SQL | `server/src/db` |
| Excel | ExcelJS | `server/src/services/excel.ts` |
| Input checks | Zod | config schema, every route |
| Passwords | bcrypt | `server/src/auth/passwords.ts` |
| Tests | Vitest (server), Playwright (whole app) | `server/test`, `e2e` |
| Running locally | Docker Compose | `Dockerfile`, `docker-compose.yml` |

## 3. Folders and files

```
factory-atlas/
  CLAUDE.md                 Instructions for an AI assistant working on this project
  README.md                 Start here
  SETUP.md                  Step by step: install and run on Windows
  CHANGELOG.md              What changed in each version
  config/                   EVERYTHING A CLIENT CHANGES. Explained in docs/config.md
    app.json                Server address, features on/off, idle sign-out, status words, map
    branding.json           Company name, app title, login text, logo and favicon file names
    theme.json              Colours, font, corner radius, background dimming, globe and floor colours
    animation.json          Globe and floor camera speeds, zoom levels, near/far distance
    excel.json              Excel column names, status words, date formats, limits
    assets/                 logo.svg, favicon.svg
    legal/                  privacy.md, terms.md
  docs/                     prd, architecture, rules, phases, design, decisions, flow, memory,
                            config, troubleshooting
  shared/src/               Types and helpers used by both server and app
    api.ts                  Shapes of all data the server sends
    config.ts               Shape of the public config the app receives
    status.ts               The four machine statuses
    geo.ts                  Distance and "slide or long flight" decision for the globe
  server/src/
    index.ts                Entry point
    bootstrap.ts            Load config, connect, migrate, create first admin
    app.ts                  Builds the web server: plugins, sign-in check, routes, errors
    env.ts                  Environment variables
    errors.ts               Every error code and its message
    validate.ts             Turns bad input into REQ-001 with field names
    config/schema.ts        Rules for every config field
    config/load.ts          Reads and checks the config folder
    db/pool.ts              Database connection, transactions
    db/migrate.ts           Runs new SQL files from db/migrations
    db/migrations/001_init.sql   Tables
    auth/                   passwords, sessions, permission checks
    routes/system.ts        health, status, public config, legal, logo, files
    routes/auth.ts          login, logout, me, change password
    routes/factories.ts     factories, machines, history, template, manual status
    routes/uploads.ts       Excel preview and confirm, upload history, download
    routes/admin.ts         users, factories, machines, photos, 3D models, change log
    services/excel.ts       Read workbook, check rows, build template
    services/factories.ts   Database reads for factories, machines, status
    services/files.ts       Save and serve photos and models
    services/audit.ts       Write to the change log
    scripts/                check-config, seed, sample-data
  server/test/              Server tests (config, Excel rules, globe planning, full API)
  web/
    index.html, vite.config.ts
    public/geo/             Country and state outlines (built by scripts/build-geo.mjs)
    src/main.tsx            Entry point
    src/App.tsx             Screens and who may open them
    src/config/ConfigProvider.tsx   Loads config from the server, applies theme
    src/auth/AuthProvider.tsx       Signed-in user, idle sign-out
    src/state/SceneProvider.tsx     What the background should show
    src/background/BackgroundLayer.tsx   Chooses globe or floor, dims it, falls back if no WebGL
    src/background/globe/   GlobeBackground (map), globeDirector (camera moves), globeStyle, geoData
    src/background/floor/   FactoryFloor (scene and camera), MachineModels (placeholders, .glb), layout
    src/pages/              One file per screen; admin/ has the three admin tabs
    src/components/         Shared pieces: StatusBadge, Notice, Modal, AppShell, DebugPanel ...
    src/lib/                api.ts (all server calls), queries.ts, serverAddress.ts, format.ts
    src/styles/global.css   All styling, driven by theme variables
  desktop/
    src-tauri/              Tauri project: tauri.conf.json, Rust entry point, icons
    icon-source/icon.svg    Source of the app icon
  e2e/                      Browser tests that click through the real app
  scripts/build-geo.mjs     Rebuilds web/public/geo from Natural Earth data
  .github/workflows/        ci.yml (tests on every push), desktop.yml (installers)
```

## 4. Data model

```
users ---< user_factories >--- factories ---< machines ---< status_records
  |                               |                            |
  |                               +---< uploads >--------------+ (upload_id, optional)
  +---< sessions
  +---< audit_log
```

| Table | Holds | Notes |
|---|---|---|
| users | accounts | role `admin` or `user`; `can_update_status` is the upload/edit switch |
| sessions | sign-in sessions | only a hash of the token is stored |
| factories | factories | `is_sample` marks sample data; `archived` hides without deleting |
| user_factories | which user sees which factory | admins see all regardless |
| machines | machines | `code` is the Machine ID used in Excel; unique per factory |
| uploads | every uploaded Excel file, including the file itself | `superseded_by` is set when a newer file for the same day arrives |
| status_records | one row per machine, day, shift and source | never updated or deleted |
| effective_status (view) | the row that counts per machine, day, shift | newest record, ignoring replaced uploads |
| audit_log | change log | never updated or deleted |

**Current status of a machine** = its effective record with the latest day, then the latest shift.

## 5. Config vs database

| | Config files (`/config`) | Database |
|---|---|---|
| What | How the app looks and behaves for a client | The client's business data |
| Who changes it | We do, when setting up a client | The admin, through the app |
| How | Edit a file, restart the server | Screens under Admin |

Config is read once at server start. The app receives it from `GET /api/config`. Server-only settings and secrets are environment variables (`.env.example`).

## 6. Security in short
- Passwords hashed with bcrypt. Session tokens are random; only their SHA-256 hash is stored.
- Every route checks sign-in, role, factory access and the upload/edit switch (`server/src/auth/guard.ts`).
- Sign-in is rate limited (10 per minute per address).
- All database queries use parameters, never string building.
- Uploaded files are checked by content, not only by name.
- Photos and models are served by unguessable names (see decisions D-011).

## 7. Where things are tested
| What | Test |
|---|---|
| Config rules | `server/test/config.test.ts` |
| Excel reading and every error code | `server/test/excel.test.ts` |
| Slide vs long flight | `server/test/geo.test.ts` |
| Sign-in, permissions, upload flow, history, change log | `server/test/api.test.ts` |
| The real app in a browser, four screen sizes | `e2e/app.spec.ts` |
