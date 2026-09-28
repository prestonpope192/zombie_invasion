# Execution Ledger: zi-boot-storage-fixes

- Current phase: prepare
- Scope: BR-01 persistent boot recovery; BR-02 startup `SESSION ONLY` warning. Ads/monetization excluded.
- Repository: `/Users/preston/Code/zombie_invasion`
- Worktree/branch: `/Users/preston/.codex/worktrees/zi-boot-storage-fix/zombie_invasion`, `codex/zi-boot-storage-fixes-20260928`
- Base: `origin/codex/dev-consolidation-20260707` / `9b06a797626234817da4ef126b08cc457f5c5bf0`, fetched 2026-09-28.
- Baseline state: primary checkout contains 16 modified tracked files and 5 untracked candidate files; exact snapshot copied into this worktree. Original checkout unchanged. Current dirty baseline SHA-256 evidence: pending.
- Integration target: local Dev-equivalent branch `codex/dev-consolidation-20260707`; no remote `dev` ref. Reconcile through local collapse only after isolated review and tests.
- Deployment target: unresolved. `.vercel/project.json` links project `zombie-invasion`; static Vite route, no database/API. Verify current Vercel registered environments, deployment identities, aliases, and access before choosing the build-it target rule.
- Authority: current user `$build-it` invocation authorizes accepted scope through deployment target rule; no customer data or shared backend mutations are involved.
- Overlap: existing `codex/bulk-zombie-visual-showcase-20260830` worktree has dirty, disjoint gameplay/UI changes in shared PlayCanvas modules/tests and a running local server. Preserve; do not import or edit. No active competing writer was evidenced by its completed manifest, but hosted/local state must be rechecked before collapse.

## Worker and gate record

- BR-01 plan: agent `01a0e874-e97e-77e1-a0b8-e43b8463caed` (Pascal), requested `gpt-6-luna/high`, routine localized route; plan accepted subject to current candidate checks.
- BR-02 plan: agent `01a0e876-0967-78a2-bfcd-7ffb96173343` (Faraday), requested `gpt-6-luna/high`, routine storage-state/UI change; plan accepted with safe probe using existing runtime storage wrapper.
- BR-01 implementer: pending.
- BR-01 reviewer: fresh Astra pending.
- BR-02 implementer: pending.
- BR-02 reviewer: fresh Astra pending.

## Acceptance and phase status

- BR-01: pending; proof requires focused event/key/timeout/pending-transition/first-frame tests plus ordinary loading dismissal regression.
- BR-02: pending; proof requires initial UI/state checks for missing, throwing, read/write probe failure and healthy storage, no save-key mutation or probe-key residue, plus playable in-memory state.
- Prepare: running; isolated worktree created and candidate snapshot copied. Need manifest commit, dependency/runtime setup, and exact Vercel target map.
- Isolated test: scheduled after implementation/review; `npm run verify` is required.
- Polish: pending; assess cross-item interaction after both reviews.
- Worktree test: pending.
- Prep-collapse/collapse: pending; preserve unrelated primary checkout modifications.
- Integrated local: pending; Vite, static app with browser-local state.
- Deploy: pending exact target registry proof.
- Deployed test: pending deployment; feature-specific UI/runtime checks on exact revision.
- Hot-fix: pending; not applicable only if deployed proof passes.
- Show proof: pending final deployed-state evidence.

## Commands, evidence, decisions

- Fresh fetch: `git fetch origin` passed; remote candidate branch equals current local HEAD.
- Baseline source evidence: existing `src/runtime/bootRecovery.js`, `safeStorage.js`, and tests are present only in the copied dirty snapshot at prepare start.
- Deployment topology: pending inspection through the registered Vercel project and current deployment metadata; never infer production from repo linking alone.
- Local / hosted results: none yet.
- Next action: snapshot-check the isolated dirty baseline, commit manifest/ledger without staging candidate files, resolve Vercel environment topology read-only, then enter sequential build workers.
