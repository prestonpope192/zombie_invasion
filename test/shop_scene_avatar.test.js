// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { ShopScene3D } from "../src/fps/scenes/ShopScene3D";

describe("ShopScene3D avatar sync", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("applies the equipped armor class and descriptive caption", () => {
    const scene = new ShopScene3D({
      economy: {
        armorUpgrades: [
          { id: "cloth", label: "Cloth Jacket", damageReduction: 0, style: "Long coat and field scarf" },
          { id: "hazmat", label: "Hazmat Shell", damageReduction: 0.4, style: "Sealed hood, amber visor, and respirator tanks" },
        ],
      },
      save: {
        equippedArmorId: "hazmat",
      },
    });

    scene.root = document.createElement("div");
    scene.root.innerHTML = `
      <div class="fps-player-avatar armor-cloth" data-bind="avatar"></div>
      <p data-bind="armor-caption"></p>
    `;

    scene.syncAvatar();

    const avatar = scene.root.querySelector('[data-bind="avatar"]');
    const caption = scene.root.querySelector('[data-bind="armor-caption"]');
    expect(avatar.className).toBe("fps-player-avatar armor-hazmat");
    expect(avatar.dataset.armorId).toBe("hazmat");
    expect(caption.textContent).toContain("Hazmat Shell");
    expect(caption.textContent).toContain("40% damage resist");
    expect(caption.textContent).toContain("respirator tanks");
  });
});
