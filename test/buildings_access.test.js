import { describe, expect, it } from "vitest";
import buildings from "../src/fps/config/buildings_fps.json";

describe("enterable village buildings", () => {
  it("defines interiors for all village structures with doors", () => {
    const requiredIds = [
      "village_house_a",
      "village_house_b",
      "village_blacksmith",
      "village_townhall",
      "village_chapel",
      "village_barn",
    ];

    const idSet = new Set(buildings.map((entry) => entry.id));
    for (const id of requiredIds) {
      expect(idSet.has(id)).toBe(true);
    }

    for (const entry of buildings) {
      expect(typeof entry.exteriorDoor?.x).toBe("number");
      expect(typeof entry.exteriorDoor?.z).toBe("number");
      expect(typeof entry.exteriorSpawn?.x).toBe("number");
      expect(typeof entry.exteriorSpawn?.z).toBe("number");
      expect(typeof entry.interior?.doorInside?.x).toBe("number");
      expect(typeof entry.interior?.doorInside?.z).toBe("number");
      expect(typeof entry.interior?.spawnInside?.x).toBe("number");
      expect(typeof entry.interior?.spawnInside?.z).toBe("number");
    }
  });
});
