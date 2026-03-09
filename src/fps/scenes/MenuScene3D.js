import { persistFpsSave } from "../systems/saveFps";

export class MenuScene3D {
  constructor(game) {
    this.game = game;
    this.root = null;
  }

  enter() {
    this.root = document.createElement("div");
    this.root.className = "fps-overlay menu";
    this.root.innerHTML = `
      <div class="fps-panel menu">
        <h1>Zombie Invasion: FPS</h1>
        <p class="fps-menu-tagline">Start inside your house with a pipe and 5 grenades. Clear Wave 1 to unlock the pistol, then survive through the secret boss.</p>
        <div class="fps-menu-actions">
          <button data-action="start">Start Mission</button>
          <button data-action="reset">Reset FPS Save</button>
        </div>
        <details class="fps-menu-help">
          <summary><span>Controls & How To Play</span></summary>
          <p>Desktop: Click to lock mouse, WASD move, I/K look up/down, J/L look left/right, Shift sprint, Space jump (one extra jump while airborne), Ctrl crouch, Click/F attack, G grenade, E interact, Q shop, O cycle weapon, 1 pistol, 2 smg, 3 rifle, 4 shotgun, 5 dmr, 6 rpg, 7 pipe, Esc unlock mouse-look.</p>
          <p>Mobile: Dual-stick controls with on-screen FIRE, GRENADE, MAP, JUMP, CROUCH, and USE buttons. Use top-right SWAP and SHOP.</p>
        </details>
      </div>
    `;

    this.root.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) {
        return;
      }
      const action = button.dataset.action;
      if (action === "start") {
        this.game.startRaidRun();
      }
      if (action === "reset") {
        this.game.save = this.game.defaultSaveFactory();
        persistFpsSave(this.game.save);
        this.game.reloadSave();
        this.game.startRaidRun();
      }
    });

    document.body.appendChild(this.root);
    this.game.mobileControls.hide();
  }

  exit() {
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
  }

  renderGameToText() {
    return JSON.stringify({
      coordinateSystem: "Three.js world meters; +x east, +y up, +z south",
      mode: "menu",
      coins: this.game.save.coins,
      bestWave: this.game.save.bestWave,
      equippedWeapon: this.game.save.equippedWeaponId,
    });
  }

  advanceSimulation() {}
}
