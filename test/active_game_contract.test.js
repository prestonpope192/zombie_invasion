import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import weapons from "../src/fps/config/weapons_fps.json";
import enemies from "../src/fps/config/enemies_fps.json";
import economy from "../src/fps/config/economy_fps.json";
import buildings from "../src/fps/config/buildings_fps.json";
import { GRENADE_TYPE_DEFS } from "../src/fps/systems/grenadeLoadout";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("active FPS game contract", () => {
  it("mounts the FPS runtime rather than the preserved legacy 2D runtime", () => {
    const main = fs.readFileSync(path.join(repoRoot, "src/main.js"), "utf8");

    expect(main).toContain("./fps/app/FpsGame");
    expect(main).toContain("createFpsGame(root)");
    expect(main).not.toContain("legacy2d");
    expect(fs.existsSync(path.join(repoRoot, "src/legacy2d/game/Game.js"))).toBe(true);
  });

  it("keeps every active overlay scene wired into FpsGame", () => {
    const source = fs.readFileSync(path.join(repoRoot, "src/fps/app/FpsGame.js"), "utf8");

    for (const scene of [
      "BootScene3D",
      "MenuScene3D",
      "RaidScene3D",
      "ShopScene3D",
      "SummaryScene3D",
      "GameOverScene3D",
    ]) {
      expect(source).toContain(scene);
    }

    for (const mode of ["menu", "shop", "summary", "game_over"]) {
      expect(source).toContain(`mode === "${mode}"`);
    }
  });

  it("defines a complete gameplay inventory across weapons, enemies, grenades, buildings, gear, armor, and village upgrades", () => {
    expect(weapons.map((weapon) => weapon.id)).toEqual([
      "pipe",
      "pistol",
      "revolver",
      "smg",
      "machine_pistol",
      "rifle",
      "battle_rifle",
      "shotgun",
      "lmg",
      "dmr",
      "sniper",
      "rpg",
      "grenade_launcher",
      "flamethrower",
    ]);
    expect(enemies.map((enemy) => enemy.id)).toContain("mega_zombie");
    expect(enemies.map((enemy) => enemy.id)).toContain("mini_boss");
    expect(GRENADE_TYPE_DEFS.map((grenade) => grenade.id)).toEqual(["frag", "breacher", "nova"]);
    expect(buildings).toHaveLength(6);
    expect(buildings.every((building) => building.interior?.villagerSpots?.length === 1)).toBe(true);
    expect(economy.gearItems.map((gear) => gear.id)).toEqual(["flashlight", "flint_steel"]);
    expect(economy.armorUpgrades).toHaveLength(8);
    expect(economy.villageUpgrade.maxLevel).toBe(8);
  });
});
