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
 */
function applyNightTint(modelEntity) {
  const renders = modelEntity.findComponents("render");
  for (const render of renders) {
    for (const mi of render.meshInstances) {
      const orig = mi.material;
      if (!orig) continue;
      const cloned = orig.clone();

      // Diffuse tint: multiplies the atlas texture → dark muted olive flesh.
      // A value of 0.22-0.30 in sRGB darkens the bright cartoon atlas to the
      // moody dark-night palette while keeping the texture silhouette readable.
      cloned.diffuse = new pc.Color(0.25, 0.30, 0.18);

      // Emissive lift: small constant glow so the zombie reads against the
      // dark road (sRGB ~0.04-0.06) without looking self-lit or over-bright.
      // Keep intensity low — 1.0 is enough for readability at 5-20m.
      cloned.emissive = new pc.Color(0.06, 0.09, 0.04);
      cloned.emissiveIntensity = 1.0;

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
 */
function attachEyes(app, root, modelEntity, hS) {
  // Eye separation (world units, scaled by hS)
  const eyeX = 0.065 * hS;
  const eyeZ = -0.06 * hS;   // slightly forward of head centre
  const eyeS = 0.055 * hS;   // sphere radius

  // Eye material: bright emissive amber/orange, no lighting
  const eyeMat = new pc.StandardMaterial();
  eyeMat.emissive = new pc.Color(1.0, 0.62, 0.08);
  eyeMat.emissiveIntensity = 4.0;
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

  // Modest omni glow light
  const eyeGlow = new pc.Entity("glb-eye-glow");
  eyeGlow.addComponent("light", {
    type: "omni",
    color: new pc.Color(1.0, 0.68, 0.18),
    intensity: 2.0,
    range: 5,
    castShadows: false,
  });
  eyeGlow.setLocalPosition(0, 1.16 * hS, eyeZ - 0.02);
  root.addChild(eyeGlow);

  return { eyeL, eyeR, eyeGlow, eyeMat };
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

  // Apply night tint to the bright Atlas material (Phong matte path)
  applyNightTint(modelEntity);

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

  // Glowing eyes (parented to root wrapper; y position updated each frame)
  const eyes = attachEyes(app, root, modelEntity, hS);

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
