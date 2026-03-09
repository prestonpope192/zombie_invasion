import Phaser from "phaser";

export class PauseOverlay extends Phaser.Scene {
  constructor() {
    super("PauseOverlay");
    this.cursor = 0;
  }

  init(data) {
    this.parentSceneKey = data.parentSceneKey;
  }

  create() {
    this.add.rectangle(480, 320, 960, 640, 0x000000, 0.65);
    this.add.text(480, 150, "Paused", { fontSize: "56px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5);

    this.options = ["Resume", "Settings", "Quit to Title"];
    this.optionTexts = this.options.map((option, index) =>
      this.add.text(480, 270 + index * 70, option, { fontSize: "34px", color: "#dce5f8" }).setOrigin(0.5),
    );

    this.help = this.add
      .text(480, 560, "Up/Down + Enter. Esc resumes.", { fontSize: "20px", color: "#dce5f8" })
      .setOrigin(0.5);

    this.keys = this.input.keyboard.addKeys({ up: "UP", down: "DOWN", enter: "ENTER", esc: "ESC" });
    this.refresh();
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.keys.up)) {
      this.cursor = (this.cursor - 1 + this.options.length) % this.options.length;
      this.refresh();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.down)) {
      this.cursor = (this.cursor + 1) % this.options.length;
      this.refresh();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.enter)) {
      this.select();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.esc)) {
      this.resumeGame();
    }
  }

  refresh() {
    this.optionTexts.forEach((text, idx) => {
      text.setColor(idx === this.cursor ? "#ffcf74" : "#dce5f8");
    });
  }

  select() {
    const option = this.options[this.cursor];
    if (option === "Resume") {
      this.resumeGame();
      return;
    }
    if (option === "Settings") {
      this.help.setText("Settings are minimal in v1. Press Esc to resume.");
      return;
    }
    this.scene.stop(this.parentSceneKey);
    this.scene.start("TitleScene");
  }

  resumeGame() {
    this.scene.stop();
    this.scene.resume(this.parentSceneKey);
  }
}
