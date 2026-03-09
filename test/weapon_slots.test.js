import { describe, expect, it } from "vitest";
import { resolveWeaponSlotSelection, WEAPON_SLOT_BINDINGS } from "../src/fps/systems/weaponSlots";

function pressed(...codes) {
  const map = new Map();
  for (const code of codes) {
    map.set(code, true);
  }
  return map;
}

describe("weapon slot mapping", () => {
  it("exposes stable slot bindings", () => {
    expect(WEAPON_SLOT_BINDINGS.find((slot) => slot.code === "digit4")?.id).toBe("shotgun");
    expect(WEAPON_SLOT_BINDINGS.find((slot) => slot.code === "digit7")?.id).toBe("pipe");
  });

  it("selects mapped weapon only when owned", () => {
    const selected = resolveWeaponSlotSelection(
      pressed("digit4"),
      ["pipe", "pistol", "shotgun"],
      null,
    );
    expect(selected).toBe("shotgun");

    const blocked = resolveWeaponSlotSelection(
      pressed("digit4"),
      ["pipe", "pistol"],
      "pipe",
    );
    expect(blocked).toBe("pipe");
  });
});
