export const WEAPON_SLOT_BINDINGS = [
  { code: "digit1", id: "pistol" },
  { code: "digit2", id: "revolver" },
  { code: "digit3", id: "machine_pistol" },
  { code: "digit4", id: "smg" },
  { code: "digit5", id: "rifle" },
  { code: "digit6", id: "battle_rifle" },
  { code: "digit7", id: "shotgun" },
  { code: "digit8", id: "dmr" },
  { code: "digit9", id: "sniper" },
  { code: "digit0", id: "lmg" },
  { code: "minus", id: "rpg" },
  { code: "equal", id: "grenade_launcher" },
  { code: "bracketright", id: "flamethrower" },
  { code: "backquote", id: "pipe" },
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
