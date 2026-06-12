import { DEFAULT_GRENADE_TYPE_ID, addGrenadeCount } from "./grenadeLoadout";

export const REWARDED_OFFER_IDS = {
  DOUBLE_WAVE_COINS: "double_wave_coins",
  FREE_MEDKIT: "free_medkit",
  BONUS_GRENADES: "bonus_grenades",
  REVIVE: "revive",
};

export function createRewardedRunState() {
  return {
    claimedOfferKeys: [],
    reviveUsed: false,
    telemetry: [],
  };
}

export function ensureRewardedRunState(game) {
  if (!game.rewardedRunState || typeof game.rewardedRunState !== "object") {
    game.rewardedRunState = createRewardedRunState();
  }
  if (!Array.isArray(game.rewardedRunState.claimedOfferKeys)) {
    game.rewardedRunState.claimedOfferKeys = [];
  }
  if (!Array.isArray(game.rewardedRunState.telemetry)) {
    game.rewardedRunState.telemetry = [];
  }
  game.rewardedRunState.reviveUsed = Boolean(game.rewardedRunState.reviveUsed);
  return game.rewardedRunState;
}

export function getSummaryOfferClaimKey({ offerId, wave }) {
  const safeWave = Math.max(1, Number.parseInt(wave, 10) || 1);
  return `summary:${safeWave}:${offerId}`;
}

export function isRewardedOfferClaimed(game, claimKey) {
  const state = ensureRewardedRunState(game);
  return state.claimedOfferKeys.includes(claimKey);
}

export function markRewardedOfferClaimed(game, claimKey) {
  const state = ensureRewardedRunState(game);
  if (!state.claimedOfferKeys.includes(claimKey)) {
    state.claimedOfferKeys.push(claimKey);
  }
}

function getPlayerHp(game) {
  return Math.max(0, Math.min(100, Number(game?.raidScene?.playerController?.state?.hp) || 0));
}

export function getSummaryRewardedOffers({ game, summary } = {}) {
  const wave = Math.max(1, Number.parseInt(summary?.wave, 10) || 1);
  const coins = Math.max(0, Number.parseInt(summary?.coins, 10) || 0);
  const hp = getPlayerHp(game);
  const offers = [];

  if (coins > 0) {
    const claimKey = getSummaryOfferClaimKey({ offerId: REWARDED_OFFER_IDS.DOUBLE_WAVE_COINS, wave });
    offers.push({
      id: REWARDED_OFFER_IDS.DOUBLE_WAVE_COINS,
      claimKey,
      label: `Double +${coins} Coins`,
      description: `Watch an ad to add ${coins} bonus coins from this wave.`,
      claimed: isRewardedOfferClaimed(game, claimKey),
    });
  }

  if (hp < 100) {
    const claimKey = getSummaryOfferClaimKey({ offerId: REWARDED_OFFER_IDS.FREE_MEDKIT, wave });
    offers.push({
      id: REWARDED_OFFER_IDS.FREE_MEDKIT,
      claimKey,
      label: "Free Med Kit",
      description: `Watch an ad to heal from ${Math.round(hp)}/100 HP to full.`,
      claimed: isRewardedOfferClaimed(game, claimKey),
    });
  }

  const grenadeClaimKey = getSummaryOfferClaimKey({ offerId: REWARDED_OFFER_IDS.BONUS_GRENADES, wave });
  offers.push({
    id: REWARDED_OFFER_IDS.BONUS_GRENADES,
    claimKey: grenadeClaimKey,
    label: "+2 Frag Grenades",
    description: "Watch an ad to add a bonus grenade pack for the next wave.",
    claimed: isRewardedOfferClaimed(game, grenadeClaimKey),
  });

  return offers;
}

export function getGameOverRewardedOffers({ game, payload } = {}) {
  const state = ensureRewardedRunState(game);
  if (payload?.victory || state.reviveUsed) {
    return [];
  }
  return [
    {
      id: REWARDED_OFFER_IDS.REVIVE,
      claimKey: "run:revive",
      label: "Revive Once",
      description: "Watch an ad to stand back up with 60 HP and a short grace period.",
      claimed: state.reviveUsed,
    },
  ];
}

export function applyRewardedOffer({ game, offerId, summary } = {}) {
  const state = ensureRewardedRunState(game);

  if (offerId === REWARDED_OFFER_IDS.DOUBLE_WAVE_COINS) {
    const claimKey = getSummaryOfferClaimKey({ offerId, wave: summary?.wave });
    if (isRewardedOfferClaimed(game, claimKey)) {
      return { applied: false, message: "Reward already claimed." };
    }
    const bonusCoins = Math.max(0, Number.parseInt(summary?.coins, 10) || 0);
    if (bonusCoins <= 0) {
      return { applied: false, message: "No wave coins to double." };
    }
    game.save.coins += bonusCoins;
    markRewardedOfferClaimed(game, claimKey);
    return { applied: true, message: `Added ${bonusCoins} bonus coins.`, reward: { coins: bonusCoins } };
  }

  if (offerId === REWARDED_OFFER_IDS.FREE_MEDKIT) {
    const claimKey = getSummaryOfferClaimKey({ offerId, wave: summary?.wave });
    if (isRewardedOfferClaimed(game, claimKey)) {
      return { applied: false, message: "Reward already claimed." };
    }
    if (game.raidScene?.playerController?.state) {
      game.raidScene.playerController.state.hp = 100;
    }
    markRewardedOfferClaimed(game, claimKey);
    return { applied: true, message: "Healed to full health.", reward: { hp: 100 } };
  }

  if (offerId === REWARDED_OFFER_IDS.REVIVE) {
    if (state.reviveUsed) {
      return { applied: false, message: "Revive already used." };
    }
    state.reviveUsed = true;
    if (typeof game.reviveFromRewardedAd === "function") {
      game.reviveFromRewardedAd({ hp: 60, invulnerableSec: 3 });
    }
    return { applied: true, message: "Revived with 60 HP.", reward: { hp: 60 } };
  }

  if (offerId === REWARDED_OFFER_IDS.BONUS_GRENADES) {
    const claimKey = getSummaryOfferClaimKey({ offerId, wave: summary?.wave });
    if (isRewardedOfferClaimed(game, claimKey)) {
      return { applied: false, message: "Reward already claimed." };
    }
    addGrenadeCount(game.save, DEFAULT_GRENADE_TYPE_ID, 2);
    markRewardedOfferClaimed(game, claimKey);
    return { applied: true, message: "Added 2 frag grenades.", reward: { grenades: 2 } };
  }

  return { applied: false, message: "Unknown rewarded offer." };
}
