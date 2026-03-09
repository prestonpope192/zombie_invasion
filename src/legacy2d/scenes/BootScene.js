import Phaser from "phaser";
import weapons from "../config/weapons.json";
import enemies from "../config/enemies.json";
import raids from "../config/raids.json";
import { GameSession } from "../systems/GameSession";

function makeRectTexture(scene, key, width, height, color) {
  const gfx = scene.make.graphics({ x: 0, y: 0, add: false });
  gfx.fillStyle(color, 1);
  gfx.fillRoundedRect(0, 0, width, height, 6);
  gfx.generateTexture(key, width, height);
  gfx.destroy();
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create() {
    makeRectTexture(this, "player", 34, 54, 0x45d07f);
    makeRectTexture(this, "zombie", 30, 48, 0x8fcf5f);
    makeRectTexture(this, "superZombie", 56, 86, 0xb0dc6a);
    makeRectTexture(this, "bossZombie", 90, 130, 0xdb6b6b);
    makeRectTexture(this, "projectile", 14, 14, 0xffca57);

    this.game.session = new GameSession({ weapons, enemies, raids });
    this.scene.start("TitleScene");
  }
}
