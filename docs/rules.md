# Rules

How we build. Applies to people and to AI assistants. An AI must read this file before changing anything.

## 1. Always
1. **Read `docs/memory.md` first**, then the files the change touches.
2. **Small steps.** One phase or one feature at a time (`docs/phases.md`).
3. **Anything a client may want different goes in `/config`**, never hard-coded: names, colours, texts, speeds, limits, column names, status words, feature switches.
4. **Every new config field** gets: a rule in `server/src/core/config/schema.ts`, a type in `shared/src/config.ts`, a line in `docs/config.md`.
5. **Every new error** gets a code in `server/src/core/errors.ts` (server) or a prefix code in the app, and a row in `docs/troubleshooting.md` with cause and fix.
6. **Every meaningful decision** gets an entry in `docs/decisions.md`: what, why, what we gave up.
7. **When the order of execution changes**, update `docs/flow.md` in the same change.
8. **At the end of a change**, update `docs/memory.md` (state, next step, open issues) and `CHANGELOG.md`.
9. **Tests must pass before a change is accepted**: `npm test`, `npm run typecheck`, `npm run test:e2e`. New behaviour gets a test. Backend changes are tested on both engines by the API suite; screens in both modes by the e2e tests.
10. **Quiz before merge.** For any major change, the AI asks the project owner 3 to 5 questions about what changed and why. The change is merged only if the owner passes.

## 2. Never
1. Never delete or change saved history: `uploads`, `status_records`, `audit_log` are append-only. Corrections are new rows.
2. Never delete factories or machines; archive them.
3. Never edit a migration file that has run anywhere. Add a new numbered file.
4. Never build SQL by joining strings with user input. Use `$1, $2` parameters.
5. Never put secrets in config files or in the repository. Secrets are environment variables (`.env`, not committed).
6. Never show sample or generated numbers as if they were real. Sample data is marked `is_sample` and labelled "Sample".
7. Never break the rules in `docs/design.md` (no purple gradients, pill buttons, emoji icons, em-dashes, cursor effects, fake counters, AI-generated copy presented as real).
8. Never add a library without a reason recorded in `docs/decisions.md`.
9. Never import Node-only modules (`node:fs`, `node:crypto`, `Buffer`, `pg`, `fastify`) in `server/src/core`. That code also runs in the browser. Node-only code goes in `server/src/node` or `server/src/app.ts`.
10. Never switch the browser database back to PGlite's `idb://` storage or turn on `relaxedDurability`: both lost or slowed data in testing (D-033).
11. Never split `new Worker(new URL("./x.ts", import.meta.url))` or `new SharedWorker(...)` into two statements. The build only recognises and bundles a worker written in one piece; split, the worker silently fails to load.

## 3. Libraries we use (and what for)
| Need | Use | Do not add |
|---|---|---|
| Screens | React, React Router (HashRouter) | another UI framework |
| Server data | TanStack Query via `web/src/lib/queries.ts` | ad hoc fetch in components |
| Server calls | `web/src/lib/api.ts` only | fetch elsewhere |
| Animation | CSS transitions, and the camera classes for the globe and floor (`globeDirector.ts`, `CameraRig`) | animation libraries |
| Maps | MapLibre | Mapbox, Google Maps (paid, keys) |
| 3D | three.js, React Three Fiber, drei (useGLTF only) | drei `Html` (it crashes on unmount, see D-014) |
| Icons | lucide-react | emoji, icon fonts |
| Server | Fastify | Express alongside it |
| Validation | Zod | hand-written checks |
| Excel | ExcelJS | SheetJS from npm (old, unmaintained there) |
| Database | `pg` (server mode) and PGlite (browser mode), both through `core/db.ts`, plain SQL | an ORM, SQL that only one of the two understands |

## 4. Error handling
- **Backend (both modes):** throw `new AppError("CODE")` with a code from `core/errors.ts`. The error handler turns it into `{ error: { code, message, details } }` with the right HTTP status. Anything else is logged and answered with `SERVER-001`.
- **Bad input:** use `parse(schema, data)` from `validate.ts`. It answers `REQ-001` and names each bad field.
- **App:** every failed call becomes an `ApiError` with the server code, or `NET-001` when the server is unreachable. Show it with `<ErrorNotice error={...} />`, which prints the message and the code.
- **Browser mode startup:** if the built-in backend cannot start, every request answers `LOCAL-001` (or `CONFIG-001`, `LOCAL-002`) and the app shows "Cannot start" with the code.
- **Excel problems** are not exceptions: they are listed in the preview (`XL-0xx` errors block saving, `XL-1xx` warnings do not).
- **3D views (globe, floor):** failures must never break the page. `ViewPanel` catches them and shows a short message in the panel (`BG-001`).
- **Config:** a bad config stops the server at startup with `CONFIG-001` and a list of every problem (file, field, what is wrong).

## 5. Code style
- TypeScript strict mode everywhere.
- Names say what things are: `listFactories`, `assertFactoryAccess`, `GlobeDirector.showFactory`.
- A short comment at the top of each file says what it is for. Comments explain why, not what.
- Plain English in all user-facing text. Short sentences. No jargon, no em-dashes.
- Every screen works with keyboard: cards are focusable, Enter selects, Escape clears.

## 6. AI boundaries
An AI assistant working on this project:
- **May** change code, tests and docs inside the phase that was agreed.
- **Must ask first** before: adding a library, changing the database schema, changing a config field's name or meaning, deleting a file, changing anything in `.github/workflows`, or doing anything outside the agreed phase.
- **Must not**: push to the main branch directly, delete history data, disable tests to make them pass, commit secrets, or invent requirements that are not in `docs/prd.md`.
- **Must** leave the project with tests passing and `docs/memory.md` updated.
