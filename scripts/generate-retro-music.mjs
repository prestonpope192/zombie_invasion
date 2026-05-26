import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = join(ROOT, "public/audio/music");
const TMP_DIR = join(ROOT, ".tmp-retro-music");
const SAMPLE_RATE = 44100;
const TAU = Math.PI * 2;

const TRACKS = [
  {
    id: "menu_theme",
    bpm: 112,
    duration: 24,
    root: 45,
    scale: [0, 2, 3, 5, 7, 8, 10],
    lead: [0, 7, 10, 12, 10, 7, 5, 3, 0, 3, 5, 7, 10, 12, 15, 12],
    bass: [0, -5, -7, -3],
    arp: [[0, 3, 7], [-5, -2, 3], [-7, -3, 2], [-3, 0, 5]],
    energy: 0.38,
  },
  {
    id: "safe_house_intro",
    bpm: 92,
    duration: 24,
    root: 42,
    scale: [0, 2, 3, 5, 7, 8, 10],
    lead: [0, null, 3, null, 7, null, 5, 3, 0, null, -2, null, 0, null, 3, null],
    bass: [0, -7, -5, -8],
    arp: [[0, 3, 7], [-7, -3, 2], [-5, -2, 3], [-8, -5, 0]],
    energy: 0.22,
  },
  {
    id: "shop_intermission",
    bpm: 124,
    duration: 24,
    root: 48,
    scale: [0, 2, 4, 5, 7, 9, 11],
    lead: [0, 4, 7, 12, 11, 7, 4, 2, 0, 2, 4, 7, 9, 7, 4, 2],
    bass: [0, 5, 7, 4],
    arp: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [4, 7, 11]],
    energy: 0.42,
  },
  {
    id: "raid_low",
    bpm: 128,
    duration: 24,
    root: 43,
    scale: [0, 2, 3, 5, 7, 8, 10],
    lead: [0, 3, 7, 10, 7, 3, 5, 7, 0, 5, 8, 12, 10, 7, 5, 3],
    bass: [0, 0, -5, -7],
    arp: [[0, 3, 7], [0, 5, 8], [-5, -2, 3], [-7, -3, 2]],
    energy: 0.5,
  },
  {
    id: "raid_mid",
    bpm: 144,
    duration: 24,
    root: 45,
    scale: [0, 2, 3, 5, 7, 8, 10],
    lead: [0, 7, 10, 12, 15, 12, 10, 7, 3, 7, 10, 14, 12, 10, 7, 5],
    bass: [0, -5, 0, -7],
    arp: [[0, 3, 7], [3, 7, 10], [-5, -2, 3], [-7, -3, 2]],
    energy: 0.68,
  },
  {
    id: "raid_high",
    bpm: 164,
    duration: 24,
    root: 46,
    scale: [0, 1, 3, 5, 6, 8, 10],
    lead: [0, 6, 8, 12, 15, 12, 8, 6, 3, 6, 10, 15, 18, 15, 12, 10],
    bass: [0, -6, -8, -5],
    arp: [[0, 3, 6], [0, 5, 8], [-6, -2, 3], [-8, -5, 0]],
    energy: 0.86,
  },
  {
    id: "boss_battle",
    bpm: 176,
    duration: 24,
    root: 41,
    scale: [0, 1, 3, 5, 6, 8, 10],
    lead: [0, 3, 6, 10, 12, 10, 6, 3, -1, 3, 6, 13, 12, 10, 6, 5],
    bass: [0, -1, -6, -8],
    arp: [[0, 3, 6], [-1, 3, 6], [-6, -3, 1], [-8, -5, 0]],
    energy: 0.96,
  },
  {
    id: "victory_sting",
    bpm: 132,
    duration: 5,
    root: 48,
    scale: [0, 2, 4, 5, 7, 9, 11],
    lead: [0, 4, 7, 12, 16, 19, 24, null],
    bass: [0, 5],
    arp: [[0, 4, 7], [5, 9, 12]],
    energy: 0.75,
    sting: "victory",
  },
  {
    id: "game_over_sting",
    bpm: 84,
    duration: 5,
    root: 41,
    scale: [0, 2, 3, 5, 7, 8, 10],
    lead: [12, 10, 7, 3, 0, -2, -5, null],
    bass: [0, -7],
    arp: [[0, 3, 7], [-7, -3, 2]],
    energy: 0.46,
    sting: "failure",
  },
];

function midiToFreq(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function osc(type, phase, duty = 0.5) {
  const t = phase % 1;
  if (type === "triangle") {
    return 4 * Math.abs(t - 0.5) - 1;
  }
  if (type === "sine") {
    return Math.sin(t * TAU);
  }
  return t < duty ? 1 : -1;
}

function env(local, duration, attack = 0.006, release = 0.045) {
  if (local < attack) {
    return local / attack;
  }
  if (local > duration - release) {
    return Math.max(0, (duration - local) / release);
  }
  return 1;
}

function addNote(buffer, { start, duration, midi, amp, type = "square", duty = 0.5, detune = 0 }) {
  if (!Number.isFinite(midi)) {
    return;
  }
  const startIndex = Math.max(0, Math.floor(start * SAMPLE_RATE));
  const endIndex = Math.min(buffer.length, Math.floor((start + duration) * SAMPLE_RATE));
  const freq = midiToFreq(midi + detune);
  for (let i = startIndex; i < endIndex; i += 1) {
    const local = i / SAMPLE_RATE - start;
    const phase = local * freq;
    const shaped = osc(type, phase, duty) * env(local, duration);
    buffer[i] += shaped * amp;
  }
}

function addKick(buffer, start, amp) {
  const duration = 0.13;
  const startIndex = Math.max(0, Math.floor(start * SAMPLE_RATE));
  const endIndex = Math.min(buffer.length, Math.floor((start + duration) * SAMPLE_RATE));
  for (let i = startIndex; i < endIndex; i += 1) {
    const local = i / SAMPLE_RATE - start;
    const freq = 92 - local * 320;
    const decay = Math.exp(-local * 24);
    buffer[i] += Math.sin(local * Math.max(32, freq) * TAU) * decay * amp;
  }
}

function addHat(buffer, start, amp, seed) {
  const duration = 0.045;
  let state = seed >>> 0;
  const startIndex = Math.max(0, Math.floor(start * SAMPLE_RATE));
  const endIndex = Math.min(buffer.length, Math.floor((start + duration) * SAMPLE_RATE));
  for (let i = startIndex; i < endIndex; i += 1) {
    state = (1664525 * state + 1013904223) >>> 0;
    const local = i / SAMPLE_RATE - start;
    const noise = ((state / 0xffffffff) * 2 - 1) * Math.exp(-local * 62);
    buffer[i] += noise * amp;
  }
}

function renderTrack(track) {
  const buffer = new Float32Array(Math.ceil(track.duration * SAMPLE_RATE));
  const beat = 60 / track.bpm;
  const step = beat / 2;
  const totalSteps = Math.ceil(track.duration / step);
  const leadOctave = track.sting ? 24 : 12;

  for (let i = 0; i < totalSteps; i += 1) {
    const t = i * step;
    const lead = track.lead[i % track.lead.length];
    const chord = track.arp[Math.floor(i / 4) % track.arp.length];
    const bass = track.bass[Math.floor(i / 8) % track.bass.length];
    const beatInBar = i % 8;

    addNote(buffer, {
      start: t,
      duration: step * (track.energy > 0.7 ? 0.82 : 0.72),
      midi: lead == null ? NaN : track.root + lead + leadOctave,
      amp: 0.09 + track.energy * 0.035,
      type: track.energy > 0.65 ? "square" : "triangle",
      duty: track.energy > 0.8 ? 0.34 : 0.5,
    });

    addNote(buffer, {
      start: t,
      duration: step * 0.95,
      midi: track.root + bass - 12,
      amp: 0.06 + track.energy * 0.025,
      type: "square",
      duty: 0.42,
    });

    const arpMidi = track.root + chord[i % chord.length] + 12;
    addNote(buffer, {
      start: t + step * 0.18,
      duration: step * 0.42,
      midi: arpMidi,
      amp: 0.035 + track.energy * 0.02,
      type: "triangle",
    });

    if (beatInBar === 0 || (track.energy > 0.75 && beatInBar === 4)) {
      addKick(buffer, t, 0.13 + track.energy * 0.04);
    }
    if (track.energy > 0.4 && i % 2 === 1) {
      addHat(buffer, t, 0.018 + track.energy * 0.012, i + track.root * 997);
    }
  }

  if (track.sting === "victory") {
    for (const offset of [0, 4, 7, 12]) {
      addNote(buffer, { start: 3.15, duration: 1.45, midi: track.root + offset + 24, amp: 0.06, type: "triangle" });
    }
  }
  if (track.sting === "failure") {
    for (const offset of [0, 3, 7]) {
      addNote(buffer, { start: 3.0, duration: 1.8, midi: track.root + offset, amp: 0.045, type: "triangle" });
    }
  }

  normalize(buffer);
  return buffer;
}

function normalize(buffer) {
  let peak = 0;
  for (const sample of buffer) {
    peak = Math.max(peak, Math.abs(sample));
  }
  const gain = peak > 0 ? 0.88 / peak : 1;
  for (let i = 0; i < buffer.length; i += 1) {
    buffer[i] *= gain;
  }
}

function writeWav(path, samples) {
  const byteLength = samples.length * 2;
  const buffer = Buffer.alloc(44 + byteLength);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + byteLength, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(byteLength, 40);
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  writeFileSync(path, buffer);
}

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(TMP_DIR, { recursive: true });

for (const track of TRACKS) {
  const wavPath = join(TMP_DIR, `${track.id}.wav`);
  const mp3Path = join(OUT_DIR, `${track.id}.mp3`);
  writeWav(wavPath, renderTrack(track));
  execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", wavPath, "-codec:a", "libmp3lame", "-q:a", "3", mp3Path]);
  console.log(`wrote ${mp3Path}`);
}

rmSync(TMP_DIR, { recursive: true, force: true });
