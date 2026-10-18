# Changelog

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
