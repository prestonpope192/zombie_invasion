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

describe("active PlayCanvas game contract", () => {
  it("mounts the PlayCanvas runtime by default and keeps the FPS runtime behind the legacy query flag", () => {
    const main = fs.readFileSync(path.join(repoRoot, "src/main.js"), "utf8");

    expect(main).toContain("./playcanvas/main");
    expect(main).toContain("createPlayCanvasGame(root)");
    expect(main).toContain('params.get("legacy") === "1"');
    expect(main).toContain("./fps/app/FpsGame");
    expect(main).not.toContain("legacy2d");
    expect(fs.existsSync(path.join(repoRoot, "src/legacy2d/game/Game.js"))).toBe(true);
  });

  it("keeps Space wired to PlayCanvas flow advance and jump instead of stale fire guidance", () => {
    const main = fs.readFileSync(path.join(repoRoot, "src/playcanvas/main.js"), "utf8");
    const simulation = fs.readFileSync(path.join(repoRoot, "src/playcanvas/sliceSimulation.js"), "utf8");

    expect(main).toContain('event.code === "Enter" || event.code === "NumpadEnter" || event.code === "Space"');
    expect(main).toContain('if (event.code === "Space")');
    expect(main).toContain("this.input.jump = active");
    expect(simulation).toContain("jump with Space");
    expect(simulation).toContain("fire with click or E");
    expect(simulation).not.toContain("fire with click or Space");
  });

  it("tracks held PlayCanvas fire input instead of only firing once per click", () => {
    const main = fs.readFileSync(path.join(repoRoot, "src/playcanvas/main.js"), "utf8");

    expect(main).toContain("fire: false");
    expect(main).toContain("this.input.fire = true");
    expect(main).toContain("this.input.fire = false");
    expect(main).toContain("this.input.fire = active");
    expect(main).toContain('this.input.fire && getPlayCanvasWeaponSnapshot(this.state).fireMode === "automatic"');
  });

  it("keeps every legacy FPS overlay scene wired into FpsGame", () => {
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
