# Zombie Invasion Art Direction: Cinematic Low-Poly Survival

## Target

Zombie Invasion should look like a polished indie browser FPS with the mood of a cinematic night-defense scene and the readability of a stylized low-poly game. The target is tense, warm, and playable, not grim horror.

Reference image:

![Cinematic low-poly survival target](art/cinematic-low-poly-survival-target.png)

## One-Sentence Brief

A cozy rural village under cool moonlight, defended from readable stylized zombies by warm lantern light, clear silhouettes, and arcade-survival pacing.

## What To Borrow From Option 2

- Cinematic color contrast: cool blue moonlight against warm orange lantern pools.
- Light fog and atmospheric depth, especially down the village lane.
- Strong silhouettes around the bell tower, houses, barricades, and enemy groups.
- First-person weapon presence that feels polished without becoming militaristic realism.
- Dramatic composition that makes the village objective obvious from the first frame.

## What To Borrow From Option 3

- Low-poly forms with clean bevel-like silhouettes and limited material families.
- Enemy shapes readable at distance before texture detail matters.
- Stable gameplay color language: path, village objective, enemies, pickups, and danger all separate clearly.
- Performance-friendly geometry that can run in-browser and scale to mobile fallbacks.
- DOM HUD for text-heavy information; PlayCanvas owns the world, camera, lighting, particles, and animated models.

## What To Avoid

- Gore, body horror, jump-scare framing, horror closeups, or oppressive near-black scenes.
- Photoreal expectations that require AAA asset production.
- Random asset-pack mixing without shared palette, scale, pivots, and material keys.
- Decorative fog or darkness that hides enemies, doors, pickups, or the village objective.
- Realistic zombie grotesquery; enemies should be threatening game pieces, not nightmares.

## Palette

- Moon key: desaturated blue, used for roof edges, tree rims, and distant fog.
- Lantern key: amber/orange, used for village safety, doors, and objective staging.
- Ground: muted green-brown with a separate muddy lane family.
- Enemies: readable green/olive bodies, pale warm eye glows, variant accents by role.
- UI: restrained dark glass with pale green/amber accents, small enough to preserve the playfield.

## Asset Rules

- Ship 3D content as GLB or glTF 2.0.
- Use stable manifest keys instead of raw filenames as the game API.
- Group assets by domain: `characters`, `environment`, `props`, `weapons`, `fx`, `ui`, `audio`.
- Every model should document source/license, intended scale, pivot, collision proxy, and LOD/fallback plan.
- Environment pieces should be modular: house body, roof, door, window, lantern, fence, barricade, cart, tree, road segment.
- Zombie variants need silhouette-first differences: walker, runner, brute, crawler/animal, boss.

## Success Criteria

- First screenshot reads as a game, not a renderer demo.
- Bell tower or village objective is obvious within two seconds.
- Player can identify enemy groups at mid-distance without labels.
- At least two zombie variants are distinguishable by shape and motion.
- Scene remains tense but broadly approachable: no gore, no shock imagery, no extreme darkness.
- Warm/cool lighting contrast is visible in screenshots and during movement.
- HUD does not hide enemies or the objective.
- Prototype maintains deterministic text hooks for automation and visual smoke tests.
- Production build emits both the current FPS route and the PlayCanvas slice route.

## Next Execution Steps

1. Upgrade the PlayCanvas slice from primitives to a reusable cinematic low-poly kit:
   - house module, roof module, lantern module, fence/barricade module, lane props, stylized trees.
2. Add a manifest-driven asset boundary:
   - material keys, prototype primitive fallback, future GLB URL, license/source notes.
3. Replace placeholder zombie assemblies with two stronger model-ready silhouettes:
   - walker with broad arms and slow sway; runner with narrow torso and forward lean.
4. Add approachable cinematic FX:
   - muzzle flash, dust puffs, lantern glow, soft fog bands, non-gory hit flash.
5. Add visual verification:
   - desktop screenshot, mobile screenshot, automation text hook, and a simple color/readability smoke check.
6. Only after the slice proves the target, decide whether to port the full game loop to PlayCanvas.

