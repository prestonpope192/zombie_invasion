/**
 * villagerGlb.js — skinned GLB villagers using Quaternius CC0 models.
 *
 * Exports:
 *   loadVillagerGlbContainers(app)                → Promise<{man, woman}>
 *   createVillagerGlbEntity(app, villager, containers) → pc.Entity (root)
 *   animateVillagerGlbEntity(root, villager)
 *
 * Rules:
 *   - NO PlayCanvas API calls at module-import time.
 *   - Must NOT be imported by sliceSimulation.js (browser-only).
 *   - Graceful fallback on any load or runtime error.
 *   - Two models: villager-man-quaternius.glb / villager-woman-quaternius.glb
 *   - Alternate man/woman by villager id hash for variety.
 */

import * as pc from "playcanvas";

// ---------------------------------------------------------------------------
// Module-level container cache (loaded once per session)
// ---------------------------------------------------------------------------

let _manAsset = null;
let _womanAsset = null;
let _loadPromise = null;

/**
 * Load (once) both villager GLB container assets.
 * Resolves with { man: Asset|null, woman: Asset|null }.
 * Each model resolves null on failure; the other continues.
 * @param {pc.Application} app
 * @returns {Promise<{man: pc.Asset|null, woman: pc.Asset|null}>}
 */
export function loadVillagerGlbContainers(app) {
  if (_loadPromise) return _loadPromise;
  if (_manAsset !== null || _womanAsset !== null) {
    return Promise.resolve({ man: _manAsset, woman: _womanAsset });
  }

  function loadOne(url) {
    return new Promise((resolve) => {
      try {
        app.assets.loadFromUrl(url, "container", (err, asset) => {
          if (err || !asset) {
            console.warn("[villagerGlb] Failed to load:", url, err);
            resolve(null);
          } else {
            const names = (asset.resource?.animations ?? []).map((a) => {
              const track = a.resource;
              const raw = track?.name ?? a.name ?? "?";
              return raw.includes("|") ? raw.split("|").pop() : raw;
            });
            console.log(`[villagerGlb] Loaded ${url}. Clips:`, names.join(", "));
            resolve(asset);
          }
        });
      } catch (ex) {
        console.warn("[villagerGlb] Exception loading:", url, ex);
        resolve(null);
      }
    });
  }

  _loadPromise = Promise.all([
    loadOne("/models/villager-man-quaternius.glb"),
    loadOne("/models/villager-woman-quaternius.glb"),
  ]).then(([man, woman]) => {
    _manAsset = man;
    _womanAsset = woman;
    return { man, woman };
  });

  return _loadPromise;
}

// ---------------------------------------------------------------------------
// Villager gender assignment — alternate by id hash for variety
// ---------------------------------------------------------------------------

/**
 * Return true if this villager should use the woman model.
 * Simple hash: sum char codes of id, use parity.
 * @param {string} id
 */
function isWoman(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash += id.charCodeAt(i);
  return hash % 2 === 0;
}

// ---------------------------------------------------------------------------
// Build animation name map from container.
// Priority: track.name (AnimTrack resource name), then bare fallback.
// Strip "<anything>|" prefix — both models use prefixed clip names.
// ---------------------------------------------------------------------------

function buildAnimMap(container) {
  const map = new Map();
  const animations = container.resource?.animations ?? [];
  for (const animAsset of animations) {
    const track = animAsset.resource;
    if (!track) continue;
    // Prefer track.name (actual clip name) over animAsset.name (path key)
    const raw = track.name ?? animAsset.name ?? "";
    // Strip prefix like "Human Armature|" or "CharacterArmature|"
    const bareName = raw.includes("|") ? raw.split("|").pop() : raw;
    if (bareName && !map.has(bareName)) {
      map.set(bareName, track);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Warm tint — Quaternius atlas; villagers read WARMER than zombies.
// Keep more original colour; add warm emissive lift for night visibility.
// ---------------------------------------------------------------------------

/**
 * Apply a warm night tint to all render components on the GLB entity.
 * Clones materials so the shared atlas is never mutated.
 * Phong path (useMetalness=false) avoids the atlas PBR channel misread.
 * @param {pc.Entity} modelEntity
 */
function applyWarmTint(modelEntity) {
  const renders = modelEntity.findComponents("render");
  for (const render of renders) {
    for (const mi of render.meshInstances) {
      const orig = mi.material;
      if (!orig) continue;
      const cloned = orig.clone();

      // Diffuse: warm earthy tone — keeps more original palette than zombie
      // Zombie uses 0.25,0.30,0.18 (dark olive). Villagers: 0.72,0.60,0.45
      // (warm wheat) so they read as friendly humans vs undead corpses.
      cloned.diffuse = new pc.Color(0.72, 0.60, 0.45);

      // Emissive lift: warm orange-amber — makes them readable at night
      // without looking self-lit. Slightly stronger than zombies (0.06,0.09,0.04)
      // because we want players to see their escort clearly.
      cloned.emissive = new pc.Color(0.18, 0.12, 0.06);
      cloned.emissiveIntensity = 1.2;

      // Matte Phong — same as zombie to avoid atlas PBR artefacts
      cloned.useMetalness = false;
      cloned.shininess = 8;
      cloned.specular = new pc.Color(0.04, 0.03, 0.02);
      cloned.gloss = 0.06;

      cloned.update();
      mi.material = cloned;
    }
  }
}

// ---------------------------------------------------------------------------
// createVillagerGlbEntity
// ---------------------------------------------------------------------------

/**
 * Create a GLB-based villager entity.
 * @param {pc.Application} app
 * @param {object}         villager   — sim villager object (must have .id, .state)
 * @param {{man: pc.Asset|null, woman: pc.Asset|null}} containers
 * @returns {pc.Entity} root entity
 */
export function createVillagerGlbEntity(app, villager, containers) {
  const useWoman = isWoman(villager.id);
  const container = useWoman ? containers.woman : containers.man;

  if (!container) {
    // Both models unavailable — return a minimal root so caller can fallback
    const stub = new pc.Entity(`vlg-glb-stub-${villager.id}`);
    app.root.addChild(stub);
    stub._glb = { valid: false };
    return stub;
  }

  // Wrapper root — at ground level
  const root = new pc.Entity(`vlg-glb-${villager.id}`);
  app.root.addChild(root);

  // Instantiate the skinned render entity from the container
  let modelEntity;
  try {
    modelEntity = container.resource.instantiateRenderEntity({
      castShadows: true,
      receiveShadows: true,
    });
  } catch (ex) {
    console.warn("[villagerGlb] instantiateRenderEntity failed:", ex);
    root._glb = { valid: false };
    return root;
  }

  // Scale calibration: target ~1.65u standing height.
  // Quaternius models are Blender cm exports — AABB at scale=1 measured at ~1.52u.
  // Required scale = 1.65 / 1.519 ≈ 1.086.
  // Women model measured similarly; single constant works for both.
  // FOOT_OFFSET aligns feet to y=0 (measured foot-to-ground gap at scale=1: ~0.185u,
  // same as zombie since same Blender export convention).
  const BASE_SCALE  = 1.086;
  const FOOT_OFFSET = 0.17; // world units — lifts feet to ground plane

  modelEntity.setLocalScale(BASE_SCALE, BASE_SCALE, BASE_SCALE);
  modelEntity.setLocalPosition(0, FOOT_OFFSET, 0);
  root.addChild(modelEntity);

  // Warm tint (Phong matte)
  applyWarmTint(modelEntity);

  // Blob shadow (flat disc, same as zombie and primitive villager)
  const shadowMat = new pc.StandardMaterial();
  shadowMat.diffuse = new pc.Color(0.04, 0.04, 0.05);
  shadowMat.opacity = 0.45;
  shadowMat.blendType = pc.BLEND_NORMAL;
  shadowMat.depthWrite = false;
  shadowMat.update();
  const shadow = new pc.Entity("vlg-shadow");
  shadow.addComponent("render", {
    type: "cylinder",
    material: shadowMat,
    castShadows: false,
    receiveShadows: false,
  });
  shadow.setLocalPosition(0, 0.03, 0);
  shadow.setLocalScale(0.55, 0.03, 0.55);
  root.addChild(shadow);

  // Build animation map
  const animMap = buildAnimMap(container);

  // Log skeleton + clip info once for diagnostics
  const allNodes = [];
  modelEntity.forEach((e) => allNodes.push(e.name));
  console.log(`[villagerGlb] ${useWoman ? "woman" : "man"} skeleton:`, allNodes.slice(0, 20).join(", "));
  console.log(`[villagerGlb] ${useWoman ? "woman" : "man"} animMap:`, [...animMap.keys()].join(", "));

  // Animation setup using assignAnimation (same pattern as zombieGlb.js)
  // Priority order: Walk first (becomes default state), then Idle, Run, Death
  const ANIM_PRIORITY = ["Walk", "Idle", "Run", "Death", "Idle_Neutral"];

  let animSetupOk = false;
  try {
    if (animMap.size > 0) {
      modelEntity.addComponent("anim", { activate: true });

      // Assign Walk (or best available) as the default state
      const walkTrack = animMap.get("Walk") ?? animMap.values().next().value;
      modelEntity.anim.assignAnimation("Walk", walkTrack, undefined, 1.0, true);

      for (const stateName of ANIM_PRIORITY) {
        if (stateName === "Walk") continue;
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
    console.warn("[villagerGlb] Anim setup failed:", ex);
  }

  // Health bar — parented to root, sits above the GLB head at ~1.85u
  // (same offsets as primitive createVillagerEntity but y lifted to ~1.85u
  //  so it clears the villager's head; primitive head is at 1.58u, GLB is taller)
  const healthRoot = new pc.Entity(`${villager.id}-vlg-health`);
  root.addChild(healthRoot);
  healthRoot.enabled = false;

  // Health bar background (dark, slightly behind fill)
  const healthBackMat = new pc.StandardMaterial();
  healthBackMat.diffuse = new pc.Color(0.18, 0.06, 0.04);
  healthBackMat.emissive = new pc.Color(0.08, 0.02, 0.01);
  healthBackMat.emissiveIntensity = 1.0;
  healthBackMat.useMetalness = false;
  healthBackMat.shininess = 2;
  healthBackMat.update();
  const healthBack = new pc.Entity(`${villager.id}-vlg-hbar-back`);
  healthBack.addComponent("render", {
    type: "box",
    material: healthBackMat,
    castShadows: false,
    receiveShadows: false,
  });
  healthBack.setLocalPosition(0, 1.92, -0.045);
  healthBack.setLocalScale(0.94, 0.07, 0.04);
  healthRoot.addChild(healthBack);

  // Health fill (green)
  const healthFillMat = new pc.StandardMaterial();
  healthFillMat.diffuse = new pc.Color(0.1, 0.7, 0.1);
  healthFillMat.emissive = new pc.Color(0.04, 0.32, 0.04);
  healthFillMat.emissiveIntensity = 1.2;
  healthFillMat.useMetalness = false;
  healthFillMat.shininess = 2;
  healthFillMat.update();
  const healthFill = new pc.Entity(`${villager.id}-vlg-hbar-fill`);
  healthFill.addComponent("render", {
    type: "box",
    material: healthFillMat,
    castShadows: false,
    receiveShadows: false,
  });
  healthFill.setLocalPosition(0, 1.92, -0.04);
  healthFill.setLocalScale(0.86, 0.05, 0.035);
  healthRoot.addChild(healthFill);

  root._healthRoot = healthRoot;
  root._healthFill = healthFill;

  root._glb = {
    valid: true,
    modelEntity,
    shadow,
    animMap,
    animSetupOk,
    currentAnim: "Walk",
    useWoman,
  };

  return root;
}

// ---------------------------------------------------------------------------
// animateVillagerGlbEntity
// ---------------------------------------------------------------------------

/**
 * Drive animation state of a GLB villager entity.
 * State: escorting → Walk (always, since escort speed ~4.8 m/s maps to Walk clip well)
 *         idle → Idle
 * Dead/rescued is handled by entity.enabled in main.js updateVillagers.
 * @param {pc.Entity} root
 * @param {object}    villager
 */
export function animateVillagerGlbEntity(root, villager) {
  const glb = root._glb;
  if (!glb?.valid) return;

  const { modelEntity, animMap, animSetupOk } = glb;

  // Select animation based on villager state
  let desiredState;
  if (villager.state === "escorting") {
    desiredState = "Walk";
  } else {
    // idle or any other visible state → Idle
    desiredState = animMap.has("Idle") ? "Idle" : "Walk";
  }

  // Switch state if changed
  if (animSetupOk && modelEntity?.anim && desiredState !== glb.currentAnim) {
    try {
      if (animMap.has(desiredState)) {
        modelEntity.anim.baseLayer.play(desiredState);
        glb.currentAnim = desiredState;
      }
    } catch (_) { /* swallow — never crash the sim */ }
  }

  // Set animation speed:
  // Escorting: escort moves at 4.8 m/s; Walk clip reference ~1.4 m/s.
  // Drive at speed ratio so leg cadence roughly matches movement, capped to look natural.
  // Idle: fixed 0.9 (slightly slower for a calm sway)
  if (animSetupOk && modelEntity?.anim) {
    try {
      const animSpeed = villager.state === "escorting" ? 1.4 : 0.9;
      modelEntity.anim.speed = animSpeed;
    } catch (_) { /* ignore */ }
  }
}
