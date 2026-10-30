# Phases

The project is built in phases. Each phase ends with: tests passing, docs updated (`decisions.md`, `flow.md`, `memory.md`, `CHANGELOG.md`), a quiz for the project owner, and the owner's approval.

Status: **done**, **in review** (built and tested, waiting for owner approval and quiz), **next**, **later**.

| # | Phase | Contents | Status |
|---|---|---|---|
| 0 | Documents | prd, architecture, rules, phases, design, decisions, flow, config, troubleshooting, CLAUDE.md | in review |
| 1 | Foundation | Project setup, config files and checks, database, sign-in, roles, forced password change, idle sign-out, theme system | in review |
| 2 | Admin | Users (create, edit, assign factories, permission switch, deactivate, reset password), factories, machines, photos, 3D models, change log | in review |
| 3 | Home page | Factory cards, search and filters, globe with country, state, city flight, slide for nearby factories | in review |
| 4 | Factory page | Machine cards with status, status filter, 3D factory floor with focus and 360 degree switch | in review |
| 5 | Machine page | Details, shifts, 14 days, previous and next, manual status edit | in review |
| 6 | Excel upload | Template download, preview with errors and warnings, confirm, corrected uploads, upload history and download | in review |
| 7 | History | Date range grid and totals per machine | in review |
| 8 | Packaging | Windows and Linux installers (GitHub workflow), system status page, legal pages, tests in CI. (Docker setup was here; removed in 8b.) | in review |
| 8b | Browser mode | Whole app runs in the browser with its own database (PGlite), no install; website on GitHub Pages; Docker removed; same backend code for both modes | in review |
| 9 | Client launch | Everything in the launch checklist in `docs/prd.md` for the first client | next |
| 10 | Machine page, part 2 | Owner to decide what else the machine page shows (planned in the first discussions) | later |
| 11 | Uptime and downtime | Analysis over time | later |
| 12 | Mac and Android apps | Same code through Tauri | later |
| 13 | Office network mode | Run the server on a computer in the client's office, no internet (server mode) | later |
| 14 | Live machine status | Read status directly from machines (PLC or sensors) as a plug-in | later |
| 15 | Shared data again | Move from browser mode to server mode for a client who needs several computers to share data | later |

All of phases 0 to 8 were built together on request of the owner, then tested. Each phase is still reviewed and quizzed separately before it counts as done.

## Phase checklist (copy for every phase)
- [ ] Scope agreed with the owner
- [ ] Code written on a separate branch
- [ ] New config fields documented in `docs/config.md`
- [ ] New error codes documented in `docs/troubleshooting.md`
- [ ] Decisions logged in `docs/decisions.md`
- [ ] `docs/flow.md` updated if the order of execution changed
- [ ] `npm test`, `npm run typecheck`, `npm run test:e2e` pass
- [ ] `docs/memory.md` and `CHANGELOG.md` updated
- [ ] Owner quizzed (3 to 5 questions) and passed
- [ ] Merged
