import { persistFpsSave } from "../systems/saveFps";

export class MenuScene3D {
  constructor(game) {
    this.game = game;
    this.root = null;
  }

  enter() {
    const bestWave = Math.max(0, Number.parseInt(this.game.save.bestWave, 10) || 0);
    const coins = Math.max(0, Number.parseInt(this.game.save.coins, 10) || 0);
    const ownedWeapons = Array.isArray(this.game.save.ownedWeapons) ? this.game.save.ownedWeapons.length : 1;
    const rescuedVillagers = Array.isArray(this.game.save.rescuedVillagers) ? this.game.save.rescuedVillagers.length : 0;
    this.root = document.createElement("div");
    this.root.className = "fps-overlay menu";
    this.root.innerHTML = `
        <div class="fps-panel menu">
        <div class="fps-menu-hero">
          <div class="fps-menu-brand">
            <img class="fps-menu-logo" src="/zombie-invasion-logo.svg" alt="Zombie Invasion logo" />
            <p class="fps-menu-tagline">Start in the village with a pipe and 5 grenades, defend the lanes, unlock heavier weapons, and survive for as many waves as you can.</p>
            <div class="fps-menu-mobile-brief" aria-label="mobile mission briefing">
              <p>Start in the village with a pipe and 5 grenades.</p>
              <p>Hold the line, rescue survivors, then shop up between rounds.</p>
            </div>
            <div class="fps-menu-stats" aria-label="run stats">
              <div class="fps-menu-stat" data-stat="best-wave">
                <div class="fps-menu-stat-head">
                  <span class="fps-menu-stat-label">Best Wave</span>
                  <button class="fps-menu-stat-reset" type="button" data-action="reset" aria-label="Reset FPS save" title="Reset FPS save">↺</button>
                </div>
                <strong>${bestWave}</strong>
              </div>
              <div class="fps-menu-stat" data-stat="coins">
                <span class="fps-menu-stat-label">Coins</span>
                <strong>${coins}</strong>
              </div>
              <div class="fps-menu-stat" data-stat="weapons">
                <span class="fps-menu-stat-label">Weapons Owned</span>
                <strong>${ownedWeapons}</strong>
              </div>
              <div class="fps-menu-stat" data-stat="villagers">
                <span class="fps-menu-stat-label">Villagers Saved</span>
                <strong>${rescuedVillagers}</strong>
              </div>
            </div>
          </div>
          <aside class="fps-menu-side">
            <div class="fps-menu-actions">
              <button data-action="start">Start Mission</button>
            </div>
            <div class="fps-menu-highlights">
              <article class="fps-menu-highlight">
                <h2>Defend</h2>
                <p>Keep the village standing while the horde pours in from the tree line.</p>
              </article>
              <article class="fps-menu-highlight">
                <h2>Upgrade</h2>
                <p>Spend wave rewards on a wider arsenal, explosives, and better survivability.</p>
              </article>
              <article class="fps-menu-highlight">
                <h2>Endure</h2>
                <p>After the base campaign, the run becomes endless. Push until the night finally wins.</p>
              </article>
            </div>
          </aside>
        </div>
        <details class="fps-menu-help">
          <summary><span>Controls & How To Play</span></summary>
          <p>Desktop: Click to lock mouse, WASD move, I/K look up/down, J/L look left/right, Shift sprint, Space jump (one extra jump while airborne), Ctrl crouch, Click/F attack, G throw grenade, H cycle grenade, E interact, Q shop, O cycle weapon, 1-0 / - / = / ] direct-select expanded arsenal, \` pipe, Esc unlock mouse-look.</p>
          <p>Mobile: Portrait-first dual-stick controls with FIRE, GRENADE, ADS, MAP, JUMP, CROUCH, and USE on-screen. Open the top-right utility tray for swap, shop, and controls help.</p>
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
      version: this.game.version,
      coins: this.game.save.coins,
      bestWave: this.game.save.bestWave,
      equippedWeapon: this.game.save.equippedWeaponId,
    });
  }

  advanceSimulation() {}
}
