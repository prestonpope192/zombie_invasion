import { escapeHtml } from "../systems/safeHtml";
import { getNextWaveThreatBrief } from "../systems/firstSessionRules";

export class SummaryScene3D {
  constructor(game) {
    this.game = game;
    this.root = null;
    this.nextButton = null;
    this.onKeyDown = null;
  }

  enter(summary) {
    const safeSummary = summary && typeof summary === "object" ? summary : {};
    const wave = Math.max(1, Number.parseInt(safeSummary.wave, 10) || 1);
    const kills = Math.max(0, Number.parseInt(safeSummary.kills, 10) || 0);
    const coins = Math.max(0, Number.parseInt(safeSummary.coins, 10) || 0);
    const villageHp = Math.max(0, Math.round(Number(safeSummary.villageHp) || 0));
    const nextThreat = getNextWaveThreatBrief({
      clearedWave: wave,
      waveDefs: this.game.waveDefs,
      enemyMap: this.game.enemyMap,
    });
    this.summary = { ...safeSummary, wave, kills, coins, villageHp, nextThreat };
    const threatHtml = nextThreat
      ? `
        <div class="fps-summary-callout">
          <strong>Next Wave: ${escapeHtml(nextThreat.label)}</strong>
          <span>${escapeHtml(nextThreat.message)}</span>
        </div>
      `
      : "";
    this.root = document.createElement("div");
    this.root.className = "fps-overlay summary";
    this.root.innerHTML = `
      <div class="fps-panel summary">
        <h2>Wave ${escapeHtml(wave)} Cleared</h2>
        <p>Kills: ${escapeHtml(kills)}</p>
        <p>Coins earned: ${escapeHtml(coins)}</p>
        <p>Village HP: ${escapeHtml(villageHp)}</p>
        ${threatHtml}
        <p class="fps-summary-shop-nudge">Open Shop first if you can afford a weapon, gear, or healing. Continue only when your loadout is ready.</p>
        <p>Click Next Wave, press Space, or press Enter to keep the run moving.</p>
        <div class="fps-shop-actions">
          <button type="button" data-action="next">Next Wave</button>
          <button type="button" data-action="shop">Open Shop</button>
        </div>
      </div>
    `;
    this.nextButton = this.root.querySelector('[data-action="next"]');

    if (document.pointerLockElement && typeof document.exitPointerLock === "function") {
      try {
        document.exitPointerLock();
      } catch {
        // Ignore environments where pointer lock is unavailable or already closing.
      }
    }

    this.root.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) {
        return;
      }
      this.game.audio?.unlockAudio?.();
      const action = button.dataset.action;
      if (action === "next") {
        this.game.resumeAfterIntermission();
      }
      if (action === "shop") {
        this.game.openShop();
      }
    });
    this.onKeyDown = (event) => {
      if (event.defaultPrevented) {
        return;
      }
      if (event.code === "Space" || event.code === "Enter" || event.code === "NumpadEnter") {
        event.preventDefault();
        this.game.audio?.unlockAudio?.();
        this.game.resumeAfterIntermission();
      }
    };

    document.body.appendChild(this.root);
    window.addEventListener("keydown", this.onKeyDown);
    requestAnimationFrame(() => {
      if (!this.root) {
        return;
      }
      this.root.classList.add("is-visible");
      this.nextButton?.focus();
    });
  }

  exit() {
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
    if (this.onKeyDown) {
      window.removeEventListener("keydown", this.onKeyDown);
      this.onKeyDown = null;
    }
    this.nextButton = null;
  }

  renderGameToText() {
    return JSON.stringify({ mode: "summary", summary: this.summary });
  }

  advanceSimulation() {}
}
