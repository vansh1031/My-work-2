# Memory

Short summary of where the project stands, for a new chat or a new AI. Keep it short. Update it at the end of every change.

Last updated: 2026-10-31 (0.4.0)

## Current state
- Version 0.4.0. Phases 0 to 8 built; browser mode (8b), clearer screens (8c) and ideas from the owner's other projects (8d) added. All waiting for owner review and quizzes (`docs/phases.md`).
- 0.4.0 added: Light / Dark switch, "Data from" date and old-data warning, 3D floor toolbar with machine names, History CSV download (D-043 to D-047). Ideas came from the owner's Edge Watch app and EdgeAI launcher page (`vansh1031/edge-watch-1`, `vansh1031/dashboard`).
- Screens: the globe and 3D floor are panels beside the lists (no background layer any more). Home shows status totals, a factory list with Open buttons and the globe; the factory page shows tiles, the 3D floor and the chosen machine's details.
- **Browser mode is the default:** the whole app, including the database (PGlite), runs in the browser or desktop window. No server, no install. Published as a website by `.github/workflows/pages.yml`.
- Server mode still works (Node + PostgreSQL) and uses the same backend code (`server/src/core`).
- Docker was removed at the owner's request (D-034).
- Repositories: `vansh1031/My-work` holds version 0.1.0 (with Docker). `vansh1031/My-work-2` holds this version.
- Tests: 73 backend tests (API suite on PGlite and PostgreSQL, browser storage, config, CSV, Excel, globe) and 28 browser tests (14 per mode) pass.
- Research for the redesign (similar products and open-source projects) is summarised in docs/decisions.md D-037.
- Checked by hand: Linux desktop app starts in browser mode, signs in, and stores its database on disk. Windows desktop app not tried on a real Windows computer yet.

## Not yet done
- GitHub Pages must be switched on once in the repository settings (SETUP.md A4) if it was not done automatically.
- No real factory photos (cards show "Photo pending"); no real 3D models (placeholder shapes).
- Owner's real Excel template not received yet; the built-in template is a draft.
- Machine page content beyond the basics to be decided by the owner (phase 10).

## Next step
1. Owner opens the website, tries it, and answers the quiz.
2. Build the Windows installer with the Desktop installers workflow and try it on Windows.
3. Adjust `config/excel.json` to the owner's real template.

## Things to know before changing code
- `server/src/core` runs in Node and in browsers: no Node-only imports there (rules.md, never 9).
- Browser storage: `web/src/local-backend/idb-storage.ts` (D-033). Do not go back to `idb://` or `relaxedDurability` (rules.md, never 10).
- Workers must be created as `new SharedWorker(new URL(...))` in one expression or the build will not bundle them (rules.md, never 11).
- In the Linux desktop window, workers cannot use IndexedDB or download files, so the backend falls back to running in the page there (D-031, D-032).
- History tables are append-only (D-010).
- The 3D views live in `web/src/views` and are shown through `components/ViewPanel.tsx`, which handles missing WebGL and failures (BG-001).
- State outlines are one file per country in `web/public/geo/states/`; rebuild with `npm run geo` (scripts/build-geo.mjs).
- MapLibre 6 needs `setWorkerUrl` (D-021). drei `Html` crashes on unmount (D-014); the 3D name tags are plain HTML moved each frame instead (D-045).
- Screens read `config.theme.mode` from `useConfig()`: it is always the mode in use (dark or light), never "system". `config.theme.globe` and `factoryFloor` are already the colours for that mode (D-043).
- Server mode: the server serves only files that existed when it started; restart it after rebuilding.

## Known issues
- Browser mode: data lives in one browser on one computer; clearing site data deletes it.
- First start in browser mode takes a few seconds (creating the database); about 4 MB is downloaded once.
- On a 4K screen, software rendering (no graphics card) is slow; real graphics hardware is fine.
- The online map style (Liberty) is light in both schemes; only the built-in globe and the 3D floor switch colours.
