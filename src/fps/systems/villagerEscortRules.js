const BASE_PERK_MODIFIERS = {
  startingGrenadesBonus: 0,
  killCoinMultiplier: 1,
  shopCostMultiplier: 1,
  villageHpMultiplier: 1,
  damageReductionBonus: 0,
  grenadeCooldownMultiplier: 1,
};

export const VILLAGER_PERK_DEFS = {
  villager_house_a: {
    label: "Grenadier Reserve",
    summary: "+2 starting grenades each run",
    apply(modifiers) {
      modifiers.startingGrenadesBonus += 2;
    },
  },
  villager_house_b: {
    label: "Bounty Ledger",
    summary: "+10% kill coin rewards",
    apply(modifiers) {
      modifiers.killCoinMultiplier *= 1.1;
    },
  },
  villager_blacksmith: {
    label: "Blacksmith Discount",
    summary: "10% shop discount",
    apply(modifiers) {
      modifiers.shopCostMultiplier *= 0.9;
    },
  },
  villager_townhall: {
    label: "Fortified Town Hall",
    summary: "+15% max village HP",
    apply(modifiers) {
      modifiers.villageHpMultiplier *= 1.15;
    },
  },
  villager_chapel: {
    label: "Chapel Ward",
    summary: "+0.06 player damage resist",
    apply(modifiers) {
      modifiers.damageReductionBonus += 0.06;
    },
  },
  villager_barn: {
    label: "Barn Grenadier Rig",
    summary: "-20% grenade cooldown",
    apply(modifiers) {
      modifiers.grenadeCooldownMultiplier *= 0.8;
    },
  },
};

export function getVillagerPerkModifiers(save) {
  const rescued = Array.isArray(save?.rescuedVillagers) ? save.rescuedVillagers : [];
  const modifiers = { ...BASE_PERK_MODIFIERS };
  for (const villagerId of rescued) {
    const def = VILLAGER_PERK_DEFS[villagerId];
    if (!def?.apply) {
      continue;
    }
    def.apply(modifiers);
  }
  return modifiers;
}

export function isVillagerAvailable(save, villagerId) {
  if (typeof villagerId !== "string" || !villagerId) {
    return false;
  }
  const rescued = Array.isArray(save?.rescuedVillagers) ? save.rescuedVillagers : [];
  if (rescued.includes(villagerId)) {
    return false;
  }
  const dead = Array.isArray(save?.deadVillagers) ? save.deadVillagers : [];
  return !dead.includes(villagerId);
}

export function computeEscortDamage(dt, attackerCount, damagePerSec, maxAttackers) {
  const tick = Math.max(0, Number(dt) || 0);
  const dps = Math.max(0, Number(damagePerSec) || 0);
  const cap = Math.max(0, Number(maxAttackers) || 0);
  const attackers = THREEClamp(Math.max(0, Number(attackerCount) || 0), 0, cap);
  return attackers * dps * tick;
}

export function computeEscortFollowTarget(playerPosition, yaw, followOffset, minHeight = 1.2) {
  const playerX = Number(playerPosition?.x) || 0;
  const playerY = Number(playerPosition?.y) || 0;
  const playerZ = Number(playerPosition?.z) || 0;
  const angle = Number(yaw) || 0;
  const offsetX = Number(followOffset?.x) || 0;
  const offsetZ = Number(followOffset?.z) || 0;
  const forwardX = Math.sin(angle);
  const forwardZ = -Math.cos(angle);
  const rightX = Math.cos(angle);
  const rightZ = Math.sin(angle);
  return {
    x: playerX + rightX * offsetX - forwardX * offsetZ,
    y: Math.max(minHeight, playerY),
    z: playerZ + rightZ * offsetX - forwardZ * offsetZ,
  };
}

export function computeDiscountedCost(cost, multiplier = 1) {
  const baseCost = Math.max(0, Number(cost) || 0);
  const safeMultiplier = Math.max(0, Number(multiplier) || 0);
  return Math.floor(baseCost * safeMultiplier + 1e-6);
}

function THREEClamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
