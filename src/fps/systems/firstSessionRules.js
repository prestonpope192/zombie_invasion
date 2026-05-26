import { getGrenadeCount } from "./grenadeLoadout";
import { computeDiscountedCost } from "./villagerEscortRules";

const ENEMY_INTROS = {
  runner: "Runner spotted: fast and fragile. Backpedal and drop it before it reaches melee range.",
  skitter: "Skitter spotted: it dodges across your aim. Sweep bursts instead of chasing the crosshair.",
  leaper: "Leaper spotted: it jumps the lane. Keep distance and punish it after the landing.",
  brute: "Brute spotted: slow but tough. Use grenades or sustained fire before it reaches the village.",
  pouncer: "Pouncer spotted: it chains faster jumps. Move sideways when it crouches.",
  armored: "Armored zombie spotted: body shots are weak. Aim high or use explosives.",
  flyer: "Banshee flyer spotted: airborne threats slip past barricades. Track the glow, then fire.",
  revenant: "Revenant spotted: a faster airborne threat. Prioritize it before it reaches the village.",
  juggernaut: "Juggernaut spotted: do not trade hits. Kite it and spend explosives.",
  zombie_chicken: "Zombie chicken spotted: tiny and quick. Sweep low before it swarms your feet.",
  zombie_pig: "Zombie pig spotted: low, fast pressure. Use short bursts down the lane.",
  zombie_cow: "Zombie cow spotted: heavy village damage. Stop it before it reaches buildings.",
  zombie_horse: "Zombie horse spotted: fast and tall. Keep moving while you focus it down.",
  mega_zombie: "Mega zombie spotted: a wave breaker. Save explosives for this target.",
  mini_boss: "Mini boss spotted: burn cooldowns, keep distance, and hold the village line.",
};

export function getEnemyIntroMessage(type, label = "Zombie") {
  if (ENEMY_INTROS[type]) {
    return ENEMY_INTROS[type];
  }
  return `${label} spotted: learn its movement, then keep it off the village line.`;
}

export function getIntroducedEnemyTypesForWave(waveDefs = [], waveNumber = 1) {
  const index = Math.max(0, Math.round(Number(waveNumber) || 1) - 1);
  const current = waveDefs[index]?.composition ?? {};
  const previousTypes = new Set();
  for (let i = 0; i < index; i += 1) {
    for (const type of Object.keys(waveDefs[i]?.composition ?? {})) {
      previousTypes.add(type);
    }
  }
  return Object.keys(current).filter((type) => !previousTypes.has(type));
}

export function getNextWaveThreatBrief({ clearedWave = 1, waveDefs = [], enemyMap = new Map() } = {}) {
  const nextWaveNumber = Math.max(1, Math.round(Number(clearedWave) || 1) + 1);
  const introduced = getIntroducedEnemyTypesForWave(waveDefs, nextWaveNumber);
  if (!introduced.length) {
    return null;
  }
  const type = introduced[0];
  const enemy = enemyMap instanceof Map ? enemyMap.get(type) : null;
  const label = enemy?.label ?? type;
  return {
    wave: nextWaveNumber,
    type,
    label,
    message: getEnemyIntroMessage(type, label),
  };
}

function findAffordableWeapon({ weapons = [], save, waveNumber, costMultiplier, preferredIds = [] }) {
  for (const id of preferredIds) {
    const weapon = weapons.find((entry) => entry.id === id);
    if (!weapon || save.ownedWeapons?.includes(weapon.id)) {
      continue;
    }
    if (weapon.id === "pistol" && !save.pistolUnlocked) {
      continue;
    }
    if (waveNumber < weapon.unlockWave) {
      continue;
    }
    const cost = computeDiscountedCost(weapon.cost, costMultiplier);
    if ((save.coins ?? 0) >= cost) {
      return { weapon, cost };
    }
  }
  return null;
}

export function getFirstSessionShopRecommendation({
  save,
  waveNumber = 1,
  weapons = [],
  economy = {},
  currentHp = 100,
  costMultiplier = 1,
} = {}) {
  const coins = Math.max(0, Number(save?.coins ?? 0) || 0);
  const medKitCost = Math.max(0, Math.round(Number(economy?.medKit?.cost ?? 20)));
  if (currentHp < 70 && coins >= computeDiscountedCost(medKitCost, costMultiplier)) {
    return {
      targetType: "medkit",
      targetId: "medkit",
      title: "Recommended: heal before the next wave",
      reason: "Low health makes the next mistake end the run.",
    };
  }

  const earlyWeapon = findAffordableWeapon({
    weapons,
    save,
    waveNumber,
    costMultiplier,
    preferredIds: ["pistol", "revolver", "smg"],
  });
  if (earlyWeapon) {
    return {
      targetType: "weapon",
      targetId: earlyWeapon.weapon.id,
      title: `Recommended: buy ${earlyWeapon.weapon.label}`,
      reason: "A ranged weapon makes the early waves feel fair instead of frantic.",
    };
  }

  const gearItems = Array.isArray(economy?.gearItems) ? economy.gearItems : [];
  const ownedGear = Array.isArray(save?.ownedGear) ? save.ownedGear : [];
  const flashlight = gearItems.find((entry) => entry.id === "flashlight");
  if (flashlight && waveNumber >= (flashlight.unlockWave ?? 1) && !ownedGear.includes("flashlight")) {
    const cost = computeDiscountedCost(flashlight.cost, costMultiplier);
    if (coins >= cost) {
      return {
        targetType: "gear",
        targetId: "flashlight",
        title: "Recommended: buy the Flashlight",
        reason: "The next lanes are darker; visibility is survivability.",
      };
    }
  }

  const fragCount = getGrenadeCount(save, "frag");
  const smallPack = (economy?.grenadePacks ?? []).find((entry) => entry.id === "grenade_pack_small");
  if (smallPack && fragCount <= 1) {
    const cost = computeDiscountedCost(smallPack.cost, costMultiplier);
    if (coins >= cost) {
      return {
        targetType: "pack",
        targetId: smallPack.id,
        title: "Recommended: restock Frag grenades",
        reason: "Grenades are the fastest answer to clustered early threats.",
      };
    }
  }

  const leather = (economy?.armorUpgrades ?? []).find((entry) => entry.id === "leather");
  if (leather && !(save?.ownedArmors ?? []).includes("leather")) {
    const cost = computeDiscountedCost(leather.cost, costMultiplier);
    if (coins >= cost) {
      return {
        targetType: "armor",
        targetId: leather.id,
        title: "Recommended: buy Leather Armor",
        reason: "A small damage cushion buys time while you learn new enemy types.",
      };
    }
  }

  return {
    targetType: "village",
    targetId: "village-upgrade",
    title: "Recommended: reinforce the village",
    reason: "Town defenses extend the run when threats slip past you.",
  };
}

export function getRunMotivation({ victory = false, waveReached = 0, bestWave = 0 } = {}) {
  if (victory) {
    return "Next goal: start an endless push and see how long the village holds.";
  }
  const wave = Math.max(0, Math.round(Number(waveReached) || 0));
  const best = Math.max(0, Math.round(Number(bestWave) || 0));
  if (wave <= 1 && best <= 1) {
    return "Next goal: clear Wave 1, open the shop, and buy your first gun.";
  }
  if (best > wave) {
    return `Next goal: get back to your best run, Wave ${best}.`;
  }
  return `Next goal: reach Wave ${Math.max(2, wave + 1)} with the village still standing.`;
}
