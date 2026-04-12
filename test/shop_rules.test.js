import { describe, expect, it } from "vitest";
import {
  applyArmorBuyOrEquip,
  applyGrenadePackBuy,
  applyMedKitBuy,
  applyVillageUpgradePurchase,
  applyWeaponBuyOrEquip,
  getArmorShopState,
  getGrenadePackShopState,
  getMedKitShopState,
  getVillageLevelHpMultiplier,
  getVillageUpgradeState,
  getWeaponShopState,
} from "../src/fps/systems/shopRules";

function makeSave(overrides = {}) {
  const fragCount = overrides.grenades ?? 5;
  return {
    coins: 300,
    ownedWeapons: ["pipe"],
    unlockedWeapons: ["pipe"],
    equippedWeaponId: "pipe",
    ownedArmors: ["cloth"],
    equippedArmorId: "cloth",
    villageLevel: 1,
    pistolUnlocked: false,
    grenades: fragCount,
    grenadeInventory: { frag: fragCount, breacher: 0, nova: 0 },
    activeGrenadeId: "frag",
    ...overrides,
  };
}

describe("shop rules", () => {
  it("locks pistol behind wave-1 progression until unlocked", () => {
    const pistol = { id: "pistol", unlockWave: 1, cost: 50 };
    const state = getWeaponShopState({
      weapon: pistol,
      waveNumber: 3,
      save: makeSave({ pistolUnlocked: false }),
    });
    expect(state.progressionLocked).toBe(true);
    expect(state.disabled).toBe(true);
    expect(state.status).toBe("Clears Wave 1");
  });

  it("buys then equips owned weapons without re-charging coins", () => {
    const shotgun = { id: "shotgun", unlockWave: 1, cost: 250 };
    const save = makeSave({ coins: 400, pistolUnlocked: true });

    const bought = applyWeaponBuyOrEquip({ weapon: shotgun, waveNumber: 2, save });
    expect(bought).toEqual({ changed: true, action: "buy" });
    expect(save.coins).toBe(150);
    expect(save.ownedWeapons).toContain("shotgun");
    expect(save.equippedWeaponId).toBe("shotgun");

    save.equippedWeaponId = "pipe";
    const equipped = applyWeaponBuyOrEquip({ weapon: shotgun, waveNumber: 2, save });
    expect(equipped).toEqual({ changed: true, action: "equip" });
    expect(save.coins).toBe(150);
    expect(save.equippedWeaponId).toBe("shotgun");
  });

  it("handles grenade pack purchases with affordability checks", () => {
    const save = makeSave({ coins: 120, grenades: 1 });
    const purchased = applyGrenadePackBuy({
      pack: { amount: 2, cost: 90 },
      save,
    });
    expect(purchased).toEqual({ changed: true });
    expect(save.coins).toBe(30);
    expect(save.grenades).toBe(3);

    const blocked = applyGrenadePackBuy({
      pack: { amount: 2, cost: 90 },
      save,
    });
    expect(blocked).toEqual({ changed: false });
    expect(save.coins).toBe(30);
    expect(save.grenades).toBe(3);
  });

  it("wave-locks premium grenade packs and auto-equips bought heavy grenades", () => {
    const save = makeSave({ coins: 400, grenades: 5 });
    const locked = getGrenadePackShopState({
      pack: { grenadeTypeId: "breacher", amount: 1, cost: 280, unlockWave: 4 },
      waveNumber: 3,
      save,
    });
    expect(locked.waveLocked).toBe(true);
    expect(locked.status).toBe("Unlocks Wave 4");

    const purchased = applyGrenadePackBuy({
      pack: { grenadeTypeId: "breacher", amount: 1, cost: 280, unlockWave: 4 },
      waveNumber: 4,
      save,
    });
    expect(purchased).toEqual({ changed: true });
    expect(save.coins).toBe(120);
    expect(save.grenadeInventory.breacher).toBe(1);
    expect(save.activeGrenadeId).toBe("breacher");
  });

  it("uses med kit to fully heal for 20 coins", () => {
    const save = makeSave({ coins: 60 });
    const state = getMedKitShopState({
      save,
      currentHp: 47,
      maxHp: 100,
      cost: 20,
    });
    expect(state.disabled).toBe(false);
    expect(state.status).toBe("20 coins");

    const bought = applyMedKitBuy({
      save,
      currentHp: 47,
      maxHp: 100,
      cost: 20,
    });
    expect(bought).toEqual({ changed: true, newHp: 100 });
    expect(save.coins).toBe(40);
  });

  it("blocks med kit when already full health", () => {
    const save = makeSave({ coins: 60 });
    const state = getMedKitShopState({
      save,
      currentHp: 100,
      maxHp: 100,
      cost: 20,
    });
    expect(state.disabled).toBe(true);
    expect(state.status).toBe("Full Health");

    const result = applyMedKitBuy({
      save,
      currentHp: 100,
      maxHp: 100,
      cost: 20,
    });
    expect(result).toEqual({ changed: false, newHp: 100 });
    expect(save.coins).toBe(60);
  });

  it("buys and equips armor upgrades", () => {
    const kevlar = { id: "kevlar", cost: 300 };
    const save = makeSave({ coins: 360 });
    const initial = getArmorShopState({ armor: kevlar, save });
    expect(initial.owned).toBe(false);
    expect(initial.status).toBe("300 coins");

    const bought = applyArmorBuyOrEquip({ armor: kevlar, save });
    expect(bought).toEqual({ changed: true, action: "buy" });
    expect(save.coins).toBe(60);
    expect(save.ownedArmors).toContain("kevlar");
    expect(save.equippedArmorId).toBe("kevlar");

    save.equippedArmorId = "cloth";
    const equipped = applyArmorBuyOrEquip({ armor: kevlar, save });
    expect(equipped).toEqual({ changed: true, action: "equip" });
    expect(save.coins).toBe(60);
    expect(save.equippedArmorId).toBe("kevlar");
  });

  it("applies blacksmith discount to status labels and deductions", () => {
    const rifle = { id: "rifle", unlockWave: 1, cost: 420 };
    const save = makeSave({
      coins: 380,
      pistolUnlocked: true,
      unlockedWeapons: ["pipe", "rifle"],
    });
    const weaponState = getWeaponShopState({
      weapon: rifle,
      waveNumber: 3,
      save,
      costMultiplier: 0.9,
    });
    expect(weaponState.status).toBe("378 coins");
    expect(weaponState.disabled).toBe(false);

    const weaponResult = applyWeaponBuyOrEquip({
      weapon: rifle,
      waveNumber: 3,
      save,
      costMultiplier: 0.9,
    });
    expect(weaponResult).toEqual({ changed: true, action: "buy" });
    expect(save.coins).toBe(2);

    const packSave = makeSave({ coins: 100, grenades: 0 });
    const packResult = applyGrenadePackBuy({
      pack: { amount: 2, cost: 95 },
      save: packSave,
      costMultiplier: 0.9,
    });
    expect(packResult.changed).toBe(true);
    expect(packSave.coins).toBe(15);
    expect(packSave.grenades).toBe(2);
  });

  it("buys village upgrades and raises persistent level", () => {
    const save = makeSave({ coins: 500, villageLevel: 1 });
    const economy = {
      villageUpgrade: {
        label: "Town Defenses",
        maxLevel: 4,
        hpPerLevel: 0.1,
        baseCost: 100,
        costGrowth: 2,
      },
    };

    const initial = getVillageUpgradeState({ save, economy });
    expect(initial.level).toBe(1);
    expect(initial.status).toBe("100 coins");
    expect(initial.hpBonusPercent).toBe(0);
    expect(initial.nextHpBonusPercent).toBe(10);

    const bought = applyVillageUpgradePurchase({ save, economy });
    expect(bought).toEqual({ changed: true });
    expect(save.coins).toBe(400);
    expect(save.villageLevel).toBe(2);

    const multiplier = getVillageLevelHpMultiplier({ save, economy });
    expect(multiplier).toBeCloseTo(1.1, 6);
  });

  it("blocks village upgrades at max level", () => {
    const save = makeSave({ coins: 9999, villageLevel: 4 });
    const economy = {
      villageUpgrade: {
        maxLevel: 4,
        hpPerLevel: 0.08,
        baseCost: 120,
        costGrowth: 1.6,
      },
    };

    const state = getVillageUpgradeState({ save, economy });
    expect(state.atMax).toBe(true);
    expect(state.status).toBe("Maxed");

    const result = applyVillageUpgradePurchase({ save, economy });
    expect(result).toEqual({ changed: false });
    expect(save.villageLevel).toBe(4);
    expect(save.coins).toBe(9999);
  });
});
