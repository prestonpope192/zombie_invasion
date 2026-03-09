import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

const GRAVITY = new THREE.Vector3(0, -9.81, 0);

export class PhysicsWorld {
  constructor() {
    this.ready = false;
    this.rapier = null;
    this.world = null;
    this.characterController = null;
    this.bodies = new Map();
    this.colliderToId = new Map();
    this.stepSamples = [];
    this.avgStepMs = 0;
  }

  async init() {
    if (this.ready) {
      return;
    }
    await RAPIER.init();
    this.rapier = RAPIER;
    this.world = new RAPIER.World({ x: GRAVITY.x, y: GRAVITY.y, z: GRAVITY.z });
    this.characterController = this.world.createCharacterController(0.02);
    this.characterController.setApplyImpulsesToDynamicBodies(true);
    this.ready = true;
  }

  createPlayerCapsule(position, radius = 0.34, halfHeight = 0.44) {
    const bodyDesc = this.rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(position.x, position.y, position.z);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = this.rapier.ColliderDesc.capsule(halfHeight, radius)
      .setFriction(0.55)
      .setRestitution(0.01)
      .setCollisionGroups(0x0001ffff);
    const collider = this.world.createCollider(colliderDesc, body);
    return { body, collider, radius, halfHeight };
  }

  createStaticBox(id, position, size, options = {}) {
    const bodyDesc = this.rapier.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = this.rapier.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
      .setFriction(options.friction ?? 0.8)
      .setRestitution(options.restitution ?? 0.05);
    const collider = this.world.createCollider(colliderDesc, body);
    const entity = { id, type: "static", body, collider, size, material: options.material ?? "concrete" };
    this.bodies.set(id, entity);
    this.colliderToId.set(collider.handle, id);
    return entity;
  }

  createDynamicBox(id, position, size, massKg = 20, options = {}) {
    const bodyDesc = this.rapier.RigidBodyDesc.dynamic().setTranslation(position.x, position.y, position.z);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = this.rapier.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
      .setDensity(Math.max(1, massKg / Math.max(0.1, size.x * size.y * size.z)))
      .setFriction(options.friction ?? 0.7)
      .setRestitution(options.restitution ?? 0.02);
    const collider = this.world.createCollider(colliderDesc, body);
    const entity = { id, type: "dynamic", body, collider, size, material: options.material ?? "wood" };
    this.bodies.set(id, entity);
    this.colliderToId.set(collider.handle, id);
    return entity;
  }

  createEnemyBody(id, position, radius, halfHeight, massKg) {
    const bodyDesc = this.rapier.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .setCanSleep(false)
      .setLinearDamping(4.5)
      .setAngularDamping(7);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = this.rapier.ColliderDesc.capsule(halfHeight, radius)
      .setDensity(Math.max(0.3, massKg / 65))
      .setFriction(0.85)
      .setRestitution(0.03);
    const collider = this.world.createCollider(colliderDesc, body);
    const entity = { id, type: "enemy", body, collider, radius, halfHeight, material: "flesh" };
    this.bodies.set(id, entity);
    this.colliderToId.set(collider.handle, id);
    return entity;
  }

  moveCharacter(player, desiredTranslation) {
    const current = player.body.translation();
    this.characterController.computeColliderMovement(player.collider, desiredTranslation);
    const correction = this.characterController.computedMovement();
    player.body.setNextKinematicTranslation({
      x: current.x + correction.x,
      y: current.y + correction.y,
      z: current.z + correction.z,
    });
    return {
      correction,
      grounded: this.characterController.computedGrounded(),
    };
  }

  step(dt) {
    if (!this.world) {
      return;
    }
    const t0 = performance.now();
    this.world.timestep = dt;
    this.world.step();
    const elapsed = performance.now() - t0;
    this.stepSamples.push(elapsed);
    if (this.stepSamples.length > 120) {
      this.stepSamples.shift();
    }
    this.avgStepMs = this.stepSamples.reduce((sum, value) => sum + value, 0) / this.stepSamples.length;
  }

  removeBody(id) {
    const entity = this.bodies.get(id);
    if (!entity) {
      return;
    }
    this.world.removeCollider(entity.collider, false);
    this.world.removeRigidBody(entity.body);
    this.colliderToId.delete(entity.collider.handle);
    this.bodies.delete(id);
  }

  castRay(origin, direction, maxDistance = 120) {
    const ray = new this.rapier.Ray(origin, direction);
    const hit =
      typeof this.world.castRayAndGetNormal === "function"
        ? this.world.castRayAndGetNormal(ray, maxDistance, true)
        : this.world.castRay(ray, maxDistance, true);
    if (!hit) {
      return null;
    }
    const toi = hit.timeOfImpact ?? hit.toi ?? 0;
    const normal = hit.normal ? new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z) : new THREE.Vector3(0, 1, 0);
    return {
      toi,
      collider: hit.collider ?? hit.colliderHandle ?? null,
      point: new THREE.Vector3(
        origin.x + direction.x * toi,
        origin.y + direction.y * toi,
        origin.z + direction.z * toi,
      ),
      normal,
    };
  }

  activeBodies() {
    return this.bodies.size;
  }

  getEntityByCollider(colliderLike) {
    if (!colliderLike) {
      return null;
    }
    const handle = typeof colliderLike === "number" ? colliderLike : colliderLike.handle;
    const id = this.colliderToId.get(handle);
    return id ? this.bodies.get(id) : null;
  }
}
