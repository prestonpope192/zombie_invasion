/**
 * zombieGlb.js — skinned GLB zombie using the Quaternius CC0 model.
 *
 * Exports:
 *   loadZombieGlbContainer(app)             → Promise<Asset|null>
 *   createZombieGlbEntity(app, zombie, container) → pc.Entity (root)
 *   animateZombieGlbEntity(root, zombie, elapsedSec)
 *
 * Rules:
 *   - NO PlayCanvas API calls at module-import time.
 *   - Must NOT be imported by sliceSimulation.js (browser-only).
 *   - Graceful fallback on any load or runtime error.
 */

import * as pc from "playcanvas";

// ---------------------------------------------------------------------------
// Module-level container cache (loaded once per session)
// ---------------------------------------------------------------------------

/** @type {pc.Asset|null} */
let _cachedContainerAsset = null;
let _loadPromise = null;

/**
 * Load (once) the GLB container asset from /models/zombie-quaternius.glb.
 * Resolves with the pc.Asset on success, null on any failure.
 * @param {pc.Application} app
 * @returns {Promise<pc.Asset|null>}
 */
export function loadZombieGlbContainer(app) {
  if (_cachedContainerAsset !== null) {
    return Promise.resolve(_cachedContainerAsset);
  }
  if (_loadPromise) {
    return _loadPromise;
  }

  _loadPromise = new Promise((resolve) => {
    try {
      app.assets.loadFromUrl(
        "/models/zombie-quaternius.glb",
        "container",
        (err, asset) => {
          if (err || !asset) {
            console.warn("[zombieGlb] Failed to load GLB container:", err);
            resolve(null);
          } else {
            _cachedContainerAsset = asset;
            // Log animation names once for development diagnostics
            const names = (asset.resource?.animations ?? []).map(
              (a) => a.resource?.name ?? a.name ?? "?"
            );
            console.log("[zombieGlb] Loaded. Animations:", names.join(", "));
            resolve(asset);
          }
        }
      );
    } catch (ex) {
      console.warn("[zombieGlb] Exception during load:", ex);
      resolve(null);
    }
  });

  return _loadPromise;
}

// ---------------------------------------------------------------------------
// Scale factors — mirror zombieRig.js logic
// ---------------------------------------------------------------------------

function getScaleFactors(zombie) {
  const type = zombie.type ?? "walker";
  const isRunner = type === "runner" || type === "skitter" || type === "pouncer";
  const isMega = type === "mega_zombie" || type === "juggernaut";
  const isBoss = type === "secret_boss" || type === "mini_boss";
  const isBrute = isMega || isBoss || type === "brute" || type === "armored";
  const isCrawler = type === "crawler" || type.includes("chicken") || type.includes("pig");

  // Height scale: walker = 1.0 → model tuned to ~1.75u tall world space
  const hS = isBoss ? 1.8 : isMega ? 1.55 : isCrawler ? 0.66 : isRunner ? 1.1 : isBrute ? 1.32 : 1.0;

  return { hS, isRunner, isMega, isBoss, isBrute, isCrawler };
}

// ---------------------------------------------------------------------------
// Build a Map from bare animation name → AnimTrack resource.
//
// FIX (2026-06-12): The container sub-asset's .name property is the file-path
// key ("zombie-quaternius.glb/animation/12"), NOT the clip name.  The clip
// name lives on the AnimTrack resource itself (animAsset.resource.name).
// We must prefer track.name over animAsset.name.
// GLB may include both bare ("Walk") and prefixed ("CharacterArmature|Walk")
// variants; we normalise to the bare clip name.
// ---------------------------------------------------------------------------

function buildAnimMap(container) {
  const map = new Map();
  const animations = container.resource?.animations ?? [];
  for (const animAsset of animations) {
    const track = animAsset.resource;
    if (!track) continue;
    // CRITICAL: use the AnimTrack resource name, NOT the sub-asset asset name.
    // animAsset.name is the container path key (e.g. "zombie-quaternius.glb/animation/12").
    // track.name is the actual clip name (e.g. "Walk" or "CharacterArmature|Walk").
    const rawName = track.name ?? animAsset.name ?? "";
    const bareName = rawName.includes("|") ? rawName.split("|").pop() : rawName;
    if (bareName && !map.has(bareName)) {
      map.set(bareName, track);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Per-type tint configs
// ---------------------------------------------------------------------------

/**
 * Returns tint config for the given zombie type.
 * All configs use Phong path (useMetalness=false) to avoid the PBR jelly artefact.
 *
 * @param {string} type — zombie.type
 * @returns {{ diffuse: number[], emissive: number[], emissiveIntensity: number }}
 */
function getTintConfig(type) {
  switch (type) {
    // Brute / Juggernaut — desaturated cold grey-green, very dark, deader look
    case "brute":
    case "juggernaut":
      return { diffuse: [0.18, 0.22, 0.18], emissive: [0.03, 0.05, 0.05], emissiveIntensity: 1.0 };

    // Armored — dark grey with slight metallic darkening
    case "armored":
      return { diffuse: [0.20, 0.22, 0.22], emissive: [0.04, 0.05, 0.05], emissiveIntensity: 0.8 };

    // Mega zombie — sickly toxic green, stronger emissive veining
    case "mega_zombie":
      return { diffuse: [0.18, 0.30, 0.10], emissive: [0.04, 0.12, 0.02], emissiveIntensity: 1.8 };

    // Mini boss / Secret boss — near-black with deep red undertone
    case "mini_boss":
    case "secret_boss":
      return { diffuse: [0.12, 0.08, 0.08], emissive: [0.10, 0.02, 0.02], emissiveIntensity: 2.0 };

    // Commons (walker, runner, crawler, etc.) — standard muted olive flesh
    default:
      return { diffuse: [0.25, 0.30, 0.18], emissive: [0.06, 0.09, 0.04], emissiveIntensity: 1.0 };
  }
}

// ---------------------------------------------------------------------------
// Night tint — darken and desaturate the Atlas material
// ---------------------------------------------------------------------------

/**
 * Apply a night tint to all render components on a GLB entity.
 * Clones the material so the shared Atlas is never mutated.
 *
 * Strategy: the Quaternius Atlas is bright cartoon colour.  We want the zombie
 * to sit in a dark, moody night scene matching the procedural rig palette
 * (~0.08 sRGB green flesh).  PlayCanvas StandardMaterial diffuse colour
 * multiplies the diffuse texture, so setting a very dark colour here globally
 * darkens the model regardless of texture content.
 * We add a tiny green-ish emissive so the zombie isn't completely black in shadow.
 *
 * Material path: Phong (useMetalness=false).  The Quaternius atlas does not
 * have separate metalness/roughness channels, and enabling the PBR metalness
 * path caused the "jelly/glossy slime" artefact because PlayCanvas's
 * StandardMaterial interprets the atlas green channel as roughness when
 * useMetalness=true.  Phong + shininess=10 gives a matte clay look.
 *
 * @param {pc.Entity} modelEntity
 * @param {string}    type — zombie.type (used for per-type tint)
 */
function applyNightTint(modelEntity, type) {
  const cfg = getTintConfig(type ?? "walker");
  const renders = modelEntity.findComponents("render");
  for (const render of renders) {
    for (const mi of render.meshInstances) {
      const orig = mi.material;
      if (!orig) continue;
      const cloned = orig.clone();

      // Diffuse tint: multiplies the atlas texture → per-type dark palette.
      cloned.diffuse = new pc.Color(...cfg.diffuse);

      // Emissive lift: small constant glow so the zombie reads against the
      // dark road (sRGB ~0.04-0.06) without looking self-lit or over-bright.
      cloned.emissive = new pc.Color(...cfg.emissive);
      cloned.emissiveIntensity = cfg.emissiveIntensity;

      // MATTE finish — Phong path, zero specular.
      // useMetalness=false forces Phong shading (avoids PBR atlas-channel
      // misinterpretation that produced the jelly/glossy artefact).
      // shininess=5 → essentially flat/matte diffuse-only surface.
      // specular=black → no specular highlight at all.
      cloned.useMetalness = false;
      cloned.shininess = 5;
      cloned.specular = new pc.Color(0, 0, 0);
      cloned.gloss = 0.05;

      cloned.update();
      mi.material = cloned;
    }
  }
}

// ---------------------------------------------------------------------------
// Per-type eye config
// ---------------------------------------------------------------------------

/**
 * Returns eye color, sphere scale multiplier, and light intensity for a type.
 * Boss types get larger spheres + brighter light to be scary at distance.
 *
 * @param {string} type
 * @returns {{ color: number[], intensity: number, scaleMul: number, lightIntensity: number, lightRange: number }}
 */
function getEyeConfig(type) {
  switch (type) {
    case "brute":
    case "juggernaut":
      // Deep orange — heavier, deader look
      return { color: [1.0, 0.35, 0.0], intensity: 4.5, scaleMul: 1.0, lightIntensity: 2.5, lightRange: 5 };

    case "armored":
      // Cold white-blue — mechanical / armored threat
      return { color: [0.8, 0.9, 1.0], intensity: 3.5, scaleMul: 1.0, lightIntensity: 2.0, lightRange: 5 };

    case "mega_zombie":
      // Acid green — toxic mutation
      return { color: [0.2, 1.0, 0.1], intensity: 5.0, scaleMul: 1.1, lightIntensity: 3.0, lightRange: 6 };

    case "mini_boss":
    case "secret_boss":
      // Blood red — boss-level menace, larger + brighter
      return { color: [1.0, 0.04, 0.04], intensity: 6.0, scaleMul: 1.35, lightIntensity: 4.0, lightRange: 8 };

    default:
      // Standard warm amber for commons
      return { color: [1.0, 0.62, 0.08], intensity: 4.0, scaleMul: 1.0, lightIntensity: 2.0, lightRange: 5 };
  }
}

// ---------------------------------------------------------------------------
// Glowing eye helpers
// ---------------------------------------------------------------------------

/**
 * Attach glowing emissive eye spheres + modest omni light.
 *
 * Eyes are parented to the ROOT wrapper entity (world-scale coordinate space)
 * to avoid inheriting the skeleton's 100× armature scale from the Blender
 * cm-unit export.  Their local position is updated every frame to track the
 * Head bone's world position (see animateZombieGlbEntity).
 *
 * @param {pc.Application} app
 * @param {pc.Entity} root        — the wrapper entity (parent of modelEntity)
 * @param {pc.Entity} modelEntity — the instantiated render entity
 * @param {number}    hS          — height scale factor
 * @param {string}    type        — zombie.type for per-type color
 */
function attachEyes(app, root, modelEntity, hS, type) {
  const eyeCfg = getEyeConfig(type ?? "walker");

  // Eye separation (world units, scaled by hS)
  const eyeX = 0.065 * hS;
  const eyeZ = -0.06 * hS;   // slightly forward of head centre
  const eyeS = 0.055 * hS * eyeCfg.scaleMul;   // sphere radius (larger for bosses)

  // Eye material: bright emissive, per-type color, no lighting
  const eyeMat = new pc.StandardMaterial();
  eyeMat.emissive = new pc.Color(...eyeCfg.color);
  eyeMat.emissiveIntensity = eyeCfg.intensity;
  eyeMat.diffuse = new pc.Color(0, 0, 0);
  eyeMat.useLighting = false;
  eyeMat.update();

  function makeEye(name, x) {
    const e = new pc.Entity(name);
    e.addComponent("render", {
      type: "sphere",
      material: eyeMat,
      castShadows: false,
      receiveShadows: false,
    });
    e.setLocalScale(eyeS, eyeS, eyeS);
    // Initial y set from head bone world pos in first animateZombieGlbEntity call.
    // Fallback: ~66% of 1.75u ≈ 1.16u for a walker (head is at ~1.16u after scale fix).
    e.setLocalPosition(x, 1.16 * hS, eyeZ);
    root.addChild(e);
    return e;
  }

  const eyeL = makeEye("glb-eye-l", -eyeX);
  const eyeR = makeEye("glb-eye-r",  eyeX);

  // Omni glow light — intensity/range scale with threat level
  const eyeGlow = new pc.Entity("glb-eye-glow");
  eyeGlow.addComponent("light", {
    type: "omni",
    color: new pc.Color(...eyeCfg.color),
    intensity: eyeCfg.lightIntensity,
    range: eyeCfg.lightRange,
    castShadows: false,
  });
  eyeGlow.setLocalPosition(0, 1.16 * hS, eyeZ - 0.02);
  root.addChild(eyeGlow);

  return { eyeL, eyeR, eyeGlow, eyeMat };
}

// ---------------------------------------------------------------------------
// Silhouette prop helpers (heavy types only)
// ---------------------------------------------------------------------------

/**
 * Create a dark primitive prop entity (box or cone).
 * @param {string} name
 * @param {"box"|"cone"|"cylinder"} shape
 * @param {pc.Color} color
 * @param {number} emissiveIntensity — 0 for fully dark, >0 for emissive crack look
 * @returns {pc.Entity}
 */
function makePropEntity(name, shape, color, emissiveIntensity = 0) {
  const e = new pc.Entity(name);
  const mat = new pc.StandardMaterial();
  mat.diffuse = color;
  mat.useMetalness = false;
  mat.shininess = 5;
  mat.specular = new pc.Color(0, 0, 0);
  if (emissiveIntensity > 0) {
    mat.emissive = color.clone();
    mat.emissiveIntensity = emissiveIntensity;
  }
  mat.update();
  e.addComponent("render", {
    type: shape,
    material: mat,
    castShadows: false,
    receiveShadows: false,
  });
  return e;
}

/**
 * Attach silhouette props to a heavy zombie.
 * Props are parented to bones if findable, otherwise to model root at
 * standing-pose world offsets converted to modelEntity-local space.
 *
 * Bone names confirmed in Quaternius skeleton (logged in console):
 *   Spine, Spine1, Spine2, LeftArm, RightArm, LeftShoulder, RightShoulder,
 *   LeftForeArm, RightForeArm, Head, Neck
 * We'll try shoulder bones; fall back to Spine2 (chest); fall back to modelEntity root.
 *
 * Total added entities per heavy ≤ 8 (typically 4-6).
 *
 * @param {pc.Application} app
 * @param {pc.Entity} root        — wrapper root entity (world scale)
 * @param {pc.Entity} modelEntity — GLB render entity (has 100x armature)
 * @param {string}    type        — zombie.type
 * @param {number}    hS          — height scale factor
 */
function attachSilhouetteProps(app, root, modelEntity, type, hS) {
  const darkGrey = new pc.Color(0.06, 0.07, 0.07);
  const darkGreen = new pc.Color(0.05, 0.08, 0.04);
  const darkRed = new pc.Color(0.40, 0.02, 0.02);
  const nearBlack = new pc.Color(0.06, 0.04, 0.04);

  // Helper: find a bone by name anywhere in the model hierarchy
  function bone(name) {
    return modelEntity.findByName(name);
  }

  // ── Armored: 2 dark shoulder plate boxes + chest plate ─────────────────
  if (type === "armored") {
    const lShoulder = bone("LeftArm") ?? bone("LeftShoulder") ?? bone("Spine2");
    const rShoulder = bone("RightArm") ?? bone("RightShoulder") ?? bone("Spine2");
    const spine2    = bone("Spine2") ?? bone("Spine1") ?? bone("Spine");

    const plateScale = 0.18 * hS;
    const plateThick = 0.05 * hS;
    const plateH     = 0.14 * hS;

    // Left shoulder plate
    const lPlate = makePropEntity("prop-shoulder-l", "box", darkGrey);
    lPlate.setLocalScale(plateScale, plateH, plateThick);
    if (lShoulder) {
      lPlate.setLocalPosition(-0.08 * hS, 0, 0);
      lShoulder.addChild(lPlate);
    } else {
      lPlate.setLocalPosition(-0.22 * hS, 1.35 * hS, 0);
      modelEntity.addChild(lPlate);
    }

    // Right shoulder plate
    const rPlate = makePropEntity("prop-shoulder-r", "box", darkGrey);
    rPlate.setLocalScale(plateScale, plateH, plateThick);
    if (rShoulder) {
      rPlate.setLocalPosition(0.08 * hS, 0, 0);
      rShoulder.addChild(rPlate);
    } else {
      rPlate.setLocalPosition(0.22 * hS, 1.35 * hS, 0);
      modelEntity.addChild(rPlate);
    }

    // Chest plate
    const chest = makePropEntity("prop-chest", "box", darkGrey);
    chest.setLocalScale(0.30 * hS, 0.20 * hS, 0.04 * hS);
    if (spine2) {
      chest.setLocalPosition(0, 0.04 * hS, -0.12 * hS);
      spine2.addChild(chest);
    } else {
      chest.setLocalPosition(0, 1.10 * hS, -0.15 * hS);
      modelEntity.addChild(chest);
    }
    return;
  }

  // ── Brute / Juggernaut: 3-4 jagged back spikes (dark cones on Spine2) ──
  if (type === "brute" || type === "juggernaut") {
    const spine2 = bone("Spine2") ?? bone("Spine1") ?? bone("Spine");
    const spikeH = 0.22 * hS;
    const spikeR = 0.045 * hS;
    const spikeColor = darkGreen;

    // 3 spikes staggered along the back (positive Z is world-back when anim is neutral)
    const spikeOffsets = [
      { x: -0.08 * hS, y: 0.05 * hS, z: 0.10 * hS },
      { x:  0.00 * hS, y: 0.10 * hS, z: 0.12 * hS },
      { x:  0.08 * hS, y: 0.05 * hS, z: 0.10 * hS },
    ];
    for (let i = 0; i < spikeOffsets.length; i++) {
      const spike = makePropEntity(`prop-spike-${i}`, "cone", spikeColor);
      spike.setLocalScale(spikeR, spikeH, spikeR);
      if (spine2) {
        spike.setLocalPosition(spikeOffsets[i].x, spikeOffsets[i].y, spikeOffsets[i].z);
        // Tilt spike outward slightly (rotate around Z) to look jagged
        spike.setLocalEulerAngles(spikeOffsets[i].x < 0 ? -15 : spikeOffsets[i].x > 0 ? 15 : 0, 0, 0);
        spine2.addChild(spike);
      } else {
        spike.setLocalPosition(spikeOffsets[i].x, 1.1 * hS + spikeOffsets[i].y, spikeOffsets[i].z);
        modelEntity.addChild(spike);
      }
    }
    return;
  }

  // ── Mini boss / Secret boss: crown horns on Head + emissive chest crack ─
  if (type === "mini_boss" || type === "secret_boss") {
    const head = bone("Head");
    const spine2 = bone("Spine2") ?? bone("Spine1") ?? bone("Spine");

    // Crown of 3 short horns around head top
    const hornH = 0.14 * hS;
    const hornR = 0.035 * hS;
    const hornAngles = [-40, 0, 40];  // degrees around head, spread
    for (let i = 0; i < 3; i++) {
      const horn = makePropEntity(`prop-horn-${i}`, "cone", nearBlack);
      horn.setLocalScale(hornR, hornH, hornR);
      const angle = hornAngles[i];
      const spread = 0.07 * hS;
      const xOff = Math.sin((angle * Math.PI) / 180) * spread;
      const zOff = Math.cos((angle * Math.PI) / 180) * 0.02 * hS;
      if (head) {
        horn.setLocalPosition(xOff, 0.06 * hS, zOff);
        horn.setLocalEulerAngles(angle !== 0 ? (angle > 0 ? -12 : 12) : 0, 0, angle * 0.3);
        head.addChild(horn);
      } else {
        horn.setLocalPosition(xOff, 1.72 * hS, zOff);
        modelEntity.addChild(horn);
      }
    }

    // Emissive red chest crack (thin box on Spine2)
    const crack = makePropEntity("prop-chest-crack", "box", darkRed, 3.0);
    crack.setLocalScale(0.06 * hS, 0.20 * hS, 0.025 * hS);
    if (spine2) {
      crack.setLocalPosition(0, 0.02 * hS, -0.13 * hS);
      spine2.addChild(crack);
    } else {
      crack.setLocalPosition(0, 1.05 * hS, -0.15 * hS);
      modelEntity.addChild(crack);
    }
    return;
  }

  // mega_zombie and commons: no silhouette props
}

// ---------------------------------------------------------------------------
// createZombieGlbEntity
// ---------------------------------------------------------------------------

/**
 * Create a GLB-based zombie entity.
 * @param {pc.Application} app
 * @param {object}         zombie      — sim zombie object
 * @param {pc.Asset}       container   — loaded container asset
 * @returns {pc.Entity} root entity (parent of GLB model + eyes + shadow)
 */
export function createZombieGlbEntity(app, zombie, container) {
  const { hS, isCrawler } = getScaleFactors(zombie);

  // Wrapper root — sits at ground level, same semantics as procedural rig root
  const root = new pc.Entity(`glb-entity-${zombie.id}`);
  app.root.addChild(root);

  // Instantiate the skinned render entity from the container.
  // instantiateRenderEntity() returns the scene root of the GLB hierarchy.
  // For the Quaternius zombie (Blender cm export):
  //   RootNode (scale=1)
  //     CharacterArmature (scale=100  ← Blender cm→m unit conversion node)
  //       Root (scale=1, bone root)
  //         ... skeleton ...
  //     Zombie (scale=100, mesh)
  //     Eyelid (scale=100, mesh)
  // The anim component is added to RootNode so the binder resolves all bones.
  let modelEntity;
  try {
    modelEntity = container.resource.instantiateRenderEntity({ castShadows: true, receiveShadows: true });
  } catch (ex) {
    console.warn("[zombieGlb] instantiateRenderEntity failed:", ex);
    root._glb = { valid: false };
    return root;
  }

  // Scale calibration (measured live, 2026-06-12):
  // At scale=1 the GLB's world-space AABB is [-0.161, +1.358] (height=1.519u).
  // Target height for a walker: 1.75u.
  // Required scale = 1.75 / 1.519 ≈ 1.152.
  // At scale=1.152 the feet sit at -0.161 × 1.152 ≈ -0.185 world units.
  // FOOT_OFFSET lifts the model so feet land at y=0.
  // Final world AABB: [0, 1.75] for hS=1.0.
  const BASE_SCALE   = 1.152;
  const FOOT_OFFSET  = 0.185; // world units — lifts feet to ground plane

  modelEntity.setLocalScale(BASE_SCALE * hS, BASE_SCALE * hS, BASE_SCALE * hS);
  modelEntity.setLocalPosition(0, FOOT_OFFSET * hS, 0);

  // NOTE: No crawlerPitchAdj rotation here — the Crawl clip already positions the model
  // correctly (body low to the ground).  A manual X-rotation hack is not needed and
  // would fight the animation, causing the mesh to clip the floor.

  root.addChild(modelEntity);

  // Apply night tint to the bright Atlas material (Phong matte path, per-type tint)
  applyNightTint(modelEntity, zombie.type ?? "walker");

  // Blob shadow (flat disc on ground, same as procedural rig)
  const shadowMat = new pc.StandardMaterial();
  shadowMat.diffuse = new pc.Color(0.04, 0.06, 0.05);
  shadowMat.opacity = 0.55;
  shadowMat.blendType = pc.BLEND_NORMAL;
  shadowMat.depthWrite = false;
  shadowMat.update();
  const shadow = new pc.Entity("glb-shadow");
  shadow.addComponent("render", {
    type: "cylinder",
    material: shadowMat,
    castShadows: false,
    receiveShadows: false,
  });
  shadow.setLocalPosition(0, 0.03, 0);
  shadow.setLocalScale(0.88, 0.03, 0.88);
  root.addChild(shadow);

  // Glowing eyes (parented to root wrapper; y position updated each frame; per-type color)
  const eyes = attachEyes(app, root, modelEntity, hS, zombie.type ?? "walker");

  // Silhouette props — only for heavy types; commons are VISUALLY UNCHANGED
  const zombieType = zombie.type ?? "walker";
  const HEAVY_TYPES = new Set(["brute", "juggernaut", "armored", "mega_zombie", "mini_boss", "secret_boss"]);
  if (HEAVY_TYPES.has(zombieType)) {
    try {
      attachSilhouetteProps(app, root, modelEntity, zombieType, hS);
    } catch (ex) {
      console.warn("[zombieGlb] attachSilhouetteProps failed:", ex);
    }
  }

  // Build animation name → AnimTrack map (uses track.name, not asset.name)
  const animMap = buildAnimMap(container);

  // ---------------------------------------------------------------------------
  // Anim component setup.
  //
  // We use the simple `assignAnimation` API rather than a complex state graph
  // so that PlayCanvas auto-creates a minimal one-state graph per clip.  This
  // avoids the issue where loadStateGraph → setupAnimationAssets assigns
  // AnimTrack.EMPTY to every state before we can assign real tracks.
  //
  // Approach:
  //   1. Call assignAnimation("Walk", walkTrack) — PC auto-creates the state
  //      graph with Walk as the default state.
  //   2. For each other clip, call assignAnimation(clipName, track) — PC adds
  //      states to the same layer.
  //   3. To switch clips at runtime, call baseLayer.play(stateName).
  // ---------------------------------------------------------------------------

  const ANIM_PRIORITY = ["Walk", "Run", "Crawl", "Punch", "Idle_Attack", "Death", "HitReact", "Idle"];

  let animSetupOk = false;
  try {
    if (animMap.size > 0) {
      modelEntity.addComponent("anim", { activate: true });

      // Assign the default clip first (Walk) so it becomes the auto-graph default.
      const walkTrack = animMap.get("Walk") ?? animMap.values().next().value;
      modelEntity.anim.assignAnimation("Walk", walkTrack, undefined, 1.0, true);

      // Assign remaining priority clips.
      for (const stateName of ANIM_PRIORITY) {
        if (stateName === "Walk") continue; // already assigned
        const track = animMap.get(stateName);
        if (track) {
          const loop = stateName !== "Death";
          modelEntity.anim.assignAnimation(stateName, track, undefined, 1.0, loop);
        }
      }

      animSetupOk = true;
      modelEntity.anim.playing = true;
    }
  } catch (ex) {
    console.warn("[zombieGlb] Anim setup failed:", ex);
  }

  // Find the head bone for eye tracking (confirmed present in Quaternius skeleton)
  const headBone = modelEntity.findByName("Head");

  // Store glb-specific data on root for fast per-frame lookup
  // Determine runner width lean (x-scale narrowing for slim runner look)
  const { isRunner, isBrute } = getScaleFactors(zombie);
  // Runners get a slightly narrower silhouette (0.92× on X)
  const runnerXScale = isRunner ? 0.92 : 1.0;
  if (isRunner && runnerXScale !== 1.0) {
    modelEntity.setLocalScale(BASE_SCALE * hS * runnerXScale, BASE_SCALE * hS, BASE_SCALE * hS);
  }

  root._glb = {
    valid: true,
    modelEntity,
    eyes,
    shadow,
    animMap,
    animSetupOk,
    hS,
    isCrawler,
    isRunner,
    isBrute,
    currentAnim: "Walk",
    hitFlashActive: false,
    deathFinished: false, // true after Death anim completes; stop driving speed after that
    headBone,       // pc.Entity | null — for eye position tracking
    loggedNodes: false,
  };

  // Log skeleton node names once for diagnostics
  if (!root._glb.loggedNodes) {
    root._glb.loggedNodes = true;
    const allNodes = [];
    modelEntity.forEach((e) => allNodes.push(e.name));
    console.log("[zombieGlb] Skeleton nodes (first zombie):", allNodes.slice(0, 30).join(", "));
    console.log("[zombieGlb] AnimMap keys:", [...animMap.keys()].join(", "));
  }

  return root;
}

// ---------------------------------------------------------------------------
// Animation state selection helper
// ---------------------------------------------------------------------------

/**
 * Determine which animation state the zombie should be in.
 * @param {object} zombie — sim zombie object
 * @returns {string} state name
 */
function selectAnimState(zombie) {
  if (zombie.dead) return "Death";
  const type = zombie.type ?? "walker";
  const isCrawler = type === "crawler" || type.includes("chicken") || type.includes("pig");
  const isRunner = type === "runner" || type === "skitter" || type === "pouncer";
  const isBiting = (zombie.biteCooldownSec ?? 0) > 0 ||
                   zombie.aiState === "attack_player" ||
                   zombie.aiState === "attack_village";

  if (isCrawler) return "Crawl";
  if (isBiting) return "Punch";
  if (isRunner) return "Run";
  return "Walk";
}

// ---------------------------------------------------------------------------
// animateZombieGlbEntity
// ---------------------------------------------------------------------------

/**
 * Drive position/rotation and animation state of a GLB zombie entity.
 * Called every frame per live zombie, same as animateZombieRig.
 * @param {pc.Entity} root
 * @param {object}    zombie
 * @param {number}    elapsedSec
 */
export function animateZombieGlbEntity(root, zombie, elapsedSec) {
  const glb = root._glb;
  if (!glb?.valid) return;

  const { modelEntity, animMap, animSetupOk, eyes, headBone, hS } = glb;

  // --- Animation speed ---
  // Base reference speeds match the Quaternius clip tempos (measured against 1.4m/s walk, 3.2m/s run).
  // Brute/boss types walk slower in-game (0.8-1.2 m/s) but the Walk clip at full speed looks
  // unnaturally fast; clamp anim speed so heavy enemies lumber rather than scurry.
  const BASE_WALK_SPEED = 1.4;
  const BASE_RUN_SPEED  = 3.2;
  const desiredState = selectAnimState(zombie);
  const speedMps = zombie.speedMps ?? 1.4;
  const isRunState = desiredState === "Run";
  const baseRef = isRunState ? BASE_RUN_SPEED : BASE_WALK_SPEED;
  let animSpeed = Math.max(0.3, Math.min(3.0, speedMps / baseRef));

  // Heavy/brute types: clamp anim speed so Walk reads as a heavy lumber (max 0.75)
  if (glb.isBrute && !isRunState && desiredState !== "Death") {
    animSpeed = Math.min(animSpeed, 0.75);
  }

  // Death animation: play once and hold on last frame by pausing after one full cycle.
  // We detect completion by checking normalizedTime >= 0.98 (close to end).
  if (desiredState === "Death") {
    if (!glb.deathFinished) {
      // Switch to Death if not already playing it
      if (animSetupOk && modelEntity.anim && glb.currentAnim !== "Death") {
        try {
          if (animMap.has("Death")) {
            modelEntity.anim.baseLayer.play("Death");
            glb.currentAnim = "Death";
            // Set speed=1 for natural death fall, don't scale by movement speed
            modelEntity.anim.speed = 1.0;
          }
        } catch (_) { /* ignore */ }
      }
      // Check if the Death clip has finished (normalizedTime near 1.0)
      if (animSetupOk && modelEntity.anim) {
        try {
          const layer = modelEntity.anim.baseLayer;
          const normTime = layer.normalizedTime ?? 0;
          if (glb.currentAnim === "Death" && normTime >= 0.97) {
            // Pause to hold on last frame
            modelEntity.anim.speed = 0;
            glb.deathFinished = true;
          }
        } catch (_) { /* ignore */ }
      }
    }
    // Skip the rest of the per-frame anim update — dead zombie stays frozen
    // Eye/hit-flash updates still run below for cleanup
  } else {
    // Switch animation state if changed
    if (animSetupOk && modelEntity.anim && desiredState !== glb.currentAnim) {
      try {
        if (animMap.has(desiredState)) {
          modelEntity.anim.baseLayer.play(desiredState);
          glb.currentAnim = desiredState;
        }
      } catch (ex) {
        // Swallow — never crash the sim
      }
    }

    // Update anim speed (only for living zombies)
    if (animSetupOk && modelEntity.anim) {
      try {
        modelEntity.anim.speed = animSpeed;
      } catch (_) { /* ignore */ }
    }
  }

  // --- Eye tracking: update eye/glow local position to follow Head bone ---
  // The Head bone lives deep inside the 100×-scaled armature, so we read its
  // world position and convert to the root wrapper's local space.
  if (headBone && eyes) {
    try {
      const headWorldPos = headBone.getPosition();
      const rootWorldPos = root.getPosition();
      // Eyes in root-local space (root has no scale, so local = world offset)
      const localY = headWorldPos.y - rootWorldPos.y;
      const localZ = -0.06 * hS; // forward offset in root-local space

      eyes.eyeL.setLocalPosition(-0.065 * hS, localY, localZ);
      eyes.eyeR.setLocalPosition( 0.065 * hS, localY, localZ);
      eyes.eyeGlow.setLocalPosition(0, localY, localZ - 0.02);
    } catch (_) { /* silently ignore if bone transform not ready */ }
  }

  // --- Hit flash ---
  const hitFlash = (zombie.hitFlashSec ?? 0) > 0;
  if (hitFlash !== glb.hitFlashActive) {
    glb.hitFlashActive = hitFlash;
    applyGlbHitFlash(glb, hitFlash);
  }
}

// ---------------------------------------------------------------------------
// Hit flash — tint mesh instances emissive red briefly
// ---------------------------------------------------------------------------

/**
 * Apply or remove hit flash emissive tint on GLB mesh instances.
 * Materials were already cloned during night-tint pass, so we can mutate them.
 */
function applyGlbHitFlash(glb, hitFlash) {
  const { modelEntity } = glb;
  if (!modelEntity) return;

  const renders = modelEntity.findComponents("render");
  for (const render of renders) {
    for (const mi of render.meshInstances) {
      const mat = mi.material;
      if (!mat) continue;
      if (hitFlash) {
        if (!mat._glbOrigEmissive) {
          mat._glbOrigEmissive = mat.emissive?.clone() ?? new pc.Color(0, 0, 0);
          mat._glbOrigEmissiveIntensity = mat.emissiveIntensity ?? 1;
        }
        mat.emissive = new pc.Color(0.9, 0.05, 0.05);
        mat.emissiveIntensity = 3.0;
      } else {
        if (mat._glbOrigEmissive) {
          mat.emissive = mat._glbOrigEmissive;
          mat.emissiveIntensity = mat._glbOrigEmissiveIntensity;
        }
      }
      mat.update();
    }
  }
}
