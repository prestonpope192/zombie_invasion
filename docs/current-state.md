# Current State

**As of 2026-06-12** | Vitest: 153 pass (36 files) | Smoke: green

---

## Route Architecture

`src/main.js` selects the runtime at load time:

- **Default (`/`)** — PlayCanvas route: `src/playcanvas/main.js` + `src/playcanvas/sliceSimulation.js`
- **Legacy (`/?legacy=1`)** — Three.js FPS route: `src/fps/app/FpsGame.js`

Both routes share the same config JSONs (`src/fps/config/`) and most gameplay
system modules under `src/fps/systems/`.

---

## PlayCanvas Route — What Is Implemented

### Gameplay Systems (sliceSimulation.js — pure logic, node-testable)

- 12-wave defense loop + secret boss phase (post-wave-12)
- Wave spawning from `waves_fps.json` (budget, composition, boss slot, mega slot)
- All 17 enemy types from `enemies_fps.json` spawn with correct stats; wave-scaled HP/speed
- Weapons: all 14 from `weapons_fps.json`; mag reload, ADS spread, headshot (2.2× at pitch <−8°)
- Ordnance: frag/thermo/breacher/EMP grenades, C4, nuke (all types from `economy_fps.json`)
- Armor: cloth/kevlar/ceramic tiers; damage reduction applied per hit
- Gear: flashlight (visual), flint & steel (fire patches with TTL, DPS, merge, cap=3)
- Shop economy: weapon buy/equip, armor, gear, village upgrade, med kit, ordnance packs
- Village: HP with max determined by village level and villager perk modifiers
- Villager escort: enter buildings, locate villager, escort to Town Hall, perk awarded on rescue
- Villager perks: shop discount, kill coin multiplier, damage reduction, HP bonus, grenade bonus
- Door system: exterior/interior door interaction with range check
- Breakable windows + structure impacts: material-specific particles, potential village damage tracked
- Save/load: `zombie_invasion_playcanvas_save_v1` in localStorage; sanitizes legacy field aliases
- Lifetime stats: kills, damage dealt/taken, village damage, waves cleared, play seconds
- Adaptive music: `selectMusicCue` / `computeRaidThreatScore` from `musicDirector.js`
- First-session guidance: enemy intro messages, shop recommendations, wave threat briefs
- Rewarded ad — revive-on-death: CrazyGames / Poki / mock; one revive per run
- Player movement: WASD, sprint (stamina drain), crouch (0.65× spread), double-jump with float window
- Wave grace period (5.5 s countdown overlay at wave start)

### Visual Layer (main.js — PlayCanvas Application)

- **GLB zombie pipeline** (`?glb=0` to opt out): Quaternius CC0 skinned model
  (`public/models/zombie-quaternius.glb`) — Walk/Run/Crawl/Punch animations per type;
  procedural rig fallback while container loads or if `?glb=0`
- Procedural humanoid rig (`zombieRig.js`): articulated joint hierarchy, hunched posture,
  walk cycle, glowing eyes, 3 shirt variants, per-zombie point light
- Movement-based zombie facing: smooth 540°/s yaw interpolation; facing matches sim targeting rule
- Night-style environment: ACES tone mapping, linear fog (start 42, end 95), moon disc + halo,
  6 cloud clusters, ground-mist billboards, 32 lane trees (pines + deciduous clusters),
  24 rocks, 20 grass tufts
- 9 first-person weapon viewmodels: sidearm, compact, rifle, shotgun, precision, heavy,
  launcher, flamethrower, pipe — each with gloved hands/forearms and camera fill light
- Shot FX pool: star muzzle flash (8 slots), muzzle light pulse, emissive tracers (8 slots),
  material-tinted impact bursts (3 slots × 6 particles); zero per-shot allocations after warmup
- Villager entities: primitive capsule+head rig with health bar; GLB path supported
  (`animateVillagerGlbEntity`, smooth facing)
- Damage flash overlays: player (red radial), village (orange top)
- Minimap: canvas 2D with zombie/villager/door/fire/building layers
- Shop: in-raid side panel (all item types)
- Mobile touch controls: DPAD move pad + 11-button action pad

### Verified Baseline (2026-06-12)

| Check | Result |
|---|---|
| `npx vitest run` | 36 files, 153 tests, all pass |
| `npm run build` | Pass (existing chunk-size warning only) |
| `npm run smoke:playcanvas` | Pass, exit 0 |
| GLB zombie pipeline (default) | Confirmed via smoke and harness shots |
| Zombie facing (movement-based) | Confirmed via real-GPU test |
| Weapon fire FX pool | Confirmed via `?fxslow=1` harness |

---

## Parity Status — Honest Assessment

A full requirement-by-requirement audit was completed on 2026-06-12 and is
documented in [`docs/parity-audit.md`](./parity-audit.md). Summary:

| Status | Count |
|---|---|
| FULL | 46 |
| PARTIAL | 8 |
| MISSING | 2 |
| N/A-BY-DESIGN | 5 |
| **Total features audited** | **61** |

**Full parity is not yet achieved.** The PlayCanvas route is feature-rich and
playable end-to-end, but has gaps versus the legacy Three.js FPS route.

### Most Important Gap (Player Impact)

**Mobile look — no right-stick joystick.** The legacy route uses
`mobileFpsControls.js` with an analog right-stick zone (dead-zone, response
curve). The PlayCanvas route uses drag-on-canvas look, which is difficult to
operate on mobile while simultaneously using the move pad. This is the highest
player-impact gap given the stated mobile-first goal.

### Other MISSING Features

- Rewarded ad multi-offers (health refill / extra grenades / village repair at
  wave summary and game-over). Only revive-on-death is wired.
- Rewarded ad telemetry run-state (`zombie_invasion_rewarded_ad` custom events).

### Notable PARTIAL Features

- Flyer / Revenant enemies do not hover (approach at ground plane)
- Leaper / Pouncer enemies do not jump-pounce (behave as fast walkers)
- Village damage feedback stages (`villageFeedback.js` thresholds not used)
- Game-over scene lacks lifetime stat table and multi-offer buttons
- No right-stick virtual joystick for mobile look

See [`docs/parity-audit.md`](./parity-audit.md) for the complete table with
per-feature delta notes and legacy source citations.

---

## Architecture Constraints (Intentional Non-Parity)

These items are absent from the PlayCanvas route by explicit design decision
(documented in `CLAUDE.md`):

- **Rapier3D physics** — collision and movement use pure distance checks. No
  physics capsule, no knockback on hit.
- **Three.js render pipeline** — no bloom, DOF, or SSAO post-processing. PlayCanvas
  uses ACES tone mapping natively.
- **3D ballistics** — `weaponBallistics.js` projectile travel, gravity drop, and
  drag replaced by hitscan with distance falloff.

---

## Important Distinctions

### Proven vs aspirational

The PlayCanvas route is proven playable from start (wave 1) through win (secret
boss defeated) in automated tests and smoke runs. The `progress.md` log records
real-GPU inspection at each major milestone.

### Local vs hosted

Hosted proof on Vercel is not current. `progress.md` records that a prior
Vercel preview was blocked by Vercel Authentication in Playwright. Local `npm
run build` and `npm run preview` work; Docker `docker compose up --build -d`
is configured. Treat hosted status as unverified unless re-tested.

### Save key isolation

The PlayCanvas route uses `zombie_invasion_playcanvas_save_v1`; the legacy FPS
route uses `zombie_invasion_fps_save_v1`. They do not share saves.

---

## Recommended Reading Order

1. [`docs/architecture.md`](./architecture.md) — system layout
2. [`docs/parity-audit.md`](./parity-audit.md) — feature-by-feature gap table
3. [`docs/continuation-guide.md`](./continuation-guide.md) — next-steps guidance
4. `progress.md` — detailed historical evidence for individual validation steps
