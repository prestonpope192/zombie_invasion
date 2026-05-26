// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { FpsGame } from "../src/fps/app/FpsGame";
import { defaultFpsSave, FPS_SAVE_KEY } from "../src/fps/systems/saveFps";

function createModeHarness() {
  const hud = document.createElement("div");
  const crosshair = document.createElement("div");
  const game = {
    mode: "raid",
    save: defaultFpsSave(),
    raidScene: {
      pause: vi.fn(),
      enter: vi.fn(),
      resumeAfterIntermission: vi.fn(),
      waveDirector: { waveNumber: 4 },
      hud,
      crosshair,
    },
    menuScene: { enter: vi.fn(), renderGameToText: vi.fn(() => "{\"mode\":\"menu\"}") },
    shopScene: { enter: vi.fn(), renderGameToText: vi.fn(() => "{\"mode\":\"shop\"}") },
    summaryScene: { enter: vi.fn(), renderGameToText: vi.fn(() => "{\"mode\":\"summary\"}") },
    gameOverScene: { enter: vi.fn(), renderGameToText: vi.fn(() => "{\"mode\":\"game_over\"}") },
    overlayScene: null,
    mobileControls: { show: vi.fn(), hide: vi.fn() },
    audio: {
      unlockAudio: vi.fn(),
      stopMusic: vi.fn(),
      startMusic: vi.fn(),
    },
    clearOverlay: vi.fn(function clearOverlay() {
      this.overlayScene = null;
    }),
  };
  game.setMode = FpsGame.prototype.setMode;
  return game;
}

describe("FpsGame mode lifecycle", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("enters menu, hides raid UI, and starts menu music", () => {
    const game = createModeHarness();

    FpsGame.prototype.setMode.call(game, "menu", { from: "test" });

    expect(game.raidScene.pause).toHaveBeenCalledTimes(1);
    expect(game.clearOverlay).toHaveBeenCalledTimes(1);
    expect(game.overlayScene).toBe(game.menuScene);
    expect(game.menuScene.enter).toHaveBeenCalledWith({ from: "test" });
    expect(game.mode).toBe("menu");
    expect(game.mobileControls.hide).toHaveBeenCalledTimes(1);
    expect(game.audio.stopMusic).toHaveBeenCalledTimes(1);
    expect(game.audio.startMusic).toHaveBeenCalledWith("menu");
    expect(game.raidScene.hud.style.display).toBe("none");
    expect(game.raidScene.crosshair.style.display).toBe("none");
  });

  it("opens shop from raid with the next wave number and hides mobile controls", () => {
    const game = createModeHarness();

    FpsGame.prototype.openShop.call(game);

    expect(game.audio.unlockAudio).toHaveBeenCalledTimes(1);
    expect(game.raidScene.pause).toHaveBeenCalledTimes(1);
    expect(game.shopScene.enter).toHaveBeenCalledWith({ waveNumber: 5 });
    expect(game.mode).toBe("shop");
    expect(game.mobileControls.hide).toHaveBeenCalledTimes(1);
    expect(game.audio.startMusic).toHaveBeenCalledWith("shop");
  });

  it("resumes a raid after intermission and restarts raid music for the current wave", () => {
    const game = createModeHarness();

    FpsGame.prototype.resumeAfterIntermission.call(game);

    expect(game.audio.unlockAudio).toHaveBeenCalledTimes(1);
    expect(game.clearOverlay).toHaveBeenCalledTimes(1);
    expect(game.raidScene.resumeAfterIntermission).toHaveBeenCalledTimes(1);
    expect(game.mode).toBe("raid");
    expect(game.audio.stopMusic).toHaveBeenCalledTimes(1);
    expect(game.audio.startMusic).toHaveBeenCalledWith("raid", { waveNumber: 4 });
    expect(game.mobileControls.show).toHaveBeenCalledTimes(1);
  });

  it("persists the profile when entering game over", () => {
    const game = createModeHarness();
    game.save.coins = 123;

    FpsGame.prototype.setMode.call(game, "game_over", { victory: false, reason: "Test defeat" });

    expect(game.gameOverScene.enter).toHaveBeenCalledWith({ victory: false, reason: "Test defeat" });
    expect(game.mode).toBe("game_over");
    expect(game.mobileControls.hide).toHaveBeenCalledTimes(1);
    expect(game.audio.startMusic).toHaveBeenCalledWith("game_over", { victory: false, reason: "Test defeat" });
    expect(JSON.parse(localStorage.getItem(FPS_SAVE_KEY)).coins).toBe(123);
  });

  it("delegates text rendering to the active overlay or raid scene", () => {
    const game = createModeHarness();
    game.mode = "shop";
    game.overlayScene = game.shopScene;
    expect(FpsGame.prototype.renderGameToText.call(game)).toBe("{\"mode\":\"shop\"}");

    game.mode = "raid";
    game.overlayScene = null;
    game.raidScene.renderGameToText = vi.fn(() => "{\"mode\":\"raid\"}");
    expect(FpsGame.prototype.renderGameToText.call(game)).toBe("{\"mode\":\"raid\"}");
    expect(game.raidScene.renderGameToText).toHaveBeenCalledWith("raid");
  });
});
