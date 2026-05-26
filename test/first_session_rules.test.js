import { describe, expect, it } from "vitest";
import weapons from "../src/fps/config/weapons_fps.json";
import economy from "../src/fps/config/economy_fps.json";
import waves from "../src/fps/config/waves_fps.json";
import enemies from "../src/fps/config/enemies_fps.json";
import { defaultFpsSave } from "../src/fps/systems/saveFps";
import {
  getEnemyIntroMessage,
  getFirstSessionShopRecommendation,
  getNextWaveThreatBrief,
  getRunMotivation,
} from "../src/fps/systems/firstSessionRules";

describe("first-session rules", () => {
  it("recommends the first affordable gun after Wave 1 unlocks the pistol", () => {
    const save = {
      ...defaultFpsSave(),
      coins: 55,
      pistolUnlocked: true,
      ownedWeapons: ["pipe"],
      unlockedWeapons: ["pipe", "pistol"],
    };

    expect(
      getFirstSessionShopRecommendation({
        save,
        waveNumber: 2,
        weapons,
        economy,
        currentHp: 100,
      }),
    ).toMatchObject({
      targetType: "weapon",
      targetId: "pistol",
    });
  });

  it("prioritizes healing over shopping when health is low", () => {
    const save = {
      ...defaultFpsSave(),
      coins: 55,
      pistolUnlocked: true,
      ownedWeapons: ["pipe"],
      unlockedWeapons: ["pipe", "pistol"],
    };

    expect(
      getFirstSessionShopRecommendation({
        save,
        waveNumber: 2,
        weapons,
        economy,
        currentHp: 42,
      }),
    ).toMatchObject({
      targetType: "medkit",
      targetId: "medkit",
    });
  });

  it("surfaces the first new enemy in the next wave", () => {
    const enemyMap = new Map(enemies.map((enemy) => [enemy.id, enemy]));
    const brief = getNextWaveThreatBrief({ clearedWave: 1, waveDefs: waves, enemyMap });

    expect(brief).toMatchObject({
      wave: 2,
      type: "runner",
      label: "Runner",
    });
    expect(brief.message).toContain("Runner spotted");
  });

  it("keeps enemy intros and run motivation player-facing", () => {
    expect(getEnemyIntroMessage("brute", "Brute")).toContain("Brute spotted");
    expect(getRunMotivation({ victory: false, waveReached: 1, bestWave: 1 })).toContain("buy your first gun");
    expect(getRunMotivation({ victory: true, waveReached: 12, bestWave: 12 })).toContain("endless push");
  });
});
