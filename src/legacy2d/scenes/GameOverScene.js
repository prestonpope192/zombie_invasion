import Phaser from "phaser";

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super("GameOverScene");
  }

  init(data) {
    this.reason = data.reason ?? "Village Lost";
  }

  create() {
    this.add.rectangle(480, 320, 960, 640, 0x090909, 0.95);
    this.add.text(480, 190, "Game Over", {
      fontSize: "70px",
      color: "#ff6868",
      fontStyle: "bold",
      stroke: "#1f0000",
      strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(480, 290, this.reason, { fontSize: "32px", color: "#ffe8e8" }).setOrigin(0.5);
    this.add
      .text(480, 390, "Press Enter to return to village", { fontSize: "26px", color: "#f5f7ff" })
      .setOrigin(0.5);

    this.input.keyboard.once("keydown-ENTER", () => {
      this.game.session.resetRunState();
      this.scene.start("HubScene");
    });
  }

  renderGameToText() {
    return JSON.stringify({ mode: "game_over", reason: this.reason });
  }

  advanceSimulation() {}
}
