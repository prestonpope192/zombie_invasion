export const DEFAULT_GRENADE_TYPE_ID = "frag";

export const GRENADE_TYPE_DEFS = [
  {
    id: "frag",
    label: "Frag Grenade",
    shortLabel: "Frag",
    description: "Starter blast grenade with a balanced radius.",
    damage: 120,
    radius: 4.8,
    impulse: 28,
    cooldownSec: 0.35,
    muzzleVelocityMps: 19,
    massGrams: 480,
    drag: 0.1,
    lifeSec: 1.3,
    projectileRadius: 0.085,
    projectileColor: 0x47694a,
    projectileEmissive: 0x7a9a52,
    projectileEmissiveIntensity: 0.3,
    effectId: "frag",
    stunSec: 0,
  },
  {
    id: "breacher",
    label: "Breacher Grenade",
    shortLabel: "Breach",
    description: "Heavy satchel-style grenade with a wider shockwave and stronger push.",
    damage: 190,
    radius: 6.2,
    impulse: 40,
    cooldownSec: 0.42,
    muzzleVelocityMps: 17.5,
    massGrams: 760,
    drag: 0.12,
    lifeSec: 1.42,
    projectileRadius: 0.102,
    projectileColor: 0x66543d,
    projectileEmissive: 0xc49b5a,
    projectileEmissiveIntensity: 0.36,
    effectId: "breacher",
    stunSec: 0.18,
  },
  {
    id: "nova",
    label: "Nova Grenade",
    shortLabel: "Nova",
    description: "Experimental overcharged canister with the biggest blast and a stunning pulse.",
    damage: 280,
    radius: 7.5,
    impulse: 52,
    cooldownSec: 0.52,
    muzzleVelocityMps: 16,
    massGrams: 940,
    drag: 0.14,
    lifeSec: 1.55,
    projectileRadius: 0.11,
    projectileColor: 0x36536b,
    projectileEmissive: 0x7de8ff,
    projectileEmissiveIntensity: 0.42,
    effectId: "nova",
    stunSec: 0.55,
  },
];

function toCount(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

export function getGrenadeTypeDefs() {
  return GRENADE_TYPE_DEFS;
}

export function getGrenadeTypeIds() {
  return GRENADE_TYPE_DEFS.map((entry) => entry.id);
}

export function getGrenadeTypeDef(grenadeTypeId = DEFAULT_GRENADE_TYPE_ID) {
  return GRENADE_TYPE_DEFS.find((entry) => entry.id === grenadeTypeId) ?? GRENADE_TYPE_DEFS[0];
}

export function defaultGrenadeInventory(startingFragCount = 5) {
  return {
    frag: Math.max(0, toCount(startingFragCount, 5)),
    breacher: 0,
    nova: 0,
  };
}

export function normalizeGrenadeInventory(rawInventory, legacyFragCount = 5) {
  const inventory = defaultGrenadeInventory(legacyFragCount);
  if (!rawInventory || typeof rawInventory !== "object") {
    return inventory;
  }
  for (const grenadeTypeId of getGrenadeTypeIds()) {
    const fallback = grenadeTypeId === DEFAULT_GRENADE_TYPE_ID ? inventory[grenadeTypeId] : 0;
    inventory[grenadeTypeId] = toCount(rawInventory[grenadeTypeId], fallback);
  }
  return inventory;
}

export function ensureGrenadeInventory(save) {
  if (!save || typeof save !== "object") {
    return defaultGrenadeInventory();
  }
  save.grenadeInventory = normalizeGrenadeInventory(save.grenadeInventory, save.grenades ?? 5);
  if (!getGrenadeTypeIds().includes(save.activeGrenadeId)) {
    save.activeGrenadeId = DEFAULT_GRENADE_TYPE_ID;
  }
  syncLegacyGrenadeCount(save);
  return save.grenadeInventory;
}

export function syncLegacyGrenadeCount(save) {
  if (!save || typeof save !== "object") {
    return save;
  }
  const inventory = save.grenadeInventory && typeof save.grenadeInventory === "object" ? save.grenadeInventory : defaultGrenadeInventory();
  save.grenades = toCount(inventory.frag, 0);
  return save;
}

export function getGrenadeCount(save, grenadeTypeId = DEFAULT_GRENADE_TYPE_ID) {
  const inventory = ensureGrenadeInventory(save);
  return toCount(inventory[grenadeTypeId], 0);
}

export function addGrenadeCount(save, grenadeTypeId, amount) {
  const inventory = ensureGrenadeInventory(save);
  const current = toCount(inventory[grenadeTypeId], 0);
  inventory[grenadeTypeId] = Math.max(0, current + toCount(amount, 0));
  syncLegacyGrenadeCount(save);
  return inventory[grenadeTypeId];
}

export function consumeGrenadeById(save, grenadeTypeId) {
  const inventory = ensureGrenadeInventory(save);
  const current = toCount(inventory[grenadeTypeId], 0);
  if (current <= 0) {
    return 0;
  }
  inventory[grenadeTypeId] = Math.max(0, current - 1);
  syncLegacyGrenadeCount(save);
  return inventory[grenadeTypeId];
}

export function getActiveGrenadeId(save) {
  ensureGrenadeInventory(save);
  return save.activeGrenadeId || DEFAULT_GRENADE_TYPE_ID;
}

export function setActiveGrenadeId(save, grenadeTypeId) {
  ensureGrenadeInventory(save);
  if (getGrenadeTypeIds().includes(grenadeTypeId)) {
    save.activeGrenadeId = grenadeTypeId;
  }
  return getActiveGrenadeId(save);
}

export function cycleActiveGrenadeId(save, predicate = null) {
  ensureGrenadeInventory(save);
  const ids = getGrenadeTypeIds().filter((grenadeTypeId) => (typeof predicate === "function" ? predicate(grenadeTypeId) : true));
  if (!ids.length) {
    return getActiveGrenadeId(save);
  }
  const index = ids.indexOf(save.activeGrenadeId);
  const next = ids[(index + 1 + ids.length) % ids.length];
  save.activeGrenadeId = next;
  return next;
}
