import { computeDiscountedCost } from "./villagerEscortRules";
import {
  DEFAULT_GRENADE_TYPE_ID,
  addGrenadeCount,
  getGrenadeCount,
  setActiveGrenadeId,
} from "./grenadeLoadout";

export function getWeaponShopState({ weapon, waveNumber, save, costMultiplier = 1 }) {
  const owned = save.ownedWeapons.includes(weapon.id);
  const equipped = save.equippedWeaponId === weapon.id;
  const waveLocked = waveNumber < weapon.unlockWave;
  const progressionLocked = weapon.id === "pistol" && !save.pistolUnlocked;
  const locked = waveLocked || progressionLocked;
  const cost = computeDiscountedCost(weapon.cost, costMultiplier);
  const cannotAfford = !owned && !equipped && save.coins < cost;
  const disabled = (locked || cannotAfford) && !owned && !equipped;

  let status = "Buy";
  if (equipped) {
    status = "Equipped";
  } else if (owned) {
    status = "Equip";
  } else if (progressionLocked) {
    status = "Clears Wave 1";
  } else if (locked) {
    status = `Unlocks Wave ${weapon.unlockWave}`;
  } else {
    status = `${cost} coins`;
  }

  return {
    owned,
    equipped,
    cost,
    waveLocked,
    progressionLocked,
    locked,
    cannotAfford,
    disabled,
    status,
  };
}

export function applyWeaponBuyOrEquip({ weapon, waveNumber, save, costMultiplier = 1 }) {
  const state = getWeaponShopState({ weapon, waveNumber, save, costMultiplier });
  if (state.equipped) {
    return { changed: false, action: "none" };
  }
  if (state.owned) {
    save.equippedWeaponId = weapon.id;
    return { changed: true, action: "equip" };
  }
  if (state.locked || save.coins < state.cost) {
    return { changed: false, action: "none" };
  }
  save.coins -= state.cost;
  if (!save.ownedWeapons.includes(weapon.id)) {
    save.ownedWeapons.push(weapon.id);
  }
  if (!save.unlockedWeapons.includes(weapon.id)) {
    save.unlockedWeapons.push(weapon.id);
  }
  save.equippedWeaponId = weapon.id;
  return { changed: true, action: "buy" };
}

export function getGrenadePackShopState({ pack, waveNumber = 1, save, costMultiplier = 1 }) {
  if (!pack) {
    return {
      grenadeTypeId: DEFAULT_GRENADE_TYPE_ID,
      cost: 0,
      ownedCount: 0,
      waveLocked: false,
      cannotAfford: false,
      disabled: true,
      status: "Unavailable",
    };
  }
  const grenadeTypeId = pack.grenadeTypeId ?? DEFAULT_GRENADE_TYPE_ID;
  const cost = computeDiscountedCost(pack.cost, costMultiplier);
  const unlockWave = Math.max(0, Math.round(Number(pack.unlockWave ?? 0)));
  const waveLocked = unlockWave > 0 && waveNumber < unlockWave;
  const cannotAfford = (save?.coins ?? 0) < cost;
  return {
    grenadeTypeId,
    cost,
    unlockWave,
    ownedCount: getGrenadeCount(save, grenadeTypeId),
    waveLocked,
    cannotAfford,
    disabled: waveLocked || cannotAfford,
    status: waveLocked ? `Unlocks Wave ${unlockWave}` : `${cost} coins`,
  };
}

export function applyGrenadePackBuy({ pack, waveNumber = 1, save, costMultiplier = 1 }) {
  const state = getGrenadePackShopState({ pack, waveNumber, save, costMultiplier });
  if (state.disabled) {
    return { changed: false };
  }
  save.coins -= state.cost;
  addGrenadeCount(save, state.grenadeTypeId, pack.amount);
  if (state.grenadeTypeId !== DEFAULT_GRENADE_TYPE_ID) {
    setActiveGrenadeId(save, state.grenadeTypeId);
  }
  return { changed: true };
}

export function getGearShopState({ gear, waveNumber = 1, save, costMultiplier = 1 } = {}) {
  if (!gear?.id) {
    return {
      owned: false,
      cost: 0,
      unlockWave: 1,
      waveLocked: false,
      cannotAfford: false,
      disabled: true,
      status: "Unavailable",
    };
  }
  const ownedGear = Array.isArray(save?.ownedGear) ? save.ownedGear : [];
  const owned = ownedGear.includes(gear.id);
  const cost = computeDiscountedCost(gear.cost, costMultiplier);
  const unlockWave = Math.max(1, Math.round(Number(gear.unlockWave ?? 1)));
  const waveLocked = waveNumber < unlockWave;
  const cannotAfford = !owned && (save?.coins ?? 0) < cost;
  let status = `${cost} coins`;
  if (owned) {
    status = "Owned";
  } else if (waveLocked) {
    status = `Unlocks Wave ${unlockWave}`;
  }
  return {
    owned,
    cost,
    unlockWave,
    waveLocked,
    cannotAfford,
    disabled: !owned && (waveLocked || cannotAfford),
    status,
  };
}

export function applyGearBuy({ gear, waveNumber = 1, save, costMultiplier = 1 } = {}) {
  const state = getGearShopState({ gear, waveNumber, save, costMultiplier });
  if (state.owned || state.disabled) {
    return { changed: false };
  }
  save.coins -= state.cost;
  if (!Array.isArray(save.ownedGear)) {
    save.ownedGear = [];
  }
  save.ownedGear.push(gear.id);
  save.ownedGear = [...new Set(save.ownedGear)];
  return { changed: true };
}

export function getArmorShopState({ armor, save, costMultiplier = 1 }) {
  const owned = save.ownedArmors.includes(armor.id);
  const equipped = save.equippedArmorId === armor.id;
  const cost = computeDiscountedCost(armor.cost, costMultiplier);
  let status = "Buy";
  if (equipped) {
    status = "Equipped";
  } else if (owned) {
    status = "Equip";
  } else {
    status = `${cost} coins`;
  }

  return {
    owned,
    equipped,
    cost,
    disabled: !owned && save.coins < cost,
    status,
  };
}

export function applyArmorBuyOrEquip({ armor, save, costMultiplier = 1 }) {
  const state = getArmorShopState({ armor, save, costMultiplier });
  if (state.equipped) {
    return { changed: false, action: "none" };
  }
  if (state.owned) {
    save.equippedArmorId = armor.id;
    return { changed: true, action: "equip" };
  }
  if (save.coins < state.cost) {
    return { changed: false, action: "none" };
  }
  save.coins -= state.cost;
  if (!save.ownedArmors.includes(armor.id)) {
    save.ownedArmors.push(armor.id);
  }
  save.equippedArmorId = armor.id;
  return { changed: true, action: "buy" };
}

function resolveVillageUpgradeConfig(economy) {
  const raw = economy?.villageUpgrade ?? {};
  const maxLevel = Math.max(1, Math.round(Number(raw.maxLevel ?? 8)));
  const hpPerLevel = Math.max(0, Number(raw.hpPerLevel ?? 0.08));
  const baseCost = Math.max(1, Math.round(Number(raw.baseCost ?? 180)));
  const costGrowth = Math.max(1, Number(raw.costGrowth ?? 1.45));
  return {
    label: typeof raw.label === "string" && raw.label ? raw.label : "Town Defenses",
    maxLevel,
    hpPerLevel,
    baseCost,
    costGrowth,
  };
}

function getVillageLevel(save) {
  const parsed = Math.round(Number(save?.villageLevel ?? 1));
  return Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
}

export function getVillageLevelHpMultiplier({ save, economy } = {}) {
  const config = resolveVillageUpgradeConfig(economy);
  const level = Math.min(getVillageLevel(save), config.maxLevel);
  return 1 + (level - 1) * config.hpPerLevel;
}

export function getVillageUpgradeState({ save, economy, costMultiplier = 1 } = {}) {
  const config = resolveVillageUpgradeConfig(economy);
  const level = Math.min(getVillageLevel(save), config.maxLevel);
  const atMax = level >= config.maxLevel;
  const nextLevel = atMax ? level : level + 1;
  const baseCost = atMax ? 0 : Math.round(config.baseCost * Math.pow(config.costGrowth, Math.max(0, level - 1)));
  const cost = atMax ? 0 : computeDiscountedCost(baseCost, costMultiplier);
  const disabled = atMax || (save?.coins ?? 0) < cost;
  const hpBonusPercent = Math.round((getVillageLevelHpMultiplier({ save: { villageLevel: level }, economy }) - 1) * 100);
  const nextHpBonusPercent = atMax
    ? hpBonusPercent
    : Math.round((getVillageLevelHpMultiplier({ save: { villageLevel: nextLevel }, economy }) - 1) * 100);

  return {
    label: config.label,
    level,
    nextLevel,
    maxLevel: config.maxLevel,
    hpBonusPercent,
    nextHpBonusPercent,
    atMax,
    cost,
    disabled,
    status: atMax ? "Maxed" : `${cost} coins`,
  };
}

export function applyVillageUpgradePurchase({ save, economy, costMultiplier = 1 } = {}) {
  const state = getVillageUpgradeState({ save, economy, costMultiplier });
  if (state.atMax || (save?.coins ?? 0) < state.cost) {
    return { changed: false };
  }
  save.coins -= state.cost;
  save.villageLevel = state.nextLevel;
  return { changed: true };
}

export function getMedKitShopState({ save, currentHp, maxHp = 100, cost = 20 } = {}) {
  const safeMaxHp = Math.max(1, Number(maxHp) || 100);
  const hp = Math.max(0, Math.min(safeMaxHp, Number(currentHp) || 0));
  const safeCost = Math.max(0, Math.round(Number(cost) || 20));
  const atFullHealth = hp >= safeMaxHp - 0.001;
  const cannotAfford = (save?.coins ?? 0) < safeCost;
  return {
    cost: safeCost,
    atFullHealth,
    cannotAfford,
    disabled: atFullHealth || cannotAfford,
    status: atFullHealth ? "Full Health" : `${safeCost} coins`,
  };
}

export function applyMedKitBuy({ save, currentHp, maxHp = 100, cost = 20 } = {}) {
  const state = getMedKitShopState({ save, currentHp, maxHp, cost });
  if (state.disabled) {
    return { changed: false, newHp: Math.max(0, Math.min(maxHp, Number(currentHp) || 0)) };
  }
  save.coins -= state.cost;
  return { changed: true, newHp: Math.max(1, Number(maxHp) || 100) };
}
