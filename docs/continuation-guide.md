# Continuation Guide

## Safe Working Assumptions

- The PlayCanvas route is the current default experience.
- The older Three.js FPS route remains important because it still appears to be
  the deeper gameplay implementation reference.
- `progress.md` is evidence-rich but should not be edited as if it were the
  concise project handbook.

## Before You Change Gameplay Or Positioning

Check which runtime you are actually modifying:

- default PlayCanvas route
- `?legacy=1` Three.js FPS route
- both

This matters because the repository currently contains both a forward-looking
presentation track and an older implementation track.

## Verification Discipline

For non-trivial changes, rerun the commands that match the surface you touched:

```bash
npm test
npm run build
npm run smoke:playcanvas
npm run test:legacy
```

Use these when relevant:

```bash
npm run preview
docker compose up --build -d
```

If you claim hosted behavior, collect hosted proof separately. The repo itself
already records at least one case where a Vercel preview existed but public
browser smoke was blocked by authentication.

## Documentation Maintenance Rules

- Update `README.md` when entrypoints, setup, or top-level status changes.
- Update [Current State](./current-state.md) when the primary runtime, proof
  status, or known uncertainty changes.
- Update [Architecture](./architecture.md) when the route split or source-tree
  responsibilities change.
- Keep detailed historical logs in `progress.md` rather than expanding the
  canonical docs with session-by-session noise.

## Suggested Near-Term Documentation Follow-Through

- If PlayCanvas reaches practical parity, update the docs to say so explicitly
  and cite the proof.
- If the Three.js FPS route becomes deprecated rather than a reference runtime,
  document the deprecation path clearly.
- If hosted deployments become part of the normal workflow, add a short deploy
  runbook with real verification evidence rather than relying on scattered log
  notes.
