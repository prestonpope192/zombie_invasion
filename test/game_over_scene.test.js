// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameOverScene3D } from "../src/fps/scenes/GameOverScene3D";
import { defaultFpsSave } from "../src/fps/systems/saveFps";

describe("GameOverScene3D", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders failure state and routes retry/menu actions", () => {
    const game = {
      save: { ...defaultFpsSave(), bestWave: 9 },
      audio: { unlockAudio: vi.fn() },
      startRaidRun: vi.fn(),
      setMode: vi.fn(),
    };
    const scene = new GameOverScene3D(game);

    scene.enter({ victory: false, reason: "You were overrun before dawn.", waveReached: 3, kills: 12, coins: 40 });

    expect(document.querySelector(".fps-panel h2").textContent).toBe("Mission Failed");
    expect(document.body.textContent).toContain("You were overrun before dawn.");
    expect(document.body.textContent).toContain("Run: Wave 3 · 12 kills · 40 coins earned");
    expect(document.body.textContent).toContain("Best Wave: 9");
    expect(document.body.textContent).toContain("Next goal: get back to your best run, Wave 9.");

    document.querySelector('[data-action="retry"]').click();
    document.querySelector('[data-action="menu"]').click();

    expect(game.audio.unlockAudio).toHaveBeenCalledTimes(2);
    expect(game.startRaidRun).toHaveBeenCalledTimes(1);
    expect(game.setMode).toHaveBeenCalledWith("menu");
    expect(JSON.parse(scene.renderGameToText())).toEqual({
      mode: "game_over",
      payload: {
        victory: false,
        reason: "You were overrun before dawn.",
        waveReached: 3,
        kills: 12,
        coins: 40,
        nextGoal: "Next goal: get back to your best run, Wave 9.",
      },
    });
  });

  it("renders victory state and cleans up on exit", () => {
    const scene = new GameOverScene3D({
      save: defaultFpsSave(),
      audio: { unlockAudio: vi.fn() },
      startRaidRun: vi.fn(),
      setMode: vi.fn(),
    });

    scene.enter({ victory: true, reason: "Secret boss defeated." });
    expect(document.querySelector(".fps-panel h2").textContent).toBe("Mission Complete");

    scene.exit();
    expect(document.querySelector(".fps-overlay.gameover")).toBeNull();
  });
});
