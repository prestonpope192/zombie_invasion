import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MUSIC_CUES } from "../src/fps/systems/musicDirector";

const PUBLIC_ROOT = join(process.cwd(), "public");
const RUNTIME_MUSIC_MIN_BYTES = 500_000;

function publicPathForCue(cue) {
  return join(PUBLIC_ROOT, cue.src.replace(/^\//, ""));
}

function readMusicAsset(relativePath) {
  return readFileSync(join(PUBLIC_ROOT, relativePath));
}

function expectMp3File(path) {
  const buffer = readFileSync(path);
  const id3Header = buffer.subarray(0, 3).toString("ascii") === "ID3";
  const frameSync = buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;

  expect(buffer.length).toBeGreaterThan(RUNTIME_MUSIC_MIN_BYTES);
  expect(id3Header || frameSync).toBe(true);
}

describe("runtime music assets", () => {
  it("ships playable MP3 files for every adaptive music cue", () => {
    for (const cue of Object.values(MUSIC_CUES)) {
      expect(cue.src).toMatch(/^\/audio\/music\/.+\.mp3$/);
      expectMp3File(publicPathForCue(cue));
    }
  });

  it("preserves the generated soundtrack pressure-band remap", () => {
    const raidLow = readMusicAsset("audio/music/raid_low.mp3");
    const raidMid = readMusicAsset("audio/music/raid_mid.mp3");
    const raidHigh = readMusicAsset("audio/music/raid_high.mp3");
    const boss = readMusicAsset("audio/music/boss_battle.mp3");

    expect(Buffer.compare(raidLow, raidMid)).not.toBe(0);
    expect(Buffer.compare(raidMid, raidHigh)).not.toBe(0);
    expect(Buffer.compare(raidHigh, boss)).toBe(0);
  });

  it("keeps motif and alternate shop renders as reference-only assets", () => {
    const runtimeFilenames = new Set(
      Object.values(MUSIC_CUES).map((cue) => cue.src.split("/").at(-1)),
    );

    for (const filename of ["main_motif.mp3", "shop_intermission_alt.mp3"]) {
      const path = join(PUBLIC_ROOT, "audio/music", filename);
      expect(statSync(path).size).toBeGreaterThan(RUNTIME_MUSIC_MIN_BYTES);
      expect(runtimeFilenames.has(filename)).toBe(false);
    }
  });
});
