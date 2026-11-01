# Changelog

## 0.4.0 (2026-10-31)
Ideas taken from the owner's other projects (Edge Watch and the EdgeAI launcher page).

### Added
- Light / Dark button in the top bar and on the sign-in screen. The choice is kept in that browser. New settings: `theme.json` `allowUserSwitch`, `globeLight`, `factoryFloorLight`, and `mode` can be `system`. The built-in globe and the 3D floor have light colours too.
- How old the statuses are: "Data from 30 Oct" on every factory row, with a warning when it is older than `app.json` `dataAgeWarningDays` (default 2). The factory pages show a banner then, with a link to upload the latest sheet.
- 3D floor toolbar: machine names above the machines (`app.json` `showMachineNamesOnFloor`), Stop turning, and Whole floor.
- History tab: Download CSV for the chosen dates and machine, safe to open in Excel.
- The server sends `latestWorkDate` with each factory.

### Changed
- The city name next to the globe pin is readable on light and dark maps.
- The hint on the 3D floor now says "Click a machine here or in the list to see its details".

## 0.3.0 (2026-10-30)
Clearer screens and a faster globe.

### Changed
- The globe and the 3D factory floor are now panels next to the lists, not dimmed backgrounds. People can drag and zoom the globe, click its pins, and click machines in 3D.
- Home: status totals at the top, factory list with an Open button on each row, globe panel with the selected factory and an "Open factory" button.
- Factory: breadcrumb, status totals and tabs at the top; machine tiles on the left; 3D floor and the chosen machine's details on the right. The separate machine page is replaced by these details (its address still works).
- Globe starts in about 1 second: state outlines load per country, the map style and outlines load at the same time, no blur, rotation pauses when hidden or when someone drags the globe.
- Online map style: OpenFreeMap Liberty.
- Tablet and phone: the globe or 3D view comes first, then details, then the list.

### Removed
- Settings `theme.json` `background.*`, `panelOpacity`, `animation.json` `cards.*`, and the Framer Motion library.

### Added
- Server setting `LOGIN_RATE_LIMIT_PER_MINUTE`.

## 0.2.0 (2026-10-30)
Browser mode: the app runs without installing anything.

### Added
- Browser mode (default): the whole app, including its database, runs in the browser or desktop window. Data is kept in that browser on that computer. Uses PGlite, PostgreSQL compiled to WebAssembly, with every change saved to IndexedDB.
- Website: GitHub Pages workflow publishes the browser version on every push to `main`.
- The backend code now lives in `server/src/core` and runs unchanged in both modes; the API test suite runs on PostgreSQL and on PGlite.
- Browser tests run in both modes; new test for factory photo upload; new test that browser storage keeps data after closing.
- Error codes LOCAL-001, LOCAL-002, LOCAL-003. Debug panel shows the data mode and how the built-in backend runs.
- "Starting" indicator while the app starts.

### Changed
- Desktop installers are self-contained unless a server address is given.
- `npm run dev` now starts browser mode with no database; `npm run dev:server` starts server mode.
- Security fix in a Fastify dependency (fast-uri).

### Removed
- Docker: `Dockerfile`, `docker-compose.yml`, `.dockerignore`.

## 0.1.0 (2026-10-19)
First complete version, phases 0 to 8 (see `docs/phases.md`).

### Added
- Sign-in with forced password change, idle sign-out, roles (admin, user), per-user factory access, upload and edit permission switch.
- Home page with factory cards, search and filters, and a 3D globe that flies to each factory (country, state, city), slides between nearby factories, and rotates when idle.
- Factory page with machine cards, status filter, and a 3D factory floor with camera focus and a 360 degree sweep between machines.
- Machine page with shift table, 14-day grid, previous and next, manual status edit.
- Daily Excel upload: template download, preview with errors and warnings, confirm, corrected uploads that replace a day while keeping the old file, upload history and download.
- History tab with date range grid and totals.
- Admin: users, factories, machines, factory photos, 3D model upload, change log.
- Config folder with startup checks, error codes, debug panel, system status page, privacy and terms pages.
- Sample data option, Docker setup, Linux and Windows installer workflow, automated tests (41 server, 12 browser).
