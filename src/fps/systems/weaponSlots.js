export const WEAPON_SLOT_BINDINGS = [
  { code: "digit1", id: "pistol" },
  { code: "digit2", id: "smg" },
  { code: "digit3", id: "rifle" },
  { code: "digit4", id: "shotgun" },
  { code: "digit5", id: "dmr" },
  { code: "digit6", id: "rpg" },
  { code: "digit7", id: "pipe" },
  { code: "digit0", id: "pipe" },
];

export function resolveWeaponSlotSelection(keyState, ownedWeapons, fallbackWeaponId = null) {
  for (const slot of WEAPON_SLOT_BINDINGS) {
    if (!keyState?.get(slot.code)) {
      continue;
    }
    if (!ownedWeapons?.includes(slot.id)) {
      continue;
    }
    return slot.id;
  }
  return fallbackWeaponId;
}
