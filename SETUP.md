# Setup

Factory Atlas can run in two data modes (set in `config/app.json`, `dataMode`):

- **Browser mode (default, now):** the whole app, including its database, runs inside the browser or the desktop app. Nothing to install, no server. Data is kept on that one computer, in that one browser.
- **Server mode (later, for sharing):** a Factory Atlas server with a PostgreSQL database. Everyone sees the same data. Needs a server.

Features and screens are the same in both modes. The only difference is where the data lives.

---

## Part A: Use it without installing anything

### A1. Open the website
Once GitHub Pages is switched on for the repository (see A4), the app is at:

**https://vansh1031.github.io/My-work-2/**

Use a current Chrome, Edge or Firefox. The first start takes a few seconds while the built-in database is created; later starts are quicker.

### A2. Sign in
- Username `admin`, password `change-me-now`. You then choose your own password.
- Sample accounts (sample data is on):

| Username | Password | Can do |
|---|---|---|
| `supervisor` | `sample-pass-1` | Sees 4 factories, can upload Excel sheets and edit status |
| `viewer` | `sample-pass-1` | Sees 2 factories, view only |

### A3. Things to know in browser mode
- **Data stays in this browser on this computer.** Another computer, another browser, or a private window starts with its own fresh copy.
- Clearing the browser's site data for this address deletes the app's data (factories, users, uploads).
- Several tabs can be open at once; they share the same data.
- An internet connection is needed for the first visit and for the online map. After that the app also starts from the browser's cache.

### A4. Switching on the website (once)
GitHub Pages must be enabled once for the repository:
1. Open https://github.com/vansh1031/My-work-2
2. **Settings**, then **Pages**.
3. Under **Build and deployment**, **Source**: choose **GitHub Actions**.
4. Go to **Actions**, choose **Website (GitHub Pages)**, click **Run workflow** (or push any change to `main`).
5. After about 3 minutes the address in A1 works. Every push to `main` updates it automatically.

---

## Part B: Desktop app (installs like any other program)

The desktop installer contains the whole app with its built-in database, so it also works without a server.

### B1. Get the Windows installer
1. Open the repository on GitHub, then **Actions**, then **Desktop installers**, then **Run workflow**. Leave the server address empty.
2. After about 15 minutes, download **factory-atlas-windows** at the bottom of the finished run.
3. Run `Factory Atlas_0.2.0_x64-setup.exe`. Windows may warn that the publisher is unknown, because the installer is not signed yet: choose "More info", then "Run anyway".

Sign in as in A2. Data is kept on that computer.

---

## Part C: Change the code (developers)

Install once:

| Tool | Where | Needed for |
|---|---|---|
| Git | https://git-scm.com/download/win | Getting the code |
| Node.js 22 LTS | https://nodejs.org | Everything below |
| Rust | https://rustup.rs | Building the desktop app only |
| Microsoft C++ Build Tools | https://visualstudio.microsoft.com/visual-cpp-build-tools/ (tick "Desktop development with C++") | Building the desktop app only, on Windows |
| PostgreSQL 16 | https://www.postgresql.org/download/ | Server mode and server tests only |

### C1. Run with live reload (browser mode, no database to install)
```
npm install
npm run dev
```
Open http://localhost:5173. Code changes appear immediately.

### C2. Check config and run the tests
```
npm run check-config
npm run typecheck
npm test
```
`npm test` runs the server tests against PGlite and, if PostgreSQL is available at `TEST_DATABASE_URL`, against PostgreSQL too.

The browser tests click through the app in both modes and need PostgreSQL for the server-mode part:
```
npx playwright install chromium
npm run test:e2e
```
Only browser mode: `npm run build && npx playwright test --project browser`.

### C3. Build the desktop installer on your computer
```
npm run desktop:build
```
Installers appear in `desktop\src-tauri\target\release\bundle\nsis\` (.exe) and `\msi\` (.msi).

### C4. Run in server mode (later)
1. Install PostgreSQL and create a database `factory_atlas`.
2. `copy .env.example .env` and set `DATABASE_URL`, `INITIAL_ADMIN_PASSWORD`.
3. `npm run build`, then `node server/dist/index.js`.
4. Open http://localhost:4000. For live reload instead: `npm run dev:server`.

For desktop installers that connect to the server: in the **Desktop installers** workflow, type the server address.
