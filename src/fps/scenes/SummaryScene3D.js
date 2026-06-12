import { escapeHtml } from "../systems/safeHtml";
import { getNextWaveThreatBrief } from "../systems/firstSessionRules";
import { getSummaryRewardedOffers } from "../systems/rewardedAdOffers";

export class SummaryScene3D {
  constructor(game) {
    this.game = game;
    this.root = null;
    this.nextButton = null;
    this.onKeyDown = null;
    this.rewardStatus = "";
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
        <div class="fps-rewarded-panel" data-bind="rewarded-panel">
          <h3>Bonus Rewards</h3>
          <div class="fps-rewarded-list" data-bind="rewarded-offers"></div>
          <p class="fps-rewarded-status" data-bind="rewarded-status"></p>
        </div>
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

    this.root.addEventListener("click", async (event) => {
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
      if (button.dataset.rewardedOffer) {
        button.disabled = true;
        this.rewardStatus = "Checking rewarded ad...";
        this.refreshRewardedOffers();
        const result = await this.game.claimRewardedOffer({
          offerId: button.dataset.rewardedOffer,
          summary: this.summary,
          source: "summary",
        });
        this.rewardStatus = result.message;
        this.refreshRewardedOffers();
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
    this.refreshRewardedOffers();
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
    return JSON.stringify({
      mode: "summary",
      summary: this.summary,
      rewardedOffers: getSummaryRewardedOffers({ game: this.game, summary: this.summary }),
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

    const offers = getSummaryRewardedOffers({ game: this.game, summary: this.summary });
    panel.style.display = offers.length ? "" : "none";
    status.textContent = this.rewardStatus;
    list.innerHTML = "";
    for (const offer of offers) {
      const row = document.createElement("div");
      row.className = "fps-rewarded-row";
      if (offer.claimed) {
        row.classList.add("is-claimed");
      }
      row.innerHTML = `
        <span>
          <strong>${escapeHtml(offer.label)}</strong>
          <small>${escapeHtml(offer.claimed ? "Claimed for this wave." : offer.description)}</small>
        </span>
        <button type="button" data-rewarded-offer="${escapeHtml(offer.id)}" ${offer.claimed ? "disabled" : ""}>
          ${escapeHtml(offer.claimed ? "Claimed" : "Watch Ad")}
        </button>
      `;
      list.appendChild(row);
    }
  }
}
