# Zombie Invasion PlayCanvas

Browser-based first-person zombie village defense converted to a PlayCanvas campaign with a cinematic low-poly survival style.

## Documentation

Canonical repo entrypoints:

- [`docs/README.md`](/Users/preston/Code/zombie_invasion/docs/README.md): docs
  index
- [`docs/project-overview.md`](/Users/preston/Code/zombie_invasion/docs/project-overview.md):
  product and runtime overview
- [`docs/current-state.md`](/Users/preston/Code/zombie_invasion/docs/current-state.md):
  implemented vs verified vs uncertain
- [`docs/architecture.md`](/Users/preston/Code/zombie_invasion/docs/architecture.md):
  system map
- [`docs/continuation-guide.md`](/Users/preston/Code/zombie_invasion/docs/continuation-guide.md):
  safe next-step and verification guidance

Historical evidence and deeper references:

- [`progress.md`](/Users/preston/Code/zombie_invasion/progress.md): append-only
  implementation and validation log
- [`playtest_pr_proposals.md`](/Users/preston/Code/zombie_invasion/playtest_pr_proposals.md):
  local playtest findings and candidate improvement threads
- [`docs/art/cinematic-low-poly-survival.md`](/Users/preston/Code/zombie_invasion/docs/art/cinematic-low-poly-survival.md):
  target visual direction

## What is implemented

- PlayCanvas first-person campaign with 12-wave survival defense.
- Cinematic low-poly village, lane, fog, moonlight, lanterns, zombies, mega zombies, and boss styling.
- Desktop and mobile controls for movement, fire, shop, weapon cycling, and ordnance.
- Infinite-ammo weapon loop plus grenade, C4, and nuke ordnance.
- Intermission field shop for weapons, armor, ordnance packs, town defenses, and med kit.
- Save/load profile `zombie_invasion_playcanvas_save_v1` in localStorage.
- Deterministic automation hooks:
  - `window.render_playcanvas_game_to_text()`
  - `window.render_game_to_text()` is still available only on `?legacy=1`.
  - `window.advanceTime(ms)`
- Docker deployment for LAN phone play on port `8080`.

## Current status

- Default route:
  PlayCanvas campaign slice from
  [`src/playcanvas`](/Users/preston/Code/zombie_invasion/src/playcanvas)
- Legacy route:
  older Three.js FPS runtime behind `?legacy=1` from
  [`src/fps`](/Users/preston/Code/zombie_invasion/src/fps)
- Important constraint:
  the repo supports that the PlayCanvas route is playable and smoke-tested, but
  full gameplay parity with the older FPS runtime is not yet proven in the
  checked-in docs and logs

## Project layout

- Active PlayCanvas runtime: `/Users/preston/Code/zombie_invasion/src/playcanvas`
- Legacy FPS runtime, available with `?legacy=1`: `/Users/preston/Code/zombie_invasion/src/fps`
- Legacy side-scroller preserved: `/Users/preston/Code/zombie_invasion/src/legacy2d`

## Controls

### Desktop

- Look: mouse (click canvas for pointer lock)
- Move: `WASD` or arrow keys
- Sprint: `Shift`
- Fire: `Space` or click
- Shop: `Q`
- Weapon cycle: `O`
- Ordnance cycle: `C`
- Use ordnance: `G`
- Fullscreen: `F`

### Mobile

- Direction pad: movement
- Buttons: fire, shop, weapon swap, ordnance blast, sprint

## Development

```bash
npm install
npm run dev
```

Open the default PlayCanvas game:

- `http://127.0.0.1:5173/`

The older Three.js FPS can still be opened for parity checks:

- `http://127.0.0.1:5173/?legacy=1`

The `/playcanvas.html` and `/playcanvas` routes also serve the PlayCanvas build
for compatibility with earlier preview links.

The target art direction for this route is documented in
`/Users/preston/Code/zombie_invasion/docs/art/cinematic-low-poly-survival.md`.
Run the visual smoke check with:

```bash
npm run smoke:playcanvas
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
