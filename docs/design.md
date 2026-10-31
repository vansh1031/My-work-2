# Design

How the app looks and moves. All colours and sizes below are defaults from `config/theme.json` and `config/animation.json`; each client can change them there without touching code.

## 1. Principles
1. **Nothing on top of anything.** Lists, the globe and the 3D floor each have their own panel, side by side. Nothing is dimmed, blurred or layered.
2. **One obvious action per step.** On the home page a row shows the factory on the globe, its Open button opens it. On the factory page a tile opens the machine's details next to the 3D view.
3. **The overall picture first.** Every page starts with real status counts (Running, Stopped, Aborted, Shift ended).
4. **Always know where you are.** A breadcrumb (Factories > Indore Plant > Hydraulic Press) on every factory and machine screen.
5. **Motion has a job.** The globe flight shows where a factory is. The floor camera shows which machine you picked. Everything else is quick and quiet.
6. **Status is never colour only.** Every status dot has its word next to it.
7. **Plain and honest.** Real labels, real data, nothing decorative pretending to be information.

## 2. Banned (from the project owner)
- Purple gradients
- Pill-shaped buttons (corners are `cornerRadiusPx`, default 6px; filter toggles use 4px)
- Fake reviews, fake metrics, fake customer counters
- Vague hero text ("Revolutionise your workflow")
- Emoji icons (use Lucide SVG icons)
- Em-dashes in any text
- Over-the-top scroll animation, cursor animation or cursor trails
- AI-generated photos or copy presented as real (placeholder photos say "Photo pending")
- A "made with AI" tag

## 3. Colours (dark theme, default)
| Token | Value | Used for |
|---|---|---|
| background | #0d1117 | page, and the 3D panels |
| surface | #161b22 | panels, top bar |
| surfaceRaised | #1f2630 | cards, table headers |
| border | #30363d | lines |
| text | #e6edf3 | main text |
| textMuted | #8b949e | secondary text |
| accent | #2f81f7 | primary buttons, selected card, links |
| danger | #f85149 | errors |

A light palette is also defined. The default is set with `"mode"` (`dark`, `light` or `system`). People can switch with the Light / Dark button in the top bar unless `allowUserSwitch` is `false`; their choice is kept in their browser (D-043).

### Status colours
| Status | Colour | Word (from `app.json` statusLabels) |
|---|---|---|
| running | #2da44e green | Running |
| stopped | #d4a72c amber | Stopped |
| aborted | #e5534b red | Aborted |
| shift_ended | #8b949e grey | Shift ended |
| unknown | #57606a dark grey | No data |

### Globe colours
Ocean #0f2236, land #2a3f56, country borders #56718c, state borders #3a5068, highlighted state #2f81f7 at 28%, pin white with a blue ring.

## 4. Typography
- Font: Inter Variable (bundled, works offline), falling back to the system font.
- Base size grows with the screen: 14px on small screens, up to 30px on a 4K TV.
- Headings: 600 weight. h1 1.45rem, h2 1.15rem, h3 1rem.
- Numbers in tables use tabular figures, so columns line up.
- Section titles: small capitals style (uppercase, 0.78rem, letter spacing).

## 5. Layout
- **Every page:** a header (breadcrumb, title, summary numbers, tabs), then the content.
- **Home, desktop and TV:** factory list on the left (about 36%), globe panel on the right. The selected factory shows as a card at the bottom of the globe panel with an "Open factory" button.
- **Factory page, desktop and TV:** machine tiles on the left, on the right the 3D floor panel and, under it, the details of the chosen machine.
- **Tablet portrait and narrow screens (under 900px):** one column: the globe or 3D floor first (40% of the screen height), then the details, then the list.
- **Admin, history, uploads, status:** one wide panel under the header.
- No horizontal page scrolling at any size (tested at 768, 1180, 1366 and 3840 wide).

## 6. Components
- **Factory row:** photo, name, address, machine count and status counts; an Open button on the right. Selected: accent border and tint.
- **Machine tile:** a coloured left edge for the status, name, ID and type, the status word, the last update.
- **Summary tile:** a label (with a status dot) and a large number.
- **Buttons:** primary (accent fill), default (raised surface), ghost (no border), danger (red text). 6px corners.
- **Status badge:** 0.65rem dot with a soft ring, followed by the word.
- **Notice:** icon plus text, border coloured by kind (info, ok, warn, error). Errors show their code underneath.
- **Tables:** sticky header, thin row lines.
- **History grid:** one square per machine, shift and day, coloured by status; empty square means no data. Hover shows details.

## 7. Motion
| Movement | Default | Setting |
|---|---|---|
| Globe idle rotation | 2 degrees per second | `globe.idleRotationDegreesPerSecond` |
| Long flight to a country | 3.2 s | `globe.longFlightDurationMs` |
| Country to state, state to city | 1.2 s each | `globe.stageDurationMs` |
| Slide to a nearby factory | 1.5 s | `globe.slideDurationMs` |
| Near or far | 600 km | `globe.nearDistanceKm` |
| Floor idle orbit | 4 degrees per second | `factoryFloor.idleOrbitDegreesPerSecond` |
| Fly to a machine | 1.4 s | `factoryFloor.focusDurationMs` |
| Switch machine (with 360 degree sweep) | 2.4 s | `factoryFloor.switchDurationMs`, `switchSweepDegrees` |
| Other machines when one is selected | 12% visible | `factoryFloor.otherMachinesOpacityWhenFocused` |

**Reduce motion:** `animation.json` `reduceMotion: true` turns all of it off. With `followSystemReduceMotion: true`, the operating system's "reduce motion" setting does the same. Camera moves then jump straight to the end.

## 8. Placeholders
- Factory without a photo: a simple line drawing of a factory with "Photo pending".
- Machine without a 3D model: a shape made of simple blocks, picked by machine type (cnc, lathe, press, injection, robot, conveyor, generic). The machine page says it is a placeholder.
