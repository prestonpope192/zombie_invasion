export const SAVE_KEY = "zombie_invasion_save_v1";
const SAVE_VERSION = 1;

export function defaultSave() {
  return {
    version: SAVE_VERSION,
    highestRaidCleared: 0,
    currentRaid: 1,
    coins: 0,
    villageBaseHp: 400,
    unlockedWeapons: ["bb_gun"],
    ownedWeapons: ["bb_gun"],
    equippedWeaponId: "bb_gun",
    grenades: 3,
    rpgAmmo: 0,
    lifetimeStats: {
      kills: 0,
      supersKilled: 0,
      bossesKilled: 0,
      raidsCleared: 0,
      coinsEarned: 0,
    },
  };
}

export function sanitizeSave(raw) {
  const base = defaultSave();
  if (!raw || typeof raw !== "object") {
    return base;
  }

  const safe = { ...base, ...raw };
  safe.version = SAVE_VERSION;
  safe.highestRaidCleared = Math.max(0, Number.parseInt(safe.highestRaidCleared ?? 0, 10) || 0);
  safe.currentRaid = Math.min(50, Math.max(1, Number.parseInt(safe.currentRaid ?? 1, 10) || 1));
  safe.coins = Math.max(0, Number.parseInt(safe.coins ?? 0, 10) || 0);
  safe.villageBaseHp = Math.max(300, Number.parseInt(safe.villageBaseHp ?? 400, 10) || 400);
  safe.unlockedWeapons = normalizeStringArray(safe.unlockedWeapons, base.unlockedWeapons);
  safe.ownedWeapons = normalizeStringArray(safe.ownedWeapons, base.ownedWeapons);
  safe.equippedWeaponId = typeof safe.equippedWeaponId === "string" ? safe.equippedWeaponId : "bb_gun";
  safe.grenades = Math.max(0, Number.parseInt(safe.grenades ?? 0, 10) || 0);
  safe.rpgAmmo = Math.max(0, Number.parseInt(safe.rpgAmmo ?? 0, 10) || 0);

  const stats = typeof safe.lifetimeStats === "object" && safe.lifetimeStats ? safe.lifetimeStats : {};
  safe.lifetimeStats = {
    kills: Math.max(0, Number.parseInt(stats.kills ?? 0, 10) || 0),
    supersKilled: Math.max(0, Number.parseInt(stats.supersKilled ?? 0, 10) || 0),
    bossesKilled: Math.max(0, Number.parseInt(stats.bossesKilled ?? 0, 10) || 0),
    raidsCleared: Math.max(0, Number.parseInt(stats.raidsCleared ?? 0, 10) || 0),
    coinsEarned: Math.max(0, Number.parseInt(stats.coinsEarned ?? 0, 10) || 0),
  };

  if (!safe.unlockedWeapons.includes("bb_gun")) {
    safe.unlockedWeapons.unshift("bb_gun");
  }
  if (!safe.ownedWeapons.includes("bb_gun")) {
    safe.ownedWeapons.unshift("bb_gun");
  }
  if (!safe.ownedWeapons.includes(safe.equippedWeaponId)) {
    safe.equippedWeaponId = "bb_gun";
  }
  return safe;
}

function normalizeStringArray(value, fallback) {
  if (!Array.isArray(value)) {
    return [...fallback];
  }
  const entries = value.filter((item) => typeof item === "string");
  return entries.length ? Array.from(new Set(entries)) : [...fallback];
}

export function loadSave(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) {
      return defaultSave();
    }
    return sanitizeSave(JSON.parse(raw));
  } catch {
    return defaultSave();
  }
}

export function persistSave(save, storage = globalThis.localStorage) {
  const safe = sanitizeSave(save);
  storage.setItem(SAVE_KEY, JSON.stringify(safe));
  return safe;
}

export function cloneSave(save) {
  return JSON.parse(JSON.stringify(save));
}
