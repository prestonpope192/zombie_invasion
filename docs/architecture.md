# Architecture

## Runtime Split

The repository currently contains two runtime paths.

### 1. PlayCanvas route

- Default app experience from
  [`src/main.js`](/Users/preston/Code/zombie_invasion/src/main.js:1)
- Main implementation in
  [`src/playcanvas/main.js`](/Users/preston/Code/zombie_invasion/src/playcanvas/main.js:1)
- Intended to carry the cinematic low-poly campaign direction documented in
  [`docs/art/cinematic-low-poly-survival.md`](/Users/preston/Code/zombie_invasion/docs/art/cinematic-low-poly-survival.md:1)

### 2. Legacy Three.js FPS route

- Loaded when the query string includes `?legacy=1`
- Main app class in
  [`src/fps/app/FpsGame.js`](/Users/preston/Code/zombie_invasion/src/fps/app/FpsGame.js:1)
- Holds the older but broader implementation surface for combat systems,
  scenes, progression, and save behavior
- Serves as the parity and compatibility reference, not the default product
  direction. See [Runtime Contract](./runtime-contract.md) before changing
  shared behavior.

## Source Tree

- [`src/main.js`](/Users/preston/Code/zombie_invasion/src/main.js:1):
  top-level route selection
- [`src/playcanvas`](/Users/preston/Code/zombie_invasion/src/playcanvas):
  PlayCanvas campaign simulation, shared village-structure definitions,
  deterministic minimap renderer, and DOM/UI integration
- [`src/fps/app`](/Users/preston/Code/zombie_invasion/src/fps/app):
  legacy FPS application shell
- [`src/fps/scenes`](/Users/preston/Code/zombie_invasion/src/fps/scenes):
  boot, menu, raid, shop, summary, and game-over scenes
- [`src/fps/systems`](/Users/preston/Code/zombie_invasion/src/fps/systems):
  reusable gameplay and rendering systems
- [`src/fps/config`](/Users/preston/Code/zombie_invasion/src/fps/config):
  content and balancing data
- [`src/legacy2d`](/Users/preston/Code/zombie_invasion/src/legacy2d):
  preserved earlier implementation for reference only

## Tests

The automated tests are concentrated under
[`/test`](/Users/preston/Code/zombie_invasion/test) and cover more than one
layer:

- game contracts and mode flow
- combat, rewards, waves, per-building village damage, and progression
- mobile controls and UI scenes
- PlayCanvas slice coverage

Run the canonical local verification with `npm run verify`.

Village-defense behavior is split deliberately:

- `villageStructures.js` owns authored structure footprints, health allocation,
  damage tiers, nearest-live targeting, and gate-aware navigation targets.
- `sliceSimulation.js` owns mutable structure state, zombie attacks, cumulative
  wave damage, aggregate village health, collision removal, and upgrades.
- `main.js` owns pooled world damage stages and HUD telemetry.
- `minimapRenderer.js` owns deterministic health, attack, and destruction marks.

## Local Dev And Packaging

### Core commands

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run smoke:playcanvas`
- `npm run verify` — canonical local contracts, tests, build, and browser smoke

### Local phone/LAN play

- Vite dev server can be explicitly exposed with
  `npm run dev -- --host 0.0.0.0 --port 5173`
- Docker serves the built app through nginx on port `8080`

Relevant files:

- [`package.json`](/Users/preston/Code/zombie_invasion/package.json:1)
- [`Dockerfile`](/Users/preston/Code/zombie_invasion/Dockerfile:1)
- [`docker-compose.yml`](/Users/preston/Code/zombie_invasion/docker-compose.yml:1)
- [`nginx.conf`](/Users/preston/Code/zombie_invasion/nginx.conf:1)
- [`vercel.json`](/Users/preston/Code/zombie_invasion/vercel.json:1)
- [`vite.config.js`](/Users/preston/Code/zombie_invasion/vite.config.js:1)

## Verification Boundary

This repo is structured to support deterministic local validation:

- unit/integration-style tests via Vitest
- browser smoke automation via checked-in scripts
- deployment sanity checks via Docker and Vercel config

Do not assume hosted parity or production readiness from local code structure
alone. Keep local proof and hosted proof separate in future docs and status
updates.
