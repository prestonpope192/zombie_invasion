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
    return this.waveDefs[this.waveIndex] ?? null;
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
    if (this.waveIndex >= this.waveDefs.length) {
      this.finished = true;
      return { finished: true, waveNumber: this.waveDefs.length };
    }
    this.beginIntermission(16);
    return {
      finished: false,
      waveNumber: this.waveDefs[this.waveIndex].wave,
    };
  }

  isIntermission() {
    return this.inIntermission;
  }
}
