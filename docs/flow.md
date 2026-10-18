# Code flow

Where the code starts, in what order things run, and which function calls which. Paths are relative to the project folder. Update this file in the same change whenever the order changes.

## 1. Server start

Entry point: `server/src/index.ts` (built to `server/dist/index.js`).

```
main()                                         server/src/index.ts
  readEnv()                                    server/src/env.ts            env vars -> Env object
  bootstrap(env)                               server/src/bootstrap.ts
    loadConfig(configDir)                      server/src/config/load.ts
      readJson(...) x5 with schemas            server/src/config/schema.ts  any problem -> ConfigError (CONFIG-001), server stops
      check logo/favicon files, duplicate Excel names, legal files
    createPool(DATABASE_URL)                   server/src/db/pool.ts
    SELECT 1                                   fails -> "DB-001", server stops
    migrate(db)                                server/src/db/migrate.ts     runs new files in db/migrations
    ensureAdmin(db, INITIAL_ADMIN_PASSWORD)    creates "admin" on an empty database
  seedSampleData(db)  (only if SEED_SAMPLE_DATA=true and no factories yet)   server/src/scripts/sample-data.ts
  buildApp(ctx)                                server/src/app.ts
    register cors, rate-limit, multipart
    onRequest hook -> loadUser()               server/src/auth/guard.ts     sets req.user from the Bearer token
    setErrorHandler                            AppError -> { error: { code, message } }
    systemRoutes, authRoutes, factoryRoutes, uploadRoutes, adminRoutes   server/src/routes/*.ts
    serve web/dist (if built)
  app.listen(PORT)
```

## 2. Any API request

```
HTTP request
  onRequest hook: loadUser(req)                server/src/auth/guard.ts
    bearerToken(req) -> resolveSession(db, token, idleMinutes)   server/src/auth/sessions.ts
      UPDATE sessions SET last_seen_at ... RETURNING user        (expired or unknown -> null)
  route handler                                server/src/routes/<file>.ts
    requireUser / requireAdmin(req)            AUTH-002 / AUTH-005 / PERM-001
    parse(schema, req.body or req.params)      server/src/validate.ts       REQ-001
    assertFactoryAccess(db, user, factoryId)   PERM-002
    requireStatusPermission(user)              PERM-003 (uploads and manual edits)
    services/*.ts                              database reads and writes
    audit(...)                                 server/src/services/audit.ts (changes only)
  reply JSON  |  thrown AppError -> error handler in app.ts
```

## 3. App start

Entry point: `web/src/main.tsx` -> `<App />` in `web/src/App.tsx`.

```
App
  QueryClientProvider
  ConfigProvider                       web/src/config/ConfigProvider.tsx
    api.get("/api/config")             web/src/lib/api.ts, address from lib/serverAddress.ts
      fails -> ConnectionScreen        (retry, change server address)
      ok    -> applyTheme(): CSS variables, title, favicon
  AuthProvider                         web/src/auth/AuthProvider.tsx
    token in sessionStorage? -> GET /api/auth/me
    starts the idle timer (sessionIdleMinutes)
  SceneProvider                        web/src/state/SceneProvider.tsx    what the background shows
  HashRouter
    BackgroundLayer                    web/src/background/BackgroundLayer.tsx
    Routes -> page                     Protected() sends to /login or /account/password when needed
    DebugPanel (if app.json debug)
```

## 4. Signing in

```
LoginPage.submit()                     web/src/pages/LoginPage.tsx
  useAuth().login(username, password)  AuthProvider
    api.post("/api/auth/login")        -> server/src/routes/auth.ts
      verifyPassword() (bcrypt)        wrong -> AUTH-001, inactive -> AUTH-003
      createSession() -> token
    setToken(token)                    sessionStorage
  <Navigate> to /account/password (first sign-in) or /
```

## 5. Home page and the globe

```
HomePage                               web/src/pages/HomePage.tsx
  useFactories() -> GET /api/factories          lib/queries.ts -> routes/factories.ts -> services/factories.ts listFactories()
  selectedId from the address (?f=3)
  useScene({ kind: "globe", factories, selectedId })   tells the background what to draw

BackgroundLayer sees scene.kind "globe" -> lazy loads GlobeBackground
GlobeBackground                        web/src/background/globe/GlobeBackground.tsx
  loadGeo()                            geoData.ts   fetch geo/countries.json, geo/states.json (once)
  builtInStyle() or onlineStyle()      globeStyle.ts
  new MapLibreMap(...) -> on "load" -> new GlobeDirector(...)    globeDirector.ts
  when selectedId changes:
    director.showFactory(factory)      or director.clearSelection()

GlobeDirector.showFactory(f)
  planFlight(previous, f, nearDistanceKm)       shared/src/geo.ts -> "first" | "slide" | "long"
  reduce motion -> jumpTo city, highlight, pin
  slide -> highlight(f), animate pin and easeTo city together
  first/long:
    findCountry() -> flyTo country box          (zooms out and rotates for long trips)
    findState()   -> highlight state, easeTo state box
    placeMarker() -> easeTo city
  onMoving(true/false) -> SceneProvider.moving -> BackgroundLayer brightens the background while moving

Click "View factory" -> navigate to /factories/3
```

## 6. Factory page and the 3D floor

```
FactoryPage                            web/src/pages/FactoryPage.tsx
  useFactory(id) -> GET /api/factories/:id      listFactories + listMachines (current status per machine)
  selectedId from ?m=12
  useScene({ kind: "floor", factoryId, machines, selectedId })

BackgroundLayer -> lazy loads FactoryFloor     web/src/background/floor/FactoryFloor.tsx
  layoutMachines(machines)             layout.ts   fixed spiral positions
  MachineOnFloor x N                   status ring colour, MachineModel (MachineModels.tsx: placeholder or .glb)
  CameraRig                            on selectedId change: tween to focusCamera() or overviewCamera()
                                       switching machines adds switchSweepDegrees around the floor
  usePanelOffset()                     shifts the picture so the subject sits beside the cards panel

Click "Open machine" -> /factories/3/machines/12 -> MachinePage keeps the floor focused on that machine
```

## 7. Excel upload

```
UploadPage.choose(file)                web/src/pages/UploadPage.tsx
  api.upload("/api/factories/:id/uploads/preview", file)
    -> uploadRoutes preview            server/src/routes/uploads.ts
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
MachinePage -> EditStatus.submit()     web/src/pages/MachinePage.tsx
  useManualStatus(id).mutate()         lib/queries.ts
    PUT /api/machines/:id/status       server/src/routes/factories.ts
      feature on, requireStatusPermission, assertFactoryAccess, shift <= shiftsPerDay, no future date
      INSERT status_records (source "manual"), audit("status.manual")
```

## 9. Admin

```
AdminPage (?tab=users | factories | log)        web/src/pages/admin/AdminPage.tsx
  UsersTab      -> /api/admin/users ...          server/src/routes/admin.ts
  FactoriesTab  -> /api/admin/factories ..., /api/admin/machines ..., photo and model uploads (services/files.ts saveFile)
  AuditTab      -> /api/admin/audit
```
