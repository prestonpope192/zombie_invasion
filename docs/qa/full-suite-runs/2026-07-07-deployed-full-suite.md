# Deployed Full-Suite Run — 2026-07-07

## Scope

- Environment: deployed production alias
- Target URL: `https://zombie-invasion-alpha.vercel.app/`
- Vercel deployment: `dpl_BwA9YxRFaHTWzdpZHEjfGsftkBhP`
- Deployment URL: `https://zombie-invasion-jmna1kfxa-preston-popes-projects.vercel.app`
- Deployment status: Ready
- Deployment created: 2026-07-05 17:30 CDT
- Local branch: `codex/dev-consolidation-20260707`
- Local commit: `4a3ba96`
- Log directory: `/tmp/zombie-full-suite-20260707T150926Z`

## Suite Inventory

| Check | Status | Evidence |
|---|---|---|
| `npm test` | PASS | 37 files, 201 tests passed |
| `npm run build` | PASS | Build passed with existing large-chunk warning |
| Deployed HTTP root | PASS | `https://zombie-invasion-alpha.vercel.app/` returned HTTP 200 |
| Deployed `/playcanvas` route | PASS | `https://zombie-invasion-alpha.vercel.app/playcanvas` returned HTTP 200 |
| Deployed PlayCanvas browser smoke | FAIL | `PLAYCANVAS_SMOKE_URL=https://zombie-invasion-alpha.vercel.app/ npm run smoke:playcanvas` timed out waiting for `reward_granted` |
| Authenticated coverage | N/A | This game has no authenticated app surface |

## Deployed Diagnostic

- The deployed page loads and starts the campaign.
- `render_game_to_text()` reports `mode=playcanvas-game`, `phase=ready`, then `phase=running` after clicking Start Campaign.
- Deployed script asset: `assets/main-CVBqkTOa.js`.
- The local consolidation build emits `assets/main-CAoBLJnL.js`, so the deployed version is behind the local branch.
- The deployed text hook does not include newer local fields such as `rewardedTelemetry`, `perfFpsAvg`, or `tracerDropVisual`.

## Finish-Line Ledger Verification

| Ledger Item | Local Deterministic Result | Deployed Result |
|---|---|---|
| PlayCanvas ballistic metadata for hits/misses/blasts/structure impacts | PASS via `test/playcanvas_slice.test.js` | BLOCKED/NOT DEPLOYED: production bundle predates these assertions |
| PlayCanvas browser text hook exposes `combatEvent.ballistic` | FAIL on deployed current smoke | Production bundle predates current smoke expectations |
| PlayCanvas tracer sag exposes positive `tracerDropVisual` | PASS locally via `test/shot_fx_rules.test.js` and local smoke | BLOCKED/NOT DEPLOYED: production text hook does not expose `tracerDropVisual` |
| Full local gate `test:full` | PASS locally in prior consolidation run | Not a deployed-environment check by itself |

## Result

Full suite on the deployed version is **not green**.

The deployed app is reachable and starts gameplay, but it is not running the current consolidated branch. The current full smoke suite expects rewarded telemetry and ballistic/tracer telemetry fields that are absent from the production deployment. A production or hosted preview deploy of `codex/dev-consolidation-20260707` would be required before rerunning the deployed full suite against the current code.

