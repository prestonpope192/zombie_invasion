import { describe, expect, it } from "vitest";
import {
  VILLAGER_PERK_DEFS,
  computeDiscountedCost,
  computeEscortFollowTarget,
  computeEscortDamage,
  getVillagerPerkModifiers,
  isVillagerAvailable,
} from "../src/fps/systems/villagerEscortRules";

describe("villager escort rules", () => {
  it("respects rescued/dead villager availability", () => {
    const save = {
      rescuedVillagers: ["villager_house_a"],
      deadVillagers: ["villager_house_b"],
    };
    expect(isVillagerAvailable(save, "villager_house_a")).toBe(false);
    expect(isVillagerAvailable(save, "villager_house_b")).toBe(false);
    expect(isVillagerAvailable(save, "villager_blacksmith")).toBe(true);
  });

  it("aggregates all unlocked villager perks", () => {
    const allIds = Object.keys(VILLAGER_PERK_DEFS);
    const modifiers = getVillagerPerkModifiers({
      rescuedVillagers: allIds,
    });
    expect(modifiers.startingGrenadesBonus).toBe(2);
    expect(modifiers.killCoinMultiplier).toBeCloseTo(1.1, 6);
    expect(modifiers.shopCostMultiplier).toBeCloseTo(0.9, 6);
    expect(modifiers.villageHpMultiplier).toBeCloseTo(1.15, 6);
    expect(modifiers.damageReductionBonus).toBeCloseTo(0.06, 6);
    expect(modifiers.grenadeCooldownMultiplier).toBeCloseTo(0.8, 6);
  });

  it("clamps escort damage by max attackers", () => {
    const damage = computeEscortDamage(0.5, 8, 12, 3);
    expect(damage).toBeCloseTo(18, 6);
  });

  it("places escort target behind player across yaw angles", () => {
    const offset = { x: 0, z: 3.4 };
    const facingNorth = computeEscortFollowTarget({ x: 10, y: 2, z: 5 }, 0, offset);
    expect(facingNorth.x).toBeCloseTo(10, 6);
    expect(facingNorth.z).toBeCloseTo(8.4, 6);

    const facingEast = computeEscortFollowTarget({ x: 10, y: 2, z: 5 }, Math.PI * 0.5, offset);
    expect(facingEast.x).toBeCloseTo(6.6, 6);
    expect(facingEast.z).toBeCloseTo(5, 6);
  });

  it("rounds discounted costs down to integers", () => {
    expect(computeDiscountedCost(220, 0.9)).toBe(198);
    expect(computeDiscountedCost(95, 0.9)).toBe(85);
    expect(computeDiscountedCost(50, 1)).toBe(50);
  });
});
