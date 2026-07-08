# Documentation

This repository now uses a small canonical docs spine so a future agent can pick
it up without re-reading long session logs.

## Start Here

- [Project Overview](./project-overview.md): what the project is, who it is for,
  and which runtime is currently primary.
- [Current State](./current-state.md): what is implemented, what is verified,
  and what is still uncertain or in progress.
- [Architecture](./architecture.md): how the app is split across PlayCanvas,
  legacy Three.js FPS code, configs, tests, and deployment files.
- [Continuation Guide](./continuation-guide.md): safe next steps, operating
  constraints, and verification commands for future work.
- [Suno Soundtrack Prompt Plan](./suno-soundtrack-prompt-plan.md): paste-ready
  generated-music prompts for the Zombie Invasion soundtrack direction.

## Existing Deep-Dive Docs

- [Art Direction](./art/cinematic-low-poly-survival.md): target visual language
  for the PlayCanvas route.
- [`/playtest_pr_proposals.md`](/Users/preston/Code/zombie_invasion/playtest_pr_proposals.md):
  focused UX findings and candidate improvement threads from a local playtest.
- [`/progress.md`](/Users/preston/Code/zombie_invasion/progress.md): append-only
  implementation and validation log. Useful as evidence, not as the canonical
  current-state summary.

## Source Of Truth Rules

- Treat the repo as the source of truth only where code, config, tests, or
  logged validation support the claim.
- Distinguish between:
  - implemented in code
  - locally verified
  - hosted or production-verified
  - planned but not yet proven
- Prefer these docs for orientation and `progress.md` for historical evidence.
