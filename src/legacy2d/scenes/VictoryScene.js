import Phaser from "phaser";

export class VictoryScene extends Phaser.Scene {
  constructor() {
    super("VictoryScene");
  }

  init(data) {
    this.summary = data.summary ?? null;
  }

  create() {
    this.add.rectangle(480, 320, 960, 640, 0x041015, 0.95);
    this.add
      .text(480, 170, "Raid 50 Cleared!", {
        fontSize: "68px",
        color: "#9afbc3",
        fontStyle: "bold",
        stroke: "#032910",
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    this.add.text(480, 260, "The village survived the zombie invasion.", {
      fontSize: "30px",
      color: "#f4fff7",
    }).setOrigin(0.5);

    if (this.summary) {
      this.add
        .text(480, 340, `Coins Earned: ${this.summary.coinsAwarded}\nKills: ${this.summary.kills}`, {
          fontSize: "24px",
          align: "center",
          color: "#d9ffe7",
        })
        .setOrigin(0.5);
    }

    this.add.text(480, 520, "Press Enter to return to village", {
      fontSize: "26px",
      color: "#f5f7ff",
    }).setOrigin(0.5);

    this.input.keyboard.once("keydown-ENTER", () => {
      this.scene.start("HubScene");
    });
  }

  renderGameToText() {
    return JSON.stringify({ mode: "victory" });
  }

  advanceSimulation() {}
}
