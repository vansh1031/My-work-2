# Memory

Short summary of where the project stands, for a new chat or a new AI. Keep it short. Update it at the end of every change.

Last updated: 2026-10-19

## Current state
- Phases 0 to 8 are built and tested; waiting for owner review and quizzes (`docs/phases.md`).
- Version 0.1.0.
- Tests: 41 server tests and 12 browser tests pass.
- Docker setup tested: `docker compose up` starts database and server with sample data.
- Linux desktop app (.deb) built and started; it connects to the server and draws the globe. The Windows installer is built by `.github/workflows/desktop.yml` on GitHub and has not been tried on a real Windows computer yet.
- The online map tiles (OpenFreeMap) could not be reached from the build environment, so only the built-in globe was seen working. The online style path falls back to the built-in globe on any failure.

## Not yet done
- No GitHub repository connected yet (owner will share the link). Code exists only in the build environment and in the zip handed to the owner.
- No real factory photos (cards show "Photo pending"); no real 3D models (placeholder shapes).
- Owner's real Excel template not received yet; the built-in template is a draft.
- Machine page content beyond the basics to be decided by the owner (phase 10).

## Next step
1. Owner reviews the app and answers the phase quizzes.
2. Connect the GitHub repository, push, run the desktop workflow to get the Windows installer.
3. Try on the owner's Windows laptop (`SETUP.md`).
4. Adjust `config/excel.json` to the owner's real template.

## Things to know before changing code
- History tables are append-only (D-010). Never update or delete rows in `uploads`, `status_records`, `audit_log`.
- The background never talks to the server: pages describe the scene with `useScene()` and `BackgroundLayer` draws it.
- MapLibre 6 needs `setWorkerUrl` (D-021). drei `Html` crashes on unmount (D-014).
- The server serves only files that existed when it started: restart it after rebuilding the web app.
- Config is read only at server start (D-027).

## Known issues
- On a 4K screen, software rendering (no graphics card) is slow; real graphics hardware is fine.
- Docker image is about 700 MB (D-026).
