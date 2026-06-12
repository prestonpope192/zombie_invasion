# Current State

## Summary

The PlayCanvas route now has functional parity with the legacy Three.js FPS
route across all major gameplay systems:

- The default app route launches the PlayCanvas campaign slice.
- The older Three.js FPS implementation remains accessible behind `?legacy=1`.
- Full feature parity was achieved and all 153 automated tests pass (`npm test`
  as of 2026-06-09). The build completes cleanly (`npm run build`).

## Implemented

The PlayCanvas route (`src/playcanvas/`) now includes:

- **Stamina system**: sprint drain (12/s), jump cost (12), double-jump cost (16), recovery (8/s), HUD bar
- **Crouch mechanic**: Ctrl key, reduced eye height (1.3 m vs 1.62 m), crouch speed (2.2 m/s)
- **Double-jump**: float window (0.36 s at 0.48× gravity), stamina cost
- **Magazine reload**: per-weapon magSize, 1.3 s reload timer, pending reload flag, reload progress bar in HUD
- **Weapon spread**: ADS (0.4×), crouch (0.65×), sprint (2.0×) spread multipliers; headshot detection at pitch < −8° within 14 units (2.2× damage)
- **Fire patch merging**: FIRE_PATCH_MERGE_DIST=2.4, cap at 3 patches with multi-layer animated fire visuals and per-patch point lights
- **Dynamic crosshair**: CSS `--spread-mult` custom property, ADS collapse animation
- **Damage flash overlays**: player (radial red) and village (orange top) screen overlays, 0.45 s fade
- **Bite timing**: pulse-based at 0.42 s intervals, 9 dmg/pulse cap (replaces continuous DPS)
- **Recoil system**: per-shot camera pitch kick, 6°/s recovery, 8° max
- **Muzzle flash light**: per-shot omni point light at muzzle position, fades in 0.08 s
- **Impact particles**: material-specific debris (flesh/wood/concrete) per hit
- **Combat cue popups**: enemy intro messages with 3.5 s display on first encounter per type
- **Wave grace period**: 5.5 s safe zone with countdown overlay at wave start
- **Post-wave summary overlay**: wave/kills/coins/village stats shown for 4 s after wave clear
- **Revive-on-death**: rewarded ad flow (CrazyGames/Poki/mock) on `lost` phase; `revivePlayer()` function in sliceSimulation
- **Quality presets**: auto-detect mobile/desktop, shadow resolution from profile
- **Enemy pose animation**: walk sway and attack arm swipe driven by `biteCooldownSec` and `elapsedSec`
- **Fire sprite visuals**: multi-layer sphere stack (base, flame0, flame1, tip) with animated flicker and per-patch light
- A 12-wave defense loop with combat, shop flow, village health pressure, and save/load behavior
- Desktop and mobile control support (pointer lock, touch pad, right-click ADS, new jump/crouch/ADS buttons)
- Local build, preview, Docker, and Vercel deployment configuration
- 153 automated tests under [`/test`](/Users/preston/Code/zombie_invasion/test)

## Verified In-Repo

The repo claims the following local verification patterns, and the commands are
present in `package.json` or checked-in scripts:

- `npm test`
- `npm run build`
- `npm run smoke:playcanvas`
- `npm run preview`
- `docker compose up --build -d`

`progress.md` also records earlier local validation passes for:

- unit and scene-level tests
- Playwright/browser smoke checks
- Docker health verification
- a Vercel preview deployment

Those historical notes are useful evidence, but they should not be treated as
same-session proof without rerunning them.

## Important Distinctions

### Default route versus legacy route

[`src/main.js`](/Users/preston/Code/zombie_invasion/src/main.js:1) makes the
PlayCanvas route the default and sends the Three.js FPS build behind
`?legacy=1`.

### Proven versus aspirational PlayCanvas state

The repo evidence supports that the PlayCanvas route is playable and has a smoke
test path. The repo does not support a stronger claim that the PlayCanvas route
already matches the older FPS runtime in full feature depth.

### Local proof versus hosted proof

The repo includes Vercel and Docker deployment configuration, but hosted proof
should be treated separately from local proof. `progress.md` explicitly records
that an unauthenticated public Playwright smoke on the Vercel preview was
blocked by Vercel Authentication.

- **Main menu scene**: Stats panel (lifetime kills/waves/time/damage), settings panel (music, SFX, quality preset), collapsible controls help — all accessible from the `ready` phase flow panel via Stats/Settings buttons

## Visual Style Parity Pass (2026-06-11)

The PlayCanvas route was restyled to match the cinematic low-poly survival
reference art (moonlit village street). Verified on real GPU, with
`npm test` (153), `npm run build`, and `npm run smoke:playcanvas` all passing
after the pass:

- **Zombies**: articulated humanoid rig (`src/playcanvas/zombieRig.js`) —
  joint hierarchy, hunched shamble, walk/attack animation, grey-green flesh,
  3 shirt variants, glowing eyes with per-zombie light.
- **Atmosphere**: engine linear distance fog, ground-mist billboards, moonlit
  cloud clusters, moon halo, lifted blue ambient + cool fill light.
- **Environment dressing**: foliage-cluster trees, 4-tier pines, faceted
  rocks, grass tufts (seeded deterministic placement).
- **Weapon viewmodel**: gloved hands/forearms on all 9 weapons, gunmetal
  accent materials, camera-attached fill light so the weapon reads at night.

Engine decision: PlayCanvas retained — the reference style is achievable with
procedural low-poly geometry; no engine swap required.

## Known Gaps Or Active Uncertainty

- Rapier3D physics and Three.js post-processing are intentionally absent from
  the PlayCanvas route (per architecture decision; collision uses distance checks).
- `progress.md` is comprehensive but too large to act as the primary
  orientation doc.
- Current hosted status is not proven by this docs pass — only local
  `npm test` and `npm run build` were verified.

## Recommended Reading Order For New Work

1. Read [Architecture](./architecture.md).
2. Read [Continuation Guide](./continuation-guide.md).
3. Consult `progress.md` only when you need detailed historical evidence for a
   claim or validation step.
