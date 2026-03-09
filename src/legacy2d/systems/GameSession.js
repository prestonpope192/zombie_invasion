import { cloneSave, loadSave, persistSave } from "./saveSystem";
import {
  buyWeapon,
  canBuyConsumable,
  cycleOwnedWeapon,
  syncMilestoneUnlocks,
  villageHpForRaid,
} from "./progressionSystem";
import { getRaidDefinition } from "./waveSystem";

export class GameSession {
  constructor({ weapons, enemies, raids }) {
    this.weapons = weapons;
    this.weaponMap = new Map(weapons.map((weapon) => [weapon.id, weapon]));
    this.enemies = enemies;
    this.enemyMap = new Map(enemies.map((enemy) => [enemy.id, enemy]));
    this.raids = raids;
    this.save = loadSave();
    syncMilestoneUnlocks(this.save, this.weapons, this.save.currentRaid);
    this.pendingOpenShop = false;
    this.manualSave();
    this.resetRunState();
  }

  resetProgress() {
    localStorage.removeItem("zombie_invasion_save_v1");
    this.save = loadSave();
    this.resetRunState();
  }

  getWeapon(id) {
    return this.weaponMap.get(id) ?? this.weaponMap.get("bb_gun");
  }

  getOwnedWeapons() {
    return this.weapons.filter((weapon) => this.save.ownedWeapons.includes(weapon.id));
  }

  getEquippedWeapon() {
    return this.getWeapon(this.save.equippedWeaponId);
  }

  getCurrentRaidDefinition() {
    return getRaidDefinition(this.raids, this.save.currentRaid);
  }

  getRaidDefinition(raidNumber) {
    return getRaidDefinition(this.raids, raidNumber);
  }

  getVillageMaxHp(raidNumber = this.save.currentRaid) {
    return villageHpForRaid(raidNumber, this.save.villageBaseHp);
  }

  resetRunState() {
    this.run = {
      raidNumber: this.save.currentRaid,
      playerHp: 100,
      villageHp: this.getVillageMaxHp(this.save.currentRaid),
      raidCoins: 0,
      kills: 0,
      supersKilled: 0,
      bossKilled: 0,
      villageDamageTaken: 0,
      startedAt: Date.now(),
    };
  }

  beginRaid() {
    this.run.raidNumber = this.save.currentRaid;
    this.run.playerHp = 100;
    this.run.villageHp = this.getVillageMaxHp(this.save.currentRaid);
    this.run.raidCoins = 0;
    this.run.kills = 0;
    this.run.supersKilled = 0;
    this.run.bossKilled = 0;
    this.run.villageDamageTaken = 0;
    this.run.startedAt = Date.now();
  }

  addRaidCoins(amount) {
    this.run.raidCoins += amount;
  }

  consumeGrenade() {
    if (this.save.grenades <= 0) {
      return false;
    }
    this.save.grenades -= 1;
    return true;
  }

  consumeRpgAmmo() {
    if (this.save.rpgAmmo <= 0) {
      return false;
    }
    this.save.rpgAmmo -= 1;
    return true;
  }

  cycleWeapon(direction = 1) {
    this.save.equippedWeaponId = cycleOwnedWeapon(this.save.ownedWeapons, this.save.equippedWeaponId, direction);
    return this.getEquippedWeapon();
  }

  equipWeapon(id) {
    if (!this.save.ownedWeapons.includes(id)) {
      return false;
    }
    this.save.equippedWeaponId = id;
    return true;
  }

  buyWeapon(weaponId) {
    const weapon = this.getWeapon(weaponId);
    const result = buyWeapon(this.save, weapon, this.save.currentRaid);
    if (result.ok) {
      this.save.equippedWeaponId = weapon.id;
      this.manualSave();
    }
    return result;
  }

  buyConsumable(type) {
    if (type === "grenade_pack") {
      const cost = 90;
      if (!canBuyConsumable(this.save, cost)) {
        return { ok: false, reason: "NOT_ENOUGH_COINS" };
      }
      this.save.coins -= cost;
      this.save.grenades += 2;
      this.manualSave();
      return { ok: true, reason: "OK" };
    }
    if (type === "rpg_pack") {
      const cost = 170;
      if (!canBuyConsumable(this.save, cost)) {
        return { ok: false, reason: "NOT_ENOUGH_COINS" };
      }
      this.save.coins -= cost;
      this.save.rpgAmmo += 2;
      this.manualSave();
      return { ok: true, reason: "OK" };
    }
    return { ok: false, reason: "UNKNOWN_ITEM" };
  }

  onEnemyKilled(type, reward) {
    this.run.kills += 1;
    if (type === "super") {
      this.run.supersKilled += 1;
    }
    if (type === "boss") {
      this.run.bossKilled += 1;
    }
    this.addRaidCoins(reward);
  }

  applyVillageDamage(amount) {
    const applied = Math.min(this.run.villageHp, amount);
    this.run.villageHp -= applied;
    this.run.villageDamageTaken += applied;
    return applied;
  }

  raidRewards(raidNumber, raidDef) {
    const clearBonus = raidDef.clearBonus;
    const perfectBonus = this.run.villageDamageTaken === 0 ? raidDef.perfectDefenseBonus : 0;
    const coinsAwarded = this.run.raidCoins + clearBonus + perfectBonus;
    return { clearBonus, perfectBonus, coinsAwarded };
  }

  completeRaid(raidNumber) {
    const raidDef = this.getRaidDefinition(raidNumber);
    const rewards = this.raidRewards(raidNumber, raidDef);

    this.save.coins += rewards.coinsAwarded;
    this.save.lifetimeStats.kills += this.run.kills;
    this.save.lifetimeStats.supersKilled += this.run.supersKilled;
    this.save.lifetimeStats.bossesKilled += this.run.bossKilled;
    this.save.lifetimeStats.raidsCleared += 1;
    this.save.lifetimeStats.coinsEarned += rewards.coinsAwarded;

    this.save.highestRaidCleared = Math.max(this.save.highestRaidCleared, raidNumber);
    this.save.currentRaid = Math.min(50, raidNumber + 1);

    syncMilestoneUnlocks(this.save, this.weapons, this.save.currentRaid);
    this.manualSave();

    return {
      ...rewards,
      raidNumber,
      kills: this.run.kills,
      supersKilled: this.run.supersKilled,
      bossKilled: this.run.bossKilled,
      nextRaid: this.save.currentRaid,
      victory: raidNumber >= 50,
    };
  }

  failRaid() {
    this.run.playerHp = 100;
    this.run.villageHp = this.getVillageMaxHp(this.save.currentRaid);
    return {
      raidNumber: this.save.currentRaid,
      reason: "DEFEAT",
    };
  }

  manualSave() {
    this.save = persistSave(this.save);
    return cloneSave(this.save);
  }
}
