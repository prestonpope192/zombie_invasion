// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import weapons from "../src/fps/config/weapons_fps.json";
import economy from "../src/fps/config/economy_fps.json";
import { ShopScene3D } from "../src/fps/scenes/ShopScene3D";
import { getGrenadeTypeDefs } from "../src/fps/systems/grenadeLoadout";
import { defaultFpsSave } from "../src/fps/systems/saveFps";

function createShopGame(saveOverrides = {}) {
  const grenadeTypes = getGrenadeTypeDefs();
  const save = {
    ...defaultFpsSave(),
    coins: 1000,
    pistolUnlocked: true,
    unlockedWeapons: ["pipe", "pistol", "revolver", "smg", "shotgun"],
    ownedWeapons: ["pipe"],
    equippedWeaponId: "pipe",
    ...saveOverrides,
  };
  return {
    weapons,
    weaponMap: new Map(weapons.map((weapon) => [weapon.id, weapon])),
    economy,
    grenadeTypes,
    grenadeTypeMap: new Map(grenadeTypes.map((grenade) => [grenade.id, grenade])),
    save,
    audio: { unlockAudio: vi.fn() },
    resumeAfterIntermission: vi.fn(),
    raidScene: {
      playerController: {
        state: { hp: 47 },
      },
      syncVillagerPerkModifiers: vi.fn(),
    },
  };
}

describe("ShopScene3D UI", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.spyOn(ShopScene3D.prototype, "initAvatarPreview").mockImplementation(function initAvatarPreview() {
      this.avatarRenderer = { dispose: vi.fn(), render: vi.fn(), setPixelRatio: vi.fn(), setSize: vi.fn() };
    });
    vi.spyOn(ShopScene3D.prototype, "attachAvatarDrag").mockImplementation(() => {});
    vi.spyOn(ShopScene3D.prototype, "renderAvatarPreview").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("buys/equips weapons, gear, ordnance, armor, village upgrades, and med kits from rendered buttons", () => {
    const game = createShopGame();
    const scene = new ShopScene3D(game);
    scene.enter({ waveNumber: 5 });

    expect(document.querySelector('[data-bind="recommendation"]').textContent).toContain("Recommended");
    expect(document.querySelector(".fps-medkit-row").classList.contains("is-recommended")).toBe(true);

    document.querySelector('[data-weapon="pistol"]').click();
    expect(game.save.ownedWeapons).toContain("pistol");
    expect(game.save.equippedWeaponId).toBe("pistol");

    document.querySelector('[data-gear="flashlight"]').click();
    expect(game.save.ownedGear).toContain("flashlight");

    const fragBefore = game.save.grenadeInventory.frag;
    document.querySelector('[data-pack="grenade_pack_small"]').click();
    expect(game.save.grenadeInventory.frag).toBe(fragBefore + 2);

    document.querySelector('[data-armor="leather"]').click();
    expect(game.save.ownedArmors).toContain("leather");
    expect(game.save.equippedArmorId).toBe("leather");

    const villageLevelBefore = game.save.villageLevel;
    document.querySelector('[data-village-upgrade]').click();
    expect(game.save.villageLevel).toBe(villageLevelBefore + 1);
    expect(game.raidScene.syncVillagerPerkModifiers).toHaveBeenCalledWith({ applyVillageHealth: true });

    document.querySelector('[data-medkit]').click();
    expect(game.raidScene.playerController.state.hp).toBe(100);

    const state = JSON.parse(scene.renderGameToText());
    expect(state.mode).toBe("shop");
    expect(state.equippedWeapon).toBe("pistol");
    expect(state.equippedArmor).toBe("leather");
    expect(state.ownedGear).toContain("flashlight");
    expect(state.medKit.currentHp).toBe(100);
  });

  it("continues back into the raid through either shop exit action", () => {
    const game = createShopGame();
    const scene = new ShopScene3D(game);
    scene.enter({ waveNumber: 2 });

    document.querySelector('[data-action="continue"]').click();
    expect(game.audio.unlockAudio).toHaveBeenCalledTimes(1);
    expect(game.resumeAfterIntermission).toHaveBeenCalledTimes(1);

    document.querySelector('[data-action="close-shop"]').click();
    expect(game.resumeAfterIntermission).toHaveBeenCalledTimes(2);
  });

  it("rotates the 3D avatar yaw through buttons even when WebGL is stubbed", () => {
    const scene = new ShopScene3D(createShopGame());
    scene.enter({ waveNumber: 1 });

    document.querySelector('[data-action="avatar-left"]').click();
    expect(JSON.parse(scene.renderGameToText()).avatarYaw).toBe(-20);

    document.querySelector('[data-action="avatar-right"]').click();
    expect(JSON.parse(scene.renderGameToText()).avatarYaw).toBe(0);
  });
});
