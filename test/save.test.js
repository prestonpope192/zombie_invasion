import { describe, expect, it } from "vitest";
import {
  FPS_SAVE_KEY,
  LEGACY_FPS_SAVE_KEY,
  defaultFpsSave,
  loadFpsSave,
  persistFpsSave,
  sanitizeFpsSave,
} from "../src/fps/systems/saveFps";

describe("fps save schema", () => {
  it("round-trips and enforces profile defaults", () => {
    const storage = {
      values: new Map(),
      getItem(key) {
        return this.values.get(key) ?? null;
      },
      setItem(key, value) {
        this.values.set(key, value);
      },
      removeItem(key) {
        this.values.delete(key);
      },
    };

    const save = defaultFpsSave();
    save.coins = 444;
    save.equippedWeaponId = "pipe";
    save.grenades = 9;
    save.grenadeInventory.frag = 9;
    save.grenadeInventory.breacher = 2;
    save.activeGrenadeId = "breacher";

    persistFpsSave(save, storage);
    const loaded = loadFpsSave(storage);

    expect(storage.getItem(FPS_SAVE_KEY)).toBeTruthy();
    expect(loaded.profileType).toBe("fps_house_v2");
    expect(loaded.coins).toBe(444);
    expect(loaded.ownedWeapons).toContain("pipe");
    expect(loaded.grenades).toBe(9);
    expect(loaded.grenadeInventory.frag).toBe(9);
    expect(loaded.grenadeInventory.breacher).toBe(2);
    expect(loaded.activeGrenadeId).toBe("breacher");
    expect(loaded.pistolUnlocked).toBe(false);
    expect(loaded.deadVillagers).toEqual([]);
    expect(loaded.villageLevel).toBe(1);
  });

  it("starts fresh v2 profile when only legacy save exists", () => {
    const storage = {
      values: new Map(),
      getItem(key) {
        return this.values.get(key) ?? null;
      },
      setItem(key, value) {
        this.values.set(key, value);
      },
      removeItem(key) {
        this.values.delete(key);
      },
    };

    storage.setItem(
      LEGACY_FPS_SAVE_KEY,
      JSON.stringify({
        version: 1,
        coins: 9999,
        ownedWeapons: ["rpg"],
      }),
    );

    const loaded = loadFpsSave(storage);
    expect(loaded.version).toBe(2);
    expect(loaded.profileType).toBe("fps_house_v2");
    expect(loaded.coins).toBe(0);
    expect(loaded.ownedWeapons).toEqual(["pipe"]);
    expect(loaded.equippedWeaponId).toBe("pipe");
    expect(loaded.grenades).toBe(5);
    expect(storage.getItem(FPS_SAVE_KEY)).toBeNull();
  });

  it("drops weapons that are not both owned and unlocked", () => {
    const loaded = sanitizeFpsSave({
      ownedWeapons: ["pipe", "shotgun", "rpg"],
      unlockedWeapons: ["pipe", "rpg"],
      equippedWeaponId: "shotgun",
      pistolUnlocked: false,
    });

    expect(loaded.ownedWeapons).toEqual(["pipe", "rpg"]);
    expect(loaded.equippedWeaponId).toBe("pipe");
  });

  it("does not auto-grant pistol ownership when only unlocked", () => {
    const loaded = sanitizeFpsSave({
      ownedWeapons: ["pipe"],
      unlockedWeapons: ["pipe"],
      equippedWeaponId: "pipe",
      pistolUnlocked: true,
    });

    expect(loaded.unlockedWeapons).toContain("pistol");
    expect(loaded.ownedWeapons).toEqual(["pipe"]);
    expect(loaded.equippedWeaponId).toBe("pipe");
  });

  it("adds deadVillagers default and lets rescued override dead overlap", () => {
    const loaded = sanitizeFpsSave({
      rescuedVillagers: ["villager_barn"],
      deadVillagers: ["villager_barn", "villager_house_b"],
    });
    expect(loaded.deadVillagers).toEqual(["villager_house_b"]);
    expect(loaded.rescuedVillagers).toEqual(["villager_barn"]);
  });

  it("clamps villageLevel to at least 1", () => {
    const loaded = sanitizeFpsSave({ villageLevel: 0 });
    expect(loaded.villageLevel).toBe(1);
  });

  it("migrates legacy grenade count into typed inventory", () => {
    const loaded = sanitizeFpsSave({ grenades: 7, activeGrenadeId: "not_real" });
    expect(loaded.grenadeInventory.frag).toBe(7);
    expect(loaded.grenadeInventory.breacher).toBe(0);
    expect(loaded.activeGrenadeId).toBe("frag");
  });

  it("preserves bestWave beyond the authored campaign length", () => {
    const loaded = sanitizeFpsSave({ bestWave: 37 });
    expect(loaded.bestWave).toBe(37);
  });
});
