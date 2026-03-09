import { describe, expect, it } from "vitest";
import { computeVillageStructureDamage, isVillageStructureHit } from "../src/fps/systems/villageDamageRules";

describe("village structure damage rules", () => {
  it("identifies village and interior structures", () => {
    expect(isVillageStructureHit("village_townhall")).toBe(true);
    expect(isVillageStructureHit("village_core")).toBe(true);
    expect(isVillageStructureHit("interior_wall_n_village_house_a")).toBe(true);
    expect(isVillageStructureHit("lamp_market")).toBe(true);
    expect(isVillageStructureHit("ground")).toBe(false);
    expect(isVillageStructureHit("prop_crate_1")).toBe(false);
  });

  it("scales damage by material and shattered windows", () => {
    const concrete = computeVillageStructureDamage({
      projectileDamage: 22,
      weaponCategory: "ballistic",
      materialId: "concrete",
      windowShattered: false,
    });
    const glass = computeVillageStructureDamage({
      projectileDamage: 22,
      weaponCategory: "ballistic",
      materialId: "glass",
      windowShattered: true,
    });
    expect(concrete).toBeGreaterThan(0);
    expect(glass).toBeGreaterThan(concrete);
  });

  it("makes explosive structure hits hurt more than ballistic", () => {
    const ballistic = computeVillageStructureDamage({
      projectileDamage: 80,
      weaponCategory: "ballistic",
      materialId: "wood",
      windowShattered: false,
    });
    const explosive = computeVillageStructureDamage({
      projectileDamage: 80,
      weaponCategory: "explosive",
      materialId: "wood",
      windowShattered: false,
    });
    expect(explosive).toBeGreaterThan(ballistic);
  });
});
