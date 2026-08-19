# Persistent Village Defense - Feature Finish Line

**Date:** 2026-07-13
**Status:** Locally release-ready; not deployed or hosted-verified
**Runtime:** Default PlayCanvas route

## Acceptance Criteria

| Criterion | Result | Evidence |
|---|---|---|
| Zombies can attack any building | Complete | Shared seven-structure model; nearest-live selection and per-structure damage tests |
| Targets are nearest, not ordered | Complete | Stable nearest target with immediate retarget after destruction |
| Zombies can reach side buildings | Complete | Authored fence openings and gate-aware structure navigation |
| Village health comes from buildings | Complete | Aggregate health is recalculated from the seven structure records |
| Damage persists across waves | Complete | Wave transition regression proves no automatic healing |
| Damage persists across save/load | Complete | Stable-ID health ratios survive a real localStorage round trip; corrupt entries are ignored |
| Damage is visually obvious | Complete | Cracks/scorch, fallen beams, fire/smoke, rubble, world health marker, HUD alert, and minimap states |
| Player can locate active damage | Complete | Named HUD alert, pulsing world marker, and minimap attack ring |
| Destroyed buildings stop blocking play | Complete | Intact render/collision/roof surfaces are removed and rubble replaces the mesh |
| Village does not die in 30 seconds | Complete | A lone learning-wave walker removes less than 10% in 30 simulated seconds |
| A zombie pileup does not melt one building linearly | Complete | Four concurrent attackers deal about 2.1x, rather than 4x, a lone attacker's damage |
| Defense upgrade can recover a collapse | Complete | Upgrade increases capacity and rebuilds every structure |

## Implementation Summary

- Added `villageStructures.js` as the shared source of authored structure geometry,
  health shares, damage tiers, attack points, nearest-target selection, and gate routing.
- Replaced scalar village drain with per-building damage and a sum-derived village health bar.
- Zombies now retain a selected building, face their player/gate/building navigation target,
  attack the physical perimeter, and pick the nearest survivor after a collapse.
- Removed inter-wave healing. Damage survives every wave until the player buys the explicit
  Town Defenses rebuild/upgrade.
- Added crowding-based diminishing returns to structure bites so danger still grows with a swarm
  without multiplying building damage one-for-one for every overlapping attacker.
- Persisted normalized structure health by stable ID so a saved damaged or collapsed village
  restores against the current level/perk capacity without reviving buildings on reload.
- Added staged world damage, rubble swaps, a billboarding health marker, compact HUD alerts,
  surviving-building count, an exclamation beacon beside the active health bar, and deterministic
  minimap damage/attack/destruction rendering with isolated canvas stroke state.
- Compacted portrait guidance while a structure alert is active so the urgent alert, minimap,
  status toast, and controls remain separated on a 390x760 viewport.
- Made the rendered fence and simulation fence share the same three real gate openings.
- Removed collision and rooftop support from collapsed buildings so rubble does not hide an
  invisible intact structure.

## Focused Validation

Executed:

```bash
npx vitest run test/village_structures.test.js test/playcanvas_slice.test.js test/minimap_renderer.test.js
npm run build
PLAYCANVAS_SMOKE_PORT=5198 PLAYCANVAS_SMOKE_SCREENSHOT=output/village-defense/make-it-better-baseline.png npm run smoke:playcanvas
```

Results:

- Vitest: 3 files, 130 tests passed.
- Vite production build: passed; existing large-chunk warning only.
- Browser smoke: passed with no blocking page errors and all feature assertions satisfied.
- Full repository suite: intentionally not run; `npm run test:full` is reserved for a
  subsequent explicit `full-suite-tests` request.
- Suite wiring: every deterministic ledger test is discovered by `npm test`; the browser
  feature assertions are in `smoke:playcanvas`; `npm run test:full` executes both plus build.

## Finish-Line Coverage Ledger

| Issue or behavior | Failure mode / root cause | Direct executable coverage | Direct command | Broader command | Status |
|---|---|---|---|---|---|
| Village health must equal its buildings | The previous scalar HP had no structural ownership | `village_structures`: `allocates the full village health budget...`; `playcanvas_slice`: `derives aggregate village health...` | `npx vitest run test/village_structures.test.js test/playcanvas_slice.test.js -t "health budget|aggregate village health"` | `npm run test:full` | Passed |
| Zombies attack a nearest building, not a fixed order | Old AI drained a center scalar instead of selecting a structure | `village_structures`: `keeps a live preferred target stable...`; `playcanvas_slice`: `damages only the nearest live building...` | `npx vitest run test/village_structures.test.js test/playcanvas_slice.test.js -t "preferred target|nearest live building"` | `npm run test:full` | Passed |
| Zombies move on after a building falls | A cached target could strand attackers on a dead object | `playcanvas_slice`: `retargets the nearest surviving building immediately...` | `npx vitest run test/playcanvas_slice.test.js -t "retargets the nearest surviving building"` | `npm run test:full` | Passed |
| Side buildings remain reachable | A continuous fence had no physical gates and could trap ground AI | `village_structures`: perimeter/gate routing and fence-opening tests; `playcanvas_slice`: player and zombie gate tests | `npx vitest run test/village_structures.test.js test/playcanvas_slice.test.js -t "authored gate|gate opening|routes side structures"` | `npm run test:full` | Passed |
| Damage accumulates between waves | Intermission previously restored village health | `playcanvas_slice`: `keeps damage cumulative across waves without automatic healing` | `npx vitest run test/playcanvas_slice.test.js -t "keeps damage cumulative across waves"` | `npm run test:full` | Passed |
| Saved damage must not reset on reload | The save payload originally omitted all per-building health | `playcanvas_slice`: `persists building damage and destruction across a save/load round trip`; `sanitizes saved structure health by stable id...` | `npx vitest run test/playcanvas_slice.test.js -t "persists building damage|sanitizes saved structure health"` | `npm run test:full` | Passed |
| Village survival is paced beyond 30 seconds | Scalar drain and a 0.34 multiplier made early defeat too abrupt | `playcanvas_slice`: `does not let a lone learning-wave walker erase the village in thirty seconds` | `npx vitest run test/playcanvas_slice.test.js -t "lone learning-wave walker"` | `npm run test:full` | Passed |
| Concurrent attackers need bounded scaling | Linear per-zombie bites let clustered spawns erase one building before the player could rotate | `playcanvas_slice`: `applies diminishing damage when a swarm crowds one building` | `npx vitest run test/playcanvas_slice.test.js -t "diminishing damage"` | `npm run test:full` | Passed |
| Campaign ends only after total structural loss | One building reaching zero must not kill the entire run | `playcanvas_slice`: `ends the campaign only when the health sum...` | `npx vitest run test/playcanvas_slice.test.js -t "health sum of all structures"` | `npm run test:full` | Passed |
| Building damage and active attacks are readable | Enabled effects could be occluded; minimap had only generic footprints and leaked marker stroke width into the village ring | `minimap_renderer`: damaged footprints, shape-coded attack/destroyed marks, and stroke isolation; browser smoke asserts real damage, HUD label, world ring/bar/beacon, critical effects, rubble swap, and telemetry | `npx vitest run test/minimap_renderer.test.js -t "structure footprints|attack ring" && PLAYCANVAS_SMOKE_PORT=5198 npm run smoke:playcanvas` | `npm run test:full` | Passed |
| Mobile alert must not overlap core HUD | The new alert initially collided with the toast and left too much guidance copy in portrait layout | Browser smoke measures alert bounds against toast, guidance, meta HUD, and minimap at 390x760, then asserts guidance copy compaction | `PLAYCANVAS_SMOKE_PORT=5198 npm run smoke:playcanvas` | `npm run test:full` | Passed |
| Collapsed structures must stop blocking players | Visual rubble alone would leave invisible intact-wall collision | `playcanvas_slice`: `removes invisible wall collision after a structure collapses` | `npx vitest run test/playcanvas_slice.test.js -t "removes invisible wall collision"` | `npm run test:full` | Passed |
| Upgrade must rebuild structural damage | Capacity-only upgrades could preserve a destroyed building at zero HP | `playcanvas_slice`: `upgrades town defenses, raises capacity, and rebuilds destroyed structures` | `npx vitest run test/playcanvas_slice.test.js -t "rebuilds destroyed structures"` | `npm run test:full` | Passed |

## Browser Evidence

- Baseline: `output/village-defense/baseline.png`
- Final refinement baseline: `output/village-defense/make-it-better-baseline.png`
- Real attack with HUD/world/minimap warning: `output/village-defense/under-attack.png`
- Critical damage with short red bar, structural breakage, fire, and smoke:
  `output/village-defense/critical-building.png`
- Destroyed building replaced by rubble and crossed out on the minimap:
  `output/village-defense/destroyed-building.png`
- Portrait alert layout: `output/village-defense/mobile-alert.png`

## Release Notes Draft

### Every Building Matters

The village is now a real collection of structures instead of one abstract health bar.
Zombies choose the nearest surviving building, find a valid gate, and keep attacking until
that structure collapses. Damage carries from wave to wave, forcing defenders to read the
map, triage competing attacks, and decide where their time matters most.

Buildings now show escalating physical damage before collapsing into rubble. A named HUD
warning, world health marker, and minimap alert identify the active pressure point without
removing the need to move through the village. Early-wave damage has been retuned so the
system creates sustained pressure rather than a 30-second loss.

### Player-Facing Highlights

- Seven buildings with independent, persistent health.
- Nearest-building zombie targeting and automatic retargeting after collapse.
- Cracks, scorch, broken beams, fire, smoke, and rubble damage stages.
- World, HUD, and minimap attack indicators.
- Village integrity derived directly from surviving structures.
- Town Defenses now performs a real rebuild as well as a capacity upgrade.

## Suggested Social Copy

**Short:** Every building matters now. Zombies attack the nearest structure, damage carries
between waves, and the village visibly cracks, burns, and collapses if you cannot get there
in time. Persistent Village Defense is locally complete in Zombie Invasion.

**Creator-focused:** Zombie Invasion's village is no longer one health value. Seven structures
own the damage, enemies route to the nearest live target, and every collapse changes the next
decision. The result is a defense loop built around triage instead of camping one choke point.

Do not publish either draft as a live-release claim until deployment is explicitly requested
and the deployed build passes its own smoke run.

## Marketing Assets

- Package: `output/marketing-assets/2026-07-13-persistent-village-defense/`
- Manifest: `output/marketing-assets/2026-07-13-persistent-village-defense/asset-manifest.json`
- Survival-player landscape asset: reused verified `critical-building.png` capture.
- Action-creator landscape asset: reused verified `destroyed-building.png` capture.
- Status: both rows `reused`; local gameplay proof only.
- Backlog: branded composites wait for an approved Zombie Invasion wordmark/brand kit.

## Rollout Review

- Database migrations: not needed.
- Schema, seed, or backfill work: not needed.
- Environment variables: not needed.
- Provider, billing, webhook, queue, or job setup: not needed.
- API/auth/permissions/RLS changes: none.
- Breaking-change review: the save schema adds an optional sanitized structure-health array;
  existing saves construct healthy defaults without a data migration, while new saves restore
  health ratios against current capacity.
- Deployment: not executed. No dev, hosted, or production claim is made.

## Finish-Line Sequence Status

| Step | Status | Evidence |
|---|---|---|
| 1. Verify feature is complete | Completed | Code/diff review and acceptance table |
| 2. Focused QA/regression checks | Completed | 130 focused tests, build, browser smoke |
| 3. Confirm acceptance criteria | Completed | All eleven criteria mapped above |
| 4. Update documentation/changelog | Completed | Current state, architecture, docs index, progress log, this packet |
| 5. Generate release notes | Completed | Draft in this packet; unpublished |
| 6. Generate suggested social copy | Completed | Two local-status-safe drafts above |
| 7. Generate marketing assets | Completed | Two verified gameplay captures reused |
| 8. Bundle assets for review | Completed | Local marketing package and manifest |
| 9. Mark ready for release | Completed locally | Merge/deploy and hosted verification remain separate approvals |

## Remaining Risk

- The repository-wide `npm run test:full` gate was not run during finish-line by design.
  A later full-suite run must execute every ledger row through `npm test` and
  `smoke:playcanvas` before deployment.
- Hosted behavior is unverified because no deployment was requested.
