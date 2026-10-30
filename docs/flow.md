# Code flow

Where the code starts, in what order things run, and which function calls which. Paths are relative to the project folder. Update this file in the same change whenever the order changes.

## 1. Where a request goes

Every screen calls `api.get`, `api.post` and so on in `web/src/lib/api.ts`. What happens next depends on the data mode the app was built with (`config/app.json` `dataMode`, or `--mode browser` / `--mode server`):

```
api.request(method, path, body)                web/src/lib/api.ts
  browser mode: localRequest()                 -> section 10 (built-in backend, no network)
  server mode:  fetch(serverAddress + path)    -> section 2 (server)
both end in the same route handler in server/src/core/routes/*.ts
```

## 2. Server mode: server start and requests

Entry point: `server/src/index.ts` (built to `server/dist/index.js`).

```
main()                                         server/src/index.ts
  readEnv()                                    server/src/env.ts            env vars -> Env object
  bootstrap(env)                               server/src/node/bootstrap.ts
    loadConfig(configDir)                      server/src/node/load-config.ts -> core/config/validate.ts
      every file checked                       any problem -> ConfigError (CONFIG-001), server stops
    createPgDb(DATABASE_URL)                   server/src/node/pg-db.ts
    SELECT 1                                   fails -> "DB-001", server stops
    prepareDatabase(db, readMigrations(), ...) server/src/core/setup.ts
      runMigrations()                          core/db.ts, SQL files from core/migrations
      ensureAdmin(INITIAL_ADMIN_PASSWORD)      creates "admin" on an empty database
      seedSampleData()                         only if SEED_SAMPLE_DATA=true and no factories yet
  buildApp(ctx)                                server/src/app.ts
    register cors, rate-limit, multipart
    onRequest hook                             tokenFromHeader() -> userForToken()   core/auth/guard.ts
    for each route in allRoutes                core/router.ts
      app.route(...)                           reads an uploaded file if the route takes one
    setErrorHandler                            AppError -> { error: { code, message } }
    serve web/dist-server (if built)
  app.listen(PORT)
```

## 3. Any request, inside the backend (both modes)

```
route handler                                  server/src/core/routes/<file>.ts
  requireUser / requireAdmin(req)              AUTH-002 / AUTH-005 / PERM-001
  parse(schema, req.body or req.params)        core/validate.ts             REQ-001
  assertFactoryAccess(db, user, factoryId)     PERM-002
  requireStatusPermission(user)                PERM-003 (uploads and manual edits)
  core/services/*.ts                           database reads and writes (same SQL on PostgreSQL and PGlite)
  audit(...)                                   core/services/audit.ts (changes only)
returns JSON data, or a BinaryResponse for files; throws AppError on refusal
```

## 3b. App start

Entry point: `web/src/main.tsx` -> `<App />` in `web/src/App.tsx`.

```
App
  QueryClientProvider
  ConfigProvider                       web/src/config/ConfigProvider.tsx
    shows "Starting" while waiting (browser mode: first start creates the database)
    api.get("/api/config")             web/src/lib/api.ts
      fails -> ConnectionScreen        "Cannot connect" (server mode) or "Cannot start" (browser mode), with the error code
      ok    -> applyTheme(): CSS variables, title, favicon (lib/fileUrl.ts)
  AuthProvider                         web/src/auth/AuthProvider.tsx
    token in sessionStorage? -> GET /api/auth/me
    starts the idle timer (sessionIdleMinutes)
  SceneProvider                        web/src/state/SceneProvider.tsx    what the background shows
  HashRouter
    BackgroundLayer                    web/src/background/BackgroundLayer.tsx
    Routes -> page                     Protected() sends to /login or /account/password when needed
    DebugPanel (if app.json debug)     shows data mode and how the built-in backend runs
```

## 4. Signing in

```
LoginPage.submit()                     web/src/pages/LoginPage.tsx
  useAuth().login(username, password)  AuthProvider
    api.post("/api/auth/login")        -> server/src/core/routes/auth.ts
      verifyPassword() (bcrypt)        wrong -> AUTH-001, inactive -> AUTH-003
      createSession() -> token
    setToken(token)                    sessionStorage
  <Navigate> to /account/password (first sign-in) or /
```

## 5. Home page and the globe

```
HomePage                               web/src/pages/HomePage.tsx
  useFactories() -> GET /api/factories          lib/queries.ts -> core/routes/factories.ts -> core/services/factories.ts listFactories()
  Summary(addCounts(...))                       components/Summary.tsx   totals across the user's factories
  selectedId from the address (?f=3)
  FactoryRow: row click -> select(id)   Open button -> /factories/3
  ViewPanel("Globe")                            components/ViewPanel.tsx  WebGL check, lazy load, BG-001 message on failure
    GlobeView(factories, selectedId, onPick)    web/src/views/globe/GlobeView.tsx
      loadCountries()  and  onlineStyle()       fetched at the same time (geoData.ts, globeStyle.ts)
      new MapLibreMap(online style, or builtInStyle(countries) if offline)
      on "load" -> new GlobeDirector(...)       globeDirector.ts
      when selectedId changes: director.showFactory(factory) or director.clearSelection()
      a pin is clicked -> onPick(id) -> select(id)
    map-card (selected factory)                 "Open factory" -> /factories/3

GlobeDirector.showFactory(f)
  planFlight(previous, f, nearDistanceKm)       shared/src/geo.ts -> "first" | "slide" | "long"
  areas(f): findCountry() -> loadStates(iso)    only that country's states, geo/states/<ISO>.json
  reduce motion -> jumpTo city, highlight, pin
  slide -> highlight state, animate pin and easeTo city together
  first/long: flyTo country box -> highlight state, easeTo state box -> placeMarker(), easeTo city
  user drags or zooms -> flight stops, idle rotation pauses 30 seconds; tab hidden -> rotation stops
```

## 6. Factory page, the 3D floor and machine details

```
FactoryPage                            web/src/pages/FactoryPage.tsx   routes /factories/:id and /factories/:id/machines/:mid
  useFactory(id) -> GET /api/factories/:id      listFactories + listMachines (current status per machine)
  FactoryHeader                                 components/FactoryHeader.tsx: breadcrumb, Summary, tabs
  selectedId from the address (:mid)
  MachineTile click -> select(mid) -> navigate to /factories/:id/machines/:mid (click again closes)
  ViewPanel("Factory floor")
    FactoryFloor(machines, selectedId, onPick)  web/src/views/floor/FactoryFloor.tsx
      layoutMachines(machines)                  layout.ts   fixed spiral positions
      MachineOnFloor x N                        status ring colour, MachineModel; click -> onPick(mid)
      CameraRig                                 tween to focusCamera() or overviewCamera(panel shape); switching adds switchSweepDegrees
  MachineDetails(machineId, ...)                components/MachineDetails.tsx, under the 3D view
    useMachine(mid) -> GET /api/machines/:mid   details, shifts, last 14 days
    Previous / Next -> select(other mid); close -> /factories/:id
```

## 7. Excel upload

```
UploadPage.choose(file)                web/src/pages/UploadPage.tsx
  api.upload("/api/factories/:id/uploads/preview", file)
    -> uploadRoutes preview            server/src/core/routes/uploads.ts
       authorise(): feature on, signed in, PERM-003, PERM-002
       readUploadedFile()              size (FILE-002), .xlsx only (FILE-003)
       check(ctx, factoryId, file)
         readWorkbook(buffer, excelConfig)        services/excel.ts   header -> columns (XL-001), rows
         validateRows(rows, ctx) first pass       finds the day
         load saved status for that day + active upload for that day
         validateRows(rows, ctx) second pass      errors XL-002..XL-011, warnings XL-101/102, changes
         add XL-103 warning if it replaces an earlier upload
       -> preview (nothing saved)
UploadPage shows the preview. Confirm enabled only if preview.canConfirm.

UploadPage.confirm()
  api.upload("/api/factories/:id/uploads", same file)
    -> uploadRoutes confirm: authorise, readUploadedFile, check() again
       errors -> UPLOAD-001 (nothing saved)
       withTransaction():
         advisory lock for factory + day
         INSERT uploads (with the file)
         UPDATE older uploads of that day SET superseded_by
         INSERT status_records (source "upload") for each row
         audit("upload.confirmed")
  useInvalidateStatus() -> every list and page reloads its data
```

## 8. Manual status edit

```
MachineDetails -> EditStatus.submit()  web/src/components/MachineDetails.tsx
  useManualStatus(id).mutate()         lib/queries.ts
    PUT /api/machines/:id/status       server/src/core/routes/factories.ts
      feature on, requireStatusPermission, assertFactoryAccess, shift <= shiftsPerDay, no future date
      INSERT status_records (source "manual"), audit("status.manual")
```

## 9. Admin

```
AdminPage (?tab=users | factories | log)        web/src/pages/admin/AdminPage.tsx
  UsersTab      -> /api/admin/users ...          server/src/core/routes/admin.ts
  FactoriesTab  -> /api/admin/factories ..., /api/admin/machines ..., photo and model uploads (core/services/files.ts saveFile)
  AuditTab      -> /api/admin/audit
```

## 10. Browser mode: the built-in backend

```
first api call -> startLocal()                         web/src/lib/api.ts
  import("../local-backend").startLocalBackend()       web/src/local-backend/index.ts
    try, in order, until one works (each failure logged as LOCAL-003):
      1. new SharedWorker(backend.worker.ts)           one backend for all tabs
      2. new Worker(backend.worker.ts)                 one per tab, only one tab may hold the data (LOCAL-002)
      3. startInPage()                                 backend-core.ts in the page itself
    worker says {status, needsEngine}
      needsEngine -> page downloads pglite.wasm, initdb.wasm, pglite.data and sends them (engine)
    worker: startBackend(engine)                       web/src/local-backend/backend-core.ts
      bundledConfig()                                  local-backend/config.ts -> core/config/validate.ts (CONFIG-001)
      PGlite.create({ fs: MemfsFrontendFS(IdbStorage("factory-atlas-db")) })   local-backend/idb-storage.ts loads saved blocks
      prepareDatabase()                                core/setup.ts (tables, admin, sample data on first start)
    worker says {started, ok} -> backend ready

each request:
  localRequest()                                       web/src/lib/api.ts
    uploaded file -> bytes; post {request, id, input} to the worker
  worker: handleRequest(ctx, input)                    backend-core.ts
    dispatch(ctx, input)                               server/src/core/router.ts
      userForToken() -> match route -> handler         same code as server mode (section 3)
    every query's changed blocks saved to IndexedDB    idb-storage.ts apply(), before the answer is sent
  reply {status, body} or {status, binary}
  api.ts turns it into a Response: JSON, or a Blob for files
images and 3D models: useFileUrl(path) asks for the file the same way and shows it from a blob: address   lib/fileUrl.ts
```

