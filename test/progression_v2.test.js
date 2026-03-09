import { describe, expect, it } from "vitest";
import { defaultFpsSave } from "../src/fps/systems/saveFps";
import {
  applyWaveClearProgression,
  buyGrenadePack,
  consumeGrenadeCount,
} from "../src/fps/systems/progressionRules";

describe("v2 progression rules", () => {
  it("unlocks pistol for purchase after wave 1 clear", () => {
    const save = defaultFpsSave();
    const result = applyWaveClearProgression(save, 1, { pistolUnlockWave: 1 });
    expect(result.unlocked).toBe(true);
    expect(save.pistolUnlocked).toBe(true);
    expect(save.unlockedWeapons).toContain("pistol");
    expect(save.ownedWeapons).toEqual(["pipe"]);
    expect(save.equippedWeaponId).toBe("pipe");
  });

  it("consumes grenade and supports grenade pack purchases", () => {
    const afterThrow = consumeGrenadeCount(5);
    expect(afterThrow).toBe(4);

    const purchased = buyGrenadePack({
      coins: 200,
      grenades: 1,
      pack: { amount: 2, cost: 120 },
    });
    expect(purchased.purchased).toBe(true);
    expect(purchased.coins).toBe(80);
    expect(purchased.grenades).toBe(3);
  });
});
