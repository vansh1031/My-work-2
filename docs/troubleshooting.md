# Troubleshooting

Find the problem without opening the code. Start with section 1, then look up any error code in section 3.

## 1. First three checks
1. **System status page.** In the app footer, "System status" (works without signing in). It shows whether the server, database, config, 3D graphics and online map are OK.
2. **Logs.** Browser mode: the browser's developer tools (F12), tab "Console"; look for lines starting with an error code such as `[LOCAL-001]`. Server mode: the terminal running the server; every line is JSON, look for `"level":50` (error) and an error code.
3. **Debug panel.** Set `"debug": true` in `config/app.json`, restart the server, reopen the app. The panel in the corner shows the server address, signed-in user, current screen, background state, frames per second and the last errors.

## 2. Common problems

| What you see | Likely cause | What to do |
|---|---|---|
| "Cannot start" screen (`LOCAL-001`) | Browser mode: the built-in database could not start. Usually private browsing, blocked site data ("cookies and site data" switched off), or a very old browser. | Use a normal window of a current Chrome, Edge or Firefox; allow site data for this address. The message after the code says what failed. |
| "Cannot start" screen (`LOCAL-002`) | Browser mode: the app is open in another tab, and this browser cannot share one database between tabs | Close the other tab, or use it there. |
| Warning `LOCAL-003` in the console | Browser mode: one way of running the built-in backend did not work, the next one was tried | Nothing to do if the app works. The debug panel shows which way is in use. |
| All data is gone in browser mode | Site data was cleared, or a different browser, computer or private window is used | Browser mode keeps data in one browser on one computer. For shared or backed-up data use server mode. |
| "Cannot connect" screen when the app starts (`NET-001`) | Server mode: server not running, or the app points to the wrong address | Start the server. Check the address under "Connection settings" on the login screen, or `apiBaseUrl` in `config/app.json` before building the desktop app. |
| `CONFIG-001` ("Cannot start" in browser mode, or the server stops) | A config file has a mistake | The message lists each file, field and problem. Fix, then rebuild (browser mode) or restart (server mode). `npm run check-config` checks without starting. |
| Server stops with `DB-001` | Server mode: database not reachable | Is PostgreSQL running? Check `DATABASE_URL` in `.env`. |
| Globe area is plain dark, no globe | WebGL not available, or `features.globe` is off | System status, "3D graphics (WebGL)". Update the graphics driver, or keep it off; the app works without it. |
| Globe shows but no streets or city names | Online map not reachable, built-in globe in use (this is normal offline) | System status, "Online map tiles". Check internet access or `map.tileStyleUrl`. |
| Globe does not highlight the state | State or country name does not match the boundary data | Use the usual English name: "Madhya Pradesh", "India", "Baden-Württemberg". The debug panel shows `stateFound: false`. |
| Pin is in the wrong place | Latitude and longitude swapped or wrong | Admin, Factories and machines, Edit details. Latitude is north-south (India about 8 to 37), longitude east-west (India about 68 to 97). |
| 3D floor is empty or plain | WebGL not available, or `features.factoryFloor3d` off, or the factory has no machines | System status, then Admin. |
| Uploaded 3D model does not appear | The file is not a valid .glb, or failed to load | The placeholder shape is shown instead. Export again as glTF binary (.glb). |
| Animations are slow or jerky | Weak graphics on this computer | `animation.json` `"reduceMotion": true`, or lower `theme.json` `background.blurPx` to 0. |
| User says they cannot see a factory | Not assigned (`PERM-002`) | Admin, Users, edit the user, tick the factory. |
| User cannot see "Upload" or "Update status" | Switch is off for them (`PERM-003`) or the feature is off (`FEATURE-001`) | Admin, Users, tick "Can upload daily sheets and edit machine status". Check `features` in `app.json`. |
| User is signed out often | `sessionIdleMinutes` is short, or they close the app (closing always signs out) | Raise `sessionIdleMinutes` in `app.json`. |
| Upload preview lists problems | The sheet does not match the rules | See the XL codes below. Fix the file and choose it again. |
| A machine shows the wrong status after an upload | A manual edit or another upload is newer | Machine page, the shift table says who changed it and when. History tab shows every day. Uploads tab shows which file is active. |
| Changing a config file has no effect | Browser mode: the app was not rebuilt. Server mode: the server was not restarted. | Rebuild (`npm run build`, or push to `main` for the website), or restart the server. |
| Port 4000 already in use | Another program uses it | Set `PORT=4300` in `.env` and use `http://localhost:4300`. |

## 3. Error codes

### Server: sign-in and permissions
| Code | Meaning | Fix |
|---|---|---|
| AUTH-001 | Wrong username or password | Check both. Admin can reset the password. |
| AUTH-002 | Not signed in, or session expired | Sign in again. Sessions end after `sessionIdleMinutes`, when the app closes, after a password change, or when the account is deactivated. |
| AUTH-003 | Account deactivated | Admin, Users, tick "Account active". |
| AUTH-004 | Current password wrong (when changing password) | Type the current password again. |
| AUTH-005 | Must change password first | Happens on first sign-in and after a reset. The app opens the change screen. |
| PERM-001 | Only administrators can do this | Use an admin account. |
| PERM-002 | No access to this factory | Admin assigns the factory to the user. |
| PERM-003 | Upload and edit not allowed for this user | Admin switches it on for the user. |
| FEATURE-001 | Feature switched off in config | `config/app.json` `features`. |

### Server: requests and files
| Code | Meaning | Fix |
|---|---|---|
| REQ-001 | Missing or invalid fields | The message names each field and the problem. |
| REQ-002 | Not found | The item may be archived, or the address is wrong. |
| REQ-003 | Already exists | Username or Machine ID already taken. |
| REQ-004 | Too many attempts | Wait one minute (sign-in is limited to 10 tries per minute). |
| FILE-001 | No file attached | Choose a file. |
| FILE-002 | File too large | Excel: `excel.json` `maxFileSizeMb`. Photos 8 MB, models 40 MB. |
| FILE-003 | File type not allowed | Excel must be .xlsx (save .xls as .xlsx). Photos JPG, PNG or WebP. Models .glb. |
| UPLOAD-001 | Confirm refused: the file has problems | Same problems as the preview showed. Nothing was saved. |
| UPLOAD-002 | Not a readable .xlsx | Open in Excel and "Save As" Excel Workbook (.xlsx). |
| SERVER-001 | Unexpected server error | Look in the server log at that time for the details. |
| DB-001 | Database not reachable | See section 2. |
| CONFIG-001 | Config files have problems | The log lists them. |

### Excel preview (XL-0xx block saving, XL-1xx are warnings only)
| Code | Meaning | Fix |
|---|---|---|
| XL-001 | A required column is missing | Header row must contain Date, Shift, Machine ID, Status (or a name listed in `excel.json` `columns`). Check `headerRow`. |
| XL-002 | Date not valid | Use a real Excel date or one of `excel.json` `dateFormats`. |
| XL-003 | More than one date in the file | One file is one day. Split the file. |
| XL-004 | Shift number not valid | Must be 1 to the factory's shifts per day. |
| XL-005 | Machine ID empty or unknown in this factory | Must match the Machine ID in Admin exactly (upper or lower case does not matter). |
| XL-006 | Status word not recognised | Use a word from `excel.json` `statusValues` (the template has a drop-down list). |
| XL-007 | Abort count not a whole number | 0 or more, or leave empty. |
| XL-008 | Same machine and shift twice | Remove the duplicate row. |
| XL-009 | No data rows | The sheet has only a header. |
| XL-010 | Too many rows | Limit is `excel.json` `maxRows`. |
| XL-011 | Sheet not found | `excel.json` `sheet` names a sheet that is not in the file. Use `""` for the first sheet. |
| XL-101 | A machine has no row for a shift | Its status for that shift stays as it was. Add the row if that is wrong. |
| XL-102 | Date is in the future | Check the date. |
| XL-103 | This day was already uploaded | Saving makes this file the active one. The earlier file stays in history. |

### App (shown in the app or the debug panel)
| Code | Meaning | Fix |
|---|---|---|
| NET-001 | Server mode: server cannot be reached | Network, server running, server address. |
| LOCAL-001 | Browser mode: built-in database could not start | See section 2. |
| LOCAL-002 | Browser mode: app already open in another tab that holds the data | Close the other tab. |
| LOCAL-003 | Browser mode: one way of starting the backend failed, the next is tried (warning only) | Nothing, unless LOCAL-001 follows. |
| HTTP-nnn | Server answered without an error code | Usually a proxy or wrong address in between. Check the address. |
| APP-001 | Unexpected error in the app | Note what you did; check the debug panel's recent errors. |
| BG-001 | Background (globe or floor) could not be drawn | The app continues with a plain background. See WebGL above. |
| GLOBE-001 | Boundary files missing from the app | Rebuild the app; `web/public/geo` must contain `countries.json` and `states.json`. |
| GLOBE-002 | Online map style not reachable | Built-in globe is used instead. Normal without internet. |
| GLOBE-003 | Map warning (for example a tile failed to load) | Usually harmless; repeated warnings mean a network problem. |

## 4. Useful commands
| Command | What it does |
|---|---|
| `npm run check-config` | Check config files without starting anything |
| `npm run dev` | Run the app with live reload (browser mode) |
| `npm test` | Backend tests (PGlite, and PostgreSQL if available) |
| `npm run test:e2e` | Click-through tests of the whole app, both modes |
| `node server/dist/index.js` | Start the server (server mode, after `npm run build`) |

To start completely fresh in browser mode: in the browser, delete the site data for the app's address (Chrome: the lock icon next to the address, "Site settings", "Delete data"). This deletes all factories, users and uploads in that browser.
