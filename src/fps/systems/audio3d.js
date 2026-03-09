export class Audio3D {
  constructor(camera) {
    this.camera = camera;
    this.ctx = null;
    this.listener = null;
    this.musicTimer = null;
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

  playTone({ freq = 220, duration = 0.08, gain = 0.035, position = null, type = "square" }) {
    this.ensureContext();
    if (!this.ctx) {
      return;
    }
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

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

  playWeapon(weaponId, position = null) {
    const palette = {
      pipe: { freq: 190, duration: 0.05, gain: 0.03, type: "square", tailFreq: 120, tailGain: 0.012, tailDuration: 0.06 },
      pistol: { freq: 340, duration: 0.032, gain: 0.032, type: "triangle", tailFreq: 220, tailGain: 0.012, tailDuration: 0.045 },
      smg: { freq: 420, duration: 0.022, gain: 0.022, type: "square", tailFreq: 300, tailGain: 0.009, tailDuration: 0.03 },
      rifle: { freq: 235, duration: 0.05, gain: 0.044, type: "sawtooth", tailFreq: 150, tailGain: 0.014, tailDuration: 0.06 },
      shotgun: { freq: 130, duration: 0.074, gain: 0.056, type: "sawtooth", tailFreq: 92, tailGain: 0.019, tailDuration: 0.08 },
      dmr: { freq: 175, duration: 0.08, gain: 0.054, type: "square", tailFreq: 120, tailGain: 0.018, tailDuration: 0.1 },
      rpg: { freq: 82, duration: 0.14, gain: 0.068, type: "sawtooth", tailFreq: 58, tailGain: 0.025, tailDuration: 0.16 },
    };
    const profile = palette[weaponId] ?? palette.pistol;
    this.playTone({
      freq: profile.freq,
      duration: profile.duration,
      gain: profile.gain,
      type: profile.type,
      position,
    });
    this.playTone({
      freq: profile.tailFreq,
      duration: profile.tailDuration,
      gain: profile.tailGain,
      type: "triangle",
      position,
    });
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

  playExplosion(position = null) {
    this.playTone({ freq: 60, duration: 0.2, gain: 0.08, position, type: "sawtooth" });
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

  startMusic(mode = "raid") {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    const sequence = mode === "menu" ? [140, 166, 148, 132] : [110, 138, 98, 124, 146, 114];
    let idx = 0;
    this.musicTimer = setInterval(() => {
      this.playTone({ freq: sequence[idx % sequence.length], duration: 0.16, gain: 0.01, type: "triangle" });
      idx += 1;
    }, mode === "menu" ? 420 : 300);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
