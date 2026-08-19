import { describe, expect, it, vi } from "vitest";
import { FpsGame } from "../src/fps/app/FpsGame";
import { Audio3D } from "../src/fps/systems/audio3d";

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

  it("uses metadata-only music preload so cold start does not fetch every cue", () => {
    const OriginalAudio = globalThis.Audio;
    globalThis.Audio = class FakeAudio {
      constructor(src) {
        this.src = src;
        this.preload = "";
        this.loop = false;
        this.volume = 0;
      }
    };

    try {
      const audio = new Audio3D(null);
      const element = audio.getMusicElement("menu_theme");
      expect(element.preload).toBe("metadata");
    } finally {
      if (OriginalAudio) globalThis.Audio = OriginalAudio;
      else delete globalThis.Audio;
    }
  });
});
