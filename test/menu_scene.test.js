// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { MenuScene3D } from "../src/fps/scenes/MenuScene3D";
import { defaultFpsSave } from "../src/fps/systems/saveFps";

function createGame(overrides = {}) {
  return {
    version: "test-version",
    save: {
      ...defaultFpsSave(),
      coins: 275,
      bestWave: 6,
      ownedWeapons: ["pipe", "pistol", "smg"],
      rescuedVillagers: ["villager_house_a", "villager_barn"],
    },
    audio: { unlockAudio: vi.fn() },
    mobileControls: { hide: vi.fn() },
    persistAudioSettings: vi.fn(),
    startRaidRun: vi.fn(),
    defaultSaveFactory: vi.fn(() => defaultFpsSave()),
    reloadSave: vi.fn(),
    ...overrides,
  };
}

describe("MenuScene3D", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("renders saved progress, settings, and starts the raid from the primary action", () => {
    const game = createGame();
    const scene = new MenuScene3D(game);

    scene.enter();

    expect(document.querySelector('[data-stat="best-wave"] strong').textContent).toBe("6");
    expect(document.querySelector('[data-stat="coins"] strong').textContent).toBe("275");
    expect(document.querySelector('[data-stat="weapons"] strong').textContent).toBe("3");
    expect(document.querySelector('[data-stat="villagers"] strong').textContent).toBe("2");
    expect(document.querySelector('[data-setting="musicEnabled"]').checked).toBe(true);
    expect(document.querySelector('[data-setting="sfxEnabled"]').checked).toBe(true);
    expect(game.mobileControls.hide).toHaveBeenCalledTimes(1);

    document.querySelector('[data-action="start"]').click();

    expect(game.audio.unlockAudio).toHaveBeenCalledTimes(1);
    expect(game.startRaidRun).toHaveBeenCalledTimes(1);
    expect(JSON.parse(scene.renderGameToText())).toEqual(
      expect.objectContaining({
        mode: "menu",
        version: "test-version",
        coins: 275,
        bestWave: 6,
        equippedWeapon: "pipe",
        settings: { musicEnabled: true, sfxEnabled: true },
      }),
    );
  });

  it("persists audio setting changes through the game settings API", () => {
    const game = createGame();
    const scene = new MenuScene3D(game);
    scene.enter();

    const music = document.querySelector('[data-setting="musicEnabled"]');
    music.checked = false;
    music.dispatchEvent(new Event("change", { bubbles: true }));

    expect(game.persistAudioSettings).toHaveBeenCalledWith({
      musicEnabled: false,
      sfxEnabled: true,
    });

    const sfx = document.querySelector('[data-setting="sfxEnabled"]');
    sfx.checked = false;
    sfx.dispatchEvent(new Event("change", { bubbles: true }));

    expect(game.persistAudioSettings).toHaveBeenLastCalledWith({
      musicEnabled: true,
      sfxEnabled: false,
    });
  });

  it("reset starts from the default save and immediately launches a fresh run", () => {
    const game = createGame();
    const scene = new MenuScene3D(game);
    scene.enter();

    document.querySelector('[data-action="reset"]').click();

    expect(game.defaultSaveFactory).toHaveBeenCalledTimes(1);
    expect(game.reloadSave).toHaveBeenCalledTimes(1);
    expect(game.startRaidRun).toHaveBeenCalledTimes(1);
    expect(game.save.coins).toBe(0);
    expect(game.save.ownedWeapons).toEqual(["pipe"]);
  });

  it("removes its overlay on exit", () => {
    const scene = new MenuScene3D(createGame());
    scene.enter();
    expect(document.querySelector(".fps-overlay.menu")).toBeTruthy();

    scene.exit();

    expect(document.querySelector(".fps-overlay.menu")).toBeNull();
  });
});
