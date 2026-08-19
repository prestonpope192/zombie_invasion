# Runtime Contract

Zombie Invasion has one primary player-facing runtime and one preserved
reference runtime.

## Primary route: PlayCanvas

The default `/` route is the forward-looking product experience. New gameplay,
visual, mobile, performance, and onboarding decisions should target
`src/playcanvas` first. Local smoke coverage and current-state claims should
use this route unless a check is specifically about legacy parity.

## Reference route: legacy Three.js FPS

The older Three.js implementation is available at `/?legacy=1`. It remains
valuable because it contains the deeper historical gameplay surface and helps
catch regressions in shared systems. It is not the default product direction
and should not receive broad new feature work merely to keep the two runtimes
identical.

Use the legacy route for:

- parity and compatibility checks;
- recovering behavior that the PlayCanvas route intentionally reproduces;
- focused maintenance when a legacy-only user path is broken.

The focused local browser check is `npm run test:legacy`. It verifies that the
legacy query route reaches its menu, renders its canvas, and exposes the Start
Mission action without browser errors.

When a change touches shared configs or systems, verify both routes only when
the changed contract affects both. Keep the proof labels separate: local
PlayCanvas proof is not legacy proof, and neither is hosted or production proof.
