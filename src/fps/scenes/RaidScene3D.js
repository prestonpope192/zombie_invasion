import * as THREE from "three";
import { PlayerControllerFps } from "../systems/playerControllerFps";
import {
  applyPenetration,
  applyRecoilImpulse,
  createProjectile,
  initRecoilState,
  randomSpreadDirection,
  recoverRecoil,
  stepProjectile,
} from "../systems/weaponBallistics";
import { createEnemyState, pickEnemyTypeForWave, stepEnemies, visibleEnemyPayload } from "../systems/enemyAi3D";
import { WaveDirector3D } from "../systems/waveDirector3D";
import { persistFpsSave } from "../systems/saveFps";
import { resolveWeaponSlotSelection } from "../systems/weaponSlots";
import { computeVillageStructureDamage, isVillageStructureHit } from "../systems/villageDamageRules";
import { computeHealthRatio, computeVillageDamageStage } from "../systems/villageFeedback";
import { worldRadiusToMiniMapPx, worldToMiniMapPoint } from "../systems/minimapUtils";
import { computeHeadshotResult, getDefaultHeadshotMultiplier } from "../systems/headshotRules";
import { getVillageLevelHpMultiplier } from "../systems/shopRules";
import {
  addGrenadeCount,
  consumeGrenadeById,
  cycleActiveGrenadeId,
  ensureGrenadeInventory,
  getActiveGrenadeId,
  getGrenadeCount,
  getGrenadeTypeDef,
  getGrenadeTypeIds,
  setActiveGrenadeId,
} from "../systems/grenadeLoadout";
import {
  VILLAGER_PERK_DEFS,
  computeEscortFollowTarget,
  computeEscortDamage,
  getVillagerPerkModifiers,
  isVillagerAvailable,
} from "../systems/villagerEscortRules";

const VILLAGE_HP_BASE = 700;
const FIXED_TICK = 1 / 60;
const BOSS_LANDSCAPE_ZOMBIE_COUNT = 3;
const FINAL_BOSS_LANDSCAPE_ZOMBIE_COUNT = 4;
const GRENADE_COOLDOWN_SEC = 0.35;
const GRENADE_DAMAGE = 120;
const GRENADE_RADIUS = 4.8;
const GRENADE_IMPULSE = 28;
const INTERACT_RANGE = 2.2;
const PIPE_SWING_RANGE = 2.9;
const PIPE_SWING_DOT = 0.08;
const ENEMY_HIT_DAMAGE_PAUSE_SEC = 0.5;
const MINIMAP_WORLD_HALF_EXTENT = 42;
const MINIMAP_PADDING_PX = 10;
const VILLAGE_DAMAGE_AUDIO_COOLDOWN = 0.24;
const VILLAGE_DAMAGE_FLASH_DECAY = 2.5;
const VILLAGE_DAMAGE_RECENT_DECAY = 0.6;
const PLAYER_DAMAGE_FLASH_DECAY = 3.6;
const PLAYER_BITE_INTERVAL_SEC = 0.42;
const PLAYER_BITE_MAX_DAMAGE_PER_PULSE = 9;
const FRONT_SPAWN_X_HALF_EXTENT = 17;
const FRONT_SPAWN_Z_OFFSET_MIN = 8;
const FRONT_SPAWN_Z_OFFSET_MAX = 16;
const FRONT_SPAWN_MIN_PLAYER_DISTANCE = 7.5;
const DISABLED_VILLAGE_POSITION = new THREE.Vector3(9999, 1.2, 9999);
const FRIENDLY_FIRE_VILLAGE_DAMAGE = false;
const ESCORT_HP_BASE = 130;
const ESCORT_ZOMBIE_THREAT_RANGE = 2.2;
const ESCORT_DAMAGE_PER_SEC = 13;
const ESCORT_MAX_ATTACKERS = 3;
const TOWN_HALL_DROPOFF_RADIUS = 3.1;
const HEADSHOT_MULTIPLIER = getDefaultHeadshotMultiplier();
const GAME_PHASE = {
  HOUSE_INTRO: "house_intro",
  DEFENSE: "defense",
  SECRET_BOSS: "secret_boss",
};
const ANIMAL_ZOMBIE_VARIANTS = new Set(["zombie_pig", "zombie_horse", "zombie_cow", "zombie_chicken"]);

function yawFromForward(forward) {
  // In this camera setup, yaw=0 faces toward -Z.
  return Math.atan2(forward.x, -forward.z);
}
const WEAPON_FEEL = {
  pipe: {
    label: "Rusty close-range melee",
    pellets: 1,
    spreadScale: 1,
    adsSpreadScale: 1,
    tracerColor: 0xfff3c4,
    tracerLength: 0.2,
    tracerOpacity: 0,
    tracerTtl: 0.01,
    projectileRadius: 0.01,
    projectileColor: 0xfff2d0,
    flashColor: 0xffd58f,
    flashIntensity: 2.3,
    flashRange: 3.2,
    flashTtl: 0.03,
    cameraPitchKick: 0.0004,
    cameraYawKick: 0.0002,
    knockbackScale: 1.5,
    hitConfirmScale: 1.1,
    impactFxScale: 1.2,
    fireKick: 0.48,
    fireKickDecay: 10.4,
    recoilBackScale: 0.014,
    recoilBackMax: 0.04,
    weaponKickBackScale: 0.03,
    weaponKickBackMax: 0.04,
    kickTiltScale: 0.06,
    kickTiltMax: 0.08,
    bobMoveSpeed: 9.2,
    bobIdleSpeed: 2.8,
    bobScaleX: 0.014,
    bobScaleY: 0.009,
    slideTravel: 0,
    boltTravel: 0,
    pumpTravel: 0,
  },
  pistol: {
    label: "Beretta 92FS duty rhythm",
    pellets: 1,
    spreadScale: 1,
    adsSpreadScale: 0.46,
    tracerColor: 0xfff3c4,
    tracerLength: 2.2,
    tracerOpacity: 0.92,
    tracerTtl: 0.045,
    projectileRadius: 0.033,
    projectileColor: 0xfff2d0,
    flashColor: 0xffc98a,
    flashIntensity: 3.2,
    flashRange: 5.4,
    flashTtl: 0.05,
    cameraPitchKick: 0.0008,
    cameraYawKick: 0.00035,
    knockbackScale: 1,
    hitConfirmScale: 1,
    impactFxScale: 1,
    fireKick: 0.62,
    fireKickDecay: 12.4,
    recoilBackScale: 0.016,
    recoilBackMax: 0.05,
    weaponKickBackScale: 0.038,
    weaponKickBackMax: 0.05,
    kickTiltScale: 0.068,
    kickTiltMax: 0.09,
    bobMoveSpeed: 10.4,
    bobIdleSpeed: 3.6,
    bobScaleX: 0.017,
    bobScaleY: 0.011,
    slideTravel: 0.038,
    boltTravel: 0,
    pumpTravel: 0,
  },
  revolver: {
    label: "Colt Python magnum snap",
    pellets: 1,
    spreadScale: 0.8,
    adsSpreadScale: 0.32,
    tracerColor: 0xffe0b4,
    tracerLength: 2.6,
    tracerOpacity: 0.98,
    tracerTtl: 0.055,
    projectileRadius: 0.036,
    projectileColor: 0xffe3bc,
    flashColor: 0xffbf7a,
    flashIntensity: 4.2,
    flashRange: 6.4,
    flashTtl: 0.06,
    cameraPitchKick: 0.00155,
    cameraYawKick: 0.00045,
    knockbackScale: 1.18,
    hitConfirmScale: 1.14,
    impactFxScale: 1.12,
    fireKick: 0.96,
    fireKickDecay: 7.6,
    recoilBackScale: 0.026,
    recoilBackMax: 0.072,
    weaponKickBackScale: 0.062,
    weaponKickBackMax: 0.075,
    kickTiltScale: 0.108,
    kickTiltMax: 0.13,
    bobMoveSpeed: 8.5,
    bobIdleSpeed: 2.7,
    bobScaleX: 0.015,
    bobScaleY: 0.01,
    slideTravel: 0,
    boltTravel: 0,
    pumpTravel: 0,
  },
  smg: {
    label: "MP5 close-quarters stream",
    pellets: 1,
    spreadScale: 1.35,
    adsSpreadScale: 0.72,
    tracerColor: 0xb8f5ff,
    tracerLength: 1.6,
    tracerOpacity: 0.74,
    tracerTtl: 0.028,
    projectileRadius: 0.028,
    projectileColor: 0xd6fcff,
    flashColor: 0xffd2a6,
    flashIntensity: 2.4,
    flashRange: 4.2,
    flashTtl: 0.032,
    cameraPitchKick: 0.00045,
    cameraYawKick: 0.00065,
    knockbackScale: 0.86,
    hitConfirmScale: 0.92,
    impactFxScale: 0.86,
    fireKick: 0.46,
    fireKickDecay: 15.2,
    recoilBackScale: 0.013,
    recoilBackMax: 0.045,
    weaponKickBackScale: 0.03,
    weaponKickBackMax: 0.042,
    kickTiltScale: 0.062,
    kickTiltMax: 0.088,
    bobMoveSpeed: 13.6,
    bobIdleSpeed: 4.2,
    bobScaleX: 0.02,
    bobScaleY: 0.013,
    slideTravel: 0,
    boltTravel: 0.032,
    pumpTravel: 0,
  },
  machine_pistol: {
    label: "Glock 18C close mag dump",
    pellets: 1,
    spreadScale: 1.55,
    adsSpreadScale: 0.86,
    tracerColor: 0xaff6ff,
    tracerLength: 1.3,
    tracerOpacity: 0.72,
    tracerTtl: 0.022,
    projectileRadius: 0.026,
    projectileColor: 0xd6fcff,
    flashColor: 0xffd3a4,
    flashIntensity: 2.1,
    flashRange: 3.8,
    flashTtl: 0.026,
    cameraPitchKick: 0.00038,
    cameraYawKick: 0.00078,
    knockbackScale: 0.8,
    hitConfirmScale: 0.9,
    impactFxScale: 0.82,
    fireKick: 0.42,
    fireKickDecay: 16.8,
    recoilBackScale: 0.012,
    recoilBackMax: 0.042,
    weaponKickBackScale: 0.028,
    weaponKickBackMax: 0.038,
    kickTiltScale: 0.07,
    kickTiltMax: 0.092,
    bobMoveSpeed: 14.4,
    bobIdleSpeed: 4.5,
    bobScaleX: 0.022,
    bobScaleY: 0.014,
    slideTravel: 0.032,
    boltTravel: 0,
    pumpTravel: 0,
  },
  rifle: {
    label: "AKM stamped-rifle shove",
    pellets: 1,
    spreadScale: 0.82,
    adsSpreadScale: 0.42,
    tracerColor: 0xffe9bc,
    tracerLength: 2.9,
    tracerOpacity: 0.95,
    tracerTtl: 0.055,
    projectileRadius: 0.036,
    projectileColor: 0xffe8be,
    flashColor: 0xffbc6e,
    flashIntensity: 3.8,
    flashRange: 6.8,
    flashTtl: 0.06,
    cameraPitchKick: 0.00115,
    cameraYawKick: 0.00055,
    knockbackScale: 1.18,
    hitConfirmScale: 1.07,
    impactFxScale: 1.08,
    fireKick: 0.6,
    fireKickDecay: 11.2,
    recoilBackScale: 0.02,
    recoilBackMax: 0.058,
    weaponKickBackScale: 0.044,
    weaponKickBackMax: 0.056,
    kickTiltScale: 0.078,
    kickTiltMax: 0.1,
    bobMoveSpeed: 9.8,
    bobIdleSpeed: 3.4,
    bobScaleX: 0.017,
    bobScaleY: 0.011,
    slideTravel: 0,
    boltTravel: 0.034,
    pumpTravel: 0,
  },
  battle_rifle: {
    label: "FN FAL battle-rifle punch",
    pellets: 1,
    spreadScale: 0.68,
    adsSpreadScale: 0.28,
    tracerColor: 0xffe6b6,
    tracerLength: 3.2,
    tracerOpacity: 0.98,
    tracerTtl: 0.065,
    projectileRadius: 0.038,
    projectileColor: 0xffe0b2,
    flashColor: 0xffb26c,
    flashIntensity: 4.6,
    flashRange: 7.6,
    flashTtl: 0.07,
    cameraPitchKick: 0.00185,
    cameraYawKick: 0.00062,
    knockbackScale: 1.28,
    hitConfirmScale: 1.18,
    impactFxScale: 1.16,
    fireKick: 0.88,
    fireKickDecay: 8.4,
    recoilBackScale: 0.026,
    recoilBackMax: 0.072,
    weaponKickBackScale: 0.058,
    weaponKickBackMax: 0.07,
    kickTiltScale: 0.11,
    kickTiltMax: 0.14,
    bobMoveSpeed: 8.7,
    bobIdleSpeed: 3,
    bobScaleX: 0.016,
    bobScaleY: 0.01,
    slideTravel: 0,
    boltTravel: 0.04,
    pumpTravel: 0,
  },
  shotgun: {
    label: "870 room-clear blast",
    pellets: 12,
    spreadScale: 1.15,
    adsSpreadScale: 0.82,
    tracerColor: 0xffd2a0,
    tracerLength: 1.25,
    tracerOpacity: 0.64,
    tracerTtl: 0.05,
    projectileRadius: 0.045,
    projectileColor: 0xffdcb0,
    flashColor: 0xffaf62,
    flashIntensity: 5.8,
    flashRange: 8.3,
    flashTtl: 0.07,
    cameraPitchKick: 0.00195,
    cameraYawKick: 0.0009,
    knockbackScale: 1.55,
    hitConfirmScale: 1.2,
    impactFxScale: 1.42,
    fireKick: 1.18,
    fireKickDecay: 6.4,
    recoilBackScale: 0.03,
    recoilBackMax: 0.08,
    weaponKickBackScale: 0.072,
    weaponKickBackMax: 0.085,
    kickTiltScale: 0.124,
    kickTiltMax: 0.16,
    bobMoveSpeed: 7.8,
    bobIdleSpeed: 2.6,
    bobScaleX: 0.014,
    bobScaleY: 0.009,
    slideTravel: 0,
    boltTravel: 0,
    pumpTravel: 0.125,
  },
  lmg: {
    label: "M249 suppression stream",
    pellets: 1,
    spreadScale: 1.12,
    adsSpreadScale: 0.62,
    tracerColor: 0xffefc0,
    tracerLength: 2.4,
    tracerOpacity: 0.86,
    tracerTtl: 0.042,
    projectileRadius: 0.034,
    projectileColor: 0xffefc8,
    flashColor: 0xffc17b,
    flashIntensity: 3.4,
    flashRange: 6.2,
    flashTtl: 0.045,
    cameraPitchKick: 0.00072,
    cameraYawKick: 0.00056,
    knockbackScale: 1.04,
    hitConfirmScale: 1.02,
    impactFxScale: 1.03,
    fireKick: 0.7,
    fireKickDecay: 8.8,
    recoilBackScale: 0.02,
    recoilBackMax: 0.06,
    weaponKickBackScale: 0.052,
    weaponKickBackMax: 0.064,
    kickTiltScale: 0.084,
    kickTiltMax: 0.11,
    bobMoveSpeed: 9.1,
    bobIdleSpeed: 3.2,
    bobScaleX: 0.015,
    bobScaleY: 0.01,
    slideTravel: 0,
    boltTravel: 0.05,
    pumpTravel: 0,
  },
  dmr: {
    label: "Mk 14 EBR precision thump",
    pellets: 1,
    spreadScale: 0.55,
    adsSpreadScale: 0.24,
    tracerColor: 0xc4ebff,
    tracerLength: 3.8,
    tracerOpacity: 1,
    tracerTtl: 0.08,
    projectileRadius: 0.038,
    projectileColor: 0xc9ecff,
    flashColor: 0xffb67a,
    flashIntensity: 4.9,
    flashRange: 7.8,
    flashTtl: 0.08,
    cameraPitchKick: 0.0024,
    cameraYawKick: 0.00065,
    knockbackScale: 1.45,
    hitConfirmScale: 1.3,
    impactFxScale: 1.3,
    fireKick: 0.84,
    fireKickDecay: 8,
    recoilBackScale: 0.024,
    recoilBackMax: 0.066,
    weaponKickBackScale: 0.056,
    weaponKickBackMax: 0.068,
    kickTiltScale: 0.096,
    kickTiltMax: 0.128,
    bobMoveSpeed: 8.6,
    bobIdleSpeed: 2.8,
    bobScaleX: 0.014,
    bobScaleY: 0.009,
    slideTravel: 0,
    boltTravel: 0.04,
    pumpTravel: 0,
  },
  sniper: {
    label: "M24 long-range hammer",
    pellets: 1,
    spreadScale: 0.36,
    adsSpreadScale: 0.16,
    tracerColor: 0xd8f2ff,
    tracerLength: 4.6,
    tracerOpacity: 1,
    tracerTtl: 0.11,
    projectileRadius: 0.04,
    projectileColor: 0xd7f1ff,
    flashColor: 0xffc084,
    flashIntensity: 5.5,
    flashRange: 8.8,
    flashTtl: 0.09,
    cameraPitchKick: 0.0028,
    cameraYawKick: 0.00052,
    knockbackScale: 1.6,
    hitConfirmScale: 1.42,
    impactFxScale: 1.45,
    fireKick: 1.12,
    fireKickDecay: 5.8,
    recoilBackScale: 0.03,
    recoilBackMax: 0.085,
    weaponKickBackScale: 0.078,
    weaponKickBackMax: 0.095,
    kickTiltScale: 0.13,
    kickTiltMax: 0.17,
    bobMoveSpeed: 7.6,
    bobIdleSpeed: 2.4,
    bobScaleX: 0.012,
    bobScaleY: 0.008,
    slideTravel: 0,
    boltTravel: 0.052,
    pumpTravel: 0,
  },
  rpg: {
    label: "RPG-7 backblast punch",
    pellets: 1,
    spreadScale: 1,
    adsSpreadScale: 0.55,
    tracerColor: 0xff8b66,
    tracerLength: 4.8,
    tracerOpacity: 1,
    tracerTtl: 0.1,
    projectileRadius: 0.12,
    projectileColor: 0xff925e,
    flashColor: 0xff9458,
    flashIntensity: 7.5,
    flashRange: 10.8,
    flashTtl: 0.09,
    cameraPitchKick: 0.0036,
    cameraYawKick: 0.0012,
    knockbackScale: 1.9,
    hitConfirmScale: 1.4,
    impactFxScale: 1.65,
    fireKick: 1.2,
    fireKickDecay: 4.8,
    recoilBackScale: 0.032,
    recoilBackMax: 0.09,
    weaponKickBackScale: 0.082,
    weaponKickBackMax: 0.1,
    kickTiltScale: 0.14,
    kickTiltMax: 0.18,
    bobMoveSpeed: 6.8,
    bobIdleSpeed: 2.2,
    bobScaleX: 0.011,
    bobScaleY: 0.007,
    slideTravel: 0,
    boltTravel: 0,
    pumpTravel: 0,
  },
  grenade_launcher: {
    label: "M79 arcing HE lob",
    pellets: 1,
    spreadScale: 0.78,
    adsSpreadScale: 0.4,
    tracerColor: 0xffb283,
    tracerLength: 3.4,
    tracerOpacity: 0.96,
    tracerTtl: 0.08,
    projectileRadius: 0.09,
    projectileColor: 0xffa16b,
    flashColor: 0xff9d63,
    flashIntensity: 5.2,
    flashRange: 7.4,
    flashTtl: 0.08,
    cameraPitchKick: 0.0022,
    cameraYawKick: 0.00085,
    knockbackScale: 1.34,
    hitConfirmScale: 1.28,
    impactFxScale: 1.5,
    fireKick: 0.96,
    fireKickDecay: 6.2,
    recoilBackScale: 0.028,
    recoilBackMax: 0.075,
    weaponKickBackScale: 0.068,
    weaponKickBackMax: 0.082,
    kickTiltScale: 0.108,
    kickTiltMax: 0.14,
    bobMoveSpeed: 7.4,
    bobIdleSpeed: 2.5,
    bobScaleX: 0.012,
    bobScaleY: 0.008,
    slideTravel: 0,
    boltTravel: 0,
    pumpTravel: 0,
  },
  flamethrower: {
    label: "M2 long-burn sweep",
    pellets: 4,
    spreadScale: 1.45,
    adsSpreadScale: 0.92,
    tracerColor: 0xffb45c,
    tracerLength: 3.8,
    tracerOpacity: 0.68,
    tracerTtl: 0.07,
    projectileRadius: 0.055,
    projectileColor: 0xff8f42,
    flashColor: 0xffb866,
    flashIntensity: 2.8,
    flashRange: 5.8,
    flashTtl: 0.07,
    cameraPitchKick: 0.00022,
    cameraYawKick: 0.00018,
    knockbackScale: 0.72,
    hitConfirmScale: 0.96,
    impactFxScale: 0.9,
    fireKick: 0.36,
    fireKickDecay: 18,
    recoilBackScale: 0.011,
    recoilBackMax: 0.036,
    weaponKickBackScale: 0.024,
    weaponKickBackMax: 0.03,
    kickTiltScale: 0.046,
    kickTiltMax: 0.06,
    bobMoveSpeed: 11.8,
    bobIdleSpeed: 4.4,
    bobScaleX: 0.018,
    bobScaleY: 0.012,
    slideTravel: 0,
    boltTravel: 0,
    pumpTravel: 0,
  },
};

function getWeaponFeel(weaponId) {
  return WEAPON_FEEL[weaponId] ?? WEAPON_FEEL.pistol;
}

function vec3From(raw, fallback = { x: 0, y: 0, z: 0 }) {
  const src = raw && typeof raw === "object" ? raw : fallback;
  return new THREE.Vector3(Number(src.x ?? 0), Number(src.y ?? 0), Number(src.z ?? 0));
}

function shiftColor(color, h = 0, s = 0, l = 0) {
  const next = new THREE.Color(color);
  next.offsetHSL(h, s, l);
  return next;
}

function makeCreatureMaterial({
  color,
  roughness = 0.84,
  metalness = 0.03,
  emissive = 0x000000,
  emissiveIntensity = 0,
  opacity = 1,
  transparent = opacity < 1,
  side = THREE.FrontSide,
}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    emissive,
    emissiveIntensity,
    opacity,
    transparent,
    side,
  });
}

function addSpherePart(parent, material, position, scaleVec, segments = 18) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, segments, Math.max(12, Math.floor(segments * 0.72))),
    material,
  );
  mesh.position.copy(position);
  mesh.scale.copy(scaleVec);
  parent.add(mesh);
  return mesh;
}

function addCapsulePart(parent, material, position, radius, length, rotation = null, scaleVec = null) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, Math.max(0.001, length), 8, 12), material);
  mesh.position.copy(position);
  if (rotation) {
    mesh.rotation.set(rotation.x ?? 0, rotation.y ?? 0, rotation.z ?? 0);
  }
  if (scaleVec) {
    mesh.scale.copy(scaleVec);
  }
  parent.add(mesh);
  return mesh;
}

function addConePart(parent, material, position, radius, height, rotation = null, radialSegments = 7) {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, height, radialSegments), material);
  mesh.position.copy(position);
  if (rotation) {
    mesh.rotation.set(rotation.x ?? 0, rotation.y ?? 0, rotation.z ?? 0);
  }
  parent.add(mesh);
  return mesh;
}

function addCylinderPart(parent, material, position, radiusTop, radiusBottom, height, rotation = null, radialSegments = 8) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments), material);
  mesh.position.copy(position);
  if (rotation) {
    mesh.rotation.set(rotation.x ?? 0, rotation.y ?? 0, rotation.z ?? 0);
  }
  parent.add(mesh);
  return mesh;
}

function makeZombieAnimalMesh(scale = 1, variant = "zombie_pig", palette = null) {
  const profileByVariant = {
    zombie_pig: {
      bodySize: [0.56, 0.34, 0.84],
      headSize: [0.34, 0.26, 0.38],
      shoulderY: 0.7,
      frontZ: 0.26,
      rearZ: -0.28,
      upperLegLen: 0.22,
      lowerLegLen: 0.2,
      hoofSize: [0.1, 0.05, 0.11],
      neckOffset: [0, 0.08, 0.44],
      snoutSize: [0.19, 0.14, 0.2],
      earSize: [0.08, 0.09, 0.04],
      tailLength: 0.16,
      bodyYOffset: -0.1,
    },
    zombie_horse: {
      bodySize: [0.6, 0.42, 1.12],
      headSize: [0.28, 0.28, 0.54],
      shoulderY: 0.84,
      frontZ: 0.38,
      rearZ: -0.42,
      upperLegLen: 0.34,
      lowerLegLen: 0.3,
      hoofSize: [0.09, 0.06, 0.14],
      neckOffset: [0, 0.2, 0.54],
      snoutSize: [0.2, 0.16, 0.28],
      earSize: [0.06, 0.12, 0.04],
      tailLength: 0.25,
      bodyYOffset: -0.06,
    },
    zombie_cow: {
      bodySize: [0.66, 0.44, 0.96],
      headSize: [0.34, 0.28, 0.4],
      shoulderY: 0.8,
      frontZ: 0.32,
      rearZ: -0.36,
      upperLegLen: 0.32,
      lowerLegLen: 0.24,
      hoofSize: [0.11, 0.06, 0.14],
      neckOffset: [0, 0.14, 0.5],
      snoutSize: [0.2, 0.16, 0.22],
      earSize: [0.09, 0.09, 0.05],
      tailLength: 0.24,
      bodyYOffset: -0.08,
    },
    zombie_chicken: {
      bodySize: [0.34, 0.3, 0.42],
      headSize: [0.2, 0.2, 0.2],
      shoulderY: 0.56,
      frontZ: 0.12,
      rearZ: -0.14,
      upperLegLen: 0.14,
      lowerLegLen: 0.12,
      hoofSize: [0.08, 0.03, 0.08],
      neckOffset: [0, 0.2, 0.2],
      snoutSize: [0.08, 0.06, 0.14],
      earSize: [0.03, 0.07, 0.02],
      tailLength: 0.1,
      bodyYOffset: -0.2,
    },
  };
  const profile = profileByVariant[variant] ?? profileByVariant.zombie_pig;

  const group = new THREE.Group();
  const bodyRoot = new THREE.Group();
  bodyRoot.position.y = profile.bodyYOffset * scale;
  group.add(bodyRoot);

  const skinColor = palette?.skin ?? 0x7a9464;
  const clothColor = palette?.cloth ?? 0x3c474d;
  const eyeColor = palette?.eye ?? 0xb8ff82;
  const woundColor = palette?.wounds ?? 0x56534b;
  const skinMat = makeCreatureMaterial({
    color: skinColor,
    emissive: shiftColor(skinColor, 0.01, -0.1, -0.22),
    emissiveIntensity: 0.14,
    roughness: 0.9,
    metalness: 0.02,
  });
  const hideMat = makeCreatureMaterial({
    color: shiftColor(skinColor, 0.01, -0.08, 0.08),
    roughness: 0.94,
    metalness: 0.01,
  });
  const clothMat = makeCreatureMaterial({
    color: clothColor,
    roughness: 0.92,
    metalness: 0.04,
  });
  const hoofMat = makeCreatureMaterial({
    color: 0x2e2e2e,
    roughness: 0.88,
    metalness: 0.08,
  });
  const woundMat = makeCreatureMaterial({
    color: woundColor,
    emissive: 0x171512,
    emissiveIntensity: 0.14,
    roughness: 0.78,
    metalness: 0.02,
  });
  const eyeMat = makeCreatureMaterial({
    color: eyeColor,
    emissive: eyeColor,
    emissiveIntensity: 1.15,
    roughness: 0.3,
    metalness: 0.08,
  });

  const torso = addSpherePart(
    bodyRoot,
    skinMat,
    new THREE.Vector3(0, profile.shoulderY * scale, 0),
    new THREE.Vector3(profile.bodySize[0] * scale, profile.bodySize[1] * scale, profile.bodySize[2] * scale),
    20,
  );
  const shoulderMass = addSpherePart(
    bodyRoot,
    hideMat,
    new THREE.Vector3(0, profile.shoulderY * scale + profile.bodySize[1] * scale * 0.12, 0.04 * scale),
    new THREE.Vector3(profile.bodySize[0] * scale * 0.74, profile.bodySize[1] * scale * 0.3, profile.bodySize[2] * scale * 0.42),
    16,
  );
  shoulderMass.rotation.x = -0.08;

  const ribPatch = addSpherePart(
    bodyRoot,
    woundMat,
    new THREE.Vector3(-profile.bodySize[0] * scale * 0.18, profile.shoulderY * scale - 0.02 * scale, profile.bodySize[2] * scale * 0.2),
    new THREE.Vector3(0.12 * scale, 0.08 * scale, 0.11 * scale),
    12,
  );
  ribPatch.rotation.set(0.18, 0.24, 0.1);

  const chestGlow = addSpherePart(
    bodyRoot,
    makeCreatureMaterial({
      color: eyeColor,
      emissive: eyeColor,
      emissiveIntensity: 0.68,
      roughness: 0.46,
      metalness: 0.05,
      opacity: 0.48,
    }),
    new THREE.Vector3(0.11 * scale, profile.shoulderY * scale + 0.02 * scale, profile.bodySize[2] * scale * 0.22),
    new THREE.Vector3(0.11 * scale, 0.09 * scale, 0.06 * scale),
    12,
  );

  const neckPivot = new THREE.Group();
  neckPivot.position.set(
    profile.neckOffset[0] * scale,
    profile.shoulderY * scale + profile.neckOffset[1] * scale * 0.8,
    profile.neckOffset[2] * scale * 0.62,
  );
  bodyRoot.add(neckPivot);
  addCapsulePart(
    neckPivot,
    skinMat,
    new THREE.Vector3(0, 0.02 * scale, -0.04 * scale),
    0.06 * scale,
    0.18 * scale,
    new THREE.Euler(Math.PI / 2.65, 0, 0),
  );

  const headPivot = new THREE.Group();
  headPivot.position.set(
    profile.neckOffset[0] * scale,
    profile.shoulderY * scale + profile.neckOffset[1] * scale,
    profile.neckOffset[2] * scale,
  );
  bodyRoot.add(headPivot);

  const head = addSpherePart(
    headPivot,
    skinMat,
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(profile.headSize[0] * scale, profile.headSize[1] * scale, profile.headSize[2] * scale),
    18,
  );
  head.rotation.x = 0.05;

  const jawPivot = new THREE.Group();
  jawPivot.position.set(0, -profile.headSize[1] * scale * 0.14, profile.headSize[2] * scale * 0.22);
  headPivot.add(jawPivot);
  const jaw = addSpherePart(
    jawPivot,
    woundMat,
    new THREE.Vector3(0, -0.01 * scale, 0.04 * scale),
    new THREE.Vector3(profile.headSize[0] * scale * 0.46, profile.headSize[1] * scale * 0.18, profile.headSize[2] * scale * 0.32),
    12,
  );
  jaw.rotation.x = 0.12;

  const snout = addCylinderPart(
    headPivot,
    woundMat,
    new THREE.Vector3(0, -profile.headSize[1] * scale * 0.05, profile.headSize[2] * scale * 0.48),
    profile.snoutSize[0] * scale * 0.35,
    profile.snoutSize[1] * scale * 0.46,
    profile.snoutSize[2] * scale,
    new THREE.Euler(Math.PI / 2, 0, 0),
    9,
  );
  snout.scale.x = Math.max(0.72, profile.snoutSize[0] / Math.max(profile.snoutSize[1], 0.01));

  const eyeL = addSpherePart(
    headPivot,
    eyeMat,
    new THREE.Vector3(-profile.headSize[0] * scale * 0.24, 0.01 * scale, profile.headSize[2] * scale * 0.31),
    new THREE.Vector3(0.05 * scale, 0.05 * scale, 0.04 * scale),
    10,
  );
  const eyeR = eyeL.clone();
  eyeR.position.x *= -1;
  headPivot.add(eyeR);

  const earL = addConePart(
    headPivot,
    skinMat,
    new THREE.Vector3(-profile.headSize[0] * scale * 0.28, profile.headSize[1] * scale * 0.44, -0.01 * scale),
    Math.max(0.02, profile.earSize[0] * scale * 0.42),
    profile.earSize[1] * scale,
    new THREE.Euler(-0.18, 0.1, 0.46),
  );
  const earR = earL.clone();
  earR.position.x *= -1;
  earR.rotation.z *= -1;
  headPivot.add(earR);

  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-profile.bodySize[0] * scale * 0.32, profile.shoulderY * scale, profile.frontZ * scale);
  bodyRoot.add(leftArmPivot);
  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(profile.bodySize[0] * scale * 0.32, profile.shoulderY * scale, profile.frontZ * scale);
  bodyRoot.add(rightArmPivot);
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-profile.bodySize[0] * scale * 0.3, profile.shoulderY * scale, profile.rearZ * scale);
  bodyRoot.add(leftLegPivot);
  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(profile.bodySize[0] * scale * 0.3, profile.shoulderY * scale, profile.rearZ * scale);
  bodyRoot.add(rightLegPivot);

  const leftForearmPivot = new THREE.Group();
  leftForearmPivot.position.set(0, -profile.upperLegLen * scale, 0.01 * scale);
  leftArmPivot.add(leftForearmPivot);
  const rightForearmPivot = new THREE.Group();
  rightForearmPivot.position.set(0, -profile.upperLegLen * scale, 0.01 * scale);
  rightArmPivot.add(rightForearmPivot);
  const leftKneePivot = new THREE.Group();
  leftKneePivot.position.set(0, -profile.upperLegLen * scale, 0.01 * scale);
  leftLegPivot.add(leftKneePivot);
  const rightKneePivot = new THREE.Group();
  rightKneePivot.position.set(0, -profile.upperLegLen * scale, 0.01 * scale);
  rightLegPivot.add(rightKneePivot);

  const leftFrontUpper = addCapsulePart(
    leftArmPivot,
    skinMat,
    new THREE.Vector3(0, -profile.upperLegLen * scale * 0.5, 0),
    0.045 * scale,
    profile.upperLegLen * scale * 0.7,
  );
  const rightFrontUpper = leftFrontUpper.clone();
  rightArmPivot.add(rightFrontUpper);
  const leftFrontLower = addCapsulePart(
    leftForearmPivot,
    skinMat,
    new THREE.Vector3(0, -profile.lowerLegLen * scale * 0.52, 0),
    0.039 * scale,
    profile.lowerLegLen * scale * 0.66,
  );
  const rightFrontLower = leftFrontLower.clone();
  rightForearmPivot.add(rightFrontLower);

  const leftRearUpper = addCapsulePart(
    leftLegPivot,
    skinMat,
    new THREE.Vector3(0, -profile.upperLegLen * scale * 0.5, 0),
    0.05 * scale,
    profile.upperLegLen * scale * 0.72,
  );
  const rightRearUpper = leftRearUpper.clone();
  rightLegPivot.add(rightRearUpper);
  const leftRearLower = addCapsulePart(
    leftKneePivot,
    skinMat,
    new THREE.Vector3(0, -profile.lowerLegLen * scale * 0.52, 0),
    0.042 * scale,
    profile.lowerLegLen * scale * 0.68,
  );
  const rightRearLower = leftRearLower.clone();
  rightKneePivot.add(rightRearLower);

  const leftFrontHoof = addCylinderPart(
    leftForearmPivot,
    hoofMat,
    new THREE.Vector3(0, -profile.lowerLegLen * scale, 0.01 * scale),
    profile.hoofSize[0] * scale * 0.34,
    profile.hoofSize[0] * scale * 0.44,
    profile.hoofSize[1] * scale * 1.1,
    null,
    6,
  );
  const rightFrontHoof = leftFrontHoof.clone();
  rightForearmPivot.add(rightFrontHoof);
  const leftRearHoof = leftFrontHoof.clone();
  leftKneePivot.add(leftRearHoof);
  const rightRearHoof = leftFrontHoof.clone();
  rightKneePivot.add(rightRearHoof);

  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, profile.shoulderY * scale + 0.05 * scale, -profile.bodySize[2] * scale * 0.5);
  bodyRoot.add(tailPivot);
  addCylinderPart(
    tailPivot,
    woundMat,
    new THREE.Vector3(0, 0, -profile.tailLength * scale * 0.36),
    0.024 * scale,
    0.035 * scale,
    profile.tailLength * scale,
    new THREE.Euler(Math.PI / 2 + 0.28, 0, 0),
    6,
  );

  if (variant === "zombie_pig") {
    addCylinderPart(
      headPivot,
      skinMat,
      new THREE.Vector3(0, -profile.headSize[1] * scale * 0.08, profile.headSize[2] * scale * 0.62),
      profile.snoutSize[0] * scale * 0.23,
      profile.snoutSize[0] * scale * 0.26,
      0.03 * scale,
      new THREE.Euler(Math.PI / 2, 0, 0),
      10,
    );
  }

  if (variant === "zombie_horse") {
    for (let i = 0; i < 4; i += 1) {
      const mane = addSpherePart(
        bodyRoot,
        hideMat,
        new THREE.Vector3(0, profile.shoulderY * scale + 0.18 * scale + i * 0.05 * scale, profile.bodySize[2] * scale * 0.28 - i * 0.1 * scale),
        new THREE.Vector3(0.06 * scale, 0.08 * scale, 0.05 * scale),
        10,
      );
      mane.rotation.x = -0.2;
    }
    addSpherePart(
      tailPivot,
      hideMat,
      new THREE.Vector3(0, -profile.tailLength * scale * 0.16, -profile.tailLength * scale * 0.78),
      new THREE.Vector3(0.08 * scale, 0.16 * scale, 0.08 * scale),
      10,
    );
  }

  if (variant === "zombie_cow") {
    const hornL = addConePart(
      headPivot,
      hoofMat,
      new THREE.Vector3(-profile.headSize[0] * scale * 0.18, profile.headSize[1] * scale * 0.32, profile.headSize[2] * scale * 0.05),
      0.03 * scale,
      0.18 * scale,
      new THREE.Euler(-0.42, 0.08, 1.1),
    );
    const hornR = hornL.clone();
    hornR.position.x *= -1;
    hornR.rotation.z *= -1;
    headPivot.add(hornR);
    const spotMat = makeCreatureMaterial({
      color: shiftColor(clothColor, 0, -0.06, -0.08),
      roughness: 0.95,
      metalness: 0.01,
    });
    const spotL = addSpherePart(
      bodyRoot,
      spotMat,
      new THREE.Vector3(-profile.bodySize[0] * scale * 0.36, profile.shoulderY * scale + 0.02 * scale, -0.06 * scale),
      new THREE.Vector3(0.12 * scale, 0.16 * scale, 0.04 * scale),
      10,
    );
    spotL.rotation.z = 0.44;
    const spotR = spotL.clone();
    spotR.position.x *= -1;
    spotR.rotation.z *= -1;
    bodyRoot.add(spotR);
  }

  if (variant === "zombie_chicken") {
    const beak = addConePart(
      headPivot,
      hoofMat,
      new THREE.Vector3(0, -0.01 * scale, profile.headSize[2] * scale * 0.58),
      0.03 * scale,
      0.14 * scale,
      new THREE.Euler(Math.PI / 2, 0, 0),
    );
    beak.scale.set(1, 0.8, 1.1);
    for (let i = 0; i < 3; i += 1) {
      addSpherePart(
        headPivot,
        woundMat,
        new THREE.Vector3(0, profile.headSize[1] * scale * (0.34 + i * 0.1), profile.headSize[2] * scale * 0.08),
        new THREE.Vector3(0.04 * scale, 0.04 * scale, 0.03 * scale),
        8,
      );
    }
    const wingL = addSpherePart(
      bodyRoot,
      skinMat,
      new THREE.Vector3(-profile.bodySize[0] * scale * 0.36, profile.shoulderY * scale - 0.02 * scale, 0.04 * scale),
      new THREE.Vector3(0.14 * scale, 0.18 * scale, 0.06 * scale),
      12,
    );
    wingL.rotation.set(0.26, 0.14, 0.42);
    const wingR = wingL.clone();
    wingR.position.x *= -1;
    wingR.rotation.z *= -1;
    bodyRoot.add(wingR);
    for (let i = 0; i < 3; i += 1) {
      const feather = addConePart(
        tailPivot,
        hideMat,
        new THREE.Vector3((i - 1) * 0.03 * scale, 0.02 * scale, -profile.tailLength * scale * (0.5 + i * 0.08)),
        0.025 * scale,
        0.16 * scale,
        new THREE.Euler(Math.PI / 2 + 0.08, 0, (i - 1) * 0.22),
      );
      feather.scale.y = 1.15;
    }
  }

  group.traverse((node) => {
    if (!node.isMesh) {
      return;
    }
    node.castShadow = true;
    node.receiveShadow = true;
  });

  group.userData.zombieParts = {
    bodyRoot,
    torso,
    headMesh: head,
    headRadius: profile.headSize[1] * scale * 0.45,
    headPivot,
    jawPivot,
    leftArmPivot,
    rightArmPivot,
    leftForearmPivot,
    rightForearmPivot,
    leftLegPivot,
    rightLegPivot,
    leftKneePivot,
    rightKneePivot,
    eyeMat,
    chestGlow,
    tailPivot,
    baseBodyY: bodyRoot.position.y,
    animSeed: Math.random() * Math.PI * 2,
    variant,
  };
  return group;
}

function makeZombieMesh(scale = 1, boss = false, variant = "walker") {
  const paletteByType = {
    walker: {
      skin: 0x8ea06d,
      cloth: 0x2b3541,
      wounds: 0x5f5b4f,
      eye: 0x9de66f,
    },
    crawler: {
      skin: 0x7f9360,
      cloth: 0x2b2f36,
      wounds: 0x595448,
      eye: 0xccf580,
    },
    runner: {
      skin: 0x9fb788,
      cloth: 0x2f3042,
      wounds: 0x666153,
      eye: 0xc4ff7d,
    },
    leaper: {
      skin: 0x96aa76,
      cloth: 0x353a40,
      wounds: 0x625c4c,
      eye: 0xc5ff70,
    },
    brute: {
      skin: 0x7f875f,
      cloth: 0x373941,
      wounds: 0x575246,
      eye: 0xffc566,
    },
    armored: {
      skin: 0x77866d,
      cloth: 0x3b404a,
      wounds: 0x535047,
      eye: 0x9ce7ff,
    },
    flyer: {
      skin: 0x748764,
      cloth: 0x2e3340,
      wounds: 0x555146,
      eye: 0x8bf8ff,
    },
    skitter: {
      skin: 0x95ba7f,
      cloth: 0x2a3038,
      wounds: 0x6a6455,
      eye: 0xc8ff7a,
    },
    pouncer: {
      skin: 0x88a468,
      cloth: 0x353743,
      wounds: 0x686251,
      eye: 0xffd86a,
    },
    revenant: {
      skin: 0x6c8a84,
      cloth: 0x30364a,
      wounds: 0x565759,
      eye: 0x8ff4ff,
    },
    juggernaut: {
      skin: 0x6f7758,
      cloth: 0x373841,
      wounds: 0x5f594e,
      eye: 0xff8a62,
    },
    zombie_pig: {
      skin: 0x8f806d,
      cloth: 0x3a3f46,
      wounds: 0x635b51,
      eye: 0xc5ff83,
    },
    zombie_horse: {
      skin: 0x7d7463,
      cloth: 0x393d43,
      wounds: 0x5a554b,
      eye: 0xb6ff7d,
    },
    zombie_cow: {
      skin: 0x869077,
      cloth: 0x3a4048,
      wounds: 0x5d584d,
      eye: 0xc9ff8e,
    },
    zombie_chicken: {
      skin: 0x969c70,
      cloth: 0x3f464d,
      wounds: 0x5d5848,
      eye: 0xd7ff83,
    },
    mega_zombie: {
      skin: 0x5f6a48,
      cloth: 0x2d2d35,
      wounds: 0x5d574a,
      eye: 0xff6f55,
    },
    mini_boss: {
      skin: 0x7f5143,
      cloth: 0x40262a,
      wounds: 0x655246,
      eye: 0xff8e54,
    },
    secret_boss: {
      skin: 0x4f3b31,
      cloth: 0x28191c,
      wounds: 0x645246,
      eye: 0xff5d4f,
    },
  };
  const palette = boss ? paletteByType.mini_boss : paletteByType[variant] || paletteByType.walker;
  if (ANIMAL_ZOMBIE_VARIANTS.has(variant)) {
    return makeZombieAnimalMesh(scale, variant, palette);
  }
  const bruteLike = variant === "brute" || variant === "juggernaut" || variant === "mega_zombie" || boss;
  const gauntLike = variant === "crawler" || variant === "skitter" || variant === "runner";
  const torsoScaleX = bruteLike ? 1.26 : gauntLike ? 1.1 : 1.18;
  const torsoScaleY = bruteLike ? 1.2 : gauntLike ? 1.06 : 1.13;
  const armLengthScale = bruteLike ? 1.06 : gauntLike ? 0.95 : 1;
  const legLengthScale = bruteLike ? 1.03 : gauntLike ? 0.94 : 1;

  const group = new THREE.Group();
  const bodyRoot = new THREE.Group();
  bodyRoot.position.y = 0.04 * scale;
  group.add(bodyRoot);

  const skinMat = makeCreatureMaterial({
    color: palette.skin,
    emissive: boss ? 0x1a0b06 : shiftColor(palette.skin, 0.01, -0.1, -0.22),
    emissiveIntensity: boss ? 0.34 : 0.14,
    roughness: 0.92,
    metalness: 0.01,
  });
  const skinRotMat = makeCreatureMaterial({
    color: shiftColor(palette.skin, 0, -0.08, -0.18),
    emissive: 0x13130a,
    emissiveIntensity: 0.1,
    roughness: 0.95,
    metalness: 0,
  });
  const clothMat = makeCreatureMaterial({
    color: palette.cloth,
    roughness: 0.93,
    metalness: 0.03,
  });
  const clothTornMat = makeCreatureMaterial({
    color: shiftColor(palette.cloth, -0.01, -0.08, 0.08),
    roughness: 0.95,
    metalness: 0.01,
  });
  const boneMat = makeCreatureMaterial({
    color: 0xbfb39f,
    roughness: 0.72,
    metalness: 0.04,
  });
  const teethMat = makeCreatureMaterial({
    color: 0xe4dcc8,
    roughness: 0.58,
    metalness: 0.02,
  });
  const woundMat = makeCreatureMaterial({
    color: palette.wounds,
    emissive: 0x141310,
    emissiveIntensity: 0.12,
    roughness: 0.8,
    metalness: 0.01,
  });
  const eyeMat = makeCreatureMaterial({
    color: palette.eye,
    emissive: palette.eye,
    emissiveIntensity: boss ? 1.45 : 0.9,
    roughness: 0.32,
    metalness: 0.08,
  });
  const outlineMat = new THREE.MeshBasicMaterial({
    color:
      boss
        ? 0xff8e54
        : variant === "armored" || variant === "juggernaut"
          ? 0x9fd7ff
          : variant === "flyer" || variant === "revenant"
            ? 0x94fbff
            : variant === "skitter"
              ? 0xc8ff7a
              : variant === "pouncer"
                ? 0xffd86a
                : 0x9bc278,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.028,
    depthWrite: false,
  });

  const torso = addSpherePart(
    bodyRoot,
    skinMat,
    new THREE.Vector3(0, 0.78 * scale, -0.01 * scale),
    new THREE.Vector3(0.58 * scale * torsoScaleX, 0.72 * scale * torsoScaleY, 0.36 * scale),
    20,
  );
  torso.rotation.x = 0.05;
  const abdomen = addSpherePart(
    bodyRoot,
    skinRotMat,
    new THREE.Vector3(0, 0.48 * scale, -0.01 * scale),
    new THREE.Vector3(0.44 * scale * torsoScaleX, 0.34 * scale, 0.28 * scale),
    16,
  );
  const pelvis = addSpherePart(
    bodyRoot,
    skinRotMat,
    new THREE.Vector3(0, 0.3 * scale, -0.03 * scale),
    new THREE.Vector3((bruteLike ? 0.5 : 0.46) * scale, 0.26 * scale, 0.26 * scale),
    14,
  );
  const torsoOutline = addSpherePart(
    bodyRoot,
    outlineMat,
    torso.position.clone(),
    new THREE.Vector3(0.62 * scale * torsoScaleX, 0.76 * scale * torsoScaleY, 0.4 * scale),
    18,
  );
  torsoOutline.rotation.copy(torso.rotation);

  const upperBack = addSpherePart(
    bodyRoot,
    clothMat,
    new THREE.Vector3(0, 0.9 * scale, -0.16 * scale),
    new THREE.Vector3(0.42 * scale, 0.22 * scale, 0.18 * scale),
    14,
  );
  upperBack.rotation.x = -0.14;
  addCapsulePart(
    bodyRoot,
    skinRotMat,
    new THREE.Vector3(0, 0.98 * scale, 0.03 * scale),
    0.055 * scale,
    0.1 * scale,
    new THREE.Euler(-0.12, 0, 0),
  );

  const clavicleL = addCapsulePart(
    bodyRoot,
    skinRotMat,
    new THREE.Vector3(-0.15 * scale, 0.97 * scale, 0.08 * scale),
    0.028 * scale,
    0.12 * scale,
    new THREE.Euler(0.16, 0.08, Math.PI / 2.8),
  );
  const clavicleR = clavicleL.clone();
  clavicleR.position.x *= -1;
  clavicleR.rotation.z *= -1;
  bodyRoot.add(clavicleR);

  const ribPatch = addSpherePart(
    bodyRoot,
    woundMat,
    new THREE.Vector3(-0.12 * scale, 0.67 * scale, 0.17 * scale),
    new THREE.Vector3(0.14 * scale, 0.16 * scale, 0.04 * scale),
    12,
  );
  ribPatch.rotation.set(0.12, 0.08, 0.14);
  const chestGlow = addSpherePart(
    bodyRoot,
    makeCreatureMaterial({
      color: palette.eye,
      emissive: palette.eye,
      emissiveIntensity: boss ? 1.1 : 0.58,
      roughness: 0.56,
      metalness: 0.02,
      opacity: 0.5,
    }),
    new THREE.Vector3(0.1 * scale, 0.62 * scale, 0.19 * scale),
    new THREE.Vector3(0.1 * scale, 0.1 * scale, 0.05 * scale),
    12,
  );

  const tornShirt = addSpherePart(
    bodyRoot,
    clothMat,
    new THREE.Vector3(0, 0.46 * scale, 0),
    new THREE.Vector3(0.48 * scale * torsoScaleX, 0.24 * scale, 0.22 * scale),
    16,
  );
  tornShirt.rotation.y = 0.14;
  const shirtTear = addSpherePart(
    bodyRoot,
    clothTornMat,
    new THREE.Vector3(0.22 * scale, 0.36 * scale, 0.14 * scale),
    new THREE.Vector3(0.08 * scale, 0.18 * scale, 0.03 * scale),
    10,
  );
  shirtTear.rotation.set(0.12, -0.24, -0.26);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 1.08 * scale, 0.07 * scale);
  bodyRoot.add(headPivot);

  const head = addSpherePart(
    headPivot,
    skinMat,
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.35 * scale, 0.39 * scale, 0.34 * scale),
    18,
  );
  head.rotation.x = 0.04;
  const headOutline = addSpherePart(
    headPivot,
    outlineMat,
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.38 * scale, 0.42 * scale, 0.37 * scale),
    16,
  );
  headOutline.rotation.copy(head.rotation);

  const jawPivot = new THREE.Group();
  jawPivot.position.set(0, -0.05 * scale, 0.14 * scale);
  headPivot.add(jawPivot);
  const jaw = addSpherePart(
    jawPivot,
    skinMat,
    new THREE.Vector3(0, -0.01 * scale, 0.03 * scale),
    new THREE.Vector3(0.22 * scale, 0.09 * scale, 0.18 * scale),
    12,
  );
  jaw.rotation.x = 0.22;
  addSpherePart(
    jawPivot,
    teethMat,
    new THREE.Vector3(0, -0.04 * scale, 0.09 * scale),
    new THREE.Vector3(0.12 * scale, 0.03 * scale, 0.07 * scale),
    8,
  );

  addSpherePart(
    headPivot,
    skinRotMat,
    new THREE.Vector3(0, -0.01 * scale, 0.18 * scale),
    new THREE.Vector3(0.05 * scale, 0.05 * scale, 0.04 * scale),
    10,
  );
  const brow = addCapsulePart(
    headPivot,
    woundMat,
    new THREE.Vector3(0, 0.1 * scale, 0.12 * scale),
    0.028 * scale,
    0.18 * scale,
    new THREE.Euler(Math.PI / 2.8, 0, Math.PI / 2),
  );
  brow.scale.z = 0.6;
  const leftCheekRot = addSpherePart(
    headPivot,
    woundMat,
    new THREE.Vector3(-0.12 * scale, -0.02 * scale, 0.13 * scale),
    new THREE.Vector3(0.08 * scale, 0.07 * scale, 0.04 * scale),
    10,
  );
  leftCheekRot.rotation.set(0.2, 0.34, 0.1);

  const eyeL = addSpherePart(
    headPivot,
    eyeMat,
    new THREE.Vector3(-0.08 * scale, 0.02 * scale, 0.17 * scale),
    new THREE.Vector3(0.055 * scale, 0.05 * scale, 0.04 * scale),
    10,
  );
  const eyeR = eyeL.clone();
  eyeR.position.set(0.08 * scale, 0.01 * scale, 0.17 * scale);
  headPivot.add(eyeR);

  const boneSpike = addConePart(
    bodyRoot,
    boneMat,
    new THREE.Vector3(-0.18 * scale, 0.67 * scale, 0.16 * scale),
    0.024 * scale,
    0.16 * scale,
    new THREE.Euler(0.88, 0.2, -0.46),
  );
  boneSpike.scale.z = 0.8;

  if (variant === "armored" || variant === "juggernaut") {
    const armorMat = makeCreatureMaterial({
      color: variant === "juggernaut" ? 0x596068 : 0x6f7c88,
      roughness: 0.42,
      metalness: 0.74,
      emissive: 0x12212f,
      emissiveIntensity: 0.28,
    });
    addSpherePart(
      bodyRoot,
      armorMat,
      new THREE.Vector3(0, 0.7 * scale, 0.21 * scale),
      new THREE.Vector3(0.46 * scale, 0.42 * scale, 0.14 * scale),
      14,
    );
    addSpherePart(
      bodyRoot,
      armorMat,
      new THREE.Vector3(0, 1.18 * scale, 0.06 * scale),
      new THREE.Vector3(0.31 * scale, 0.2 * scale, 0.25 * scale),
      14,
    );
    if (variant === "juggernaut") {
      const shoulderL = addSpherePart(
        bodyRoot,
        armorMat,
        new THREE.Vector3(-0.29 * scale, 0.95 * scale, 0.02 * scale),
        new THREE.Vector3(0.24 * scale, 0.18 * scale, 0.2 * scale),
        12,
      );
      const shoulderR = shoulderL.clone();
      shoulderR.position.x *= -1;
      const spinePlate = addSpherePart(
        bodyRoot,
        armorMat,
        new THREE.Vector3(0, 0.82 * scale, -0.16 * scale),
        new THREE.Vector3(0.28 * scale, 0.32 * scale, 0.14 * scale),
        12,
      );
      bodyRoot.add(shoulderL, shoulderR, spinePlate);
    }
  }

  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.32 * scale, 0.88 * scale, 0.03 * scale);
  bodyRoot.add(leftArmPivot);
  addCapsulePart(
    leftArmPivot,
    skinMat,
    new THREE.Vector3(0, -0.27 * scale * armLengthScale, 0.01 * scale),
    0.055 * scale,
    0.29 * scale * armLengthScale,
  );

  const leftForearmPivot = new THREE.Group();
  leftForearmPivot.position.set(0, -0.5 * scale * armLengthScale, 0.03 * scale);
  leftArmPivot.add(leftForearmPivot);
  addCapsulePart(
    leftForearmPivot,
    skinMat,
    new THREE.Vector3(0, -0.22 * scale * armLengthScale, 0.02 * scale),
    0.05 * scale,
    0.24 * scale * armLengthScale,
  );
  addSpherePart(
    leftForearmPivot,
    skinRotMat,
    new THREE.Vector3(0.01 * scale, -0.06 * scale, 0.01 * scale),
    new THREE.Vector3(0.09 * scale, 0.09 * scale, 0.09 * scale),
    10,
  );
  addSpherePart(
    leftForearmPivot,
    skinRotMat,
    new THREE.Vector3(0.0, -0.39 * scale * armLengthScale, 0.06 * scale),
    new THREE.Vector3(0.1 * scale, 0.1 * scale, 0.1 * scale),
    10,
  );
  addConePart(
    leftForearmPivot,
    boneMat,
    new THREE.Vector3(0.03 * scale, -0.38 * scale, 0.11 * scale),
    0.012 * scale,
    0.12 * scale,
    new THREE.Euler(Math.PI / 2 - 0.18, 0.16, 0),
  );

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.32 * scale, 0.88 * scale, 0.03 * scale);
  bodyRoot.add(rightArmPivot);
  addCapsulePart(
    rightArmPivot,
    skinMat,
    new THREE.Vector3(0, -0.28 * scale * armLengthScale, 0.01 * scale),
    0.055 * scale,
    0.31 * scale * armLengthScale,
  );

  const rightForearmPivot = new THREE.Group();
  rightForearmPivot.position.set(0, -0.51 * scale * armLengthScale, 0.03 * scale);
  rightArmPivot.add(rightForearmPivot);
  addCapsulePart(
    rightForearmPivot,
    skinMat,
    new THREE.Vector3(0, -0.23 * scale * armLengthScale, 0.02 * scale),
    0.05 * scale,
    0.25 * scale * armLengthScale,
  );
  addSpherePart(
    rightForearmPivot,
    skinRotMat,
    new THREE.Vector3(-0.01 * scale, -0.06 * scale, 0.01 * scale),
    new THREE.Vector3(0.09 * scale, 0.09 * scale, 0.09 * scale),
    10,
  );
  addSpherePart(
    rightForearmPivot,
    skinRotMat,
    new THREE.Vector3(0.0, -0.4 * scale * armLengthScale, 0.06 * scale),
    new THREE.Vector3(0.1 * scale, 0.1 * scale, 0.1 * scale),
    10,
  );
  addConePart(
    rightForearmPivot,
    boneMat,
    new THREE.Vector3(-0.03 * scale, -0.39 * scale, 0.11 * scale),
    0.012 * scale,
    0.12 * scale,
    new THREE.Euler(Math.PI / 2 - 0.18, -0.16, 0),
  );

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.12 * scale, 0.34 * scale, 0.01 * scale);
  bodyRoot.add(leftLegPivot);
  addCapsulePart(
    leftLegPivot,
    clothMat,
    new THREE.Vector3(0, -0.23 * scale * legLengthScale, 0.01 * scale),
    0.06 * scale,
    0.23 * scale * legLengthScale,
  );
  const leftKneePivot = new THREE.Group();
  leftKneePivot.position.set(0, -0.44 * scale * legLengthScale, 0.01 * scale);
  leftLegPivot.add(leftKneePivot);
  addCapsulePart(
    leftKneePivot,
    clothMat,
    new THREE.Vector3(0, -0.21 * scale * legLengthScale, 0.01 * scale),
    0.055 * scale,
    0.22 * scale * legLengthScale,
  );

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.12 * scale, 0.34 * scale, 0.01 * scale);
  bodyRoot.add(rightLegPivot);
  addCapsulePart(
    rightLegPivot,
    clothMat,
    new THREE.Vector3(0, -0.23 * scale * legLengthScale, 0.01 * scale),
    0.06 * scale,
    0.23 * scale * legLengthScale,
  );
  const rightKneePivot = new THREE.Group();
  rightKneePivot.position.set(0, -0.44 * scale * legLengthScale, 0.01 * scale);
  rightLegPivot.add(rightKneePivot);
  addCapsulePart(
    rightKneePivot,
    clothMat,
    new THREE.Vector3(0, -0.21 * scale * legLengthScale, 0.01 * scale),
    0.055 * scale,
    0.22 * scale * legLengthScale,
  );
  const leftFoot = addSpherePart(
    leftKneePivot,
    clothMat,
    new THREE.Vector3(0, -0.45 * scale * legLengthScale, 0.09 * scale),
    new THREE.Vector3(0.18 * scale, 0.085 * scale, 0.3 * scale),
    12,
  );
  const leftToe = addSpherePart(
    leftKneePivot,
    boneMat,
    new THREE.Vector3(0, -0.44 * scale * legLengthScale, 0.24 * scale),
    new THREE.Vector3(0.12 * scale, 0.05 * scale, 0.08 * scale),
    8,
  );

  const rightFoot = addSpherePart(
    rightKneePivot,
    clothMat,
    new THREE.Vector3(0, -0.45 * scale * legLengthScale, 0.09 * scale),
    new THREE.Vector3(0.18 * scale, 0.085 * scale, 0.3 * scale),
    12,
  );
  const rightToe = addSpherePart(
    rightKneePivot,
    boneMat,
    new THREE.Vector3(0, -0.44 * scale * legLengthScale, 0.24 * scale),
    new THREE.Vector3(0.12 * scale, 0.05 * scale, 0.08 * scale),
    8,
  );
  const tornSleeveL = addSpherePart(
    leftArmPivot,
    clothTornMat,
    new THREE.Vector3(0, -0.12 * scale, 0.02 * scale),
    new THREE.Vector3(0.14 * scale, 0.12 * scale, 0.12 * scale),
    10,
  );
  tornSleeveL.rotation.set(0.12, 0.16, 0.22);
  const tornSleeveR = tornSleeveL.clone();
  tornSleeveR.rotation.set(0.08, -0.16, -0.24);
  rightArmPivot.add(tornSleeveR);

  const kneeRipL = addSpherePart(
    leftKneePivot,
    woundMat,
    new THREE.Vector3(0.02 * scale, -0.11 * scale, 0.08 * scale),
    new THREE.Vector3(0.08 * scale, 0.11 * scale, 0.02 * scale),
    8,
  );
  const kneeRipR = kneeRipL.clone();
  kneeRipR.position.x *= -1;
  rightKneePivot.add(kneeRipR);

  if (variant === "flyer" || variant === "revenant") {
    const wingMat = makeCreatureMaterial({
      color: variant === "revenant" ? 0x56708f : 0x4f6578,
      roughness: 0.82,
      metalness: 0.1,
      emissive: 0x183447,
      emissiveIntensity: 0.18,
      opacity: 0.76,
      side: THREE.DoubleSide,
    });
    const leftWing = addSpherePart(
      leftArmPivot,
      wingMat,
      new THREE.Vector3(-0.06 * scale, -0.05 * scale, -0.2 * scale),
      new THREE.Vector3(0.12 * scale, 0.62 * scale, 0.22 * scale),
      14,
    );
    leftWing.rotation.set(0.18, 0.18, 1.06);
    const rightWing = leftWing.clone();
    rightWing.position.x *= -1;
    rightWing.rotation.z *= -1;
    rightArmPivot.add(rightWing);
  }

  if (variant === "mega_zombie") {
    addSpherePart(
      bodyRoot,
      woundMat,
      new THREE.Vector3(0, 1.02 * scale, -0.16 * scale),
      new THREE.Vector3(0.34 * scale, 0.16 * scale, 0.12 * scale),
      12,
    );
  }

  bodyRoot.rotation.x = -0.04;
  if (variant === "crawler") {
    bodyRoot.rotation.x = 0.22;
    bodyRoot.position.y -= 0.14 * scale;
  }
  if (variant === "leaper" || variant === "pouncer") {
    leftLegPivot.position.y += 0.05 * scale;
    rightLegPivot.position.y += 0.05 * scale;
  }
  if (variant === "pouncer") {
    bodyRoot.rotation.x = 0.08;
    bodyRoot.position.y -= 0.06 * scale;
    headPivot.position.y -= 0.03 * scale;
  }
  if (variant === "skitter") {
    bodyRoot.rotation.x = 0.1;
    bodyRoot.position.y -= 0.09 * scale;
    leftLegPivot.position.y -= 0.03 * scale;
    rightLegPivot.position.y -= 0.03 * scale;
  }

  group.traverse((node) => {
    if (!node.isMesh) {
      return;
    }
    node.castShadow = true;
    node.receiveShadow = true;
  });

  group.userData.zombieParts = {
    bodyRoot,
    torso,
    headMesh: head,
    headRadius: 0.2 * scale,
    headPivot,
    jawPivot,
    leftArmPivot,
    rightArmPivot,
    leftForearmPivot,
    rightForearmPivot,
    leftLegPivot,
    rightLegPivot,
    leftKneePivot,
    rightKneePivot,
    eyeMat,
    chestGlow,
    baseBodyY: bodyRoot.position.y,
    animSeed: Math.random() * Math.PI * 2,
    variant,
  };

  return group;
}

export class RaidScene3D {
  constructor(game) {
    this.game = game;
    this.scene = game.scene3d;
    this.camera = game.camera;
    this.physics = game.physics;
    this.materialDefs = game.materialDefs;
    this.waveDirector = new WaveDirector3D(game.waveDefs);

    this.initialized = false;
    this.paused = true;
    this.projectiles = [];
    this.enemies = [];
    this.props = [];
    this.ragdolls = [];
    this.transformableLandscape = [];
    this.tmpVec = new THREE.Vector3();

    this.playerHitCooldown = 0;
    this.weaponCooldown = 0;
    this.reloadTime = 0;
    this.currentWeaponId = "pipe";
    this.weaponAmmo = new Map();
    this.recoil = initRecoilState();
    this.killsThisWave = 0;
    this.viewModelRig = null;
    this.viewWeaponRoot = null;
    this.viewWeaponMeshes = new Map();
    this.viewWeaponMovingParts = new Map();
    this.viewBobTime = 0;
    this.viewWeaponFireKick = 0;
    this.playerPresenceEl = null;
    this.shopActionsEl = null;
    this.shopQuickButtonEl = null;
    this.swapQuickButtonEl = null;
    this.grenadeQuickButtonEl = null;
    this.helpQuickButtonEl = null;
    this.trayQuickButtonEl = null;
    this.mobileInstructionsOpen = false;
    this.mobileUtilityTrayOpen = false;
    this.interactPromptEl = null;
    this.startDoorBeaconMesh = null;
    this.startDoorBeaconLight = null;
    this.spawnTracker = null;
    this.breakableWindows = [];
    this.lastKillRewardLabel = "";
    this.lastKillRewardTimer = 0;
    this.hitConfirmTimer = 0;
    this.weaponIndicatorEl = null;
    this.weaponIndicatorCurrentId = "";
    this.weaponIndicatorSwapTimeout = null;
    this.minimapEl = null;
    this.minimapCanvasEl = null;
    this.minimapCtx = null;
    this.minimapOpen = true;
    this.shopShortcutLatch = false;
    this.landscapeZombifyEvents = 0;
    this.grenadeCooldown = 0;
    this.interactLatch = false;
    this.grenadeLatch = false;
    this.grenadeCycleLatch = false;
    this.phase = GAME_PHASE.HOUSE_INTRO;
    this.startHouseExited = false;
    this.activeBuildingId = null;
    this.pendingPrompt = "";
    this.promptTimer = 0;
    this.secretBossActive = false;
    this.secretBossSpawned = false;
    this.buildingState = [];
    this.minimapStructures = [];
    this.villagers = [];
    this.activeEscortVillagerId = null;
    this.escortDropoff = null;
    this.escortFollowOffset = new THREE.Vector3(0, 0, 3.4);
    this.escortTeleportCatchupDistance = 9.5;
    this.buildingDoorMeshes = new Map();
    this.maxVillageHp = VILLAGE_HP_BASE;
    this.villageDamageStage = 0;
    this.villageDamageFlash = 0;
    this.villageDamageRecent = 0;
    this.villageDestroyed = false;
    this.playerDamageFlash = 0;
    this.pendingPlayerBiteDamage = 0;
    this.villageDamageAudioCooldown = 0;
    this.playerDamageOverlayEl = null;
    this.villageDamageOverlayEl = null;
    this.villageDestroyedPopupEl = null;
    this.villageDestroyedPopupTimeout = null;
    this.villageDamageEmitters = [];
    this.villagerPerkModifiers = getVillagerPerkModifiers(this.game.save);
    this.startHouseId = game.buildingDefs.find((entry) => entry.startHouse)?.id ?? "village_house_a";
  }

  buildWorld() {
    if (this.initialized) {
      return;
    }

    this.scene.background = new THREE.Color(0x243345);
    this.scene.fog = new THREE.FogExp2(0x27384c, 0.0082);

    const hemi = new THREE.HemisphereLight(0xc7dcff, 0x394335, 1.2);
    this.scene.add(hemi);

    const moonLight = new THREE.DirectionalLight(0xe7f0ff, 2.85);
    moonLight.position.set(10, 18, 6);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.set(this.game.qualityProfile.shadows ? 1536 : 1024, this.game.qualityProfile.shadows ? 1536 : 1024);
    moonLight.shadow.camera.near = 0.2;
    moonLight.shadow.camera.far = 90;
    moonLight.shadow.camera.left = -28;
    moonLight.shadow.camera.right = 28;
    moonLight.shadow.camera.top = 28;
    moonLight.shadow.camera.bottom = -28;
    moonLight.shadow.bias = -0.00018;
    this.scene.add(moonLight);

    const rimLight = new THREE.DirectionalLight(0x7da7d8, 0.68);
    rimLight.position.set(-14, 10, -12);
    this.scene.add(rimLight);

    const fillLight = new THREE.PointLight(0xffbf7a, 52, 46, 1.9);
    fillLight.position.set(0, 3, -19);
    fillLight.castShadow = this.game.qualityProfile.shadows;
    this.scene.add(fillLight);

    const ambient = new THREE.AmbientLight(0xbecada, 0.34);
    this.scene.add(ambient);

    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x5d6552,
      roughness: 0.97,
      metalness: 0.03,
      normalScale: new THREE.Vector2(0.7, 0.7),
    });
    const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(84, 84), groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    this.scene.add(groundMesh);
    this.physics.createStaticBox("ground", new THREE.Vector3(0, -0.1, 0), new THREE.Vector3(84, 0.2, 84), {
      material: "soil",
      friction: 0.95,
      restitution: 0.01,
    });

    this.buildLandscape();
    this.buildVillage();
    this.buildInteriors();
    this.buildPerimeter();
    this.buildProps();

    this.playerBody = this.physics.createPlayerCapsule(new THREE.Vector3(0, 1.2, 16));
    this.playerController = new PlayerControllerFps({
      camera: this.camera,
      canvas: this.game.renderer.domElement,
      sensitivity: this.game.save.sensitivity,
    });

    this.hud = this.createHud();
    this.crosshair = this.createCrosshair();
    this.createInteractPrompt();
    this.createPlayerPresenceOverlay();
    this.createPlayerDamageOverlay();
    this.createVillageDamageOverlay();
    this.createViewModel();

    this.initialized = true;
  }

  createViewModel() {
    if (this.viewModelRig) {
      return;
    }

    const rig = new THREE.Group();
    rig.position.set(0.29, -0.15, -0.3);
    rig.scale.setScalar(0.82);

    const weaponRoot = new THREE.Group();
    weaponRoot.position.set(0.06, -0.09, -0.04);
    const viewFill = new THREE.PointLight(0xffd8b8, 1.05, 2.4, 2.1);
    viewFill.position.set(0.04, 0.14, 0.2);
    rig.add(viewFill);
    rig.add(weaponRoot);

    this.camera.add(rig);

    this.viewModelRig = rig;
    this.viewWeaponRoot = weaponRoot;
    this.buildViewWeaponMeshes();
    this.refreshViewWeaponModel();
  }

  buildViewWeaponMeshes() {
    this.viewWeaponMovingParts.clear();

    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x6f7987,
      roughness: 0.28,
      metalness: 0.88,
      emissive: 0x0f151d,
      emissiveIntensity: 0.08,
    });
    const steelDarkMat = new THREE.MeshStandardMaterial({
      color: 0x2f3743,
      roughness: 0.4,
      metalness: 0.76,
      emissive: 0x0a1017,
      emissiveIntensity: 0.07,
    });
    const parkerizedMat = new THREE.MeshStandardMaterial({
      color: 0x4b545f,
      roughness: 0.46,
      metalness: 0.63,
      emissive: 0x0d141d,
      emissiveIntensity: 0.06,
    });
    const polyMat = new THREE.MeshStandardMaterial({
      color: 0x2a3038,
      roughness: 0.68,
      metalness: 0.1,
    });
    const rubberMat = new THREE.MeshStandardMaterial({
      color: 0x1f252c,
      roughness: 0.82,
      metalness: 0.04,
    });
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x664931,
      roughness: 0.76,
      metalness: 0.05,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xb88b45,
      roughness: 0.34,
      metalness: 0.74,
      emissive: 0x271607,
      emissiveIntensity: 0.1,
    });
    const oliveMat = new THREE.MeshStandardMaterial({
      color: 0x5f6a3d,
      roughness: 0.58,
      metalness: 0.18,
    });

    const makeWeapon = ({ id, profile, length, width, height, offsetY = 0 }) => {
      const group = new THREE.Group();

      if (profile === "launcher") {
        const tubeRadius = id === "grenade_launcher" ? 0.052 : id === "flamethrower" ? 0.058 : 0.065;
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(tubeRadius, tubeRadius, length * 1.06, 14), steelDarkMat);
        tube.rotation.x = Math.PI * 0.5;
        tube.position.set(0, offsetY + 0.02, -length * 0.56);
        const tubeBandA = new THREE.Mesh(new THREE.CylinderGeometry(tubeRadius + 0.005, tubeRadius + 0.005, 0.032, 14), steelMat);
        tubeBandA.rotation.x = Math.PI * 0.5;
        tubeBandA.position.set(0, offsetY + 0.02, -length * 0.33);
        const tubeBandB = tubeBandA.clone();
        tubeBandB.position.z = -length * 0.78;
        const tubeInterior = new THREE.Mesh(
          new THREE.CylinderGeometry(Math.max(0.034, tubeRadius - 0.012), Math.max(0.034, tubeRadius - 0.012), length * 1.02, 14),
          rubberMat,
        );
        tubeInterior.rotation.x = Math.PI * 0.5;
        tubeInterior.position.set(0, offsetY + 0.02, -length * 0.56);
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.1), polyMat);
        grip.position.set(0, offsetY - 0.08, -length * 0.28);
        grip.rotation.x = -0.22;
        const frontGrip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.09), rubberMat);
        frontGrip.position.set(0, offsetY - 0.08, -length * 0.68);
        frontGrip.rotation.x = -0.17;
        const shoulderPad = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.08), polyMat);
        shoulderPad.position.set(0, offsetY - 0.02, 0.06);
        const shoulderRubber = new THREE.Mesh(new THREE.BoxGeometry(0.172, 0.072, 0.026), rubberMat);
        shoulderRubber.position.set(0, offsetY - 0.04, 0.105);
        const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.07, 0.03), steelMat);
        rearSight.position.set(0, offsetY + 0.09, -length * 0.2);
        const frontSight = rearSight.clone();
        frontSight.position.z = -length * 0.95;

        group.add(tube, tubeBandA, tubeBandB, tubeInterior, grip, rearSight, frontSight);
        if (id === "rpg") {
          const muzzleRing = new THREE.Mesh(new THREE.TorusGeometry(0.064, 0.008, 8, 20), steelMat);
          muzzleRing.position.set(0, offsetY + 0.02, -length * 1.1);
          muzzleRing.rotation.x = Math.PI * 0.5;
          const warheadBody = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.038, 0.15, 10), oliveMat);
          warheadBody.rotation.x = Math.PI * 0.5;
          warheadBody.position.set(0, offsetY + 0.02, -length * 1.04);
          const warheadTip = new THREE.Mesh(new THREE.ConeGeometry(0.037, 0.09, 10), oliveMat);
          warheadTip.rotation.x = -Math.PI * 0.5;
          warheadTip.position.set(0, offsetY + 0.02, -length * 1.16);
          const sideRailL = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.025, length * 0.54), parkerizedMat);
          sideRailL.position.set(0.078, offsetY + 0.055, -length * 0.62);
          const sideRailR = sideRailL.clone();
          sideRailR.position.x *= -1;
          group.add(frontGrip, shoulderPad, shoulderRubber, muzzleRing, warheadBody, warheadTip, sideRailL, sideRailR);
        } else if (id === "grenade_launcher") {
          const stock = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.12, 0.25), woodMat);
          stock.position.set(0, offsetY - 0.03, 0.085);
          const stockPad = new THREE.Mesh(new THREE.BoxGeometry(0.124, 0.07, 0.026), rubberMat);
          stockPad.position.set(0, offsetY - 0.045, 0.205);
          const foreStock = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.086, length * 0.18), woodMat);
          foreStock.position.set(0, offsetY - 0.03, -length * 0.58);
          const breechLatch = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.06, 0.045), parkerizedMat);
          breechLatch.position.set(0, offsetY + 0.028, -length * 0.42);
          const leafSight = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.08, 0.012), steelMat);
          leafSight.position.set(0, offsetY + 0.1, -length * 0.34);
          const triggerGuard = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.008, 6, 14, Math.PI));
          triggerGuard.material = steelDarkMat;
          triggerGuard.position.set(0, offsetY - 0.11, -length * 0.22);
          triggerGuard.rotation.x = Math.PI;
          group.add(frontGrip, shoulderPad, shoulderRubber, stock, stockPad, foreStock, breechLatch, leafSight, triggerGuard);
        } else if (id === "flamethrower") {
          const nozzleShroud = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.041, 0.22, 12), steelDarkMat);
          nozzleShroud.rotation.x = Math.PI * 0.5;
          nozzleShroud.position.set(0, offsetY + 0.02, -length * 1.02);
          const pilotCone = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.065, 10), brassMat);
          pilotCone.rotation.x = -Math.PI * 0.5;
          pilotCone.position.set(0, offsetY + 0.02, -length * 1.18);
          const tankL = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.34, 12), oliveMat);
          tankL.rotation.x = Math.PI * 0.5;
          tankL.position.set(width * 0.22, offsetY - 0.03, 0.1);
          const tankR = tankL.clone();
          tankR.position.x *= -1;
          const tankBandL = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.11, 0.26), steelMat);
          tankBandL.position.set(width * 0.22, offsetY - 0.03, 0.1);
          const tankBandR = tankBandL.clone();
          tankBandR.position.x *= -1;
          const frame = new THREE.Mesh(new THREE.BoxGeometry(width * 0.5, 0.12, 0.08), parkerizedMat);
          frame.position.set(0, offsetY - 0.03, 0.08);
          const hose = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.006, 6, 20, Math.PI * 0.72), rubberMat);
          hose.position.set(0, offsetY - 0.02, -length * 0.2);
          hose.rotation.set(Math.PI * 0.5, 0, 0);
          group.add(frontGrip, shoulderPad, shoulderRubber, nozzleShroud, pilotCone, tankL, tankR, tankBandL, tankBandR, frame, hose);
        }
        return group;
      }

      const receiverLength = profile === "pistol" ? length * 0.56 : length * 0.48;
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(width, height, receiverLength), steelDarkMat);
      receiver.position.set(0, offsetY, -receiverLength * 0.52);
      group.add(receiver);

      const upper = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.9, Math.max(0.028, height * 0.42), receiverLength * 0.75),
        parkerizedMat,
      );
      upper.position.set(0, offsetY + height * 0.3, -receiverLength * 0.57);
      group.add(upper);

      const ejectionPort = new THREE.Mesh(new THREE.BoxGeometry(width * 0.2, height * 0.14, 0.08), steelDarkMat);
      ejectionPort.position.set(width * 0.26, offsetY + height * 0.22, -receiverLength * 0.56);
      group.add(ejectionPort);
      const receiverPanel = new THREE.Mesh(new THREE.BoxGeometry(width * 0.74, height * 0.2, receiverLength * 0.3), parkerizedMat);
      receiverPanel.position.set(0, offsetY - height * 0.15, -receiverLength * 0.47);
      group.add(receiverPanel);

      const handGuardLength = profile === "pistol" ? length * 0.24 : length * 0.42;
      const handGuardMaterial = profile === "shotgun" || id === "rifle" ? woodMat : polyMat;
      const handGuard = new THREE.Mesh(new THREE.BoxGeometry(width * 0.82, height * 0.78, handGuardLength), handGuardMaterial);
      handGuard.position.set(0, offsetY - height * 0.02, -receiverLength - handGuardLength * 0.45);
      group.add(handGuard);
      for (let i = -2; i <= 2; i += 1) {
        const groove = new THREE.Mesh(new THREE.BoxGeometry(width * 0.08, height * 0.34, handGuardLength * 0.88), rubberMat);
        groove.position.set(i * width * 0.14, offsetY - height * 0.02, -receiverLength - handGuardLength * 0.45);
        group.add(groove);
      }

      const barrelLength = profile === "pistol" ? length * 0.42 : profile === "shotgun" ? length * 0.82 : length * 0.95;
      const barrelRadius = profile === "shotgun" ? 0.02 : profile === "dmr" ? 0.018 : 0.016;
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(barrelRadius, barrelRadius * 1.08, barrelLength, 12), steelMat);
      barrel.rotation.x = Math.PI * 0.5;
      barrel.position.set(0, offsetY + 0.012, -length * 0.9);
      group.add(barrel);

      const muzzle = new THREE.Mesh(
        new THREE.CylinderGeometry(barrelRadius * 1.18, barrelRadius * 1.18, 0.048, 12),
        steelDarkMat,
      );
      muzzle.rotation.x = Math.PI * 0.5;
      muzzle.position.set(0, offsetY + 0.012, -length * 1.38);
      group.add(muzzle);
      const muzzleCrown = new THREE.Mesh(new THREE.CylinderGeometry(barrelRadius * 0.86, barrelRadius * 0.86, 0.012, 10), rubberMat);
      muzzleCrown.rotation.x = Math.PI * 0.5;
      muzzleCrown.position.set(0, offsetY + 0.012, -length * 1.41);
      group.add(muzzleCrown);

      const grip = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.42, height * (profile === "pistol" ? 1.1 : 0.95), width * 0.54),
        profile === "shotgun" ? woodMat : polyMat,
      );
      grip.position.set(0, offsetY - height * 0.6, -receiverLength * 0.2);
      grip.rotation.x = -0.2;
      group.add(grip);
      const gripBackstrap = new THREE.Mesh(new THREE.BoxGeometry(width * 0.24, height * 0.74, width * 0.2), rubberMat);
      gripBackstrap.position.set(0, offsetY - height * 0.62, -receiverLength * 0.02);
      gripBackstrap.rotation.x = -0.2;
      group.add(gripBackstrap);

      if (profile !== "shotgun" && profile !== "pistol") {
        if (id === "rifle") {
          const magUpper = new THREE.Mesh(new THREE.BoxGeometry(width * 0.3, height * 0.38, width * 0.4), steelDarkMat);
          magUpper.position.set(0, offsetY - height * 0.44, -receiverLength * 0.5);
          magUpper.rotation.x = -0.22;
          const magLower = new THREE.Mesh(new THREE.BoxGeometry(width * 0.26, height * 0.34, width * 0.38), steelDarkMat);
          magLower.position.set(0, offsetY - height * 0.72, -receiverLength * 0.46);
          magLower.rotation.x = 0.16;
          group.add(magUpper, magLower);
        } else if (id === "lmg") {
          const feedBox = new THREE.Mesh(new THREE.BoxGeometry(width * 0.34, height * 0.56, width * 0.62), oliveMat);
          feedBox.position.set(0, offsetY - height * 0.4, -receiverLength * 0.58);
          const ammoBox = new THREE.Mesh(new THREE.BoxGeometry(width * 0.62, height * 0.5, width * 0.74), oliveMat);
          ammoBox.position.set(width * 0.3, offsetY - height * 0.44, -receiverLength * 0.62);
          const ammoBoxLid = new THREE.Mesh(new THREE.BoxGeometry(width * 0.58, 0.014, width * 0.76), steelMat);
          ammoBoxLid.position.set(width * 0.3, offsetY - height * 0.17, -receiverLength * 0.62);
          group.add(feedBox, ammoBox, ammoBoxLid);
        } else {
          const mag = new THREE.Mesh(new THREE.BoxGeometry(width * 0.34, height * 0.72, width * 0.42), steelDarkMat);
          mag.position.set(0, offsetY - height * 0.52, -receiverLength * 0.55);
          mag.rotation.x = profile === "rifle" ? -0.2 : -0.08;
          group.add(mag);
        }
        const magPlate = new THREE.Mesh(new THREE.BoxGeometry(width * 0.3, 0.016, width * 0.44), parkerizedMat);
        magPlate.position.set(0, offsetY - height * 0.88, -receiverLength * 0.57);
        group.add(magPlate);
      }

      if (profile === "pistol") {
        const triggerGuard = new THREE.Mesh(new THREE.TorusGeometry(width * 0.16, 0.01, 6, 14, Math.PI));
        triggerGuard.material = polyMat;
        triggerGuard.position.set(0, offsetY - height * 0.28, -receiverLength * 0.15);
        triggerGuard.rotation.x = Math.PI;
        const trigger = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.05, 8), parkerizedMat);
        trigger.rotation.set(Math.PI * 0.5, 0, 0.2);
        trigger.position.set(0, offsetY - height * 0.27, -receiverLength * 0.17);
        const hammer = new THREE.Mesh(new THREE.BoxGeometry(width * 0.22, 0.022, 0.035), steelDarkMat);
        hammer.position.set(0, offsetY + height * 0.53, -receiverLength * 0.14);
        const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.02, 0.02), steelMat);
        frontSight.position.set(0, offsetY + height * 0.58, -receiverLength * 0.9);
        if (id === "revolver") {
          const topStrap = new THREE.Mesh(new THREE.BoxGeometry(width * 0.82, height * 0.22, receiverLength * 0.74), steelMat);
          topStrap.position.set(0, offsetY + height * 0.42, -receiverLength * 0.48);
          const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.18, width * 0.18, width * 0.64, 10), steelDarkMat);
          cylinder.rotation.z = Math.PI * 0.5;
          cylinder.position.set(0, offsetY + height * 0.08, -receiverLength * 0.36);
          const cylinderPin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, width * 0.7, 8), steelMat);
          cylinderPin.rotation.z = Math.PI * 0.5;
          cylinderPin.position.copy(cylinder.position);
          const hammerSpur = new THREE.Mesh(new THREE.BoxGeometry(width * 0.12, 0.036, 0.05), steelMat);
          hammerSpur.position.set(0, offsetY + height * 0.6, -receiverLength * 0.14);
          group.add(topStrap, cylinder, cylinderPin, hammerSpur);
        } else {
          const slide = new THREE.Mesh(new THREE.BoxGeometry(width * 0.8, height * 0.36, receiverLength * 0.86), steelMat);
          slide.name = "vm_slide";
          slide.position.set(0, offsetY + height * 0.42, -receiverLength * 0.52);
          group.add(slide);
          for (let i = 0; i < 4; i += 1) {
            const serrationL = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.024, 0.025), parkerizedMat);
            serrationL.position.set(width * 0.4, offsetY + height * 0.42, -receiverLength * (0.24 + i * 0.1));
            const serrationR = serrationL.clone();
            serrationR.position.x *= -1;
            group.add(serrationL, serrationR);
          }
          if (id === "machine_pistol") {
            const compensator = new THREE.Mesh(new THREE.BoxGeometry(width * 0.34, height * 0.16, 0.085), steelDarkMat);
            compensator.position.set(0, offsetY + height * 0.38, -length * 1.08);
            const magExt = new THREE.Mesh(new THREE.BoxGeometry(width * 0.2, height * 0.76, width * 0.22), steelDarkMat);
            magExt.position.set(0, offsetY - height * 0.86, -receiverLength * 0.14);
            group.add(compensator, magExt);
          }
        }
        group.add(triggerGuard, trigger, hammer, frontSight);
      } else {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(width * 0.58, Math.max(0.014, height * 0.12), receiverLength * 0.86),
          parkerizedMat,
        );
        rail.position.set(0, offsetY + height * 0.56, -receiverLength * 0.56);
        for (let i = 0; i < 6; i += 1) {
          const railTooth = new THREE.Mesh(new THREE.BoxGeometry(width * 0.52, 0.008, 0.014), steelDarkMat);
          railTooth.position.set(0, offsetY + height * 0.57, -receiverLength * (0.2 + i * 0.1));
          group.add(railTooth);
        }
        const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.034, 0.024), steelMat);
        rearSight.position.set(0, offsetY + height * 0.6, -receiverLength * 0.2);
        const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.02), steelMat);
        frontSight.position.set(0, offsetY + height * 0.56, -length * 0.9);
        const bolt = new THREE.Mesh(new THREE.BoxGeometry(width * 0.22, 0.028, receiverLength * 0.32), steelMat);
        bolt.name = "vm_bolt";
        bolt.position.set(width * 0.18, offsetY + height * 0.28, -receiverLength * 0.45);
        group.add(rail, rearSight, frontSight, bolt);
      }

      if (profile === "smg" || profile === "rifle" || profile === "dmr" || profile === "shotgun") {
        const stock = new THREE.Mesh(
          new THREE.BoxGeometry(width * 0.55, height * 0.82, profile === "dmr" ? 0.22 : 0.18),
          profile === "shotgun" ? woodMat : polyMat,
        );
        stock.position.set(0, offsetY - height * 0.04, 0.04);
        group.add(stock);
        const buttPad = new THREE.Mesh(new THREE.BoxGeometry(width * 0.48, height * 0.58, 0.032), rubberMat);
        buttPad.position.set(0, offsetY - height * 0.05, 0.14);
        group.add(buttPad);
      }

      if (profile === "shotgun") {
        const pump = new THREE.Mesh(new THREE.BoxGeometry(width * 0.84, height * 0.54, length * 0.24), woodMat);
        pump.name = "vm_pump";
        pump.position.set(0, offsetY - height * 0.04, -length * 0.86);
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, length * 0.76, 10), steelDarkMat);
        tube.rotation.x = Math.PI * 0.5;
        tube.position.set(0, offsetY - 0.03, -length * 0.72);
        const shellRack = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.2), polyMat);
        shellRack.position.set(width * 0.45, offsetY + 0.015, -receiverLength * 0.42);
        group.add(pump, tube, shellRack);
        for (let i = 0; i < 4; i += 1) {
          const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 8), brassMat);
          shell.rotation.x = Math.PI * 0.5;
          shell.position.set(width * 0.47, offsetY + 0.012, -receiverLength * (0.28 + i * 0.09));
          group.add(shell);
        }
      }

      if (profile === "dmr") {
        const scopeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 12), steelDarkMat);
        scopeBody.rotation.x = Math.PI * 0.5;
        scopeBody.position.set(0, offsetY + height * 0.72, -receiverLength * 0.52);
        const objective = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.036, 12), steelMat);
        objective.rotation.x = Math.PI * 0.5;
        objective.position.set(0, offsetY + height * 0.72, -receiverLength * 0.64);
        const ocular = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.03, 12), steelMat);
        ocular.rotation.x = Math.PI * 0.5;
        ocular.position.set(0, offsetY + height * 0.72, -receiverLength * 0.4);
        const mountL = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.038, 0.016), steelDarkMat);
        mountL.position.set(0, offsetY + height * 0.63, -receiverLength * 0.46);
        const mountR = mountL.clone();
        mountR.position.z = -receiverLength * 0.58;
        group.add(scopeBody, objective, ocular, mountL, mountR);
        if (id === "sniper") {
          const boltHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 8), steelMat);
          boltHandle.rotation.set(0, 0, Math.PI * 0.5);
          boltHandle.position.set(width * 0.34, offsetY + height * 0.22, -receiverLength * 0.34);
          const boltKnob = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), steelDarkMat);
          boltKnob.position.set(width * 0.39, offsetY + height * 0.22, -receiverLength * 0.34);
          const bipodL = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.16, 0.012), steelMat);
          bipodL.position.set(width * 0.16, offsetY - height * 0.24, -length * 0.98);
          bipodL.rotation.z = 0.22;
          const bipodR = bipodL.clone();
          bipodR.position.x *= -1;
          bipodR.rotation.z *= -1;
          group.add(boltHandle, boltKnob, bipodL, bipodR);
        }
      }

      if (profile === "rifle") {
        const gasBlock = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.04, 0.024), steelMat);
        gasBlock.position.set(0, offsetY + 0.03, -length * 1.06);
        const gasTube = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, length * 0.54, 8), steelDarkMat);
        gasTube.rotation.x = Math.PI * 0.5;
        gasTube.position.set(0, offsetY + 0.05, -length * 0.82);
        group.add(gasBlock, gasTube);
        if (id === "battle_rifle") {
          const carryHandle = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 6, 16, Math.PI), steelMat);
          carryHandle.position.set(width * 0.22, offsetY + height * 0.38, -receiverLength * 0.18);
          carryHandle.rotation.set(Math.PI * 0.5, Math.PI * 0.5, 0);
          group.add(carryHandle);
        }
        if (id === "lmg") {
          const bipodL = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.16, 0.016), steelMat);
          bipodL.position.set(width * 0.18, offsetY - height * 0.26, -length * 0.96);
          bipodL.rotation.z = 0.26;
          const bipodR = bipodL.clone();
          bipodR.position.x *= -1;
          bipodR.rotation.z *= -1;
          const carryHandle = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.007, 6, 16, Math.PI), steelDarkMat);
          carryHandle.position.set(0, offsetY + height * 0.42, -length * 0.78);
          carryHandle.rotation.set(Math.PI * 0.5, 0, 0);
          group.add(bipodL, bipodR, carryHandle);
        }
      }

      if (profile === "smg") {
        const foreGrip = new THREE.Mesh(new THREE.BoxGeometry(width * 0.2, height * 0.38, width * 0.2), polyMat);
        foreGrip.position.set(0, offsetY - height * 0.28, -length * 0.76);
        foreGrip.rotation.x = -0.08;
        const stockArmL = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.018, 0.2), steelMat);
        stockArmL.position.set(width * 0.22, offsetY + height * 0.16, 0.04);
        const stockArmR = stockArmL.clone();
        stockArmR.position.x *= -1;
        group.add(foreGrip, stockArmL, stockArmR);
      }

      group.rotation.set(-0.01, -0.03, 0);
      return group;
    };

    const makePipe = () => {
      const group = new THREE.Group();
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.032, 0.74, 10),
        new THREE.MeshStandardMaterial({
          color: 0x606973,
          roughness: 0.34,
          metalness: 0.85,
          emissive: 0x1a2029,
          emissiveIntensity: 0.1,
        }),
      );
      shaft.rotation.z = Math.PI * 0.42;
      shaft.position.set(0.02, -0.02, -0.46);
      const wrappedGrip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.033, 0.033, 0.16, 8),
        new THREE.MeshStandardMaterial({ color: 0x3e444c, roughness: 0.74, metalness: 0.08 }),
      );
      wrappedGrip.rotation.z = Math.PI * 0.42;
      wrappedGrip.position.set(-0.06, -0.11, -0.22);
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.036, 0.036, 0.03, 8),
        new THREE.MeshStandardMaterial({ color: 0x98a84a, roughness: 0.5, metalness: 0.18 }),
      );
      cap.rotation.z = Math.PI * 0.42;
      cap.position.set(0.16, 0.05, -0.69);
      const weldRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.028, 0.005, 7, 16),
        new THREE.MeshStandardMaterial({ color: 0x4e5661, roughness: 0.42, metalness: 0.72 }),
      );
      weldRing.position.set(0.11, 0.03, -0.63);
      weldRing.rotation.set(0, 0, Math.PI * 0.42);
      group.add(shaft, wrappedGrip, cap, weldRing);
      return group;
    };

    const defs = {
      pipe: { id: "pipe", profile: "pipe", length: 0.52, width: 0.08, height: 0.08 },
      pistol: { id: "pistol", profile: "pistol", length: 0.42, width: 0.12, height: 0.1 },
      revolver: { id: "revolver", profile: "pistol", length: 0.48, width: 0.125, height: 0.11 },
      smg: { id: "smg", profile: "smg", length: 0.62, width: 0.13, height: 0.11 },
      machine_pistol: { id: "machine_pistol", profile: "pistol", length: 0.5, width: 0.112, height: 0.096 },
      rifle: { id: "rifle", profile: "rifle", length: 0.78, width: 0.13, height: 0.11 },
      battle_rifle: { id: "battle_rifle", profile: "rifle", length: 0.84, width: 0.135, height: 0.115 },
      shotgun: { id: "shotgun", profile: "shotgun", length: 0.86, width: 0.14, height: 0.12 },
      lmg: { id: "lmg", profile: "rifle", length: 0.9, width: 0.15, height: 0.12 },
      dmr: { id: "dmr", profile: "dmr", length: 0.92, width: 0.12, height: 0.11 },
      sniper: { id: "sniper", profile: "dmr", length: 1.02, width: 0.12, height: 0.11 },
      rpg: { id: "rpg", profile: "launcher", length: 0.96, width: 0.21, height: 0.15, offsetY: 0.03 },
      grenade_launcher: { id: "grenade_launcher", profile: "launcher", length: 0.78, width: 0.18, height: 0.13, offsetY: 0.015 },
      flamethrower: { id: "flamethrower", profile: "launcher", length: 0.98, width: 0.2, height: 0.14, offsetY: 0.02 },
    };

    for (const [id, def] of Object.entries(defs)) {
      const mesh = id === "pipe" ? makePipe() : makeWeapon(def);
      mesh.visible = false;
      const movingParts = {
        bolt: mesh.getObjectByName("vm_bolt") ?? null,
        slide: mesh.getObjectByName("vm_slide") ?? null,
        pump: mesh.getObjectByName("vm_pump") ?? null,
      };
      for (const part of Object.values(movingParts)) {
        if (part) {
          part.userData.basePosition = part.position.clone();
        }
      }
      mesh.traverse((node) => {
        if (!node.isMesh) {
          return;
        }
        node.renderOrder = 10;
        node.material.depthTest = false;
        node.material.depthWrite = false;
      });
      this.viewWeaponMovingParts.set(id, movingParts);
      this.viewWeaponMeshes.set(id, mesh);
      this.viewWeaponRoot.add(mesh);
    }
  }

  refreshViewWeaponModel() {
    if (!this.viewWeaponMeshes.size) {
      return;
    }
    this.viewWeaponFireKick = 0;
    for (const [id, mesh] of this.viewWeaponMeshes.entries()) {
      mesh.visible = id === this.currentWeaponId;
    }
  }

  buildVillage() {
    this.minimapStructures = [];
    const villageGroup = new THREE.Group();
    this.scene.add(villageGroup);

    const wallPlaster = new THREE.MeshStandardMaterial({ color: 0x8c8072, roughness: 0.92, metalness: 0.02 });
    const wallStone = new THREE.MeshStandardMaterial({ color: 0x5d6570, roughness: 0.9, metalness: 0.08 });
    const wallWood = new THREE.MeshStandardMaterial({ color: 0x6a4a35, roughness: 0.88, metalness: 0.04 });
    const roofTile = new THREE.MeshStandardMaterial({ color: 0x7b3327, roughness: 0.78, metalness: 0.08 });
    const roofSlate = new THREE.MeshStandardMaterial({ color: 0x4f5866, roughness: 0.86, metalness: 0.1 });
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x4b545d, roughness: 0.95, metalness: 0.06 });
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0xf4d2a3,
      emissive: 0xffad5f,
      emissiveIntensity: 0.45,
      roughness: 0.35,
      metalness: 0.1,
    });

    const addShadow = (node) => {
      node.traverse((child) => {
        if (!child.isMesh) {
          return;
        }
        child.castShadow = true;
        child.receiveShadow = true;
      });
      return node;
    };

    const addRoad = (size, position) => {
      const road = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), roadMat);
      road.position.copy(position);
      road.receiveShadow = true;
      villageGroup.add(road);
    };

    const registerBreakableWindow = (mesh) => {
      this.breakableWindows.push({
        mesh,
        broken: false,
      });
    };

    const addLamp = (id, position) => {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.11, 2.8, 10),
        new THREE.MeshStandardMaterial({ color: 0x353a42, roughness: 0.7, metalness: 0.35 }),
      );
      pole.position.copy(position).add(new THREE.Vector3(0, 1.4, 0));
      const lantern = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.24, 0.28),
        new THREE.MeshStandardMaterial({
          color: 0xffd49a,
          emissive: 0xffa44f,
          emissiveIntensity: 0.9,
          roughness: 0.4,
          metalness: 0.05,
        }),
      );
      lantern.position.copy(position).add(new THREE.Vector3(0, 2.75, 0));
      villageGroup.add(pole, lantern);
      this.physics.createStaticBox(id, position.clone().add(new THREE.Vector3(0, 1.4, 0)), new THREE.Vector3(0.2, 2.8, 0.2), {
        material: "steel",
      });
      const light = new THREE.PointLight(0xffb46a, 5.8, 11, 2.1);
      light.position.copy(position).add(new THREE.Vector3(0, 2.8, 0));
      villageGroup.add(light);
    };

    const addBuilding = ({ id, position, size, wallMat, roofMat, roofStyle = "gable", towerHeight = 0, sign = false }) => {
      const root = new THREE.Group();

      const base = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), wallMat);
      base.position.copy(position).add(new THREE.Vector3(0, size.y * 0.5, 0));
      root.add(base);

      let roof;
      if (roofStyle === "flat") {
        roof = new THREE.Mesh(new THREE.BoxGeometry(size.x * 1.04, 0.28, size.z * 1.04), roofMat);
        roof.position.copy(position).add(new THREE.Vector3(0, size.y + 0.14, 0));
      } else if (roofStyle === "tower") {
        roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(size.x, size.z) * 0.42, 1.4, 8), roofMat);
        roof.position.copy(position).add(new THREE.Vector3(0, size.y + 0.7, 0));
      } else {
        roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(size.x, size.z) * 0.7, 1.8, 4), roofMat);
        roof.position.copy(position).add(new THREE.Vector3(0, size.y + 0.9, 0));
        roof.rotation.y = Math.PI * 0.25;
      }
      root.add(roof);

      const door = new THREE.Mesh(
        new THREE.BoxGeometry(size.x * 0.2, Math.max(1.1, size.y * 0.42), 0.12),
        new THREE.MeshStandardMaterial({ color: 0x3a261a, roughness: 0.86, metalness: 0.04 }),
      );
      door.position.copy(position).add(new THREE.Vector3(0, size.y * 0.22, size.z * 0.5 + 0.06));
      door.userData = { buildingId: id };
      root.add(door);
      this.buildingDoorMeshes.set(id, door);

      const windowLeft = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.56, 0.08), windowMat);
      windowLeft.position.copy(position).add(new THREE.Vector3(-size.x * 0.22, size.y * 0.58, size.z * 0.5 + 0.08));
      const windowRight = windowLeft.clone();
      windowRight.position.x = position.x + size.x * 0.22;
      root.add(windowLeft, windowRight);
      registerBreakableWindow(windowLeft);
      registerBreakableWindow(windowRight);

      if (towerHeight > 0) {
        const tower = new THREE.Mesh(new THREE.BoxGeometry(size.x * 0.35, towerHeight, size.z * 0.35), wallStone);
        tower.position.copy(position).add(new THREE.Vector3(-size.x * 0.36, size.y + towerHeight * 0.5, -size.z * 0.08));
        const steeple = new THREE.Mesh(new THREE.ConeGeometry(size.x * 0.22, 1.1, 6), roofMat);
        steeple.position.copy(tower.position).add(new THREE.Vector3(0, towerHeight * 0.5 + 0.55, 0));
        root.add(tower, steeple);
        this.physics.createStaticBox(`${id}_tower`, tower.position.clone(), new THREE.Vector3(size.x * 0.35, towerHeight, size.z * 0.35), {
          material: "concrete",
        });
      }

      if (sign) {
        const signPost = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.08, 1.1, 8),
          new THREE.MeshStandardMaterial({ color: 0x3c2d22, roughness: 0.84, metalness: 0.03 }),
        );
        signPost.position.copy(position).add(new THREE.Vector3(size.x * 0.43, 0.55, size.z * 0.46));
        const signBoard = new THREE.Mesh(
          new THREE.BoxGeometry(0.85, 0.32, 0.09),
          new THREE.MeshStandardMaterial({ color: 0x705235, roughness: 0.76, metalness: 0.05 }),
        );
        signBoard.position.copy(signPost.position).add(new THREE.Vector3(0, 0.45, 0));
        root.add(signPost, signBoard);
      }

      addShadow(root);
      villageGroup.add(root);

      const colliderCenter = position.clone().add(new THREE.Vector3(0, size.y * 0.5, 0));
      this.physics.createStaticBox(id, colliderCenter, new THREE.Vector3(size.x, size.y, size.z), {
        material: "wood",
        friction: 0.7,
        restitution: 0.02,
      });

      this.minimapStructures.push({
        id,
        position: position.clone(),
        size: size.clone(),
      });
    };

    addRoad(new THREE.Vector3(8.8, 0.06, 26), new THREE.Vector3(0, 0.03, -11));
    addRoad(new THREE.Vector3(20, 0.06, 6), new THREE.Vector3(0, 0.04, -18.5));

    addBuilding({
      id: "village_townhall",
      position: new THREE.Vector3(0, 0, -19),
      size: new THREE.Vector3(7.4, 3.4, 5.6),
      wallMat: wallWood,
      roofMat: roofTile,
      roofStyle: "gable",
    });
    addBuilding({
      id: "village_chapel",
      position: new THREE.Vector3(-11, 0, -22),
      size: new THREE.Vector3(4.4, 3.8, 4.4),
      wallMat: wallStone,
      roofMat: roofSlate,
      roofStyle: "tower",
      towerHeight: 2.6,
    });
    addBuilding({
      id: "village_blacksmith",
      position: new THREE.Vector3(10.5, 0, -21.5),
      size: new THREE.Vector3(5.6, 3, 4.8),
      wallMat: wallStone,
      roofMat: roofTile,
      roofStyle: "flat",
      sign: true,
    });
    addBuilding({
      id: "village_barn",
      position: new THREE.Vector3(16, 0, -12),
      size: new THREE.Vector3(6.8, 3.1, 5.6),
      wallMat: wallWood,
      roofMat: roofTile,
      roofStyle: "gable",
    });
    addBuilding({
      id: "village_house_a",
      position: new THREE.Vector3(-14.5, 0, -12.5),
      size: new THREE.Vector3(4.8, 2.7, 4.4),
      wallMat: wallPlaster,
      roofMat: roofTile,
      roofStyle: "gable",
    });
    addBuilding({
      id: "village_house_b",
      position: new THREE.Vector3(-8.2, 0, -8.8),
      size: new THREE.Vector3(4.3, 2.5, 3.9),
      wallMat: wallPlaster,
      roofMat: roofSlate,
      roofStyle: "gable",
    });

    const fenceMat = new THREE.MeshStandardMaterial({ color: 0x5c4634, roughness: 0.88, metalness: 0.02 });
    const fenceSegments = [
      { id: "fence_nw", pos: new THREE.Vector3(-20, 0.65, -6.5), size: new THREE.Vector3(10, 1.3, 0.25) },
      { id: "fence_ne", pos: new THREE.Vector3(20, 0.65, -6.5), size: new THREE.Vector3(10, 1.3, 0.25) },
      { id: "fence_w", pos: new THREE.Vector3(-25, 0.65, -14), size: new THREE.Vector3(0.25, 1.3, 12) },
      { id: "fence_e", pos: new THREE.Vector3(25, 0.65, -14), size: new THREE.Vector3(0.25, 1.3, 12) },
    ];
    for (const fence of fenceSegments) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(fence.size.x, fence.size.y, fence.size.z), fenceMat);
      mesh.position.copy(fence.pos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      villageGroup.add(mesh);
      this.physics.createStaticBox(`village_${fence.id}`, fence.pos, fence.size, { material: "wood" });
    }

    addLamp("lamp_center_left", new THREE.Vector3(-4.5, 0, -13.5));
    addLamp("lamp_center_right", new THREE.Vector3(4.5, 0, -13.5));
    addLamp("lamp_market", new THREE.Vector3(11.5, 0, -16.2));

    this.villagePosition = new THREE.Vector3(0, 1.2, -17.5);
    this.villageRadius = 5.6;

    this.createVillageDamageEmitters(villageGroup);
  }

  createVillageDamageEmitters(parentGroup) {
    this.villageDamageEmitters = [];
    const points = [
      new THREE.Vector3(-6.4, 0.15, -16.8),
      new THREE.Vector3(0.5, 0.15, -20.5),
      new THREE.Vector3(7.3, 0.15, -15.6),
    ];

    for (const point of points) {
      const root = new THREE.Group();
      root.position.copy(point);
      root.visible = false;

      const smokePuffs = [];
      for (let i = 0; i < 3; i += 1) {
        const smoke = new THREE.Mesh(
          new THREE.SphereGeometry(0.28 + i * 0.06, 10, 10),
          new THREE.MeshBasicMaterial({
            color: 0x2f3538,
            transparent: true,
            opacity: 0,
            depthWrite: false,
          }),
        );
        smoke.position.set((Math.random() - 0.5) * 0.36, 0.45 + i * 0.24, (Math.random() - 0.5) * 0.36);
        smoke.userData = {
          drift: new THREE.Vector3((Math.random() - 0.5) * 0.12, 0.26 + Math.random() * 0.15, (Math.random() - 0.5) * 0.12),
          phase: Math.random() * Math.PI * 2,
        };
        root.add(smoke);
        smokePuffs.push(smoke);
      }

      const ember = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 8, 8),
        new THREE.MeshBasicMaterial({
          color: 0xffa168,
          transparent: true,
          opacity: 0.45,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      ember.position.set(0, 0.28, 0);
      root.add(ember);

      const light = new THREE.PointLight(0xff8f5c, 0, 9, 2.2);
      light.position.set(0, 0.5, 0);
      root.add(light);

      parentGroup.add(root);
      this.villageDamageEmitters.push({
        root,
        smokePuffs,
        ember,
        light,
        basePosition: point.clone(),
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  spawnVillageDamageBurst(position, intensity = 0.4) {
    const burstCenter = position ? position.clone() : this.villagePosition.clone();
    const burstCount = 4 + Math.round(4 * THREE.MathUtils.clamp(intensity, 0.2, 1));
    for (let i = 0; i < burstCount; i += 1) {
      const ember = new THREE.Mesh(
        new THREE.SphereGeometry(0.03 + Math.random() * 0.025, 7, 7),
        new THREE.MeshBasicMaterial({
          color: i % 2 ? 0xffb173 : 0x9da6b0,
          transparent: true,
          opacity: 0.82,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      ember.position
        .copy(burstCenter)
        .add(new THREE.Vector3((Math.random() - 0.5) * 0.55, 0.22 + Math.random() * 0.45, (Math.random() - 0.5) * 0.55));
      const velocity = new THREE.Vector3((Math.random() - 0.5) * 1.5, 0.9 + Math.random() * 1.5, (Math.random() - 0.5) * 1.5);
      this.createTransientVisual(ember, 0.42 + Math.random() * 0.24, {
        fadeBase: 0.28,
        velocity,
        gravity: 3.2,
      });
    }
  }

  onVillageDamaged(amount, sourcePosition = null) {
    const dealt = Math.max(0, Number(amount ?? 0));
    if (dealt <= 0) {
      return;
    }

    const intensity = THREE.MathUtils.clamp(dealt / 18, 0.2, 1);
    this.villageDamageFlash = Math.min(1.4, this.villageDamageFlash + 0.24 + intensity * 0.24);
    this.villageDamageRecent = Math.min(1, this.villageDamageRecent + 0.18 + intensity * 0.2);
    this.spawnVillageDamageBurst(sourcePosition ?? this.villagePosition, intensity);

    if (this.villageDamageAudioCooldown <= 0) {
      this.game.audio.playVillageUnderAttack(sourcePosition ?? this.villagePosition, intensity);
      this.villageDamageAudioCooldown = VILLAGE_DAMAGE_AUDIO_COOLDOWN + intensity * 0.2;
    }
  }

  onPlayerDamaged(amount) {
    const dealt = Math.max(0, Number(amount ?? 0));
    if (dealt <= 0) {
      return;
    }
    const intensity = THREE.MathUtils.clamp(dealt / 20, 0.12, 0.55);
    this.playerDamageFlash = Math.min(0.8, this.playerDamageFlash + 0.08 + intensity * 0.2);
  }

  updatePlayerDamageEffects(dt = FIXED_TICK) {
    this.playerDamageFlash = Math.max(0, this.playerDamageFlash - dt * PLAYER_DAMAGE_FLASH_DECAY);
    if (this.playerDamageOverlayEl) {
      const overlayOpacity = THREE.MathUtils.clamp(this.playerDamageFlash * 0.22, 0, 0.18);
      this.playerDamageOverlayEl.style.opacity = overlayOpacity.toFixed(3);
    }
  }

  updateVillageDamageEffects(dt = FIXED_TICK) {
    this.villageDamageAudioCooldown = Math.max(0, this.villageDamageAudioCooldown - dt);
    this.villageDamageFlash = Math.max(0, this.villageDamageFlash - dt * VILLAGE_DAMAGE_FLASH_DECAY);
    this.villageDamageRecent = Math.max(0, this.villageDamageRecent - dt * VILLAGE_DAMAGE_RECENT_DECAY);

    const stage = computeVillageDamageStage(this.villageHp, this.maxVillageHp);
    this.villageDamageStage = stage;
    const severity = THREE.MathUtils.clamp(stage / 3 + this.villageDamageRecent * 0.42, 0, 1);
    const activeEmitters = stage;
    const now = performance.now() * 0.001;

    for (let i = 0; i < this.villageDamageEmitters.length; i += 1) {
      const emitter = this.villageDamageEmitters[i];
      const enabled = i < activeEmitters;
      emitter.root.visible = enabled;
      if (!enabled) {
        emitter.light.intensity = 0;
        emitter.ember.material.opacity = 0;
        for (const smoke of emitter.smokePuffs) {
          smoke.material.opacity = 0;
        }
        continue;
      }

      const localIntensity = THREE.MathUtils.clamp(
        0.35 + severity * 0.8 + this.villageDamageFlash * 0.35 + Math.sin(now * 5 + emitter.phase) * 0.08,
        0.18,
        1.2,
      );
      emitter.light.intensity = 0.8 + localIntensity * 2.8;
      emitter.light.distance = 8 + localIntensity * 3;
      emitter.ember.material.opacity = 0.25 + localIntensity * 0.42;
      emitter.ember.scale.setScalar(1 + localIntensity * 0.22);
      emitter.root.position.x = emitter.basePosition.x + Math.sin(now * 0.9 + emitter.phase) * 0.05;
      emitter.root.position.z = emitter.basePosition.z + Math.cos(now * 1.1 + emitter.phase) * 0.05;

      for (const smoke of emitter.smokePuffs) {
        const drift = smoke.userData.drift;
        const phase = smoke.userData.phase;
        smoke.position.x = Math.sin(now * drift.x * 3 + phase) * 0.12;
        smoke.position.z = Math.cos(now * drift.z * 3 + phase) * 0.12;
        smoke.position.y = 0.45 + Math.abs(Math.sin(now * drift.y + phase)) * 0.9;
        smoke.scale.setScalar(1 + localIntensity * 0.45);
        smoke.material.opacity = Math.min(0.55, 0.16 + localIntensity * 0.26);
      }
    }

    const windowIntensity = THREE.MathUtils.clamp(0.45 - stage * 0.1 + Math.sin(now * 7.5) * 0.05, 0.08, 0.58);
    for (const pane of this.breakableWindows) {
      if (pane.broken || !pane.mesh.material) {
        continue;
      }
      pane.mesh.material.emissiveIntensity = windowIntensity;
    }

    if (this.hud) {
      this.hud.classList.toggle("village-damaged", stage >= 1);
      this.hud.classList.toggle("village-critical", stage >= 2);
      this.hud.style.setProperty("--village-alert", severity.toFixed(3));
    }

    if (this.villageDamageOverlayEl) {
      const overlayOpacity = THREE.MathUtils.clamp(stage * 0.045 + this.villageDamageRecent * 0.08 + this.villageDamageFlash * 0.16, 0, 0.42);
      this.villageDamageOverlayEl.style.opacity = overlayOpacity.toFixed(3);
    }
  }

  buildInteriors() {
    this.buildingState = [];
    this.villagers = [];

    const interiorsGroup = new THREE.Group();
    this.scene.add(interiorsGroup);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x5b4e44, roughness: 0.88, metalness: 0.04 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x61513d, roughness: 0.9, metalness: 0.02 });
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.92, metalness: 0.02 });
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xc9f086,
      emissive: 0xb3e86a,
      emissiveIntensity: 0.85,
      roughness: 0.4,
      metalness: 0.05,
    });

    for (const def of this.game.buildingDefs) {
      if (!def.interior) {
        continue;
      }
      const interior = def.interior;
      const center = vec3From(interior.center);
      const size = vec3From(interior.size, { x: 6, y: 3, z: 6 });
      const roomRoot = new THREE.Group();
      interiorsGroup.add(roomRoot);

      const floor = new THREE.Mesh(new THREE.BoxGeometry(size.x, 0.18, size.z), floorMat);
      floor.position.copy(center).add(new THREE.Vector3(0, 0.09, 0));
      const ceiling = new THREE.Mesh(new THREE.BoxGeometry(size.x, 0.14, size.z), ceilingMat);
      ceiling.position.copy(center).add(new THREE.Vector3(0, size.y, 0));
      const wallThickness = 0.2;
      const wallN = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, wallThickness), wallMat);
      wallN.position.copy(center).add(new THREE.Vector3(0, size.y * 0.5, -size.z * 0.5));
      const wallS = wallN.clone();
      wallS.position.z = center.z + size.z * 0.5;
      const wallW = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, size.y, size.z), wallMat);
      wallW.position.copy(center).add(new THREE.Vector3(-size.x * 0.5, size.y * 0.5, 0));
      const wallE = wallW.clone();
      wallE.position.x = center.x + size.x * 0.5;
      roomRoot.add(floor, ceiling, wallN, wallS, wallW, wallE);

      const roomLight = new THREE.PointLight(0xffcfa0, 18, 16, 2);
      roomLight.position.copy(center).add(new THREE.Vector3(0, Math.max(1.7, size.y - 0.45), 0));
      roomRoot.add(roomLight);
      const roomFill = new THREE.PointLight(0xc4d9ff, 6.5, 14, 1.8);
      roomFill.position.copy(center).add(new THREE.Vector3(0, 1, 0));
      roomRoot.add(roomFill);

      roomRoot.traverse((node) => {
        if (!node.isMesh) {
          return;
        }
        node.castShadow = true;
        node.receiveShadow = true;
      });

      this.physics.createStaticBox(
        `interior_floor_${def.id}`,
        center.clone().add(new THREE.Vector3(0, 0.09, 0)),
        new THREE.Vector3(size.x, 0.18, size.z),
        { material: "wood", friction: 0.86, restitution: 0.01 },
      );
      this.physics.createStaticBox(
        `interior_wall_n_${def.id}`,
        wallN.position.clone(),
        new THREE.Vector3(size.x, size.y, wallThickness),
        { material: "wood", friction: 0.8, restitution: 0.01 },
      );
      this.physics.createStaticBox(
        `interior_wall_s_${def.id}`,
        wallS.position.clone(),
        new THREE.Vector3(size.x, size.y, wallThickness),
        { material: "wood", friction: 0.8, restitution: 0.01 },
      );
      this.physics.createStaticBox(
        `interior_wall_w_${def.id}`,
        wallW.position.clone(),
        new THREE.Vector3(wallThickness, size.y, size.z),
        { material: "wood", friction: 0.8, restitution: 0.01 },
      );
      this.physics.createStaticBox(
        `interior_wall_e_${def.id}`,
        wallE.position.clone(),
        new THREE.Vector3(wallThickness, size.y, size.z),
        { material: "wood", friction: 0.8, restitution: 0.01 },
      );

      const doorInside = vec3From(interior.doorInside);
      const insideMarker = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.16, 10), beaconMat);
      insideMarker.position.copy(doorInside).add(new THREE.Vector3(0, -1.02, 0));
      insideMarker.userData = { buildingId: def.id };
      insideMarker.castShadow = true;
      interiorsGroup.add(insideMarker);

      let startDoorBeacon = null;
      let startDoorLight = null;
      if (def.startHouse) {
        startDoorBeacon = new THREE.Mesh(
          new THREE.TorusGeometry(0.35, 0.04, 10, 22),
          new THREE.MeshStandardMaterial({
            color: 0xd9ff9d,
            emissive: 0xb7f26c,
            emissiveIntensity: 1.15,
            roughness: 0.25,
            metalness: 0.05,
          }),
        );
        startDoorBeacon.rotation.x = Math.PI * 0.5;
        startDoorBeacon.position.copy(doorInside).add(new THREE.Vector3(0, -0.95, 0));
        interiorsGroup.add(startDoorBeacon);

        startDoorLight = new THREE.PointLight(0xd6ff97, 10, 6.8, 2.2);
        startDoorLight.position.copy(doorInside).add(new THREE.Vector3(0, 0.5, -0.12));
        interiorsGroup.add(startDoorLight);
      }

      const state = {
        id: def.id,
        label: def.label ?? def.id,
        startHouse: Boolean(def.startHouse),
        opened: this.game.save.openedBuildings.includes(def.id),
        exteriorDoor: vec3From(def.exteriorDoor),
        exteriorSpawn: vec3From(def.exteriorSpawn),
        interiorSpawn: vec3From(interior.spawnInside),
        interiorDoor: doorInside,
        insideMarker,
        startDoorBeacon,
        startDoorLight,
      };
      this.buildingState.push(state);

      for (const villager of interior.villagerSpots ?? []) {
        const villagerRoot = new THREE.Group();
        const body = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.22, 0.68, 6, 12),
          new THREE.MeshStandardMaterial({
            color: 0xaab5c3,
            roughness: 0.86,
            metalness: 0.03,
            emissive: 0x0f1f2a,
            emissiveIntensity: 0.24,
          }),
        );
        body.position.y = 0.62;
        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 10, 10),
          new THREE.MeshStandardMaterial({
            color: 0xe6c5aa,
            roughness: 0.74,
            metalness: 0.02,
          }),
        );
        head.position.y = 1.16;
        villagerRoot.add(body, head);
        villagerRoot.position.copy(vec3From(villager));
        villagerRoot.traverse((node) => {
          if (!node.isMesh) {
            return;
          }
          node.castShadow = true;
          node.receiveShadow = true;
        });
        interiorsGroup.add(villagerRoot);
        const healthBarRoot = this.createVillagerHealthBar(villagerRoot);
        const state = this.resolveVillagerPersistenceState(villager.id);
        villagerRoot.visible = state === "idle";
        this.villagers.push({
          id: villager.id,
          buildingId: def.id,
          mesh: villagerRoot,
          state,
          hp: ESCORT_HP_BASE,
          maxHp: ESCORT_HP_BASE,
          healthBarRoot,
          healthBarFill: healthBarRoot.userData.fill ?? null,
        });
      }
    }
  }

  buildPerimeter() {
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x2d323a, roughness: 0.86, metalness: 0.12 });
    const walls = [
      { id: "wall_n", pos: new THREE.Vector3(0, 1.5, -42), size: new THREE.Vector3(84, 3, 1.5) },
      { id: "wall_s", pos: new THREE.Vector3(0, 1.5, 42), size: new THREE.Vector3(84, 3, 1.5) },
      { id: "wall_w", pos: new THREE.Vector3(-42, 1.5, 0), size: new THREE.Vector3(1.5, 3, 84) },
      { id: "wall_e", pos: new THREE.Vector3(42, 1.5, 0), size: new THREE.Vector3(1.5, 3, 84) },
    ];

    for (const wall of walls) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(wall.size.x, wall.size.y, wall.size.z), wallMaterial);
      mesh.position.copy(wall.pos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.physics.createStaticBox(wall.id, wall.pos, wall.size, { material: "concrete" });
    }
  }

  buildLandscape() {
    const group = new THREE.Group();
    this.scene.add(group);

    const terrainMat = new THREE.MeshStandardMaterial({ color: 0x4e5b49, roughness: 0.94, metalness: 0.02 });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x5f686f, roughness: 0.88, metalness: 0.08 });
    const bankMat = new THREE.MeshStandardMaterial({ color: 0x3d3224, roughness: 0.96, metalness: 0.02 });
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x2b4f5e,
      emissive: 0x1a3a44,
      emissiveIntensity: 0.62,
      roughness: 0.32,
      metalness: 0.18,
      transparent: true,
      opacity: 0.82,
    });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4d3825, roughness: 0.86, metalness: 0.03 });
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x2f5334, roughness: 0.88, metalness: 0.04 });
    const deadFoliageMat = new THREE.MeshStandardMaterial({ color: 0x445144, roughness: 0.9, metalness: 0.03 });
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x60734f, roughness: 0.95, metalness: 0.01 });

    const markShadow = (node) => {
      node.traverse((child) => {
        if (!child.isMesh) {
          return;
        }
        child.castShadow = true;
        child.receiveShadow = true;
      });
      return node;
    };

    const registerTransformableLandscape = (entry) => {
      this.transformableLandscape.push({
        id: entry.id,
        mesh: entry.mesh,
        position: entry.position.clone(),
        colliderId: entry.colliderId ?? null,
        colliderCenter: entry.colliderCenter ? entry.colliderCenter.clone() : null,
        colliderSize: entry.colliderSize ? entry.colliderSize.clone() : null,
        colliderOptions: entry.colliderOptions ? { ...entry.colliderOptions } : null,
        consumed: false,
      });
    };

    const addMound = (id, position, radius, height) => {
      const mound = new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 14), terrainMat);
      mound.scale.y = height / radius;
      mound.position.copy(position).add(new THREE.Vector3(0, Math.max(0.45, height * 0.45), 0));
      markShadow(mound);
      group.add(mound);

      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(radius * (0.18 + Math.random() * 0.08), 0),
        rockMat,
      );
      rock.position.copy(position).add(new THREE.Vector3(radius * 0.16, height * 0.85, -radius * 0.12));
      rock.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, 0);
      markShadow(rock);
      group.add(rock);

      this.physics.createStaticBox(`landscape_${id}`, position.clone().add(new THREE.Vector3(0, height * 0.36, 0)), new THREE.Vector3(radius * 1.25, height * 0.72, radius * 1.25), {
        material: "soil",
        friction: 0.92,
        restitution: 0.01,
      });
    };

    const addCreek = (id, points, width) => {
      const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p.x, 0.05, p.z)));
      const bank = new THREE.Mesh(new THREE.TubeGeometry(curve, 84, width + 0.34, 10, false), bankMat);
      bank.position.y = -0.12;
      markShadow(bank);
      group.add(bank);

      const water = new THREE.Mesh(new THREE.TubeGeometry(curve, 84, width, 10, false), waterMat);
      water.position.y = -0.02;
      markShadow(water);
      group.add(water);

      for (let i = 0; i < 7; i += 1) {
        const t = (i + 1) / 8;
        const center = curve.getPointAt(t);
        const tangent = curve.getTangentAt(t).normalize();
        const side = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const leftRock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.34 + Math.random() * 0.16, 0), rockMat);
        leftRock.position.copy(center).addScaledVector(side, width + 0.42 + Math.random() * 0.24);
        leftRock.position.y = 0.07;
        const rightRock = leftRock.clone();
        rightRock.position.copy(center).addScaledVector(side, -(width + 0.42 + Math.random() * 0.24));
        markShadow(leftRock);
        markShadow(rightRock);
        group.add(leftRock, rightRock);
      }

      const mid = points[Math.floor(points.length * 0.5)];
      this.physics.createStaticBox(
        `landscape_creek_${id}`,
        new THREE.Vector3(mid.x, -0.25, mid.z),
        new THREE.Vector3(10, 0.5, width * 4.2),
        { material: "soil", friction: 0.88, restitution: 0.01 },
      );
    };

    const addTree = (id, position, scale = 1, dead = false) => {
      const root = new THREE.Group();
      const trunkHeight = 2 + scale * 1.45;
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18 * scale, 0.24 * scale, trunkHeight, 9),
        trunkMat,
      );
      trunk.position.y = trunkHeight * 0.5;
      root.add(trunk);

      if (dead) {
        const branchA = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * scale, 0.05 * scale, 0.85 * scale, 7), trunkMat);
        const branchB = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * scale, 0.05 * scale, 0.95 * scale, 7), trunkMat);
        branchA.position.set(0.16 * scale, trunkHeight * 0.72, 0);
        branchB.position.set(-0.14 * scale, trunkHeight * 0.64, 0.08 * scale);
        branchA.rotation.z = -0.8;
        branchB.rotation.z = 0.7;
        root.add(branchA, branchB);
      } else {
        const canopyA = new THREE.Mesh(new THREE.ConeGeometry(0.78 * scale, 1.5 * scale, 10), foliageMat);
        const canopyB = new THREE.Mesh(new THREE.ConeGeometry(0.62 * scale, 1.25 * scale, 10), dead ? deadFoliageMat : foliageMat);
        canopyA.position.y = trunkHeight + 0.62 * scale;
        canopyB.position.y = trunkHeight + 1.34 * scale;
        root.add(canopyA, canopyB);
      }

      root.position.copy(position);
      root.rotation.y = Math.random() * Math.PI;
      markShadow(root);
      group.add(root);

      let colliderId = null;
      let colliderCenter = null;
      let colliderSize = null;
      let colliderOptions = null;
      if (Math.abs(position.x) < 33 && Math.abs(position.z) < 33) {
        colliderId = `landscape_tree_${id}`;
        colliderCenter = position.clone().add(new THREE.Vector3(0, trunkHeight * 0.5, 0));
        colliderSize = new THREE.Vector3(0.52 * scale, trunkHeight, 0.52 * scale);
        colliderOptions = { material: "wood", friction: 0.9, restitution: 0.01 };
        this.physics.createStaticBox(colliderId, colliderCenter, colliderSize, colliderOptions);
      }

      if (colliderId) {
        registerTransformableLandscape({
          id: `tree_${id}`,
          mesh: root,
          position,
          colliderId,
          colliderCenter,
          colliderSize,
          colliderOptions,
        });
      }
    };

    addMound("mound_nw", new THREE.Vector3(-28, 0, -30), 5.4, 2.1);
    addMound("mound_ne", new THREE.Vector3(28, 0, -29), 5.2, 1.9);
    addMound("mound_sw", new THREE.Vector3(-30, 0, 30), 5.9, 2.2);
    addMound("mound_se", new THREE.Vector3(30, 0, 29), 5.7, 2);
    addMound("mound_mid_w", new THREE.Vector3(-19, 0, 8), 3.7, 1.2);
    addMound("mound_mid_e", new THREE.Vector3(18, 0, 11), 3.5, 1.1);

    addCreek(
      "west",
      [
        { x: -34, z: 26 },
        { x: -27, z: 17 },
        { x: -24, z: 6 },
        { x: -26, z: -6 },
        { x: -31, z: -20 },
      ],
      0.95,
    );
    addCreek(
      "east",
      [
        { x: 35, z: 23 },
        { x: 28, z: 13 },
        { x: 25, z: 1 },
        { x: 27, z: -10 },
        { x: 33, z: -24 },
      ],
      0.9,
    );

    const treePositions = [
      new THREE.Vector3(-36, 0, 34),
      new THREE.Vector3(-31, 0, 30),
      new THREE.Vector3(-27, 0, 25),
      new THREE.Vector3(-34, 0, 18),
      new THREE.Vector3(-37, 0, 8),
      new THREE.Vector3(-36, 0, -3),
      new THREE.Vector3(-33, 0, -14),
      new THREE.Vector3(-30, 0, -25),
      new THREE.Vector3(-24, 0, -33),
      new THREE.Vector3(-9, 0, -33),
      new THREE.Vector3(8, 0, -34),
      new THREE.Vector3(23, 0, -33),
      new THREE.Vector3(33, 0, -26),
      new THREE.Vector3(36, 0, -14),
      new THREE.Vector3(37, 0, -3),
      new THREE.Vector3(35, 0, 8),
      new THREE.Vector3(32, 0, 18),
      new THREE.Vector3(28, 0, 28),
      new THREE.Vector3(18, 0, 34),
      new THREE.Vector3(3, 0, 35),
      new THREE.Vector3(-12, 0, 34),
      new THREE.Vector3(-22, 0, 31),
      new THREE.Vector3(-18, 0, 10),
      new THREE.Vector3(19, 0, 13),
      new THREE.Vector3(23, 0, 4),
      new THREE.Vector3(-22, 0, -2),
    ];

    for (let i = 0; i < treePositions.length; i += 1) {
      const pos = treePositions[i];
      const scale = 0.78 + Math.random() * 0.5;
      const dead = i % 7 === 0;
      addTree(i, pos, scale, dead);
    }

    const foliageBlockedZones = [
      { center: new THREE.Vector3(0, 0, -19), size: new THREE.Vector3(7.4, 0, 5.6) },
      { center: new THREE.Vector3(-11, 0, -22), size: new THREE.Vector3(4.4, 0, 4.4) },
      { center: new THREE.Vector3(10.5, 0, -21.5), size: new THREE.Vector3(5.6, 0, 4.8) },
      { center: new THREE.Vector3(16, 0, -12), size: new THREE.Vector3(6.8, 0, 5.6) },
      { center: new THREE.Vector3(-14.5, 0, -12.5), size: new THREE.Vector3(4.8, 0, 4.4) },
      { center: new THREE.Vector3(-8.2, 0, -8.8), size: new THREE.Vector3(4.3, 0, 3.9) },
    ];
    for (const def of this.game.buildingDefs ?? []) {
      if (!def?.interior) {
        continue;
      }
      foliageBlockedZones.push({
        center: vec3From(def.interior.center),
        size: vec3From(def.interior.size, { x: 6, y: 3, z: 6 }),
      });
    }

    const isFoliageBlocked = (x, z, padding = 0.7) =>
      foliageBlockedZones.some((zone) => {
        const halfX = zone.size.x * 0.5 + padding;
        const halfZ = zone.size.z * 0.5 + padding;
        return Math.abs(x - zone.center.x) <= halfX && Math.abs(z - zone.center.z) <= halfZ;
      });

    let spawnedGrass = 0;
    let grassAttempts = 0;
    while (spawnedGrass < 24 && grassAttempts < 320) {
      grassAttempts += 1;
      const x = -30 + Math.random() * 60;
      const z = -34 + Math.random() * 68;
      if (isFoliageBlocked(x, z)) {
        continue;
      }
      const grass = new THREE.Mesh(
        new THREE.ConeGeometry(0.18 + Math.random() * 0.18, 0.45 + Math.random() * 0.35, 7),
        grassMat,
      );
      grass.position.set(x, 0.22, z);
      grass.rotation.y = Math.random() * Math.PI;
      markShadow(grass);
      group.add(grass);
      spawnedGrass += 1;
    }
  }

  buildProps() {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x775b41, roughness: 0.84, metalness: 0.05 });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x4a5058, roughness: 0.7, metalness: 0.42 });
    const hayMat = new THREE.MeshStandardMaterial({ color: 0x9a8848, roughness: 0.92, metalness: 0.01 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6f7680, roughness: 0.9, metalness: 0.08 });

    const propDefs = [
      { id: "market_crate_a", type: "crate", pos: new THREE.Vector3(8, 0, -14.5), size: new THREE.Vector3(1.1, 0.9, 1.1), mass: 26 },
      { id: "market_crate_b", type: "crate", pos: new THREE.Vector3(9.4, 0, -15.2), size: new THREE.Vector3(0.9, 0.8, 0.9), mass: 20 },
      { id: "market_barrel", type: "barrel", pos: new THREE.Vector3(10.8, 0, -14.1), size: new THREE.Vector3(0.8, 1.1, 0.8), mass: 22 },
      { id: "barn_hay_a", type: "haybale", pos: new THREE.Vector3(13.8, 0, -9.7), size: new THREE.Vector3(1.5, 0.75, 1), mass: 18 },
      { id: "barn_hay_b", type: "haybale", pos: new THREE.Vector3(15.8, 0, -9.3), size: new THREE.Vector3(1.4, 0.72, 0.95), mass: 17 },
      { id: "well_stone", type: "stone", pos: new THREE.Vector3(-2.6, 0, -12.6), size: new THREE.Vector3(1.2, 0.65, 1.2), mass: 34 },
      { id: "grave_a", type: "tombstone", pos: new THREE.Vector3(-18.4, 0, -22.7), size: new THREE.Vector3(0.7, 1.2, 0.34), mass: 24 },
      { id: "grave_b", type: "tombstone", pos: new THREE.Vector3(-17.2, 0, -24), size: new THREE.Vector3(0.74, 1.3, 0.34), mass: 26 },
      { id: "grave_c", type: "tombstone", pos: new THREE.Vector3(-19.5, 0, -24.8), size: new THREE.Vector3(0.62, 1.05, 0.3), mass: 20 },
      { id: "cart", type: "cart", pos: new THREE.Vector3(3.7, 0, -10.7), size: new THREE.Vector3(1.9, 0.9, 1.2), mass: 35 },
      { id: "crate_lane_a", type: "crate", pos: new THREE.Vector3(-7.5, 0, -7.4), size: new THREE.Vector3(1, 0.8, 1), mass: 22 },
      { id: "crate_lane_b", type: "crate", pos: new THREE.Vector3(-9.4, 0, -6.7), size: new THREE.Vector3(0.9, 0.78, 0.9), mass: 18 },
    ];

    const markShadow = (node) => {
      node.traverse((child) => {
        if (!child.isMesh) {
          return;
        }
        child.castShadow = true;
        child.receiveShadow = true;
      });
      return node;
    };

    for (const prop of propDefs) {
      const size = prop.size.clone();
      const bodyPos = prop.pos.clone().add(new THREE.Vector3(0, size.y * 0.5, 0));
      const entity = this.physics.createDynamicBox(`prop_${prop.id}`, bodyPos, size, prop.mass, {
        material: prop.type === "stone" || prop.type === "tombstone" ? "concrete" : "wood",
      });

      let mesh;
      if (prop.type === "barrel") {
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(size.x * 0.45, size.x * 0.5, size.y, 12), woodMat);
      } else if (prop.type === "haybale") {
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(size.y * 0.5, size.y * 0.5, size.x, 12), hayMat);
        mesh.rotation.z = Math.PI * 0.5;
      } else if (prop.type === "tombstone") {
        mesh = new THREE.Group();
        const slab = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y * 0.82, size.z), stoneMat);
        slab.position.y = -size.y * 0.1;
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(size.x * 0.5, size.x * 0.5, size.z, 10), stoneMat);
        cap.rotation.x = Math.PI * 0.5;
        cap.position.y = size.y * 0.32;
        mesh.add(slab, cap);
      } else if (prop.type === "cart") {
        mesh = new THREE.Group();
        const bed = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y * 0.55, size.z), woodMat);
        bed.position.y = 0.05;
        const wheelGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.12, 10);
        const wheelA = new THREE.Mesh(wheelGeo, ironMat);
        const wheelB = wheelA.clone();
        const wheelC = wheelA.clone();
        const wheelD = wheelA.clone();
        wheelA.rotation.z = Math.PI * 0.5;
        wheelB.rotation.z = Math.PI * 0.5;
        wheelC.rotation.z = Math.PI * 0.5;
        wheelD.rotation.z = Math.PI * 0.5;
        wheelA.position.set(-size.x * 0.42, -size.y * 0.2, -size.z * 0.42);
        wheelB.position.set(size.x * 0.42, -size.y * 0.2, -size.z * 0.42);
        wheelC.position.set(-size.x * 0.42, -size.y * 0.2, size.z * 0.42);
        wheelD.position.set(size.x * 0.42, -size.y * 0.2, size.z * 0.42);
        mesh.add(bed, wheelA, wheelB, wheelC, wheelD);
      } else if (prop.type === "stone") {
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(size.x * 0.48, size.x * 0.55, size.y, 10), stoneMat);
      } else {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), woodMat);
      }

      mesh.position.copy(bodyPos);
      markShadow(mesh);
      this.scene.add(mesh);
      this.props.push({ id: `prop_${prop.id}`, entity, mesh, size, ttl: Infinity });
    }
  }

  createHud() {
    const hud = document.createElement("div");
    hud.className = "fps-hud";
    hud.innerHTML = `
      <div class="fps-hud-health">
        <div class="fps-hud-health-item player">
          <div class="fps-hud-health-label" data-hud="player-bar-label">Health</div>
          <div class="fps-hud-health-track">
            <div class="fps-hud-health-fill player" data-hud="player-bar-fill"></div>
          </div>
        </div>
        <div class="fps-hud-health-item stamina">
          <div class="fps-hud-health-label" data-hud="stamina-bar-label">Stamina</div>
          <div class="fps-hud-health-track">
            <div class="fps-hud-health-fill stamina" data-hud="stamina-bar-fill"></div>
          </div>
        </div>
        <div class="fps-hud-health-item village">
          <div class="fps-hud-health-label" data-hud="village-bar-label">Village</div>
          <div class="fps-hud-health-track">
            <div class="fps-hud-health-fill village" data-hud="village-bar-fill"></div>
          </div>
        </div>
      </div>
      <div class="fps-hud-summary">
        <div class="fps-hud-chip" data-hud="wave"></div>
        <div class="fps-hud-chip" data-hud="coins"></div>
        <div class="fps-hud-chip" data-hud="enemies"></div>
        <div class="fps-hud-chip" data-hud="grenade"></div>
      </div>
      <div class="fps-hud-line" data-hud="prompt"></div>
      <div class="fps-hud-line fps-controls" data-hud="controls"></div>
    `;
    document.body.appendChild(hud);
    this.createWeaponIndicator();
    this.createMiniMap();

    if (!this.shopActionsEl) {
      const actions = document.createElement("div");
      actions.className = "fps-raid-actions";
      actions.innerHTML = `
        <button class="fps-quick-btn fps-grenade-quick" type="button">Frag</button>
        <button class="fps-quick-btn fps-swap-quick" type="button">Swap</button>
        <button class="fps-quick-btn fps-shop-quick" type="button">Shop</button>
        <button class="fps-quick-btn fps-fullscreen-quick" type="button">Full</button>
        <button class="fps-quick-btn fps-help-quick" type="button" aria-label="Show controls">?</button>
        <button class="fps-quick-btn fps-tray-quick" type="button" aria-label="Open utility tray">+</button>
      `;
      const grenadeButton = actions.querySelector(".fps-grenade-quick");
      const swapButton = actions.querySelector(".fps-swap-quick");
      const button = actions.querySelector(".fps-shop-quick");
      const fullscreenButton = actions.querySelector(".fps-fullscreen-quick");
      const helpButton = actions.querySelector(".fps-help-quick");
      const trayButton = actions.querySelector(".fps-tray-quick");
      if (grenadeButton) {
        grenadeButton.addEventListener("click", () => {
          if (this.game.mode !== "raid") {
            return;
          }
          this.cycleGrenadeType();
        });
      }
      if (swapButton) {
        swapButton.addEventListener("click", () => {
          if (this.game.mode !== "raid") {
            return;
          }
          this.cycleOwnedWeapon();
          this.mobileUtilityTrayOpen = false;
        });
      }
      if (button) {
        button.addEventListener("click", () => {
          if (this.game.mode !== "raid") {
            return;
          }
          this.mobileUtilityTrayOpen = false;
          this.openShopFromRaid();
        });
      }
      if (fullscreenButton) {
        fullscreenButton.addEventListener("click", () => {
          this.game.toggleFullscreen();
        });
      }
      if (helpButton) {
        helpButton.addEventListener("click", () => {
          if (this.game.mode !== "raid") {
            return;
          }
          this.mobileInstructionsOpen = !this.mobileInstructionsOpen;
        });
      }
      if (trayButton) {
        trayButton.addEventListener("click", () => {
          if (this.game.mode !== "raid") {
            return;
          }
          if (this.game.mobileControls?.enabled && window.matchMedia("(orientation: portrait)").matches) {
            this.mobileUtilityTrayOpen = false;
            this.mobileInstructionsOpen = false;
            this.openShopFromRaid();
            return;
          }
          this.mobileUtilityTrayOpen = !this.mobileUtilityTrayOpen;
          if (!this.mobileUtilityTrayOpen) {
            this.mobileInstructionsOpen = false;
          }
        });
      }
      document.body.appendChild(actions);
      this.shopActionsEl = actions;
      this.grenadeQuickButtonEl = grenadeButton;
      this.shopQuickButtonEl = button;
      this.swapQuickButtonEl = swapButton;
      this.fullscreenQuickButtonEl = fullscreenButton;
      this.helpQuickButtonEl = helpButton;
      this.trayQuickButtonEl = trayButton;
      this.syncFullscreenButtonState({
        supported: this.game.isFullscreenSupported(),
        active: this.game.isFullscreenActive(),
      });
    }

    return hud;
  }

  syncFullscreenButtonState({ supported, active }) {
    if (!this.fullscreenQuickButtonEl) {
      return;
    }
    this.fullscreenQuickButtonEl.style.display = supported ? "inline-flex" : "none";
    this.fullscreenQuickButtonEl.textContent = active ? "Exit" : "Full";
    this.fullscreenQuickButtonEl.setAttribute("aria-label", active ? "Exit fullscreen" : "Enter fullscreen");
  }

  createInteractPrompt() {
    if (this.interactPromptEl) {
      return;
    }
    const node = document.createElement("div");
    node.className = "fps-interact-prompt";
    node.innerHTML = `
      <span class="fps-interact-key">E</span>
      <span class="fps-interact-text">Open door</span>
    `;
    node.classList.toggle("mobile", Boolean(this.game.mobileControls?.enabled));
    document.body.appendChild(node);
    this.interactPromptEl = node;
  }

  createWeaponIndicator() {
    if (this.game.mobileControls?.enabled) {
      if (this.weaponIndicatorEl) {
        this.weaponIndicatorEl.remove();
        this.weaponIndicatorEl = null;
      }
      return;
    }
    if (this.weaponIndicatorEl) {
      return;
    }
    const node = document.createElement("div");
    node.className = "fps-weapon-indicator";
    node.innerHTML = `
      <div class="fps-weapon-indicator-card">
        <div class="fps-weapon-indicator-glyph" data-bind="glyph">HG</div>
        <div class="fps-weapon-indicator-meta">
          <div class="fps-weapon-indicator-name" data-bind="name">Pistol</div>
          <div class="fps-weapon-indicator-style" data-bind="style">Balanced sidearm</div>
        </div>
      </div>
    `;
    document.body.appendChild(node);
    this.weaponIndicatorEl = node;
  }

  createMiniMap() {
    if (this.minimapEl) {
      return;
    }
    const node = document.createElement("div");
    node.className = "fps-minimap-panel";
    node.innerHTML = `
      <div class="fps-minimap-header">Mini Map</div>
      <canvas class="fps-minimap-canvas" width="180" height="180"></canvas>
      <div class="fps-minimap-legend">
        <span class="player">You</span>
        <span class="enemy">Zombie</span>
        <span class="village">Village</span>
        <span class="villager">Villager</span>
        <span class="door">Door</span>
        <span class="destination">Dropoff</span>
      </div>
    `;
    document.body.appendChild(node);
    this.minimapEl = node;
    this.minimapCanvasEl = node.querySelector(".fps-minimap-canvas");
    this.minimapCtx = this.minimapCanvasEl?.getContext("2d") ?? null;
  }

  drawMiniMap() {
    if (!this.minimapCtx || !this.minimapCanvasEl || !this.minimapOpen) {
      return;
    }

    const ctx = this.minimapCtx;
    const size = this.minimapCanvasEl.width;
    const pad = MINIMAP_PADDING_PX;
    const drawSize = size - pad * 2;

    ctx.clearRect(0, 0, size, size);
    const bg = ctx.createLinearGradient(0, 0, 0, size);
    bg.addColorStop(0, "rgba(12,24,26,0.92)");
    bg.addColorStop(1, "rgba(8,12,18,0.94)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = "rgba(184,242,114,0.28)";
    ctx.lineWidth = 1;
    ctx.strokeRect(pad, pad, drawSize, drawSize);

    const toMap = (vec) =>
      worldToMiniMapPoint({
        x: vec.x,
        z: vec.z,
        worldHalfExtent: MINIMAP_WORLD_HALF_EXTENT,
        mapSizePx: size,
        paddingPx: pad,
      });

    if (!this.villageDestroyed) {
      const villagePoint = toMap(this.villagePosition ?? new THREE.Vector3());
      const villageRadius = worldRadiusToMiniMapPx({
        radius: this.villageRadius ?? 5.6,
        worldHalfExtent: MINIMAP_WORLD_HALF_EXTENT,
        mapSizePx: size,
        paddingPx: pad,
        minPx: 4,
        maxPx: 22,
      });
      ctx.fillStyle = "rgba(242,222,138,0.16)";
      ctx.beginPath();
      ctx.arc(villagePoint.x, villagePoint.y, villageRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(242,222,138,0.58)";
      ctx.beginPath();
      ctx.arc(villagePoint.x, villagePoint.y, villageRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(92, 104, 122, 0.62)";
    ctx.strokeStyle = "rgba(184, 242, 114, 0.17)";
    for (const structure of this.minimapStructures) {
      const center = toMap(structure.position);
      const halfW = worldRadiusToMiniMapPx({
        radius: structure.size.x * 0.5,
        worldHalfExtent: MINIMAP_WORLD_HALF_EXTENT,
        mapSizePx: size,
        paddingPx: pad,
        minPx: 2,
        maxPx: 20,
      });
      const halfH = worldRadiusToMiniMapPx({
        radius: structure.size.z * 0.5,
        worldHalfExtent: MINIMAP_WORLD_HALF_EXTENT,
        mapSizePx: size,
        paddingPx: pad,
        minPx: 2,
        maxPx: 20,
      });
      ctx.fillRect(center.x - halfW, center.y - halfH, halfW * 2, halfH * 2);
      ctx.strokeRect(center.x - halfW, center.y - halfH, halfW * 2, halfH * 2);
    }

    ctx.fillStyle = "rgba(188, 235, 135, 0.75)";
    for (const building of this.buildingState) {
      const point = toMap(building.exteriorDoor);
      const sizePx = building.startHouse ? 5 : 4;
      ctx.fillRect(point.x - sizePx * 0.5, point.y - sizePx * 0.5, sizePx, sizePx);
    }

    for (const villager of this.villagers) {
      if (!villager.mesh?.visible) {
        continue;
      }
      if (villager.state !== "idle" && villager.state !== "escorting") {
        continue;
      }
      const point = toMap(villager.mesh.position);
      const isEscort = villager.id === this.activeEscortVillagerId && villager.state === "escorting";
      ctx.fillStyle = isEscort ? "rgba(74, 171, 255, 0.98)" : "rgba(74, 171, 255, 0.9)";
      ctx.beginPath();
      ctx.arc(point.x, point.y, isEscort ? 2.4 : 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.activeEscortVillagerId && this.escortDropoff?.position) {
      const escort = this.villagers.find((entry) => entry.id === this.activeEscortVillagerId);
      const dropoffPoint = toMap(this.escortDropoff.position);
      const dropoffRadiusPx = worldRadiusToMiniMapPx({
        radius: this.escortDropoff.radius,
        worldHalfExtent: MINIMAP_WORLD_HALF_EXTENT,
        mapSizePx: size,
        paddingPx: pad,
        minPx: 4,
        maxPx: 18,
      });

      ctx.strokeStyle = "rgba(255,214,120,0.85)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(dropoffPoint.x, dropoffPoint.y, dropoffRadiusPx, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,214,120,0.95)";
      ctx.beginPath();
      ctx.arc(dropoffPoint.x, dropoffPoint.y, 2.2, 0, Math.PI * 2);
      ctx.fill();

      if (escort?.mesh) {
        const escortPoint = toMap(escort.mesh.position);
        ctx.strokeStyle = "rgba(255,214,120,0.55)";
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(escortPoint.x, escortPoint.y);
        ctx.lineTo(dropoffPoint.x, dropoffPoint.y);
        ctx.stroke();
      }
    }

    for (const enemy of this.enemies) {
      if (!enemy?.mesh || enemy.hp <= 0) {
        continue;
      }
      const point = toMap(enemy.mesh.position);
      const scale = Number(enemy.sizeScale ?? 1);
      const radius = THREE.MathUtils.clamp(2 + scale * 0.9 + (enemy.boss ? 2 : 0), 2, 7.5);
      const color = enemy.boss ? "rgba(255,110,84,0.96)" : "rgba(255,86,110,0.88)";
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const playerPoint = toMap(this.playerController.state.position);
    const yaw = Number(this.playerController.state.yaw ?? 0);
    const facing = new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
    ctx.save();
    ctx.translate(playerPoint.x, playerPoint.y);
    ctx.fillStyle = "rgba(188,242,114,1)";
    const tipX = facing.x * 7;
    const tipY = facing.z * 7;
    const sideX = -facing.z * 4.6;
    const sideY = facing.x * 4.6;
    const tailX = -facing.x * 3.1;
    const tailY = -facing.z * 3.1;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tailX + sideX, tailY + sideY);
    ctx.lineTo(tailX - sideX, tailY - sideY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (this.activeBuildingId) {
      ctx.strokeStyle = "rgba(143, 230, 255, 0.84)";
      ctx.lineWidth = 1.2;
      ctx.strokeRect(pad + 1, pad + 1, drawSize - 2, drawSize - 2);
    }
  }

  getWeaponIndicatorMeta(weaponId) {
    const map = {
      pipe: { glyph: "PIPE", accent: "#c9d27c" },
      pistol: { glyph: "92FS", accent: "#d6e194" },
      revolver: { glyph: "357", accent: "#f1cb8d" },
      smg: { glyph: "MP5", accent: "#8fe6ff" },
      machine_pistol: { glyph: "G18", accent: "#7ce5ff" },
      rifle: { glyph: "AKM", accent: "#ffd09a" },
      battle_rifle: { glyph: "FAL", accent: "#ffc487" },
      shotgun: { glyph: "870", accent: "#ffae66" },
      lmg: { glyph: "249", accent: "#e4dd8c" },
      dmr: { glyph: "MK14", accent: "#c5deff" },
      sniper: { glyph: "M24", accent: "#d8efff" },
      rpg: { glyph: "RPG7", accent: "#ff8d62" },
      grenade_launcher: { glyph: "M79", accent: "#ff9f70" },
      flamethrower: { glyph: "M2", accent: "#ffb45c" },
    };
    return map[weaponId] ?? { glyph: "GUN", accent: "#b8f26f" };
  }

  syncWeaponIndicator(weapon, feel) {
    if (!this.weaponIndicatorEl || !weapon) {
      return;
    }
    const meta = this.getWeaponIndicatorMeta(weapon.id);
    this.weaponIndicatorEl.style.setProperty("--weapon-accent", meta.accent);
    this.weaponIndicatorEl.querySelector('[data-bind="glyph"]').textContent = meta.glyph;
    this.weaponIndicatorEl.querySelector('[data-bind="name"]').textContent = weapon.label;
    this.weaponIndicatorEl.querySelector('[data-bind="style"]').textContent = feel?.label ?? "Balanced";

    if (this.weaponIndicatorCurrentId !== weapon.id) {
      this.weaponIndicatorCurrentId = weapon.id;
      this.weaponIndicatorEl.classList.remove("swap");
      // Restart pulse animation when equipped weapon changes.
      void this.weaponIndicatorEl.offsetWidth;
      this.weaponIndicatorEl.classList.add("swap");
      if (this.weaponIndicatorSwapTimeout) {
        clearTimeout(this.weaponIndicatorSwapTimeout);
      }
      this.weaponIndicatorSwapTimeout = setTimeout(() => {
        if (this.weaponIndicatorEl) {
          this.weaponIndicatorEl.classList.remove("swap");
        }
      }, 260);
    }
  }

  createCrosshair() {
    const node = document.createElement("div");
    node.className = "fps-crosshair";
    node.innerHTML = `
      <div class="fps-crosshair-ring"></div>
      <div class="fps-crosshair-center"></div>
      <div class="fps-crosshair-arm top"></div>
      <div class="fps-crosshair-arm right"></div>
      <div class="fps-crosshair-arm bottom"></div>
      <div class="fps-crosshair-arm left"></div>
    `;
    document.body.appendChild(node);
    return node;
  }

  getCrosshairProfile(weaponId, ads) {
    const profiles = {
      pipe: {
        size: 14,
        borderWidth: 2,
        borderRadius: 4,
        color: "rgba(214, 225, 148, 0.9)",
        glow: "0 0 8px rgba(198, 230, 113, 0.48), inset 0 0 6px rgba(198, 230, 113, 0.2)",
        centerSize: 3,
        centerOpacity: 0.9,
        arms: true,
        armLength: 4,
        armThickness: 2,
        armGap: 8,
        adsScale: 1,
      },
      pistol: {
        size: 18,
        borderWidth: 2,
        borderRadius: 999,
        color: "rgba(213, 255, 137, 0.88)",
        glow: "0 0 10px rgba(184, 242, 114, 0.58), inset 0 0 8px rgba(184, 242, 114, 0.24)",
        centerSize: 4,
        centerOpacity: 0.95,
        arms: true,
        armLength: 4,
        armThickness: 2,
        armGap: 10,
        adsScale: 0.78,
        rotationDeg: 0,
      },
      revolver: {
        size: 16,
        borderWidth: 2.6,
        borderRadius: 999,
        color: "rgba(245, 214, 148, 0.92)",
        glow: "0 0 11px rgba(255, 205, 124, 0.58), inset 0 0 8px rgba(255, 205, 124, 0.24)",
        centerSize: 2.5,
        centerOpacity: 1,
        arms: true,
        armLength: 9,
        armThickness: 2.4,
        armGap: 8,
        adsScale: 0.62,
        rotationDeg: 0,
      },
      smg: {
        size: 24,
        borderWidth: 1.5,
        borderRadius: 999,
        color: "rgba(151, 230, 255, 0.9)",
        glow: "0 0 10px rgba(112, 220, 255, 0.58), inset 0 0 8px rgba(112, 220, 255, 0.24)",
        centerSize: 3,
        centerOpacity: 0.95,
        arms: true,
        armLength: 11,
        armThickness: 2,
        armGap: 11,
        adsScale: 0.9,
        rotationDeg: 0,
      },
      machine_pistol: {
        size: 28,
        borderWidth: 1.5,
        borderRadius: 999,
        color: "rgba(135, 234, 255, 0.92)",
        glow: "0 0 10px rgba(112, 220, 255, 0.56), inset 0 0 8px rgba(112, 220, 255, 0.22)",
        centerSize: 2.5,
        centerOpacity: 0.9,
        arms: true,
        armLength: 12,
        armThickness: 2,
        armGap: 12,
        adsScale: 0.92,
        rotationDeg: 0,
      },
      rifle: {
        size: 18,
        borderWidth: 1.7,
        borderRadius: 6,
        color: "rgba(255, 219, 158, 0.9)",
        glow: "0 0 12px rgba(255, 192, 120, 0.58), inset 0 0 8px rgba(255, 192, 120, 0.22)",
        centerSize: 3,
        centerOpacity: 0.9,
        arms: true,
        armLength: 9,
        armThickness: 2,
        armGap: 12,
        adsScale: 0.68,
        rotationDeg: 45,
      },
      battle_rifle: {
        size: 20,
        borderWidth: 2.1,
        borderRadius: 4,
        color: "rgba(255, 199, 140, 0.92)",
        glow: "0 0 12px rgba(255, 180, 112, 0.56), inset 0 0 8px rgba(255, 180, 112, 0.22)",
        centerSize: 3,
        centerOpacity: 0.95,
        arms: true,
        armLength: 12,
        armThickness: 2.2,
        armGap: 9,
        adsScale: 0.6,
        rotationDeg: 45,
      },
      shotgun: {
        size: 34,
        borderWidth: 3.2,
        borderRadius: 999,
        color: "rgba(255, 175, 102, 0.92)",
        glow: "0 0 16px rgba(255, 140, 82, 0.6), inset 0 0 8px rgba(255, 149, 88, 0.3)",
        centerSize: 5,
        centerOpacity: 0.95,
        arms: true,
        armLength: 8,
        armThickness: 3,
        armGap: 18,
        adsScale: 0.9,
        rotationDeg: 0,
      },
      lmg: {
        size: 28,
        borderWidth: 2,
        borderRadius: 999,
        color: "rgba(232, 222, 137, 0.92)",
        glow: "0 0 12px rgba(226, 214, 110, 0.56), inset 0 0 8px rgba(226, 214, 110, 0.2)",
        centerSize: 3,
        centerOpacity: 0.9,
        arms: true,
        armLength: 12,
        armThickness: 2,
        armGap: 15,
        adsScale: 0.74,
        rotationDeg: 0,
      },
      dmr: {
        size: 12,
        borderWidth: 1.3,
        borderRadius: 999,
        color: "rgba(196, 230, 255, 0.92)",
        glow: "0 0 11px rgba(170, 214, 255, 0.55), inset 0 0 7px rgba(170, 214, 255, 0.22)",
        centerSize: 2,
        centerOpacity: 1,
        arms: true,
        armLength: 13,
        armThickness: 1.6,
        armGap: 8,
        adsScale: 0.52,
        rotationDeg: 0,
      },
      sniper: {
        size: 10,
        borderWidth: 1,
        borderRadius: 999,
        color: "rgba(214, 241, 255, 0.96)",
        glow: "0 0 12px rgba(184, 228, 255, 0.55), inset 0 0 7px rgba(184, 228, 255, 0.2)",
        centerSize: 1.4,
        centerOpacity: 1,
        arms: true,
        armLength: 16,
        armThickness: 1.2,
        armGap: 7,
        adsScale: 0.4,
        rotationDeg: 45,
      },
      rpg: {
        size: 30,
        borderWidth: 3.2,
        borderRadius: 4,
        color: "rgba(255, 143, 98, 0.92)",
        glow: "0 0 15px rgba(255, 123, 85, 0.58), inset 0 0 8px rgba(255, 123, 85, 0.24)",
        centerSize: 0,
        centerOpacity: 0,
        arms: true,
        armLength: 10,
        armThickness: 3,
        armGap: 18,
        adsScale: 0.8,
        rotationDeg: 45,
      },
      grenade_launcher: {
        size: 22,
        borderWidth: 2.4,
        borderRadius: 4,
        color: "rgba(255, 157, 106, 0.94)",
        glow: "0 0 14px rgba(255, 132, 82, 0.58), inset 0 0 8px rgba(255, 132, 82, 0.22)",
        centerSize: 2,
        centerOpacity: 0.8,
        arms: true,
        armLength: 10,
        armThickness: 2.8,
        armGap: 14,
        adsScale: 0.64,
        rotationDeg: 45,
      },
      flamethrower: {
        size: 34,
        borderWidth: 2.6,
        borderRadius: 999,
        color: "rgba(255, 184, 96, 0.94)",
        glow: "0 0 16px rgba(255, 160, 88, 0.58), inset 0 0 8px rgba(255, 160, 88, 0.24)",
        centerSize: 4,
        centerOpacity: 0.88,
        arms: true,
        armLength: 11,
        armThickness: 2.5,
        armGap: 18,
        adsScale: 0.9,
        rotationDeg: 0,
      },
    };
    const base = profiles[weaponId] ?? profiles.pistol;
    const scale = ads ? base.adsScale ?? 0.78 : 1;
    return {
      ...base,
      size: Math.max(10, base.size * scale),
      borderWidth: Math.max(1, base.borderWidth * scale),
      centerSize: base.centerSize * scale,
      armLength: base.armLength * scale,
      armThickness: Math.max(1, base.armThickness * scale),
      armGap: base.armGap * scale,
    };
  }

  syncCrosshairVisual(weapon, ads, hitConfirm) {
    if (!this.crosshair || !weapon) {
      return;
    }
    const profile = this.getCrosshairProfile(weapon.id, ads);
    const ring = this.crosshair.querySelector(".fps-crosshair-ring");
    const center = this.crosshair.querySelector(".fps-crosshair-center");
    const arms = this.crosshair.querySelectorAll(".fps-crosshair-arm");
    const isHit = Boolean(hitConfirm);
    const color = isHit ? "rgba(255, 122, 107, 0.95)" : profile.color;
    const glow = isHit ? "0 0 14px rgba(255, 106, 94, 0.8), inset 0 0 8px rgba(255, 126, 106, 0.45)" : profile.glow;

    this.crosshair.style.width = `${profile.size}px`;
    this.crosshair.style.height = `${profile.size}px`;
    this.crosshair.style.marginLeft = `${-profile.size * 0.5}px`;
    this.crosshair.style.marginTop = `${-profile.size * 0.5}px`;
    this.crosshair.style.transform = profile.rotationDeg ? `rotate(${profile.rotationDeg}deg)` : "none";

    ring.style.borderWidth = `${profile.borderWidth}px`;
    ring.style.borderRadius = `${profile.borderRadius}px`;
    ring.style.borderColor = color;
    ring.style.boxShadow = glow;

    if (profile.centerSize > 0) {
      center.style.display = "block";
      center.style.width = `${profile.centerSize}px`;
      center.style.height = `${profile.centerSize}px`;
      center.style.marginLeft = `${-profile.centerSize * 0.5}px`;
      center.style.marginTop = `${-profile.centerSize * 0.5}px`;
      center.style.opacity = String(profile.centerOpacity);
      center.style.background = color;
      center.style.boxShadow = `0 0 ${Math.max(6, profile.centerSize * 2.2)}px ${color}`;
    } else {
      center.style.display = "none";
    }

    if (!profile.arms) {
      for (const arm of arms) {
        arm.style.display = "none";
      }
      return;
    }

    const half = profile.size * 0.5;
    for (const arm of arms) {
      const classes = arm.classList;
      arm.style.display = "block";
      arm.style.background = color;
      arm.style.boxShadow = `0 0 ${Math.max(4, profile.armLength * 1.2)}px ${color}`;
      if (classes.contains("top")) {
        arm.style.width = `${profile.armThickness}px`;
        arm.style.height = `${profile.armLength}px`;
        arm.style.left = `${half - profile.armThickness * 0.5}px`;
        arm.style.top = `${half - profile.armGap - profile.armLength}px`;
      } else if (classes.contains("bottom")) {
        arm.style.width = `${profile.armThickness}px`;
        arm.style.height = `${profile.armLength}px`;
        arm.style.left = `${half - profile.armThickness * 0.5}px`;
        arm.style.top = `${half + profile.armGap}px`;
      } else if (classes.contains("left")) {
        arm.style.width = `${profile.armLength}px`;
        arm.style.height = `${profile.armThickness}px`;
        arm.style.left = `${half - profile.armGap - profile.armLength}px`;
        arm.style.top = `${half - profile.armThickness * 0.5}px`;
      } else {
        arm.style.width = `${profile.armLength}px`;
        arm.style.height = `${profile.armThickness}px`;
        arm.style.left = `${half + profile.armGap}px`;
        arm.style.top = `${half - profile.armThickness * 0.5}px`;
      }
    }
  }

  createPlayerPresenceOverlay() {
    if (this.playerPresenceEl) {
      return;
    }
    const wrap = document.createElement("div");
    wrap.className = "fps-player-presence";
    wrap.innerHTML = `
      <div class="fps-presence-shoulder"></div>
      <div class="fps-presence-weapon"></div>
    `;
    document.body.appendChild(wrap);
    this.playerPresenceEl = wrap;
  }

  createVillageDamageOverlay() {
    if (this.villageDamageOverlayEl) {
      return;
    }
    const overlay = document.createElement("div");
    overlay.className = "fps-village-damage-overlay";
    document.body.appendChild(overlay);
    this.villageDamageOverlayEl = overlay;
  }

  createPlayerDamageOverlay() {
    if (this.playerDamageOverlayEl) {
      return;
    }
    const overlay = document.createElement("div");
    overlay.className = "fps-player-damage-overlay";
    document.body.appendChild(overlay);
    this.playerDamageOverlayEl = overlay;
  }

  ensureVillageDestroyedPopup() {
    if (this.villageDestroyedPopupEl) {
      return;
    }
    const popup = document.createElement("div");
    popup.className = "fps-village-destroyed-popup";
    popup.textContent = "Village destroyed. No safe zone remains. Survive as long as you can.";
    Object.assign(popup.style, {
      position: "fixed",
      left: "50%",
      top: "20%",
      transform: "translate(-50%, -8px)",
      padding: "14px 18px",
      background: "rgba(28, 7, 7, 0.92)",
      border: "1px solid rgba(255, 110, 95, 0.85)",
      borderRadius: "10px",
      boxShadow: "0 10px 28px rgba(0, 0, 0, 0.45), 0 0 22px rgba(255, 90, 80, 0.26)",
      color: "#ffe4dd",
      fontSize: "15px",
      fontWeight: "700",
      letterSpacing: "0.02em",
      zIndex: "80",
      opacity: "0",
      pointerEvents: "none",
      transition: "opacity 220ms ease, transform 220ms ease",
      maxWidth: "min(88vw, 680px)",
      textAlign: "center",
    });
    document.body.appendChild(popup);
    this.villageDestroyedPopupEl = popup;
  }

  showVillageDestroyedPopup() {
    this.ensureVillageDestroyedPopup();
    if (!this.villageDestroyedPopupEl) {
      return;
    }
    this.villageDestroyedPopupEl.style.opacity = "1";
    this.villageDestroyedPopupEl.style.transform = "translate(-50%, 0)";
    if (this.villageDestroyedPopupTimeout) {
      clearTimeout(this.villageDestroyedPopupTimeout);
      this.villageDestroyedPopupTimeout = null;
    }
    this.villageDestroyedPopupTimeout = setTimeout(() => {
      if (!this.villageDestroyedPopupEl) {
        return;
      }
      this.villageDestroyedPopupEl.style.opacity = "0";
      this.villageDestroyedPopupEl.style.transform = "translate(-50%, -8px)";
      this.villageDestroyedPopupTimeout = null;
    }, 3400);
  }

  markVillageDestroyed() {
    if (this.villageDestroyed) {
      return;
    }
    this.villageDestroyed = true;
    this.villageHp = 0;
    this.setPrompt("Village destroyed. No safe zone remains. Survive until you die.", 4);
    this.showVillageDestroyedPopup();
  }

  enter() {
    this.buildWorld();
    this.resetRun();
    this.paused = false;
    this.mobileInstructionsOpen = false;
    this.mobileUtilityTrayOpen = false;
    this.hud.style.display = "block";
    this.crosshair.style.display = "block";
    if (this.interactPromptEl) {
      this.interactPromptEl.style.display = "flex";
    }
    if (this.shopActionsEl) {
      this.shopActionsEl.style.display = "flex";
    }
    if (this.playerPresenceEl) {
      this.playerPresenceEl.style.display = "block";
    }
    if (this.weaponIndicatorEl) {
      this.weaponIndicatorEl.style.display = "block";
    }
    if (this.minimapEl) {
      this.minimapEl.style.display = "block";
    }
    if (this.villageDamageOverlayEl) {
      this.villageDamageOverlayEl.style.display = "block";
    }
    if (this.playerDamageOverlayEl) {
      this.playerDamageOverlayEl.style.display = "block";
    }
    this.game.audio.stopMusic();
    this.game.audio.startMusic("raid", { waveNumber: this.waveDirector.waveNumber || 1 });
    this.game.mobileControls.show();
    this.minimapOpen = !this.game.mobileControls.enabled;
    this.updateMiniMapVisibility();
  }

  createVillagerHealthBar(villagerRoot) {
    const root = new THREE.Group();
    root.position.set(0, 1.72, 0);
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.08, 0.14),
      new THREE.MeshBasicMaterial({
        color: 0x101b22,
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
        depthTest: false,
      }),
    );
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(0.96, 0.1),
      new THREE.MeshBasicMaterial({
        color: 0xa5ea72,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        depthTest: false,
      }),
    );
    fill.position.set(0.48, 0, 0.01);
    const fillPivot = new THREE.Group();
    fillPivot.position.set(-0.48, 0, 0);
    fillPivot.add(fill);
    root.add(bg, fillPivot);
    root.renderOrder = 110;
    root.visible = false;
    root.userData.fill = fill;
    villagerRoot.add(root);
    return root;
  }

  syncVillagerPerkModifiers({ applyVillageHealth = false, restoreFullVillageHp = false } = {}) {
    const previousMaxVillageHp = this.maxVillageHp > 0 ? this.maxVillageHp : VILLAGE_HP_BASE;
    const previousVillageRatio = previousMaxVillageHp > 0 ? this.villageHp / previousMaxVillageHp : 1;
    this.villagerPerkModifiers = getVillagerPerkModifiers(this.game.save);
    const villageLevelMultiplier = getVillageLevelHpMultiplier({
      save: this.game.save,
      economy: this.game.economy,
    });
    if (!applyVillageHealth) {
      return;
    }
    this.maxVillageHp = Math.max(
      1,
      Math.round(VILLAGE_HP_BASE * this.villagerPerkModifiers.villageHpMultiplier * villageLevelMultiplier),
    );
    if (restoreFullVillageHp) {
      this.villageHp = this.maxVillageHp;
      return;
    }
    this.villageHp = Math.min(this.maxVillageHp, Math.max(0, this.maxVillageHp * previousVillageRatio));
  }

  updateVillagerHealthBar(villager) {
    if (!villager?.healthBarRoot || !villager.healthBarFill) {
      return;
    }
    villager.healthBarRoot.visible = villager.state === "escorting";
    if (villager.state !== "escorting") {
      return;
    }
    const ratio = THREE.MathUtils.clamp(villager.hp / Math.max(1, villager.maxHp), 0, 1);
    villager.healthBarRoot.quaternion.copy(this.camera.quaternion);
    villager.healthBarFill.scale.x = Math.max(0.001, ratio);
    villager.healthBarFill.position.x = 0.48 * ratio;
  }

  resolveVillagerPersistenceState(villagerId) {
    if (this.game.save.rescuedVillagers.includes(villagerId)) {
      return "rescued";
    }
    if (this.game.save.deadVillagers.includes(villagerId)) {
      return "dead";
    }
    return "idle";
  }

  clearActiveEscort() {
    this.activeEscortVillagerId = null;
    for (const villager of this.villagers) {
      if (!villager?.healthBarRoot) {
        continue;
      }
      villager.healthBarRoot.visible = false;
    }
  }

  configureEscortDropoff() {
    const townHall = this.buildingState.find((entry) => entry.id === "village_townhall");
    const point = townHall?.exteriorSpawn?.clone() ?? this.villagePosition.clone();
    point.y = 1.2;
    this.escortDropoff = {
      buildingId: townHall?.id ?? "village_townhall",
      position: point,
      radius: TOWN_HALL_DROPOFF_RADIUS,
    };
  }

  resetRun() {
    this.playerController.state.hp = 100;
    this.playerController.state.stamina = 100;
    const startBuilding = this.buildingState.find((entry) => entry.id === this.startHouseId) ?? this.buildingState[0];
    const startSpawn = startBuilding?.exteriorSpawn ?? new THREE.Vector3(0, 1.2, 16);
    this.teleportPlayer(startSpawn);
    this.playerController.state.velocity.set(0, 0, 0);
    const facingVillage = this.villagePosition.clone().sub(startSpawn).setY(0);
    const facingForward = facingVillage.lengthSq() > 0.0001 ? facingVillage.normalize() : new THREE.Vector3(0, 0, -1);
    this.playerController.state.yaw = yawFromForward(facingForward);
    this.playerController.state.pitch = -0.05;
    this.startHouseExited = true;
    this.phase = GAME_PHASE.DEFENSE;
    this.activeBuildingId = null;
    this.secretBossActive = false;
    this.secretBossSpawned = false;
    this.pendingPrompt = "Defend the village and escort survivors to safety.";
    this.promptTimer = 0;

    this.syncVillagerPerkModifiers({ applyVillageHealth: true, restoreFullVillageHp: true });
    this.configureEscortDropoff();
    this.clearActiveEscort();

    this.waveDirector.startWave(0);
    this.villageDamageStage = 0;
    this.villageDamageFlash = 0;
    this.villageDamageRecent = 0;
    this.villageDestroyed = false;
    this.playerDamageFlash = 0;
    this.pendingPlayerBiteDamage = 0;
    this.villageDamageAudioCooldown = 0;
    if (this.villageDestroyedPopupTimeout) {
      clearTimeout(this.villageDestroyedPopupTimeout);
      this.villageDestroyedPopupTimeout = null;
    }
    if (this.villageDestroyedPopupEl) {
      this.villageDestroyedPopupEl.style.opacity = "0";
      this.villageDestroyedPopupEl.style.transform = "translate(-50%, -8px)";
    }
    this.projectiles.forEach((projectile) => projectile.mesh.removeFromParent());
    this.projectiles = [];

    for (const enemy of this.enemies) {
      this.scene.remove(enemy.mesh);
      this.physics.removeBody(enemy.id);
    }
    this.enemies = [];

    for (const ragdoll of this.ragdolls) {
      for (const part of ragdoll.parts) {
        this.scene.remove(part.mesh);
        this.physics.removeBody(part.id);
      }
    }
    this.ragdolls = [];

    this.waveStats = {
      coins: 0,
      kills: 0,
    };
    this.restoreBreakableWindows();
    this.restoreTransformableLandscape();
    this.syncBuildingPersistenceState();
    this.lastKillRewardLabel = "";
    this.lastKillRewardTimer = 0;
    this.hitConfirmTimer = 0;
    this.grenadeCooldown = 0;
    this.interactLatch = false;
    this.grenadeLatch = false;

    this.setupAmmo();
    if (!this.game.save.pistolUnlocked) {
      this.game.save.ownedWeapons = ["pipe"];
      this.game.save.unlockedWeapons = ["pipe"];
    } else {
      if (!this.game.save.ownedWeapons.includes("pipe")) {
        this.game.save.ownedWeapons.unshift("pipe");
      }
      if (!this.game.save.unlockedWeapons.includes("pipe")) {
        this.game.save.unlockedWeapons.unshift("pipe");
      }
    }
    this.currentWeaponId = "pipe";
    this.game.save.equippedWeaponId = this.currentWeaponId;
    const minimumStartGrenades = 5 + Math.max(0, this.villagerPerkModifiers.startingGrenadesBonus ?? 0);
    ensureGrenadeInventory(this.game.save);
    const fragCount = getGrenadeCount(this.game.save, "frag");
    if (fragCount < minimumStartGrenades) {
      addGrenadeCount(this.game.save, "frag", minimumStartGrenades - fragCount);
    }
    this.ensureActiveGrenadeType({ preferStocked: true });
    this.refreshViewWeaponModel();
    this.updateVillageDamageEffects(0);
    this.weaponCooldown = 0;
    this.reloadTime = 0;
    this.viewWeaponFireKick = 0;
    this.spawnTracker = null;
  }

  restoreTransformableLandscape() {
    for (const entry of this.transformableLandscape) {
      entry.consumed = false;
      if (entry.mesh) {
        entry.mesh.visible = true;
      }
      if (
        entry.colliderId &&
        entry.colliderCenter &&
        entry.colliderSize &&
        entry.colliderOptions &&
        !this.physics.bodies.has(entry.colliderId)
      ) {
        this.physics.createStaticBox(entry.colliderId, entry.colliderCenter, entry.colliderSize, entry.colliderOptions);
      }
    }
    this.landscapeZombifyEvents = 0;
  }

  syncBuildingPersistenceState() {
    for (const building of this.buildingState) {
      building.opened = this.game.save.openedBuildings.includes(building.id);
      this.syncDoorVisual(building);
    }
    const activeEscortId = this.activeEscortVillagerId;
    for (const villager of this.villagers) {
      if (villager.id === activeEscortId && villager.state === "escorting") {
        this.updateVillagerHealthBar(villager);
        continue;
      }
      villager.state = this.resolveVillagerPersistenceState(villager.id);
      villager.hp = villager.maxHp;
      if (villager.mesh) {
        villager.mesh.visible = villager.state === "idle";
      }
      this.updateVillagerHealthBar(villager);
    }
    if (activeEscortId) {
      const activeVillager = this.villagers.find((entry) => entry.id === activeEscortId);
      if (!activeVillager || activeVillager.state !== "escorting") {
        this.activeEscortVillagerId = null;
      }
    }
  }

  syncDoorVisual(building) {
    const door = this.buildingDoorMeshes.get(building.id);
    if (!door) {
      return;
    }
    door.rotation.y = building.opened ? -Math.PI * 0.42 : 0;
  }

  updateDoorGuidance(dt = FIXED_TICK) {
    const startBuilding = this.buildingState.find((entry) => entry.id === this.startHouseId);
    if (!startBuilding?.startDoorBeacon || !startBuilding?.startDoorLight) {
      return;
    }
    const active = !this.startHouseExited && this.phase === GAME_PHASE.HOUSE_INTRO && this.activeBuildingId === this.startHouseId;
    startBuilding.startDoorBeacon.visible = active;
    startBuilding.startDoorLight.visible = active;
    if (!active) {
      return;
    }
    const pulse = 1 + Math.sin(performance.now() * 0.008) * 0.18;
    startBuilding.startDoorBeacon.scale.setScalar(pulse);
    if (startBuilding.startDoorBeacon.material) {
      startBuilding.startDoorBeacon.material.emissiveIntensity = 1 + pulse * 0.7;
    }
    startBuilding.startDoorLight.intensity = 10 + pulse * 8;
    startBuilding.startDoorLight.distance = 7 + pulse * 1.5;
    startBuilding.insideMarker.scale.setScalar(1 + Math.sin(performance.now() * 0.01) * 0.12);
    if (startBuilding.insideMarker.material) {
      startBuilding.insideMarker.material.emissiveIntensity = 1 + pulse * 0.5;
    }
  }

  getInteractionPrompt() {
    const playerPos = this.playerController.state.position;
    if (this.activeBuildingId) {
      const villagerNearby = this.villagers.some(
        (villager) =>
          villager.state === "idle" &&
          villager.buildingId === this.activeBuildingId &&
          villager.mesh.position.distanceTo(playerPos) <= INTERACT_RANGE,
      );
      if (villagerNearby) {
        return this.activeEscortVillagerId ? "Escort already active" : "Escort villager";
      }

      const exitDoor = this.nearestBuildingDoor(playerPos, true);
      if (exitDoor && exitDoor.id === this.activeBuildingId) {
        return "Open door (exit)";
      }
      return null;
    }

    const nearDoor = this.nearestBuildingDoor(playerPos, false);
    if (nearDoor) {
      return this.activeEscortVillagerId ? "Deliver to Town Hall first" : `Open ${nearDoor.label}`;
    }
    return null;
  }

  syncInteractPrompt() {
    if (!this.interactPromptEl) {
      return;
    }
    const label = this.getInteractionPrompt();
    if (this.game.mobileControls?.enabled) {
      this.game.mobileControls.setButtonVisible("interact", Boolean(label));
    }
    if (!label) {
      this.interactPromptEl.classList.remove("visible");
      return;
    }
    this.interactPromptEl.classList.toggle("mobile", Boolean(this.game.mobileControls?.enabled));
    const textNode = this.interactPromptEl.querySelector(".fps-interact-text");
    if (textNode) {
      textNode.textContent = label;
    }
    this.interactPromptEl.classList.add("visible");
  }

  setupAmmo() {
    this.weaponAmmo.clear();
    for (const weapon of this.game.weapons) {
      this.weaponAmmo.set(weapon.id, {
        mag: weapon.magSize,
      });
    }
  }

  getEquippableWeaponIds() {
    const configuredIds = new Set(this.game.weapons.map((weapon) => weapon.id));
    const unlocked = new Set(
      (this.game.save.unlockedWeapons ?? []).filter((id) => configuredIds.has(id)),
    );
    const owned = this.game.save.ownedWeapons ?? [];
    return owned.filter((id) => configuredIds.has(id) && (id === "pipe" || unlocked.has(id)));
  }

  ensureActiveWeapon({ forceFromSave = false } = {}) {
    const configuredIds = new Set(this.game.weapons.map((weapon) => weapon.id));
    const unlocked = (this.game.save.unlockedWeapons ?? []).filter((id) => configuredIds.has(id));
    if (!unlocked.includes("pipe")) {
      unlocked.unshift("pipe");
    }
    this.game.save.unlockedWeapons = [...new Set(unlocked)];

    const owned = this.getEquippableWeaponIds();
    if (!owned.includes("pipe")) {
      owned.unshift("pipe");
    }
    this.game.save.ownedWeapons = [...new Set(owned)];

    let desired = this.game.save.equippedWeaponId;
    if (!configuredIds.has(desired) || !this.game.save.ownedWeapons.includes(desired)) {
      desired = this.game.save.ownedWeapons[0] ?? "pipe";
    }

    if (!forceFromSave && configuredIds.has(this.currentWeaponId) && this.game.save.ownedWeapons.includes(this.currentWeaponId)) {
      desired = this.currentWeaponId;
    }

    this.game.save.equippedWeaponId = desired;
    if (this.currentWeaponId !== desired) {
      this.currentWeaponId = desired;
      this.refreshViewWeaponModel();
    }

    const activeWeapon = this.game.weaponMap.get(this.currentWeaponId);
    if (activeWeapon && !this.weaponAmmo.has(activeWeapon.id)) {
      this.weaponAmmo.set(activeWeapon.id, { mag: activeWeapon.magSize });
    }
  }

  isInfiniteAmmoWeapon(weapon) {
    return Boolean(weapon);
  }

  getEquippedArmorDef() {
    const armorDefs = this.game.economy?.armorUpgrades;
    if (!Array.isArray(armorDefs) || !armorDefs.length) {
      return { id: "cloth", label: "Cloth Jacket", damageReduction: 0 };
    }
    return (
      armorDefs.find((entry) => entry.id === this.game.save.equippedArmorId) ??
      armorDefs.find((entry) => entry.id === "cloth") ??
      armorDefs[0]
    );
  }

  getArmorDamageReduction() {
    const armor = this.getEquippedArmorDef();
    const baseReduction = Number(armor.damageReduction ?? 0) || 0;
    const bonusReduction = Number(this.villagerPerkModifiers.damageReductionBonus ?? 0) || 0;
    return THREE.MathUtils.clamp(baseReduction + bonusReduction, 0, 0.65);
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  openShopFromRaid() {
    if (this.phase === GAME_PHASE.SECRET_BOSS) {
      this.setPrompt("Shop disabled during secret boss.");
      return;
    }
    this.pause();
    this.game.setMode("shop", { waveNumber: this.waveDirector.waveNumber + 1 });
  }

  setPrompt(text, ttl = 2.2) {
    this.pendingPrompt = text;
    this.promptTimer = ttl;
  }

  teleportPlayer(position, lookTarget = null) {
    if (typeof this.playerBody.body.setTranslation === "function") {
      this.playerBody.body.setTranslation({ x: position.x, y: position.y, z: position.z }, true);
    }
    this.playerBody.body.setNextKinematicTranslation({ x: position.x, y: position.y, z: position.z });
    this.playerController.state.velocity.set(0, 0, 0);
    if (lookTarget) {
      const forward = lookTarget.clone().sub(position).setY(0);
      if (forward.lengthSq() > 0.0001) {
        forward.normalize();
        this.playerController.state.yaw = yawFromForward(forward);
      }
    }
  }

  nearestBuildingDoor(position, interior = false) {
    let nearest = null;
    let nearestDist = Infinity;
    for (const building of this.buildingState) {
      const point = interior ? building.interiorDoor : building.exteriorDoor;
      const dist = point.distanceTo(position);
      if (dist > INTERACT_RANGE || dist >= nearestDist) {
        continue;
      }
      nearest = building;
      nearestDist = dist;
    }
    return nearest;
  }

  interactWithVillager(position) {
    if (!this.activeBuildingId) {
      return false;
    }
    const nearbyAvailableVillager = this.villagers.find(
      (villager) =>
        villager.state === "idle" &&
        villager.buildingId === this.activeBuildingId &&
        villager.mesh.position.distanceTo(position) <= INTERACT_RANGE,
    );
    if (!nearbyAvailableVillager) {
      return false;
    }
    if (this.activeEscortVillagerId) {
      this.setPrompt("Already escorting a villager to Town Hall.");
      return true;
    }

    const target = nearbyAvailableVillager;
    target.state = "escorting";
    target.hp = target.maxHp;
    target.mesh.visible = true;
    const yaw = this.playerController.state.yaw;
    const forward = new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw));
    const spawnPos = this.playerController.state.position.clone().addScaledVector(forward, -3.2);
    spawnPos.y = Math.max(1.2, this.playerController.state.position.y);
    target.mesh.position.copy(spawnPos);
    this.activeEscortVillagerId = target.id;
    this.updateVillagerHealthBar(target);
    this.setPrompt("Escort started. Deliver villager to Town Hall courtyard.");
    return true;
  }

  updateEscort(dt = FIXED_TICK) {
    if (!this.activeEscortVillagerId) {
      return;
    }
    const escort = this.villagers.find((entry) => entry.id === this.activeEscortVillagerId);
    if (!escort || escort.state !== "escorting" || !escort.mesh) {
      this.clearActiveEscort();
      return;
    }

    const desiredTarget = computeEscortFollowTarget(
      this.playerController.state.position,
      this.playerController.state.yaw,
      this.escortFollowOffset,
      1.2,
    );
    const desired = new THREE.Vector3(desiredTarget.x, desiredTarget.y, desiredTarget.z);

    const toDesired = desired.clone().sub(escort.mesh.position);
    const horizontalToDesired = new THREE.Vector3(toDesired.x, 0, toDesired.z);
    const horizontalDistance = horizontalToDesired.length();
    if (horizontalDistance > this.escortTeleportCatchupDistance) {
      escort.mesh.position.copy(desired);
    } else if (horizontalDistance > 0.02) {
      const followSpeed = 4.4;
      const step = Math.min(horizontalDistance, followSpeed * dt);
      horizontalToDesired.multiplyScalar(step / horizontalDistance);
      escort.mesh.position.x += horizontalToDesired.x;
      escort.mesh.position.z += horizontalToDesired.z;
      escort.mesh.position.y = THREE.MathUtils.lerp(escort.mesh.position.y, desired.y, Math.min(1, dt * 5));
    }

    if (horizontalDistance > 0.001) {
      escort.mesh.rotation.y = Math.atan2(horizontalToDesired.x, horizontalToDesired.z);
    }

    let attackerCount = 0;
    for (const enemy of this.enemies) {
      if (!enemy?.mesh || enemy.dead || enemy.hp <= 0) {
        continue;
      }
      const dist = enemy.mesh.position.distanceTo(escort.mesh.position);
      if (dist <= ESCORT_ZOMBIE_THREAT_RANGE) {
        attackerCount += 1;
      }
    }

    const incomingDamage = computeEscortDamage(dt, attackerCount, ESCORT_DAMAGE_PER_SEC, ESCORT_MAX_ATTACKERS);
    if (incomingDamage > 0) {
      escort.hp = Math.max(0, escort.hp - incomingDamage);
      if (escort.hp <= 0) {
        escort.state = "dead";
        escort.mesh.visible = false;
        this.updateVillagerHealthBar(escort);
        if (!this.game.save.deadVillagers.includes(escort.id)) {
          this.game.save.deadVillagers.push(escort.id);
        }
        this.game.save = persistFpsSave(this.game.save);
        this.syncVillagerPerkModifiers();
        this.clearActiveEscort();
        this.setPrompt("Escort failed. Villager died and is permanently lost.", 3.2);
        return;
      }
    }

    if (this.escortDropoff?.position) {
      const dropoffDist = escort.mesh.position.distanceTo(this.escortDropoff.position);
      if (dropoffDist <= this.escortDropoff.radius) {
        escort.state = "rescued";
        escort.mesh.visible = false;
        this.updateVillagerHealthBar(escort);
        if (!this.game.save.rescuedVillagers.includes(escort.id)) {
          this.game.save.rescuedVillagers.push(escort.id);
        }
        this.game.save.deadVillagers = (this.game.save.deadVillagers ?? []).filter((id) => id !== escort.id);
        this.game.save = persistFpsSave(this.game.save);
        this.syncVillagerPerkModifiers({ applyVillageHealth: true });
        this.clearActiveEscort();
        const perk = VILLAGER_PERK_DEFS[escort.id];
        const perkLabel = perk?.summary ? ` (${perk.summary})` : "";
        this.setPrompt(`Escort complete. Permanent upgrade unlocked${perkLabel}.`, 3.4);
        return;
      }
    }

    this.updateVillagerHealthBar(escort);
  }

  interactWithDoor(position) {
    if (this.activeBuildingId) {
      const interiorBuilding = this.buildingState.find((entry) => entry.id === this.activeBuildingId);
      if (!interiorBuilding) {
        this.activeBuildingId = null;
        return false;
      }
      interiorBuilding.opened = true;
      this.syncDoorVisual(interiorBuilding);
      this.teleportPlayer(interiorBuilding.exteriorSpawn, interiorBuilding.exteriorDoor);
      this.activeBuildingId = null;
      if (!this.startHouseExited && interiorBuilding.startHouse) {
        this.startHouseExited = true;
        this.phase = GAME_PHASE.DEFENSE;
        this.setPrompt("Wave 1 started. Defend the village.");
      } else {
        this.setPrompt("Back outside.");
      }
      return true;
    }

    const building = this.nearestBuildingDoor(position, false);
    if (!building) {
      return false;
    }
    if (this.activeEscortVillagerId) {
      this.setPrompt("Deliver villager to Town Hall first.");
      return true;
    }
    building.opened = true;
    this.syncDoorVisual(building);
    if (!this.game.save.openedBuildings.includes(building.id)) {
      this.game.save.openedBuildings.push(building.id);
    }
    this.game.save = persistFpsSave(this.game.save);
    this.activeBuildingId = building.id;
    this.teleportPlayer(building.interiorSpawn, building.interiorDoor);
    this.setPrompt(`Inside ${building.label}. Press E at the marker to exit.`);
    return true;
  }

  handleInteract(input) {
    if (!input.interact) {
      this.interactLatch = false;
      return;
    }
    if (this.interactLatch) {
      return;
    }
    this.interactLatch = true;
    const pos = this.playerController.state.position;
    if (this.interactWithVillager(pos)) {
      return;
    }
    this.interactWithDoor(pos);
  }

  handleGrenade(input) {
    if (!input.grenade) {
      this.grenadeLatch = false;
      return;
    }
    if (this.grenadeLatch || this.grenadeCooldown > 0) {
      return;
    }
    this.grenadeLatch = true;
    const activeGrenadeId = this.ensureActiveGrenadeType({ preferStocked: true });
    const grenadeDef = this.getGrenadeDef(activeGrenadeId);
    const available = getGrenadeCount(this.game.save, activeGrenadeId);
    if (available <= 0) {
      this.setPrompt("No grenades left. Buy more in the shop.");
      return;
    }
    consumeGrenadeById(this.game.save, activeGrenadeId);
    this.grenadeCooldown = (grenadeDef.cooldownSec ?? GRENADE_COOLDOWN_SEC) * (this.villagerPerkModifiers.grenadeCooldownMultiplier ?? 1);

    const forward = new THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation).normalize();
    const spawnPos = this.camera.position
      .clone()
      .addScaledVector(forward, 0.72)
      .add(new THREE.Vector3(0, -0.14, 0));
    const grenadeWeapon = {
      id: "grenade",
      category: "explosive",
      muzzleVelocityMps: grenadeDef.muzzleVelocityMps ?? 19,
      massGrams: grenadeDef.massGrams ?? 480,
      drag: grenadeDef.drag ?? 0.1,
      penetrationJoules: 120,
    };
    const projectile = createProjectile({
      weapon: grenadeWeapon,
      position: spawnPos,
      direction: forward,
    });
    projectile.lifeSec = grenadeDef.lifeSec ?? 1.3;
    projectile.damage = grenadeDef.damage ?? GRENADE_DAMAGE;
    projectile.weapon = grenadeWeapon;
    projectile.knockbackScale = 1.55;
    projectile.hitConfirmScale = 1.25;
    projectile.impactFxScale = 1.4;
    projectile.explosionRadius = grenadeDef.radius ?? GRENADE_RADIUS;
    projectile.explosionImpulse = grenadeDef.impulse ?? GRENADE_IMPULSE;
    projectile.explosionProfile = grenadeDef;
    projectile.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(grenadeDef.projectileRadius ?? 0.085, 10, 10),
      new THREE.MeshStandardMaterial({
        color: grenadeDef.projectileColor ?? 0x47694a,
        roughness: 0.55,
        metalness: 0.45,
        emissive: grenadeDef.projectileEmissive ?? 0x7a9a52,
        emissiveIntensity: grenadeDef.projectileEmissiveIntensity ?? 0.3,
      }),
    );
    projectile.mesh.castShadow = true;
    projectile.mesh.position.copy(projectile.position);
    this.scene.add(projectile.mesh);
    this.projectiles.push(projectile);
    this.game.audio.playWeapon(grenadeDef.effectId === "nova" ? "nova_grenade" : grenadeDef.effectId === "breacher" ? "breacher_grenade" : "grenade_throw", this.playerController.state.position);
  }

  updateFixed(dt = FIXED_TICK) {
    if (this.paused) {
      this.updateDoorGuidance(dt);
      this.syncInteractPrompt();
      this.updatePlayerDamageEffects(dt);
      this.updateVillageDamageEffects(dt);
      this.syncHud();
      return;
    }
    this.ensureActiveWeapon();

    this.weaponCooldown = Math.max(0, this.weaponCooldown - dt);
    this.reloadTime = Math.max(0, this.reloadTime - dt);
    this.playerHitCooldown = Math.max(0, this.playerHitCooldown - dt);
    this.lastKillRewardTimer = Math.max(0, this.lastKillRewardTimer - dt);
    this.hitConfirmTimer = Math.max(0, this.hitConfirmTimer - dt);
    this.promptTimer = Math.max(0, this.promptTimer - dt);
    this.grenadeCooldown = Math.max(0, this.grenadeCooldown - dt);

    const mobileSnapshot = this.game.mobileControls.snapshot();
    const input = this.playerController.update({
      dt,
      mobileSnapshot,
      physics: this.physics,
      playerBody: this.playerBody,
    });

    this.handleInteract(input);
    this.updateEscort(dt);
    this.updateWeaponSelection();
    this.handleMobileQuickActions(mobileSnapshot);
    this.handleWeaponCycle();
    this.handleGrenadeCycle(input);
    this.handleShopShortcut();
    this.handleDebugWaveSkip();
    this.handleReload();
    this.handleFire(input, dt);
    this.handleGrenade(input);
    this.updateViewModel(dt, input);
    this.updateDoorGuidance(dt);

    this.stepProjectiles(dt);
    this.stepProps();

    const runWaves = this.phase === GAME_PHASE.DEFENSE;
    const waveUpdate = runWaves
      ? this.waveDirector.update(dt)
      : {
          spawnCount: 0,
          waveEnded: false,
          missionComplete: false,
          bossWave: false,
          budgetLeft: this.waveDirector.currentWave?.budget ?? 0,
          wave: this.waveDirector.currentWave ?? null,
        };
    this.spawnEnemiesFromWave(waveUpdate);

    const villageTargetPosition = this.villageDestroyed ? DISABLED_VILLAGE_POSITION : this.villagePosition;
    const villageTargetRadius = this.villageDestroyed ? 0 : this.villageRadius;
    const enemyDamage = stepEnemies({
      enemies: this.enemies,
      playerPosition: this.playerController.state.position,
      villagePosition: villageTargetPosition,
      villageRadius: villageTargetRadius,
      dt,
      currentTime: performance.now(),
      maxVisibleEnemies: this.game.qualityProfile.maxVisibleEnemies,
    });

    if (enemyDamage.playerDamage > 0) {
      const armorReduction = this.getArmorDamageReduction();
      const dealt = enemyDamage.playerDamage * 0.34 * (1 - armorReduction);
      this.pendingPlayerBiteDamage += Math.max(0, dealt);
    }

    if (this.pendingPlayerBiteDamage > 0 && this.playerHitCooldown <= 0) {
      const bite = Math.min(PLAYER_BITE_MAX_DAMAGE_PER_PULSE, this.pendingPlayerBiteDamage);
      this.pendingPlayerBiteDamage = Math.max(0, this.pendingPlayerBiteDamage - bite);
      this.playerController.state.hp = Math.max(0, this.playerController.state.hp - bite);
      this.playerHitCooldown = PLAYER_BITE_INTERVAL_SEC;
      this.game.save.lifetimeStats.damageTaken += Math.round(bite);
      this.onPlayerDamaged(bite);
    }

    if (enemyDamage.villageDamage > 0 && !this.villageDestroyed) {
      const dealt = enemyDamage.villageDamage * 0.3;
      this.villageHp = Math.max(0, this.villageHp - dealt);
      this.game.save.lifetimeStats.villageDamageTaken += Math.round(dealt);
      this.onVillageDamaged(dealt, this.villagePosition);
      if (this.villageHp <= 0) {
        this.markVillageDestroyed();
      }
    }

    if (!this.villageDestroyed && this.villageHp <= 0) {
      this.markVillageDestroyed();
    }

    recoverRecoil(this.recoil, dt);
    this.playerController.state.pitch -= this.recoil.pitchKick * 0.002;
    this.playerController.state.yaw += this.recoil.yawKick * 0.0015;

    this.cleanupEnemies();
    this.cleanupRagdolls(dt);

    this.physics.step(dt);
    this.keepEnemiesOutOfStructures();
    this.game.audio.setListenerPosition(this.playerController.state.position);

    this.game.save.lifetimeStats.playSeconds += dt;
    this.syncInteractPrompt();
    this.updatePlayerDamageEffects(dt);
    this.updateVillageDamageEffects(dt);
    this.syncHud();
    this.checkRunEnd(waveUpdate);
  }

  handleDebugWaveSkip() {
    const pressed = this.playerController.keyState.get("keyb");
    if (!pressed) {
      this._debugSkipLatch = false;
      return;
    }
    if (this._debugSkipLatch) {
      return;
    }
    this._debugSkipLatch = true;
    const wave = this.waveDirector.currentWave;
    if (!wave) {
      return;
    }
    this.waveDirector.waveElapsed = wave.durationSec;
    this.waveDirector.spawnedBudget = wave.budget;
    for (const enemy of this.enemies) {
      enemy.hp = 0;
    }
  }

  updateWeaponSelection() {
    const equippable = this.getEquippableWeaponIds();
    const selected = resolveWeaponSlotSelection(
      this.playerController.keyState,
      equippable,
      null,
    );
    if (selected) {
      this.currentWeaponId = selected;
      this.game.save.equippedWeaponId = selected;
      this.refreshViewWeaponModel();
    }
  }

  handleWeaponCycle() {
    if (!this.playerController.keyState.get("keyo")) {
      this._cycled = false;
      return;
    }
    if (this._cycled) {
      return;
    }
    this._cycled = true;
    this.cycleOwnedWeapon();
  }

  handleMobileQuickActions(mobileSnapshot) {
    if (!mobileSnapshot) {
      return;
    }
    if (mobileSnapshot.map) {
      this.minimapOpen = !this.minimapOpen;
      this.updateMiniMapVisibility();
    }
    if (mobileSnapshot.swap) {
      this.cycleOwnedWeapon();
    }
    if (mobileSnapshot.shop) {
      this.openShopFromRaid();
    }
  }

  getGrenadeDef(grenadeTypeId = null) {
    const activeGrenadeId = grenadeTypeId ?? getActiveGrenadeId(this.game.save);
    return this.game.grenadeTypeMap.get(activeGrenadeId) ?? getGrenadeTypeDef(activeGrenadeId);
  }

  ensureActiveGrenadeType({ preferStocked = true } = {}) {
    ensureGrenadeInventory(this.game.save);
    const activeGrenadeId = getActiveGrenadeId(this.game.save);
    if (!preferStocked || getGrenadeCount(this.game.save, activeGrenadeId) > 0) {
      return activeGrenadeId;
    }
    const nextGrenadeId = cycleActiveGrenadeId(
      this.game.save,
      (grenadeTypeId) => getGrenadeCount(this.game.save, grenadeTypeId) > 0,
    );
    return nextGrenadeId;
  }

  cycleGrenadeType() {
    ensureGrenadeInventory(this.game.save);
    const stockedIds = getGrenadeTypeIds().filter((grenadeTypeId) => getGrenadeCount(this.game.save, grenadeTypeId) > 0);
    if (!stockedIds.length) {
      this.setPrompt("No grenades stocked. Buy more in the shop.");
      return false;
    }
    const previousGrenadeId = getActiveGrenadeId(this.game.save);
    const nextGrenadeId = cycleActiveGrenadeId(
      this.game.save,
      (grenadeTypeId) => stockedIds.includes(grenadeTypeId),
    );
    if (nextGrenadeId === previousGrenadeId) {
      return false;
    }
    const grenade = this.getGrenadeDef(nextGrenadeId);
    this.setPrompt(`${grenade.shortLabel} grenade readied (${getGrenadeCount(this.game.save, nextGrenadeId)}).`, 1.05);
    return true;
  }

  handleGrenadeCycle(input) {
    if (!input?.cycleGrenade) {
      this.grenadeCycleLatch = false;
      return;
    }
    if (this.grenadeCycleLatch) {
      return;
    }
    this.grenadeCycleLatch = true;
    this.cycleGrenadeType();
  }

  updateMiniMapVisibility() {
    if (this.minimapEl) {
      this.minimapEl.style.display = this.minimapOpen ? "block" : "none";
    }
    const mapButton = this.game.mobileControls?.buttons?.get?.("map");
    if (mapButton) {
      mapButton.classList.toggle("toggled", this.minimapOpen);
    }
  }

  cycleOwnedWeapon() {
    const equippable = new Set(this.getEquippableWeaponIds());
    const owned = this.game.weapons.filter((weapon) => equippable.has(weapon.id));
    if (!owned.length) {
      return false;
    }
    const idx = owned.findIndex((weapon) => weapon.id === this.currentWeaponId);
    const next = owned[(idx + 1 + owned.length) % owned.length];
    if (!next) {
      return false;
    }
    this.currentWeaponId = next.id;
    this.game.save.equippedWeaponId = next.id;
    this.refreshViewWeaponModel();
    return true;
  }

  handleShopShortcut() {
    const pressed = this.playerController.keyState.get("keyq") === true;
    if (!pressed) {
      this.shopShortcutLatch = false;
      return;
    }
    if (this.shopShortcutLatch) {
      return;
    }
    this.shopShortcutLatch = true;
    this.openShopFromRaid();
  }

  updateViewModel(dt, input) {
    if (!this.viewModelRig) {
      return;
    }
    const feel = getWeaponFeel(this.currentWeaponId);
    this.viewWeaponFireKick = Math.max(0, this.viewWeaponFireKick - dt * (feel.fireKickDecay ?? 8.5));

    const moveAmount = Math.hypot(input.moveX || 0, input.moveY || 0);
    this.viewBobTime += dt * (moveAmount > 0.05 ? feel.bobMoveSpeed ?? 11 : feel.bobIdleSpeed ?? 3.5);

    const bobScale = Math.min(1, moveAmount + 0.2);
    const bobX = Math.sin(this.viewBobTime) * (feel.bobScaleX ?? 0.018) * bobScale;
    const bobY = Math.abs(Math.cos(this.viewBobTime)) * (feel.bobScaleY ?? 0.012) * bobScale;
    const recoilBack =
      Math.min(feel.recoilBackMax ?? 0.07, this.recoil.pitchKick * (feel.recoilBackScale ?? 0.022)) +
      Math.min(feel.weaponKickBackMax ?? 0.065, this.viewWeaponFireKick * (feel.weaponKickBackScale ?? 0.05));
    const kickTilt = Math.min(feel.kickTiltMax ?? 0.11, this.viewWeaponFireKick * (feel.kickTiltScale ?? 0.085));

    this.viewModelRig.position.set(0.29 + bobX, -0.16 - bobY, -0.3 + recoilBack);
    this.viewModelRig.rotation.set(-0.04 - bobY * 0.46 + kickTilt, -0.16 - bobX * 0.9, 0.04 + bobX * 0.4 - kickTilt * 0.42);

    if (this.viewWeaponRoot) {
      this.viewWeaponRoot.position.set(
        0.06 + bobX * 0.35,
        -0.09 - bobY * 0.24 + kickTilt * 0.05,
        -0.04 + kickTilt * 0.28,
      );
      this.viewWeaponRoot.rotation.set(
        0.02 + kickTilt * 0.7,
        -0.02 - bobX * 0.5 - kickTilt * 0.22,
        -0.01 + Math.sin(this.viewBobTime * 0.7) * 0.004,
      );
    }

    const movingParts = this.viewWeaponMovingParts.get(this.currentWeaponId);
    if (!movingParts) {
      return;
    }
    const linearKick = Math.min(1, this.viewWeaponFireKick);
    const reciprocatingKick = Math.sin(linearKick * Math.PI);
    if (movingParts.slide?.userData?.basePosition) {
      movingParts.slide.position.copy(movingParts.slide.userData.basePosition);
      movingParts.slide.position.z += linearKick * (feel.slideTravel ?? 0.05);
    }
    if (movingParts.bolt?.userData?.basePosition) {
      movingParts.bolt.position.copy(movingParts.bolt.userData.basePosition);
      movingParts.bolt.position.z += linearKick * (feel.boltTravel ?? 0.032);
    }
    if (movingParts.pump?.userData?.basePosition) {
      movingParts.pump.position.copy(movingParts.pump.userData.basePosition);
      movingParts.pump.position.z += reciprocatingKick * (feel.pumpTravel ?? 0.11);
    }
  }

  handleReload() {
    this.reloadTime = 0;
    const weapon = this.game.weaponMap.get(this.currentWeaponId);
    const ammo = this.weaponAmmo.get(this.currentWeaponId);
    if (!weapon || !ammo) {
      return;
    }
    ammo.mag = weapon.magSize;
  }

  createTransientVisual(mesh, ttl, extra = {}) {
    this.scene.add(mesh);
    this.game.pendingVisualRemovals.push({
      mesh,
      ttl,
      ...extra,
    });
  }

  spawnEjectedCasing(origin, forward, side, up, tint = 0xd7a14e, speedScale = 1) {
    const casing = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.015, 0.012),
      new THREE.MeshStandardMaterial({
        color: tint,
        emissive: 0x2a1807,
        emissiveIntensity: 0.25,
        roughness: 0.34,
        metalness: 0.72,
      }),
    );
    casing.position
      .copy(origin)
      .addScaledVector(side, 0.1)
      .addScaledVector(up, -0.035)
      .addScaledVector(forward, -0.02);

    const velocity = side
      .clone()
      .multiplyScalar(1.6 * speedScale + Math.random() * 0.9)
      .addScaledVector(up, 1 + Math.random() * 0.7)
      .addScaledVector(forward, -0.15);
    this.createTransientVisual(casing, 0.58, {
      fadeBase: 0.18,
      velocity,
      gravity: 11.5,
      angularVelocity: new THREE.Vector3(
        (Math.random() - 0.5) * 22,
        (Math.random() - 0.5) * 22,
        (Math.random() - 0.5) * 22,
      ),
    });
  }

  spawnWeaponMuzzleFx(weapon, feel, muzzlePos, forward) {
    const compactAuto = weapon.id === "smg" || weapon.id === "machine_pistol";
    const longGun = ["rifle", "battle_rifle", "lmg", "dmr", "sniper"].includes(weapon.id);
    const precisionLongGun = weapon.id === "dmr" || weapon.id === "sniper";
    const explosiveLauncher = weapon.id === "rpg" || weapon.id === "grenade_launcher";
    const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();
    const up = new THREE.Vector3().crossVectors(forward, side).normalize();

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(weapon.id === "shotgun" ? 0.08 : explosiveLauncher ? 0.11 : 0.06, 8, 8),
      new THREE.MeshBasicMaterial({
        color: feel.flashColor ?? 0xffcc8a,
        transparent: true,
        opacity: compactAuto ? 0.78 : 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    glow.position.copy(muzzlePos).addScaledVector(forward, 0.11);
    this.createTransientVisual(glow, compactAuto ? 0.028 : 0.05, { fadeBase: 0.05 });

    if (weapon.id === "pistol") {
      const flashShard = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.05, 0),
        new THREE.MeshBasicMaterial({
          color: 0xffddb0,
          transparent: true,
          opacity: 0.86,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      flashShard.position.copy(muzzlePos).addScaledVector(forward, 0.1);
      this.createTransientVisual(flashShard, 0.045, { fadeBase: 0.04 });
      this.spawnEjectedCasing(muzzlePos, forward, side, up, 0xd7a45f, 1.02);
      return;
    }

    if (weapon.id === "revolver") {
      const magnumRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.13, 0.018, 8, 18),
        new THREE.MeshBasicMaterial({
          color: 0xffc27a,
          transparent: true,
          opacity: 0.82,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      magnumRing.position.copy(muzzlePos).addScaledVector(forward, 0.14);
      magnumRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), forward);
      this.createTransientVisual(magnumRing, 0.085, { fadeBase: 0.07 });
      for (let i = 0; i < 4; i += 1) {
        const spark = new THREE.Mesh(
          new THREE.SphereGeometry(0.018 + Math.random() * 0.01, 6, 6),
          new THREE.MeshBasicMaterial({
            color: i % 2 ? 0xffd9a0 : 0xff9c56,
            transparent: true,
            opacity: 0.92,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        spark.position.copy(muzzlePos).addScaledVector(forward, 0.09);
        const spread = forward
          .clone()
          .addScaledVector(side, (Math.random() - 0.5) * 0.22)
          .addScaledVector(up, (Math.random() - 0.5) * 0.18)
          .normalize();
        this.createTransientVisual(spark, 0.09, {
          fadeBase: 0.06,
          velocity: spread.multiplyScalar(2.6 + Math.random() * 1.2),
          gravity: 6.8,
        });
      }
      return;
    }

    if (compactAuto) {
      for (let i = 0; i < 3; i += 1) {
        const spark = new THREE.Mesh(
          new THREE.SphereGeometry(0.015 + Math.random() * 0.008, 6, 6),
          new THREE.MeshBasicMaterial({
            color: i % 2 ? 0xb9efff : 0xffe0ac,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        spark.position.copy(muzzlePos).addScaledVector(forward, 0.08);
        const spread = forward
          .clone()
          .addScaledVector(side, (Math.random() - 0.5) * 0.35)
          .addScaledVector(up, (Math.random() - 0.5) * 0.35)
          .normalize();
        this.createTransientVisual(spark, 0.07, {
          fadeBase: 0.05,
          velocity: spread.multiplyScalar(3.4 + Math.random() * 2.4),
          gravity: 8,
        });
      }
      this.spawnEjectedCasing(muzzlePos, forward, side, up, 0xd1a45f, weapon.id === "machine_pistol" ? 0.95 : 1.1);
      return;
    }

    if (weapon.id === "shotgun") {
      const blastRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.12, 0.02, 8, 18),
        new THREE.MeshBasicMaterial({
          color: 0xffb866,
          transparent: true,
          opacity: 0.75,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      blastRing.position.copy(muzzlePos).addScaledVector(forward, 0.14);
      blastRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), forward);
      this.createTransientVisual(blastRing, 0.11, { fadeBase: 0.08 });
      for (let i = 0; i < 5; i += 1) {
        const smoke = new THREE.Mesh(
          new THREE.SphereGeometry(0.05 + Math.random() * 0.04, 7, 7),
          new THREE.MeshBasicMaterial({
            color: 0x888f9a,
            transparent: true,
            opacity: 0.48,
            depthWrite: false,
          }),
        );
        smoke.position
          .copy(muzzlePos)
          .addScaledVector(forward, 0.1 + Math.random() * 0.08)
          .addScaledVector(side, (Math.random() - 0.5) * 0.1)
          .addScaledVector(up, (Math.random() - 0.5) * 0.1);
        this.createTransientVisual(smoke, 0.22 + Math.random() * 0.1, {
          fadeBase: 0.18,
          velocity: forward
            .clone()
            .multiplyScalar(0.65 + Math.random() * 0.6)
            .addScaledVector(up, 0.2 + Math.random() * 0.2),
          gravity: 2.5,
        });
      }
      this.spawnEjectedCasing(muzzlePos, forward, side, up, 0xba8d4a, 0.85);
      return;
    }

    if (weapon.id === "flamethrower") {
      const plume = new THREE.Mesh(
        new THREE.ConeGeometry(0.1, 0.42, 12),
        new THREE.MeshBasicMaterial({
          color: 0xffab52,
          transparent: true,
          opacity: 0.82,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      plume.position.copy(muzzlePos).addScaledVector(forward, 0.22);
      plume.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), forward);
      this.createTransientVisual(plume, 0.09, { fadeBase: 0.08 });

      for (let i = 0; i < 5; i += 1) {
        const ember = new THREE.Mesh(
          new THREE.SphereGeometry(0.03 + Math.random() * 0.018, 7, 7),
          new THREE.MeshBasicMaterial({
            color: i % 2 === 0 ? 0xffd780 : 0xff8f42,
            transparent: true,
            opacity: 0.86,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        ember.position.copy(muzzlePos).addScaledVector(forward, 0.1);
        const spread = forward
          .clone()
          .addScaledVector(side, (Math.random() - 0.5) * 0.28)
          .addScaledVector(up, (Math.random() - 0.5) * 0.18)
          .normalize();
        this.createTransientVisual(ember, 0.12 + Math.random() * 0.05, {
          fadeBase: 0.09,
          velocity: spread.multiplyScalar(3.2 + Math.random() * 1.4),
          gravity: 4.2,
        });
      }

      for (let i = 0; i < 3; i += 1) {
        const smoke = new THREE.Mesh(
          new THREE.SphereGeometry(0.05 + Math.random() * 0.025, 7, 7),
          new THREE.MeshBasicMaterial({
            color: 0x8a7a62,
            transparent: true,
            opacity: 0.34,
            depthWrite: false,
          }),
        );
        smoke.position.copy(muzzlePos).addScaledVector(forward, 0.08);
        this.createTransientVisual(smoke, 0.18 + Math.random() * 0.08, {
          fadeBase: 0.16,
          velocity: forward.clone().multiplyScalar(0.7 + Math.random() * 0.4).addScaledVector(up, 0.18 + Math.random() * 0.14),
          gravity: 1.8,
        });
      }
      return;
    }

    if (weapon.id === "battle_rifle") {
      const barkHalo = new THREE.Mesh(
        new THREE.TorusGeometry(0.12, 0.014, 8, 18),
        new THREE.MeshBasicMaterial({
          color: 0xffc788,
          transparent: true,
          opacity: 0.8,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      barkHalo.position.copy(muzzlePos).addScaledVector(forward, 0.16);
      barkHalo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), forward);
      this.createTransientVisual(barkHalo, 0.075, { fadeBase: 0.06 });
      const barkBeam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.03, 0.36, 8),
        new THREE.MeshBasicMaterial({
          color: 0xffd7b0,
          transparent: true,
          opacity: 0.84,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      barkBeam.position.copy(muzzlePos).addScaledVector(forward, 0.19);
      barkBeam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), forward);
      this.createTransientVisual(barkBeam, 0.07, { fadeBase: 0.06 });
      this.spawnEjectedCasing(muzzlePos, forward, side, up, 0xd3a05a, 1.12);
      return;
    }

    if (weapon.id === "lmg") {
      for (let i = 0; i < 2; i += 1) {
        this.spawnEjectedCasing(muzzlePos, forward, side, up, 0xcd9b51, 1.08 + i * 0.08);
      }
      for (let i = 0; i < 3; i += 1) {
        const smoke = new THREE.Mesh(
          new THREE.SphereGeometry(0.04 + Math.random() * 0.025, 7, 7),
          new THREE.MeshBasicMaterial({
            color: 0x8c9187,
            transparent: true,
            opacity: 0.38,
            depthWrite: false,
          }),
        );
        smoke.position
          .copy(muzzlePos)
          .addScaledVector(forward, 0.11)
          .addScaledVector(side, (Math.random() - 0.5) * 0.12)
          .addScaledVector(up, (Math.random() - 0.5) * 0.08);
        this.createTransientVisual(smoke, 0.16 + Math.random() * 0.08, {
          fadeBase: 0.12,
          velocity: forward.clone().multiplyScalar(0.9 + Math.random() * 0.4).addScaledVector(up, 0.18 + Math.random() * 0.12),
          gravity: 2.3,
        });
      }
      return;
    }

    if (weapon.id === "sniper") {
      const shockRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.15, 0.012, 8, 22),
        new THREE.MeshBasicMaterial({
          color: 0xcdf1ff,
          transparent: true,
          opacity: 0.84,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      shockRing.position.copy(muzzlePos).addScaledVector(forward, 0.16);
      shockRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), forward);
      this.createTransientVisual(shockRing, 0.095, { fadeBase: 0.07 });
      const lance = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.026, 0.52, 8),
        new THREE.MeshBasicMaterial({
          color: 0xdaf4ff,
          transparent: true,
          opacity: 0.92,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      lance.position.copy(muzzlePos).addScaledVector(forward, 0.26);
      lance.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), forward);
      this.createTransientVisual(lance, 0.11, { fadeBase: 0.08 });
      this.spawnEjectedCasing(muzzlePos, forward, side, up, 0xd8b46e, 1.2);
      return;
    }

    if (longGun) {
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.02, precisionLongGun ? 0.45 : 0.3, 8),
        new THREE.MeshBasicMaterial({
          color: precisionLongGun ? 0xbfe8ff : 0xffd8ad,
          transparent: true,
          opacity: 0.82,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      beam.position.copy(muzzlePos).addScaledVector(forward, precisionLongGun ? 0.24 : 0.17);
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), forward);
      this.createTransientVisual(beam, precisionLongGun ? 0.095 : 0.065, { fadeBase: 0.065 });
      this.spawnEjectedCasing(
        muzzlePos,
        forward,
        side,
        up,
        0xd7ad67,
        weapon.id === "sniper" ? 1.35 : weapon.id === "dmr" ? 1.2 : weapon.id === "lmg" ? 1.1 : 1,
      );
      return;
    }

    if (explosiveLauncher) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.08, 0.26, 10),
        new THREE.MeshBasicMaterial({
          color: 0xff9a5e,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      cone.position.copy(muzzlePos).addScaledVector(forward, 0.2);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), forward);
      this.createTransientVisual(cone, weapon.id === "grenade_launcher" ? 0.09 : 0.12, { fadeBase: 0.1 });

      const backBlast = new THREE.Mesh(
        new THREE.ConeGeometry(weapon.id === "grenade_launcher" ? 0.08 : 0.12, weapon.id === "grenade_launcher" ? 0.24 : 0.35, 10),
        new THREE.MeshBasicMaterial({
          color: 0xffbf78,
          transparent: true,
          opacity: 0.82,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      backBlast.position.copy(muzzlePos).addScaledVector(forward, weapon.id === "grenade_launcher" ? -0.08 : -0.12);
      backBlast.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), forward.clone().multiplyScalar(-1));
      this.createTransientVisual(backBlast, weapon.id === "grenade_launcher" ? 0.08 : 0.11, { fadeBase: 0.09 });

      for (let i = 0; i < (weapon.id === "grenade_launcher" ? 4 : 6); i += 1) {
        const smoke = new THREE.Mesh(
          new THREE.SphereGeometry(0.07 + Math.random() * 0.06, 8, 8),
          new THREE.MeshBasicMaterial({
            color: 0x8a9098,
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
          }),
        );
        smoke.position.copy(muzzlePos).addScaledVector(forward, -0.06).addScaledVector(side, (Math.random() - 0.5) * 0.22);
        this.createTransientVisual(smoke, 0.34 + Math.random() * 0.12, {
          fadeBase: 0.24,
          velocity: forward
            .clone()
            .multiplyScalar((weapon.id === "grenade_launcher" ? -0.45 : -0.7) - Math.random() * (weapon.id === "grenade_launcher" ? 0.5 : 0.9))
            .addScaledVector(up, 0.28 + Math.random() * 0.35)
            .addScaledVector(side, (Math.random() - 0.5) * 0.7),
          gravity: 2.2,
        });
      }
      return;
    }

    this.spawnEjectedCasing(muzzlePos, forward, side, up);
  }

  applyPipeHitToEnemy(enemy, weapon, feel, direction) {
    if (!enemy || enemy.dead) {
      return false;
    }
    const dir = direction.clone().normalize();
    const damage = weapon.damage * (enemy.damageTakenMultiplier ?? 1);
    enemy.hp -= damage;
    this.game.save.lifetimeStats.damageDealt += Math.round(damage);
    const impulse = dir.multiplyScalar(4 * (feel.knockbackScale ?? 1));
    enemy.bodyEntity.body.applyImpulse({ x: impulse.x, y: Math.max(0.45, impulse.y), z: impulse.z }, true);
    enemy.hitStunSec = Math.max(enemy.hitStunSec ?? 0, 0.16);
    enemy.hitFlashSec = Math.max(enemy.hitFlashSec ?? 0, 0.12);
    enemy.damagePauseSec = Math.max(enemy.damagePauseSec ?? 0, ENEMY_HIT_DAMAGE_PAUSE_SEC);
    this.triggerHitConfirm(1.15);
    this.spawnEnemyHitReaction(enemy.mesh.position.clone().add(new THREE.Vector3(0, 0.9, 0)), dir, 0.92);
    return true;
  }

  handlePipeSwing(weapon, feel) {
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation).normalize();
    const forwardFlat = new THREE.Vector3(forward.x, 0, forward.z).normalize();
    const origin = this.playerController.state.position.clone();
    let hitCount = 0;
    for (const enemy of this.enemies) {
      if (enemy.dead) {
        continue;
      }
      const bodyPosRaw = enemy.bodyEntity.body.translation();
      const enemyCenter = new THREE.Vector3(bodyPosRaw.x, bodyPosRaw.y + 0.55, bodyPosRaw.z);
      const toEnemy = enemyCenter.clone().sub(origin);
      const verticalDelta = Math.abs(toEnemy.y);
      if (verticalDelta > 2.1) {
        continue;
      }
      const toEnemyFlat = new THREE.Vector3(toEnemy.x, 0, toEnemy.z);
      const flatDistance = toEnemyFlat.length();
      if (flatDistance > PIPE_SWING_RANGE) {
        continue;
      }
      if (flatDistance > 0.001 && toEnemyFlat.normalize().dot(forwardFlat) < PIPE_SWING_DOT) {
        continue;
      }
      if (this.applyPipeHitToEnemy(enemy, weapon, feel, toEnemyFlat.lengthSq() > 0.0001 ? toEnemyFlat : forwardFlat)) {
        hitCount += 1;
      }
    }

    if (hitCount === 0) {
      const fallback = this.physics.castRay(origin, forward, PIPE_SWING_RANGE + 0.45);
      if (fallback?.collider) {
        const entity = this.physics.getEntityByCollider(fallback.collider);
        if (entity?.type === "enemy") {
          const enemy = this.enemies.find((entry) => entry.id === entity.id && !entry.dead);
          if (enemy && this.applyPipeHitToEnemy(enemy, weapon, feel, forward)) {
            hitCount += 1;
          }
        }
      }
    }

    const slash = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.012, 8, 18),
      new THREE.MeshBasicMaterial({
        color: hitCount > 0 ? 0xff8c7b : 0xd7e79a,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    slash.position.copy(this.camera.position).addScaledVector(forward, 0.55);
    slash.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), forward);
    slash.rotation.z += Math.PI * 0.5;
    this.createTransientVisual(slash, 0.09, { fadeBase: 0.09 });

    this.viewWeaponFireKick = Math.min(1.6, this.viewWeaponFireKick + (feel.fireKick ?? 0.5));
    this.weaponCooldown = 60 / Math.max(1, weapon.rpm);
    this.game.audio.playWeapon("pipe", this.playerController.state.position);
  }

  handleFire(input, dt) {
    if (this.weaponCooldown > 0) {
      return;
    }

    const weapon = this.game.weaponMap.get(this.currentWeaponId);
    const ammo = this.weaponAmmo.get(this.currentWeaponId);
    if (!weapon || !ammo) {
      return;
    }

    if (!input.fire) {
      return;
    }

    const feel = getWeaponFeel(weapon.id);
    if (weapon.id === "pipe" || weapon.category === "melee") {
      this.handlePipeSwing(weapon, feel);
      return;
    }
    const shots = feel.pellets ?? (weapon.id === "shotgun" ? 8 : 1);
    const spreadMoa = weapon.spreadMoa * (feel.spreadScale ?? 1);
    const adsSpreadScale = this.playerController.state.ads ? (feel.adsSpreadScale ?? 0.6) : 1;
    let effectMuzzlePos = null;
    let effectForward = null;
    for (let i = 0; i < shots; i += 1) {
      const forward = new THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation).normalize();
      const spreadDir = randomSpreadDirection(forward, spreadMoa, adsSpreadScale);
      const muzzlePos = this.camera.position.clone().add(spreadDir.clone().multiplyScalar(0.35));
      if (!effectMuzzlePos) {
        effectMuzzlePos = muzzlePos.clone();
        effectForward = forward.clone();
      }
      const projectile = createProjectile({
        weapon,
        position: muzzlePos,
        direction: spreadDir,
      });
      projectile.damage = weapon.damage;
      projectile.weapon = weapon;
      projectile.knockbackScale = feel.knockbackScale ?? 1;
      projectile.hitConfirmScale = feel.hitConfirmScale ?? 1;
      projectile.impactFxScale = feel.impactFxScale ?? 1;
      const explosiveProjectile = weapon.id === "rpg" || weapon.id === "grenade_launcher";
      projectile.mesh = new THREE.Mesh(
        new THREE.SphereGeometry(feel.projectileRadius ?? (explosiveProjectile ? 0.11 : 0.035), explosiveProjectile ? 10 : 8, explosiveProjectile ? 10 : 8),
        new THREE.MeshBasicMaterial({ color: feel.projectileColor ?? (explosiveProjectile ? 0xff9458 : 0xfff7dc) }),
      );
      projectile.mesh.position.copy(projectile.position);
      this.scene.add(projectile.mesh);
      this.projectiles.push(projectile);

      const tracerEnd = muzzlePos.clone().add(spreadDir.clone().multiplyScalar(feel.tracerLength ?? 2.4));
      const tracerGeom = new THREE.BufferGeometry().setFromPoints([muzzlePos, tracerEnd]);
      const tracer = new THREE.Line(
        tracerGeom,
        new THREE.LineBasicMaterial({
          color: feel.tracerColor ?? 0xfff3c4,
          transparent: true,
          opacity: feel.tracerOpacity ?? 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      this.scene.add(tracer);
      this.game.pendingVisualRemovals.push({ mesh: tracer, ttl: feel.tracerTtl ?? 0.04, fadeBase: feel.tracerTtl ?? 0.04 });
    }

    if (effectMuzzlePos && effectForward) {
      this.spawnWeaponMuzzleFx(weapon, feel, effectMuzzlePos, effectForward);
    }

    const flash = new THREE.PointLight(
      feel.flashColor ?? 0xffcc8a,
      feel.flashIntensity ?? (weapon.id === "rpg" ? 7 : 3.2),
      feel.flashRange ?? (weapon.id === "rpg" ? 10 : 5.5),
      2,
    );
    const flashForward = new THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation).normalize();
    flash.position.copy(this.camera.position).addScaledVector(flashForward, 0.42);
    this.scene.add(flash);
    this.game.pendingVisualRemovals.push({ mesh: flash, ttl: feel.flashTtl ?? 0.055 });

    ammo.mag = weapon.magSize;
    this.viewWeaponFireKick = Math.min(2.2, this.viewWeaponFireKick + (feel.fireKick ?? 0.66));
    this.weaponCooldown = 60 / weapon.rpm;
    applyRecoilImpulse(this.recoil, weapon.recoilPattern, this.playerController.state.ads);
    this.playerController.state.pitch = THREE.MathUtils.clamp(
      this.playerController.state.pitch - (feel.cameraPitchKick ?? 0),
      -1.2,
      1.2,
    );
    this.playerController.state.yaw += (Math.random() * 2 - 1) * (feel.cameraYawKick ?? 0);
    this.game.audio.playWeapon(weapon.id, this.playerController.state.position);
  }

  stepProjectiles(dt) {
    const alive = [];
    for (const projectile of this.projectiles) {
      const oldPos = projectile.position.clone();
      stepProjectile(projectile, dt);

      const displacement = new THREE.Vector3().subVectors(projectile.position, oldPos);
      const distance = displacement.length();
      if (distance > 0.0001) {
        const direction = displacement.clone().divideScalar(distance);
        const hit = this.physics.castRay(oldPos, direction, distance);
        if (hit) {
          const shouldContinue = this.resolveProjectileHit(projectile, hit, direction);
          if (!shouldContinue) {
            projectile.alive = false;
          }
        }
      }

      projectile.mesh.position.copy(projectile.position);
      if ((projectile.weapon?.id === "rpg" || projectile.weapon?.id === "grenade_launcher") && projectile.alive) {
        projectile.trailTimer = (projectile.trailTimer ?? 0) + dt;
        const trailStep = projectile.weapon?.id === "grenade_launcher" ? 0.045 : 0.032;
        if (projectile.trailTimer >= trailStep) {
          projectile.trailTimer = 0;
          const smoke = new THREE.Mesh(
            new THREE.SphereGeometry((projectile.weapon?.id === "grenade_launcher" ? 0.04 : 0.055) + Math.random() * 0.03, 7, 7),
            new THREE.MeshBasicMaterial({
              color: 0x8f949b,
              transparent: true,
              opacity: 0.38,
              depthWrite: false,
            }),
          );
          smoke.position.copy(projectile.position);
          const trailDir = projectile.velocity.clone().normalize().multiplyScalar(
            projectile.weapon?.id === "grenade_launcher" ? -0.35 - Math.random() * 0.2 : -0.55 - Math.random() * 0.35,
          );
          this.createTransientVisual(smoke, (projectile.weapon?.id === "grenade_launcher" ? 0.18 : 0.26) + Math.random() * 0.12, {
            fadeBase: 0.22,
            velocity: trailDir.add(new THREE.Vector3((Math.random() - 0.5) * 0.22, 0.26 + Math.random() * 0.16, (Math.random() - 0.5) * 0.22)),
            gravity: 2.4,
          });
        }
      }

      if (projectile.weapon?.category === "explosive" && projectile.alive && projectile.lifeSec <= 0.05) {
        if (projectile.weapon?.id === "grenade") {
          this.explode(
            projectile.position,
            projectile.explosionRadius ?? GRENADE_RADIUS,
            projectile.damage,
            projectile.explosionImpulse ?? GRENADE_IMPULSE,
            projectile.explosionProfile ?? null,
          );
        } else {
          this.explode(projectile.position, 4.2, projectile.damage * 1.2, 24);
        }
        projectile.alive = false;
      }

      if (projectile.alive) {
        alive.push(projectile);
      } else {
        projectile.mesh.removeFromParent();
      }
    }

    this.projectiles = alive;
  }

  restoreBreakableWindows() {
    for (const pane of this.breakableWindows) {
      pane.broken = false;
      pane.mesh.visible = true;
      if (!pane.mesh.material) {
        continue;
      }
      pane.mesh.material.transparent = false;
      pane.mesh.material.opacity = 1;
      pane.mesh.material.emissiveIntensity = 0.45;
    }
  }

  tryBreakWindowAt(point, shotDirection) {
    const maxDistSq = 1.05 * 1.05;
    for (const pane of this.breakableWindows) {
      if (pane.broken || !pane.mesh.visible) {
        continue;
      }
      if (pane.mesh.position.distanceToSquared(point) > maxDistSq) {
        continue;
      }

      pane.broken = true;
      pane.mesh.visible = false;

      const shardColor = 0x9bc8d8;
      const baseNormal = shotDirection.clone().normalize();
      const flash = new THREE.Mesh(
        new THREE.RingGeometry(0.08, 0.24, 24),
        new THREE.MeshBasicMaterial({
          color: 0xc7efff,
          transparent: true,
          opacity: 0.78,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      flash.position.copy(point).addScaledVector(baseNormal, 0.03);
      flash.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), baseNormal);
      this.createTransientVisual(flash, 0.18, { fadeBase: 0.16 });

      for (let i = 0; i < 18; i += 1) {
        const shard = new THREE.Mesh(
          new THREE.BoxGeometry(0.06 + Math.random() * 0.05, 0.03 + Math.random() * 0.03, 0.01 + Math.random() * 0.02),
          new THREE.MeshStandardMaterial({
            color: shardColor,
            emissive: 0x8ab7c7,
            emissiveIntensity: 0.3,
            roughness: 0.36,
            metalness: 0.15,
            transparent: true,
            opacity: 0.86,
          }),
        );
        shard.position.copy(point).add(
          new THREE.Vector3((Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.18),
        );
        shard.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        const velocity = baseNormal
          .clone()
          .multiplyScalar(1.5 + Math.random() * 2.6)
          .add(new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 2.2, (Math.random() - 0.5) * 2));
        const spin = new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
        this.createTransientVisual(shard, 0.54 + Math.random() * 0.44, {
          fadeBase: 0.82,
          velocity,
          gravity: 6.2,
          angularVelocity: spin,
        });
      }
      for (let i = 0; i < 8; i += 1) {
        const mist = new THREE.Mesh(
          new THREE.SphereGeometry(0.045 + Math.random() * 0.04, 8, 8),
          new THREE.MeshBasicMaterial({
            color: 0xaed4e9,
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
          }),
        );
        mist.position.copy(point).add(new THREE.Vector3((Math.random() - 0.5) * 0.22, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.22));
        const velocity = baseNormal
          .clone()
          .multiplyScalar(0.5 + Math.random() * 0.8)
          .add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.22 + Math.random() * 0.32, (Math.random() - 0.5) * 0.6));
        this.createTransientVisual(mist, 0.34 + Math.random() * 0.2, {
          fadeBase: 0.25,
          velocity,
          gravity: 2.2,
        });
      }
      return true;
    }
    return false;
  }

  spawnImpactReaction(point, normal, materialId = "concrete", hitStrength = 1) {
    const matColors = {
      concrete: 0x8d949d,
      wood: 0x8e6a47,
      steel: 0xc3ccd8,
      soil: 0x70735d,
      glass: 0xa9daff,
      flesh: 0x7b856e,
    };
    const color = matColors[materialId] ?? matColors.concrete;
    const impactNormal = normal.clone().normalize();
    const clampedStrength = Math.max(0.6, Math.min(3.2, hitStrength));
    const isGlass = materialId === "glass";
    const isWall = materialId === "concrete" || materialId === "wood" || materialId === "soil" || materialId === "steel";

    const decal = new THREE.Mesh(
      new THREE.CircleGeometry(0.09 + Math.min(0.16, clampedStrength * 0.07), 14),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: isGlass ? 0.86 : 0.6,
        depthWrite: false,
      }),
    );
    decal.position.copy(point).addScaledVector(impactNormal, 0.02);
    decal.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), impactNormal);
    decal.rotateZ(Math.random() * Math.PI * 2);
    this.createTransientVisual(decal, isGlass ? 0.42 : 0.3, {
      fadeBase: isGlass ? 0.34 : 0.25,
    });

    if (isWall) {
      const scorch = new THREE.Mesh(
        new THREE.RingGeometry(0.1, 0.22 + Math.min(0.18, clampedStrength * 0.08), 20),
        new THREE.MeshBasicMaterial({
          color: materialId === "wood" ? 0x4b3526 : 0x505764,
          transparent: true,
          opacity: 0.32,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      scorch.position.copy(point).addScaledVector(impactNormal, 0.019);
      scorch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), impactNormal);
      scorch.rotateZ(Math.random() * Math.PI * 2);
      this.createTransientVisual(scorch, 0.55, { fadeBase: 0.5 });
    }

    const particleCount = isGlass ? 14 : isWall ? 10 : 5;
    for (let i = 0; i < particleCount; i += 1) {
      const chip = new THREE.Mesh(
        new THREE.BoxGeometry(0.025 + Math.random() * 0.03, 0.02 + Math.random() * 0.025, 0.02 + Math.random() * 0.025),
        new THREE.MeshStandardMaterial({
          color,
          roughness: materialId === "steel" ? 0.3 : 0.84,
          metalness: materialId === "steel" ? 0.68 : 0.06,
          emissive: materialId === "glass" ? 0x7ea8c0 : 0x000000,
          emissiveIntensity: materialId === "glass" ? 0.15 : 0,
          transparent: true,
          opacity: 0.92,
        }),
      );
      chip.position.copy(point).addScaledVector(impactNormal, 0.025);
      const spread = new THREE.Vector3((Math.random() - 0.5) * 1.8, Math.random() * 1.2, (Math.random() - 0.5) * 1.8);
      const velocity = impactNormal
        .clone()
        .multiplyScalar(0.9 + Math.random() * 1.7)
        .add(spread)
        .multiplyScalar(0.85 + clampedStrength * 0.22);
      this.createTransientVisual(chip, 0.3 + Math.random() * 0.25, {
        fadeBase: 0.52,
        velocity,
        gravity: 7.2,
        angularVelocity: new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10),
      });
    }

    if (isWall) {
      const dustColor = materialId === "wood" ? 0x8b6b4b : materialId === "soil" ? 0x7f8666 : 0x8b949c;
      const dustBursts = materialId === "steel" ? 3 : 5;
      for (let i = 0; i < dustBursts; i += 1) {
        const dust = new THREE.Mesh(
          new THREE.SphereGeometry(0.06 + Math.random() * 0.06, 8, 8),
          new THREE.MeshBasicMaterial({
            color: dustColor,
            transparent: true,
            opacity: 0.42,
            depthWrite: false,
          }),
        );
        dust.position.copy(point).add(
          new THREE.Vector3((Math.random() - 0.5) * 0.24, (Math.random() - 0.5) * 0.22, (Math.random() - 0.5) * 0.24),
        );
        const velocity = impactNormal
          .clone()
          .multiplyScalar(0.55 + Math.random() * 0.75)
          .add(new THREE.Vector3((Math.random() - 0.5) * 0.65, 0.3 + Math.random() * 0.35, (Math.random() - 0.5) * 0.65))
          .multiplyScalar(0.95 + clampedStrength * 0.16);
        this.createTransientVisual(dust, 0.48 + Math.random() * 0.24, {
          fadeBase: 0.35,
          velocity,
          gravity: 1.2,
        });
      }
    }
  }

  applyVillageStructureDamage(bodyEntity, projectile, materialId, windowShattered, impactPoint = null) {
    if (!FRIENDLY_FIRE_VILLAGE_DAMAGE) {
      return 0;
    }
    if (!bodyEntity || !isVillageStructureHit(bodyEntity.id) || this.villageDestroyed) {
      return 0;
    }
    const dealt = computeVillageStructureDamage({
      projectileDamage: projectile?.damage ?? 0,
      weaponCategory: projectile?.weapon?.category,
      materialId,
      windowShattered,
    });
    if (dealt <= 0) {
      return 0;
    }
    this.villageHp = Math.max(0, this.villageHp - dealt);
    this.game.save.lifetimeStats.villageDamageTaken += Math.round(dealt);
    this.onVillageDamaged(dealt, impactPoint ?? this.villagePosition);
    if (this.villageHp <= 0) {
      this.markVillageDestroyed();
      return dealt;
    }
    if (this.promptTimer < 0.3 || !this.pendingPrompt.includes("friendly fire")) {
      this.setPrompt(`Village damaged by friendly fire (-${Math.round(dealt)} HP).`, 1.35);
    }
    return dealt;
  }

  triggerHitConfirm(intensity = 1) {
    this.hitConfirmTimer = Math.max(this.hitConfirmTimer, 0.06 + Math.min(0.08, intensity * 0.03));
  }

  spawnEnemyHitReaction(point, direction, strength = 1) {
    const impactColor = 0x89a36e;
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.08 + Math.min(0.12, strength * 0.04), 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xd8e8ae, transparent: true, opacity: 0.5, depthWrite: false }),
    );
    flash.position.copy(point);
    this.scene.add(flash);
    this.game.pendingVisualRemovals.push({ mesh: flash, ttl: 0.12, fadeBase: 0.12 });

    // Keep enemy hits readable without using blood spray.
    const baseDir = direction.clone().normalize();
    for (let i = 0; i < 7; i += 1) {
      const spray = new THREE.Mesh(
        new THREE.SphereGeometry(0.02 + Math.random() * 0.015, 7, 7),
        new THREE.MeshStandardMaterial({
          color: impactColor,
          roughness: 0.88,
          metalness: 0.02,
          emissive: 0x12160b,
          emissiveIntensity: 0.14,
          transparent: true,
          opacity: 0.8,
        }),
      );
      spray.position.copy(point).add(new THREE.Vector3((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.12));
      this.scene.add(spray);
      const velocity = baseDir
        .clone()
        .multiplyScalar(0.85 + Math.random() * 1.25)
        .add(new THREE.Vector3((Math.random() - 0.5) * 1.4, Math.random() * 0.7, (Math.random() - 0.5) * 1.4))
        .multiplyScalar(0.55 + strength * 0.15);
      this.game.pendingVisualRemovals.push({
        mesh: spray,
        ttl: 0.2 + Math.random() * 0.16,
        fadeBase: 0.3,
        velocity,
        gravity: 8.4,
      });
    }
  }

  resolveProjectileHit(projectile, hit, direction) {
    const bodyEntity = this.physics.getEntityByCollider(hit.collider);
    if (!bodyEntity) {
      return false;
    }

    const material = this.materialDefs.get(bodyEntity.material) || this.materialDefs.get("concrete");

    if (bodyEntity.type === "enemy") {
      const enemy = this.enemies.find((item) => item.id === bodyEntity.id);
      if (enemy && !enemy.dead) {
        const damageScale = Math.min(1.2, Math.max(0.2, projectile.remainingEnergyJ / projectile.weapon.penetrationJoules));
        const rawDamage = projectile.damage * damageScale;
        let damage = rawDamage * (enemy.damageTakenMultiplier ?? 1);
        let isHeadshot = false;
        if (projectile.weapon?.category === "ballistic") {
          const bodyPos = enemy.bodyEntity.body.translation();
          const parts = enemy.mesh?.userData?.zombieParts;
          let renderedHeadY = null;
          let renderedHeadRadius = null;
          if (parts?.headMesh && Number.isFinite(parts.headRadius)) {
            const headWorld = new THREE.Vector3();
            parts.headMesh.getWorldPosition(headWorld);
            renderedHeadY = headWorld.y;
            renderedHeadRadius = parts.headRadius;
          }
          const headshot = computeHeadshotResult({
            hitPointY: hit.point.y,
            bodyY: bodyPos.y,
            halfHeight: enemy.bodyEntity.halfHeight,
            radius: enemy.bodyEntity.radius,
            hitboxProfile: enemy.hitboxProfile,
            renderedHeadY,
            renderedHeadRadius,
            multiplier: HEADSHOT_MULTIPLIER,
          });
          if (headshot.isHeadshot) {
            damage *= headshot.multiplier;
            isHeadshot = true;
          }
        }
        enemy.hp -= damage;
        this.game.save.lifetimeStats.damageDealt += Math.round(damage);

        const massFactor = THREE.MathUtils.clamp(90 / Math.max(45, enemy.massKg ?? 90), 0.28, 1.25);
        const knockbackStrength =
          (Math.max(2.2, rawDamage * 0.17) * massFactor + projectile.massGrams * 0.016) * (projectile.knockbackScale ?? 1);
        const push = direction.clone().multiplyScalar(knockbackStrength);
        enemy.bodyEntity.body.applyImpulse({ x: push.x, y: Math.max(0.15, push.y), z: push.z }, true);
        const staggerResistance = enemy.staggerResistance ?? 1;
        enemy.hitStunSec = Math.max(enemy.hitStunSec ?? 0, (0.1 + Math.min(0.22, rawDamage / 110)) * staggerResistance);
        enemy.hitFlashSec = Math.max(enemy.hitFlashSec ?? 0, 0.12);
        enemy.damagePauseSec = Math.max(enemy.damagePauseSec ?? 0, ENEMY_HIT_DAMAGE_PAUSE_SEC);
        this.triggerHitConfirm((1 + damage * 0.01) * (projectile.hitConfirmScale ?? 1) * (isHeadshot ? 1.2 : 1));
        this.spawnEnemyHitReaction(hit.point, direction, knockbackStrength * 0.2 * (projectile.impactFxScale ?? 1));

        this.game.audio.playImpact("flesh", hit.point);

        if (projectile.weapon.category === "explosive") {
          if (projectile.weapon.id === "rpg") {
            this.explode(hit.point, 5.2, projectile.damage * 1.5, 35);
          } else if (projectile.weapon.id === "grenade") {
            this.explode(
              hit.point,
              projectile.explosionRadius ?? GRENADE_RADIUS,
              projectile.damage,
              projectile.explosionImpulse ?? GRENADE_IMPULSE,
              projectile.explosionProfile ?? null,
            );
          } else {
            this.explode(hit.point, GRENADE_RADIUS, projectile.damage, GRENADE_IMPULSE);
          }
          return false;
        }

        const penetrate = applyPenetration(projectile.remainingEnergyJ, material, 14);
        projectile.remainingEnergyJ = penetrate.remaining;
        if (penetrate.penetrated) {
          projectile.position.copy(hit.point).addScaledVector(direction, 0.15);
          projectile.velocity.multiplyScalar(0.8);
          return true;
        }
      }
      return false;
    }

    const materialId = material?.material ?? bodyEntity.material ?? "concrete";
    const windowShattered = this.tryBreakWindowAt(hit.point, direction);
    const impactMaterial = windowShattered ? "glass" : materialId;

    if (bodyEntity.type === "dynamic") {
      const impulse = direction.clone().multiplyScalar(projectile.massGrams * 0.05);
      bodyEntity.body.applyImpulse({ x: impulse.x, y: Math.abs(impulse.y), z: impulse.z }, true);
    }

    if (projectile.weapon.category === "explosive") {
      this.spawnImpactReaction(hit.point, hit.normal, impactMaterial, 1.6 * (projectile.impactFxScale ?? 1));
      this.applyVillageStructureDamage(bodyEntity, projectile, impactMaterial, windowShattered, hit.point);
      if (projectile.weapon.id === "rpg") {
        this.explode(hit.point, 5.5, projectile.damage * 1.6, 42);
      } else if (projectile.weapon.id === "grenade") {
        this.explode(
          hit.point,
          projectile.explosionRadius ?? GRENADE_RADIUS,
          projectile.damage,
          projectile.explosionImpulse ?? GRENADE_IMPULSE,
          projectile.explosionProfile ?? null,
        );
      } else {
        this.explode(hit.point, GRENADE_RADIUS, projectile.damage, GRENADE_IMPULSE);
      }
      return false;
    }

    this.spawnImpactReaction(
      hit.point,
      hit.normal,
      impactMaterial,
      (bodyEntity.type === "dynamic" ? 1.35 : 1) * (projectile.impactFxScale ?? 1),
    );
    this.applyVillageStructureDamage(bodyEntity, projectile, impactMaterial, windowShattered, hit.point);
    this.game.audio.playImpact(impactMaterial, hit.point);

    const penetrationMaterial = windowShattered ? this.materialDefs.get("glass") : material;
    const thickness = windowShattered ? 3.2 : 10;
    const result = applyPenetration(projectile.remainingEnergyJ, penetrationMaterial, thickness);
    projectile.remainingEnergyJ = result.remaining;
    if (result.penetrated && projectile.remainingEnergyJ > 45) {
      projectile.position.copy(hit.point).addScaledVector(direction, 0.2);
      projectile.velocity.multiplyScalar(0.72);
      return true;
    }

    return false;
  }

  explode(position, radius, damage, impulsePower, explosionProfile = null) {
    const effectId = explosionProfile?.effectId ?? "frag";
    const palette =
      effectId === "nova"
        ? {
            flash: 0x8eeeff,
            ring: 0x6ae2ff,
            smoke: 0x68879f,
            spark: 0xd9ffff,
          }
        : effectId === "breacher"
          ? {
              flash: 0xffc274,
              ring: 0xff9a54,
              smoke: 0x8a735d,
              spark: 0xffe0a2,
            }
          : {
              flash: 0xffab67,
              ring: 0xff9354,
              smoke: 0x85735d,
              spark: 0xffd69a,
            };
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 0.3, 16, 16),
      new THREE.MeshBasicMaterial({ color: palette.flash, transparent: true, opacity: 0.65, depthWrite: false }),
    );
    flash.position.copy(position);
    this.scene.add(flash);
    this.game.pendingVisualRemovals.push({ mesh: flash, ttl: 0.16 });

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius * (effectId === "nova" ? 0.34 : 0.28), Math.max(0.05, radius * 0.035), 12, 28),
      new THREE.MeshBasicMaterial({
        color: palette.ring,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    ring.position.copy(position);
    ring.rotation.x = Math.PI / 2;
    this.createTransientVisual(ring, effectId === "nova" ? 0.24 : 0.18, { fadeBase: 0.14 });

    const smokeBursts = effectId === "nova" ? 4 : effectId === "breacher" ? 6 : 3;
    for (let i = 0; i < smokeBursts; i += 1) {
      const smoke = new THREE.Mesh(
        new THREE.SphereGeometry(radius * (0.08 + Math.random() * 0.04), 8, 8),
        new THREE.MeshBasicMaterial({
          color: palette.smoke,
          transparent: true,
          opacity: effectId === "nova" ? 0.28 : 0.36,
          depthWrite: false,
        }),
      );
      smoke.position.copy(position);
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * radius * 0.9,
        radius * (0.2 + Math.random() * 0.2),
        (Math.random() - 0.5) * radius * 0.9,
      );
      this.createTransientVisual(smoke, 0.28 + Math.random() * 0.16, {
        fadeBase: 0.2,
        velocity,
        gravity: effectId === "nova" ? 1.2 : 1.8,
      });
    }

    if (effectId === "nova") {
      for (let i = 0; i < 7; i += 1) {
        const spark = new THREE.Mesh(
          new THREE.SphereGeometry(0.05 + Math.random() * 0.03, 7, 7),
          new THREE.MeshBasicMaterial({
            color: i % 2 === 0 ? palette.spark : palette.ring,
            transparent: true,
            opacity: 0.84,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        spark.position.copy(position);
        const velocity = new THREE.Vector3(
          (Math.random() - 0.5) * radius * 1.3,
          radius * (0.18 + Math.random() * 0.14),
          (Math.random() - 0.5) * radius * 1.3,
        );
        this.createTransientVisual(spark, 0.18 + Math.random() * 0.1, {
          fadeBase: 0.12,
          velocity,
          gravity: 2.8,
        });
      }
    }

    this.game.audio.playExplosion(position, effectId);

    for (const enemy of this.enemies) {
      if (enemy.dead) {
        continue;
      }
      const epos = enemy.mesh.position;
      const dist = epos.distanceTo(position);
      if (dist > radius) {
        continue;
      }
      const scale = 1 - dist / radius;
      const dealt = damage * scale;
      enemy.hp -= dealt;
      this.game.save.lifetimeStats.damageDealt += Math.round(dealt);
      enemy.damagePauseSec = Math.max(enemy.damagePauseSec ?? 0, ENEMY_HIT_DAMAGE_PAUSE_SEC);
      enemy.hitFlashSec = Math.max(enemy.hitFlashSec ?? 0, 0.12 + scale * 0.08);
      if ((explosionProfile?.stunSec ?? 0) > 0) {
        enemy.hitStunSec = Math.max(enemy.hitStunSec ?? 0, (explosionProfile.stunSec ?? 0) * scale);
      }

      const dir = epos.clone().sub(position).normalize().multiplyScalar(impulsePower * scale);
      enemy.bodyEntity.body.applyImpulse({ x: dir.x, y: Math.max(0.2, dir.y), z: dir.z }, true);
    }

    for (const prop of this.props) {
      const pos = prop.mesh.position;
      const dist = pos.distanceTo(position);
      if (dist > radius) {
        continue;
      }
      const scale = 1 - dist / radius;
      const dir = pos.clone().sub(position).normalize().multiplyScalar(impulsePower * scale * 0.5);
      prop.entity.body.applyImpulse({ x: dir.x, y: Math.max(0.2, dir.y), z: dir.z }, true);
    }
  }

  spawnEnemiesFromWave(waveUpdate) {
    if (!waveUpdate.wave) {
      return;
    }

    const wave = waveUpdate.wave;
    if (!this.spawnTracker || this.spawnTracker.wave !== wave.wave) {
      this.spawnTracker = {
        wave: wave.wave,
        spawnedTotal: 0,
        megaSpawned: 0,
        bossLandscapeTriggered: false,
      };
    }

    const minAliveTarget = Math.max(0, Number(wave.minAlive ?? 0));
    const aliveEnemies = this.enemies.reduce((sum, enemy) => {
      if (enemy?.dead || !enemy || enemy.hp <= 0) {
        return sum;
      }
      return sum + 1;
    }, 0);

    const budgetRemainingBefore = Math.max(0, wave.budget - this.spawnTracker.spawnedTotal);
    const scheduledSpawns = Math.min(Math.max(0, waveUpdate.spawnCount ?? 0), budgetRemainingBefore);
    const budgetRemainingAfterScheduled = Math.max(0, budgetRemainingBefore - scheduledSpawns);
    const catchupSpawns = Math.min(
      Math.max(0, minAliveTarget - aliveEnemies),
      budgetRemainingAfterScheduled,
    );
    const spawnCount = scheduledSpawns + catchupSpawns;

    if (spawnCount <= 0) {
      return;
    }
    if (catchupSpawns > 0) {
      this.waveDirector.spawnedBudget = Math.min(
        wave.budget,
        this.waveDirector.spawnedBudget + catchupSpawns,
      );
    }

    const reserveBossSlot = wave.boss ? 1 : 0;
    const megaTarget = Math.min(
      Math.max(0, wave.megaCount ?? 2),
      Math.max(0, wave.budget - reserveBossSlot),
    );

    for (let i = 0; i < spawnCount; i += 1) {
      this.spawnTracker.spawnedTotal += 1;
      const remainingSlots = Math.max(0, wave.budget - this.spawnTracker.spawnedTotal);
      const bossOnThisSlot = wave.boss && remainingSlots === 0;
      const megaRemaining = Math.max(0, megaTarget - this.spawnTracker.megaSpawned);
      const forcedMega = megaRemaining > 0 && remainingSlots - reserveBossSlot < megaRemaining;
      const randomMega =
        megaRemaining > 0 &&
        !forcedMega &&
        !bossOnThisSlot &&
        this.spawnTracker.spawnedTotal > 2 &&
        Math.random() < 0.24;

      let enemyId = pickEnemyTypeForWave(wave);
      if (bossOnThisSlot) {
        if (!this.spawnTracker.bossLandscapeTriggered) {
          this.triggerBossLandscapeMutation(wave.wave);
          this.spawnTracker.bossLandscapeTriggered = true;
        }
        enemyId = "mini_boss";
      } else if (forcedMega || randomMega) {
        enemyId = "mega_zombie";
        this.spawnTracker.megaSpawned += 1;
      }

      const def = this.game.enemyMap.get(enemyId);
      if (!def) {
        continue;
      }
      this.spawnEnemy(def, wave.wave);
    }
  }

  triggerBossLandscapeMutation(waveNum, overrideCount = null) {
    const available = this.transformableLandscape.filter((entry) => !entry.consumed && entry.mesh?.visible);
    if (!available.length) {
      return;
    }

    const desired = Number.isFinite(overrideCount)
      ? Math.max(0, Math.round(overrideCount))
      : waveNum > this.game.waveDefs.length
        ? FINAL_BOSS_LANDSCAPE_ZOMBIE_COUNT
        : BOSS_LANDSCAPE_ZOMBIE_COUNT;
    const targetCount = Math.min(desired, available.length);
    if (targetCount <= 0) {
      return;
    }

    const playerPos = this.playerController?.state?.position ?? new THREE.Vector3();
    const preferred = available
      .filter((entry) => {
        const villageDist = entry.position.distanceTo(this.villagePosition);
        const playerDist = entry.position.distanceTo(playerPos);
        return villageDist > 8 && villageDist < 34 && playerDist > 5;
      })
      .sort(
        (a, b) =>
          Math.abs(a.position.distanceTo(this.villagePosition) - 19) -
          Math.abs(b.position.distanceTo(this.villagePosition) - 19),
      );
    const pool = preferred.length >= targetCount ? preferred.slice() : available.slice();

    const selected = [];
    while (selected.length < targetCount && pool.length > 0) {
      const pickIndex = Math.floor(Math.random() * Math.min(pool.length, 8));
      selected.push(pool.splice(pickIndex, 1)[0]);
    }

    const walkerDef = this.game.enemyMap.get("walker");
    const megaDef = this.game.enemyMap.get("mega_zombie");
    for (let i = 0; i < selected.length; i += 1) {
      const entry = selected[i];
      entry.consumed = true;
      if (entry.mesh) {
        entry.mesh.visible = false;
      }
      if (entry.colliderId && this.physics.bodies.has(entry.colliderId)) {
        this.physics.removeBody(entry.colliderId);
      }

      const impactPos = entry.position.clone().add(new THREE.Vector3(0, 1.1, 0));
      this.spawnImpactReaction(impactPos, new THREE.Vector3(0, 1, 0), "wood", 1.25);

      const shouldSpawnMega = waveNum > this.game.waveDefs.length && i === selected.length - 1;
      const def = shouldSpawnMega && megaDef ? megaDef : walkerDef;
      if (!def) {
        continue;
      }
      const spawnPos = entry.position.clone();
      spawnPos.y = 1.2;
      this.spawnEnemyAt(def, waveNum, spawnPos);
    }

    this.landscapeZombifyEvents += selected.length;
  }

  spawnEnemy(def, waveNum) {
    this.spawnEnemyAt(def, waveNum);
  }

  isEnemySpawnBlocked(point, padding = 1) {
    if (!point || !Array.isArray(this.minimapStructures) || !this.minimapStructures.length) {
      return false;
    }
    return this.minimapStructures.some((structure) => {
      const halfX = structure.size.x * 0.5 + padding;
      const halfZ = structure.size.z * 0.5 + padding;
      return Math.abs(point.x - structure.position.x) <= halfX && Math.abs(point.z - structure.position.z) <= halfZ;
    });
  }

  resolveEnemySpawnPoint(rawPoint) {
    if (!rawPoint) {
      return this.getFrontVillageSpawnPoint();
    }
    const point = rawPoint.clone();
    point.y = 1.2;
    if (!this.isEnemySpawnBlocked(point)) {
      return point;
    }

    const searchDirections = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [0.7, 0.7],
      [-0.7, 0.7],
      [0.7, -0.7],
      [-0.7, -0.7],
    ];
    for (let ring = 1; ring <= 6; ring += 1) {
      const dist = ring * 1.4;
      for (const [dx, dz] of searchDirections) {
        const candidate = new THREE.Vector3(point.x + dx * dist, 1.2, point.z + dz * dist);
        if (Math.abs(candidate.x) > 39 || Math.abs(candidate.z) > 39) {
          continue;
        }
        if (!this.isEnemySpawnBlocked(candidate)) {
          return candidate;
        }
      }
    }
    return point;
  }

  getFrontVillageSpawnPoint() {
    const village = this.villagePosition ?? new THREE.Vector3(0, 1.2, -17.5);
    const playerPos = this.playerController?.state?.position ?? null;
    const maxAttempts = 48;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const x = village.x + (Math.random() * 2 - 1) * FRONT_SPAWN_X_HALF_EXTENT;
      const zOffset = FRONT_SPAWN_Z_OFFSET_MIN + Math.random() * (FRONT_SPAWN_Z_OFFSET_MAX - FRONT_SPAWN_Z_OFFSET_MIN);
      const point = new THREE.Vector3(x, 1.2, village.z + zOffset);
      if (playerPos && point.distanceTo(playerPos) < FRONT_SPAWN_MIN_PLAYER_DISTANCE) {
        continue;
      }
      if (this.isEnemySpawnBlocked(point)) {
        continue;
      }
      return point;
    }

    const fallback = new THREE.Vector3(village.x, 1.2, village.z + FRONT_SPAWN_Z_OFFSET_MAX + 2.4);
    return this.resolveEnemySpawnPoint(fallback);
  }

  spawnEnemyAt(def, waveNum, spawn) {
    const spawnPos = this.resolveEnemySpawnPoint(spawn ?? this.getFrontVillageSpawnPoint());
    const hitbox = def.hitboxProfile ?? "human";
    const colliderByHitbox = {
      crawler: { radius: 0.31, halfHeight: 0.34, scale: 0.82 },
      slim: { radius: 0.34, halfHeight: 0.46, scale: 0.95 },
      human: { radius: 0.36, halfHeight: 0.5, scale: 1 },
      leaper: { radius: 0.39, halfHeight: 0.56, scale: 1.12 },
      large: { radius: 0.5, halfHeight: 0.62, scale: 1.45 },
      armor: { radius: 0.52, halfHeight: 0.66, scale: 1.56 },
      flyer: { radius: 0.35, halfHeight: 0.48, scale: 1.08 },
      mega: { radius: 0.58, halfHeight: 0.74, scale: 1.72 },
      boss: { radius: 0.68, halfHeight: 0.82, scale: 2 },
    };
    const colliderSpec = colliderByHitbox[hitbox] ?? colliderByHitbox.human;
    const isBoss = def.id === "mini_boss" || def.id === "secret_boss";
    const bodyEntity = this.physics.createEnemyBody(
      `enemy_${Math.random().toString(36).slice(2, 9)}`,
      spawnPos,
      colliderSpec.radius,
      colliderSpec.halfHeight,
      def.massKg,
    );

    const mesh = makeZombieMesh(colliderSpec.scale, isBoss, def.id);
    mesh.position.copy(spawnPos);
    this.scene.add(mesh);

    const enemy = createEnemyState(def, bodyEntity, mesh, performance.now(), waveNum);
    this.enemies.push(enemy);
  }

  keepEnemiesOutOfStructures() {
    if (!this.enemies.length || !Array.isArray(this.minimapStructures) || !this.minimapStructures.length) {
      return;
    }
    for (const enemy of this.enemies) {
      if (enemy.dead || !enemy.bodyEntity?.body) {
        continue;
      }
      const body = enemy.bodyEntity.body;
      const translation = body.translation();
      const current = new THREE.Vector3(translation.x, translation.y, translation.z);
      if (!this.isEnemySpawnBlocked(current, 0.45)) {
        continue;
      }
      const safe = this.resolveEnemySpawnPoint(current);
      body.setTranslation({ x: safe.x, y: translation.y, z: safe.z }, true);
      const lv = body.linvel();
      body.setLinvel({ x: lv.x * 0.25, y: lv.y, z: lv.z * 0.25 }, true);
      if (enemy.mesh) {
        enemy.mesh.position.set(safe.x, translation.y - enemy.visualYOffset, safe.z);
      }
    }
  }

  awardKillReward(enemy) {
    this.waveStats.kills += 1;
    this.game.save.lifetimeStats.kills += 1;

    const baseReward = Math.max(0, Math.round(enemy.coinReward ?? 0));
    const rewardMultiplier = Math.max(0, Number(this.villagerPerkModifiers.killCoinMultiplier ?? 1));
    const reward = Math.max(0, Math.round(baseReward * rewardMultiplier));
    if (reward <= 0) {
      return 0;
    }

    this.waveStats.coins += reward;
    this.game.save.coins += reward;
    const enemyLabel = enemy.label || enemy.type || "Zombie";
    this.lastKillRewardLabel = `+${reward} coins (${enemyLabel})`;
    this.lastKillRewardTimer = 1.5;
    this.spawnCoinRewardBurst(enemy.mesh.position, reward);
    return reward;
  }

  spawnCoinRewardBurst(origin, reward) {
    const coinCount = Math.min(14, 4 + Math.round(reward / 8));
    const coinFaceMat = new THREE.MeshStandardMaterial({
      color: 0xffde78,
      roughness: 0.24,
      metalness: 0.84,
      emissive: 0x8a5e16,
      emissiveIntensity: 0.38,
    });
    const coinEdgeMat = new THREE.MeshStandardMaterial({
      color: 0xc88a2a,
      roughness: 0.28,
      metalness: 0.92,
      emissive: 0x5a3b0e,
      emissiveIntensity: 0.24,
    });
    const stampMat = new THREE.MeshBasicMaterial({
      color: 0xfff3b7,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xffd66f,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < coinCount; i += 1) {
      const radius = 0.085 + Math.random() * 0.025;
      const thickness = 0.024 + Math.random() * 0.008;
      const coinRoot = new THREE.Group();

      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, thickness, 16),
        [coinEdgeMat, coinFaceMat, coinFaceMat],
      );

      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 0.84, Math.max(0.006, thickness * 0.36), 8, 16),
        stampMat,
      );
      rim.rotation.x = Math.PI * 0.5;
      rim.position.y = thickness * 0.46;

      const stamp = new THREE.Mesh(
        new THREE.CircleGeometry(radius * 0.42, 14),
        stampMat,
      );
      stamp.rotation.x = -Math.PI * 0.5;
      stamp.position.y = thickness * 0.52;

      const stampBack = stamp.clone();
      stampBack.rotation.x = Math.PI * 0.5;
      stampBack.position.y = -thickness * 0.52;

      const halo = new THREE.Mesh(
        new THREE.RingGeometry(radius * 0.92, radius * 1.22, 16),
        haloMat,
      );
      halo.rotation.x = Math.PI * 0.5;
      halo.position.y = thickness * 0.02;

      coinRoot.add(body, rim, stamp, stampBack, halo);

      coinRoot.position.copy(origin).add(
        new THREE.Vector3((Math.random() - 0.5) * 0.34, 0.4 + Math.random() * 0.34, (Math.random() - 0.5) * 0.34),
      );
      coinRoot.rotation.set(
        Math.PI * 0.5 + (Math.random() - 0.5) * 0.35,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.4,
      );
      coinRoot.traverse((node) => {
        if (!node.isMesh) {
          return;
        }
        node.castShadow = true;
        node.receiveShadow = true;
      });
      this.scene.add(coinRoot);

      const velocity = new THREE.Vector3((Math.random() - 0.5) * 2.3, 1.4 + Math.random() * 1.2, (Math.random() - 0.5) * 2.3);
      const spin = new THREE.Vector3(8 + Math.random() * 8, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 8);
      this.game.pendingVisualRemovals.push({
        mesh: coinRoot,
        ttl: 0.58 + Math.random() * 0.34,
        fadeBase: 0.45,
        velocity,
        gravity: 10.5,
        angularVelocity: spin,
      });
    }
  }

  cleanupEnemies() {
    const alive = [];
    for (const enemy of this.enemies) {
      if (!enemy.dead) {
        alive.push(enemy);
        continue;
      }

      this.awardKillReward(enemy);

      this.spawnRagdoll(enemy);

      this.scene.remove(enemy.mesh);
      this.physics.removeBody(enemy.id);
    }
    this.enemies = alive;
  }

  spawnRagdoll(enemy) {
    if (this.ragdolls.length >= this.game.qualityProfile.maxRagdolls) {
      return;
    }

    const parts = [];
    for (let i = 0; i < 3; i += 1) {
      const size = new THREE.Vector3(0.2 + Math.random() * 0.18, 0.2 + Math.random() * 0.24, 0.2 + Math.random() * 0.18);
      const id = `rag_${enemy.id}_${i}`;
      const entity = this.physics.createDynamicBox(id, enemy.mesh.position.clone().add(new THREE.Vector3(0, 0.4 + i * 0.2, 0)), size, 8, {
        material: "wood",
      });
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(size.x, size.y, size.z),
        new THREE.MeshStandardMaterial({
          color: 0x5a6456,
          roughness: 0.82,
          metalness: 0.08,
          emissive: 0x152410,
          emissiveIntensity: 0.12,
        }),
      );
      mesh.castShadow = true;
      this.scene.add(mesh);
      entity.body.applyImpulse(
        {
          x: (Math.random() - 0.5) * 2,
          y: 1.4 + Math.random() * 1.2,
          z: (Math.random() - 0.5) * 2,
        },
        true,
      );
      parts.push({ id, entity, mesh });
    }

    this.ragdolls.push({ parts, ttl: 2.8 });
  }

  cleanupRagdolls(dt) {
    for (let i = this.ragdolls.length - 1; i >= 0; i -= 1) {
      const ragdoll = this.ragdolls[i];
      ragdoll.ttl -= dt;
      for (const part of ragdoll.parts) {
        const pos = part.entity.body.translation();
        part.mesh.position.set(pos.x, pos.y, pos.z);
      }
      if (ragdoll.ttl > 0) {
        continue;
      }
      for (const part of ragdoll.parts) {
        this.scene.remove(part.mesh);
        this.physics.removeBody(part.id);
      }
      this.ragdolls.splice(i, 1);
    }
  }

  stepProps() {
    for (const prop of this.props) {
      const p = prop.entity.body.translation();
      const r = prop.entity.body.rotation();
      prop.mesh.position.set(p.x, p.y, p.z);
      prop.mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }

    for (let i = this.game.pendingVisualRemovals.length - 1; i >= 0; i -= 1) {
      const visual = this.game.pendingVisualRemovals[i];
      visual.ttl -= FIXED_TICK;
      if (visual.velocity) {
        visual.velocity.y -= (visual.gravity ?? 8) * FIXED_TICK;
        visual.mesh.position.addScaledVector(visual.velocity, FIXED_TICK);
      }
      if (visual.angularVelocity) {
        visual.mesh.rotation.x += visual.angularVelocity.x * FIXED_TICK;
        visual.mesh.rotation.y += visual.angularVelocity.y * FIXED_TICK;
        visual.mesh.rotation.z += visual.angularVelocity.z * FIXED_TICK;
      }
      if (visual.mesh.material?.opacity !== undefined) {
        const fadeBase = visual.fadeBase ?? 0.16;
        visual.mesh.material.opacity = Math.max(0, visual.ttl / Math.max(0.001, fadeBase));
      }
      if (typeof visual.mesh.intensity === "number") {
        visual.mesh.intensity = Math.max(0, visual.mesh.intensity * 0.62);
      }
      if (visual.ttl <= 0) {
        visual.mesh.removeFromParent();
        this.game.pendingVisualRemovals.splice(i, 1);
      }
    }
  }

  unlockPistolIfNeeded(clearedWave) {
    const unlockWave = Number(this.game.economy?.pistolUnlockWave ?? 1);
    if (clearedWave < unlockWave || this.game.save.pistolUnlocked) {
      return;
    }
    this.game.save.pistolUnlocked = true;
    if (!this.game.save.unlockedWeapons.includes("pistol")) {
      this.game.save.unlockedWeapons.push("pistol");
    }
    this.setPrompt("Pistol unlocked in shop (50 coins).");
  }

  buildSecretBossDef() {
    const boss = this.game.bossDef ?? {};
    return {
      id: boss.id ?? "secret_boss",
      label: boss.label ?? "Secret Boss",
      hp: Number(boss.hp ?? 1200),
      massKg: Number(boss.massKg ?? 420),
      speedMps: Number(boss.speedMps ?? 1),
      attackDps: Number(boss.attackDps ?? 30),
      hitboxProfile: boss.hitboxProfile ?? "boss",
      coinReward: Number(boss.coinReward ?? 700),
      spawnWeight: 0,
      movementMode: boss.movementMode ?? "ground",
      attackRange: Number(boss.attackRange ?? 2.3),
      staggerResistance: Number(boss.staggerResistance ?? 0.3),
    };
  }

  beginSecretBossPhase() {
    if (this.secretBossSpawned) {
      return;
    }
    this.phase = GAME_PHASE.SECRET_BOSS;
    this.secretBossActive = true;
    this.secretBossSpawned = true;
    const mutationCount = Number(this.game.bossDef?.landscapeMutationCount ?? FINAL_BOSS_LANDSCAPE_ZOMBIE_COUNT);
    this.triggerBossLandscapeMutation(this.game.waveDefs.length, mutationCount);

    const spawn = vec3From(this.game.bossDef?.spawn, { x: 0, y: 1.2, z: -15.8 });
    const secretBossDef = this.buildSecretBossDef();
    this.spawnEnemyAt(secretBossDef, this.game.waveDefs.length, spawn);
    this.setPrompt("Secret boss awakened. Defeat it to finish the run.");
  }

  checkRunEnd(waveUpdate) {
    if (this.playerController.state.hp <= 0) {
      this.paused = true;
      persistFpsSave(this.game.save);
      this.game.setMode("game_over", { victory: false, reason: "You were overrun before dawn." });
      return;
    }

    if (this.secretBossActive && this.secretBossSpawned && this.enemies.length === 0) {
      this.secretBossActive = false;
      this.paused = true;
      persistFpsSave(this.game.save);
      this.game.setMode("game_over", { victory: true, reason: "Secret boss defeated. The village survives the night." });
      return;
    }

    if (waveUpdate.waveEnded && this.enemies.length === 0 && !this.waveDirector.isIntermission()) {
      const clearedWave = this.waveDirector.waveNumber;
      this.unlockPistolIfNeeded(clearedWave);
      this.game.save.bestWave = Math.max(this.game.save.bestWave, clearedWave);
      this.game.save.lifetimeStats.wavesCleared += 1;
      this.game.save = persistFpsSave(this.game.save);

      this.waveDirector.advanceWave();
      this.paused = true;
      this.game.setMode("summary", {
        wave: clearedWave,
        kills: this.waveStats.kills,
        coins: this.waveStats.coins,
        villageHp: this.villageHp,
      });
      this.waveStats = { kills: 0, coins: 0 };
    }
  }

  resumeAfterIntermission() {
    this.paused = false;
    this.ensureActiveWeapon({ forceFromSave: true });
    if (this.phase !== GAME_PHASE.SECRET_BOSS) {
      this.phase = GAME_PHASE.DEFENSE;
    }
    this.waveDirector.inIntermission = false;
    this.waveDirector.intermissionSec = 0;
  }

  syncHud() {
    if (!this.hud) {
      return;
    }

    const wave = this.waveDirector.waveNumber;
    const weapon = this.game.weaponMap.get(this.currentWeaponId);
    const feel = weapon ? getWeaponFeel(weapon.id) : null;
    const prompt = this.promptTimer > 0 ? this.pendingPrompt : this.getContextPrompt();
    const playerHpNow = Math.round(this.playerController.state.hp);
    const playerHpRatio = computeHealthRatio(playerHpNow, 100);
    const staminaNow = Math.round(this.playerController.state.stamina);
    const staminaRatio = computeHealthRatio(staminaNow, 100);
    const villageHpNow = Math.round(this.villageHp);
    const villageHpRatio = computeHealthRatio(villageHpNow, this.maxVillageHp);

    const playerBarFill = this.hud.querySelector('[data-hud="player-bar-fill"]');
    if (playerBarFill) {
      playerBarFill.style.width = `${Math.round(playerHpRatio * 100)}%`;
    }
    const playerBarLabel = this.hud.querySelector('[data-hud="player-bar-label"]');
    if (playerBarLabel) {
      playerBarLabel.textContent = "Health";
    }
    const staminaBarFill = this.hud.querySelector('[data-hud="stamina-bar-fill"]');
    if (staminaBarFill) {
      staminaBarFill.style.width = `${Math.round(staminaRatio * 100)}%`;
    }
    const staminaBarLabel = this.hud.querySelector('[data-hud="stamina-bar-label"]');
    if (staminaBarLabel) {
      staminaBarLabel.textContent = "Stamina";
    }
    const villageBarFill = this.hud.querySelector('[data-hud="village-bar-fill"]');
    if (villageBarFill) {
      villageBarFill.style.width = `${Math.round(villageHpRatio * 100)}%`;
    }
    const villageBarLabel = this.hud.querySelector('[data-hud="village-bar-label"]');
    if (villageBarLabel) {
      villageBarLabel.textContent = "Village";
    }

    const isMobile = this.game.mobileControls.enabled;
    const isPortraitMobile = isMobile && window.matchMedia("(orientation: portrait)").matches;
    const waveChip = this.hud.querySelector('[data-hud="wave"]');
    if (waveChip) {
      waveChip.textContent = `Wave ${wave}${this.waveDirector.isIntermission() ? " (Intermission)" : ""}`;
      waveChip.style.display = isMobile ? "none" : "inline-flex";
    }
    const coinsChip = this.hud.querySelector('[data-hud="coins"]');
    if (coinsChip) {
      coinsChip.textContent = `Coins ${this.game.save.coins}`;
      coinsChip.style.display = isMobile ? "none" : "inline-flex";
    }
    const enemiesChip = this.hud.querySelector('[data-hud="enemies"]');
    if (enemiesChip) {
      enemiesChip.textContent = `Enemies ${this.enemies.length}`;
      enemiesChip.style.display = isMobile ? "none" : "inline-flex";
    }
    const activeGrenadeId = this.ensureActiveGrenadeType({ preferStocked: true });
    const activeGrenade = this.getGrenadeDef(activeGrenadeId);
    const grenadeChip = this.hud.querySelector('[data-hud="grenade"]');
    if (grenadeChip) {
      grenadeChip.textContent = `${activeGrenade.shortLabel} x${getGrenadeCount(this.game.save, activeGrenadeId)}`;
      grenadeChip.style.display = "inline-flex";
    }
    this.syncWeaponIndicator(weapon, feel);
    const promptLine = this.hud.querySelector('[data-hud="prompt"]');
    if (promptLine) {
      promptLine.textContent = prompt;
      promptLine.style.display = prompt ? "inline-block" : "none";
    }
    const controlsLine = this.hud.querySelector('[data-hud="controls"]');
    if (controlsLine) {
      controlsLine.textContent = isMobile
        ? "Controls: Left stick move from the lower-left corner, right stick look from the lower-right. FIRE sits above the look stick, GRENADE floats just above it, and tapping the look stick also fires. MAP, SPRINT, and CROUCH sit around the move stick. JUMP (+1 air jump) is the center bar, USE appears above nearby prompts, and the top-right + opens the shop."
        : "Controls: WASD move, mouse look/aim, Click/F attack, G throw grenade, H cycle grenade, Shift sprint, Space jump (+1 air jump), E interact, Q shop, O cycle, 1-0 / - / = / ] direct weapon select, ` pipe, Esc unlock mouse.";
      controlsLine.style.display = isMobile ? (this.mobileInstructionsOpen ? "inline-block" : "none") : "inline-block";
    }
    this.syncCrosshairVisual(weapon, this.playerController.state.ads, this.hitConfirmTimer > 0);
    this.drawMiniMap();
    if (this.shopActionsEl) {
      this.shopActionsEl.classList.toggle("portrait-tray", isPortraitMobile);
      this.shopActionsEl.classList.toggle("tray-open", isPortraitMobile && this.mobileUtilityTrayOpen);
    }
    if (this.grenadeQuickButtonEl) {
      if (isMobile) {
        this.grenadeQuickButtonEl.style.display = "none";
      } else {
        this.grenadeQuickButtonEl.style.display = "inline-flex";
        this.grenadeQuickButtonEl.textContent = `${activeGrenade.shortLabel} ${getGrenadeCount(this.game.save, activeGrenadeId)}`;
        this.grenadeQuickButtonEl.setAttribute("aria-label", `Cycle grenade type. Active: ${activeGrenade.label}`);
      }
    }
    if (this.shopQuickButtonEl) {
      this.shopQuickButtonEl.textContent = isMobile ? "Shop" : `Shop (${this.game.save.coins})`;
    }
    if (this.swapQuickButtonEl) {
      this.swapQuickButtonEl.textContent = isMobile ? "Swap" : `Swap (${weapon?.label ?? "Weapon"})`;
    }
    if (this.helpQuickButtonEl) {
      if (isMobile) {
        this.helpQuickButtonEl.style.display = isPortraitMobile && !this.mobileUtilityTrayOpen ? "none" : "inline-flex";
        this.helpQuickButtonEl.textContent = this.mobileInstructionsOpen ? "x" : "?";
        this.helpQuickButtonEl.classList.toggle("active", this.mobileInstructionsOpen);
        this.helpQuickButtonEl.setAttribute("aria-label", this.mobileInstructionsOpen ? "Hide controls" : "Show controls");
      } else {
        this.helpQuickButtonEl.style.display = "none";
        this.helpQuickButtonEl.classList.remove("active");
      }
    }
    if (this.trayQuickButtonEl) {
      if (isPortraitMobile) {
        this.trayQuickButtonEl.style.display = "inline-flex";
        this.trayQuickButtonEl.textContent = this.mobileUtilityTrayOpen ? "x" : "+";
        this.trayQuickButtonEl.classList.toggle("active", this.mobileUtilityTrayOpen);
        this.trayQuickButtonEl.setAttribute("aria-label", this.mobileUtilityTrayOpen ? "Close utility tray" : "Open utility tray");
      } else {
        this.trayQuickButtonEl.style.display = "none";
        this.trayQuickButtonEl.classList.remove("active");
      }
    }
  }

  getContextPrompt() {
    const playerPos = this.playerController.state.position;
    if (this.villageDestroyed) {
      return "Village destroyed. Survive as long as you can.";
    }
    if (this.activeEscortVillagerId && this.escortDropoff?.buildingId) {
      return "Escort active: deliver villager to Town Hall courtyard.";
    }
    if (this.activeBuildingId) {
      const villagerNearby = this.villagers.some(
        (villager) =>
          villager.state === "idle" &&
          villager.buildingId === this.activeBuildingId &&
          villager.mesh.position.distanceTo(playerPos) <= INTERACT_RANGE,
      );
      if (villagerNearby) {
        return this.activeEscortVillagerId ? "Already escorting a villager." : "Press E to escort villager.";
      }
      return "Press E to exit building.";
    }

    const nearDoor = this.nearestBuildingDoor(playerPos, false);
    if (nearDoor) {
      if (this.activeEscortVillagerId) {
        return "Deliver villager to Town Hall first.";
      }
      return `Press E to enter ${nearDoor.label}.`;
    }
    if (!this.startHouseExited) {
      return "Start inside your house. Exit through the door with E.";
    }
    if (!this.game.save.pistolUnlocked) {
      return "Clear Wave 1 to unlock the pistol.";
    }
    if (this.phase === GAME_PHASE.SECRET_BOSS) {
      return "Secret boss active. Hold the village line.";
    }
    return "";
  }

  renderGameToText(modeOverride = null) {
    const player = this.playerController.state;
    const weapon = this.game.weaponMap.get(this.currentWeaponId);
    const ammo = this.weaponAmmo.get(this.currentWeaponId);
    const escortVillager = this.activeEscortVillagerId
      ? this.villagers.find((entry) => entry.id === this.activeEscortVillagerId)
      : null;
    const dropoff = this.escortDropoff
      ? {
          buildingId: this.escortDropoff.buildingId,
          x: Number(this.escortDropoff.position.x.toFixed(2)),
          z: Number(this.escortDropoff.position.z.toFixed(2)),
          radius: Number(this.escortDropoff.radius.toFixed(2)),
        }
      : null;
    const rescuedCount = this.villagers.filter((villager) => villager.state === "rescued").length;
    const deadCount = this.villagers.filter((villager) => villager.state === "dead").length;
    const availableCount = this.villagers.filter((villager) => isVillagerAvailable(this.game.save, villager.id)).length;

    return JSON.stringify({
      coordinateSystem: "Three.js world meters; +x east, +y up, +z south",
      mode: modeOverride ?? (this.paused ? "raid_paused" : "raid"),
      phase: this.phase,
      wave: this.waveDirector.waveNumber,
      player: {
        position: {
          x: Number(player.position.x.toFixed(2)),
          y: Number(player.position.y.toFixed(2)),
          z: Number(player.position.z.toFixed(2)),
        },
        velocity: {
          x: Number(player.velocity.x.toFixed(2)),
          y: Number(player.velocity.y.toFixed(2)),
          z: Number(player.velocity.z.toFixed(2)),
        },
        yawPitch: {
          yaw: Number(player.yaw.toFixed(3)),
          pitch: Number(player.pitch.toFixed(3)),
        },
        hp: Number(player.hp.toFixed(1)),
        stamina: Number(player.stamina.toFixed(1)),
        startHouseExited: this.startHouseExited,
      },
      village: {
        hp: Number(this.villageHp.toFixed(1)),
        destroyed: this.villageDestroyed,
        level: this.game.save.villageLevel ?? 1,
        threatDistanceMin: this.closestThreatDistance(),
      },
      weapon: {
        id: this.currentWeaponId,
        ammo: this.isInfiniteAmmoWeapon(weapon) ? weapon?.magSize ?? 0 : ammo?.mag ?? 0,
        feel: weapon ? getWeaponFeel(weapon.id).label : "Balanced sidearm",
        recoil: {
          pitchKick: Number(this.recoil.pitchKick.toFixed(3)),
          yawKick: Number(this.recoil.yawKick.toFixed(3)),
        },
        ads: this.playerController.state.ads,
        reloadState: this.reloadTime > 0 ? "reloading" : "ready",
        viewModelVisible: true,
      },
      inventory: {
        grenades: this.game.save.grenades ?? 0,
        grenadeCounts: ensureGrenadeInventory(this.game.save),
        activeGrenadeId: getActiveGrenadeId(this.game.save),
        armor: this.game.save.equippedArmorId ?? "cloth",
      },
      buildings: {
        openedCount: this.game.save.openedBuildings.length,
        insideId: this.activeBuildingId,
      },
      escort: {
        active: Boolean(escortVillager && escortVillager.state === "escorting"),
        villagerId: escortVillager?.state === "escorting" ? escortVillager.id : null,
        hp: escortVillager?.state === "escorting" ? Number(escortVillager.hp.toFixed(1)) : null,
        maxHp: escortVillager?.state === "escorting" ? Number(escortVillager.maxHp.toFixed(1)) : null,
        healthBarVisible: Boolean(escortVillager?.state === "escorting" && escortVillager?.healthBarRoot?.visible),
        dropoff,
      },
      villagers: {
        rescuedCount,
        deadCount,
        availableCount,
      },
      boss: {
        secretBossActive: this.secretBossActive,
      },
      enemiesVisible: visibleEnemyPayload(this.enemies, 20),
      world: {
        brokenWindows: this.breakableWindows.reduce((sum, pane) => sum + (pane.broken ? 1 : 0), 0),
        activeImpactFx: this.game.pendingVisualRemovals.length,
        landscapeZombified: this.landscapeZombifyEvents,
      },
      miniMap: {
        enabled: Boolean(this.minimapCanvasEl) && this.minimapOpen,
        worldHalfExtent: MINIMAP_WORLD_HALF_EXTENT,
        zombieCount: this.enemies.length,
        buildingDoorCount: this.buildingState.length,
        buildingFootprints: this.minimapStructures.length,
      },
      ui: {
        mobileInstructionsOpen: this.mobileInstructionsOpen,
      },
      combatFeedback: {
        hitConfirmActive: this.hitConfirmTimer > 0,
        enemiesInHitReact: this.enemies.filter((enemy) => !enemy.dead && (enemy.hitStunSec ?? 0) > 0).length,
      },
      physics: {
        activeBodies: this.physics.activeBodies(),
        avgStepMs: Number(this.physics.avgStepMs.toFixed(3)),
        tickRate: 60,
      },
    });
  }

  closestThreatDistance() {
    if (!this.enemies.length) {
      return null;
    }
    let min = Infinity;
    for (const enemy of this.enemies) {
      if (enemy.dead) {
        continue;
      }
      const dist = enemy.mesh.position.distanceTo(this.villagePosition);
      min = Math.min(min, dist);
    }
    return Number((Number.isFinite(min) ? min : 0).toFixed(2));
  }

  exit() {
    this.paused = true;
    this.mobileInstructionsOpen = false;
    this.mobileUtilityTrayOpen = false;
    if (this.shopActionsEl) {
      this.shopActionsEl.style.display = "none";
    }
    if (this.playerPresenceEl) {
      this.playerPresenceEl.style.display = "none";
    }
    if (this.weaponIndicatorSwapTimeout) {
      clearTimeout(this.weaponIndicatorSwapTimeout);
      this.weaponIndicatorSwapTimeout = null;
    }
    if (this.weaponIndicatorEl) {
      this.weaponIndicatorEl.style.display = "none";
      this.weaponIndicatorEl.classList.remove("swap");
    }
    if (this.minimapEl) {
      this.minimapEl.style.display = "none";
    }
    if (this.villageDamageOverlayEl) {
      this.villageDamageOverlayEl.style.display = "none";
    }
    if (this.playerDamageOverlayEl) {
      this.playerDamageOverlayEl.style.display = "none";
    }
    if (this.interactPromptEl) {
      this.interactPromptEl.style.display = "none";
      this.interactPromptEl.classList.remove("visible");
    }
  }
}
