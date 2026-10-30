# Factory Atlas

An app that shows a company's factories on a 3D globe and the status of every machine in them. Status comes from a daily Excel upload or a manual edit; there is no live connection to the machines. Each client gets its own branding, set entirely through the `config/` folder.

**Try it without installing anything:** https://vansh1031.github.io/My-work-2/ (sign in as `admin` / `change-me-now`, see `SETUP.md`).

- Runs in the browser with its own built-in database (browser mode, default), or against a shared server (server mode, later)
- Windows and Linux desktop app (Tauri), self-contained
- Sign-in with username and password; the admin creates users and decides who sees which factory
- Home: factory cards, with a globe behind them that flies country, then state, then city
- Factory: machine cards with status, with a 3D factory floor behind them
- Machine: details, shifts, last 14 days, manual status edit (if allowed)
- Daily Excel upload with a preview, permanent upload history, corrected uploads
- History grid, change log, system status page, debug panel

## Start here
| I want to | Read |
|---|---|
| Use it, or run it on my laptop | `SETUP.md` |
| Change the branding, Excel columns, animations | `docs/config.md` |
| Fix a problem or understand an error code | `docs/troubleshooting.md` |
| Know what the product must do | `docs/prd.md` |
| See how the code is organised | `docs/architecture.md` |
| Follow how a click travels through the code | `docs/flow.md` |
| Know why something was built this way | `docs/decisions.md` |
| Know the coding rules and what an AI may do | `docs/rules.md` |
| See what is built and what is next | `docs/phases.md`, `docs/memory.md` |
| Colours, fonts, motion | `docs/design.md` |

## Quick start for developers
```
npm install
npm run dev
```
Open http://localhost:5173. No database or server to install.

## Project layout
```
config/    everything a client changes
docs/      all documentation
shared/    types used by server and app
server/    the backend: core/ runs in both modes, node/ and app.ts only on a server
web/       the app (screens, globe, 3D floor) and local-backend/ (the built-in backend)
desktop/   desktop app wrapper (Tauri)
e2e/       browser tests, run in both modes
```

## Credits
Country and state boundaries: Natural Earth (public domain). Online map: OpenFreeMap, OpenMapTiles, OpenStreetMap contributors. Built-in database: PGlite (PostgreSQL compiled to WebAssembly).
