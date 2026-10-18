# Factory Atlas

An installable app that shows a company's factories on a 3D globe and the status of every machine in them. Status comes from a daily Excel upload or a manual edit; there is no live connection to the machines. Each client gets its own server and its own branding, set entirely through the `config/` folder.

- Windows and Linux desktop app (Tauri), also usable in a browser
- Sign-in with username and password; the admin creates users and decides who sees which factory
- Home: factory cards, with a globe behind them that flies country, then state, then city
- Factory: machine cards with status, with a 3D factory floor behind them
- Machine: details, shifts, last 14 days, manual status edit (if allowed)
- Daily Excel upload with a preview, permanent upload history, corrected uploads
- History grid, change log, system status page, debug panel

## Start here
| I want to | Read |
|---|---|
| Run it on my laptop | `SETUP.md` |
| Change the branding, Excel columns, animations | `docs/config.md` |
| Fix a problem or understand an error code | `docs/troubleshooting.md` |
| Know what the product must do | `docs/prd.md` |
| See how the code is organised | `docs/architecture.md` |
| Follow how a click travels through the code | `docs/flow.md` |
| Know why something was built this way | `docs/decisions.md` |
| Know the coding rules and what an AI may do | `docs/rules.md` |
| See what is built and what is next | `docs/phases.md`, `docs/memory.md` |
| Colours, fonts, motion | `docs/design.md` |

## Quick start (Docker)
```
copy .env.example .env
docker compose up -d --build
```
Open http://localhost:4000 and sign in as `admin` with the password from `.env`.

## Project layout
```
config/    everything a client changes
docs/      all documentation
shared/    types used by server and app
server/    Node.js server, database, Excel handling
web/       the app (screens, globe, 3D floor)
desktop/   desktop app wrapper (Tauri)
e2e/       browser tests
```

## Credits
Country and state boundaries: Natural Earth (public domain). Online map: OpenFreeMap, OpenMapTiles, OpenStreetMap contributors.
