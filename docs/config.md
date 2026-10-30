# Configuration

Everything that changes from one client to the next is in the `config/` folder. No code needs to change.

**After editing any config file:**
- **Browser mode** (the default, `"dataMode": "browser"`): the config is built into the app. Rebuild it (`npm run build`), or push to `main` and the website rebuilds itself.
- **Server mode:** restart the server.

If a file has a mistake, the app shows "Cannot start" (browser mode) or the server refuses to start (server mode), naming the file and field, for example:

```
CONFIG-001: The configuration has 1 problem(s):
  - theme.json -> statusColors.running: must be a colour like #1a2b3c
```

To check the files without starting the server: `npm run check-config`.

Some settings in `app.json` take effect **when the app is built**: `dataMode`, `apiBaseUrl`, `allowServerAddressChange`.

---

## Common recipes

### Set up a new client
1. Copy the whole `config/` folder for the client.
2. `branding.json`: company name, app title, login texts.
3. Put their logo and favicon in `config/assets/` and write the file names in `branding.json`.
4. `theme.json`: their colours (`palettes.dark` or `palettes.light`, and `mode`).
5. `excel.json`: their column names and status words, if their sheet differs.
6. `legal/privacy.md`, `legal/terms.md`: their reviewed texts.
7. Browser mode: build with `SEED_SAMPLE_DATA=false` and a strong `INITIAL_ADMIN_PASSWORD` (see "Build settings" below).
8. Server mode: `app.json` `"dataMode": "server"` and `apiBaseUrl` = their server address; start their server with `SEED_SAMPLE_DATA=false` and a strong `INITIAL_ADMIN_PASSWORD`.
9. Build the desktop installers (see `SETUP.md`).

### Their Excel calls the machine column "M/C No."
Add it to `excel.json` -> `columns.machineCode`. Any name in the list is accepted.

### Their sheet writes "RUN" and "STOP"
Add the words to `excel.json` -> `statusValues.running` and `statusValues.stopped`. Upper or lower case does not matter.

### A factory works 3 shifts
Not a config change: Admin, Factories and machines, Edit details, Shifts per day = 3.

### The globe is too bright, or too faint
`theme.json` -> `background.dimOpacity` (0 = no dimming, 1 = invisible). `dimOpacityWhileMoving` is used while the camera moves.

### Animations make a computer slow
`animation.json` -> `"reduceMotion": true`. Or turn off one background: `app.json` -> `features.globe` or `features.factoryFloor3d` = `false`.

### Something is wrong and you want to see what the app is doing
`app.json` -> `"debug": true`. A small panel appears in the corner of the app with the server address, user, current screen, background state, frames per second and recent errors.

---

## app.json

| Field | Default | Meaning |
|---|---|---|
| `dataMode` | `browser` | `browser`: the app has its own built-in database and needs no server; data stays in that browser on that computer. `server`: the app uses a Factory Atlas server and everyone shares the data. Taken when the app is built; `npm run build -w web -- --mode server` (or `--mode browser`) overrides it for one build. |
| `apiBaseUrl` | `http://localhost:4000` | Server mode only: server address built into the desktop app. The browser version always uses the address it was opened from. |
| `allowServerAddressChange` | `true` | Server mode only. Shows "Connection settings" on the login screen so a user can type another server address. Set `false` for client installers. |
| `debug` | `false` | Shows the debug panel. |
| `sessionIdleMinutes` | `30` | Sign out after this many minutes without activity. |
| `defaultShiftsPerDay` | `2` | Pre-filled value when the admin adds a factory. |
| `showSearchWhenMoreThan` | `5` | Show search and filters only when there are more factories (or machines) than this. |
| `statusLabels` | Running, Stopped, Aborted, Shift ended, No data | The words shown next to each status dot. |
| `map.useOnlineTiles` | `true` | Use the online map (streets, city names) when reachable. If it cannot be reached, the built-in globe is used. |
| `map.tileStyleUrl` | OpenFreeMap positron | Address of the online map style. Must be a MapLibre style. |
| `features.globe` | `true` | Globe behind the factories list. |
| `features.factoryFloor3d` | `true` | 3D floor behind the machines. |
| `features.excelUpload` | `true` | Excel upload for allowed users. |
| `features.manualStatusEdit` | `true` | "Update status" for allowed users. |
| `features.history` | `true` | History tab. |
| `legal.privacyPolicy` | `legal/privacy.md` | File shown on the Privacy policy page. |
| `legal.terms` | `legal/terms.md` | File shown on the Terms page. |

## branding.json

| Field | Meaning |
|---|---|
| `companyName` | Client company name (used for the logo's description). |
| `appTitle` | Name in the top bar and the window title. |
| `loginHeading` | Big text on the login screen. |
| `loginSubheading` | Small text under it. Leave `""` for none. |
| `logo` | Logo file inside `config/`, for example `assets/logo.svg`. SVG, PNG or JPG. |
| `favicon` | Small icon file (browser tab). SVG, PNG or ICO. |
| `supportContact` | Shown under the login button, for example "Call IT on 1234". |

## theme.json

| Field | Meaning |
|---|---|
| `mode` | `dark` or `light`: which palette is used. |
| `fontFamily` | CSS font list. Inter is bundled with the app. |
| `cornerRadiusPx` | Corner rounding of buttons, cards and panels (0 to 16). Keep it small: no pill shapes. |
| `palettes.dark`, `palettes.light` | `background`, `surface` (panels), `surfaceRaised` (cards), `border`, `text`, `textMuted`, `accent` (buttons, selection), `accentText`, `danger`, `focus`. |
| `statusColors` | Colour for `running`, `stopped`, `aborted`, `shift_ended`, `unknown`. |
| `panelOpacity` | How solid the side panel is (0 to 1). |
| `background.dimOpacity` | How much the globe and floor are darkened (0 to 1). |
| `background.dimOpacityWhileMoving` | Darkening while the camera moves (lower = brighter). |
| `background.blurPx` | Slight blur of the background, in pixels (0 = sharp). |
| `globe.*` | `ocean`, `land`, `countryBorder`, `stateBorder`, `highlightFill`, `highlightFillOpacity`, `highlightBorder`, `marker`, `markerRing`. The land and border colours apply to the built-in globe only. |
| `factoryFloor.*` | `floor`, `gridLine`, `machineBody`, `machineAccent` (placeholder machine colours). |

All colours are written like `#1a2b3c`.

## animation.json

| Field | Default | Meaning |
|---|---|---|
| `reduceMotion` | `false` | `true` turns off all camera movement and card animation. |
| `followSystemReduceMotion` | `true` | Also turn them off when the computer's "reduce motion" setting is on. |
| `globe.idleRotationDegreesPerSecond` | `2` | Slow spin when nothing is selected. 0 = no spin. |
| `globe.nearDistanceKm` | `600` | Factories closer than this slide; farther ones get the long flight. |
| `globe.overviewZoom` | `2.1` | Zoom of the whole-globe view. |
| `globe.countryZoom` | `3.4` | Closest zoom for the country step. |
| `globe.stateZoom` | `5.2` | Closest zoom for the state step. |
| `globe.cityZoom` | `8.5` | Zoom at the factory (online map). |
| `globe.longFlightDurationMs` | `3200` | Time to fly to the country. |
| `globe.stageDurationMs` | `1200` | Time for country to state, and state to city. |
| `globe.slideDurationMs` | `1500` | Time to slide to a nearby factory. |
| `factoryFloor.idleOrbitDegreesPerSecond` | `4` | Camera circling speed with no machine selected. |
| `factoryFloor.focusDurationMs` | `1400` | Time to fly to a machine. |
| `factoryFloor.switchDurationMs` | `2400` | Time to move from one machine to another. |
| `factoryFloor.switchSweepDegrees` | `360` | Extra turn around the floor when switching machines. 0 = direct. |
| `factoryFloor.otherMachinesOpacityWhenFocused` | `0.12` | How visible the other machines stay. |
| `cards.enterDurationMs`, `cards.enterStaggerMs` | `220`, `35` | Card appear animation. |

## excel.json

| Field | Meaning |
|---|---|
| `sheet` | Name of the sheet to read. `""` = the first sheet. |
| `headerRow` | Row number with the column names (usually 1). |
| `columns.date` | Accepted names for the date column. Required. |
| `columns.shift` | Shift number column. Required. Accepts `1`, `Shift 1`, `S1`. |
| `columns.machineCode` | Machine ID column. Required. Must match the Machine ID set in Admin. |
| `columns.status` | Status column. Required. |
| `columns.abortCount` | Times aborted in that shift. Optional (empty = 0). |
| `columns.remarks` | Free text. Optional. Up to 500 characters are kept. |
| `statusValues.<status>` | Words that mean each status. The first word is the one used in the template. |
| `dateFormats` | Accepted text date formats: `YYYY-MM-DD`, `DD-MM-YYYY`, `DD/MM/YYYY`, `MM/DD/YYYY`. Real Excel date cells always work. |
| `maxFileSizeMb` | Largest file accepted. |
| `maxRows` | Most rows accepted in one file. |

The same name may not appear for two columns, and the same word may not mean two statuses: the server refuses to start if it does.

### The template
Uploads, then "Upload a day's sheet", then "Download template" makes a sheet with one row per machine and shift, the date filled in, and a drop-down list in the Status column. A second sheet lists the accepted words.

## legal/
`privacy.md` and `terms.md`. Plain text with `#`, `##`, `###` headings and blank lines between paragraphs.

## assets/
Logo and favicon. Any file names, as long as `branding.json` points to them.

---

## Environment variables (server)

Server mode only. Set in `.env` or the shell. These are per installation, or secret, so they are not in config files.

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/factory_atlas` | Database connection. |
| `PORT` | `4000` | Server port. |
| `HOST` | `0.0.0.0` | Network address to listen on. |
| `INITIAL_ADMIN_PASSWORD` | `change-me-now` | Password of the first `admin` user on an empty database. Must be changed at first sign-in. |
| `SEED_SAMPLE_DATA` | `false` | Add sample factories to an empty database. |
| `CONFIG_DIR` | `<project>/config` | Where the config folder is. |
| `DATA_DIR` | `<project>/data` | Where photos and 3D models are stored. Back it up with the database. |
| `WEB_DIST_DIR` | `<project>/web/dist-server` | The built web app (server mode build) the server also serves. |
| `CORS_ORIGINS` | `*` | Comma-separated addresses allowed to call the server. |
| `LOG_LEVEL` | `info` | `error`, `warn`, `info` or `debug`. |

## Build settings (browser mode)

Set in the shell when building the browser version. They decide how a brand-new built-in database starts.

| Variable | Default | Meaning |
|---|---|---|
| `INITIAL_ADMIN_PASSWORD` | `change-me-now` | Password of the first `admin` user in each new browser. Must be changed at first sign-in. |
| `SEED_SAMPLE_DATA` | `true` | Add the 6 sample factories to each new browser database. Set `false` for a real client. |
| `API_BASE_URL` | (from `app.json`) | Server mode builds only: overrides `apiBaseUrl`. |

Example (Windows PowerShell): `$env:SEED_SAMPLE_DATA="false"; npm run build -w web`.

