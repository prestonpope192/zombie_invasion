# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev               # Vite dev server at http://127.0.0.1:5173
npm run dev:playcanvas    # Dev server opened directly on playcanvas.html
npm run build             # Production build
npm run preview           # Serve built dist on port 8080
npm test                  # Run full Vitest suite (node environment)
npm run test:watch        # Vitest in watch mode
npm run smoke:playcanvas  # Playwright smoke of the PlayCanvas route
docker compose up --build -d  # LAN play build served via nginx on port 8080
```

Run a single test file:
```bash
npx vitest run test/playcanvas_slice.test.js
```

To expose the dev server on the local network (LAN phone testing):
```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

## Route Split

`src/main.js` selects the runtime at load time:

- **Default** (`/`): PlayCanvas route — `src/playcanvas/main.js`
- **Legacy** (`/?legacy=1`): Three.js FPS route — `src/fps/app/FpsGame.js`

Both share the same config JSONs and most system modules under `src/fps/`.

## PlayCanvas Route (`src/playcanvas/`)

The goal is to reach full feature parity with the legacy Three.js FPS runtime. It is **not yet there**.

- **`main.js`** — `PlayCanvasZombieSlice` class: owns the PlayCanvas `Application`, all scene geometry (procedural low-poly primitives), DOM/HUD, input, audio, minimap, shop UI, and the render loop. This is one large file — the rendering/visual layer lives entirely here.
- **`sliceSimulation.js`** — pure gameplay logic (no Three.js or PlayCanvas API calls). Exports `createSliceState`, `stepSlice`, `startSlice`, `fireSliceWeapon`, `useOrdnance`, shop buy functions, and all snapshot getters. Imports heavily from `src/fps/systems/` and `src/fps/config/`. This is the authoritative parity surface.
- **`playcanvas.css`** — styles for HUD, shop panel, minimap, mobile controls, and flow/intermission panels.

Save key: `zombie_invasion_playcanvas_save_v1` (localStorage). The legacy FPS uses a separate key.

## Legacy Three.js FPS Route (`src/fps/`)

The reference implementation. Richer feature depth than PlayCanvas today.

- **`app/FpsGame.js`** — shell: loads all configs, constructs Three.js scene/camera/renderer, instantiates all scene and system objects, runs the fixed-timestep loop (`FIXED_DT = 1/60`).
- **`scenes/`** — discrete game states: `BootScene3D`, `MenuScene3D`, `RaidScene3D`, `ShopScene3D`, `SummaryScene3D`, `GameOverScene3D`. `FpsGame` transitions between them.
- **`systems/`** — all reusable gameplay and rendering logic. Key ones:
  - `waveDirector3D.js` — wave spawning and timing
  - `enemyAi3D.js` — zombie pathfinding and behavior
  - `weaponBallistics.js` / `weaponSlots.js` — shooting and loadout
  - `shopRules.js` / `progressionRules.js` — economy and upgrade logic
  - `villageDamageRules.js` / `villageFeedback.js` — village health
  - `villagerEscortRules.js` — escort/rescue flow
  - `saveFps.js` — localStorage save/load
  - `audio3d.js` — shared by both routes
  - `mobileFpsControls.js` — touch input (shared)
  - `physicsWorld.js` — Rapier3D physics (legacy only; PlayCanvas route does not use physics)
  - `renderPipeline.js` — Three.js post-processing (legacy only)
  - `musicDirector.js` — adaptive music cue selection (shared via sliceSimulation)
- **`config/`** — JSON content tables: `weapons_fps.json`, `enemies_fps.json`, `waves_fps.json`, `buildings_fps.json`, `economy_fps.json`, `boss_fps.json`, `quality_profiles.json`, `materials_physics.json`. Both routes share these.

## Tests (`test/`)

Vitest, `node` environment, with `jsdom` and a `setupLocalStorage.js` setup file. Tests cover:

- PlayCanvas slice: `playcanvas_slice.test.js`
- Legacy game contracts and mode flow: `active_game_contract.test.js`, `fps_game_modes.test.js`, `raid_scene_contract.test.js`
- System-level: combat, wave flow, shop rules, village damage, villager escort, doors, enemy AI, weapon slots, boss phase, progression, save, audio, music director, minimap, rewarded ads
- UI scenes: menu, game-over, shop UI, summary, mobile controls

When adding PlayCanvas features, the main test file is `test/playcanvas_slice.test.js`. New gameplay logic in `sliceSimulation.js` should have corresponding tests there.

## Key Architectural Constraints

- `sliceSimulation.js` must remain free of PlayCanvas/Three.js API calls — it is tested in node and shared as pure logic.
- The PlayCanvas route currently does **not** use Rapier3D physics or the Three.js render pipeline. Collision and ballistics are simulated in `sliceSimulation.js` using distance checks.
- `src/legacy2d/` is a preserved reference; do not modify it.
- `progress.md` is an append-only evidence log — do not edit past entries.
- When the PlayCanvas route reaches parity, update `docs/current-state.md` with explicit proof.
