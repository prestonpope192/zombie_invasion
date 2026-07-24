# 2026-07-08 Production Deploy

## Run Metadata

- Environment: `production`
- Repo: `/Users/preston/Code/zombie_invasion`
- Branch: `codex/dev-consolidation-20260707`
- Commit deployed: `ba8978dcb923bd220e628f649e4b3e34dc73c389`
- Vercel project: `preston-popes-projects/zombie-invasion`
- Deployment ID: `dpl_2xG8dtRpfTir4WL7kvTkUnEoEZZc`
- Immutable deployment URL: `https://zombie-invasion-6mghi0w8z-preston-popes-projects.vercel.app`
- Production aliases:
  - `https://zombie-invasion-alpha.vercel.app`
  - `https://zombie-invasion-preston-popes-projects.vercel.app`
  - `https://zombie-invasion-preston-5193-preston-popes-projects.vercel.app`
  - `https://by-sgs.com`
- Log directory: `/tmp/zombie-deploy-20260708T155243Z`

## Deploy Commands

| Command | Result | Notes |
|---|---|---|
| `vercel deploy --prod --yes` | FAIL | Remote Vercel build failed during `npm ci` with `npm error Invalid Version:`. |
| `vercel build --prod` | PASS | Local Vercel production build completed into `.vercel/output`. |
| `vercel deploy --prebuilt --prod --yes` | PASS | Deployed the verified prebuilt artifact to production. |

The remote-build failure was isolated to Vercel's remote `npm ci` path. Local
`npm ci --dry-run`, lockfile semver checks, and `vercel build --prod` passed.

## Verification

| Check | Result | Evidence |
|---|---|---|
| `vercel inspect <deployment> --wait --timeout 90s` | PASS | Deployment status `Ready`; target `production`. |
| Immutable deployment root | PASS | HTTP 200 from `https://zombie-invasion-6mghi0w8z-preston-popes-projects.vercel.app/`. |
| Immutable deployment `/playcanvas` | PASS | HTTP 200 from `/playcanvas`. |
| Production alias root | PASS | HTTP 200 from `https://zombie-invasion-alpha.vercel.app/`. |
| Production alias `/playcanvas` | PASS | HTTP 200 from `https://zombie-invasion-alpha.vercel.app/playcanvas`. |
| Deployed PlayCanvas smoke | PASS | `PLAYCANVAS_SMOKE_URL=https://zombie-invasion-6mghi0w8z-preston-popes-projects.vercel.app/ npm run smoke:playcanvas`; screenshot `output/playcanvas-deployed-smoke.png`. |
| Production alias PlayCanvas smoke | PASS | `PLAYCANVAS_SMOKE_URL=https://zombie-invasion-alpha.vercel.app/ npm run smoke:playcanvas`; screenshot `output/playcanvas-alpha-smoke.png`. |
| Generated soundtrack asset heads | PASS | Runtime and reference MP3 files returned HTTP 200 `audio/mpeg`. |
| Vercel production error log scan | PASS | `vercel logs --environment production --level error --since 1h --no-follow --limit 100` returned no logs for the current branch. |

## Notes

- `https://by-sgs.com` was aliased by Vercel, but TLS was still provisioning at
  verification time and returned `tlsv1 unrecognized name` from `curl`.
- The smoke harness now ignores benign Chromium `net::ERR_ABORTED` failures for
  `/audio/music/*.mp3` requests. Hosted audio files were separately verified as
  valid `audio/mpeg` responses; the aborted request happens when the game swaps
  audio elements during cue transitions.
- No production data, auth, billing, or external mutable app state was involved.
