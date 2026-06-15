/**
 * animalGlb.js — skinned GLB animal zombies using Quaternius CC0 models.
 *
 * Exports:
 *   loadAnimalGlbContainers(app)                   → Promise<AnimalContainers>
 *   createAnimalGlbEntity(app, zombie, containers) → pc.Entity (root) | null
 *   animateAnimalGlbEntity(root, zombie, elapsedSec)
 *
 * Supported animal types (zombie.type):
 *   zombie_cow      — public/models/animal-cow.glb
 *   zombie_pig      — public/models/animal-pig.glb
 *   zombie_horse    — public/models/animal-horse.glb
 *   zombie_chicken  — public/models/animal-chicken.glb
 *
 * Rules:
 *   - NO PlayCanvas API calls at module-import time.
 *   - Must NOT be imported by sliceSimulation.js (browser-only).
 *   - Graceful fallback: if a specific animal model isn't available,
 *     createAnimalGlbEntity returns null (caller falls back to zombie GLB / procedural).
 *   - All four models share the same Quaternius armature conventions:
 *       AnimalArmature (or Armature): rotation=-90°X, scale=100 (Blender cm export)
 *       Models face forward along Blender -Y (world +Z after transform) at rest.
 *       The same 180° yaw offset as zombieGlb.js aligns them to movement direction.
 *
 * Scale calibration (measured from GLTF accessor bounds at scale=1):
 *   cow:     5.15m world height → scale=0.27 → ~1.40m body height
 *   pig:     4.59m world height → scale=0.17 → ~0.78m body height
 *   horse:   4.82m world height → scale=0.31 → ~1.49m body height
 *   chicken: 1.24m world height → scale=0.36 → ~0.45m body height
 *
 * Animation clip availability (bare name, after prefix strip):
 *   cow:     Death, Idle, Jump, Run, Walk, WalkSlow  (Armature| prefix)
 *   pig:     Idle, Jump                              (Armature| prefix)
 *   horse:   Attack_Headbutt, Attack_Kick, Death, Eating, Gallop, Gallop_Jump,
 *            Idle, Idle_2, Idle_Headlow, Idle_HitReact_Left, Idle_HitReact_Right,
 *            Jump_toIdle, Walk                       (AnimalArmature| prefix)
 *   chicken: Attack, Death, Idle, Idle_Peck, Run     (AnimalArmature| prefix)
 *
 * @module animalGlb
 */

import * as pc from "playcanvas";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * @typedef {{
 *   cow:     pc.Asset|null,
 *   pig:     pc.Asset|null,
 *   horse:   pc.Asset|null,
 *   chicken: pc.Asset|null,
 * }} AnimalContainers
 */

// ---------------------------------------------------------------------------
// Module-level container cache (loaded once per session)
// ---------------------------------------------------------------------------

/** @type {AnimalContainers|null} */
let _cachedContainers = null;
let _loadPromise = null;

// URL map — only sourced from the trusted static.poly.pizza CDN.
const ANIMAL_URLS = {
  cow:     "/models/animal-cow.glb",
  pig:     "/models/animal-pig.glb",
  horse:   "/models/animal-horse.glb",
  chicken: "/models/animal-chicken.glb",
};

/**
 * Load (once) all four animal GLB container assets in parallel.
 * Each resolves null on failure; the others continue.
 * @param {pc.Application} app
 * @returns {Promise<AnimalContainers>}
 */
export function loadAnimalGlbContainers(app) {
  if (_loadPromise) return _loadPromise;
  if (_cachedContainers) return Promise.resolve(_cachedContainers);

  function loadOne(key, url) {
    return new Promise((resolve) => {
      try {
        app.assets.loadFromUrl(url, "container", (err, asset) => {
          if (err || !asset) {
            console.warn(`[animalGlb] Failed to load ${key}:`, url, err);
            resolve(null);
          } else {
            const clips = (asset.resource?.animations ?? []).map((a) => {
              const track = a.resource;
              const raw = track?.name ?? a.name ?? "?";
              return raw.includes("|") ? raw.split("|").pop() : raw;
            }).filter((c, i, arr) => arr.indexOf(c) === i); // deduplicate
            console.log(`[animalGlb] Loaded ${key} (${url}). Clips:`, clips.join(", "));
            resolve(asset);
          }
        });
      } catch (ex) {
        console.warn(`[animalGlb] Exception loading ${key}:`, ex);
        resolve(null);
      }
    });
  }

  _loadPromise = Promise.all([
    loadOne("cow",     ANIMAL_URLS.cow),
    loadOne("pig",     ANIMAL_URLS.pig),
    loadOne("horse",   ANIMAL_URLS.horse),
    loadOne("chicken", ANIMAL_URLS.chicken),
  ]).then(([cow, pig, horse, chicken]) => {
    _cachedContainers = { cow, pig, horse, chicken };
    return _cachedContainers;
  });

  return _loadPromise;
}

// ---------------------------------------------------------------------------
// Per-type scale / appearance config
// ---------------------------------------------------------------------------

/**
 * @typedef {{
 *   key: string,           // container key (cow/pig/horse/chicken)
 *   baseScale: number,     // local scale to apply to instantiated model entity
 *   footOffset: number,    // Y lift (world units) so feet land at y=0
 *   shadowRadius: number,  // blob shadow cylinder X/Z scale (world units)
 *   shadowOpacity: number,
 *   eyeHeightFrac: number, // approximate eye height as fraction of world height
 *   eyeX: number,          // half eye-pair separation (world units)
 *   eyeZ: number,          // forward offset for eyes
 *   eyeS: number,          // eye sphere radius (world units)
 *   eyeLightRange: number,
 *   worldHeight: number,   // target world height for reference
 * }} AnimalTypeConfig
 */

const ANIMAL_TYPE_CONFIG = {
  zombie_cow: {
    key: "cow",
    baseScale: 0.27,
    footOffset: 0.02,
    shadowRadius: 0.80,
    shadowOpacity: 0.55,
    eyeHeightFrac: 0.75,   // head is near top of body
    eyeX: 0.12,
    eyeZ: -0.22,           // forward in root-local space
    eyeS: 0.07,
    eyeLightRange: 6,
    worldHeight: 1.40,
  },
  zombie_pig: {
    key: "pig",
    baseScale: 0.17,
    footOffset: 0.01,
    shadowRadius: 0.45,
    shadowOpacity: 0.50,
    eyeHeightFrac: 0.62,
    eyeX: 0.08,
    eyeZ: -0.12,
    eyeS: 0.05,
    eyeLightRange: 4,
    worldHeight: 0.78,
  },
  zombie_horse: {
    key: "horse",
    baseScale: 0.31,
    footOffset: 0.01,
    shadowRadius: 0.90,
    shadowOpacity: 0.55,
    eyeHeightFrac: 0.80,
    eyeX: 0.10,
    eyeZ: -0.28,
    eyeS: 0.07,
    eyeLightRange: 6,
    worldHeight: 1.50,
  },
  zombie_chicken: {
    key: "chicken",
    baseScale: 0.36,
    footOffset: 0.0,
    shadowRadius: 0.25,
    shadowOpacity: 0.45,
    eyeHeightFrac: 0.82,
    eyeX: 0.04,
    eyeZ: -0.07,
    eyeS: 0.035,
    eyeLightRange: 3,
    worldHeight: 0.45,
  },
};

// ---------------------------------------------------------------------------
// Undead tint — sickly desaturated grey-green for each animal type.
// All use Phong path (useMetalness=false) to avoid PBR atlas channel misread.
// ---------------------------------------------------------------------------

/**
 * Tint configs per animal type.
 * Animals look deader/greener than regular zombies to signal undead status.
 * We want: visibly not-normal, but still readable as the source animal shape.
 */
const UNDEAD_TINT = {
  zombie_cow:     { diffuse: [0.28, 0.34, 0.22], emissive: [0.05, 0.08, 0.04], emissiveIntensity: 1.0 },
  zombie_pig:     { diffuse: [0.30, 0.32, 0.22], emissive: [0.05, 0.07, 0.03], emissiveIntensity: 1.0 },
  zombie_horse:   { diffuse: [0.22, 0.28, 0.18], emissive: [0.04, 0.07, 0.03], emissiveIntensity: 1.0 },
  zombie_chicken: { diffuse: [0.32, 0.36, 0.24], emissive: [0.06, 0.09, 0.04], emissiveIntensity: 1.1 },
};

/**
 * Apply undead grey-green tint to all render components on the GLB entity.
 * Clones materials so the shared atlas is never mutated.
 * @param {pc.Entity} modelEntity
 * @param {string}    type — zombie.type
 */
function applyUndeadTint(modelEntity, type) {
  const cfg = UNDEAD_TINT[type] ?? UNDEAD_TINT.zombie_cow;
  const renders = modelEntity.findComponents("render");
  for (const render of renders) {
    for (const mi of render.meshInstances) {
      const orig = mi.material;
      if (!orig) continue;
      const cloned = orig.clone();

      cloned.diffuse = new pc.Color(...cfg.diffuse);
      cloned.emissive = new pc.Color(...cfg.emissive);
      cloned.emissiveIntensity = cfg.emissiveIntensity;

      // Phong matte — avoids PBR atlas-channel misinterpretation
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
// Build animation name → AnimTrack resource map (same approach as zombieGlb.js)
// ---------------------------------------------------------------------------

function buildAnimMap(container) {
  const map = new Map();
  const animations = container.resource?.animations ?? [];
  for (const animAsset of animations) {
    const track = animAsset.resource;
    if (!track) continue;
    const rawName = track.name ?? animAsset.name ?? "";
    // Strip ALL prefix segments (e.g. "AnimalArmature|AnimalArmature|AnimalArmature|Run" → "Run")
    // The chicken's clips have triple-nested prefix
    const parts = rawName.split("|");
    const bareName = parts[parts.length - 1];
    if (bareName && !map.has(bareName)) {
      map.set(bareName, track);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Eye / eye-glow helpers
// ---------------------------------------------------------------------------

/**
 * Attach glowing eye spheres + modest omni light.
 * Eyes are parented to root (world-scale), same approach as zombieGlb.js.
 *
 * @param {pc.Application} app
 * @param {pc.Entity}      root
 * @param {AnimalTypeConfig} cfg
 * @param {number}          worldHeight — target world height of this animal
 */
function attachEyes(app, root, cfg, worldHeight) {
  const eyeY = worldHeight * cfg.eyeHeightFrac; // approximate head height

  // Eye material: amber glow — undead look
  const eyeMat = new pc.StandardMaterial();
  eyeMat.emissive = new pc.Color(1.0, 0.62, 0.08);
  eyeMat.emissiveIntensity = 3.5;
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
    e.setLocalScale(cfg.eyeS, cfg.eyeS, cfg.eyeS);
    e.setLocalPosition(x, eyeY, cfg.eyeZ);
    root.addChild(e);
    return e;
  }

  const eyeL = makeEye("anim-eye-l", -cfg.eyeX);
  const eyeR = makeEye("anim-eye-r",  cfg.eyeX);

  // Omni glow light
  const eyeGlow = new pc.Entity("anim-eye-glow");
  eyeGlow.addComponent("light", {
    type: "omni",
    color: new pc.Color(1.0, 0.62, 0.08),
    intensity: 2.0,
    range: cfg.eyeLightRange,
    castShadows: false,
  });
  eyeGlow.setLocalPosition(0, eyeY, cfg.eyeZ - 0.02);
  root.addChild(eyeGlow);

  return { eyeL, eyeR, eyeGlow, eyeMat, eyeY };
}

// ---------------------------------------------------------------------------
// Animation state selection (per animal — available clips vary)
// ---------------------------------------------------------------------------

/**
 * Select desired animation state for an animal zombie.
 * Falls back gracefully if a clip isn't available in the anim map.
 *
 * @param {object}  zombie
 * @param {Map}     animMap
 * @returns {string} state name that exists in animMap (or null if nothing fits)
 */
function selectAnimalAnimState(zombie, animMap) {
  if (zombie.dead) {
    return animMap.has("Death") ? "Death" : null;
  }

  const speedMps = zombie.speedMps ?? 1.0;

  // Fast-moving animals prefer Run/Gallop; slower prefer Walk
  if (speedMps >= 2.0) {
    if (animMap.has("Run"))    return "Run";
    if (animMap.has("Gallop")) return "Gallop";
    if (animMap.has("Walk"))   return "Walk";
    if (animMap.has("Idle"))   return "Idle";
  } else {
    if (animMap.has("Walk"))   return "Walk";
    if (animMap.has("Run"))    return "Run";
    if (animMap.has("Gallop")) return "Gallop";
    if (animMap.has("Idle"))   return "Idle";
  }

  // Absolute fallback: first available clip
  return animMap.keys().next().value ?? null;
}

// ---------------------------------------------------------------------------
// createAnimalGlbEntity
// ---------------------------------------------------------------------------

/**
 * Create a GLB-based animal zombie entity.
 *
 * Returns null if the specific animal's container isn't loaded,
 * so the caller can fall back to the zombie GLB or procedural rig.
 *
 * @param {pc.Application}   app
 * @param {object}           zombie      — sim zombie object
 * @param {AnimalContainers} containers  — loaded container map
 * @returns {pc.Entity|null}
 */
export function createAnimalGlbEntity(app, zombie, containers) {
  const typeCfg = ANIMAL_TYPE_CONFIG[zombie.type];
  if (!typeCfg) return null; // not an animal type we handle

  const container = containers[typeCfg.key];
  if (!container) return null; // model not loaded — caller should use fallback

  // Wrapper root — sits at ground level
  const root = new pc.Entity(`animal-glb-${zombie.id}`);
  app.root.addChild(root);

  // Instantiate the skinned render entity
  let modelEntity;
  try {
    modelEntity = container.resource.instantiateRenderEntity({
      castShadows: true,
      receiveShadows: true,
    });
  } catch (ex) {
    console.warn("[animalGlb] instantiateRenderEntity failed:", ex);
    root._glb = { valid: false };
    return root;
  }

  // Apply per-type scale and foot offset
  modelEntity.setLocalScale(typeCfg.baseScale, typeCfg.baseScale, typeCfg.baseScale);
  modelEntity.setLocalPosition(0, typeCfg.footOffset, 0);
  root.addChild(modelEntity);

  // Apply undead tint (Phong matte, grey-green)
  applyUndeadTint(modelEntity, zombie.type);

  // Blob shadow (flat disc on ground)
  const shadowMat = new pc.StandardMaterial();
  shadowMat.diffuse = new pc.Color(0.04, 0.06, 0.05);
  shadowMat.opacity = typeCfg.shadowOpacity;
  shadowMat.blendType = pc.BLEND_NORMAL;
  shadowMat.depthWrite = false;
  shadowMat.update();
  const shadow = new pc.Entity("anim-shadow");
  shadow.addComponent("render", {
    type: "cylinder",
    material: shadowMat,
    castShadows: false,
    receiveShadows: false,
  });
  shadow.setLocalPosition(0, 0.03, 0);
  shadow.setLocalScale(typeCfg.shadowRadius, 0.03, typeCfg.shadowRadius);
  root.addChild(shadow);

  // Glowing eyes (parented to root wrapper, at fixed height)
  const eyes = attachEyes(app, root, typeCfg, typeCfg.worldHeight);

  // Build animation map
  const animMap = buildAnimMap(container);

  // Animation setup using assignAnimation (same pattern as zombieGlb.js)
  // We register all available clips and pick the Walk/Run/Gallop as the default.
  let animSetupOk = false;
  try {
    if (animMap.size > 0) {
      modelEntity.addComponent("anim", { activate: true });

      // Pick the best default clip (Walk > Run > Gallop > Idle > first available)
      const defaultClip =
        animMap.get("Walk") ??
        animMap.get("Run") ??
        animMap.get("Gallop") ??
        animMap.get("Idle") ??
        animMap.values().next().value;
      const defaultName =
        animMap.has("Walk")   ? "Walk"   :
        animMap.has("Run")    ? "Run"    :
        animMap.has("Gallop") ? "Gallop" :
        animMap.has("Idle")   ? "Idle"   :
        animMap.keys().next().value;

      modelEntity.anim.assignAnimation(defaultName, defaultClip, undefined, 1.0, true);

      // Register all other clips
      for (const [name, track] of animMap.entries()) {
        if (name === defaultName) continue;
        const loop = name !== "Death";
        try {
          modelEntity.anim.assignAnimation(name, track, undefined, 1.0, loop);
        } catch (_) { /* some models may reject duplicate assignment — swallow */ }
      }

      animSetupOk = true;
      modelEntity.anim.playing = true;
    }
  } catch (ex) {
    console.warn("[animalGlb] Anim setup failed:", ex);
  }

  // Log skeleton + clip info once for diagnostics
  const allNodes = [];
  modelEntity.forEach((e) => allNodes.push(e.name));
  console.log(`[animalGlb] ${zombie.type} skeleton (first 20):`, allNodes.slice(0, 20).join(", "));
  console.log(`[animalGlb] ${zombie.type} animMap:`, [...animMap.keys()].join(", "));

  root._glb = {
    valid: true,
    isAnimal: true,
    modelEntity,
    shadow,
    animMap,
    animSetupOk,
    eyes,
    typeCfg,
    currentAnim: null,
    deathFinished: false,
    hitFlashActive: false,
  };

  return root;
}

// ---------------------------------------------------------------------------
// animateAnimalGlbEntity
// ---------------------------------------------------------------------------

/**
 * Drive position/rotation and animation state of a GLB animal zombie entity.
 * Called every frame per live animal zombie, same as animateZombieGlbEntity.
 * @param {pc.Entity} root
 * @param {object}    zombie
 * @param {number}    elapsedSec  (unused currently; reserved for future use)
 */
export function animateAnimalGlbEntity(root, zombie, elapsedSec) {
  const glb = root._glb;
  if (!glb?.valid || !glb.isAnimal) return;

  const { modelEntity, animMap, animSetupOk, typeCfg } = glb;

  const desiredState = selectAnimalAnimState(zombie, animMap);

  // --- Death animation ---
  if (zombie.dead) {
    if (!glb.deathFinished) {
      if (animSetupOk && modelEntity.anim && glb.currentAnim !== "Death" && desiredState === "Death") {
        try {
          modelEntity.anim.baseLayer.play("Death");
          glb.currentAnim = "Death";
          modelEntity.anim.speed = 1.0;
        } catch (_) { /* swallow */ }
      }
      // Detect completion and hold on last frame
      if (animSetupOk && modelEntity.anim && glb.currentAnim === "Death") {
        try {
          const normTime = modelEntity.anim.baseLayer.normalizedTime ?? 0;
          if (normTime >= 0.97) {
            modelEntity.anim.speed = 0;
            glb.deathFinished = true;
          }
        } catch (_) { /* swallow */ }
      }
    }
    // Force-clear hit flash on death
    if (glb.hitFlashActive) {
      glb.hitFlashActive = false;
      applyAnimalHitFlash(glb, false);
    }
    return;
  }

  // --- Living animal animation ---
  if (desiredState && desiredState !== glb.currentAnim && animSetupOk && modelEntity.anim) {
    try {
      if (animMap.has(desiredState)) {
        modelEntity.anim.baseLayer.play(desiredState);
        glb.currentAnim = desiredState;
      }
    } catch (_) { /* swallow */ }
  }

  // Animation speed: scale by zombie speed relative to reference clip tempos.
  // Walk reference: 1.4 m/s; Run/Gallop reference: 3.0 m/s.
  if (animSetupOk && modelEntity.anim) {
    try {
      const speedMps = zombie.speedMps ?? 1.4;
      const isRunClip = glb.currentAnim === "Run" || glb.currentAnim === "Gallop";
      const baseRef = isRunClip ? 3.0 : 1.4;
      const animSpeed = Math.max(0.3, Math.min(3.0, speedMps / baseRef));
      modelEntity.anim.speed = animSpeed;
    } catch (_) { /* swallow */ }
  }

  // --- Hit flash ---
  const hitFlash = (zombie.hitFlashSec ?? 0) > 0;
  if (hitFlash !== glb.hitFlashActive) {
    glb.hitFlashActive = hitFlash;
    applyAnimalHitFlash(glb, hitFlash);
  }
}

// ---------------------------------------------------------------------------
// Hit flash — tint mesh instances emissive red briefly
// ---------------------------------------------------------------------------

/**
 * Apply or remove hit flash emissive tint on animal GLB mesh instances.
 * Materials were already cloned during undead-tint pass, so safe to mutate.
 */
function applyAnimalHitFlash(glb, hitFlash) {
  const { modelEntity } = glb;
  if (!modelEntity) return;

  const renders = modelEntity.findComponents("render");
  for (const render of renders) {
    for (const mi of render.meshInstances) {
      const mat = mi.material;
      if (!mat) continue;
      if (hitFlash) {
        if (!mat._animalOrigEmissive) {
          mat._animalOrigEmissive = mat.emissive?.clone() ?? new pc.Color(0, 0, 0);
          mat._animalOrigEmissiveIntensity = mat.emissiveIntensity ?? 1;
        }
        mat.emissive = new pc.Color(0.9, 0.05, 0.05);
        mat.emissiveIntensity = 3.0;
      } else {
        if (mat._animalOrigEmissive) {
          mat.emissive = mat._animalOrigEmissive;
          mat.emissiveIntensity = mat._animalOrigEmissiveIntensity;
        }
      }
      mat.update();
    }
  }
}
