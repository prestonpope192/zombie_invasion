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

- PlayCanvas first-person campaign with 12-wave survival defense plus secret boss phase.
- Cinematic low-poly village, lane, fog, moonlight, GLB skinned zombies (Quaternius CC0) and
  villagers, heavy enemy differentiation, night lighting, additive eye/muzzle glow coronas.
- **Enemy behavior variety**: leapers pounce with 0.4 s amber telegraph and parabolic arc;
  flyers hover at type-defined height; bosses execute a charge-slam with 0.7 s red telegraph.
- **UI/UX design system**: `--zi-*` CSS token system; HUD rebuilt into four edge-anchored
  clusters (objective / meta / vitals / phase toast); mobile controls redesigned around a
  virtual left joystick + FIRE + BLAST/SWAP/SHOP cluster + "···" More popover; settings/pause
  sheet (gear icon) with Music / Sound FX / Haptics / Fullscreen / Reset / Clear Save / Legacy;
  unified modal design language across all screens; desktop hides touch controls.
- **Game-feel juice**: reticle hitmarkers (hit/kill/headshot variants), kill "+coins" floater,
  trauma-based screen shake (`prefers-reduced-motion` aware), low-HP red vignette, mobile
  haptics (navigator.vibrate, toggle in settings), kill-streak badges.
- **10 procedural Web Audio SFX cues** built from audio3d.js primitives: hit confirm, kill
  thud, headshot ding, streak arpeggio, reload start/finish, empty click, coin ching, player
  damage thud, low-HP heartbeat; plus a night ambient bed. All gated by sfxEnabled/musicEnabled.
- **Rewarded ad multi-offers**: wave-clear summary offers DOUBLE_WAVE_COINS / FREE_MEDKIT /
  BONUS_GRENADES; game-over offers REVIVE + bonus coins/grenades; claim-tracked per wave with
  run-state telemetry and `zombie_invasion_rewarded_ad` browser events.
- **Persistent goals/challenges**: 6 GOAL_DEFS (wave milestones, lifetime kills, waves cleared,
  play time, villager rescues); progress bars in Goals menu section; one-time coin bonuses.
- Desktop and mobile controls for movement, fire, shop, weapon cycling, and ordnance.
- All 14 weapons + ordnance (frag/thermo/breacher/EMP/C4/nuke) from config; armor and gear
  items; intermission field shop; village upgrade; med kit.
- Village-bite difficulty tuning: `VILLAGE_BITE_MULTIPLIER = 0.34`, `PLAYER_AGGRO_RADIUS = 13`,
  aggro-on-hit (4 s window).
- Villager escort → perk system; adaptive music; first-session guidance.
- Save/load profile `zombie_invasion_playcanvas_save_v1` in localStorage.
- Deterministic automation hooks:
  - `window.render_playcanvas_game_to_text()`
  - `window.render_game_to_text()` is available on the default PlayCanvas route and `?legacy=1`.
  - `window.advanceTime(ms)`
  - rolling performance telemetry in render text: FPS, frame time, slow frames, quality profile,
    and render scale
- Docker deployment for LAN phone play on port `8080`.

## Current status

- Default route:
  PlayCanvas campaign slice from
  [`src/playcanvas`](/Users/preston/Code/zombie_invasion/src/playcanvas)
- Legacy route:
  older Three.js FPS runtime behind `?legacy=1` from
  [`src/fps`](/Users/preston/Code/zombie_invasion/src/fps)
- Test baseline: 197 Vitest tests pass; PlayCanvas smoke exit 0 (as of 2026-07-07)
- Parity status: 54 of 60 audited features are FULL; 1 PARTIAL; 0 MISSING. Full
  parity not yet achieved because true 3D ballistics remain partial. See
  [`docs/parity-audit.md`](/Users/preston/Code/zombie_invasion/docs/parity-audit.md).

## Project layout

- Active PlayCanvas runtime: `/Users/preston/Code/zombie_invasion/src/playcanvas`
- Legacy FPS runtime, available with `?legacy=1`: `/Users/preston/Code/zombie_invasion/src/fps`
- Legacy side-scroller preserved: `/Users/preston/Code/zombie_invasion/src/legacy2d`

## Controls

### Desktop

- Look: mouse (click canvas for pointer lock; drag fallback if lock unavailable)
- Move: `WASD` or arrow keys
- Sprint: `Shift`
- Jump: `Space`
- Fire: left-click or `E`
- Shop: `Q`
- Weapon cycle: `O`
- Ordnance cycle: `C`
- Use ordnance: `G`
- Fullscreen: `F`
- Settings / pause: gear icon in HUD (top-right cluster)

### Mobile

- **Move**: left virtual joystick (bottom-left zone; base appears on touch-down)
- **Look**: drag anywhere in the right 55% of the screen (dead-zone, analog response curve)
- **FIRE**: large button (bottom-right)
- **BLAST / SWAP / SHOP**: primary action cluster
- **More (···)**: secondary popover — Run, Duck, Jump, ADS, Flint, Map, Use
- **Settings**: gear icon in HUD meta cluster (Music / SFX / Haptics / Fullscreen / Reset /
  Clear Save / Legacy)

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
