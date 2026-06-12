import { escapeHtml } from "../systems/safeHtml";
import { getRunMotivation } from "../systems/firstSessionRules";
import { getGameOverRewardedOffers } from "../systems/rewardedAdOffers";

export class GameOverScene3D {
  constructor(game) {
    this.game = game;
    this.root = null;
    this.rewardStatus = "";
  }

  enter(payload) {
    const safePayload = payload && typeof payload === "object" ? payload : {};
    const victory = Boolean(safePayload.victory);
    const reason = typeof safePayload.reason === "string" ? safePayload.reason : "Mission ended.";
    const bestWave = Math.max(0, Number.parseInt(this.game.save.bestWave, 10) || 0);
    const waveReached = Math.max(0, Number.parseInt(safePayload.waveReached, 10) || bestWave);
    const kills = Math.max(0, Number.parseInt(safePayload.kills, 10) || 0);
    const coins = Math.max(0, Number.parseInt(safePayload.coins, 10) || 0);
    const nextGoal = getRunMotivation({ victory, waveReached, bestWave });
    this.payload = { ...safePayload, victory, reason, waveReached, kills, coins, nextGoal };
    this.root = document.createElement("div");
    this.root.className = "fps-overlay gameover";
    this.root.innerHTML = `
      <div class="fps-panel gameover">
        <h2>${victory ? "Mission Complete" : "Mission Failed"}</h2>
        <p>${escapeHtml(reason)}</p>
        <p>Run: Wave ${escapeHtml(waveReached)} · ${escapeHtml(kills)} kills · ${escapeHtml(coins)} coins earned</p>
        <p>Best Wave: ${escapeHtml(bestWave)}</p>
        <div class="fps-summary-callout">
          <strong>${escapeHtml(nextGoal)}</strong>
        </div>
        <div class="fps-rewarded-panel" data-bind="rewarded-panel">
          <h3>Bonus Rewards</h3>
          <div class="fps-rewarded-list" data-bind="rewarded-offers"></div>
          <p class="fps-rewarded-status" data-bind="rewarded-status"></p>
        </div>
        <div class="fps-shop-actions">
          <button data-action="retry">Retry</button>
          <button data-action="menu">Back to Menu</button>
        </div>
      </div>
    `;
    this.root.addEventListener("click", async (event) => {
      const button = event.target.closest("button");
      if (!button) {
        return;
      }
      this.game.audio?.unlockAudio?.();
      const action = button.dataset.action;
      if (action === "retry") {
        this.game.startRaidRun();
      }
      if (action === "menu") {
        this.game.setMode("menu");
      }
      if (button.dataset.rewardedOffer) {
        button.disabled = true;
        this.rewardStatus = "Checking rewarded ad...";
        this.refreshRewardedOffers();
        const result = await this.game.claimRewardedOffer({
          offerId: button.dataset.rewardedOffer,
          source: "game_over",
        });
        this.rewardStatus = result.message;
        this.refreshRewardedOffers();
      }
    });
    document.body.appendChild(this.root);
    this.refreshRewardedOffers();
  }

  exit() {
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
  }

  renderGameToText() {
    return JSON.stringify({
      mode: "game_over",
      payload: this.payload,
      rewardedOffers: getGameOverRewardedOffers({ game: this.game, payload: this.payload }),
      rewardedStatus: this.rewardStatus,
    });
  }

  advanceSimulation() {}

  refreshRewardedOffers() {
    if (!this.root) {
      return;
    }
    const panel = this.root.querySelector('[data-bind="rewarded-panel"]');
    const list = this.root.querySelector('[data-bind="rewarded-offers"]');
    const status = this.root.querySelector('[data-bind="rewarded-status"]');
    if (!panel || !list || !status) {
      return;
    }
    const offers = getGameOverRewardedOffers({ game: this.game, payload: this.payload });
    panel.style.display = offers.length ? "" : "none";
    status.textContent = this.rewardStatus;
    list.innerHTML = "";
    for (const offer of offers) {
      const row = document.createElement("div");
      row.className = "fps-rewarded-row";
      row.innerHTML = `
        <span>
          <strong>${escapeHtml(offer.label)}</strong>
          <small>${escapeHtml(offer.claimed ? "Claimed for this run." : offer.description)}</small>
        </span>
        <button type="button" data-rewarded-offer="${escapeHtml(offer.id)}" ${offer.claimed ? "disabled" : ""}>
          ${escapeHtml(offer.claimed ? "Claimed" : "Watch Ad")}
        </button>
      `;
      list.appendChild(row);
    }
  }
}
