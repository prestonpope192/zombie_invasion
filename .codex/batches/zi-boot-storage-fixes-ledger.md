# Execution Ledger: zi-boot-storage-fixes

- Current phase: build
- Scope: BR-01 persistent boot recovery; BR-02 startup `SESSION ONLY` warning. Ads/monetization excluded.
- Repository: `/Users/preston/Code/zombie_invasion`
- Worktree/branch: `/Users/preston/.codex/worktrees/zi-boot-storage-release/zombie_invasion`, `codex/zi-boot-storage-prod-20260928`
- Release base: verified `origin/main` / `32272385ad42e472d7d32c0031a28c1e3c2ddac3`, fetched 2026-09-28. The earlier dirty-candidate lane is preserved separately and is not a release source.
- Baseline state: primary checkout contains 16 modified tracked files and 5 untracked candidate files; exact snapshot copied into this worktree. Original checkout unchanged. Tracked dirty diff SHA-256 before implementation: `503bf071b406d7ee376daf01d354db6c9202e8c0a70f5dbbed6f77b52b62fb7b`. Runtime file SHA-256 at prepare: boot recovery `716aa3a328b3e61849652c6e5e59ae72bc835eb585435cf6d5609a516cc6eddf`; safe storage `bf09593a7f62df1ac10ebee4c56e59d056adffee15228ad4ede335f367987629`; lifecycle pause `a28c90504c9cca95bca89e2c7d540227a74c164815323c3ded04f06417bc7e3b`; recovery tests `63e8f66f8253147514e34dab9df0eaf6489593fc7e46b3eb12977654bd5a5396`.
- Integration target: local Dev-equivalent branch `codex/dev-consolidation-20260707`; no remote `dev` ref. Reconcile through local collapse only after isolated review and tests.
- Deployment target: exactly one logical environment is registered: `production`, Vercel scope `preston-popes-projects`, immutable team `team_sw7Nix2eZZaMWjwT20q6rWlW`, project `prj_iRhw2dYqI4JyLDH9GQ9fEdMpN1yf`, source branch `main`, stable URL `https://zombie-invasion-alpha.vercel.app`. The deploy resolver requires an explicit environment for bare deploy; the active `$build-it` target rule explicitly selects the sole registered environment. Vercel read-only identity verifier passed for the canonical repo path. No registered Dev environment; no API/database.
- Authority: user `$build-it` invocation authorizes accepted scope through its single-environment target rule, resolving to `production`; no customer data or shared backend mutations are involved. Repeat exact identity check immediately before any Vercel/Git write.
- Overlap: existing `codex/bulk-zombie-visual-showcase-20260830` worktree has dirty, disjoint gameplay/UI changes in shared PlayCanvas modules/tests and a running local server. Preserve; do not import or edit. No active competing writer was evidenced by its completed manifest, but hosted/local state must be rechecked before collapse.

## Worker and gate record

- BR-01 plan: agent `01a0e874-e97e-77e1-a0b8-e43b8463caed` (Pascal), requested `gpt-6-luna/high`, routine localized route; plan accepted subject to current candidate checks.
- BR-02 plan: agent `01a0e876-0967-78a2-bfcd-7ffb96173343` (Faraday), requested `gpt-6-luna/high`, routine storage-state/UI change; plan accepted with safe probe using existing runtime storage wrapper.
- BR-01 planner: `01a0e874-e97e-77e1-a0b8-e43b8463caed`, requested `gpt-6-luna/high`; returned localized timer/event lifecycle plan.
- BR-01 clean-release implementer: `01a0e8c5-0a37-77e2-8dda-b2a798c13397`, requested `gpt-6-luna/high`; commits `47a8db44165cd3a7485d1ffeafac17ee81c9e98c` and repair `3571f78100272c3d942b1b2dc90ffc6dc8b41279`.
- BR-01 clean-release reviewer: `01a0e8da-3374-7661-8d11-7ec7c78c92f8`, fresh `gpt-6-astra/low`; first verdict `changes requested` with P2 `boothold` regression and P3 pointer-listener leak; re-review passed current SHA `3571f78100272c3d942b1b2dc90ffc6dc8b41279`, full scoped diff SHA-256 `72dac99ec16775be7ba4788d1877335bc641484acf3d2d04ac08e36ad6a0eb27`.
- BR-02 planner: `01a0e8e1-6295-7081-ab50-89ec8c60d4d9`, `gpt-6-luna/high`, routine PlayCanvas storage/UI route. Plan traced constructor storage reads before initial HUD and identified save/load persistence handling, shared status UI, and direct haptics/onboarding/one-time flag reads.
- BR-02 implementer: same Luna/high planner `01a0e8e1-6295-7081-ab50-89ec8c60d4d9`; commits `d741b226ca27f8997aef2af2b8dc23314f578eb6` implementation, `2a9dbc6724012188958bc7698215a38441ba960e` QA spec format correction, `43bb88508feb2dff5e2afa1143b337d00e7ee97a` review repair.
- BR-02 reviewer: `01a0e903-5f94-77e0-bff7-b69241a7afe0`, fresh `gpt-6-astra/low`; initial `changes requested` for portrait toast overlap and smoke's missing real user flow/post-save assertions; re-review passed current SHA `43bb88508feb2dff5e2afa1143b337d00e7ee97a`, full scoped diff SHA-256 `e4a12de4e3ff5f685029132df830b56e7417a14fa639020db2583c2cf799ae90`.

## Acceptance and phase status

- BR-01: passed isolated code/test/review on the clean production baseline. Commits `47a8db44165cd3a7485d1ffeafac17ee81c9e98c` and review repair `3571f78100272c3d942b1b2dc90ffc6dc8b41279`; current-state Astra pass at repair SHA. Focused `npm test -- --run test/boot_lifecycle.test.js`: 9/9; `npm run smoke:boot-recovery`: desktop and touch Retry/reload flow passed; `npm run test:legacy` and `npm run build` passed (large-chunk advisory). Screenshots: `output/playwright/boot-recovery-desktop.png`, `output/playwright/boot-recovery-touch.png`, `output/playwright/legacy-route.png`. Reviewer noted browser smoke covers async import rejection; synchronous errors are covered at helper level.
- BR-02: passed isolated code/test/review on clean release baseline. Focused `npm test -- --run test/storage_status.test.js test/playcanvas_slice.test.js`: 2 files / 129 tests. `npm run smoke:storage-status`: all seven browser cases passed (healthy, missing, getter throws, probe read/write/readback failure, transient cleanup retry); each reached playable state, warning was correct before interaction, seeded save value remained unchanged, and no probe key remained. Real onboarding/menu/gameplay start, later save-write failure through `restartAndStart`, running state, mobile warning bounds, and toast/objective non-overlap are covered. `npm run smoke:boot-recovery`, `npm run test:legacy`, and `npm run build` passed (large-chunk advisory). Current Astra pass at `43bb88508feb2dff5e2afa1143b337d00e7ee97a`. QA spec `ZI-QA-BULK-010`, coverage `zombie-invasion:session-only-storage-startup`, at `output/qa/zombie-invasion-bulk-zi010-qaqc-record.json`.
- Prepare: passed; isolated worktree created on `codex/zi-boot-storage-fixes-20260928`, manifest/ledger commits `71eb25031f22e407fefeef9cb38c545d6befd8ac` and `02223073dd786eda0bec62cffcf75e12726ecd38`; dependency symlink uses existing root `node_modules` (Vite 7.3.5, Vitest 3.2.6; local runtime Node 26 although package expects Node 22); Vite `http://127.0.0.1:5192/` returned HTTP 200. Baseline focused `npm test -- --run test/runtime_recovery.test.js`: 1 file / 6 tests passed.
- Isolated candidate validation: `npm run verify` passed at `f308a23e3ff022cc1b0a0ee6750808661969e198` plus scoped BR-02 delta `3c78c1ffe2ab20a86e2fd9a3d56d17bc22f7f523dc9dcbc67ee1ce0e9275ff16`: project validation, 45 test files / 307 tests, production build, dist validation, PlayCanvas smoke. Smoke reported `persistence=saved`, running phase, `perfFpsAvg=31.6`; screenshot `output/playcanvas-slice-smoke.png`. This copied dirty candidate includes unrelated changes and is evidence only, not a release source. Its Vite PID `97535` was stopped.
- Polish: not applicable; BR-01 controls the boot recovery overlay after initialization failure, while BR-02 controls the normal playable HUD. The error surface replaces HUD/play state on failure, so the two behaviors do not share a visible layout or state transition.
- Release worktree: `/Users/preston/.codex/worktrees/zi-boot-storage-release/zombie_invasion`, branch `codex/zi-boot-storage-prod-20260928`, clean base `origin/main` at `32272385ad42e472d7d32c0031a28c1e3c2ddac3`; task-owned changes will be reconstructed here to exclude unrelated candidate work.
- QA spec BR-01: `ZI-QA-BULK-011`, coverage `zombie-invasion:boot-recovery-retry-persistence`, `output/qa/zombie-invasion-bulk-zi011-qaqc-record.json`; local specification only, no execution result encoded in record.
- Clean release-worktree validation: both items' focused/browser/legacy/build checks passed; full `npm run verify` pending.
- Prep-collapse/collapse: pending; preserve unrelated primary checkout modifications.
- Integrated local: pending; Vite, static app with browser-local state.
- Deploy: pending exact target registry proof.
- Deployed test: pending deployment; feature-specific UI/runtime checks on exact revision.
- Hot-fix: pending; not applicable only if deployed proof passes.
- Show proof: pending final deployed-state evidence.

## Commands, evidence, decisions

- Fresh fetch: `git fetch origin` passed; `origin/codex/dev-consolidation-20260707` equals base `9b06a797626234817da4ef126b08cc457f5c5bf0`; no remote `dev` branch.
- Target identity: `verify_vercel_target.py verify --client preston --app zombie-invasion --repo /Users/preston/Code/zombie_invasion --environment production` passed read-only. Resolver reported a single registered environment and sole-target rule handles production.
- Baseline source evidence: existing `src/runtime/bootRecovery.js`, `safeStorage.js`, and tests are present only in the copied dirty snapshot at prepare start.
- Deployment topology: pending inspection through the registered Vercel project and current deployment metadata; never infer production from repo linking alone.
- Candidate evidence: BR-01 `8` focused unit tests + browser Retry click/navigation; BR-02 `7` focused unit tests + initial HUD browser proof; candidate `npm run verify` passed. This does not yet prove the clean production-based release tree.
- Hosted results: none yet.
- Next action: implement and review BR-01 then BR-02 on the clean release worktree; run isolated `npm run verify`; continue only through the target's build-it release gates.
