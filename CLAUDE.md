# Instructions for AI assistants

Read these before doing anything, in this order:
1. `docs/memory.md`: where the project stands right now.
2. `docs/rules.md`: what you must always do, must never do, and must ask before doing.
3. Only then the files your task touches. Use `docs/architecture.md` to find them and `docs/flow.md` to see how they connect. Do not read the whole codebase.

## How we work
- Work in the phase the owner agreed (`docs/phases.md`). Ask before going outside it.
- Anything a client might want different goes in `config/`, documented in `docs/config.md`.
- Every meaningful decision goes into `docs/decisions.md` with its reason and trade-off.
- Every new error gets a code and a row in `docs/troubleshooting.md`.
- Update `docs/flow.md` when the order of execution changes.
- Before finishing: `npm run typecheck`, `npm test`, `npm run test:e2e` must pass. Update `docs/memory.md` and `CHANGELOG.md`.
- For any major change, quiz the owner with 3 to 5 questions about what changed and why before it is merged.

## Commands
| Command | What it does |
|---|---|
| `npm run dev` | The app with live reload, browser mode (no database to install) |
| `npm run dev:server` | Server and app with live reload, server mode (needs PostgreSQL and `DATABASE_URL`) |
| `npm run build` | Build the app (browser mode and server mode) and the server |
| `npm test` | Backend tests on PGlite and PostgreSQL (PostgreSQL at `TEST_DATABASE_URL`) |
| `npm run test:e2e` | Browser tests in both modes (server mode needs `E2E_DATABASE_URL`) |
| `npm run typecheck` | TypeScript check of server and app |
| `npm run check-config` | Check the config folder |
| `npm run desktop:build` | Build the desktop installer for this computer |

## Two data modes
The backend in `server/src/core` runs either in the browser (browser mode, default) or on a server (server mode). Code in `server/src/core` must work in both: no Node-only imports. See `docs/rules.md` and `docs/flow.md` section 10.

## Writing style for user-facing text
Plain English, short sentences, no jargon, no em-dashes, no emoji. See `docs/design.md`.
