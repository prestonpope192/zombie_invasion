# Zombie Invasion Quality Pass Finish Line

Date: 2026-08-19  
Repository: `/Users/preston/Code/zombie_invasion`  
Branch: `codex/dev-consolidation-20260707`

## Scope

This finish line covers five coordinated improvements:

1. Canonical verification commands.
2. Collision-safe PlayCanvas smoke ports.
3. Automated source and production-package validation.
4. Primary PlayCanvas versus legacy reference-runtime contract.
5. Reduced cold-start requests and production package size.

## Finish-line coverage ledger

| Behavior / issue | Failure mode | Direct test | Broader command | Status |
|---|---|---|---|---|
| Canonical verification | Separate commands had no single finish-line path | `scripts/validate-project.mjs` — `validateSourceContracts`; `npm run validate` | `npm run verify` | PASS |
| Smoke port collision | Fixed port could be occupied by another local Vite process | `test/smoke_port.test.js` — `uses the preferred port`; `falls back when the preferred port is already occupied` | `npm run verify` | PASS |
| Automated project validation | Route, script, asset, and packaging assumptions could drift silently | `scripts/validate-project.mjs` — `validateSourceContracts`, `validateDist` | `npm run verify` | PASS |
| Runtime direction | Two runtimes could cause new work to target the historical route | `test/active_game_contract.test.js` — `keeps the PlayCanvas route primary and the legacy route reference-only` | `npm run verify` | PASS |
| Music cold start | Newly-created music cues used full auto preload | `test/fps_game_audio.test.js` — `uses metadata-only music preload so cold start does not fetch every cue` | `npm run verify` | PASS |
| Secondary model cold start | Animal GLBs were requested before animal gameplay | `scripts/smoke-playcanvas-slice.mjs` — wave-1 animal request assertion | `npm run verify` | PASS |
| Reference assets in package | Reference-only soundtrack renders inflated `dist` | `scripts/validate-project.mjs` — `reference-only asset leaked into dist` | `npm run verify` | PASS |
| Legacy route browser readiness | Source contract alone did not prove the reference route mounted cleanly | `scripts/smoke-legacy-route.mjs` — menu, canvas, Start Mission, and browser-error assertions | `npm run test:legacy` | PASS |

Focused deterministic run:

```text
npx vitest run test/active_game_contract.test.js test/smoke_port.test.js test/fps_game_audio.test.js
3 files passed, 10 tests passed
```

The repository-wide `npm run verify` had already passed during the preceding
implementation run. This finish-line pass intentionally reran only the
affected focused tests, build, package validation, PlayCanvas smoke, and the
new legacy browser smoke.

## QA/QC catalog records

The repository has no central QA catalog or database writer. Five import-ready
local specifications were created under `/Users/preston/Code/zombie_invasion/output/qa/`:

| Disposition | check_id | coverage_key | Local record | Sync |
|---|---|---|---|---|
| created | `ZI-QA-001` | `zombie-invasion:canonical-verification-pipeline` | `output/qa/zombie-invasion-canonical-verification-qaqc-record.json` | local only |
| created | `ZI-QA-002` | `zombie-invasion:smoke-port-collision-recovery` | `output/qa/zombie-invasion-smoke-port-qaqc-record.json` | local only |
| created | `ZI-QA-003` | `zombie-invasion:project-contract-validation` | `output/qa/zombie-invasion-project-validation-qaqc-record.json` | local only |
| created | `ZI-QA-004` | `zombie-invasion:primary-playcanvas-legacy-reference-contract` | `output/qa/zombie-invasion-runtime-contract-qaqc-record.json` | local only |
| created | `ZI-QA-005` | `zombie-invasion:cold-start-loading-budget` | `output/qa/zombie-invasion-cold-start-loading-qaqc-record.json` | local only |

Validation: all five JSON records parsed successfully, required fields were
present, and `check_id`/`coverage_key` values were unique.

## Verification and truth matrix

| Truth surface | Status | Evidence |
|---|---|---|
| Local source/tests | proved | 3 focused files, 10 tests passed |
| Local production build | proved | `npm run test:build` passed |
| Local production package | proved | `npm run validate:dist` passed; reference-only assets absent |
| Local PlayCanvas browser flow | proved | `npm run test:smoke` passed; wave-1 state and screenshot captured |
| Local legacy browser flow | proved | `npm run test:legacy` passed; menu, canvas, Start Mission, and browser-error checks passed |
| Committed/merged branch | not requested | No commit created |
| Hosted environment | not run | No deployment or hosted target was requested |
| Provider/shared database | not applicable | No provider or database change in scope |
| Production/customer-visible | not proved | No deployment or public release performed |

## Finish-line sequence

| Step | Status | Evidence |
|---|---|---|
| Verify feature is complete | completed | Five implementation choices and final diff reviewed |
| Focused QA/regression checks | completed | Focused tests, build, package validation, smoke |
| Confirm acceptance criteria | completed locally | Each proposal mapped to a passing check |
| Required migrations/data setup | not applicable | No database or data behavior changed |
| QA/QC catalog records | completed | Five local JSON specifications |
| Documentation/changelog | completed | README, docs index, architecture, current-state, runtime contract |
| Release notes | not applicable | Internal quality/tooling pass; no release requested |
| Social copy | not applicable | No customer release requested |
| Marketing assets | not applicable | Internal quality/tooling pass |
| Bundle handoff | completed | This report and output checkpoint |
| Release readiness | incomplete | Local-ready only; no hosted or production proof |

## Rollout and remaining risk

No migrations, environment changes, provider setup, billing, webhooks,
queues/jobs, seeds, backfills, deploys, or external communications were needed
or performed. The existing Vite large-chunk warning remains; this pass reduces
avoidable package and cold-start work without risky bundle surgery. The legacy
route now has both source-contract and local browser-smoke coverage. The smoke
ignores only the expected metadata-audio `net::ERR_ABORTED` cancellation; other
browser errors remain failures.
