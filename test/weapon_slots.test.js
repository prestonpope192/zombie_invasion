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
    expect(WEAPON_SLOT_BINDINGS.find((slot) => slot.code === "digit4")?.id).toBe("smg");
    expect(WEAPON_SLOT_BINDINGS.find((slot) => slot.code === "digit8")?.id).toBe("dmr");
    expect(WEAPON_SLOT_BINDINGS.find((slot) => slot.code === "equal")?.id).toBe("grenade_launcher");
    expect(WEAPON_SLOT_BINDINGS.find((slot) => slot.code === "bracketright")?.id).toBe("flamethrower");
    expect(WEAPON_SLOT_BINDINGS.find((slot) => slot.code === "backquote")?.id).toBe("pipe");
  });

  it("selects mapped weapon only when owned", () => {
    const selected = resolveWeaponSlotSelection(
      pressed("digit4"),
      ["pipe", "pistol", "smg"],
      null,
    );
    expect(selected).toBe("smg");

    const blocked = resolveWeaponSlotSelection(
      pressed("equal"),
      ["pipe", "pistol"],
      "pipe",
    );
    expect(blocked).toBe("pipe");

    const flamethrower = resolveWeaponSlotSelection(
      pressed("bracketright"),
      ["pipe", "flamethrower"],
      "pipe",
    );
    expect(flamethrower).toBe("flamethrower");
  });
});
