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
- Deployment authority: `$build-it` invocation and its sole-registered-environment rule resolve this run to logical `production`; verified Vercel team `team_sw7Nix2eZZaMWjwT20q6rWlW`, project `prj_iRhw2dYqI4JyLDH9GQ9fEdMpN1yf`, release branch `main`, stable URL `https://zombie-invasion-alpha.vercel.app`. No Vercel/GitHub writes until all local gates and the final provider identity gate pass.
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
- Hosted: target resolved to the sole registered Production environment; deployment and exact-revision feature proof remain pending their later build-it gates.
- Visual proof: capture recovery and initial session-only states from the deployed revision if a matching browser/test route is available.

## Commits and evidence

- Manifest/ledger commit: `71eb25031f22e407fefeef9cb38c545d6befd8ac`.
- BR-01 commits: `f323674d18229283600dd4f8de0334c6cb82045b` and review repair `7ad4f65f1ba3ff313c4beb4289ecb1187ac0de93`.
- BR-02 commit: pending.
- BR-01 focused tests: 8 unit tests and real-browser Retry hit-test/navigation passed. Current-state Astra review passed at `7ad4f65f1ba3ff313c4beb4289ecb1187ac0de93` (scoped patch SHA-256 `d1a2135e21d01841c2e1d8ba80f7c4f7355581105aa97a4702e0ce56b1a25d27`).
- BR-02 focused tests: 7 unit tests and browser startup proof passed; current-state Astra review passed on candidate `e2909df025423e4c87eba90ac3d197429d90c009` plus scoped delta SHA-256 `3c78c1ffe2ab20a86e2fd9a3d56d17bc22f7f523dc9dcbc67ee1ce0e9275ff16`. Candidate commit deferred until changes are represented without the baseline's unrelated large file diffs.
- Isolated candidate verification: `npm run verify` passed at `f308a23e3ff022cc1b0a0ee6750808661969e198` plus the scoped BR-02 delta: project validation; 45 test files / 307 tests; Vite production build; dist contract; PlayCanvas smoke. Smoke reported `persistence=saved`, `phase=running`, `perfFpsAvg=31.6`; screenshot `output/playcanvas-slice-smoke.png`.
- Broad validation: passed for the dirty candidate; clean release-baseline validation remains pending.
- Closeout integration SHA: pending.
- Deferred: unrelated dirty candidate work remains preserved and uncommitted.
