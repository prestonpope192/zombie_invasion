import {
  DEFAULT_GRENADE_TYPE_ID,
  defaultGrenadeInventory,
  normalizeGrenadeInventory,
  syncLegacyGrenadeCount,
} from "./grenadeLoadout";

export const FPS_SAVE_KEY = "zombie_invasion_fps_save_v2";
export const LEGACY_FPS_SAVE_KEY = "zombie_invasion_fps_save_v1";
const FPS_SAVE_VERSION = 2;

export function defaultFpsSave() {
  return {
    version: FPS_SAVE_VERSION,
    profileType: "fps_house_v2",
    coins: 0,
    bestWave: 0,
    grenades: 5,
    grenadeInventory: defaultGrenadeInventory(),
    activeGrenadeId: DEFAULT_GRENADE_TYPE_ID,
    c4Charges: 0,
    nukes: 0,
    unlockedWeapons: ["pipe"],
    ownedWeapons: ["pipe"],
    equippedWeaponId: "pipe",
    pistolUnlocked: false,
    openedBuildings: [],
    rescuedVillagers: [],
    deadVillagers: [],
    villageLevel: 1,
    ownedArmors: ["cloth"],
    equippedArmorId: "cloth",
    sensitivity: 0.18,
    graphicsPreset: "desktop_high",
    lifetimeStats: {
      kills: 0,
      damageDealt: 0,
      damageTaken: 0,
      villageDamageTaken: 0,
      wavesCleared: 0,
      playSeconds: 0,
    },
  };
}

function int(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function float(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function sanitizeFpsSave(raw) {
  const base = defaultFpsSave();
  if (!raw || typeof raw !== "object") {
    return base;
  }

  const safe = { ...base, ...raw };
  safe.version = FPS_SAVE_VERSION;
  safe.profileType = "fps_house_v2";
  safe.coins = Math.max(0, int(safe.coins));
  safe.grenadeInventory = normalizeGrenadeInventory(raw.grenadeInventory, safe.grenades ?? 5);
  safe.activeGrenadeId = typeof safe.activeGrenadeId === "string" ? safe.activeGrenadeId : DEFAULT_GRENADE_TYPE_ID;
  if (!(safe.activeGrenadeId in safe.grenadeInventory)) {
    safe.activeGrenadeId = DEFAULT_GRENADE_TYPE_ID;
  }
  syncLegacyGrenadeCount(safe);
  safe.c4Charges = Math.max(0, int(safe.c4Charges, 0));
  safe.nukes = Math.max(0, int(safe.nukes, 0));
  safe.bestWave = Math.max(0, int(safe.bestWave));
  safe.unlockedWeapons = normalizeStrings(safe.unlockedWeapons, ["pipe"]);
  safe.ownedWeapons = normalizeStrings(safe.ownedWeapons, ["pipe"]);
  safe.equippedWeaponId = typeof safe.equippedWeaponId === "string" ? safe.equippedWeaponId : "pipe";
  safe.pistolUnlocked = Boolean(safe.pistolUnlocked);
  safe.openedBuildings = normalizeStrings(safe.openedBuildings, []);
  safe.rescuedVillagers = normalizeStrings(safe.rescuedVillagers, []);
  safe.deadVillagers = normalizeStrings(safe.deadVillagers, []);
  safe.villageLevel = Math.max(1, int(safe.villageLevel, 1));
  if (safe.rescuedVillagers.length) {
    const rescuedSet = new Set(safe.rescuedVillagers);
    safe.deadVillagers = safe.deadVillagers.filter((id) => !rescuedSet.has(id));
  }
  safe.ownedArmors = normalizeStrings(safe.ownedArmors, ["cloth"]);
  safe.equippedArmorId = typeof safe.equippedArmorId === "string" ? safe.equippedArmorId : "cloth";
  safe.sensitivity = Math.max(0.05, Math.min(0.6, float(safe.sensitivity, 0.18)));
  safe.graphicsPreset = typeof safe.graphicsPreset === "string" ? safe.graphicsPreset : "desktop_high";

  const stats = safe.lifetimeStats && typeof safe.lifetimeStats === "object" ? safe.lifetimeStats : {};
  safe.lifetimeStats = {
    kills: Math.max(0, int(stats.kills)),
    damageDealt: Math.max(0, int(stats.damageDealt)),
    damageTaken: Math.max(0, int(stats.damageTaken)),
    villageDamageTaken: Math.max(0, int(stats.villageDamageTaken)),
    wavesCleared: Math.max(0, int(stats.wavesCleared)),
    playSeconds: Math.max(0, float(stats.playSeconds)),
  };

  if (!safe.unlockedWeapons.includes("pipe")) {
    safe.unlockedWeapons.unshift("pipe");
  }
  if (safe.pistolUnlocked) {
    if (!safe.unlockedWeapons.includes("pistol")) {
      safe.unlockedWeapons.push("pistol");
    }
  } else {
    safe.unlockedWeapons = safe.unlockedWeapons.filter((id) => id !== "pistol");
    safe.ownedWeapons = safe.ownedWeapons.filter((id) => id !== "pistol");
  }

  // Equippable weapons must be owned and unlocked. This prevents stale or injected
  // save data from exposing weapons that were never actually acquired.
  const unlockedSet = new Set(safe.unlockedWeapons);
  safe.ownedWeapons = safe.ownedWeapons.filter((id) => id === "pipe" || unlockedSet.has(id));
  if (!safe.ownedWeapons.includes("pipe")) {
    safe.ownedWeapons.unshift("pipe");
  }
  if (!safe.ownedWeapons.includes(safe.equippedWeaponId)) {
    safe.equippedWeaponId = "pipe";
  }
  if (!safe.ownedArmors.includes("cloth")) {
    safe.ownedArmors.unshift("cloth");
  }
  if (!safe.ownedArmors.includes(safe.equippedArmorId)) {
    safe.equippedArmorId = "cloth";
  }

  return safe;
}

function normalizeStrings(values, fallback) {
  if (!Array.isArray(values)) {
    return [...fallback];
  }
  const filtered = values.filter((value) => typeof value === "string");
  return filtered.length ? [...new Set(filtered)] : [...fallback];
}

export function loadFpsSave(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(FPS_SAVE_KEY);
    if (raw) {
      return sanitizeFpsSave(JSON.parse(raw));
    }
    // Intentional v1 -> v2 start-over behavior.
    const legacy = storage.getItem(LEGACY_FPS_SAVE_KEY);
    if (legacy) {
      return defaultFpsSave();
    }
    return defaultFpsSave();
  } catch {
    return defaultFpsSave();
  }
}

export function persistFpsSave(save, storage = globalThis.localStorage) {
  const safe = sanitizeFpsSave(save);
  storage.setItem(FPS_SAVE_KEY, JSON.stringify(safe));
  return safe;
}
