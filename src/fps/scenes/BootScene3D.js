export class BootScene3D {
  constructor(game) {
    this.game = game;
  }

  async enter() {
    await this.game.physics.init();
    this.game.audio.startMusic("menu");
    this.game.setMode("menu");
  }
}
