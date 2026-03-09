# Security Best Practices Report

Date: 2026-03-09
Repository: `/Users/preston/Code/zombie_invasion`

## Executive Summary
The repo is primarily a static frontend game (Vite + Three.js) with no backend auth/session surface. I found one known vulnerable dependency in the build toolchain, one deployment hardening gap (missing browser security headers/CSP), and several latent DOM XSS risks where unescaped values are interpolated into `innerHTML`.

## High Severity

### SEC-001: Vulnerable `rollup` version in lockfile (GHSA-mw96-cpmx-2vgc)
- Severity: High
- Location:
  - `package-lock.json:1719` (`node_modules/rollup`)
  - `package-lock.json:1720` (`"version": "4.58.0"`)
  - `package-lock.json:1951`-`package-lock.json:1963` (Vite depends on Rollup)
- Evidence:
  - `npm audit --json` reports: `Rollup 4 has Arbitrary File Write via Path Traversal` with affected range `>=4.0.0 <4.59.0`.
- Impact:
  - If exploited in build/CI contexts, this can lead to arbitrary file write during tooling execution.
- Fix:
  - Update lockfile to `rollup >= 4.59.0` (current npm latest is 4.59.0).
  - Run: `npm update rollup` (or regenerate lockfile with a clean install) and re-run `npm audit`.
- Mitigation:
  - Treat build pipelines as sensitive; avoid running builds on untrusted repositories/inputs until patched.
- False positive notes:
  - This is a dev/build-time issue, not a direct runtime browser exploit in shipped static assets.

## Medium Severity

### SEC-002: Missing security headers and CSP in deployment config
- Severity: Medium
- Location:
  - `nginx.conf:8`-`nginx.conf:40` (only cache headers configured)
  - `vercel.json:12`-`vercel.json:44` (only cache/content-type headers configured)
  - `index.html:3`-`index.html:9` and `index.html:1694` (no CSP meta/header defined in app)
- Evidence:
  - No `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, or frame protections (`X-Frame-Options` / CSP `frame-ancestors`) in checked deployment files.
- Impact:
  - Increases blast radius of any future XSS bug and leaves app open to framing/clickjacking.
- Fix:
  - Add baseline headers in Nginx/Vercel:
    - `Content-Security-Policy` (start strict, allow only required sources)
    - `X-Content-Type-Options: nosniff`
    - `Referrer-Policy: strict-origin-when-cross-origin` (or stricter)
    - `Permissions-Policy` (disable unused APIs)
    - `X-Frame-Options: DENY` or CSP `frame-ancestors 'none'`
- Mitigation:
  - If full CSP rollout is risky, deploy report-only CSP first, then enforce.
- False positive notes:
  - Headers may be set at CDN/edge outside this repo; verify production responses.

### SEC-003: Dynamic string interpolation into `innerHTML` (latent DOM XSS sink)
- Severity: Medium
- Location:
  - `src/fps/scenes/ShopScene3D.js:314`-`src/fps/scenes/ShopScene3D.js:433`
  - `src/fps/scenes/SummaryScene3D.js:11`-`src/fps/scenes/SummaryScene3D.js:16`
  - `src/fps/scenes/GameOverScene3D.js:11`-`src/fps/scenes/GameOverScene3D.js:15`
  - Data origins loaded from local config in `src/fps/app/FpsGame.js:31`-`src/fps/app/FpsGame.js:38`
- Evidence:
  - Templates inject values like `${weapon.label}`, `${pack.label}`, `${armor.style}`, `${summary.kills}`, `${payload.reason}` directly into `innerHTML`.
- Impact:
  - Currently values appear repo-controlled, but if any of these inputs become user/API/mod-controlled, this becomes exploitable DOM XSS.
- Fix:
  - Prefer DOM node construction with `textContent` for dynamic values.
  - Keep `innerHTML` only for static markup or sanitize dynamic HTML with a proven sanitizer.
- Mitigation:
  - Strong CSP reduces exploitability if an unsafe sink remains.
- False positive notes:
  - With strictly static, trusted config and code-only payload creation, immediate exploitability is limited.

## Low Severity

### SEC-004: Third-party font import increases supply-chain/privacy surface
- Severity: Low
- Location:
  - `index.html:8`
- Evidence:
  - CSS `@import` pulls fonts from `https://fonts.googleapis.com`.
- Impact:
  - Adds external dependency for rendering path and leaks client requests to third-party service.
- Fix:
  - Self-host fonts in `dist/assets` and tighten CSP `font-src/style-src` accordingly.
- Mitigation:
  - At minimum, explicitly allowlist only required font/style origins in CSP.
- False positive notes:
  - Common in many apps; this is hardening rather than a direct exploit path.

### SEC-005: Dev/preview server bound to all interfaces (`0.0.0.0`)
- Severity: Low
- Location:
  - `vite.config.js:4`-`vite.config.js:10`
- Evidence:
  - Both `server.host` and `preview.host` are `0.0.0.0`.
- Impact:
  - Local development instance may be reachable by other devices on the network if firewalling is weak.
- Fix:
  - Default to `127.0.0.1` and only use `0.0.0.0` when explicitly needed.
- Mitigation:
  - Restrict trusted networks and keep dev server usage short-lived.
- False positive notes:
  - This is often intentional for mobile device testing.

## Validation Commands Run
- `npm audit --omit=dev --json` (0 production vulns)
- `npm audit --json` (1 high vulnerability: `rollup`)

