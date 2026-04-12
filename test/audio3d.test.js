import { describe, expect, it, vi } from "vitest";
import { Audio3D, WEAPON_AUDIO_PROFILES, createWaveMusicProfile } from "../src/fps/systems/audio3d";

describe("weapon audio profiles", () => {
  it("plays every configured layer for the selected weapon", () => {
    const audio = new Audio3D(null);
    const playTone = vi.spyOn(audio, "playTone").mockImplementation(() => {});
    const position = { x: 1, y: 2, z: 3 };

    audio.playWeapon("revolver", position);

    expect(playTone).toHaveBeenCalledTimes(WEAPON_AUDIO_PROFILES.revolver.layers.length);
    for (const [index, layer] of WEAPON_AUDIO_PROFILES.revolver.layers.entries()) {
      expect(playTone).toHaveBeenNthCalledWith(index + 1, expect.objectContaining({ ...layer, position }));
    }
  });

  it("keeps similar weapon classes acoustically distinct", () => {
    const signature = (weaponId) =>
      WEAPON_AUDIO_PROFILES[weaponId].layers
        .map(({ freq, freqEnd, duration, type }) => `${freq}:${freqEnd}:${duration}:${type}`)
        .join("|");

    expect(signature("smg")).not.toBe(signature("machine_pistol"));
    expect(signature("rifle")).not.toBe(signature("battle_rifle"));
    expect(signature("rpg")).not.toBe(signature("grenade_launcher"));
    expect(WEAPON_AUDIO_PROFILES.flamethrower.layers).toHaveLength(3);
  });
});

describe("wave music profiles", () => {
  it("escalates gradually while staying restrained", () => {
    const wave1 = createWaveMusicProfile(1);
    const wave8 = createWaveMusicProfile(8);
    const wave12 = createWaveMusicProfile(12);

    expect(wave8.pulseIntervalMs).toBeLessThan(wave1.pulseIntervalMs);
    expect(wave12.padGain).toBeGreaterThan(wave1.padGain);
    expect(wave12.pulseGain).toBeGreaterThan(wave1.pulseGain);
    expect(wave12.pulseGain).toBeLessThan(0.006);
    expect(wave12.shimmerGain).toBeLessThan(0.004);
  });

  it("gives each authored wave a distinct music signature", () => {
    const signature = (waveNumber) => {
      const profile = createWaveMusicProfile(waveNumber);
      return [
        profile.rootFreq,
        profile.padIntervalMs,
        profile.pulseIntervalMs,
        profile.padChord.map((note) => note.toFixed(2)).join(","),
        profile.pulseNotes.map((note) => note.toFixed(2)).join(","),
      ].join("|");
    };

    const authoredWaveSignatures = new Set(Array.from({ length: 12 }, (_, index) => signature(index + 1)));
    expect(authoredWaveSignatures.size).toBe(12);
  });
});
