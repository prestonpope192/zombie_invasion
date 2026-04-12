// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { SummaryScene3D } from "../src/fps/scenes/SummaryScene3D";

describe("SummaryScene3D", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    if (!window.requestAnimationFrame) {
      window.requestAnimationFrame = (callback) => callback();
    }
    globalThis.requestAnimationFrame = window.requestAnimationFrame;
  });

  it("releases pointer lock, focuses next, and advances on Space or Enter", () => {
    const game = {
      resumeAfterIntermission: vi.fn(),
      openShop: vi.fn(),
    };
    const scene = new SummaryScene3D(game);
    const exitPointerLock = vi.fn();

    Object.defineProperty(document, "pointerLockElement", {
      configurable: true,
      value: document.createElement("canvas"),
    });
    Object.defineProperty(document, "exitPointerLock", {
      configurable: true,
      value: exitPointerLock,
    });

    scene.enter({ wave: 3, kills: 18, coins: 40, villageHp: 522 });

    const nextButton = document.querySelector('[data-action="next"]');
    const shopButton = document.querySelector('[data-action="shop"]');
    expect(exitPointerLock).toHaveBeenCalledTimes(1);
    nextButton.click();
    shopButton.click();

    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Enter", bubbles: true }));

    expect(game.resumeAfterIntermission).toHaveBeenCalledTimes(3);
    expect(game.openShop).toHaveBeenCalledTimes(1);

    scene.exit();
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", bubbles: true }));
    expect(game.resumeAfterIntermission).toHaveBeenCalledTimes(3);
  });
});
