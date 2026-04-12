const ENDLESS_BOSS_INTERVAL = 6;
const ENDLESS_INTERMISSION_SEC = 16;
const ENDLESS_SPAWN_INTERVAL_FLOOR = 0.42;

function scaleEndlessComposition(baseComposition, extraWaveCount) {
  const growthByEnemy = {
    walker: 0.008,
    runner: 0.022,
    skitter: 0.026,
    leaper: 0.028,
    pouncer: 0.03,
    brute: 0.024,
    armored: 0.03,
    flyer: 0.032,
    revenant: 0.034,
    juggernaut: 0.038,
    zombie_chicken: 0.02,
    zombie_pig: 0.022,
    zombie_cow: 0.026,
    zombie_horse: 0.03,
  };

  return Object.fromEntries(
    Object.entries(baseComposition).map(([enemyId, weight]) => {
      const growth = growthByEnemy[enemyId] ?? 0.02;
      const nextWeight = Math.max(0.05, Number(weight) * (1 + extraWaveCount * growth));
      return [enemyId, Number(nextWeight.toFixed(3))];
    }),
  );
}

export function createWaveDefForIndex(waveDefs, index) {
  if (index < waveDefs.length) {
    return waveDefs[index] ?? null;
  }

  const base = waveDefs.at(-1);
  if (!base) {
    return null;
  }

  const waveNumber = index + 1;
  const extraWaveCount = waveNumber - Number(base.wave ?? waveDefs.length);
  const boss = waveNumber % ENDLESS_BOSS_INTERVAL === 0;
  const budget = Math.max(1, Math.round(Number(base.budget ?? 1) + extraWaveCount * 2 + (boss ? 2 : 0)));
  const minAlive = Math.min(
    budget - (boss ? 1 : 0),
    Math.max(Number(base.minAlive ?? 0), Math.round(Number(base.minAlive ?? 0) + extraWaveCount * 1.15)),
  );
  const megaCount = Math.min(
    Math.max(0, budget - (boss ? 1 : 0)),
    Math.round(Number(base.megaCount ?? 0) + extraWaveCount * 0.45 + (boss ? 1 : 0)),
  );

  return {
    ...base,
    wave: waveNumber,
    durationSec: Math.min(140, Math.round(Number(base.durationSec ?? 60) + extraWaveCount * 2)),
    budget,
    spawnIntervalSec: Math.max(
      ENDLESS_SPAWN_INTERVAL_FLOOR,
      Number((Number(base.spawnIntervalSec ?? 1) - extraWaveCount * 0.018).toFixed(3)),
    ),
    megaCount,
    boss,
    minAlive,
    composition: scaleEndlessComposition(base.composition ?? {}, extraWaveCount),
  };
}

export class WaveDirector3D {
  constructor(waveDefs) {
    this.waveDefs = waveDefs;
    this.reset();
  }

  reset() {
    this.waveIndex = 0;
    this.waveElapsed = 0;
    this.spawnElapsed = 0;
    this.spawnedBudget = 0;
    this.inIntermission = false;
    this.intermissionSec = 0;
    this.finished = false;
  }

  get currentWave() {
    return createWaveDefForIndex(this.waveDefs, this.waveIndex);
  }

  get waveNumber() {
    return this.currentWave?.wave ?? 0;
  }

  startWave(index = 0) {
    this.waveIndex = index;
    this.waveElapsed = 0;
    this.spawnElapsed = 0;
    this.spawnedBudget = 0;
    this.inIntermission = false;
    this.intermissionSec = 0;
    this.finished = false;
  }

  beginIntermission(seconds = 18) {
    this.inIntermission = true;
    this.intermissionSec = seconds;
  }

  update(dt) {
    if (this.finished) {
      return { spawnCount: 0, waveEnded: false, missionComplete: true };
    }

    if (this.inIntermission) {
      this.intermissionSec -= dt;
      if (this.intermissionSec <= 0) {
        this.inIntermission = false;
        this.waveElapsed = 0;
        this.spawnElapsed = 0;
        this.spawnedBudget = 0;
      }
      return { spawnCount: 0, waveEnded: false, missionComplete: false };
    }

    const wave = this.currentWave;
    if (!wave) {
      this.finished = true;
      return { spawnCount: 0, waveEnded: false, missionComplete: true };
    }

    this.waveElapsed += dt;
    this.spawnElapsed += dt;

    let spawnCount = 0;
    while (this.spawnElapsed >= wave.spawnIntervalSec && this.spawnedBudget < wave.budget) {
      this.spawnElapsed -= wave.spawnIntervalSec;
      this.spawnedBudget += 1;
      spawnCount += 1;
    }

    const waveEnded = this.waveElapsed >= wave.durationSec && this.spawnedBudget >= wave.budget;

    return {
      spawnCount,
      waveEnded,
      missionComplete: false,
      bossWave: wave.boss,
      budgetLeft: Math.max(0, wave.budget - this.spawnedBudget),
      wave,
    };
  }

  advanceWave() {
    this.waveIndex += 1;
    this.finished = false;
    this.beginIntermission(ENDLESS_INTERMISSION_SEC);
    return {
      finished: false,
      waveNumber: this.currentWave?.wave ?? this.waveIndex + 1,
    };
  }

  isIntermission() {
    return this.inIntermission;
  }
}
