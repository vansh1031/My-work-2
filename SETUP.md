# Setup on Windows

Two ways to run Factory Atlas on your laptop:
- **Part A: just try it.** Needs only Docker Desktop. About 15 minutes the first time.
- **Part B: build or change the code.** Needs a few developer tools.

---

## Part A: Try it

### A1. Install Docker Desktop (once)
1. Download **Docker Desktop for Windows** from https://www.docker.com/products/docker-desktop/ and run the installer.
2. If it asks to use **WSL 2**, keep it ticked. That is the Linux layer Windows uses to run Docker.
3. Restart the laptop when asked.
4. Open Docker Desktop and wait until the bottom left says **Engine running**.

If Docker says **virtualization is disabled**: restart the laptop, open the BIOS settings (usually F2, F10 or Del while starting), turn on "Intel VT-x" or "AMD-V" (sometimes called "SVM"), save and restart.

### A2. Get the project
Unzip `factory-atlas.zip` (or, once the GitHub repository is connected, `git clone` it) into a folder such as `C:\factory-atlas`.

### A3. Start it
1. Open **PowerShell** in that folder (in File Explorer, click the address bar, type `powershell`, press Enter).
2. The first time only, create your settings file:
   ```
   copy .env.example .env
   ```
   You can open `.env` in Notepad and change `INITIAL_ADMIN_PASSWORD`.
3. Start everything:
   ```
   docker compose up -d --build
   ```
   The first time takes several minutes (it downloads and builds). Later starts take seconds and need only `docker compose up -d`.
4. Check it is running:
   ```
   docker compose ps
   ```
   Both `db` and `app` should say `running` (db also `healthy`).

### A4. Open the app
- **In a browser:** go to http://localhost:4000
- **Desktop app:** install the Windows installer (`Factory Atlas_0.1.0_x64-setup.exe`, see Part C) and open it. It connects to `http://localhost:4000` by default.

### A5. First sign-in
- Username `admin`, password from `INITIAL_ADMIN_PASSWORD` in `.env` (default `change-me-now`). You then choose your own password.
- Sample accounts (only while sample data is on): `supervisor` / `sample-pass-1` (can upload and edit, 4 factories) and `viewer` / `sample-pass-1` (view only, 2 factories).

### A6. Stop it
```
docker compose down
```
Your data is kept for next time. To start again: `docker compose up -d`.

### A7. Change settings
Edit any file in the `config` folder (see `docs/config.md`), then:
```
docker compose restart app
```
If you made a mistake, `docker compose logs app` names the file and the field.

### A8. Start completely fresh (deletes all data)
```
docker compose down -v
docker compose up -d
```

---

## Part B: Build or change the code

Install these once:

| Tool | Where | Notes |
|---|---|---|
| Git | https://git-scm.com/download/win | Default options are fine |
| Node.js 22 LTS | https://nodejs.org | Tick "Automatically install the necessary tools" if offered |
| Rust | https://rustup.rs | Needed only to build the desktop app |
| Microsoft C++ Build Tools | https://visualstudio.microsoft.com/visual-cpp-build-tools/ | In the installer tick **Desktop development with C++**. Needed by Rust. |
| VS Code (optional) | https://code.visualstudio.com | For reading and editing files |

WebView2, which the desktop app uses, is already part of Windows 10 and 11.

### B1. Install packages
In PowerShell, in the project folder:
```
npm install
```

### B2. Run with live reload
The database still runs in Docker:
```
docker compose up -d db
```
Add this line to `.env`:
```
DATABASE_URL=postgres://atlas:atlas-local-password@localhost:5432/factory_atlas
```
The database port must be reachable from Windows: in `docker-compose.yml`, remove the `#` in front of the two lines `ports:` and `- "5432:5432"` under `db:`, then run `docker compose up -d db` again. Then:
```
npm run dev
```
Open http://localhost:5173. Code changes appear immediately.

### B3. Run the tests
Create the test databases once:
```
docker compose exec db psql -U atlas -d factory_atlas -c "CREATE DATABASE factory_atlas_test" -c "CREATE DATABASE factory_atlas_e2e"
```
Then, in PowerShell:
```
$env:TEST_DATABASE_URL="postgres://atlas:atlas-local-password@localhost:5432/factory_atlas_test"
$env:E2E_DATABASE_URL="postgres://atlas:atlas-local-password@localhost:5432/factory_atlas_e2e"
npx playwright install chromium
npm test
npm run test:e2e
```
The browser tests start their own server on port 4100, so stop `npm run dev` first.

### B4. Build the desktop installer on your laptop
```
npm run desktop:build
```
The installers appear in `desktop\src-tauri\target\release\bundle\nsis\` (.exe) and `\msi\` (.msi).

To build an installer for a client, put the client's server address in `config\app.json` (`apiBaseUrl`) first, and set `allowServerAddressChange` to `false`.

---

## Part C: Installers from GitHub (no tools needed)
Once the repository is on GitHub:
1. Open the repository, then **Actions**, then **Desktop installers**, then **Run workflow**.
2. Optionally type the client's server address.
3. When the run finishes (about 15 minutes), download **factory-atlas-windows** (and **factory-atlas-linux**) at the bottom of the run page.
