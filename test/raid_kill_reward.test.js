import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { RaidScene3D } from "../src/fps/scenes/RaidScene3D";

describe("raid kill rewards", () => {
  it("applies villager coin multiplier on zombie kills", () => {
    const context = {
      waveStats: { kills: 0, coins: 0 },
      game: {
        save: {
          coins: 0,
          lifetimeStats: {
            kills: 0,
          },
        },
      },
      villagerPerkModifiers: {
        killCoinMultiplier: 1.1,
      },
      spawnCoinRewardBurst: vi.fn(),
      lastKillRewardLabel: "",
      lastKillRewardTimer: 0,
    };

    const enemy = {
      coinReward: 10,
      label: "Walker",
      mesh: { position: new THREE.Vector3(0, 0, 0) },
    };

    const reward = RaidScene3D.prototype.awardKillReward.call(context, enemy);
    expect(reward).toBe(11);
    expect(context.waveStats.kills).toBe(1);
    expect(context.waveStats.coins).toBe(11);
    expect(context.game.save.coins).toBe(11);
    expect(context.spawnCoinRewardBurst).toHaveBeenCalledTimes(1);
  });
});
