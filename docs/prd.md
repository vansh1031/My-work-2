# Product Requirements (PRD)

What Factory Atlas is, who it is for, and what it does. If the code and this file disagree, one of them is wrong: fix it or update this file.

## 1. What we are building

An app that shows a company's factories and the status of every machine in them. It runs as a website or an installable desktop app (Windows and Linux now, Mac and Android later). It is sold to many client companies, each with its own branding, changed through config files only.

For now it runs in **browser mode**: the app has its own built-in database and needs no server or installation; data stays on the computer where it is used. **Server mode** (a shared server per client, so several computers see the same data) uses the same code and is ready for later.

There is no live connection to the machines. Status comes from an Excel sheet uploaded after the last shift of each day, or from a manual edit by an allowed user.

## 2. Who uses it

| Person | What they need |
|---|---|
| Client administrator | Create users, decide who sees which factory, add factories and machines, allow or block uploads and edits per user, see every change |
| Supervisor (user with permission) | Upload the day's sheet, correct a machine's status by hand |
| Viewer (user without permission) | See factories assigned to them, see machine status and history |
| Us (the vendor) | Set up a new client by editing config files, debug problems without opening the code |

## 3. Features

### 3.1 Sign-in
- Username and password only. No Google or Microsoft sign-in.
- No self-registration. Only the admin creates accounts.
- First sign-in, and after an admin resets a password, the user must choose a new password.
- Sign-out after a set time without activity (`config/app.json` `sessionIdleMinutes`).
- Closing the app signs the user out.

### 3.2 Home page: factories
- At the top: totals across the user's factories (factories, machines, and machines per status).
- A list of factories: photo, name, "City, State", country, machine count, status counts, the date of the newest status, and an Open button. A warning sign shows when that date is older than `dataAgeWarningDays`.
- Search and filters (country, state) appear when there are more than `showSearchWhenMoreThan` factories.
- Users see only their assigned factories. Admins see all.
- Next to the list: a 3D globe in its own panel that slowly rotates; people can drag and zoom it.
- Clicking a card flies the globe to the factory: country, then state (highlighted), then city (pin).
- Switching factories: close by (under `nearDistanceKm`) slides; far away zooms out, rotates, zooms in.
- The selected factory shows as a card on the globe with an "Open factory" button. Clicking a pin on the globe selects that factory.
- The card's close button clears the selection and the globe zooms out.

### 3.3 Factory page: machines
- Machine tiles with a coloured edge, a status dot and the status word: Running (green), Stopped (amber), Aborted (red), Shift ended (grey). "No data" if nothing was ever recorded.
- Filter by status, search by name or ID.
- Next to the tiles: a 3D factory floor panel with all machines and a coloured ring under each one showing its status. Clicking a machine in 3D selects it.
- Clicking a machine flies the camera to it, fades the others and slowly turns it. Switching machines sweeps the camera around the floor. Closing the details (or clicking the tile again) zooms back out.
- Clicking a tile opens the machine's details under the 3D view (section 3.4). The page address and the breadcrumb follow, so a machine can be linked to.
- Machine codes stand above the machines in 3D. Toolbar on the 3D floor: Names (on or off), Stop turning, Whole floor.
- A banner shows when the newest status is older than `dataAgeWarningDays`, with a link to upload the latest sheet for people allowed to upload.
- Tabs: Machines, History, Uploads.

### 3.4 Machine details
- Name, ID, type, description.
- Status of each shift for the latest day with data.
- The last 14 days as coloured squares, total times aborted.
- Previous and Next buttons move to the neighbouring machine.
- "Update status" for users the admin allowed (hidden for everyone else).

### 3.5 Daily Excel upload
- Fixed template, downloadable from the app with every machine and shift prefilled.
- Column names and accepted status words are flexible (`config/excel.json`).
- Number of shifts per factory is set by the admin (1 to 6).
- Preview before saving: rows, what will change, errors that block saving, warnings that do not.
- Saved uploads cannot be undone or deleted. A corrected file for the same day replaces the data, and both files stay in the upload history.
- Only users the admin allowed can upload. The same switch controls manual editing.

### 3.6 History
- Pick a date range and a machine (or all machines).
- Grid of coloured squares per machine and shift per day.
- Totals per machine: shifts per status, times aborted, shifts with data.
- Download CSV: the records of the chosen dates and machine, for Excel.

### 3.7 Admin
- Users: create, edit name and role, assign factories, switch upload and edit permission, deactivate, reset password.
- Factories and machines: add, edit, archive (never deleted), upload factory photo, upload a 3D model (.glb) per machine.
- Change log: every sign-in, change, upload and manual edit, permanent.

### 3.8 Support and trust
- System status page (no sign-in needed): server, database, config, WebGL, map tiles.
- Debug panel switched on from config.
- Light / Dark button in the top bar (can be switched off per client).
- Every error has a code, listed in `docs/troubleshooting.md`.
- Privacy policy and Terms pages, text from `config/legal/*.md`.

## 4. Not in scope now (future)
- Live data from machines (PLC, sensors).
- Uptime and downtime analysis.
- Mac and Android apps (planned for: the tech choices support them).
- Running on the client's office network without internet.
- Self-registration.

## 5. Rules the product must follow
See `docs/design.md` (look) and `docs/rules.md` (how we build). In short: no purple gradients, no pill-shaped buttons, no emoji icons, no em-dashes in text, no fake numbers presented as real, no cursor effects, subtle animation only.

## 6. Launch checklist (per client)
- [ ] Custom domain for the server, with HTTPS
- [ ] Client logo and favicon in `config/assets`, names in `config/branding.json`
- [ ] Client colours in `config/theme.json`
- [ ] No "made with AI" text anywhere
- [ ] Privacy policy and Terms reviewed by the client's legal team (`config/legal/`)
- [ ] All placeholder factory photos replaced (cards show "Photo pending" until then)
- [ ] Sample data off: `SEED_SAMPLE_DATA=false` on a fresh database
- [ ] Strong `INITIAL_ADMIN_PASSWORD`, changed at first sign-in
- [ ] Desktop installers built with the client's server address
