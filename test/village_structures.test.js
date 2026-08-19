import { describe, expect, it } from "vitest";
import {
  BASE_VILLAGE_MAX_HP,
  VILLAGE_FENCE_GATES,
  VILLAGE_FENCE_SEGMENTS,
  VILLAGE_STRUCTURE_DEFS,
  createVillageStructureStates,
  getVillageStructureAttackPoint,
  getVillageStructureDamageTier,
  getVillageStructureNavigationPoint,
  resizeVillageStructureStates,
  selectNearestLiveVillageStructure,
} from "../src/playcanvas/villageStructures";

describe("village structure rules", () => {
  it("allocates the full village health budget across all rendered structures", () => {
    const structures = createVillageStructureStates();
    expect(structures.map((structure) => structure.id)).toEqual(
      VILLAGE_STRUCTURE_DEFS.map((structure) => structure.id),
    );
    expect(structures.reduce((total, structure) => total + structure.maxHp, 0)).toBe(BASE_VILLAGE_MAX_HP);
    expect(structures.every((structure) => structure.hp === structure.maxHp)).toBe(true);
  });

  it("keeps a live preferred target stable, then chooses the nearest survivor after destruction", () => {
    const structures = createVillageStructureStates();
    const origin = { x: -13.2, z: -13 };
    const sticky = selectNearestLiveVillageStructure(structures, origin, "barn");
    expect(sticky.id).toBe("barn");

    structures.find((structure) => structure.id === "barn").hp = 0;
    const retargeted = selectNearestLiveVillageStructure(structures, origin, "barn");
    expect(retargeted.id).toBe("safe_house");
  });

  it("targets a building perimeter and routes side structures through their authored gate", () => {
    const safeHouse = VILLAGE_STRUCTURE_DEFS.find((structure) => structure.id === "safe_house");
    const insideLane = { x: 0, z: -30 };
    const attackPoint = getVillageStructureAttackPoint(safeHouse, insideLane);
    expect(attackPoint.x).toBeCloseTo(safeHouse.x + safeHouse.sx * 0.5, 5);
    expect(attackPoint.z).toBeGreaterThanOrEqual(safeHouse.z - safeHouse.sz * 0.5);
    expect(attackPoint.z).toBeLessThanOrEqual(safeHouse.z + safeHouse.sz * 0.5);

    expect(getVillageStructureNavigationPoint(safeHouse, insideLane)).toEqual({ x: -8.1, z: -12.4 });
    expect(getVillageStructureNavigationPoint(safeHouse, { x: -9, z: -12.4 })).toEqual(
      getVillageStructureAttackPoint(safeHouse, { x: -9, z: -12.4 }),
    );
  });

  it("leaves physical fence segments around every gate opening", () => {
    for (const gate of VILLAGE_FENCE_GATES) {
      const gateStart = gate.z - gate.halfWidth;
      const gateEnd = gate.z + gate.halfWidth;
      expect(VILLAGE_FENCE_SEGMENTS.some((segment) => segment.minZ < gateEnd && segment.maxZ > gateStart)).toBe(false);
    }
    expect(VILLAGE_FENCE_SEGMENTS[0].minZ).toBe(-58);
    expect(VILLAGE_FENCE_SEGMENTS.at(-1).maxZ).toBe(22);
  });

  it("maps healthy, damaged, critical, and destroyed health states to distinct tiers", () => {
    expect(getVillageStructureDamageTier({ hp: 100, maxHp: 100 })).toBe(0);
    expect(getVillageStructureDamageTier({ hp: 70, maxHp: 100 })).toBe(1);
    expect(getVillageStructureDamageTier({ hp: 40, maxHp: 100 })).toBe(2);
    expect(getVillageStructureDamageTier({ hp: 15, maxHp: 100 })).toBe(3);
    expect(getVillageStructureDamageTier({ hp: 0, maxHp: 100 })).toBe(4);
  });

  it("preserves each building's damage ratio on capacity changes and fully repairs only when requested", () => {
    const structures = createVillageStructureStates();
    structures[0].hp = structures[0].maxHp * 0.25;
    structures[1].hp = 0;

    const resized = resizeVillageStructureStates(structures, BASE_VILLAGE_MAX_HP * 1.2);
    expect(resized[0].hp / resized[0].maxHp).toBeCloseTo(0.25, 6);
    expect(resized[1].hp).toBe(0);

    const repaired = resizeVillageStructureStates(structures, BASE_VILLAGE_MAX_HP * 1.2, { repair: true });
    expect(repaired.every((structure) => structure.hp === structure.maxHp)).toBe(true);
  });
});
