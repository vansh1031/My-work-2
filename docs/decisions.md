# Decisions

Every meaningful choice, why it was made, and what we accepted in return. Newest at the bottom. Never delete an entry: if a decision changes, add a new one that replaces it and say which.

Format: **What** / **Why** / **Trade-off accepted**.

---

### D-001 One repository with three parts (shared, server, web)
- **What:** npm workspaces. `shared/` holds types used by both server and app.
- **Why:** the shape of every API answer is defined once (`shared/src/api.ts`). If the server changes a field, the app fails to compile instead of failing in front of a user.
- **Trade-off:** slightly more setup than two separate projects.

### D-002 Tauri for the desktop app, not Electron
- **What:** the installable app is a Tauri 2 window around the web app.
- **Why:** installers are about 10 MB instead of 100+ MB, it uses less memory, and the same project can later build Mac and Android apps (both on the roadmap).
- **Trade-off:** building needs Rust installed; on Windows the app uses the system WebView2 (already present on Windows 10 and 11).

### D-003 React + TypeScript + Vite for the screens
- **Why:** widely known, easy to hire for, strict types catch mistakes early, and both 3D libraries we need work well with React.
- **Trade-off:** none significant.

### D-004 MapLibre for the globe
- **What:** MapLibre GL 6 in globe projection, not Mapbox, Google Maps, CesiumJS or a plain three.js sphere.
- **Why:** free and open source with no API key; real globe projection; its `flyTo` already zooms out for long trips and glides for short ones, which is exactly the requested behaviour; it can zoom from the whole Earth to street level.
- **Trade-off:** CesiumJS has more realistic terrain, but it is far heavier and its best imagery is paid.

### D-005 Built-in globe, online map tiles on top when available
- **What:** the app ships country and state outlines (Natural Earth, public domain, about 2 MB, 0.4 MB compressed). It always draws these. If `map.useOnlineTiles` is on and the online style loads within 5 seconds, that style is used instead, with our highlight and pin layers on top.
- **Why:** the globe works even when the map service is down or blocked, and the state highlight needs real state outlines anyway.
- **Trade-off:** the built-in globe has no streets or city names; its city zoom is capped near the state level (D-022). Online tiles need attribution, shown in the footer.

### D-006 Fastify with plain SQL, no ORM
- **Why:** every query is visible and readable in one place (`server/src/services`, `server/src/routes`). An ORM hides what the database actually does, which makes debugging without deep knowledge harder.
- **Trade-off:** a bit more typing for each query.

### D-007 PostgreSQL
- **Why:** reliable, free, handles the "newest record per machine and shift" view (`effective_status`) well, runs anywhere including Docker and a client's own server.

### D-008 One server per client
- **Why:** each client's data is fully separate; a problem or update for one client cannot affect another; rebranding is just that server's config folder.
- **Trade-off:** more servers to run as clients grow. A shared multi-client server can be added later if needed.

### D-009 Sign-in with a bearer token, stored only for the session
- **What:** login returns a random token. The app keeps it in sessionStorage and sends it as `Authorization: Bearer`. The server stores only its SHA-256 hash. Sessions end after `sessionIdleMinutes` without requests, and the app also signs out after that much time without mouse or keyboard activity.
- **Why:** cookies are unreliable when the desktop app (its own origin) talks to a server on another address. sessionStorage means closing the app signs out.
- **Trade-off:** users sign in again after closing the app. A stolen database copy cannot be used to sign in.

### D-010 Uploads and status history are never changed or deleted
- **What:** every upload is kept, including the original file. Every status (from an upload or a manual edit) is a new row in `status_records`. The view `effective_status` picks the newest valid row per machine, day and shift. A corrected file for the same day marks the old upload `superseded_by` the new one.
- **Why:** the owner asked for no undo, for security and audit. This design still allows corrections, and the full trail is always available.
- **Trade-off:** the database grows forever (very slowly: one small row per machine per shift).

### D-011 Photos and 3D models are served by unguessable file names
- **What:** `GET /api/files/<32 random hex>.jpg` works without a sign-in header.
- **Why:** `<img>` tags and the 3D model loader cannot send our sign-in header. Each name has 128 random bits, so it cannot be guessed.
- **Trade-off:** anyone who is given a direct file link can open that one photo or model. Excel files and all data still require sign-in.

### D-012 The upload is checked twice and rejected as a whole if any row is wrong
- **What:** the preview checks the file without saving. Confirm sends the file again and the server checks it again before saving. If any row has an error, nothing is saved.
- **Why:** half-saved days are confusing and hard to correct. Checking again on confirm protects against a stale preview or a request from outside the app.
- **Trade-off:** one bad row means fixing the file and uploading again.

### D-013 One Excel file holds one day
- **Why:** matches the daily routine described by the owner and makes "replace this day" simple and safe.
- **Trade-off:** back-filling many days means many uploads.

### D-014 No 3D text labels above machines
- **What:** the drei `Html` helper was removed from the factory floor.
- **Why:** it caused a React "removeChild" crash when leaving or changing the floor. Selecting a card flies the camera to the machine, so labels are not needed to find it.
- **Trade-off:** machine IDs are not shown inside the 3D scene.

### D-015 Hash-based screen addresses (`/#/factories/3`)
- **Why:** the desktop app loads files from disk, where a normal address like `/factories/3` would not exist on reload. Hash addresses work in the desktop app, in the browser and behind any server.
- **Trade-off:** addresses contain `#`.

### D-016 Machines are placed on a sunflower spiral, always in the same spot
- **Why:** looks natural rather than a rigid grid, works for any number of machines, and the same machine is always in the same place, so people learn the layout.
- **Trade-off:** it does not match the real floor plan. A real layout could be added as x/y fields on machines later.

### D-017 Placeholder machine shapes until a real model is uploaded
- **What:** simple shapes per machine type; the admin can upload one `.glb` per machine, scaled automatically.
- **Why:** real models were not available. Placeholders are honest about being placeholders (the machine page says so).

### D-018 One switch for uploading and manual editing
- **What:** `users.can_update_status`. Admins always have it.
- **Why:** requested by the owner; one switch is easy to understand.

### D-019 Sample data is labelled
- **What:** `SEED_SAMPLE_DATA=true` adds 6 factories (marked `is_sample`, shown with a "Sample" tag), 6 machines each, 14 days of statuses, and two sample users (`supervisor`, `viewer`).
- **Why:** something to try on a fresh install without breaking the "no fake data" rule.
- **Trade-off:** must be off for a real client (launch checklist).

### D-020 Forced newer `uuid` inside ExcelJS
- **What:** `overrides.uuid = ^11.1.1` in the root `package.json`.
- **Why:** ExcelJS 4.4.0 depends on uuid 8, which has a moderate security advisory (GHSA-w5hq-g745-h8pq). uuid 11 keeps the same API. All Excel tests pass with it.

### D-021 MapLibre worker file set explicitly
- **What:** `setWorkerUrl(...)` with the worker file bundled by Vite (`?url` import).
- **Why:** MapLibre 6 looks for its worker next to its own script, which does not survive bundling or the desktop app. Without this the globe stays blank.

### D-022 Built-in globe stops zooming near the state level
- **What:** with the built-in style, city zoom is `min(cityZoom, stateZoom + 1.3)`.
- **Why:** without streets, a city-level zoom shows only a flat colour. Stopping earlier keeps the state outline visible around the pin.

### D-023 Factories and machines live in the database, not config
- **Why:** the app is online and the admin adds factories and machines from screens. Config is for things we set once per client.

### D-024 Manual edits: newest wins, no future dates
- **What:** a manual edit is a new record; it overrides the uploaded value for that shift until a newer upload for that day arrives. Future dates are refused.

### D-025 An admin cannot deactivate themselves or remove their own admin role
- **Why:** prevents locking everyone out by accident.

### D-026 Docker image copies installed packages from the build step (replaced by D-034)
- **What:** the image runs `npm ci` once, builds, runs `npm prune --omit=dev`, and copies `node_modules` into the final image.
- **Why:** `npm ci --workspace server` crashed with an npm internal error. This way is simple and reliable.
- **Trade-off:** the image is larger (about 700 MB) because it also contains the web app's packages.

### D-027 Config is read once at server start (browser mode: built into the app, see D-035)
- **Why:** simple and predictable; a broken file stops the server with a clear message instead of failing halfway through the day.
- **Trade-off:** after editing config, restart the server (`docker compose restart app`).

### D-028 Placeholder drawings instead of generated factory photos
- **What:** cards show a "Photo pending" drawing; the admin uploads photos per factory.
- **Why:** the owner was fine with AI photos for now, but generating images is not possible from the build environment, and a clear placeholder is more honest than a stock image. Real photos can be uploaded at any time from Admin.

### D-029 Browser mode: the whole app, including its database, runs in the browser
- **What:** a new data mode (`config/app.json` `dataMode: "browser"`, now the default). The backend runs inside the app on PGlite, which is PostgreSQL compiled to WebAssembly, with data kept in the browser's IndexedDB storage. The app is published as a website with GitHub Pages and also packaged in the desktop installer.
- **Why:** the owner asked to run the app without installing anything for now, with no change to features or screens. A browser page is the only thing that needs no installation. Using real PostgreSQL in the browser means the same SQL runs in both modes, so nothing had to be rewritten.
- **Trade-off:** in browser mode data stays in one browser on one computer; users on different computers do not share data. Sharing needs server mode. The first visit downloads about 4 MB (compressed) for the database engine, cached afterwards. The first start takes a few seconds to create the database.

### D-030 One backend code base for both modes
- **What:** routes, services, checks and SQL moved to `server/src/core`, with no Node or Fastify imports. A route is a plain `{ method, path, handler }`. Server mode registers the list with Fastify (`server/src/app.ts`); browser mode calls `dispatch()` (`server/src/core/router.ts`). The database is an interface (`core/db.ts`) with two adapters: node-postgres and PGlite.
- **Why:** two separate backends would drift apart. Now one change fixes both, and the API test suite runs against both engines (`server/test/api.postgres.test.ts`, `api.pglite.test.ts`).
- **Trade-off:** core code may only use what both Node and browsers have (Web Crypto instead of Node's crypto, Uint8Array instead of Buffer).

### D-031 The built-in backend runs in a background worker, preferably shared by all tabs
- **What:** `web/src/local-backend` starts the backend as a SharedWorker. If that cannot start, a normal Worker; if that fails too, inside the page (`index.ts` tries them in order and logs `LOCAL-003` for each failure).
- **Why:** password checks are slow on purpose and the 3D views need the page's time; on the page itself a password change took 25 seconds on a slow machine, in a worker 2. A SharedWorker gives all tabs one database. The page fallback exists because some desktop windows (WebKit on Linux) refuse browser storage inside workers.
- **Trade-off:** with a normal Worker or in the page, only one tab at a time can use the data (`LOCAL-002` in the others).

### D-032 The page downloads the database engine files and hands them to the worker
- **What:** `pglite.wasm`, `initdb.wasm` and `pglite.data` are fetched by the page and sent to the worker as bytes. The logo and favicon are built in as data addresses.
- **Why:** in the Linux desktop window a worker cannot download anything (the `tauri://` address), and WebKit cannot read a downloaded Blob inside a worker.

### D-033 Browser storage written block by block, every change saved before answering
- **What:** `web/src/local-backend/idb-storage.ts` stores PGlite's files in IndexedDB as 64 KB blocks, through PGlite's change-tracking file system (`memfs-frontend`). Each query saves only the blocks it changed, and the answer comes back after the save is complete.
- **Why:** PGlite's built-in `idb://` storage rewrites its whole folder after each query. That was too slow (23 seconds to add sample data), and its fast "relaxed" option saved in the background where a race (error `ErrnoError` 44, file not found) silently lost changes. Tested: data survives closing and reopening (`server/test/browser-storage.test.ts`, and a browser check).
- **Trade-off:** our own storage code to maintain (about 150 lines). The database files are loaded into memory at start, as with PGlite's own storage.

### D-034 Docker removed
- **What:** `Dockerfile`, `docker-compose.yml` and `.dockerignore` deleted at the owner's request.
- **Why:** browser mode needs no server; server mode can run with Node and PostgreSQL directly (`SETUP.md` Part C4). Docker can be added back for server deployments later.

### D-035 Browser mode builds the config into the app
- **What:** in browser mode the `config/` files are copied into the app when it is built and checked at startup with the same rules as on a server.
- **Why:** there is no server to read them from.
- **Trade-off:** after changing config, rebuild the app (pushing to `main` rebuilds the website automatically). Run `npm run check-config` before building.

### D-036 Desktop installers: self-contained by default
- **What:** the Desktop installers workflow builds browser mode unless a server address is typed, then server mode. The desktop window allows WebAssembly (`'wasm-unsafe-eval'` in its content security policy), which the built-in database needs.
- **Trade-off:** desktop data stays on that computer, as in the browser.

