import { describe, expect, it } from "vitest";
import { ballisticDropAtDistance, createProjectile, stepProjectile } from "../src/fps/systems/weaponBallistics";
import * as THREE from "three";

describe("ballistics", () => {
  it("matches expected projectile drop trend", () => {
    const d25 = ballisticDropAtDistance(25, 620);
    const d50 = ballisticDropAtDistance(50, 620);
    const d100 = ballisticDropAtDistance(100, 620);
    expect(d25).toBeGreaterThan(0);
    expect(d50).toBeGreaterThan(d25);
    expect(d100).toBeGreaterThan(d50);
  });

  it("slows projectile with drag over time", () => {
    const projectile = createProjectile({
      weapon: { id: "rifle", muzzleVelocityMps: 600, massGrams: 10, drag: 0.28, category: "ballistic" },
      position: new THREE.Vector3(0, 1.6, 0),
      direction: new THREE.Vector3(0, 0, -1),
    });
    const before = projectile.velocity.length();
    stepProjectile(projectile, 0.1);
    expect(projectile.velocity.length()).toBeLessThan(before);
  });
});
