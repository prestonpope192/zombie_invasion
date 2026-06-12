# Project Overview

## Purpose

Zombie Invasion is a browser-based zombie village-defense game with desktop and
mobile play support. The current repo contains two playable runtime lines:

- a newer PlayCanvas campaign slice, which is the default route
- an older, more feature-rich Three.js FPS build, available behind `?legacy=1`

The repository currently presents the PlayCanvas route as the forward-looking
experience and preserves the Three.js FPS implementation for parity checks and
reference.

## Product Shape

The implemented game loop across the repo is a 12-wave defense structure with
combat, shop/intermission progression, village health pressure, and mobile-aware
controls. The exact level of feature completeness differs by runtime:

- PlayCanvas route:
  - default entrypoint from [`src/main.js`](/Users/preston/Code/zombie_invasion/src/main.js:1)
  - aimed at a cinematic low-poly campaign presentation
  - includes deterministic automation hooks and a smoke test path
- Legacy Three.js FPS route:
  - reachable with `?legacy=1`
  - contains the larger established scene, systems, economy, and test surface
  - remains the deeper implementation reference while PlayCanvas evolves

## Cold-Start Orientation

If you are new to the repo, start in this order:

1. Read [Current State](./current-state.md) to avoid assuming the default route
   already matches the older FPS implementation.
2. Read [Architecture](./architecture.md) to understand where PlayCanvas,
   legacy FPS, tests, and deployment logic live.
3. Use [Continuation Guide](./continuation-guide.md) before making changes so
   you preserve the repo's current verification discipline.

## Main Entry Points

- Root app bootstrap:
  [`src/main.js`](/Users/preston/Code/zombie_invasion/src/main.js:1)
- Legacy Three.js FPS app:
  [`src/fps/app/FpsGame.js`](/Users/preston/Code/zombie_invasion/src/fps/app/FpsGame.js:1)
- PlayCanvas app:
  [`src/playcanvas/main.js`](/Users/preston/Code/zombie_invasion/src/playcanvas/main.js:1)
- Build and local server config:
  [`package.json`](/Users/preston/Code/zombie_invasion/package.json:1),
  [`vite.config.js`](/Users/preston/Code/zombie_invasion/vite.config.js:1)

## What This Repo Does Well Already

- Preserves implementation evidence in code and tests.
- Includes local deployment paths for browser play and LAN phone testing.
- Keeps historical implementation and validation detail in `progress.md`.

## What This Repo Needed

Before this doc pass, the repo had useful material but not a clear canonical
spine. Important facts were split between `README.md`, `progress.md`,
`playtest_pr_proposals.md`, and code inspection.
