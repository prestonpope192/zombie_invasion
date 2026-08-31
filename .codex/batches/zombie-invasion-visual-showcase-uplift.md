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

- Manifest commit: pending
- ZI-VIS-01: pending
- ZI-VIS-02: pending
- ZI-VIS-03: pending
- ZI-VIS-04: pending
- ZI-VIS-05: pending
- ZI-VIS-06: pending
- ZI-VIS-07: pending
- ZI-VIS-08: pending

## Deferred work

- Any gameplay-system expansion.
- Legacy-route feature parity.
- Hosted/production proof.
- Final visual sign-off until Preston reviews the local result.

## Closeout

- Closeout integration SHA:
