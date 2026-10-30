# Changelog

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
