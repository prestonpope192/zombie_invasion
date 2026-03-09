import { escapeHtml } from "../systems/safeHtml";

export class GameOverScene3D {
  constructor(game) {
    this.game = game;
    this.root = null;
  }

  enter(payload) {
    const safePayload = payload && typeof payload === "object" ? payload : {};
    const victory = Boolean(safePayload.victory);
    const reason = typeof safePayload.reason === "string" ? safePayload.reason : "Mission ended.";
    const bestWave = Math.max(0, Number.parseInt(this.game.save.bestWave, 10) || 0);
    this.payload = { ...safePayload, victory, reason };
    this.root = document.createElement("div");
    this.root.className = "fps-overlay gameover";
    this.root.innerHTML = `
      <div class="fps-panel gameover">
        <h2>${victory ? "Mission Complete" : "Mission Failed"}</h2>
        <p>${escapeHtml(reason)}</p>
        <p>Best Wave: ${escapeHtml(bestWave)}</p>
        <div class="fps-shop-actions">
          <button data-action="retry">Retry</button>
          <button data-action="menu">Back to Menu</button>
        </div>
      </div>
    `;
    this.root.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) {
        return;
      }
      const action = button.dataset.action;
      if (action === "retry") {
        this.game.startRaidRun();
      }
      if (action === "menu") {
        this.game.setMode("menu");
      }
    });
    document.body.appendChild(this.root);
  }

  exit() {
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
  }

  renderGameToText() {
    return JSON.stringify({ mode: "game_over", payload: this.payload });
  }

  advanceSimulation() {}
}
