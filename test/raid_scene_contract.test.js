import { describe, expect, it, vi } from "vitest";
import weapons from "../src/fps/config/weapons_fps.json";
import economy from "../src/fps/config/economy_fps.json";
import { RaidScene3D } from "../src/fps/scenes/RaidScene3D";
import { getGrenadeTypeDefs } from "../src/fps/systems/grenadeLoadout";
import { defaultFpsSave } from "../src/fps/systems/saveFps";

function createRaidContext(saveOverrides = {}) {
  const grenadeTypes = getGrenadeTypeDefs();
  return Object.assign(Object.create(RaidScene3D.prototype), {
    phase: "defense",
    currentWeaponId: "pipe",
    weaponAmmo: new Map(),
    tutorialProgress: {
      moved: false,
      attacked: false,
      threwGrenade: false,
      openedShop: false,
    },
    villagerPerkModifiers: {
      damageReductionBonus: 0,
      startingGrenadesBonus: 0,
      killCoinMultiplier: 1,
      grenadeCooldownMultiplier: 1,
    },
    game: {
      weapons,
      weaponMap: new Map(weapons.map((weapon) => [weapon.id, weapon])),
      economy,
      grenadeTypeMap: new Map(grenadeTypes.map((grenade) => [grenade.id, grenade])),
      save: {
        ...defaultFpsSave(),
        pistolUnlocked: true,
        unlockedWeapons: ["pipe", "pistol", "smg"],
        ownedWeapons: ["pipe", "pistol"],
        equippedWeaponId: "pipe",
        ...saveOverrides,
      },
      setMode: vi.fn(),
    },
    playerController: {
      keyState: new Map([
        ["keyq", true],
        ["escape", true],
      ]),
    },
    waveDirector: { waveNumber: 3 },
    pause: vi.fn(function pause() {
      this.paused = true;
    }),
    refreshViewWeaponModel: vi.fn(),
    setPrompt: vi.fn(function setPrompt(text) {
      this.pendingPrompt = text;
    }),
  });
}

describe("RaidScene3D gameplay contract methods", () => {
  it("routes Q/Escape shop pause only when the current raid phase allows shopping", () => {
    const context = createRaidContext();

    RaidScene3D.prototype.openShopFromRaid.call(context);

    expect(context.pause).toHaveBeenCalledTimes(1);
    expect(context.game.setMode).toHaveBeenCalledWith("shop", { waveNumber: 4 });
    expect(context.playerController.keyState.get("keyq")).toBe(false);
    expect(context.playerController.keyState.get("escape")).toBe(false);

    const introContext = createRaidContext();
    introContext.phase = "house_intro";
    RaidScene3D.prototype.openShopFromRaid.call(introContext);
    expect(introContext.game.setMode).not.toHaveBeenCalled();
    expect(introContext.setPrompt).toHaveBeenCalledWith("Leave the safe house before shopping.");

    const bossContext = createRaidContext();
    bossContext.phase = "secret_boss";
    RaidScene3D.prototype.openShopFromRaid.call(bossContext);
    expect(bossContext.game.setMode).not.toHaveBeenCalled();
    expect(bossContext.setPrompt).toHaveBeenCalledWith("Shop disabled during secret boss.");
  });

  it("cycles only stocked grenade types and warns when inventory is empty", () => {
    const context = createRaidContext({
      grenadeInventory: { frag: 0, breacher: 2, nova: 1 },
      activeGrenadeId: "frag",
      grenades: 0,
    });

    expect(RaidScene3D.prototype.cycleGrenadeType.call(context)).toBe(true);
    expect(context.game.save.activeGrenadeId).toBe("breacher");
    expect(context.pendingPrompt).toContain("Breach grenade readied");

    const emptyContext = createRaidContext({
      grenadeInventory: { frag: 0, breacher: 0, nova: 0 },
      activeGrenadeId: "frag",
      grenades: 0,
    });
    expect(RaidScene3D.prototype.cycleGrenadeType.call(emptyContext)).toBe(false);
    expect(emptyContext.setPrompt).toHaveBeenCalledWith("No grenades stocked. Buy more in the shop.");
  });

  it("keeps equipped weapons owned/unlocked and falls back to the pipe for stale saves", () => {
    const context = createRaidContext({
      ownedWeapons: ["pipe", "smg"],
      unlockedWeapons: ["pipe", "smg"],
      equippedWeaponId: "smg",
    });

    RaidScene3D.prototype.ensureActiveWeapon.call(context, { forceFromSave: true });

    expect(context.currentWeaponId).toBe("smg");
    expect(context.weaponAmmo.get("smg").mag).toBe(32);
    expect(context.refreshViewWeaponModel).toHaveBeenCalledTimes(1);

    const staleContext = createRaidContext({
      ownedWeapons: ["pipe"],
      unlockedWeapons: ["pipe"],
      equippedWeaponId: "rpg",
    });

    RaidScene3D.prototype.ensureActiveWeapon.call(staleContext, { forceFromSave: true });
    expect(staleContext.currentWeaponId).toBe("pipe");
    expect(staleContext.game.save.equippedWeaponId).toBe("pipe");
  });

  it("combines armor and rescued-villager damage resistance but caps it", () => {
    const context = createRaidContext({
      equippedArmorId: "juggernaut",
      ownedArmors: ["cloth", "juggernaut"],
    });
    context.villagerPerkModifiers.damageReductionBonus = 0.2;

    const reduction = RaidScene3D.prototype.getArmorDamageReduction.call(context);

    expect(reduction).toBe(0.65);
  });

  it("marks village destruction as a survival-state transition with a player-facing prompt", () => {
    const context = createRaidContext();
    context.villageDestroyed = false;
    context.villageHp = 24;
    context.showVillageDestroyedPopup = vi.fn();

    RaidScene3D.prototype.markVillageDestroyed.call(context);

    expect(context.villageDestroyed).toBe(true);
    expect(context.villageHp).toBe(0);
    expect(context.setPrompt).toHaveBeenCalledWith(
      "Village destroyed. No safe zone remains. Survive until you die.",
      4,
    );
    expect(context.showVillageDestroyedPopup).toHaveBeenCalledTimes(1);
  });
});
