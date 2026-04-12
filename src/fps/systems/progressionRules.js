export function applyWaveClearProgression(save, clearedWave, economy = {}) {
  const unlockWave = Number(economy.pistolUnlockWave ?? 1);
  if (clearedWave < unlockWave || save.pistolUnlocked) {
    return { unlocked: false, save };
  }

  save.pistolUnlocked = true;
  if (!save.unlockedWeapons.includes("pistol")) {
    save.unlockedWeapons.push("pistol");
  }
  return { unlocked: true, save };
}

export function consumeGrenadeCount(currentGrenades) {
  return Math.max(0, Number(currentGrenades ?? 0) - 1);
}

export function buyGrenadePack({ coins, grenades, pack }) {
  if (!pack || coins < pack.cost) {
    return { coins, grenades, purchased: false };
  }
  return {
    coins: coins - pack.cost,
    grenades: grenades + pack.amount,
    purchased: true,
  };
}

export function shouldTriggerSecretBossPhase(clearedWave, totalWaves, alreadyTriggered) {
  void clearedWave;
  void totalWaves;
  void alreadyTriggered;
  return false;
}
