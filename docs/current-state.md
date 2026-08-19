# Current State

## 2026-08-19 Quality Pass

- The default PlayCanvas route remains the primary product experience; the
  `?legacy=1` Three.js route is explicitly maintained as a parity/reference
  runtime. See [Runtime Contract](./runtime-contract.md).
- Canonical verification is now `npm run verify`, which runs project-contract
  validation, Vitest, the production build, dist-contract checks, and the
  PlayCanvas browser smoke.
- Smoke tests resolve an available localhost port instead of assuming port
  `5176`, so parallel local runs no longer collide by default.
- Animal GLBs load on demand when animal enemies first appear, and music cues
  use metadata-only preload to reduce cold-start network work. Local build
  output still has large JavaScript chunks; the two reference-only soundtrack
  renders are now retained in source but omitted from the production package.

**Historical baseline (2026-07-13)** | Village-defense focus: 130 pass (3 files) | Build: green | Browser smoke: green

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
- **Enemy behavior variety** — `movementMode` branches in `stepZombies`:
  - Leaper / pouncer: 0.4 s amber telegraph freeze → parabolic pounce arc (peak 1.1 m,
    0.45 s airborne at `jumpSpeed`) toward locked target, cooldown reset on land
  - Flyer / revenant: hover at `hoverHeight` with sine bob; straight approach at full speed
  - Boss (mini_boss / mega_zombie / secret_boss by id): 0.7 s red charge-slam telegraph,
    1.8× speed charge, one-shot bonus hit capped at `min(9, attackDps×0.4)` on land
    within 2 m, 3.5 s cooldown; `slamHitFired` prevents double-trigger
  - Ground / crawler / walker / runner / skitter: config-driven movement, including
    per-type `zigzagStrength` for runner/skitter strafing
- Weapons: all 14 from `weapons_fps.json`; infinite-ammo firing, ADS spread, headshot (3.25× at pitch <−8°)
- Ordnance: frag/thermo/breacher/EMP grenades, C4, nuke (all types from `economy_fps.json`)
- Armor: cloth/kevlar/ceramic tiers; damage reduction applied per hit
- Gear: flashlight (visual), flint & steel (fire patches with TTL, DPS, merge, cap=3)
- Shop economy: weapon buy/equip, armor, gear, village upgrade, med kit, ordnance packs
- Village: seven independently destructible structures whose summed health is
  the village health; damage persists across waves and capacity changes retain
  each building's health ratio
- Village attack AI: unaggroed zombies retain the nearest live structure,
  route through authored fence gates, attack its perimeter, and retarget only
  when it falls
- Village bite: `VILLAGE_BITE_MULTIPLIER = 0.22`; `PLAYER_AGGRO_RADIUS = 13`;
  aggro-on-hit (4 s window), tuned so a lone wave-one walker removes less than
  10% of the village in 30 seconds; concurrent attackers use diminishing
  crowding returns, so four zombies deal about 2.1x one zombie's structure damage
- Villager escort: enter buildings, locate villager, escort to Town Hall, perk awarded on rescue
- Villager perks: shop discount, kill coin multiplier, damage reduction, HP bonus, grenade bonus
- Door system: exterior/interior door interaction with range check
- Breakable windows + structure impacts: material-specific particles, potential village damage tracked
- Save/load: `zombie_invasion_playcanvas_save_v1` in localStorage; sanitizes legacy field aliases
  and restores per-building health/collapse state by stable structure ID
- Lifetime stats: kills, damage dealt/taken, village damage, waves cleared, play seconds
- Adaptive music: `selectMusicCue` / `computeRaidThreatScore` from `musicDirector.js`;
  runtime MP3 assets replaced with Preston-supplied generated soundtrack renders
- First-session guidance: enemy intro messages, shop recommendations, wave threat briefs
- **Rewarded ads — multi-offer system** (was MISSING; now implemented):
  - Wave-clear summary: DOUBLE_WAVE_COINS / FREE_MEDKIT / BONUS_GRENADES (per-wave claim keys)
  - Game-over: REVIVE (one-per-run) + DOUBLE_WAVE_COINS + BONUS_GRENADES
  - `getPlayCanvasSummaryOffers` / `getPlayCanvasGameOverOffers` / `applyPlayCanvasRewardedOffer`
    in `sliceSimulation.js`; claim keys in `state.claimedOfferKeys` (persisted, sanitized for
    old saves)
  - Ad shim flow (loading → grant → claimed) with cancel-safe re-enable; amber `--zi` styling
  - Runtime ad telemetry in `state.rewardedRunState.telemetry` using the shared
    `createRewardedRunState` shape; records `offer_clicked`, `ad_completed`, `ad_failed`,
    `reward_granted`, and `reward_rejected`, capped at 80 events per run
  - Browser dispatch parity: PlayCanvas emits `zombie_invasion_rewarded_ad` `CustomEvent`
    with the recorded event detail; automation text exposes telemetry count/last-event fields
- **Persistent goals / challenges** (6 GOAL_DEFS exported from `sliceSimulation.js`):
  - Wave Survivor (bestWave ≥ 5, +50 coins), Veteran Defender (bestWave ≥ 10, +100 coins),
    Exterminator (lifetime kills ≥ 500, +75 coins), Iron Endurance (wavesCleared ≥ 10, +60 coins),
    Night Shift (playSeconds ≥ 1200, +80 coins), Guardian of the Village (rescued ≥ 6, +120 coins)
  - Evaluated at wave-clear/boss-defeat/game-over; completed ids in `state.claimedGoalIds`
    (persisted, sanitized for old saves); coin bonus applied once; toast fires on completion
  - "Goals" menu section shows progress bars and done badges
- Rewarded ad — revive-on-death: CrazyGames / Poki / mock; one revive per run
- Player movement: WASD, sprint (stamina drain), crouch (0.65× spread), double-jump with float window
- Wave grace period (5.5 s countdown overlay at wave start)
- Pointer-lock mouse-look (fixed; drag-look fallback when lock unavailable)

### Visual Layer (main.js — PlayCanvas Application)

- **GLB zombie pipeline** (`?glb=0` to opt out): Quaternius CC0 skinned model
  (`public/models/zombie-quaternius.glb`) — Walk/Run/Crawl/Jump animations per type;
  Jump/Jump_Idle clips play during pounce and hover; procedural rig fallback while container
  loads or if `?glb=0`
- Procedural humanoid rig (`zombieRig.js`): articulated joint hierarchy, hunched posture,
  walk cycle, glowing eyes, 3 shirt variants, per-zombie point light
- Movement-based zombie facing: smooth 540°/s yaw interpolation; facing matches sim targeting rule
- **Enemy behavior rendering**: `zombie.y` drives entity Y on both GLB and rig paths; GLB
  blob shadow counter-translated to stay grounded during lift; telegraph cues drawn as additive
  ground rings parented to app root (amber for pounce, red for boss slam); boss/brute visual
  heavy differentiation; night-style lighting
- **GLB villagers**: Quaternius skinned villager model with man/woman alternation by id hash;
  smooth facing; primitive capsule+head rig fallback
- Night-style environment: ACES tone mapping, linear fog (start 42, end 95), moon disc + halo,
  6 cloud clusters, ground-mist billboards, 32 lane trees (pines + deciduous clusters),
  24 rocks, 20 grass tufts
- Additive eye / muzzle glow coronas; CameraFrame bloom gated behind `?bloom=1`
- 9 first-person weapon viewmodels: sidearm, compact, rifle, shotgun, precision, heavy,
  launcher, flamethrower, pipe — each with gloved hands/forearms and camera fill light
- Shot FX pool: star muzzle flash (8 slots), muzzle light pulse, emissive tracers (8 slots),
  material-tinted impact bursts (3 slots × 6 particles); ballistic shots apply subtle tracer
  sag from `lastCombatEvent.ballistic.dropMeters`; zero per-shot allocations after warmup
- Damage flash overlays: player (red radial), village (orange top)
- Minimap: canvas 2D with zombie/villager/door/fire/building layers plus
  per-building damage colors, thick active attack rings with filled threat glyphs,
  and destroyed-building X marks; marker line widths are isolated from the village ring
- Building damage presentation: staged cracks/scorch, fallen beams, fire/smoke,
  rubble replacement, a player-facing world health marker with an exclamation beacon,
  HUD structure alert, and surviving-building count
- Runtime performance telemetry: rolling FPS, frame time, slow-frame count, worst frame time,
  quality profile, and render scale exposed through `render_game_to_text`
- Shop: in-raid side panel (all item types)

### UI/UX — Design Token System and HUD

- **`--zi-*` CSS design token system** (`playcanvas.css :root`): color, spacing, typography,
  border-radius, shadow tokens used throughout
- **HUD rebuilt into 4 edge-anchored clusters** (replaced 16-stat grid):
  - `.zi-hud-objective` (top-left): wave chip + village integrity bar
  - `.zi-hud-meta` (top-right): coins + kills + gear icon settings button
  - `.zi-hud-vitals` (bottom-left): health bar, stamina bar, weapon/ammo row
  - Phase toast: compact wave-start / intermission overlay; long status copy wraps instead of truncating
  - Bars driven by ratio with color thresholds (HP bar turns red when low)
- In-game HUD clusters suppressed behind full-cover flow modals
- Unified modal design language across menu / shop / game-over / victory panels
- Lifetime stats table in game-over / summary flow

### Mobile Controls (Redesigned)

- **Left virtual joystick** (replaces 11-button d-pad wall): touch-down sets floating base;
  knob tracks within `pc-joystick-zone` bottom-left; analog move applied per frame
- **Right canvas look-zone** (top parity gap — now FULL): right 55% of canvas is the look zone
  with dead-zone 0.24, response curve exponent 1.75, gain 0.62 — matching legacy
  `mobileFpsControls.js` right-stick parameters
- Big FIRE button (center-right)
- BLAST / SWAP / SHOP primary cluster + "···" More popover (Run / Duck / Jump / ADS / Flint /
  Map / Use)
- **Settings/pause sheet** (gear icon in HUD meta): Music / Sound FX / Haptics / Fullscreen
  toggles + Reset Run / Clear Save / Legacy Build link; Resume button
- Desktop hides touch controls (`display:none` on `.pc-mobile-controls` for fine-pointer/hover)

### Game-Feel Juice

- **Reticle hitmarkers**: hit (white ticks expand/fade), kill (larger ticks + orange/white),
  headshot (gold variant)
- **Kill "+coins" floater**: text rises from center, 0.72 s animation
- **HUD stat pops**: transient class toggles on coin/kill/ammo HUD elements
- **Trauma-based screen shake**: `_shakeTrauma` decays each frame; additive pitch/yaw offset
  applied to camera; `prefers-reduced-motion` respected (`window.matchMedia` on init)
- **Low-HP red vignette**: pulsing radial-gradient edge when player HP < 30%; pulse rate and
  amplitude scale with severity; damage flash restyled to inset edge vignette
- **Mobile haptics** (`navigator.vibrate`, guarded): patterns for fire / hit / kill / bite /
  ordnance; Haptics toggle in settings sheet; persisted to `localStorage zi_haptics`
- **Kill-streak badges**: badge shows at ≥ 3 kills within 3 s (COMBO / HOT STREAK / SLAYER /
  RAMPAGE milestones); pops in, auto-hides

### Audio (Generated Music + Procedural Web Audio)

Generated soundtrack MP3s live in `public/audio/music/` and are documented in
`src/fps/assets/ASSETS.md`. Runtime cues keep the existing `MUSIC_CUES` filenames:
menu, safe house, shop/intermission, raid low/mid/high, boss, victory, and
game-over. `main_motif.mp3` and `shop_intermission_alt.mp3` are reference-only
assets and are not wired to runtime music.

`test/music_assets.test.js` verifies that every adaptive music cue has a real MP3
asset, preserves the current pressure-band remap, and keeps reference renders out
of the runtime cue map.

### Procedural SFX (audio3d.js Primitives)

All 10 cues gated by `sfxEnabled` / `musicEnabled`; `audio3d.js` (shared) was not modified.

| Cue | Trigger |
|---|---|
| Hit confirm (soft sine tone, 40 ms) | `_sfxHitConfirm` — hit without kill |
| Kill thud + sub-punch | `_sfxKill` |
| Headshot ding (bright ping) | `_sfxHeadshot` |
| Streak arpeggio (4-note ascending triangle, root rises per tier) | `_sfxStreak` at ×3/×5/×7/×10 |
| Reload start (click) | `_sfxReloadStart` |
| Reload finish (clack) | `_sfxReloadFinish` |
| Empty mag click | `_sfxEmpty` |
| Coin ching | `_sfxCoin` |
| Player damage thud | `_sfxPlayerDamage` |
| Low-HP heartbeat loop (< 25% HP) | `_sfxHeartbeatTick` |
| UI click / shop buy | `_sfxUiClick` / `_sfxShopBuy` |

Night ambient bed (`_startNightBed` / `_stopNightBed`): evolving slow pad on music channel;
runs during `running` and `intermission` phases; gated by `musicEnabled`.

### Verified Baseline (2026-07-08)

| Check | Result |
|---|---|
| `npm test` | 38 files, 204 tests, all pass |
| `npm run build` | Pass (existing chunk-size warning only) |
| `npm run smoke:playcanvas` | Pass, exit 0 |
| Generated soundtrack assets | Confirmed by `test/music_assets.test.js`: MP3 files exist for all runtime cues; `raid_high` and boss share the requested render; motif/shop alternate stay reference-only |
| Top status toast readability | Confirmed by smoke: pointer-lock fallback copy renders fully without nowrap/hidden overflow/ellipsis; screenshot `output/playcanvas-slice-smoke.png` |
| GLB zombie pipeline (default) | Confirmed via smoke and harness shots |
| GLB villager pipeline | Confirmed in source; async fallback to primitive rig |
| Zombie facing (movement-based) | Confirmed via real-GPU test |
| Weapon fire FX pool | Confirmed via `?fxslow=1` harness |
| Leaper pounce + amber ring | Confirmed via live-GPU: `zombie.y ≈ 0.76` caught mid-arc, shadow grounded |
| Flyer hover | Confirmed via live-GPU: entity floats at `hoverHeight` |
| Rewarded-ad multi-offers + telemetry | Confirmed: 13 focused tests covering offer apply-once, medkit heal, grenades, goals, save round-trip, run-state telemetry cap, and snapshot mirroring |
| Virtual left joystick | Confirmed in source; `.pc-joystick-base` / `.pc-joystick-knob` wired |
| Right-zone canvas look | Confirmed: dead-zone 0.24, exponent 1.75, gain 0.62 matching legacy right-stick |
| Hitmarker / streak / floater DOM | Confirmed: element presence + worker inline capture |
| Low-HP vignette | Confirmed: renders without obscuring view |
| Settings sheet haptics toggle | Confirmed via live-GPU: toggle visible and functional |
| PlayCanvas performance telemetry | Confirmed via smoke: `perfFpsAvg`, `perfFrameMsAvg`, `perfSlowFrames`, `perfWorstFrameMs`, `qualityProfile`, and `renderScale` exposed in `render_game_to_text` |
| Ballistic tracer visual sag | Confirmed via smoke: `tracerDropVisual` reports positive sag after a ballistic shot |

### Persistent Village Defense Finish Line (2026-07-13)

| Check | Result |
|---|---|
| Focused deterministic tests | 3 files, 129 tests passed |
| Production build | Passed; existing large-chunk warning only |
| Browser gameplay smoke | Passed with real zombie-to-building damage, world/HUD/minimap alerts, critical and destroyed visual states, and mobile no-overlap assertions |
| Pacing | A lone learning-wave walker cannot remove 10% of village health in 30 simulated seconds |
| Persistence boundary | Structure damage survives wave transitions and save/load; no inter-wave auto-heal |
| Release boundary | Local-only proof; no deployment or hosted verification performed |
| Evidence | `output/village-defense/` and `docs/qa/feature-finish-line/2026-07-13-persistent-village-defense.md` |

---

## Parity Status — Honest Assessment

A full requirement-by-requirement audit was completed on 2026-06-12 and updated through
2026-07-07. Full results are in [`docs/parity-audit.md`](./parity-audit.md). Summary:

| Status | Count |
|---|---|
| FULL | 54 |
| PARTIAL | 1 |
| MISSING | 0 |
| N/A-BY-DESIGN | 5 |
| **Total features audited** | **60** |

*(Boot loading, village damage feedback, crawler presentation, and per-type zigzag
strength are now verified FULL in the PlayCanvas route.)*

**Full parity is not yet achieved.** The PlayCanvas route is feature-rich and
playable end-to-end, but has one residual partial gap versus the legacy Three.js FPS route.

### Remaining MISSING Feature

- None currently identified.

### Remaining PARTIAL Feature

1. **3D ballistics vs hitscan** (item 10): Legacy projectiles have muzzle velocity, gravity
   drop, drag, and penetration. PlayCanvas now records ballistic flight/drop metadata in
   combat events using the legacy drop formula and renders tracer sag from that data, but still
   resolves weapon hits instantly with distance-falloff hitscan.

See [`docs/parity-audit.md`](./parity-audit.md) for the complete table with per-feature delta
notes and legacy source citations.

---

## Architecture Constraints (Intentional Non-Parity)

These items are absent from the PlayCanvas route by explicit design decision
(documented in `CLAUDE.md`):

- **Rapier3D physics** — collision and movement use pure distance checks. No physics capsule,
  no knockback on hit.
- **Three.js render pipeline** — no bloom, DOF, or SSAO post-processing. PlayCanvas uses ACES
  tone mapping natively. Bloom is available behind `?bloom=1` via `pc.CameraFrame` but disabled
  by default (eye/muzzle corona spheres deliver the halo look in the normal pipeline).
- **3D ballistics** — `weaponBallistics.js` projectile travel, gravity drop, and drag are
  represented in PlayCanvas combat telemetry, but gameplay still uses hitscan with distance
  falloff instead of authoritative projectile travel.

---

## Important Distinctions

### Proven vs aspirational

The PlayCanvas route is proven playable from start (wave 1) through win (secret boss defeated)
in automated tests and smoke runs. The `progress.md` log records real-GPU inspection at each
major milestone.

### Local vs hosted

Hosted proof on Vercel is current as of 2026-07-08. Production deployment
`dpl_2xG8dtRpfTir4WL7kvTkUnEoEZZc` is `Ready` at
`https://zombie-invasion-alpha.vercel.app/` and immutable URL
`https://zombie-invasion-6mghi0w8z-preston-popes-projects.vercel.app/`.
HTTP checks for `/` and `/playcanvas` passed, hosted PlayCanvas smoke passed,
and generated soundtrack MP3s returned HTTP 200 `audio/mpeg`. Docker
`docker compose up --build -d` remains available for LAN play.

### Save key isolation

The PlayCanvas route uses `zombie_invasion_playcanvas_save_v1`; the legacy FPS route uses
`zombie_invasion_fps_save_v1`. They do not share saves.

---

## Recommended Reading Order

1. [`docs/architecture.md`](./architecture.md) — system layout
2. [`docs/parity-audit.md`](./parity-audit.md) — feature-by-feature gap table
3. [`docs/continuation-guide.md`](./continuation-guide.md) — next-steps guidance
4. `progress.md` — detailed historical evidence for individual validation steps
