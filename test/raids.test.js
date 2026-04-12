import { describe, expect, it } from "vitest";
import waves from "../src/fps/config/waves_fps.json";
import { createWaveDefForIndex, WaveDirector3D } from "../src/fps/systems/waveDirector3D";
import { computeWaveDifficultyScalars } from "../src/fps/systems/enemyAi3D";

describe("wave budget/composition", () => {
  it("contains 12 escalating authored base waves", () => {
    expect(waves).toHaveLength(12);
    expect(waves[0].wave).toBe(1);
    expect(waves.at(-1).wave).toBe(12);
    expect(waves.at(-1).budget).toBeGreaterThan(waves[0].budget);
  });

  it("synthesizes harder endless waves beyond the authored list", () => {
    const authoredFinal = waves.at(-1);
    const wave13 = createWaveDefForIndex(waves, waves.length);
    const wave18 = createWaveDefForIndex(waves, waves.length + 5);

    expect(wave13.wave).toBe(13);
    expect(wave13.budget).toBeGreaterThan(authoredFinal.budget);
    expect(wave13.minAlive).toBeGreaterThanOrEqual(authoredFinal.minAlive);
    expect(wave13.spawnIntervalSec).toBeLessThan(authoredFinal.spawnIntervalSec);
    expect(wave13.spawnIntervalSec).toBeGreaterThanOrEqual(0.42);

    expect(wave18.wave).toBe(18);
    expect(wave18.boss).toBe(true);
    expect(wave18.budget).toBeGreaterThan(wave13.budget);
  });

  it("spawns up to budget over time", () => {
    const director = new WaveDirector3D(waves);
    director.startWave(0);

    let spawns = 0;
    for (let t = 0; t < 80; t += 0.5) {
      const update = director.update(0.5);
      spawns += update.spawnCount;
    }
    expect(spawns).toBeGreaterThan(0);
    expect(spawns).toBeLessThanOrEqual(waves[0].budget);
  });

  it("gets harder each wave via spawn pressure or enemy scaling", () => {
    for (let i = 1; i < waves.length; i += 1) {
      const prev = waves[i - 1];
      const curr = waves[i];
      const prevPressure = prev.budget / Math.max(0.001, prev.spawnIntervalSec);
      const currPressure = curr.budget / Math.max(0.001, curr.spawnIntervalSec);
      expect(currPressure).toBeGreaterThan(prevPressure);

      const prevScale = computeWaveDifficultyScalars(prev.wave);
      const currScale = computeWaveDifficultyScalars(curr.wave);
      expect(currScale.hp).toBeGreaterThan(prevScale.hp);
      expect(currScale.attack).toBeGreaterThan(prevScale.attack);
      expect(currScale.speed).toBeGreaterThan(prevScale.speed);
    }
  });

  it("defines rising minimum alive zombies per wave with 4-8 early floor", () => {
    expect(waves[0].minAlive).toBeGreaterThanOrEqual(4);
    expect(waves[4].minAlive).toBeGreaterThanOrEqual(8);
    for (let i = 1; i < waves.length; i += 1) {
      expect(waves[i].minAlive).toBeGreaterThan(waves[i - 1].minAlive);
    }
  });
});
