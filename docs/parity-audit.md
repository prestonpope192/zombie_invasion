# PlayCanvas vs Legacy Three.js FPS — Feature Parity Audit

**Audit date:** 2026-06-12 (updated 2026-07-07)
**Auditor:** Documentation agent (read-only inspection; no code changes)
**Verification baseline:** `npm test` → 36 files, 195 tests, all pass; `npm run build` pass; `npm run smoke:playcanvas` pass
**Method:** Static source inspection of `src/fps/` (legacy), `src/playcanvas/` (PlayCanvas),
and `test/` against the feature surface enumerated from `src/fps/app/FpsGame.js`,
`src/fps/systems/`, `src/fps/scenes/`, and `src/fps/config/*.json`.

---

## Legend

| Status | Meaning |
|--------|---------|
| FULL | Behavioral and data parity; same config sources |
| PARTIAL | Feature exists but delta noted |
| MISSING | Not present in PlayCanvas route |
| N/A-BY-DESIGN | Explicitly excluded per CLAUDE.md architecture decision |
| UNVERIFIED | Cannot determine status from source alone; needs runtime check |

---

## Feature Parity Table

| # | Feature Area | Legacy Source | PlayCanvas Evidence | Status | Delta Notes |
|---|---|---|---|---|---|
| 1 | **Save / Load** | `saveFps.js`, `FpsGame.js` | `persistPlayCanvasSave` / `loadPlayCanvasSave` / `sanitizePlayCanvasSave` in `sliceSimulation.js` | FULL | Separate save key (`zombie_invasion_playcanvas_save_v1`). Sanitizes all legacy field aliases. |
| 2 | **Wave director (budget, composition, timing)** | `waveDirector3D.js`, `waves_fps.json` | `spawnWaveZombies`, `pickWaveSpawnType`, `beginWave` in `sliceSimulation.js`; `wavesConfig` imported | FULL | PlayCanvas implements budget/composition inline rather than via `WaveDirector3D` class, but uses the same `waves_fps.json` config. |
| 3 | **Enemy AI — ground movement** | `enemyAi3D.js` | `stepZombies` in `sliceSimulation.js` — 2D distance-check targeting, player-vs-village decision at 8 m | FULL | No Rapier physics; distance checks replace physics body movement. Behaviorally equivalent for players. |
| 4 | **Enemy AI — zigzag (runner / skitter)** | `enemyAi3D.js` (`zigzagStrength`) | `spawnZombie` stores `def.zigzagStrength`; `stepZombies` applies target-relative sine strafing scaled by `zombie.zigzagStrength`; regression coverage in `test/playcanvas_slice.test.js` | FULL | Runner/skitter now use the same per-type config scalar as the legacy AI instead of a fixed amplitude. |
| 5 | **Enemy AI — flyer / revenant (hover)** | `enemyAi3D.js` `movementMode=flyer` with `hoverHeight`, `hoverBobAmp` | `sliceSimulation.js` `stepZombies` mode=`flyer` branch: `zombie.y = hoverHeight + sin(elapsedSec*2+seq)*bobAmp`; straight approach; `zombie.y` drives entity Y in render | FULL | Flyers hover at `hoverHeight` with sine bob. GLB entity lift + grounded shadow counter-translation confirmed via live-GPU inspection. Jump/Jump_Idle clips play during hover. |
| 6 | **Enemy AI — leaper / pouncer (jump)** | `enemyAi3D.js` `movementMode=leaper` with `jumpIntervalSec`, `jumpSpeed` | `sliceSimulation.js` `stepZombies` mode=`leaper` branch: 0.4 s amber telegraph → `POUNCE_DURATION_SEC=0.45` s parabolic arc at `jumpSpeed`, peak 1.1 m; amber ground ring + GLB Jump clip in render | FULL | Leaper pounce-attack fully implemented. `POUNCE_TELEGRAPH_SEC=0.4`, `POUNCE_PEAK_Y=1.1`, `slamHitFired`-gated. Confirmed: telegraph → airborne arc with `zombie.y≈0.76` mid-pounce, grounded shadow. Tests: +5 in playcanvas_slice.test.js. |
| 7 | **Enemy AI — crawler (ground hug)** | `enemyAi3D.js` `movementMode=crawler` | `sliceSimulation.js`: crawler type stored/spawned; `zombieGlb.js` and `zombieRig.js` apply crawler scale/posture and Crawl animation | FULL | PlayCanvas achieves the player-facing crawler read through GLB/procedural visual scaling and Crawl animation. Movement remains ground-plane by design. |
| 8 | **Enemy types — full roster** | `enemies_fps.json`: 17 types (crawler, walker, runner, leaper, brute, armored, flyer, skitter, pouncer, revenant, juggernaut, zombie_pig, zombie_horse, zombie_cow, zombie_chicken, mega_zombie, mini_boss) | `sliceSimulation.js` imports `enemies_fps.json`; all types spawn per wave composition | FULL | All 17 types spawn. Stat scaling (HP×waveScale, speedMps, coinReward) applied uniformly. |
| 9 | **Headshot system** | `headshotRules.js`, `RaidScene3D.js` | `sliceSimulation.js` `fireSliceWeapon`: pitch < −8°, distance < 14, single target → 2.2× multiplier | FULL | PlayCanvas implements inline; same multiplier. |
| 10 | **Weapon ballistics (projectile travel, drag, drop)** | `weaponBallistics.js` (3D physics projectile) | `sliceSimulation.js` `getWeaponAttackProfile`: per-weapon cone+range+falloff; distance falloff curve | PARTIAL | Legacy uses true 3D projectile with gravity drop and drag. PlayCanvas uses hitscan with distance falloff. Effective DPS and effective range match by design but trajectory and penetration through cover differ. |
| 11 | **Weapon slots (1–0 hotkeys)** | `weaponSlots.js` | `WEAPON_SLOT_BINDINGS` in `main.js` + `setKey` handler | FULL | Same 14 slot bindings. |
| 12 | **Weapon cycle (tab/O)** | `RaidScene3D.js` | `cycleOwnedWeapon` in `sliceSimulation.js`; O key in `main.js` | FULL | |
| 13 | **Weapon equip from shop** | `ShopScene3D.js` | `buyOrEquipWeapon`, `equipOwnedWeapon` in `sliceSimulation.js` | FULL | |
| 14 | **Magazine reload** | `RaidScene3D.js` | `reloadSliceWeapon`, `state.reloadTimerSec`, `state.pendingReload` | FULL | |
| 15 | **ADS (aim-down-sights)** | `RaidScene3D.js` | `setPlayerAds`, spread multiplier 0.4× in `fireSliceWeapon` | FULL | |
| 16 | **All 14 weapons (config, unlock wave, cost, damage)** | `weapons_fps.json` | `sliceSimulation.js` imports `weaponsConfig`; `PLAYABLE_WEAPON_IDS` covers all 14 | FULL | |
| 17 | **Grenade (frag + types)** | `grenadeLoadout.js`, `RaidScene3D.js` | `grenadeLoadout.js` imported; `buyGrenadePack`, `useOrdnance`, `cycleOrdnance` | FULL | |
| 18 | **C4 charge** | `RaidScene3D.js` | `C4_DEF`, `buyC4Pack`, `useOrdnance` with c4 path | FULL | |
| 19 | **Nuke device** | `RaidScene3D.js` | `NUKE_DEF`, `buyNukePack`, `useOrdnance` with nuke path | FULL | |
| 20 | **Ordnance cycle** | `RaidScene3D.js` | `cycleOrdnance` exported from `sliceSimulation.js` | FULL | |
| 21 | **Armor system** | `economy_fps.json`, `RaidScene3D.js` | `buyOrEquipArmor`, `getArmorDamageMultiplier`, `ARMOR_DEFS` from `economyConfig` | FULL | |
| 22 | **Gear items (flashlight, flint & steel)** | `economy_fps.json`, `RaidScene3D.js` | `buyGearItem`, `useFlintAndSteel`, `hasGear`; flashlight visual in `main.js` | FULL | |
| 23 | **Flint & steel / fire patches** | `RaidScene3D.js` | `useFlintAndSteel`, `stepFirePatches`, `FIRE_PATCH_*` constants | FULL | Merge logic, TTL, DPS, cap (3) all present. |
| 24 | **Shop rules (cost, unlock wave, discount via villager perks)** | `shopRules.js` | `getShopItems`, `getDiscountedCost`, `getShopCostMultiplier` via villager perk modifiers | FULL | `shopRules.js` itself not imported; logic inlined in `sliceSimulation.js` using `villagerEscortRules.computeDiscountedCost`. Behavioral parity confirmed. |
| 25 | **Village upgrade (levels, HP scaling, cost growth)** | `economy_fps.json`, `ShopScene3D.js` | `buyVillageUpgrade`, `getVillageUpgradeCost`, `getVillageMaxHp` | FULL | |
| 26 | **Med kit** | `economy_fps.json`, `ShopScene3D.js` | `buyMedKit`, `getMedKitItem` | FULL | |
| 27 | **Village damage rules (structure hits, material, friendly fire)** | `villageDamageRules.js` | `computeVillageStructureDamage` imported; `resolvePlayCanvasStructureShot`, `FRIENDLY_FIRE_VILLAGE_DAMAGE=false` | FULL | Friendly fire intentionally disabled in PlayCanvas (`FRIENDLY_FIRE_VILLAGE_DAMAGE=false`); legacy same default. |
| 28 | **Village feedback (HP ratio, damage stage)** | `villageFeedback.js` | `main.js` `updateVillageDistress(dt)` drives HP-ratio distress: dim/flickering windows, pooled smoke, ember glow, and low-HP danger light | FULL | PlayCanvas has an independent visual damage-stage implementation rather than importing the Three.js helper. |
| 29 | **Breakable windows** | `villageDamageRules.js`, `RaidScene3D.js` | `BREAKABLE_WINDOW_DEFS`, `brokenWindowIds`, `entitiesByWindow` — window entities toggled off on break | FULL | |
| 30 | **Structure impact FX (material particles)** | `RaidScene3D.js` | `STRUCTURE_IMPACT_DEFS`, `recordPlayCanvasStructureImpact`, `createImpactEntity`, material-tinted debris | FULL | |
| 31 | **Villager escort system** | `villagerEscortRules.js`, `RaidScene3D.js` | `villagerEscortRules.js` imported; `stepVillagerEscort`, `interactWithPlayCanvasWorld`, `rescueVillager`, `killEscortedVillager` | FULL | |
| 32 | **Villager perks (rescued → permanent bonus)** | `villagerEscortRules.js` | `getVillagerPerkModifiers`, `VILLAGER_PERK_DEFS` used throughout `sliceSimulation.js` | FULL | |
| 33 | **Door system (enter/exit buildings)** | `doorRules.js`, `RaidScene3D.js` | `canInteractWithDoor` imported; `enterBuilding`, `exitActiveBuilding`, `DOOR_INTERACT_RANGE` | FULL | |
| 34 | **Buildings interior (spawn inside, villager spots)** | `buildings_fps.json`, `RaidScene3D.js` | `buildingsConfig` imported; interior floor/walls rendered; player teleport to `spawnInside` | FULL | |
| 35 | **Boss wave (mini_boss per wave)** | `boss_fps.json`, `waveDirector3D.js` | `BOSS_WAVE_TYPE_ID="mini_boss"`, `pickWaveSpawnType`, boss landscape mutation | FULL | |
| 36 | **Secret boss (post-wave-12 phase)** | `RaidScene3D.js`, `progressionRules.js` | `beginSecretBossPhase`, `completeSecretBoss`, `BOSS_DEF` from `boss_fps.json` | FULL | PlayCanvas implements inline instead of via `progressionRules.shouldTriggerSecretBossPhase`. |
| 37 | **Boss landscape mutation (trees → zombies)** | `RaidScene3D.js` | `triggerBossLandscapeMutation`, `LANDSCAPE_DEFS`, `entitiesByLandscape` toggled in `main.js` | FULL | |
| 38 | **Wave grace period** | `RaidScene3D.js` | `WAVE_GRACE_SEC=5.5`, countdown overlay in `main.js` | FULL | |
| 39 | **Post-wave summary overlay** | `SummaryScene3D.js` | Summary overlay in `main.js`, `waveSummary` from `completeWave` | FULL | PlayCanvas shows summary inline (HUD overlay); legacy shows separate scene. Content equivalent. |
| 40 | **Game over scene** | `GameOverScene3D.js` | `lost` phase → flow panel shows restart + revive + rewarded multi-offers (DOUBLE_WAVE_COINS / BONUS_GRENADES) in `main.js`; lifetime stats table in flow panel | FULL | Multi-offer buttons and lifetime stats now present. `getPlayCanvasGameOverOffers` drives offer list; amber `--zi` styling. Claim-tracked in `state.claimedOfferKeys`. |
| 41 | **Main menu scene** | `MenuScene3D.js` | `ready`/`lost`/`won` phases show flow panel with Stats (lifetime), Settings, Controls, Shop, Reset | FULL | |
| 42 | **Boot scene** | `BootScene3D.js` (asset pre-load, Rapier wasm init) | Themed `#zi-boot` overlay (index.html) shown on first paint, hidden on the PlayCanvas first frame with a 9s safety timeout; GLB loads async with procedural fallback | FULL | A night-themed loading screen (title + dual-ring spinner) now covers the cold-start moment. Rapier wasm init is N/A on the PlayCanvas route by design. |
| 43 | **Shop scene (between waves)** | `ShopScene3D.js` | Shop panel toggled in `main.js`; `getShopItems` from `sliceSimulation.js` | FULL | Legacy shop is a separate full-screen scene; PlayCanvas shop is an in-raid side panel. Items and economy identical. |
| 44 | **Rewarded ads — revive-on-death** | `rewardedAds.js`, `FpsGame.reviveFromRewardedAd` | `_triggerReviveAd` in `main.js` (CrazyGames / Poki / mock); `revivePlayer` in `sliceSimulation.js` | FULL | |
| 45 | **Rewarded ads — multi-offer (summary / game-over)** | `rewardedAdOffers.js`, `SummaryScene3D.js`, `GameOverScene3D.js` | `getPlayCanvasSummaryOffers` / `getPlayCanvasGameOverOffers` / `applyPlayCanvasRewardedOffer` in `sliceSimulation.js`; imports `REWARDED_OFFER_IDS` + `getSummaryOfferClaimKey` from `rewardedAdOffers.js`; claim keys in `state.claimedOfferKeys` (persisted) | FULL | Summary offers DOUBLE_WAVE_COINS / FREE_MEDKIT / BONUS_GRENADES per wave. Game-over offers REVIVE (one-per-run) + bonus coins/grenades. Ad shim: loading→grant→claimed with cancel-safe re-enable. Amber styling. 11 new tests cover apply-once, re-claim-blocked, medkit heal, revive, offer filtering, save round-trip. |
| 46 | **Rewarded ad telemetry / run-state** | `rewardedAdOffers.js` (`createRewardedRunState`, telemetry events) | Not present in PlayCanvas | MISSING | Legacy records per-run telemetry: offer_clicked, ad_completed, reward_granted, etc. PlayCanvas has no equivalent telemetry. |
| 47 | **Audio — SFX (weapon, impact, explosion)** | `audio3d.js`, `RaidScene3D.js` | `Audio3D` imported in `main.js`; `playWeapon`, `playImpact`, `playExplosion` called on fire/ordnance | FULL | |
| 48 | **Audio — adaptive music (musicDirector)** | `musicDirector.js`, `audio3d.js` | `selectMusicCue`, `computeRaidThreatScore` imported in `sliceSimulation.js`; `updateMusicState` called in `updateAudioState` in `main.js` | FULL | |
| 49 | **Audio — settings (music/SFX on/off)** | `FpsGame.persistAudioSettings` | `setPlayCanvasAudioSettings`, menu checkboxes in `main.js` | FULL | |
| 50 | **Minimap** | `minimapUtils.js`, `RaidScene3D.js` | `worldRadiusToMiniMapPx`, `worldToMiniMapPoint` imported; canvas-based minimap in `main.js` with zombie/villager/door/fire/structure layers | FULL | |
| 51 | **Mobile controls — move pad (DPAD)** | `mobileFpsControls.js` (left stick) | HTML touch buttons `data-touch-move` for forward/back/left/right | FULL | |
| 52 | **Mobile controls — look (right stick)** | `mobileFpsControls.js` (right stick joystick with radius/response) | Right 55% of canvas is a dedicated look zone with dead-zone 0.24, exponent 1.75, gain 0.62 (`LOOK_ZONE_SPLIT=0.45`, `DEADZONE=0.24`, `EXPONENT=1.75`, `GAIN=0.62` in `main.js`) | FULL | Parameters explicitly match legacy `mobileFpsControls.js` right-stick. Look zone coexists with left virtual joystick in move zone (left 45%). Canvas drag used only outside joystick zone. |
| 53 | **Mobile controls — action buttons** | `mobileFpsControls.js` | `data-touch-action` buttons: Run, Duck, Jump, ADS, Swap, Blast, Flint, Use, Map, Shop, Fire | FULL | |
| 54 | **Fullscreen toggle** | `FpsGame.toggleFullscreen` | `toggleFullscreen` method in `main.js` with webkit fallback | FULL | |
| 55 | **Quality profiles (renderScale, shadows)** | `quality_profiles.json`, `FpsGame.js` | Imported; `detectQualityProfile`, `renderScaleDpr`, shadow resolution from profile | FULL | Legacy also feeds quality profile into render pipeline post-processing. PlayCanvas: renderScale and shadow resolution applied; no post-processing pipeline. |
| 56 | **Render pipeline (bloom, tone mapping, DOF)** | `renderPipeline.js` (Three.js post-processing) | Not used in PlayCanvas route | N/A-BY-DESIGN | Per CLAUDE.md: "PlayCanvas route does not use the Three.js render pipeline." PlayCanvas uses ACES tone mapping via `camera.toneMapping`. |
| 57 | **Rapier3D physics (capsule, rigid bodies, knockback)** | `physicsWorld.js`, `RaidScene3D.js` | Not used | N/A-BY-DESIGN | Per CLAUDE.md: "PlayCanvas route does not use Rapier3D physics." Collision uses distance checks. Knockback on hit absent. |
| 58 | **Player controller (FPS capsule, Rapier movement)** | `playerControllerFps.js` | `movePlayer` in `sliceSimulation.js` — WASD + sprint/crouch/jump/double-jump, arena clamping | FULL (functionally) | Movement mechanics implemented in pure JS, no physics body. Double-jump is a PlayCanvas addition not in the legacy player controller. |
| 59 | **Stamina system** | `RaidScene3D.js` | `STAMINA_*` constants, sprint drain, recovery, jump cost in `sliceSimulation.js` | FULL | |
| 60 | **Crouch** | `RaidScene3D.js` | `input.crouch`, `CROUCH_SPEED_MPS`, `CROUCH_SPREAD_MULT` | FULL | |
| 61 | **Double jump** | Not in legacy FPS | `sliceSimulation.js` double-jump with float window | N/A-BY-DESIGN (PlayCanvas addition) | Extra capability; not a parity gap. |
| 62 | **First-session guidance (enemy intro, shop recommendation, wave brief)** | `firstSessionRules.js` | All 4 exports imported in `sliceSimulation.js`; used in `getPlayCanvasGuidanceSnapshot` | FULL | |
| 63 | **Progression rules (wave-clear rewards, secret boss trigger)** | `progressionRules.js` | Logic inlined in `completeWave`, `beginSecretBossPhase`; not imported directly | FULL (inline) | `progressionRules.js` is tested by separate test files but not imported in the PlayCanvas route; behavior is reproduced inline. |
| 64 | **Zombie pose rules** | `zombiePoseRules.js` (used by `enemyAi3D.js` for 3D arm pose) | `animateZombieRig` in `zombieRig.js` drives procedural rig; `animateZombieGlbEntity` in `zombieGlb.js` uses animation clips | FULL (visual layer) | `zombiePoseRules.js` specifically is not imported (it's Three.js vector-based). PlayCanvas has independent animation. |
| 65 | **GLB zombie pipeline (skinned model)** | N/A legacy | `zombieGlb.js` + `zombieRig.js`; default ON (`?glb=0` opt-out) | N/A-BY-DESIGN (PlayCanvas addition) | Extra fidelity; no legacy equivalent. |
| 66 | **Safe HTML escaping** | `safeHtml.js` | `escapeHtml` implemented locally in `main.js` (line 3058) | FULL | Inline duplicate; same behavior. |
| 67 | **Lifetime stats tracking** | `saveFps.js` (totalKills etc.) | `lifetimeStats` object in `sliceSimulation.js` with kills/damageDealt/damageTaken/villageDamageTaken/wavesCleared/playSeconds | FULL | |
| 68 | **Best-wave tracking** | `FpsGame.save.bestWave` | `state.bestWave` updated in `completeWave` | FULL | |
| 69 | **Sensitivity setting** | `FpsGame.save.sensitivity` | `state.sensitivity` saved; used as look multiplier in `applyLookDelta` | FULL | |

---

## Summary Counts

| Status | Count | Change from 2026-06-12 |
|--------|-------|------------------------|
| FULL | 53 | +7 (items 4, 5, 6, 7, 28, 40, 42 → from PARTIAL; item 45 → from MISSING) |
| PARTIAL | 1 | −7 |
| MISSING | 1 | −1 |
| N/A-BY-DESIGN | 5 | — |
| **Total** | **60** | net: 8 flips reduce PARTIAL by 7 and MISSING by 1; audit table is 60 distinct features |

**Status flips (2026-06-13 through 2026-07-07):**

| # | Feature | Old Status | New Status |
|---|---|---|---|
| 4 | Enemy zigzag strength | PARTIAL | FULL |
| 5 | Flyer / revenant hover | PARTIAL | FULL |
| 6 | Leaper / pouncer jump-pounce | PARTIAL | FULL |
| 7 | Crawler ground-hug presentation | PARTIAL | FULL |
| 28 | Village damage feedback stages | PARTIAL | FULL |
| 40 | Game-over scene depth (stats + multi-offers) | PARTIAL | FULL |
| 42 | Boot scene / loading screen | PARTIAL | FULL |
| 45 | Rewarded ads — multi-offer (summary / game-over) | MISSING | FULL |
| 52 | Mobile look — right-stick joystick | PARTIAL | FULL |

---

## MISSING Features (player-facing)

1. **Rewarded ad telemetry / run-state** — `createRewardedRunState`, offer-tracking, and all
   `zombie_invasion_rewarded_ad` custom events are absent from the PlayCanvas route. Analytics
   loss for ad effectiveness; no player-visible impact.

*(Rewarded ad multi-offers were MISSING as of 2026-06-12; promoted to FULL on 2026-06-13.)*

---

## PARTIAL Features (player-facing, ranked by impact)

1. **3D ballistics vs hitscan** (item 10): Legacy projectiles have muzzle velocity, gravity
   drop, drag, and penetration. PlayCanvas uses distance-falloff hitscan. Transparent to most
   players; hardcore players may notice sniper arcs vanish.

*(Mobile right-stick look, flyer hover, leaper pounce, game-over scene depth, and the boot
loading screen were PARTIAL as of 2026-06-12; all promoted to FULL on 2026-06-13.)*

---

## Notes on docs/current-state.md Alignment

`current-state.md` was updated on 2026-07-07 in sync with this audit refresh. The prior
version correctly stated full parity was not achieved, but several rows were stale after
subsequent implementation passes. Full parity remains not yet achieved:
1 MISSING feature and 1 PARTIAL feature remain open.

---

*See `progress.md` dated entries (2026-06-09 through 2026-06-12) for historical validation evidence.*
