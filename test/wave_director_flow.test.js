import { describe, expect, it } from "vitest";
import { WaveDirector3D } from "../src/fps/systems/waveDirector3D";

const waves = [
  { wave: 1, durationSec: 2, budget: 2, spawnIntervalSec: 0.5, composition: { walker: 1 }, boss: false },
  { wave: 2, durationSec: 2, budget: 2, spawnIntervalSec: 0.5, composition: { walker: 1 }, boss: false },
];

describe("wave director flow", () => {
  it("blocks spawns during intermission and resumes after timer", () => {
    const director = new WaveDirector3D(waves);
    director.startWave(0);

    director.beginIntermission(1.0);
    expect(director.isIntermission()).toBe(true);
    expect(director.update(0.4).spawnCount).toBe(0);
    expect(director.update(0.5).spawnCount).toBe(0);
    expect(director.isIntermission()).toBe(true);

    director.update(0.2);
    expect(director.isIntermission()).toBe(false);
    expect(director.update(0.5).spawnCount).toBeGreaterThan(0);
  });

  it("advances waves and marks mission complete at the end", () => {
    const director = new WaveDirector3D(waves);
    director.startWave(0);
    expect(director.advanceWave()).toEqual({ finished: false, waveNumber: 2 });
    expect(director.isIntermission()).toBe(true);

    const final = director.advanceWave();
    expect(final).toEqual({ finished: true, waveNumber: 2 });
    expect(director.update(0.1)).toEqual({
      spawnCount: 0,
      waveEnded: false,
      missionComplete: true,
    });
  });
});
