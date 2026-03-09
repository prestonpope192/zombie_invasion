import { describe, expect, it } from "vitest";
import { applyPenetration, penetrationLoss } from "../src/fps/systems/weaponBallistics";

describe("penetration model", () => {
  const wood = { density: 0.7, penetrationLossPerCm: 26 };
  const steel = { density: 7.8, penetrationLossPerCm: 180 };

  it("penalizes dense material more", () => {
    const woodLoss = penetrationLoss(wood, 8);
    const steelLoss = penetrationLoss(steel, 8);
    expect(steelLoss).toBeGreaterThan(woodLoss);
  });

  it("stops projectile when energy is exhausted", () => {
    const lowEnergy = applyPenetration(220, steel, 3);
    expect(lowEnergy.penetrated).toBe(false);
    expect(lowEnergy.remaining).toBe(0);
  });
});
