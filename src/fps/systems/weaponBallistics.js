import * as THREE from "three";

const GRAVITY_MPS2 = 9.81;

export function speedToEnergyJ(massGrams, speedMps) {
  const massKg = Math.max(0.0001, massGrams / 1000);
  return 0.5 * massKg * speedMps * speedMps;
}

export function moaToRadians(moa) {
  return ((moa || 0) / 60) * (Math.PI / 180);
}

export function randomSpreadDirection(forward, spreadMoa, adsScale = 1) {
  const axisA = new THREE.Vector3(0, 1, 0).cross(forward).normalize();
  const axisB = new THREE.Vector3().crossVectors(forward, axisA).normalize();
  const spreadRad = moaToRadians(spreadMoa) * adsScale;
  const yaw = (Math.random() * 2 - 1) * spreadRad;
  const pitch = (Math.random() * 2 - 1) * spreadRad;
  return new THREE.Vector3()
    .copy(forward)
    .add(axisA.multiplyScalar(yaw))
    .add(axisB.multiplyScalar(pitch))
    .normalize();
}

export function createProjectile({ weapon, position, direction }) {
  const speed = weapon.muzzleVelocityMps;
  const velocity = direction.clone().multiplyScalar(speed);
  return {
    id: `proj_${Math.random().toString(36).slice(2, 11)}`,
    weaponId: weapon.id,
    position: position.clone(),
    velocity,
    massGrams: weapon.massGrams,
    drag: weapon.drag,
    remainingEnergyJ: speedToEnergyJ(weapon.massGrams, speed),
    alive: true,
    traveled: 0,
    lifeSec: weapon.category === "explosive" ? 5 : 2.8,
  };
}

export function stepProjectile(projectile, dt) {
  const speed = projectile.velocity.length();
  if (speed <= 0.0001 || !projectile.alive) {
    return projectile;
  }

  // Exponential damping keeps drag stable across fixed/variable time steps.
  const dragDamping = Math.exp(-projectile.drag * dt);
  projectile.velocity.multiplyScalar(dragDamping);
  projectile.velocity.y -= GRAVITY_MPS2 * dt;

  const displacement = projectile.velocity.clone().multiplyScalar(dt);
  projectile.position.add(displacement);
  projectile.traveled += displacement.length();
  projectile.lifeSec -= dt;

  projectile.remainingEnergyJ = speedToEnergyJ(projectile.massGrams, projectile.velocity.length());
  if (projectile.lifeSec <= 0 || projectile.remainingEnergyJ <= 3) {
    projectile.alive = false;
  }

  return projectile;
}

export function penetrationLoss(materialDef, thicknessCm) {
  const density = materialDef?.density ?? 1;
  const lossPerCm = materialDef?.penetrationLossPerCm ?? 60;
  return density * lossPerCm * Math.max(0.1, thicknessCm);
}

export function applyPenetration(energyJ, materialDef, thicknessCm) {
  const loss = penetrationLoss(materialDef, thicknessCm);
  const remaining = Math.max(0, energyJ - loss);
  return {
    loss,
    remaining,
    penetrated: remaining > 0,
  };
}

export function initRecoilState() {
  return {
    pitchKick: 0,
    yawKick: 0,
    recovery: 0,
  };
}

export function applyRecoilImpulse(state, pattern, ads = false) {
  const adsScale = ads ? 0.65 : 1;
  state.pitchKick += (pattern.vertical ?? 0.3) * adsScale;
  state.yawKick += (Math.random() > 0.5 ? 1 : -1) * (pattern.horizontal ?? 0.1) * adsScale;
  state.recovery = pattern.recovery ?? 6;
  return state;
}

export function recoverRecoil(state, dt) {
  const rec = Math.max(1, state.recovery);
  state.pitchKick = THREE.MathUtils.damp(state.pitchKick, 0, rec, dt);
  state.yawKick = THREE.MathUtils.damp(state.yawKick, 0, rec * 0.9, dt);
  return state;
}

export function ballisticDropAtDistance(distanceMeters, muzzleVelocityMps) {
  const t = distanceMeters / Math.max(0.001, muzzleVelocityMps);
  return 0.5 * GRAVITY_MPS2 * t * t;
}
