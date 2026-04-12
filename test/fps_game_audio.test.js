import { describe, expect, it, vi } from "vitest";
import { FpsGame } from "../src/fps/app/FpsGame";

describe("FpsGame resumeAfterIntermission", () => {
  it("restores raid music for the current wave", () => {
    const game = Object.create(FpsGame.prototype);
    game.clearOverlay = vi.fn();
    game.raidScene = {
      resumeAfterIntermission: vi.fn(),
      waveDirector: { waveNumber: 5 },
    };
    game.audio = {
      stopMusic: vi.fn(),
      startMusic: vi.fn(),
    };
    game.mobileControls = {
      show: vi.fn(),
    };

    game.resumeAfterIntermission();

    expect(game.clearOverlay).toHaveBeenCalledTimes(1);
    expect(game.raidScene.resumeAfterIntermission).toHaveBeenCalledTimes(1);
    expect(game.audio.stopMusic).toHaveBeenCalledTimes(1);
    expect(game.audio.startMusic).toHaveBeenCalledWith("raid", { waveNumber: 5 });
    expect(game.mobileControls.show).toHaveBeenCalledTimes(1);
    expect(game.mode).toBe("raid");
  });
});
