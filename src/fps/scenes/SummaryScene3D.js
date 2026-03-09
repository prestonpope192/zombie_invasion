import { escapeHtml } from "../systems/safeHtml";

export class SummaryScene3D {
  constructor(game) {
    this.game = game;
    this.root = null;
  }

  enter(summary) {
    const safeSummary = summary && typeof summary === "object" ? summary : {};
    const wave = Math.max(1, Number.parseInt(safeSummary.wave, 10) || 1);
    const kills = Math.max(0, Number.parseInt(safeSummary.kills, 10) || 0);
    const coins = Math.max(0, Number.parseInt(safeSummary.coins, 10) || 0);
    const villageHp = Math.max(0, Math.round(Number(safeSummary.villageHp) || 0));
    this.summary = { ...safeSummary, wave, kills, coins, villageHp };
    this.root = document.createElement("div");
    this.root.className = "fps-overlay summary";
    this.root.innerHTML = `
      <div class="fps-panel summary">
        <h2>Wave ${escapeHtml(wave)} Cleared</h2>
        <p>Kills: ${escapeHtml(kills)}</p>
        <p>Coins earned: ${escapeHtml(coins)}</p>
        <p>Village HP: ${escapeHtml(villageHp)}</p>
        <div class="fps-shop-actions">
          <button data-action="next">Next Wave</button>
          <button data-action="shop">Open Shop</button>
        </div>
      </div>
    `;

    this.root.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) {
        return;
      }
      const action = button.dataset.action;
      if (action === "next") {
        this.game.resumeAfterIntermission();
      }
      if (action === "shop") {
        this.game.openShop();
      }
    });

    document.body.appendChild(this.root);
    requestAnimationFrame(() => {
      if (!this.root) {
        return;
      }
      this.root.classList.add("is-visible");
    });
  }

  exit() {
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
  }

  renderGameToText() {
    return JSON.stringify({ mode: "summary", summary: this.summary });
  }

  advanceSimulation() {}
}
