import Phaser from "phaser";
import { setupKeys, buildInputSnapshot } from "../systems/inputSystem";
import { getMobileControls } from "../systems/mobileControls";
import { AudioSystem } from "../systems/audioSystem";

export class HubScene extends Phaser.Scene {
  constructor() {
    super("HubScene");
    this.worldWidth = 1700;
    this.worldHeight = 640;
    this.groundY = 540;
  }

  create() {
    this.mobile = getMobileControls();
    this.mobile.show();
    this.audioSystem = new AudioSystem(this);
    this.audioSystem.startMusic("hub");

    this.keys = setupKeys(this);
    this.pointer = this.input.activePointer;
    this.session = this.game.session;
    this.session.resetRunState();

    this.physicsData = {
      moveSpeed: 230,
      jumpVelocity: -460,
      gravity: 1300,
      crouchFactor: 0.55,
      coyoteTime: 0.1,
      jumpBuffer: 0.12,
    };

    this.player = {
      x: 200,
      y: this.groundY,
      vx: 0,
      vy: 0,
      w: 34,
      h: 54,
      onGround: true,
      facing: 1,
      coyoteTimer: 0,
      jumpBufferTimer: 0,
      crouching: false,
    };

    this.background = this.add.rectangle(0, 0, this.worldWidth, this.worldHeight, 0x0d1220).setOrigin(0, 0);
    this.backgroundFar = this.add.rectangle(0, 0, this.worldWidth, 230, 0x161d2f).setOrigin(0, 0);
    this.ground = this.add.rectangle(0, this.groundY + 20, this.worldWidth, 200, 0x2a2d34).setOrigin(0, 0);
    this.gate = this.add.rectangle(1430, this.groundY - 40, 120, 120, 0x3f5b7d).setOrigin(0.5, 1);
    this.shop = this.add.rectangle(430, this.groundY - 10, 120, 90, 0x835f2f).setOrigin(0.5, 1);
    this.saveAltar = this.add.rectangle(700, this.groundY - 10, 60, 90, 0x2f8f93).setOrigin(0.5, 1);
    this.village = this.add.rectangle(70, this.groundY - 45, 140, 110, 0x5a4033).setOrigin(0.5, 1);

    this.playerSprite = this.add.sprite(this.player.x, this.player.y, "player").setOrigin(0.5, 1);

    this.labels = {
      raid: this.add.text(20, 16, "", { fontSize: "22px", color: "#ffffff" }).setScrollFactor(0),
      coins: this.add.text(20, 44, "", { fontSize: "22px", color: "#ffd166" }).setScrollFactor(0),
      weapon: this.add.text(20, 72, "", { fontSize: "20px", color: "#d4d8e8" }).setScrollFactor(0),
      hint: this.add.text(20, 606, "", { fontSize: "20px", color: "#ffefb4" }).setScrollFactor(0).setOrigin(0, 1),
    };

    this.tips = this.add
      .text(960, 18, "Village Hub: Shop, Save, and Start Raid", { fontSize: "20px", color: "#d6f1ff" })
      .setScrollFactor(0)
      .setOrigin(1, 0);

    this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);
    this.cameras.main.startFollow(this.playerSprite, false, 0.09, 0.09);

    if (this.session.pendingOpenShop) {
      this.session.pendingOpenShop = false;
      this.openShop();
    }

    this.events.on("shutdown", () => this.audioSystem.stopMusic());
  }

  update(_time, deltaMs) {
    this.simulate(deltaMs / 1000);
  }

  simulate(dt) {
    const input = buildInputSnapshot({ keys: this.keys, mobile: this.mobile, pointer: this.pointer, scene: this });
    if (input.fullscreenPressed) {
      this.toggleFullscreen();
    }

    if (input.swapPressed) {
      this.session.cycleWeapon(1);
    }

    if (input.left) {
      this.player.vx = -this.physicsData.moveSpeed;
      this.player.facing = -1;
    } else if (input.right) {
      this.player.vx = this.physicsData.moveSpeed;
      this.player.facing = 1;
    } else {
      this.player.vx = 0;
    }

    this.player.crouching = this.player.onGround && input.crouch;
    if (this.player.crouching) {
      this.player.vx *= this.physicsData.crouchFactor;
    }

    if (input.jump) {
      this.player.jumpBufferTimer = this.physicsData.jumpBuffer;
    } else {
      this.player.jumpBufferTimer = Math.max(0, this.player.jumpBufferTimer - dt);
    }

    if (this.player.onGround) {
      this.player.coyoteTimer = this.physicsData.coyoteTime;
    } else {
      this.player.coyoteTimer = Math.max(0, this.player.coyoteTimer - dt);
    }

    if (this.player.jumpBufferTimer > 0 && this.player.coyoteTimer > 0 && !this.player.crouching) {
      this.player.vy = this.physicsData.jumpVelocity;
      this.player.onGround = false;
      this.player.jumpBufferTimer = 0;
      this.player.coyoteTimer = 0;
    }

    this.player.vy += this.physicsData.gravity * dt;
    this.player.x += this.player.vx * dt;
    this.player.y += this.player.vy * dt;

    const ground = this.groundY;
    if (this.player.y >= ground) {
      this.player.y = ground;
      this.player.vy = 0;
      this.player.onGround = true;
    } else {
      this.player.onGround = false;
    }

    this.player.x = Phaser.Math.Clamp(this.player.x, 40, this.worldWidth - 40);
    this.playerSprite.setPosition(this.player.x, this.player.y);
    this.playerSprite.setFlipX(this.player.facing < 0);
    this.playerSprite.setScale(1, this.player.crouching ? 0.65 : 1);

    const prompt = this.getInteractionHint();
    this.labels.hint.setText(prompt || "Walk to gate to start raid. E/USE to interact.");
    this.labels.raid.setText(`Raid ${this.session.save.currentRaid} / 50`);
    this.labels.coins.setText(`Coins: ${this.session.save.coins}`);
    this.labels.weapon.setText(`Weapon: ${this.session.getEquippedWeapon().label}`);

    if (input.interactPressed) {
      this.handleInteract();
    }
  }

  getNearZone() {
    const x = this.player.x;
    if (Math.abs(x - this.shop.x) < 90) {
      return "shop";
    }
    if (Math.abs(x - this.saveAltar.x) < 80) {
      return "save";
    }
    if (Math.abs(x - this.gate.x) < 90) {
      return "gate";
    }
    return null;
  }

  getInteractionHint() {
    const zone = this.getNearZone();
    if (zone === "shop") {
      return "E / USE: Open Shop";
    }
    if (zone === "save") {
      return "E / USE: Manual Save";
    }
    if (zone === "gate") {
      return "E / USE: Start Raid";
    }
    return "";
  }

  handleInteract() {
    const zone = this.getNearZone();
    if (zone === "shop") {
      this.openShop();
      return;
    }
    if (zone === "save") {
      this.session.manualSave();
      this.flashNotice("Game saved.");
      return;
    }
    if (zone === "gate") {
      this.scene.start("RaidScene");
    }
  }

  openShop() {
    this.scene.launch("ShopScene", { from: "HubScene" });
    this.scene.pause();
  }

  flashNotice(text) {
    const message = this.add
      .text(this.cameras.main.scrollX + this.scale.width / 2, 110, text, {
        fontSize: "24px",
        color: "#b4ffce",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.tweens.add({
      targets: message,
      y: message.y - 20,
      alpha: 0,
      duration: 900,
      onComplete: () => message.destroy(),
    });
  }

  renderGameToText() {
    return JSON.stringify({
      coordinateSystem: "origin top-left, +x right, +y down",
      mode: "hub",
      raid: this.session.save.currentRaid,
      player: {
        x: Math.round(this.player.x),
        y: Math.round(this.player.y),
        vx: Math.round(this.player.vx),
        vy: Math.round(this.player.vy),
      },
      coins: this.session.save.coins,
      weapon: this.session.getEquippedWeapon().id,
      zones: {
        shopX: this.shop.x,
        saveX: this.saveAltar.x,
        gateX: this.gate.x,
      },
      hint: this.labels.hint.text,
    });
  }

  advanceSimulation(ms) {
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let i = 0; i < steps; i += 1) {
      this.simulate(1 / 60);
    }
  }

  toggleFullscreen() {
    if (this.scale.isFullscreen) {
      this.scale.stopFullscreen();
      return;
    }
    this.scale.startFullscreen();
  }
}
