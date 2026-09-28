# Batch Manifest: zi-boot-storage-fixes

## Batch

- Batch ID: `zi-boot-storage-fixes`
- Scope: Fix the reviewed boot-recovery dismissal race and report unavailable browser storage before initial play.
- Exclusions: Rewarded ads, monetization, ad providers, new game systems, legacy gameplay changes, unrelated dirty PlayCanvas improvements.
- Repository: `/Users/preston/Code/zombie_invasion`
- Worktree: `/Users/preston/.codex/worktrees/zi-boot-storage-fix/zombie_invasion`
- Branch: `codex/zi-boot-storage-fixes-20260928`
- Base/integration candidate: `origin/codex/dev-consolidation-20260707` at `9b06a797626234817da4ef126b08cc457f5c5bf0` (freshly fetched 2026-09-28; same as local HEAD)
- Starting tree: Exact tracked and untracked working-tree snapshot from the calling checkout was copied for dependency fidelity. Existing unrelated changes remain uncommitted and out of scope.
- Deployment authority: `$build-it` invocation, deployment target unresolved pending live Vercel topology. Static Vite app, no backend/database detected.
- Overlap: Older visual-showcase worktree has disjoint dirty UI/gameplay edits in shared files; preserved without import or modification.

## Items and acceptance

### BR-01 - Persistent boot recovery

- Make the boot failure overlay terminal against pointer/key dismissal, the safety timeout, a pending delayed `is-gone` transition, and the PlayCanvas first-frame hide signal.
- Preserve ordinary loading-overlay dismissal and Retry behavior.
- Tests cover each dismissal path and the pending-transition race.

### BR-02 - Initial session-only storage status

- Probe browser storage safely before the initial playable HUD render.
- Missing or throwing storage and failed read/write probe produce the existing `SESSION ONLY` state immediately, while the game remains playable in memory.
- Healthy storage leaves the warning hidden; probing does not touch the game-save value or leave a probe key.
- Preserve later write-failure warning behavior.

## Validation and proof boundaries

- Isolated: focused BR-01/BR-02 tests, relevant legacy dismissal regression, then `npm run verify`.
- Integrated local: same assertions on the actual integrated checkout and Vite runtime, including initial session-only UI and boot recovery persistence.
- Hosted: pending target resolution; test exact deployed revision and runtime behavior after authorized target rollout.
- Visual proof: capture recovery and initial session-only states from the deployed revision if a matching browser/test route is available.

## Commits and evidence

- Manifest/ledger commit: `71eb25031f22e407fefeef9cb38c545d6befd8ac`.
- BR-01 commit: pending.
- BR-02 commit: pending.
- Focused and broad validation: pending.
- Closeout integration SHA: pending.
- Deferred: unrelated dirty candidate work remains preserved and uncommitted.
