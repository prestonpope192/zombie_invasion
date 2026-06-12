const MOCK_AD_PARAM = "mockRewardedAds";

export function detectRewardedAdProvider(globalScope = globalThis) {
  if (globalScope?.CrazyGames?.SDK?.ad?.requestAd) {
    return "crazygames";
  }
  if (globalScope?.PokiSDK?.rewardedBreak) {
    return "poki";
  }
  return "none";
}

function hasMockRewardedAds(globalScope) {
  try {
    const search = globalScope?.location?.search ?? "";
    return new URLSearchParams(search).has(MOCK_AD_PARAM);
  } catch {
    return false;
  }
}

function showCrazyGamesRewardedAd(globalScope) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (completed) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve({ completed, provider: "crazygames" });
    };

    try {
      globalScope.CrazyGames.SDK.ad.requestAd("rewarded", {
        adFinished: () => finish(true),
        adError: () => finish(false),
        adStarted: () => {},
      });
    } catch {
      finish(false);
    }
  });
}

async function showPokiRewardedAd(globalScope) {
  try {
    const completed = await globalScope.PokiSDK.rewardedBreak();
    return { completed: Boolean(completed), provider: "poki" };
  } catch {
    return { completed: false, provider: "poki" };
  }
}

export async function showRewardedAd({ globalScope = globalThis, provider = detectRewardedAdProvider(globalScope) } = {}) {
  if (hasMockRewardedAds(globalScope)) {
    return { completed: true, provider: "mock" };
  }
  if (provider === "crazygames") {
    return showCrazyGamesRewardedAd(globalScope);
  }
  if (provider === "poki") {
    return showPokiRewardedAd(globalScope);
  }
  return { completed: false, provider: "none" };
}
