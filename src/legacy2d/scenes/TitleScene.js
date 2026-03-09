import Phaser from "phaser";
import { getMobileControls } from "../systems/mobileControls";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("TitleScene");
  }

  create() {
    this.mobile = getMobileControls();
    this.mobile.hide();
    this.input.keyboard.on("keydown-F", () => this.toggleFullscreen());

    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x111423, 0.85);
    this.add.text(width / 2, 72, "Zombie Invasion", {
      fontSize: "56px",
      fontStyle: "bold",
      color: "#ff9f43",
      stroke: "#1a1105",
      strokeThickness: 6,
    }).setOrigin(0.5);

    this.add
      .text(
        width / 2,
        160,
        "Silly but dark side-scrolling zombie defense\nClear Raid 50 while protecting your village",
        { align: "center", fontSize: "24px", color: "#f3f4f7" },
      )
      .setOrigin(0.5);

    this.add
      .text(
        width / 2,
        260,
        "Desktop: A/D Move, Space Jump, Mouse/J Fire, K Alt, Q Swap, E Interact, Esc Pause\nMobile: Left stick + action buttons",
        { align: "center", fontSize: "18px", color: "#d8dbe6" },
      )
      .setOrigin(0.5);

    const startBtn = this.makeButton(width / 2, 390, "Start / Continue", () => {
      this.scene.start("HubScene");
    });

    const resetBtn = this.makeButton(width / 2, 460, "Reset Save", () => {
      this.game.session.resetProgress();
      this.scene.restart();
    });

    const prompt = this.add.text(width / 2, 530, "Press Enter to start", {
      fontSize: "20px",
      color: "#ffffff",
    }).setOrigin(0.5);

    this.tweens.add({ targets: prompt, alpha: 0.4, duration: 550, yoyo: true, repeat: -1 });

    this.input.keyboard.once("keydown-ENTER", () => this.scene.start("HubScene"));
    startBtn.setInteractive();
    resetBtn.setInteractive();
  }

  makeButton(x, y, label, onClick) {
    const container = this.add.container(x, y);
    const bg = this.add
      .rectangle(0, 0, 280, 52, 0x25334c)
      .setStrokeStyle(2, 0xff9f43)
      .setInteractive({ useHandCursor: true });
    const text = this.add.text(0, 0, label, { fontSize: "24px", color: "#fff" }).setOrigin(0.5);
    container.add([bg, text]);

    bg.on("pointerdown", onClick);
    bg.on("pointerover", () => bg.setFillStyle(0x2f4263));
    bg.on("pointerout", () => bg.setFillStyle(0x25334c));
    return bg;
  }

  renderGameToText() {
    return JSON.stringify({
      coordinateSystem: "origin top-left, +x right, +y down",
      mode: "title",
      actions: ["start", "reset"],
    });
  }

  advanceSimulation() {}

  toggleFullscreen() {
    if (this.scale.isFullscreen) {
      this.scale.stopFullscreen();
      return;
    }
    this.scale.startFullscreen();
  }
}
