import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createEnemyState, stepEnemies, visibleEnemyPayload } from "../src/fps/systems/enemyAi3D";

function createBody(position = { x: 0, y: 0, z: 0 }) {
  const pos = { ...position };
  const lv = { x: 0, y: 0, z: 0 };
  return {
    translation() {
      return pos;
    },
    linvel() {
      return lv;
    },
    setLinvel(next) {
      lv.x = next.x;
      lv.y = next.y;
      lv.z = next.z;
    },
  };
}

function createMesh() {
  return {
    userData: {},
    position: new THREE.Vector3(),
    rotation: { y: 0 },
    visible: true,
    traverse() {},
  };
}

function makeEnemy({
  id = "walker",
  movementMode = "ground",
  position = { x: 0, y: 0, z: 0 },
  wave = 1,
  overrides = {},
} = {}) {
  const bodyEntity = { id: `${id}-entity`, body: createBody(position) };
  const def = {
    id,
    label: id,
    hp: 20,
    speedMps: 2,
    attackDps: 10,
    massKg: 40,
    coinReward: 10,
    hitboxProfile: "normal",
    movementMode,
    attackRange: 2,
    villageReach: 1,
    ...overrides,
  };
  return createEnemyState(def, bodyEntity, createMesh(), position, wave);
}

describe("enemy ai", () => {
  it("prioritizes nearby player attacks", () => {
    const enemy = makeEnemy({
      id: "walker",
      position: { x: 0, y: 0, z: 0 },
      overrides: { attackDps: 20, attackRange: 2 },
    });
    const result = stepEnemies({
      enemies: [enemy],
      playerPosition: new THREE.Vector3(1, 0, 0),
      villagePosition: new THREE.Vector3(0, 0, 6),
      villageRadius: 1.2,
      dt: 0.2,
      currentTime: 100,
      maxVisibleEnemies: 5,
    });
    expect(enemy.state).toBe("attack_player");
    expect(result.playerDamage).toBeGreaterThan(0);
    expect(result.villageDamage).toBe(0);
  });

  it("attacks village when player is far and village is in reach", () => {
    const enemy = makeEnemy({
      id: "walker",
      position: { x: 0.5, y: 0, z: 0 },
      overrides: { attackDps: 12, attackRange: 1.4, villageReach: 0.8 },
    });
    const result = stepEnemies({
      enemies: [enemy],
      playerPosition: new THREE.Vector3(12, 0, 0),
      villagePosition: new THREE.Vector3(0, 0, 0),
      villageRadius: 1.2,
      dt: 0.3,
      currentTime: 100,
      maxVisibleEnemies: 5,
    });
    expect(enemy.state).toBe("attack_village");
    expect(result.playerDamage).toBe(0);
    expect(result.villageDamage).toBeGreaterThan(0);
  });

  it("applies leaper jump impulse while advancing", () => {
    const enemy = makeEnemy({
      id: "leaper",
      movementMode: "leaper",
      position: { x: 0, y: 0, z: 0 },
      overrides: { jumpIntervalSec: 0.12, jumpSpeed: 7, attackRange: 0.8 },
    });
    enemy.jumpTimer = 0.2;

    stepEnemies({
      enemies: [enemy],
      playerPosition: new THREE.Vector3(16, 0, 0),
      villagePosition: new THREE.Vector3(-16, 0, 0),
      villageRadius: 0.5,
      dt: 0.1,
      currentTime: 100,
      maxVisibleEnemies: 5,
    });

    expect(enemy.state).toBe("advance");
    expect(enemy.bodyEntity.body.linvel().y).toBe(7);
  });

  it("pauses enemy damage output briefly after being hit", () => {
    const enemy = makeEnemy({
      id: "walker",
      position: { x: 0, y: 0, z: 0 },
      overrides: { attackDps: 24, attackRange: 2 },
    });
    enemy.damagePauseSec = 0.5;

    const first = stepEnemies({
      enemies: [enemy],
      playerPosition: new THREE.Vector3(1, 0, 0),
      villagePosition: new THREE.Vector3(0, 0, 8),
      villageRadius: 1.2,
      dt: 0.2,
      currentTime: 100,
      maxVisibleEnemies: 5,
    });
    expect(enemy.state).toBe("attack_player");
    expect(first.playerDamage).toBe(0);

    const second = stepEnemies({
      enemies: [enemy],
      playerPosition: new THREE.Vector3(1, 0, 0),
      villagePosition: new THREE.Vector3(0, 0, 8),
      villageRadius: 1.2,
      dt: 0.2,
      currentTime: 200,
      maxVisibleEnemies: 5,
    });
    expect(second.playerDamage).toBe(0);

    const third = stepEnemies({
      enemies: [enemy],
      playerPosition: new THREE.Vector3(1, 0, 0),
      villagePosition: new THREE.Vector3(0, 0, 8),
      villageRadius: 1.2,
      dt: 0.2,
      currentTime: 300,
      maxVisibleEnemies: 5,
    });
    expect(third.playerDamage).toBeGreaterThan(0);
  });

  it("builds visible payload from alive enemies only", () => {
    const alive = makeEnemy({ id: "runner", position: { x: 2, y: 0, z: -4 } });
    const dead = makeEnemy({ id: "walker", position: { x: -1, y: 0, z: -2 } });
    dead.dead = true;
    stepEnemies({
      enemies: [dead, alive],
      playerPosition: new THREE.Vector3(30, 0, 0),
      villagePosition: new THREE.Vector3(-30, 0, 0),
      villageRadius: 0.5,
      dt: 0.1,
      currentTime: 100,
      maxVisibleEnemies: 5,
    });

    const payload = visibleEnemyPayload([dead, alive], 1);
    expect(payload).toHaveLength(1);
    expect(payload[0].type).toBe("runner");
    expect(payload[0].position.z).toBe(-4);
  });
});
