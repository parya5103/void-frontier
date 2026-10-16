# VOID FRONTIER

An original browser-based 3D space empire strategy game.

Command a small interstellar directorate: explore an interactive 3D galaxy, select and colonize
original worlds, extract **Metal / Crystal / Energy**, upgrade **Mines** and **Power Plants**,
run **Research** projects, build hulls at the **Shipyard**, and track your fleet. Progress is
saved locally in the browser.

Built to be small, genuinely playable, and cheap to run: **no build step, no bundler, no paid
services, no ads, no analytics, no external AI APIs.** Just static files and a vendored copy of
Three.js.

---

## Live demo

**https://static.teamily.ai/sites/52129b28-a1d9-4a4b-a22c-da521e3b5805/webpages/void-frontier_v5/index.html**

The demo targets **Android mobile browsers first**, and works on desktop.

---

## Features

| # | Feature | Status |
|---|---------|--------|
| 1 | Dark sci-fi interface | Done |
| 2 | Interactive 3D galaxy (starfield, star systems, procedural planets) | Done |
| 3 | Planet selection + smooth camera movement | Done |
| 4 | Planet information panel | Done |
| 5 | Metal / Crystal / Energy counters with live rates | Done |
| 6 | Mine and Power Plant upgrades | Done |
| 7 | Research and Shipyard panels with real interactions | Done |
| 8 | Fleet panel with original ship designs | Done |
| 9 | Responsive mobile controls incl. touch (orbit, pinch-zoom, tap) | Done |
| 10 | Local save / restore (autosave + manual save, export/import) | Done |
| 11 | Sound controls — audio **off until the user enables it** | Done |
| 12 | Clear loading state + useful error messages (incl. WebGL context-loss recovery) | Done |

**Not a multiplayer game.** The game is currently single-player and browser-local. `localStorage`
is *not* multiplayer, fake players are not multiplayer, and simulated events are not multiplayer.
See [Multiplayer roadmap](#multiplayer-roadmap-honest-status) below.

---

## Project structure

```
void-frontier/
├── index.html                  # Shell: HUD, panels, canvas host, loading + error overlay
├── css/
│   └── style.css               # Dark sci-fi theme, mobile-first layout, bottom-sheet panels
├── js/
│   ├── data.js                 # Content/tuning: systems, worlds, buildings, research tree, ships
│   ├── state.js                # Game state, economy tick, save/restore, offline accrual
│   ├── galaxy.js               # Three.js scene: starfield, planets, camera rig, input, context-loss recovery
│   ├── ui.js                   # HUD + panels + cards + toasts, event wiring, original ship SVGs
│   ├── audio.js                # Procedural Web Audio SFX/ambience, gated behind user opt-in
│   ├── main.js                 # Bootstrap: module init, game loop, error surfacing
│   └── vendor/
│       └── three.module.min.js # Vendored Three.js (r160, MIT) — pinned, no CDN at runtime
└── README.md
```

### Architecture notes

- **Vanilla ES modules + a vendored Three.js.** No bundler, no transpiler, no runtime CDN
  fetch. `galaxy.js` imports Three.js by **relative path** (`./vendor/three.module.min.js`)
  so the game does not depend on browser import-map support.
- **Static-hosting compatible.** Every asset path is relative, so the folder can be served from
  any static host or subdirectory.
- **Mobile-first.** Touch (single-finger orbit, two-finger pinch zoom, tap-to-select) and
  mouse (drag, wheel, double-click to zoom out) are handled side by side.
- **Defensive numerics.** Resource and simulation values are validated against
  `NaN`/`Infinity` before touching state, animation or audio.
- **Resilient rendering.** A `webglcontextlost` handler pauses the loop and shows a notice; a
  `webglcontextrestored` handler (or a manual **Retry graphics** button) rebuilds the scene in
  place **without a page reload**, preserving game state.
- **Boot watchdog.** A classic (non-module) script raises a visible error if the module graph
  fails to load, so a broken boot never leaves the player on an endless "Booting…" screen.

---

## Run locally

The game is plain static files, but it uses ES modules, so it must be served over HTTP
(opening `index.html` directly via `file://` will be blocked by browser module CORS rules).

**With Python (usually already installed):**

```bash
cd void-frontier
python3 -m http.server 8080
# then open http://localhost:8080
```

**With Node.js:**

```bash
npx --yes serve .        # or: npx --yes http-server -p 8080
```

**With PHP:**

```bash
php -S localhost:8080
```

### Controls

| Action | Touch | Desktop |
|--------|-------|---------|
| Orbit camera | One-finger drag | Click + drag |
| Zoom | Two-finger pinch | Mouse wheel |
| Select world | Tap a planet or its label | Click a planet or its label |
| Galaxy overview | Double-tap empty space | Double-click empty space |
| Open panels | Tap the bottom dock (World / Research / Shipyard / Fleet / Log) | Same |
| Enable sound | Speaker button (top-right) — **off by default** | Same |

---

## Technology

- **Three.js r160** — MIT License, vendored in `js/vendor/` (no runtime download).
- **Web Audio API** — procedural sound effects, generated at runtime (no audio asset files).
- Everything else is hand-written HTML, CSS and ES modules.

No third-party frameworks, no paid APIs, no telemetry.

---

## Save data

Progress is stored in the browser's `localStorage` under the `void frontier` save key, and
autosaves periodically. Offline production is intentionally capped (anti-exploit) so a long
absence does not mint unlimited resources. The **Command Log** panel supports manual save,
export and import, and starting a new game.

---

## Multiplayer roadmap (honest status)

This build is **local single-player, not an MMO**. The following are **not implemented**:

- Secure registration / login and per-player identity
- A shared, persistent galaxy
- **Server-authoritative** resource production (the client must never be trusted for balances)
- Fleet missions and combat resolution
- Alliances and chat
- Server-side progression while offline
- Real-time networking (WebSocket / relay) and conflict resolution

Remaining engineering work for secure multiplayer includes: an auth/identity layer, moving the
economy tick and timers server-side, validating every upgrade/colonize/build on the server,
anti-cheat and replay protection, a persistent database with sessions and access control, and
real-time networking. **No database service-role keys or server secrets may ever ship in
client-side code** — this prototype deliberately contains none.

---

## License / attribution

Original game design, code, visual identity, star systems, ship classes and planet designs.
Three.js is bundled under its own MIT License. No protected third-party assets are included.
