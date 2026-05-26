import { describe, expect, it } from "vitest";
import {
  AdaptiveMusicDirector,
  MUSIC_CUES,
  computeRaidThreatScore,
  selectMusicCue,
  selectRaidMusicCue,
} from "../src/fps/systems/musicDirector";

describe("adaptive music director", () => {
  it("declares every planned music cue", () => {
    expect(Object.keys(MUSIC_CUES).sort()).toEqual([
      "boss_battle",
      "game_over_sting",
      "menu_theme",
      "raid_high",
      "raid_low",
      "raid_mid",
      "safe_house_intro",
      "shop_intermission",
      "victory_sting",
    ]);
  });

  it("maps non-raid phases to explicit cues", () => {
    expect(selectMusicCue({ mode: "menu" })).toBe("menu_theme");
    expect(selectMusicCue({ mode: "shop" })).toBe("shop_intermission");
    expect(selectMusicCue({ mode: "summary" })).toBe("shop_intermission");
    expect(selectMusicCue({ mode: "game_over", victory: true })).toBe("victory_sting");
    expect(selectMusicCue({ mode: "game_over", victory: false })).toBe("game_over_sting");
  });

  it("uses safe-house and boss overrides before combat intensity bands", () => {
    expect(selectRaidMusicCue({ phase: "house_intro", aliveEnemies: 12 })).toBe("safe_house_intro");
    expect(selectRaidMusicCue({ phase: "secret_boss", aliveEnemies: 0 })).toBe("boss_battle");
    expect(selectRaidMusicCue({ bossActive: true, aliveEnemies: 1 })).toBe("boss_battle");
  });

  it("scores raid pressure from wave, enemy, proximity, damage, and health state", () => {
    const calm = computeRaidThreatScore({
      waveNumber: 1,
      aliveEnemies: 1,
      closestThreatDistance: 28,
      playerHp: 100,
      villageHp: 700,
      maxVillageHp: 700,
    });
    const dangerous = computeRaidThreatScore({
      waveNumber: 9,
      aliveEnemies: 13,
      closestThreatDistance: 2.5,
      playerHp: 36,
      villageHp: 210,
      maxVillageHp: 700,
      villageDamageRecent: 0.8,
      playerDamageRecent: 0.6,
    });

    expect(calm).toBeLessThan(0.42);
    expect(dangerous).toBeGreaterThan(0.72);
    expect(selectRaidMusicCue({ waveNumber: 1, aliveEnemies: 1, closestThreatDistance: 28 })).toBe("raid_low");
    expect(selectRaidMusicCue({ waveNumber: 6, aliveEnemies: 9, closestThreatDistance: 8 })).toBe("raid_mid");
    expect(selectRaidMusicCue({ waveNumber: 12, aliveEnemies: 15, closestThreatDistance: 2 })).toBe("raid_high");
  });

  it("uses dwell time and hysteresis to avoid rapid raid-band flicker", () => {
    const director = new AdaptiveMusicDirector({ minDwellSec: 4 });
    const calm = { mode: "raid", waveNumber: 1, aliveEnemies: 1, closestThreatDistance: 28 };
    const high = { mode: "raid", waveNumber: 12, aliveEnemies: 16, closestThreatDistance: 2 };

    expect(director.update(calm, 0, { force: true })).toBe("raid_low");
    expect(director.update(high, 1)).toBe("raid_low");
    expect(director.update(high, 3.1)).toBe("raid_high");
    expect(director.update(calm, 1)).toBe("raid_high");
    expect(director.update(calm, 3.1)).toBe("raid_low");
  });
});
