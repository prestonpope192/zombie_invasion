import { describe, expect, it, vi } from "vitest";
import {
  REWARDED_OFFER_IDS,
  applyRewardedOffer,
  createRewardedRunState,
  getGameOverRewardedOffers,
  getSummaryRewardedOffers,
} from "../src/fps/systems/rewardedAdOffers";
import { detectRewardedAdProvider, showRewardedAd } from "../src/fps/systems/rewardedAds";

function makeGame(overrides = {}) {
  return {
    save: {
      coins: 100,
      grenades: 5,
      grenadeInventory: { frag: 5, breacher: 0, nova: 0 },
      activeGrenadeId: "frag",
    },
    rewardedRunState: createRewardedRunState(),
    raidScene: {
      playerController: {
        state: { hp: 42 },
      },
    },
    ...overrides,
  };
}

describe("rewarded ad offers", () => {
  it("offers wave-summary rewards when eligible", () => {
    const game = makeGame();
    const offers = getSummaryRewardedOffers({
      game,
      summary: { wave: 3, coins: 70 },
    });

    expect(offers.map((offer) => offer.id)).toEqual([
      REWARDED_OFFER_IDS.DOUBLE_WAVE_COINS,
      REWARDED_OFFER_IDS.FREE_MEDKIT,
      REWARDED_OFFER_IDS.BONUS_GRENADES,
    ]);
    expect(offers[0].label).toBe("Double +70 Coins");
    expect(offers[1].description).toContain("42/100 HP");
    expect(offers[2].label).toBe("+2 Frag Grenades");
  });

  it("applies double coins once for a summary wave", () => {
    const game = makeGame();
    const summary = { wave: 2, coins: 50 };

    const first = applyRewardedOffer({
      game,
      offerId: REWARDED_OFFER_IDS.DOUBLE_WAVE_COINS,
      summary,
    });
    expect(first.applied).toBe(true);
    expect(game.save.coins).toBe(150);

    const second = applyRewardedOffer({
      game,
      offerId: REWARDED_OFFER_IDS.DOUBLE_WAVE_COINS,
      summary,
    });
    expect(second.applied).toBe(false);
    expect(game.save.coins).toBe(150);
  });

  it("applies free med kit once for a summary wave", () => {
    const game = makeGame();
    const summary = { wave: 4, coins: 20 };

    const first = applyRewardedOffer({
      game,
      offerId: REWARDED_OFFER_IDS.FREE_MEDKIT,
      summary,
    });
    expect(first.applied).toBe(true);
    expect(game.raidScene.playerController.state.hp).toBe(100);

    game.raidScene.playerController.state.hp = 12;
    const second = applyRewardedOffer({
      game,
      offerId: REWARDED_OFFER_IDS.FREE_MEDKIT,
      summary,
    });
    expect(second.applied).toBe(false);
    expect(game.raidScene.playerController.state.hp).toBe(12);
  });

  it("applies bonus grenades once for a summary wave", () => {
    const game = makeGame();
    const summary = { wave: 5, coins: 20 };

    const first = applyRewardedOffer({
      game,
      offerId: REWARDED_OFFER_IDS.BONUS_GRENADES,
      summary,
    });
    expect(first.applied).toBe(true);
    expect(game.save.grenades).toBe(7);
    expect(game.save.grenadeInventory.frag).toBe(7);

    const second = applyRewardedOffer({
      game,
      offerId: REWARDED_OFFER_IDS.BONUS_GRENADES,
      summary,
    });
    expect(second.applied).toBe(false);
    expect(game.save.grenades).toBe(7);
  });

  it("offers and applies one revive per run", () => {
    const reviveFromRewardedAd = vi.fn();
    const game = makeGame({ reviveFromRewardedAd });

    expect(getGameOverRewardedOffers({ game, payload: { victory: false } })).toHaveLength(1);
    const result = applyRewardedOffer({
      game,
      offerId: REWARDED_OFFER_IDS.REVIVE,
    });

    expect(result.applied).toBe(true);
    expect(reviveFromRewardedAd).toHaveBeenCalledWith({ hp: 60, invulnerableSec: 3 });
    expect(getGameOverRewardedOffers({ game, payload: { victory: false } })).toHaveLength(0);
  });
});

describe("rewarded ad adapter", () => {
  it("detects known rewarded ad providers", () => {
    expect(detectRewardedAdProvider({ CrazyGames: { SDK: { ad: { requestAd: vi.fn() } } } })).toBe("crazygames");
    expect(detectRewardedAdProvider({ PokiSDK: { rewardedBreak: vi.fn() } })).toBe("poki");
    expect(detectRewardedAdProvider({})).toBe("none");
  });

  it("uses mock rewarded ads when the URL flag is present", async () => {
    const result = await showRewardedAd({
      globalScope: { location: { search: "?mockRewardedAds=1" } },
    });
    expect(result).toEqual({ completed: true, provider: "mock" });
  });
});
