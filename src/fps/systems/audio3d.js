export const WEAPON_AUDIO_PROFILES = {
  pipe: {
    layers: [
      { freq: 184, freqEnd: 132, duration: 0.045, gain: 0.028, type: "square" },
      { freq: 96, freqEnd: 72, duration: 0.085, gain: 0.013, type: "triangle" },
    ],
  },
  pistol: {
    layers: [
      { freq: 448, freqEnd: 248, duration: 0.026, gain: 0.026, type: "triangle" },
      { freq: 960, freqEnd: 340, duration: 0.012, gain: 0.011, type: "sawtooth" },
      { freq: 164, freqEnd: 92, duration: 0.055, gain: 0.009, type: "triangle" },
    ],
  },
  revolver: {
    layers: [
      { freq: 214, freqEnd: 140, duration: 0.072, gain: 0.048, type: "square" },
      { freq: 760, freqEnd: 250, duration: 0.018, gain: 0.019, type: "triangle" },
      { freq: 102, freqEnd: 74, duration: 0.11, gain: 0.017, type: "sawtooth" },
    ],
  },
  smg: {
    layers: [
      { freq: 520, freqEnd: 330, duration: 0.016, gain: 0.018, type: "square" },
      { freq: 840, freqEnd: 420, duration: 0.01, gain: 0.009, type: "triangle" },
      { freq: 186, freqEnd: 112, duration: 0.034, gain: 0.006, type: "triangle" },
    ],
  },
  machine_pistol: {
    layers: [
      { freq: 608, freqEnd: 392, duration: 0.014, gain: 0.017, type: "square" },
      { freq: 1060, freqEnd: 540, duration: 0.009, gain: 0.008, type: "triangle" },
      { freq: 210, freqEnd: 128, duration: 0.028, gain: 0.006, type: "triangle" },
    ],
  },
  rifle: {
    layers: [
      { freq: 242, freqEnd: 158, duration: 0.052, gain: 0.039, type: "sawtooth" },
      { freq: 760, freqEnd: 220, duration: 0.015, gain: 0.013, type: "triangle" },
      { freq: 126, freqEnd: 86, duration: 0.072, gain: 0.011, type: "square" },
    ],
  },
  battle_rifle: {
    layers: [
      { freq: 196, freqEnd: 126, duration: 0.068, gain: 0.048, type: "sawtooth" },
      { freq: 690, freqEnd: 184, duration: 0.018, gain: 0.015, type: "triangle" },
      { freq: 88, freqEnd: 64, duration: 0.095, gain: 0.016, type: "square" },
    ],
  },
  shotgun: {
    layers: [
      { freq: 126, freqEnd: 86, duration: 0.086, gain: 0.056, type: "sawtooth" },
      { freq: 320, freqEnd: 148, duration: 0.028, gain: 0.016, type: "triangle" },
      { freq: 74, freqEnd: 58, duration: 0.12, gain: 0.016, type: "square" },
    ],
  },
  lmg: {
    layers: [
      { freq: 232, freqEnd: 168, duration: 0.038, gain: 0.033, type: "sawtooth" },
      { freq: 468, freqEnd: 280, duration: 0.02, gain: 0.012, type: "square" },
      { freq: 128, freqEnd: 92, duration: 0.06, gain: 0.01, type: "triangle" },
    ],
  },
  dmr: {
    layers: [
      { freq: 168, freqEnd: 120, duration: 0.084, gain: 0.052, type: "square" },
      { freq: 540, freqEnd: 210, duration: 0.016, gain: 0.014, type: "triangle" },
      { freq: 102, freqEnd: 70, duration: 0.11, gain: 0.017, type: "sawtooth" },
    ],
  },
  sniper: {
    layers: [
      { freq: 142, freqEnd: 90, duration: 0.118, gain: 0.064, type: "square" },
      { freq: 820, freqEnd: 180, duration: 0.02, gain: 0.018, type: "triangle" },
      { freq: 82, freqEnd: 58, duration: 0.14, gain: 0.02, type: "sawtooth" },
    ],
  },
  rpg: {
    layers: [
      { freq: 84, freqEnd: 56, duration: 0.15, gain: 0.068, type: "sawtooth" },
      { freq: 220, freqEnd: 96, duration: 0.05, gain: 0.018, type: "triangle" },
      { freq: 56, freqEnd: 42, duration: 0.18, gain: 0.022, type: "square" },
    ],
  },
  grenade_launcher: {
    layers: [
      { freq: 112, freqEnd: 80, duration: 0.1, gain: 0.05, type: "triangle" },
      { freq: 228, freqEnd: 120, duration: 0.028, gain: 0.012, type: "square" },
      { freq: 72, freqEnd: 58, duration: 0.11, gain: 0.016, type: "sawtooth" },
    ],
  },
  flamethrower: {
    layers: [
      { freq: 188, freqEnd: 120, duration: 0.058, gain: 0.018, type: "sawtooth" },
      { freq: 432, freqEnd: 244, duration: 0.048, gain: 0.01, type: "triangle" },
      { freq: 72, freqEnd: 60, duration: 0.085, gain: 0.008, type: "square" },
    ],
  },
  grenade_throw: {
    layers: [
      { freq: 118, freqEnd: 86, duration: 0.06, gain: 0.026, type: "triangle" },
      { freq: 84, freqEnd: 70, duration: 0.072, gain: 0.009, type: "square" },
    ],
  },
  breacher_grenade: {
    layers: [
      { freq: 98, freqEnd: 72, duration: 0.075, gain: 0.03, type: "sawtooth" },
      { freq: 162, freqEnd: 104, duration: 0.04, gain: 0.01, type: "triangle" },
    ],
  },
  nova_grenade: {
    layers: [
      { freq: 166, freqEnd: 212, duration: 0.085, gain: 0.028, type: "triangle" },
      { freq: 96, freqEnd: 72, duration: 0.09, gain: 0.012, type: "square" },
    ],
  },
};

const WAVE_ROOTS = [110, 123.47, 130.81, 146.83, 155.56, 174.61, 196, 220, 233.08, 261.63, 293.66, 329.63];
const WAVE_SCALES = [
  [0, 3, 7, 10],
  [0, 5, 7, 10],
  [0, 2, 7, 10],
  [0, 3, 5, 8],
];

function noteFromSemitone(rootFreq, semitone) {
  return rootFreq * 2 ** (semitone / 12);
}

function buildPadChord(rootFreq, scale) {
  return [
    noteFromSemitone(rootFreq, scale[0]),
    noteFromSemitone(rootFreq, scale[2]),
    noteFromSemitone(rootFreq, scale[3] + 12),
  ];
}

export function createWaveMusicProfile(waveNumber = 1) {
  const wave = Math.max(1, Math.round(Number(waveNumber) || 1));
  const waveIndex = wave - 1;
  const energy = Math.min(0.68, waveIndex / 16);
  const stage = Math.min(3, Math.floor(waveIndex / 3));
  const rootFreq = WAVE_ROOTS[waveIndex % WAVE_ROOTS.length] * (waveIndex >= WAVE_ROOTS.length ? 0.5 : 1);
  const scale = WAVE_SCALES[waveIndex % WAVE_SCALES.length];
  const bossWave = wave % 6 === 0;
  const pulseSteps = [scale[0], scale[1], scale[2], scale[1] + 12, scale[2], scale[3] + 12];
  const shimmerSteps = [scale[1] + 12, scale[2] + 12, scale[3] + 12, scale[2] + 12];
  const subSteps = [scale[0] - 12, scale[0], scale[1] - 12, scale[0]];

  return {
    wave,
    bossWave,
    energy,
    stage,
    rootFreq,
    scale,
    padChord: buildPadChord(rootFreq, scale),
    pulseNotes: pulseSteps.map((step) => noteFromSemitone(rootFreq, step)),
    shimmerNotes: shimmerSteps.map((step) => noteFromSemitone(rootFreq, step)),
    subNotes: subSteps.map((step) => noteFromSemitone(rootFreq, step)),
    startCue: [
      noteFromSemitone(rootFreq, scale[0]),
      noteFromSemitone(rootFreq, scale[1] + (bossWave ? 12 : 0)),
      noteFromSemitone(rootFreq, scale[2] + 12),
    ],
    padIntervalMs: Math.round(Math.max(1900, 2450 - waveIndex * 58)),
    pulseIntervalMs: Math.round(Math.max(540, 960 - waveIndex * 20)),
    shimmerIntervalMs: Math.round(Math.max(880, 1540 - waveIndex * 34)),
    subIntervalMs: Math.round(Math.max(1180, 1820 - waveIndex * 30)),
    padDuration: 1.5 + energy * 0.34,
    pulseDuration: 0.16 + energy * 0.08,
    shimmerDuration: 0.11 + energy * 0.05,
    subDuration: 0.42 + energy * 0.12,
    padGain: 0.0042 + energy * 0.0014,
    pulseGain: 0.003 + energy * 0.0021,
    shimmerGain: 0.0018 + Math.max(0, energy - 0.06) * 0.0015,
    subGain: 0.0018 + energy * 0.0012,
  };
}

export class Audio3D {
  constructor(camera) {
    this.camera = camera;
    this.ctx = null;
    this.listener = null;
    this.musicTimers = [];
    this.musicTimeouts = [];
    this.activeMusicKey = "";
  }

  ensureContext() {
    if (this.ctx) {
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      return;
    }
    this.ctx = new AudioCtx();
    this.listener = this.ctx.listener;
  }

  setListenerPosition(position) {
    if (!this.listener) {
      return;
    }
    this.listener.positionX.value = position.x;
    this.listener.positionY.value = position.y;
    this.listener.positionZ.value = position.z;
  }

  playTone({ freq = 220, freqEnd = freq, duration = 0.08, gain = 0.035, gainEnd = 0.0001, position = null, type = "square", attack = 0.002 }) {
    this.ensureContext();
    if (!this.ctx) {
      return;
    }
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (Number.isFinite(freqEnd) && freqEnd !== freq) {
      osc.frequency.linearRampToValueAtTime(freqEnd, now + duration);
    }
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.linearRampToValueAtTime(gain, now + Math.max(0.001, attack));
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainEnd), now + duration);

    let target = amp;
    if (position) {
      const panner = this.ctx.createPanner();
      panner.distanceModel = "inverse";
      panner.refDistance = 2;
      panner.maxDistance = 120;
      panner.rolloffFactor = 1.6;
      panner.positionX.value = position.x;
      panner.positionY.value = position.y;
      panner.positionZ.value = position.z;
      target.connect(panner);
      target = panner;
    }

    osc.connect(amp);
    target.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  playChord({ notes = [], duration = 0.12, gain = 0.012, gainEnd = 0.0001, type = "sine", attack = 0.02, position = null }) {
    if (!Array.isArray(notes) || notes.length === 0) {
      return;
    }
    const voiceGain = gain / Math.max(1, Math.sqrt(notes.length));
    for (const freq of notes) {
      this.playTone({
        freq,
        duration,
        gain: voiceGain,
        gainEnd,
        position,
        type,
        attack,
      });
    }
  }

  playWeapon(weaponId, position = null) {
    const profile = WEAPON_AUDIO_PROFILES[weaponId] ?? WEAPON_AUDIO_PROFILES.pistol;
    for (const layer of profile.layers) {
      this.playTone({
        ...layer,
        position,
      });
    }
  }

  playImpact(material = "concrete", position = null) {
    const freqByMaterial = {
      wood: 160,
      concrete: 120,
      steel: 220,
      glass: 300,
      flesh: 100,
      soil: 90,
    };
    this.playTone({ freq: freqByMaterial[material] ?? 120, duration: 0.05, gain: 0.02, position, type: "triangle" });
  }

  playExplosion(position = null, profileId = "frag") {
    const palette = {
      frag: { freq: 60, duration: 0.2, gain: 0.08, type: "sawtooth", tailFreq: 104, tailDuration: 0.08, tailGain: 0.018 },
      breacher: { freq: 48, duration: 0.24, gain: 0.09, type: "sawtooth", tailFreq: 88, tailDuration: 0.11, tailGain: 0.022 },
      nova: { freq: 82, duration: 0.18, gain: 0.078, type: "triangle", tailFreq: 188, tailDuration: 0.14, tailGain: 0.024 },
    };
    const profile = palette[profileId] ?? palette.frag;
    this.playTone({ freq: profile.freq, duration: profile.duration, gain: profile.gain, position, type: profile.type });
    this.playTone({ freq: profile.tailFreq, duration: profile.tailDuration, gain: profile.tailGain, position, type: "triangle" });
  }

  playVillageUnderAttack(position = null, intensity = 0.5) {
    const clamped = Math.max(0.15, Math.min(1, Number(intensity) || 0.5));
    this.playTone({
      freq: 82 + clamped * 40,
      duration: 0.1 + clamped * 0.08,
      gain: 0.02 + clamped * 0.03,
      position,
      type: "sawtooth",
    });
    this.playTone({
      freq: 180 + clamped * 90,
      duration: 0.06 + clamped * 0.04,
      gain: 0.01 + clamped * 0.015,
      position,
      type: "triangle",
    });
  }

  playWaveStartCue(waveNumber = 1) {
    const profile = createWaveMusicProfile(waveNumber);
    this.playTone({
      freq: profile.startCue[0],
      duration: 0.22,
      gain: 0.0065,
      gainEnd: 0.0004,
      type: "triangle",
      attack: 0.02,
    });
    this.playTone({
      freq: profile.startCue[1],
      duration: 0.18,
      gain: profile.bossWave ? 0.0072 : 0.0055,
      gainEnd: 0.0004,
      type: profile.bossWave ? "sawtooth" : "triangle",
      attack: 0.012,
    });
    this.playTone({
      freq: profile.startCue[2],
      duration: 0.28,
      gain: 0.0058,
      gainEnd: 0.0003,
      type: "sine",
      attack: 0.024,
    });
  }

  scheduleMusicLoop(intervalMs, callback, initialDelayMs = 0) {
    const kickoff = () => {
      callback();
      const timerId = window.setInterval(callback, intervalMs);
      this.musicTimers.push(timerId);
    };
    if (initialDelayMs > 0) {
      const timeoutId = window.setTimeout(kickoff, initialDelayMs);
      this.musicTimeouts.push(timeoutId);
      return;
    }
    kickoff();
  }

  startMenuMusic() {
    const root = 140;
    const pads = [
      [root, noteFromSemitone(root, 7), noteFromSemitone(root, 12)],
      [noteFromSemitone(root, 2), noteFromSemitone(root, 9), noteFromSemitone(root, 14)],
      [noteFromSemitone(root, 5), noteFromSemitone(root, 12), noteFromSemitone(root, 17)],
      [noteFromSemitone(root, -2), noteFromSemitone(root, 5), noteFromSemitone(root, 10)],
    ];
    const lead = [root, noteFromSemitone(root, 7), noteFromSemitone(root, 5), noteFromSemitone(root, 12)];
    let padIndex = 0;
    this.scheduleMusicLoop(2100, () => {
      this.playChord({
        notes: pads[padIndex % pads.length],
        duration: 1.6,
        gain: 0.007,
        gainEnd: 0.0003,
        type: "sine",
        attack: 0.04,
      });
      padIndex += 1;
    });
    let leadIndex = 0;
    this.scheduleMusicLoop(920, () => {
      this.playTone({
        freq: lead[leadIndex % lead.length],
        duration: 0.22,
        gain: 0.0042,
        gainEnd: 0.0004,
        type: "triangle",
        attack: 0.016,
      });
      leadIndex += 1;
    }, 340);
  }

  startRaidMusic(waveNumber = 1) {
    const profile = createWaveMusicProfile(waveNumber);
    let padIndex = 0;
    this.scheduleMusicLoop(profile.padIntervalMs, () => {
      const voicing = padIndex % 2 === 0
        ? profile.padChord
        : [profile.padChord[0], profile.padChord[1], noteFromSemitone(profile.rootFreq, profile.scale[1] + 12)];
      this.playChord({
        notes: voicing,
        duration: profile.padDuration,
        gain: profile.padGain,
        gainEnd: 0.0003,
        type: profile.stage >= 2 ? "triangle" : "sine",
        attack: 0.035,
      });
      padIndex += 1;
    });

    let pulseIndex = 0;
    this.scheduleMusicLoop(profile.pulseIntervalMs, () => {
      const freq = profile.pulseNotes[pulseIndex % profile.pulseNotes.length];
      this.playTone({
        freq,
        freqEnd: freq * (profile.stage >= 2 ? 0.985 : 1),
        duration: profile.pulseDuration,
        gain: profile.pulseGain,
        gainEnd: 0.0005,
        type: profile.stage >= 3 ? "square" : "triangle",
        attack: 0.01,
      });
      pulseIndex += 1;
    }, 260);

    if (waveNumber >= 2) {
      let shimmerIndex = 0;
      this.scheduleMusicLoop(profile.shimmerIntervalMs, () => {
        const freq = profile.shimmerNotes[shimmerIndex % profile.shimmerNotes.length];
        this.playTone({
          freq,
          freqEnd: freq * 1.01,
          duration: profile.shimmerDuration,
          gain: profile.shimmerGain + (profile.bossWave ? 0.0007 : 0),
          gainEnd: 0.0004,
          type: profile.bossWave ? "triangle" : "sine",
          attack: 0.008,
        });
        shimmerIndex += 1;
      }, 520);
    }

    if (waveNumber >= 4) {
      let subIndex = 0;
      this.scheduleMusicLoop(profile.subIntervalMs, () => {
        const freq = profile.subNotes[subIndex % profile.subNotes.length];
        this.playTone({
          freq,
          freqEnd: freq * 0.96,
          duration: profile.subDuration,
          gain: profile.subGain + (profile.bossWave ? 0.001 : 0),
          gainEnd: 0.0003,
          type: "sine",
          attack: 0.02,
        });
        subIndex += 1;
      }, 110);
    }

    this.playWaveStartCue(waveNumber);
  }

  startMusic(mode = "raid", options = {}) {
    const waveNumber = Math.max(1, Math.round(Number(options.waveNumber) || 1));
    const nextMusicKey = mode === "raid" ? `${mode}:${waveNumber}` : mode;
    if (this.activeMusicKey === nextMusicKey) {
      return;
    }
    this.stopMusic();
    this.activeMusicKey = nextMusicKey;
    if (mode === "menu") {
      this.startMenuMusic();
      return;
    }
    this.startRaidMusic(waveNumber);
  }

  stopMusic() {
    for (const timerId of this.musicTimers) {
      clearInterval(timerId);
    }
    for (const timeoutId of this.musicTimeouts) {
      clearTimeout(timeoutId);
    }
    this.musicTimers = [];
    this.musicTimeouts = [];
    this.activeMusicKey = "";
  }
}
