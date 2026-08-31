# Zombie Invasion visual showcase rubric

The visual batch uses the RemakeBench lesson of a narrow, authored scene with a clear camera and acceptance loop. The repository concept image is [cinematic-low-poly-survival](../art/cinematic-low-poly-survival-target.png); it is an aspirational composition reference, not a claim that the procedural renderer matches it pixel-for-pixel.

## Fixed capture contract

- Desktop: 1280×800, DPR 1, SwiftShader browser harness.
- Mobile: 390×760, DPR 1, SwiftShader browser harness.
- URL: `?showcase=1&preserveDrawingBuffer=1&glb=0`.
- Expected route signals: `showcaseMode=true`, `composition=hero-lane-locked`, `lightingProfile=cool-moon-warm-lantern`.
- Required browser proof: screenshots, render text, no page/console/request errors, nonblank canvas, viewport match.

## Review dimensions

1. Composition: bell tower remains the focal landmark; road establishes a centered leading line; foreground props sit outside the combat corridor.
2. Value: moonlit cool shadows separate from warm windows/lanterns; silhouettes remain readable without flattening the night.
3. Surface: facade panels, roof battens, road marks, foundation stones, rubble, and props break large uniform planes.
4. Character: the capture shows at least two distinguishable procedural enemy silhouettes; normal gameplay keeps its existing enemy and GLB behavior.
5. Mobile: the full measured frame fits the viewport and the capture remains nonblank with no browser errors.
6. Performance: SwiftShader smoke should remain at or above the 24 FPS target; local GPU target is 50 FPS; backbuffer remains within the profile budget.

## Evidence boundary

`npm run qa:visual` proves local browser behavior under this fixed harness. It does not prove hosted deployment, device-specific GPU performance, or customer-visible production behavior.
