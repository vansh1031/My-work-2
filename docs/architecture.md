# Architecture

How the app is put together today. For why each choice was made, see `docs/decisions.md`. For the order in which code runs, see `docs/flow.md`.

## 1. The big picture

The same backend code (`server/src/core`) runs in one of two places, chosen when the app is built (`config/app.json` `dataMode`).

**Browser mode (default):**
```
 Browser tab(s), or the desktop app window
 +-----------------------------------------------------------------+
 |  The app (web/src)                                               |
 |    lib/api.ts  ---- messages ---->  Background worker            |
 |                                      web/src/local-backend        |
 |                                      - same routes: server/src/core|
 |                                      - PGlite (PostgreSQL in WASM)|
 |                                      - files saved in IndexedDB   |
 +-----------------------------------------------------------------+
 Served as static files: GitHub Pages, or built into the desktop installer. No server.
```

**Server mode (later, for sharing between computers):**
```
 Desktop app or browser  -- HTTPS, "Authorization: Bearer <token>" -->  Server (Node.js + Fastify)
                                                                         - same routes: server/src/core
                                                                         - PostgreSQL database
                                                                         - photos and 3D models in DATA_DIR/files
```

Screens never know which mode they run in: they always call `api.get`, `api.post` and so on in `web/src/lib/api.ts`.

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
| Backend routes and logic | TypeScript, no framework, runs in Node or a browser | `server/src/core` |
| Browser database | PGlite 0.5 (PostgreSQL 17 in WebAssembly) + our IndexedDB storage | `web/src/local-backend` |
| Server (server mode) | Node.js 22 + Fastify 5 | `server/src/app.ts`, `server/src/node` |
| Server database (server mode) | PostgreSQL 16 | `server/src/node/pg-db.ts` |
| Excel | ExcelJS | `server/src/core/services/excel.ts` |
| Input checks | Zod | config schema, every route |
| Passwords | bcrypt (bcryptjs) | `server/src/core/auth/passwords.ts` |
| Tests | Vitest (backend, both engines), Playwright (whole app, both modes) | `server/test`, `e2e` |
| Website | GitHub Pages | `.github/workflows/pages.yml` |

## 3. Folders and files

```
factory-atlas/
  CLAUDE.md                 Instructions for an AI assistant working on this project
  README.md                 Start here
  SETUP.md                  Using the app, desktop installer, developer setup
  CHANGELOG.md              What changed in each version
  config/                   EVERYTHING A CLIENT CHANGES. Explained in docs/config.md
    app.json                Data mode, server address, features on/off, idle sign-out, status words, map
    branding.json           Company name, app title, login text, logo and favicon file names
    theme.json              Colours, font, corner radius, background dimming, globe and floor colours
    animation.json          Globe and floor camera speeds, zoom levels, near/far distance
    excel.json              Excel column names, status words, date formats, limits
    assets/                 logo.svg, favicon.svg
    legal/                  privacy.md, terms.md
  docs/                     prd, architecture, rules, phases, design, decisions, flow, memory,
                            config, troubleshooting
  shared/src/               Types and helpers used by backend and app
    api.ts                  Shapes of all data the backend sends
    config.ts               Shape of the public config the app receives
    status.ts               The four machine statuses
    geo.ts                  Distance and "slide or long flight" decision for the globe
  server/src/
    core/                   THE BACKEND. Runs in both modes. No Node-only or Fastify imports here.
      router.ts             All routes in one list, and dispatch() to call them without HTTP
      http.ts               Request and response types, BinaryResponse for files
      context.ts            What every route receives (database, config, file store)
      db.ts                 Database interface, migration runner
      pglite-db.ts          Database adapter for PGlite
      setup.ts              Create tables, first admin, optional sample data
      sample-data.ts        The 6 sample factories
      platform.ts           Random tokens and SHA-256 with Web Crypto
      errors.ts             Every error code and its message
      validate.ts           Turns bad input into REQ-001 with field names
      config/schema.ts      Rules for every config field
      config/validate.ts    Checks the config files, wherever they come from
      migrations/001_init.sql   Tables
      auth/                 passwords, sessions, permission checks
      routes/system.ts      health, status, public config, legal, logo, files
      routes/auth.ts        login, logout, me, change password
      routes/factories.ts   factories, machines, history, template, manual status
      routes/uploads.ts     Excel preview and confirm, upload history, download
      routes/admin.ts       users, factories, machines, photos, 3D models, change log
      services/excel.ts     Read workbook, check rows, build template
      services/factories.ts Database reads for factories, machines, status
      services/files.ts     File store interface, file checks
      services/audit.ts     Write to the change log
    index.ts                Server mode entry point
    app.ts                  Server mode: registers core routes with Fastify, CORS, rate limit, uploads
    env.ts                  Server mode environment variables
    node/                   Server mode only: pg-db.ts, load-config.ts, migrations.ts, fs-file-store.ts, bootstrap.ts
    scripts/                check-config, seed
  server/test/              Backend tests: config, Excel rules, globe planning, browser storage,
                            the API suite (api-suite.ts) run on PostgreSQL and on PGlite
  web/
    index.html, vite.config.ts   Build settings: data mode, first admin password, sample data
    public/geo/             Country and state outlines (built by scripts/build-geo.mjs)
    src/main.tsx            Entry point
    src/App.tsx             Screens and who may open them
    src/local-backend/      BROWSER MODE BACKEND
      index.ts              Starts it (shared worker, worker or page), sends requests
      backend.worker.ts     The background worker
      backend-core.ts       Creates the browser database and answers requests with server/src/core
      idb-storage.ts        Saves the database files in IndexedDB, block by block
      file-store.ts         Photos and 3D models in a database table
      config.ts             The config folder, built into the app
      protocol.ts           Messages between page and worker
    src/config/ConfigProvider.tsx   Loads config, applies theme, shows "Starting"
    src/auth/AuthProvider.tsx       Signed-in user, idle sign-out
    src/state/SceneProvider.tsx     What the background should show
    src/background/         BackgroundLayer, globe/, floor/
    src/pages/              One file per screen; admin/ has the three admin tabs
    src/components/         Shared pieces: StatusBadge, Notice, Modal, AppShell, DebugPanel ...
    src/lib/                api.ts (all backend calls), fileUrl.ts (images and models), queries.ts,
                            serverAddress.ts, format.ts
    src/styles/global.css   All styling, driven by theme variables
    dist/                   Build output (browser mode by default): website and desktop app
    dist-server/            Build output for server mode, served by the server
  desktop/
    src-tauri/              Tauri project: tauri.conf.json, Rust entry point, icons
    icon-source/icon.svg    Source of the app icon
  e2e/                      Browser tests that click through the real app, in both modes
  scripts/build-geo.mjs     Rebuilds web/public/geo from Natural Earth data
  .github/workflows/        ci.yml (tests on every push), pages.yml (website), desktop.yml (installers)
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
| local_files (browser mode only) | photos and 3D models | server mode keeps these as files on disk |

The same tables exist in both modes. **Current status of a machine** = its effective record with the latest day, then the latest shift.

## 5. Config vs database

| | Config files (`/config`) | Database |
|---|---|---|
| What | How the app looks and behaves for a client | The client's business data |
| Who changes it | We do, when setting up a client | The admin, through the app |
| How | Edit a file, then rebuild (browser mode) or restart the server (server mode) | Screens under Admin |

The app receives the public part of the config from the `/api/config` route. Server-only settings and secrets are environment variables (`.env.example`).

## 6. Security in short
- Passwords hashed with bcrypt. Session tokens are random; only their SHA-256 hash is stored.
- Every route checks sign-in, role, factory access and the upload/edit switch (`server/src/core/auth/guard.ts`).
- Server mode: sign-in is rate limited (10 per minute per address).
- All database queries use parameters, never string building.
- Uploaded files are checked by content, not only by name.
- Server mode: photos and models are served by unguessable names (see D-011).
- Browser mode: everything stays on the user's computer. Anyone with access to that computer's browser profile can read the data, as with any local file; sign-in still controls what the app shows.

## 7. Where things are tested
| What | Test |
|---|---|
| Config rules | `server/test/config.test.ts` |
| Excel reading and every error code | `server/test/excel.test.ts` |
| Slide vs long flight | `server/test/geo.test.ts` |
| Browser storage keeps data after closing and reopening | `server/test/browser-storage.test.ts` |
| Sign-in, permissions, upload flow, history, change log, on PostgreSQL and PGlite | `server/test/api-suite.ts` via `api.postgres.test.ts`, `api.pglite.test.ts` |
| The real app in a browser, both modes, four screen sizes | `e2e/app.spec.ts` (projects `browser` and `server`) |
