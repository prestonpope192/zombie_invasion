/**
 * zombieRig.js — articulated low-poly humanoid zombie visuals for the PlayCanvas route.
 *
 * Exports:
 *   createZombieRig(app, materials, zombie)  → pc.Entity (root)
 *   animateZombieRig(root, zombie, elapsedSec)
 *
 * Rules:
 *   - NO PlayCanvas API calls at module-import time (only inside functions).
 *   - This file may import 'playcanvas' because it is only ever imported by
 *     main.js (browser / PlayCanvas runtime). It must NOT be imported by
 *     sliceSimulation.js, which runs in node.
 *   - ≤16 render entities + 1 light per zombie.
 */

import * as pc from "playcanvas";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Stable hash of a string → 0..1 float */
function idHash(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  }
  return (h >>> 0) / 0xffffffff;
}

/** Pick shirt material key for a zombie id (3 variants). */
function shirtKey(id) {
  const v = idHash(id) * 3;
  if (v < 1) return "zombieShirtRed";
  if (v < 2) return "zombieShirtOlive";
  return "zombieShirtGrey";
}

/** Pick per-zombie phase offset (0..2π) to desync animations. */
function phaseOffset(id) {
  return idHash(id) * Math.PI * 2;
}

// ---------------------------------------------------------------------------
// Primitive builder (mirrors main.js addPrimitive, but standalone)
// ---------------------------------------------------------------------------
function prim(app, materials, name, type, parent, pos, scale, matKey, eulerAngles) {
  const entity = new pc.Entity(name);
  entity.addComponent("render", {
    type,
    material: materials.get(matKey),
    castShadows: true,
    receiveShadows: true,
  });
  entity.setLocalPosition(pos[0], pos[1], pos[2]);
  entity.setLocalScale(scale[0], scale[1], scale[2]);
  if (eulerAngles) entity.setLocalEulerAngles(eulerAngles[0], eulerAngles[1], eulerAngles[2]);
  parent.addChild(entity);
  return entity;
}

/** Plain pivot entity (no render component), used as joint. */
function pivot(name, parent, pos, eulerAngles) {
  const entity = new pc.Entity(name);
  entity.setLocalPosition(pos[0], pos[1], pos[2]);
  if (eulerAngles) entity.setLocalEulerAngles(eulerAngles[0], eulerAngles[1], eulerAngles[2]);
  parent.addChild(entity);
  return entity;
}

// ---------------------------------------------------------------------------
// createZombieRig
// ---------------------------------------------------------------------------

/**
 * Build an articulated low-poly humanoid zombie rig.
 *
 * Anatomy (Y-up, zombie faces -Z by default):
 *
 *   root (pivot at ground level)
 *   ├── shadow (cylinder, flat on ground)
 *   ├── pelvis (box) — low waist
 *   ├── torso (box, pitched forward) — sits above pelvis
 *   │   ├── head (box)
 *   │   │   ├── jaw (box, small offset)
 *   │   │   ├── eye-l (sphere, emissive)
 *   │   │   └── eye-r (sphere, emissive)
 *   │   ├── shoulder-l (pivot)
 *   │   │   ├── upperarm-l (box)
 *   │   │   └── elbow-l (pivot)
 *   │   │       ├── forearm-l (box, skin)
 *   │   │       └── hand-l (box, skin)
 *   │   └── shoulder-r (pivot)
 *   │       ├── upperarm-r (box)
 *   │       └── elbow-r (pivot)
 *   │           ├── forearm-r (box, skin)
 *   │           └── hand-r (box, skin)
 *   ├── hip-l (pivot)
 *   │   ├── thigh-l (box, pants)
 *   │   └── knee-l (pivot)
 *   │       ├── shin-l (box, pants)
 *   │       └── foot-l (box, dark)
 *   └── hip-r (pivot)
 *       ├── thigh-r (box, pants)
 *       └── knee-r (pivot)
 *           ├── shin-r (box, pants)
 *           └── foot-r (box, dark)
 *
 * Total render entities: shadow(1) + pelvis(1) + torso(1) + head(1) + jaw(1) +
 *   eye-l(1) + eye-r(1) + upperarm×2(2) + forearm×2(2) + hand×2(2) +
 *   thigh×2(2) + shin×2(2) + foot×2(2) = 19
 *
 * Over budget by 3 — we drop jaw, hands, and use one foot per leg (reuse shin
 * extended) to reach 16: shadow, pelvis, torso, head, eye-l, eye-r,
 * upperarm×2, forearm×2, thigh×2, shin×2, foot×2 = 16. ✓
 */
export function createZombieRig(app, materials, zombie) {
  const id = zombie.id;
  const isRunner = zombie.type === "runner" || zombie.type === "skitter" || zombie.type === "pouncer";
  const isMega = zombie.type === "mega_zombie" || zombie.type === "juggernaut";
  const isBoss = zombie.type === "secret_boss" || zombie.type === "mini_boss";
  const isBrute = isMega || isBoss || zombie.type === "brute" || zombie.type === "armored";
  const isCrawler = zombie.type === "crawler" || zombie.type.includes("chicken") || zombie.type.includes("pig");

  // Scale factors
  const hS = isBoss ? 1.8 : isMega ? 1.55 : isCrawler ? 0.66 : isRunner ? 1.1 : isBrute ? 1.32 : 1.0;
  const wS = isBoss ? 1.55 : isMega ? 1.42 : isCrawler ? 0.9 : isRunner ? 0.82 : isBrute ? 1.28 : 1.0;

  // Material keys
  const skinMat = isBrute ? "bruteFlesh" : isRunner ? "runnerFlesh" : "zombieFlesh";
  const shirtMat = shirtKey(id);
  const pantsMat = "zombiePants";
  const footMat = "zombieBoots";
  const eyeMat = "zombieEye";

  // How much the torso tilts forward (hunched):
  // Point 1: normal zombie 28°, runner 34°, brute 20° — clearly shambling from 10m
  const torsoLean = isCrawler ? 82 : isRunner ? 34 : isBrute ? 20 : 28;

  // Point 1: head/neck jut — translates head pivot forward relative to torso
  const headJutZ = isCrawler ? 0 : isRunner ? -0.17 : -0.14;

  // Point 2: per-zombie asymmetry for arm angle (8-15° range)
  const hash = idHash(id);
  const armAsymmetry = 8 + hash * 7; // 8–15 degrees
  const armAsymSign = hash > 0.5 ? 1 : -1; // which arm is higher

  // Root pivot at ground
  const root = new pc.Entity(`entity-${id}`);
  app.root.addChild(root);

  // Ground shadow
  prim(app, materials, `${id}-shadow`, "cylinder", root,
    [0, 0.04, 0],
    [0.88 * wS, 0.03, 0.88 * wS],
    "road");

  // ---- PELVIS ----
  const pelvisY = 0.58 * hS;
  const pelvisH = 0.24 * hS;
  const pelvisW = 0.46 * wS;
  prim(app, materials, `${id}-pelvis`, "box", root,
    [0, pelvisY, 0],
    [pelvisW, pelvisH, pelvisW * 0.72],
    pantsMat);

  // ---- TORSO pivot (sits on top of pelvis) ----
  const torsoBaseY = pelvisY + pelvisH * 0.5;
  const torsoPivot = pivot(`${id}-torso-pivot`, root, [0, torsoBaseY, 0], [torsoLean, 0, 0]);

  // Point 5: reduce torso width ~10%
  const torsoH = 0.54 * hS;
  const torsoW = 0.47 * wS; // was 0.52 — ~10% narrower
  // Torso box — in pivot-local space, extends upward
  prim(app, materials, `${id}-torso`, "box", torsoPivot,
    [0, torsoH * 0.5, 0],
    [torsoW, torsoH, torsoW * 0.62],
    shirtMat);

  // ---- HEAD ----
  const headPivotY = torsoH;
  // Point 1 + 3: head pivot jutted forward relative to torso; head narrowed
  const headPivot = pivot(`${id}-head-pivot`, torsoPivot, [0, headPivotY, headJutZ]);
  // Point 3: narrower head (~0.8x width), slightly taller than wide
  const headW = 0.29 * wS; // was 0.36 — ~0.8x
  const headH = 0.36 * hS; // slightly taller than wide
  prim(app, materials, `${id}-head`, "box", headPivot,
    [0, headH * 0.5, 0],
    [headW, headH, headW * 0.92],
    skinMat);

  // Point 3: eyes placed at front face of head, slightly recessed for socket feel.
  // Emissive spheres are larger than before for distance visibility (15m).
  // No extra socket geometry — stays within 16 render entity budget.
  const eyeY = headH * 0.40;
  const eyeX = 0.088 * wS;
  prim(app, materials, `${id}-eye-l`, "sphere", headPivot,
    [-eyeX, eyeY, -headW * 0.52],
    [0.14, 0.14, 0.14],
    eyeMat);
  prim(app, materials, `${id}-eye-r`, "sphere", headPivot,
    [eyeX, eyeY, -headW * 0.52],
    [0.14, 0.14, 0.14],
    eyeMat);

  // Per-zombie omni eye-glow light — modest face/ground tint only; distance
  // readability comes from the emissive eye spheres, not this light. Kept weak
  // so a zombie does not floodlight its own head or nearby zombies.
  const eyeGlow = new pc.Entity(`${id}-eye-glow`);
  eyeGlow.addComponent("light", {
    type: "omni",
    color: new pc.Color(1.0, 0.68, 0.18),
    intensity: 2.2,
    range: 6,
    castShadows: false,
  });
  eyeGlow.setLocalPosition(0, eyeY, -headW * 0.58);
  headPivot.addChild(eyeGlow);

  // ---- ARMS ----
  // Shoulder pivots are at the top of the torso, offset laterally
  const shoulderY = torsoH * 0.86;
  const shoulderX = (torsoW * 0.5 + 0.06) * wS;
  const upperArmH = 0.28 * hS;
  const forearmH = 0.24 * hS;

  // Point 2: BASE arm angles — shoulders pitched forward-down ~45°, elbows bent ~30°
  // Per-zombie asymmetry: one arm raised 8-15° higher using id hash
  const baseShoulderX = isRunner ? 42 : isCrawler ? 70 : 45;
  const baseElbowBend = isRunner ? 25 : isCrawler ? 10 : 30;
  // Left arm is the "higher" arm if armAsymSign > 0, lower otherwise
  const shoulderLX = baseShoulderX + (armAsymSign > 0 ? armAsymmetry : 0);
  const shoulderRX = baseShoulderX + (armAsymSign < 0 ? armAsymmetry : 0);

  // Left arm
  const shoulderL = pivot(`${id}-shoulder-l`, torsoPivot, [-shoulderX, shoulderY, 0], [shoulderLX, 0, -14]);
  prim(app, materials, `${id}-upperarm-l`, "box", shoulderL,
    [0, -upperArmH * 0.5, 0],
    [0.18 * wS, upperArmH, 0.16 * wS],
    shirtMat);
  const elbowL = pivot(`${id}-elbow-l`, shoulderL, [0, -upperArmH, 0], [baseElbowBend, 0, 0]);
  prim(app, materials, `${id}-forearm-l`, "box", elbowL,
    [0, -forearmH * 0.5, 0],
    [0.15 * wS, forearmH, 0.13 * wS],
    skinMat);

  // Right arm
  const shoulderR = pivot(`${id}-shoulder-r`, torsoPivot, [shoulderX, shoulderY, 0], [shoulderRX, 0, 14]);
  prim(app, materials, `${id}-upperarm-r`, "box", shoulderR,
    [0, -upperArmH * 0.5, 0],
    [0.18 * wS, upperArmH, 0.16 * wS],
    shirtMat);
  const elbowR = pivot(`${id}-elbow-r`, shoulderR, [0, -upperArmH, 0], [baseElbowBend, 0, 0]);
  prim(app, materials, `${id}-forearm-r`, "box", elbowR,
    [0, -forearmH * 0.5, 0],
    [0.15 * wS, forearmH, 0.13 * wS],
    skinMat);

  // ---- LEGS ----
  // Point 5: lengthen legs ~10% — raise hip pivot to keep feet grounded
  const thighH = 0.396 * hS; // was 0.36 — ~10% longer
  const shinH = 0.374 * hS;  // was 0.34 — ~10% longer
  const footH = 0.1 * hS;
  // Hip pivot raised so feet stay at y≈0: new total leg = thighH + shinH + footH
  // old total ≈ 0.36+0.34+0.1 = 0.80; new ≈ 0.396+0.374+0.1 = 0.87 → raise hip by ~0.07*hS
  const hipY = pelvisY - pelvisH * 0.4 + (0.07 * hS);
  const hipX = 0.16 * wS;

  // Left leg
  const hipL = pivot(`${id}-hip-l`, root, [-hipX, hipY, 0]);
  prim(app, materials, `${id}-thigh-l`, "box", hipL,
    [0, -thighH * 0.5, 0],
    [0.22 * wS, thighH, 0.20 * wS],
    pantsMat);
  const kneeL = pivot(`${id}-knee-l`, hipL, [0, -thighH, 0], [8, 0, 0]);
  prim(app, materials, `${id}-shin-l`, "box", kneeL,
    [0, -shinH * 0.5, 0],
    [0.19 * wS, shinH, 0.17 * wS],
    pantsMat);
  prim(app, materials, `${id}-foot-l`, "box", kneeL,
    [0, -shinH - footH * 0.5, -0.04],
    [0.19 * wS, footH, 0.26 * wS],
    footMat);

  // Right leg
  const hipR = pivot(`${id}-hip-r`, root, [hipX, hipY, 0]);
  prim(app, materials, `${id}-thigh-r`, "box", hipR,
    [0, -thighH * 0.5, 0],
    [0.22 * wS, thighH, 0.20 * wS],
    pantsMat);
  const kneeR = pivot(`${id}-knee-r`, hipR, [0, -thighH, 0], [8, 0, 0]);
  prim(app, materials, `${id}-shin-r`, "box", kneeR,
    [0, -shinH * 0.5, 0],
    [0.19 * wS, shinH, 0.17 * wS],
    pantsMat);
  prim(app, materials, `${id}-foot-r`, "box", kneeR,
    [0, -shinH - footH * 0.5, -0.04],
    [0.19 * wS, footH, 0.26 * wS],
    footMat);

  // Boss horns (piggyback on torso pivot)
  if (isBoss) {
    const hornScale = [0.14 * wS, 0.44 * hS, 0.14 * wS];
    const hornY = torsoH + headH * 0.9;
    prim(app, materials, `${id}-horn-l`, "cone", torsoPivot,
      [-0.22 * wS, hornY, 0],
      hornScale, "metal", [18, 0, -26]);
    prim(app, materials, `${id}-horn-r`, "cone", torsoPivot,
      [0.22 * wS, hornY, 0],
      hornScale, "metal", [18, 0, 26]);
  }

  // Cache render components for fast material swaps (avoids findComponents every frame)
  const rigRenders = [];
  root.forEach((e) => {
    if (e.render) rigRenders.push(e.render);
  });

  // Store references on root for fast lookup during animation
  root._rig = {
    torsoPivot,
    headPivot,
    shoulderL, elbowL,
    shoulderR, elbowR,
    hipL, kneeL,
    hipR, kneeR,
    baseShoulderX,
    shoulderLX, shoulderRX,
    baseElbowBend,
    torsoLean,
    isRunner, isCrawler, isBrute,
    phaseOff: phaseOffset(id),
    hS, wS,
    armAsymmetry, armAsymSign,
    // Expose shirt key so callers can restore per-part materials
    shirtMatKey: shirtMat,
    skinMat,
    // Cached render components for material swaps
    rigRenders,
  };

  return root;
}

// ---------------------------------------------------------------------------
// animateZombieRig — called every frame
// ---------------------------------------------------------------------------

const DEG = Math.PI / 180;

/**
 * Drive the articulated rig with walk cycle + attack pose.
 * @param {pc.Entity} root     — root returned by createZombieRig
 * @param {object}    zombie   — sim zombie object
 * @param {number}    elapsedSec — game clock
 */
export function animateZombieRig(root, zombie, elapsedSec) {
  const rig = root._rig;
  if (!rig) return;

  const {
    torsoPivot, headPivot,
    shoulderL, elbowL,
    shoulderR, elbowR,
    hipL, kneeL,
    hipR, kneeR,
    shoulderLX, shoulderRX,
    baseElbowBend,
    torsoLean,
    isRunner, isCrawler,
    phaseOff,
  } = rig;

  const t = elapsedSec + phaseOff;
  const speed = zombie.speedMps ?? 1.4;
  const freq = isRunner ? 3.6 : isCrawler ? 2.4 : 1.9 + speed * 0.35;
  const walkPhase = t * freq * Math.PI * 2;

  const isBiting = (zombie.biteCooldownSec ?? 0) > 0 ||
                   zombie.aiState === "attack_player" ||
                   zombie.aiState === "attack_village";

  // --- Torso: upright lean + bob ---
  const torsoSway = Math.sin(walkPhase * 0.5) * (isRunner ? 3 : 1.8);
  const torsoLeanExtra = isBiting ? 14 : 0;
  torsoPivot.setLocalEulerAngles(torsoLean + torsoLeanExtra, 0, torsoSway);

  // --- Head: slight counterbalance bob ---
  headPivot.setLocalEulerAngles(-Math.sin(walkPhase * 0.5) * 4, 0, 0);

  if (isBiting) {
    // Attack: both arms raise and reach forward (lunge from already-forward base)
    const lunge = Math.sin(t * 12) * 18;
    shoulderL.setLocalEulerAngles(-62 + lunge, 0, -16);
    shoulderR.setLocalEulerAngles(-62 - lunge, 0, 16);
    elbowL.setLocalEulerAngles(-28, 0, 0);
    elbowR.setLocalEulerAngles(-28, 0, 0);
  } else {
    // Walk: arms swing opposite phase from their reaching-forward base pose
    const armSwing = Math.sin(walkPhase) * (isRunner ? 28 : 16);
    shoulderL.setLocalEulerAngles(shoulderLX - armSwing, 0, -14);
    shoulderR.setLocalEulerAngles(shoulderRX + armSwing, 0, 14);
    // Elbow: bent at base, opens slightly when arm swings back
    elbowL.setLocalEulerAngles(baseElbowBend + Math.max(0, -armSwing) * 0.4, 0, 0);
    elbowR.setLocalEulerAngles(baseElbowBend + Math.max(0, armSwing) * 0.4, 0, 0);
  }

  // --- Legs: thigh swing opposite phase, slight knee bend ---
  const legSwing = Math.sin(walkPhase) * (isRunner ? 28 : 22);
  const kneeBend = 16 + Math.abs(Math.sin(walkPhase)) * (isRunner ? 20 : 12);

  hipL.setLocalEulerAngles(-legSwing, 0, 0);
  hipR.setLocalEulerAngles(legSwing, 0, 0);
  kneeL.setLocalEulerAngles(kneeBend + legSwing * 0.25, 0, 0);
  kneeR.setLocalEulerAngles(kneeBend - legSwing * 0.25, 0, 0);
}

// ---------------------------------------------------------------------------
// Skin-part tag helpers for hit-flash swaps
// ---------------------------------------------------------------------------

/**
 * Returns all render components on skin parts of the rig.
 * Skin parts are: forearm-*, head, eye-l/r are excluded (keep emissive).
 * Named by convention: any render entity whose name ends with one of the
 * skin suffixes.
 */
const SKIN_SUFFIXES = ["-head", "-forearm-l", "-forearm-r", "-pelvis"];
const SHIRT_SUFFIXES = ["-torso", "-upperarm-l", "-upperarm-r"];
const PANTS_SUFFIXES = ["-thigh-l", "-thigh-r", "-shin-l", "-shin-r"];

/**
 * Apply hit-flash or restore materials to a rig root.
 * @param {pc.Entity} root
 * @param {Map}       materials
 * @param {string}    skinMat     — base skin material key
 * @param {string}    shirtMat    — base shirt material key
 * @param {boolean}   hitFlash    — true = apply zombieHit to all solid parts
 */
export function applyZombieRigMaterials(root, materials, skinMat, shirtMatKey, hitFlash) {
  const hitMat = materials.get("zombieHit");
  // Use cached render components if available (avoids findComponents every frame)
  const renders = root._rig?.rigRenders ?? root.findComponents("render");
  renders.forEach((render) => {
    const name = render.entity.name;
    // Never flash eye spheres (keep emissive glow during hit)
    if (name.endsWith("-eye-l") || name.endsWith("-eye-r")) return;
    if (hitFlash) {
      render.material = hitMat;
      return;
    }
    // Restore per-part material
    if (SKIN_SUFFIXES.some((s) => name.endsWith(s))) {
      render.material = materials.get(skinMat);
    } else if (SHIRT_SUFFIXES.some((s) => name.endsWith(s))) {
      render.material = materials.get(shirtMatKey);
    } else if (PANTS_SUFFIXES.some((s) => name.endsWith(s))) {
      render.material = materials.get("zombiePants");
    } else if (name.endsWith("-foot-l") || name.endsWith("-foot-r")) {
      render.material = materials.get("zombieBoots");
    } else if (name.endsWith("-shadow")) {
      render.material = materials.get("road");
    }
    // horns stay as metal, no change needed
  });
}
