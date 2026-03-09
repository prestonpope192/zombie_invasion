# Zombie Invasion FPS

Browser-based first-person zombie village defense rebuilt on Three.js + Rapier physics.

## What is implemented

- 3D FPS core mode with 12-wave survival defense.
- Real-time physics world (Rapier) with projectile drop, drag, penetration loss, and explosive impulse.
- FPS controls for desktop and mobile dual-stick (with auto-fire assist).
- Intermission summary + shop loop.
- Save/load profile `zombie_invasion_fps_save_v2` in localStorage.
- Deterministic automation hooks:
  - `window.render_game_to_text()`
  - `window.advanceTime(ms)`
- Docker deployment for LAN phone play on port `8080`.

## Project layout

- New FPS runtime: `/Users/preston/Code/zombie_invasion/src/fps`
- Legacy side-scroller preserved: `/Users/preston/Code/zombie_invasion/src/legacy2d`

## Controls

### Desktop

- Look: mouse (click canvas for pointer lock)
- Move: `WASD` or arrow keys
- Sprint: `Shift`
- Jump: `Space`
- Crouch: `Ctrl` or `C`
- Reload: `R`
- Interact: `E`
- Weapon cycle: `Q`
- Weapon select: `1-6`
- Fire: left mouse
- ADS: right mouse

### Mobile

- Left stick: movement
- Right stick: camera look
- Buttons: fire, ADS, jump, crouch, reload, interact

## Development

```bash
npm install
npm run dev
```

Optional LAN testing (explicitly expose dev server):

```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

## Unit tests

```bash
npm test
```

Current test coverage includes:

- ballistic drop and drag behavior
- penetration energy loss
- recoil accumulation/recovery
- save schema validation
- wave budget progression

## Playwright game-loop validation

```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export WEB_GAME_CLIENT="$CODEX_HOME/skills/develop-web-game/scripts/web_game_playwright_client.js"

node "$WEB_GAME_CLIENT" \
  --url http://127.0.0.1:5173 \
  --click-selector "button[data-action='start']" \
  --actions-file /Users/preston/Code/zombie_invasion/test_actions_fps.json \
  --iterations 2 \
  --pause-ms 250 \
  --screenshot-dir /Users/preston/Code/zombie_invasion/output/fps-web-game-v2
```

## Build

```bash
npm run build
```

## Vercel deploy

One-time setup:

```bash
npm i -g vercel
vercel
```

Deploy to production:

```bash
vercel --prod
```

Expected project settings:

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`

Notes:

- Save data is browser-local (`localStorage`) and stays per device/browser profile.
- SPA fallback and wasm/cache headers are defined in `/Users/preston/Code/zombie_invasion/vercel.json`.

Vercel sanity checklist:

- `npm run build` succeeds.
- `npm run preview` runs locally.
- Initial page load works on the Vercel URL.
- Refreshing during gameplay does not 404 (returns app shell).
- Browser console has no Rapier wasm MIME/CORS errors.

## Docker deploy

```bash
docker compose up --build -d
```

Open locally:

- http://localhost:8080

Find your Mac LAN IP for phone testing:

```bash
ipconfig getifaddr en0
```

Then open on phone (same Wi-Fi):

- `http://<your-lan-ip>:8080`

## Assets

See `/Users/preston/Code/zombie_invasion/src/fps/assets/ASSETS.md` for CC0/open asset references and attribution workflow.
