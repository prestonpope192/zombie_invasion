# Batch Manifest: zombie-invasion-visual-showcase-uplift

## Batch

- Batch ID: `zombie-invasion-visual-showcase-uplift`
- Scope: Improve the active PlayCanvas route's visual presentation using a bounded hero-capture lane, modular environment assets, richer materials, lighting/value work, environmental dressing, enemy presentation, performance measurement, and a repeatable visual QA loop.
- Mode: local-only isolated editing lane
- Deployment: not authorized; none performed

## Repository and baseline

- Repository: `/Users/preston/Code/zombie_invasion`
- Worktree: `/Users/preston/.codex/worktrees/zombie-visual-showcase-20260830`
- Branch: `codex/bulk-zombie-visual-showcase-20260830`
- Baseline ref: `origin/main`
- Baseline SHA: `c34a95f5adad3691f8cc15968d28607898100c18`
- Baseline observed after fetch: 2026-08-30
- Starting tree: clean

## Planned items and acceptance criteria

### ZI-VIS-01 — Hero capture mode

Add a QA/showcase-only camera mode with a locked eye-level composition. Normal gameplay remains unchanged.

### ZI-VIS-02 — Modular environment kit

Replace the most visible primitive structures with reusable house, roof, fence, lantern, tree, and road modules while retaining safe primitive fallbacks.

### ZI-VIS-03 — Materials and surface detail

Add visible material variation to roofs, plaster, wood, road, stone, and mud; eliminate broad flat surfaces in the hero frame.

### ZI-VIS-04 — Lighting and value range

Establish cool moonlight, warm lantern pools, readable silhouettes, darker shadows, controlled fog, and restrained bloom across supported quality profiles.

### ZI-VIS-05 — Environmental dressing

Build foreground, midground, and background depth with props, rubble, vegetation, carts, pumpkins, signs, and lane details without obscuring enemies or the village objective.

### ZI-VIS-06 — Character and enemy presentation

Ensure at least two enemy silhouettes differ clearly by shape and movement and stage them legibly in the hero composition.

### ZI-VIS-07 — Performance budget

Measure the new scene on a fixed browser/GPU profile. Preserve or improve the current 26 FPS SwiftShader smoke baseline and establish a higher local-GPU target.

### ZI-VIS-08 — Visual QA loop

Add repeatable desktop/mobile screenshots, render-text capture, browser-error checks, and a visual rubric against the repository concept image.

## Exclusions

- New weapons, enemy types, economy, ads, save behavior, or campaign systems.
- Broad work on the legacy Three.js route.
- Deployment, hosted verification, production changes, or shared-database mutation.
- Rebuilding Zombie Invasion in Unity or another engine.
- Assets without confirmed licensing and source metadata.

## Touched areas and overlap zones

- Planned areas: `src/playcanvas/`, `public/models/`, visual smoke/test scripts, `docs/art/`, `docs/current-state.md`, `output/qa/`.
- Primary route: PlayCanvas default `/`.
- Reference route: legacy `/?legacy=1`; verify only if shared code or contracts are touched.
- Shared config/system overlap: avoid unless required; if touched, run both route checks.
- API/database/deployment overlap: none planned.
- Active writable overlap found during preflight: none in this repository's worktree/branch inventory.

## Validation plan

- Per item: focused source/unit tests, local PlayCanvas smoke, targeted screenshot/render-text evidence, and performance telemetry as applicable.
- Broad: `npm run verify`.
- Conditional: `npm run test:legacy` when shared code, routing, or contracts change.
- Visual evidence: fixed desktop 1280x800 and mobile 390x760 captures; no browser/page/request errors; nonblank output; readable enemy and objective silhouettes.
- Local runtime: start from this worktree with the repo-native Vite command on an open port; record the URL and effective targets.

## Commits

- Manifest commit: `52e7dde03c016df7e3b08da2eb5c46559d1c9304`
- ZI-VIS-01: `411cdff`
- ZI-VIS-02: `aee4290`
- ZI-VIS-03: `70c0c82`
- ZI-VIS-04: `51e1763`
- ZI-VIS-05: `35a10a4`
- ZI-VIS-06: `pending commit` (working tree; browser capture passed)
- ZI-VIS-07: pending
- ZI-VIS-08: pending

## Deferred work

- Any gameplay-system expansion.
- Legacy-route feature parity.
- Hosted/production proof.
- Final visual sign-off until Preston reviews the local result.

## Validation evidence

- `npm run verify`: passed from this worktree; project validation, 42 test files / 265 tests, production build, dist validation, and PlayCanvas smoke all passed.
- `PLAYCANVAS_SMOKE_URL=http://127.0.0.1:5191/ npm run smoke:playcanvas`: passed against this worktree; screenshot `output/playcanvas-slice-smoke.png` and render text captured.
- `curl -I http://127.0.0.1:5191/`: HTTP 200.
- ZI-VIS-01 browser evidence: `output/qa/zi-vis-01-webgame/shot-0.png` and `shot-1.png`; `state-0.json` / `state-1.json` reported the active PlayCanvas route and the capture run produced no `errors-*.json`.
- ZI-VIS-02 browser evidence: `output/qa/zi-vis-02-webgame/shot-0.png` and `state-0.json`; focused `test/playcanvas_slice.test.js` passed (118 tests) with no browser error artifact.
- ZI-VIS-03 browser evidence: `output/qa/zi-vis-03-webgame/shot-0.png` and `state-0.json`; focused `test/playcanvas_slice.test.js` passed (118 tests) with no browser error artifact.
- ZI-VIS-04 browser evidence: `output/qa/zi-vis-04-webgame/shot-0.png` and `shot-1.png`; `state-*.json` include `lightingProfile=cool-moon-warm-lantern`, with no browser error artifact.
- ZI-VIS-05 browser evidence: `output/qa/zi-vis-05-webgame/shot-0.png` and `shot-1.png`; the dressed lane is visible in the inspected capture and the run produced no browser error artifact.
- ZI-VIS-06 browser evidence: `output/qa/zi-vis-06-webgame/shot-0.png` and `shot-1.png`; inspected capture shows distinct runner/brute silhouettes and no browser error artifact.
- Smoke performance baseline: `perfFpsAvg=26.4`, `perfFrameMsAvg=37.9`, `perfWorstFrameMs=100.0` under the SwiftShader harness.
- Runtime dependency setup: ignored dependency symlink `node_modules -> /Users/preston/Code/zombie_invasion/node_modules`; no tracked source dependency changes.

## Runtime handoff

- Startup command: `/Users/preston/Code/zombie_invasion/node_modules/.bin/vite --host 127.0.0.1 --port 5191`
- Local URL: `http://127.0.0.1:5191/`
- Backend/API target: none; static Vite app with browser-local state.
- Server session: Codex terminal session `37062`, intentionally left running for local testing.

## Closeout

- Closeout integration SHA:
