import * as THREE from "three";
import { computeForwardArmPose } from "./zombiePoseRules";

function weightedPick(composition, random = Math.random) {
  const entries = Object.entries(composition);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let target = random() * total;
  for (const [id, weight] of entries) {
    target -= weight;
    if (target <= 0) {
      return id;
    }
  }
  return entries[0][0];
}

export function pickEnemyTypeForWave(waveDef, random = Math.random) {
  return weightedPick(waveDef.composition, random);
}

export function computeWaveDifficultyScalars(wave = 1) {
  const waveIndex = Math.max(0, (Number(wave) || 1) - 1);
  return {
    hp: 1 + waveIndex * 0.035,
    attack: 1 + Math.min(0.5, waveIndex * 0.03),
    speed: 1 + Math.min(0.38, waveIndex * 0.022),
  };
}

export function createEnemyState(def, bodyEntity, mesh, spawnAt, wave) {
  const growthByType = {
    crawler: 6,
    runner: 8,
    skitter: 8,
    walker: 9,
    leaper: 11,
    pouncer: 13,
    brute: 14,
    armored: 18,
    juggernaut: 26,
    flyer: 12,
    revenant: 15,
    zombie_chicken: 8,
    zombie_pig: 10,
    zombie_horse: 14,
    zombie_cow: 16,
    mini_boss: 55,
    mega_zombie: 28,
  };
  const perWaveGrowth = growthByType[def.id] ?? 6;
  const waveIndex = Math.max(0, (Number(wave) || 1) - 1);
  const waveScalars = computeWaveDifficultyScalars(wave);
  const baseHp = def.hp + Math.round(waveIndex * perWaveGrowth);
  const scaledHp = Math.max(1, Math.round(baseHp * waveScalars.hp));
  return {
    id: bodyEntity.id,
    type: def.id,
    label: def.label,
    hp: scaledHp,
    maxHp: scaledHp,
    speedMps: def.speedMps * waveScalars.speed,
    attackDps: def.attackDps * waveScalars.attack,
    massKg: def.massKg,
    coinReward: def.coinReward,
    hitboxProfile: def.hitboxProfile,
    movementMode: def.movementMode ?? "ground",
    attackRange: def.attackRange ?? 1.6,
    villageReach: def.villageReach ?? 0,
    damageTakenMultiplier: def.damageTakenMultiplier ?? 1,
    staggerResistance: def.staggerResistance ?? 1,
    jumpIntervalSec: def.jumpIntervalSec ?? 0,
    jumpSpeed: def.jumpSpeed ?? 0,
    jumpTimer: Math.random() * 0.6,
    hoverHeight: def.hoverHeight ?? 0,
    hoverBobAmp: def.hoverBobAmp ?? 0.3,
    hoverPhase: Math.random() * Math.PI * 2,
    zigzagStrength: def.zigzagStrength ?? 0,
    visualYOffset: def.visualYOffset ?? 0.85,
    baseY: bodyEntity.body.translation().y,
    movePhase: Math.random() * Math.PI * 2,
    bodyEntity,
    mesh,
    state: "advance",
    attackTimer: 0,
    damagePauseSec: 0,
    hitStunSec: 0,
    hitFlashSec: 0,
    dead: false,
    spawnAt,
  };
}

function animateZombiePose(enemy, currentTime) {
  const parts = enemy.mesh.userData.zombieParts;
  if (!parts) {
    return;
  }

  const moveBlend = enemy.state === "advance" ? 1 : 0.22;
  const attackBlend = enemy.state === "attack_player" || enemy.state === "attack_village" ? 1 : 0;
  const cadence = 2.8 + enemy.speedMps * 2.2;
  const time = currentTime * 0.001 * cadence + parts.animSeed;
  const stride = Math.sin(time);
  const strideAlt = Math.sin(time + Math.PI);
  const bob = Math.abs(Math.sin(time * 0.55));
  const torsoTwist = Math.sin(time * 0.5) * 0.045;
  const animalVariant =
    parts.variant === "zombie_pig" ||
    parts.variant === "zombie_horse" ||
    parts.variant === "zombie_cow" ||
    parts.variant === "zombie_chicken";

  if (animalVariant) {
    parts.leftArmPivot.rotation.x = 0.35 + strideAlt * 0.62 * moveBlend + attackBlend * 0.28;
    parts.rightArmPivot.rotation.x = 0.35 + stride * 0.62 * moveBlend + attackBlend * 0.28;
    parts.leftLegPivot.rotation.x = 0.25 + stride * 0.58 * moveBlend + attackBlend * 0.16;
    parts.rightLegPivot.rotation.x = 0.25 + strideAlt * 0.58 * moveBlend + attackBlend * 0.16;

    parts.leftForearmPivot.rotation.x = -0.1 + attackBlend * 0.2;
    parts.rightForearmPivot.rotation.x = -0.1 + attackBlend * 0.2;
    parts.leftKneePivot.rotation.x = -0.08 + attackBlend * 0.1;
    parts.rightKneePivot.rotation.x = -0.08 + attackBlend * 0.1;

    parts.headPivot.rotation.x = 0.06 + bob * 0.08 + attackBlend * 0.14;
    parts.headPivot.rotation.y = Math.sin(time * 0.28) * 0.08;
    parts.headPivot.rotation.z = stride * 0.04 * moveBlend;
    parts.jawPivot.rotation.x = 0.15 + bob * 0.14 + attackBlend * 0.16;
    parts.bodyRoot.position.y = parts.baseBodyY + bob * 0.02;
    parts.bodyRoot.rotation.x = 0.04 + bob * 0.02;
    parts.bodyRoot.rotation.y = torsoTwist * 0.45;
    parts.bodyRoot.rotation.z = stride * 0.025 * moveBlend;
    if (parts.tailPivot) {
      parts.tailPivot.rotation.x = -0.22 + Math.abs(stride) * 0.24 + attackBlend * 0.12;
      parts.tailPivot.rotation.y = Math.sin(time * 0.8) * 0.14;
    }

    parts.eyeMat.emissiveIntensity = 1.02 + bob * 0.38 + attackBlend * 0.4;
    if (parts.chestGlow?.material) {
      parts.chestGlow.material.emissiveIntensity = 0.78 + bob * 0.24 + attackBlend * 0.3;
    }
    return;
  }

  parts.leftLegPivot.rotation.x = 0.05 + stride * 0.52 * moveBlend - attackBlend * 0.1;
  parts.rightLegPivot.rotation.x = 0.05 + strideAlt * 0.52 * moveBlend - attackBlend * 0.1;
  parts.leftKneePivot.rotation.x = Math.max(0, -stride * 0.22) * moveBlend + attackBlend * 0.24;
  parts.rightKneePivot.rotation.x = Math.max(0, -strideAlt * 0.22) * moveBlend + attackBlend * 0.24;

  parts.leftArmPivot.rotation.x = 0.4 + strideAlt * 0.42 * moveBlend + attackBlend * 0.72;
  parts.rightArmPivot.rotation.x = 0.4 + stride * 0.42 * moveBlend + attackBlend * 0.72;
  parts.leftArmPivot.rotation.z = 0.12 + attackBlend * 0.12;
  parts.rightArmPivot.rotation.z = -0.12 - attackBlend * 0.12;
  parts.leftForearmPivot.rotation.x = 0.22 + attackBlend * 0.42;
  parts.rightForearmPivot.rotation.x = 0.22 + attackBlend * 0.42;

  parts.headPivot.rotation.x = 0.06 + bob * 0.1 + attackBlend * 0.07;
  parts.headPivot.rotation.y = Math.sin(time * 0.25) * 0.055;
  parts.headPivot.rotation.z = stride * 0.018 * moveBlend;
  parts.jawPivot.rotation.x = 0.22 + bob * 0.18 + attackBlend * 0.26;
  parts.bodyRoot.position.y = parts.baseBodyY + bob * 0.03;
  parts.bodyRoot.rotation.x = -0.06 + bob * 0.035;
  parts.bodyRoot.rotation.y = torsoTwist * moveBlend;
  parts.bodyRoot.rotation.z = stride * 0.02 * moveBlend;

  if (parts.variant === "crawler") {
    parts.bodyRoot.position.y = parts.baseBodyY - 0.22 + bob * 0.015;
    parts.bodyRoot.rotation.x = 0.22 + bob * 0.05;
    parts.leftLegPivot.rotation.x = -0.55 + stride * 0.2;
    parts.rightLegPivot.rotation.x = -0.55 + strideAlt * 0.2;
    parts.leftArmPivot.rotation.x = 0.95 + strideAlt * 0.18;
    parts.rightArmPivot.rotation.x = 0.95 + stride * 0.18;
  }

  if (parts.variant === "flyer" || parts.variant === "revenant") {
    const wingBeat = Math.sin(time * 2.8);
    parts.leftArmPivot.rotation.x = -0.2 + wingBeat * 0.6;
    parts.rightArmPivot.rotation.x = -0.2 - wingBeat * 0.6;
    parts.leftArmPivot.rotation.z = 0.65;
    parts.rightArmPivot.rotation.z = -0.65;
    parts.leftLegPivot.rotation.x = -0.48;
    parts.rightLegPivot.rotation.x = -0.48;
    parts.bodyRoot.position.y = parts.baseBodyY + 0.14 + Math.sin(time * 1.4) * 0.08;
    parts.bodyRoot.rotation.x = -0.2;
  }

  if (parts.variant === "leaper" || parts.variant === "pouncer") {
    parts.leftLegPivot.rotation.x = 0.12 + stride * 0.82 * moveBlend;
    parts.rightLegPivot.rotation.x = 0.12 + strideAlt * 0.82 * moveBlend;
    parts.leftKneePivot.rotation.x = Math.max(0, -stride * 0.35) * moveBlend + attackBlend * 0.18;
    parts.rightKneePivot.rotation.x = Math.max(0, -strideAlt * 0.35) * moveBlend + attackBlend * 0.18;
  }

  if (parts.variant === "skitter") {
    parts.bodyRoot.position.y = parts.baseBodyY - 0.08 + bob * 0.02;
    parts.leftLegPivot.rotation.x = 0.2 + stride * 0.95 * moveBlend;
    parts.rightLegPivot.rotation.x = 0.2 + strideAlt * 0.95 * moveBlend;
    parts.leftArmPivot.rotation.x = 0.55 + strideAlt * 0.6 * moveBlend;
    parts.rightArmPivot.rotation.x = 0.55 + stride * 0.6 * moveBlend;
  }

  if (parts.variant === "juggernaut") {
    parts.leftLegPivot.rotation.x = stride * 0.45 * moveBlend;
    parts.rightLegPivot.rotation.x = strideAlt * 0.45 * moveBlend;
    parts.leftArmPivot.rotation.x = 0.25 + strideAlt * 0.26 * moveBlend + attackBlend * 0.9;
    parts.rightArmPivot.rotation.x = 0.25 + stride * 0.26 * moveBlend + attackBlend * 0.9;
    parts.bodyRoot.position.y = parts.baseBodyY + bob * 0.02;
    parts.bodyRoot.rotation.x = -0.03 + bob * 0.02;
    parts.bodyRoot.rotation.y = torsoTwist * 0.6 * moveBlend;
  }

  const forwardArmPose = computeForwardArmPose({
    state: enemy.state,
    time,
    variant: parts.variant,
  });
  if (forwardArmPose) {
    parts.leftArmPivot.rotation.x = forwardArmPose.leftArmPivot.x;
    parts.leftArmPivot.rotation.y = forwardArmPose.leftArmPivot.y;
    parts.leftArmPivot.rotation.z = forwardArmPose.leftArmPivot.z;

    parts.rightArmPivot.rotation.x = forwardArmPose.rightArmPivot.x;
    parts.rightArmPivot.rotation.y = forwardArmPose.rightArmPivot.y;
    parts.rightArmPivot.rotation.z = forwardArmPose.rightArmPivot.z;

    parts.leftForearmPivot.rotation.x = forwardArmPose.leftForearmPivotX;
    parts.rightForearmPivot.rotation.x = forwardArmPose.rightForearmPivotX;
  }

  parts.eyeMat.emissiveIntensity = 1.05 + bob * 0.42 + attackBlend * 0.55;
  if (parts.chestGlow?.material) {
    parts.chestGlow.material.emissiveIntensity = 0.9 + bob * 0.35 + attackBlend * 0.45;
  }
}

export function stepEnemies({
  enemies,
  playerPosition,
  villagePosition,
  villageRadius,
  dt,
  currentTime,
  maxVisibleEnemies,
}) {
  let playerDamage = 0;
  let villageDamage = 0;

  enemies.sort((a, b) => a.bodyEntity.body.translation().z - b.bodyEntity.body.translation().z);

  for (let i = 0; i < enemies.length; i += 1) {
    const enemy = enemies[i];
    if (enemy.dead) {
      continue;
    }
    const body = enemy.bodyEntity.body;
    const translation = body.translation();
    const position = new THREE.Vector3(translation.x, translation.y, translation.z);

    const toPlayer = new THREE.Vector3().subVectors(playerPosition, position);
    const toVillage = new THREE.Vector3().subVectors(villagePosition, position);
    const toPlayerFlat = new THREE.Vector3(toPlayer.x, 0, toPlayer.z);
    const toVillageFlat = new THREE.Vector3(toVillage.x, 0, toVillage.z);
    const playerDistance = toPlayerFlat.length();
    const villageDistance = toVillageFlat.length();

    const attackPlayer = playerDistance < enemy.attackRange;
    const attackVillage = villageDistance < villageRadius + enemy.villageReach;

    enemy.hitStunSec = Math.max(0, (enemy.hitStunSec ?? 0) - dt);
    enemy.hitFlashSec = Math.max(0, (enemy.hitFlashSec ?? 0) - dt);
    enemy.damagePauseSec = Math.max(0, (enemy.damagePauseSec ?? 0) - dt);
    enemy.attackTimer += dt;

    if (enemy.hitStunSec > 0) {
      enemy.state = "hit_react";
      enemy.attackTimer = 0;
      const lv = body.linvel();
      body.setLinvel({ x: lv.x * 0.93, y: lv.y, z: lv.z * 0.93 }, true);
    } else if (attackPlayer) {
      enemy.state = "attack_player";
      if (enemy.damagePauseSec > 0) {
        enemy.attackTimer = 0;
      } else if (enemy.attackTimer >= 0.18) {
        playerDamage += enemy.attackDps * enemy.attackTimer;
        enemy.attackTimer = 0;
      }
      const holdY =
        enemy.movementMode === "flyer"
          ? THREE.MathUtils.clamp((enemy.baseY + enemy.hoverHeight - position.y) * 4.2, -2.8, 2.8)
          : body.linvel().y;
      body.setLinvel({ x: 0, y: holdY, z: 0 }, true);
    } else if (attackVillage && playerDistance > 4.5) {
      enemy.state = "attack_village";
      if (enemy.damagePauseSec > 0) {
        enemy.attackTimer = 0;
      } else if (enemy.attackTimer >= 0.25) {
        villageDamage += enemy.attackDps * enemy.attackTimer;
        enemy.attackTimer = 0;
      }
      const holdY =
        enemy.movementMode === "flyer"
          ? THREE.MathUtils.clamp((enemy.baseY + enemy.hoverHeight - position.y) * 4.2, -2.8, 2.8)
          : body.linvel().y;
      body.setLinvel({ x: 0, y: holdY, z: 0 }, true);
    } else {
      enemy.state = "advance";
      enemy.attackTimer = 0;
      const shouldDefendVillage = playerDistance > 40 && villageDistance + 8 < playerDistance;
      const target = shouldDefendVillage ? toVillageFlat : toPlayerFlat;
      if (target.lengthSq() < 0.0001) {
        target.set(0, 0, -1);
      } else {
        target.normalize();
      }
      if (enemy.zigzagStrength > 0) {
        const side = new THREE.Vector3(-target.z, 0, target.x);
        const zig = Math.sin(currentTime * 0.004 + enemy.movePhase) * enemy.zigzagStrength;
        target.addScaledVector(side, zig).normalize();
      }
      const speed = enemy.speedMps * (shouldDefendVillage ? 1 : 1.12);
      enemy.jumpTimer += dt;
      let vertical = body.linvel().y;
      if (enemy.movementMode === "flyer") {
        const hoverTarget = enemy.baseY + enemy.hoverHeight + Math.sin(currentTime * 0.003 + enemy.hoverPhase) * enemy.hoverBobAmp;
        vertical = THREE.MathUtils.clamp((hoverTarget - position.y) * 4.8, -3.2, 3.2);
      } else if (enemy.movementMode === "leaper" && enemy.jumpIntervalSec > 0 && position.y <= enemy.baseY + 0.25) {
        if (enemy.jumpTimer >= enemy.jumpIntervalSec) {
          vertical = enemy.jumpSpeed;
          enemy.jumpTimer = 0;
        }
      }
      body.setLinvel({ x: target.x * speed, y: vertical, z: target.z * speed }, true);
    }

    enemy.mesh.visible = true;
    enemy.mesh.position.set(translation.x, translation.y - enemy.visualYOffset, translation.z);
    const facing = attackPlayer ? toPlayerFlat : attackVillage ? toVillageFlat : body.linvel();
    enemy.mesh.rotation.y = Math.atan2(facing.x || 0.001, facing.z || 0.001);
    enemy.mesh.traverse((node) => {
      if (!node.isMesh || typeof node.material?.emissiveIntensity !== "number") {
        return;
      }
      const base = node.userData.baseEmissiveIntensity ?? node.material.emissiveIntensity;
      node.userData.baseEmissiveIntensity = base;
      const hitGlow = enemy.hitFlashSec > 0 ? 0.9 : 0;
      node.material.emissiveIntensity = base + hitGlow;
    });
    animateZombiePose(enemy, currentTime);

    if (enemy.hp <= 0) {
      enemy.dead = true;
      enemy.killedAt = currentTime;
    }
  }

  return {
    playerDamage,
    villageDamage,
  };
}

export function visibleEnemyPayload(enemies, max = 18) {
  return enemies
    .filter((enemy) => !enemy.dead)
    .slice(0, max)
    .map((enemy) => ({
      id: enemy.id,
      type: enemy.type,
      position: {
        x: Number(enemy.mesh.position.x.toFixed(2)),
        y: Number(enemy.mesh.position.y.toFixed(2)),
        z: Number(enemy.mesh.position.z.toFixed(2)),
      },
      hp: Math.max(0, Math.round(enemy.hp)),
      state: enemy.state,
    }));
}
