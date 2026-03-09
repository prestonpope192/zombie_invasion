export function villageHpForRaid(raidNumber, baseHp = 400) {
  const raid = Math.max(1, Number.parseInt(raidNumber ?? 1, 10) || 1);
  const bonusSteps = Math.floor((raid - 1) / 10);
  return baseHp + bonusSteps * 50;
}

export function syncMilestoneUnlocks(save, weapons, raidNumber = save.currentRaid) {
  for (const weapon of weapons) {
    if (weapon.unlockRaid <= raidNumber && !save.unlockedWeapons.includes(weapon.id)) {
      save.unlockedWeapons.push(weapon.id);
    }
  }
}

export function canBuyWeapon(save, weapon, currentRaid) {
  if (!weapon) {
    return { ok: false, reason: "UNKNOWN_WEAPON" };
  }
  if (save.ownedWeapons.includes(weapon.id)) {
    return { ok: false, reason: "ALREADY_OWNED" };
  }
  if (currentRaid < weapon.unlockRaid) {
    return { ok: false, reason: "RAID_LOCKED" };
  }
  if (save.coins < weapon.cost) {
    return { ok: false, reason: "NOT_ENOUGH_COINS" };
  }
  return { ok: true, reason: "OK" };
}

export function buyWeapon(save, weapon, currentRaid) {
  const gate = canBuyWeapon(save, weapon, currentRaid);
  if (!gate.ok) {
    return { ok: false, reason: gate.reason, save };
  }
  save.coins -= weapon.cost;
  save.ownedWeapons.push(weapon.id);
  if (!save.unlockedWeapons.includes(weapon.id)) {
    save.unlockedWeapons.push(weapon.id);
  }
  if (!save.equippedWeaponId) {
    save.equippedWeaponId = weapon.id;
  }
  return { ok: true, reason: "OK", save };
}

export function canBuyConsumable(save, cost) {
  return save.coins >= cost;
}

export function cycleOwnedWeapon(ownedWeapons, currentWeaponId, direction = 1) {
  if (!ownedWeapons.length) {
    return currentWeaponId;
  }
  const currentIndex = Math.max(0, ownedWeapons.indexOf(currentWeaponId));
  const next = (currentIndex + direction + ownedWeapons.length) % ownedWeapons.length;
  return ownedWeapons[next];
}
