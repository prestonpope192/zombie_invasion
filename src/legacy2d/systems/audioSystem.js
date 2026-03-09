export class AudioSystem {
  constructor(scene) {
    this.scene = scene;
    this.ctx = null;
    this.musicTimer = null;
    this.musicMode = null;
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
  }

  blip({ freq = 220, duration = 0.08, type = "square", gain = 0.03 }) {
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
    osc.connect(amp);
    amp.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  playWeapon(category) {
    if (category === "gun") {
      this.blip({ freq: 340, duration: 0.05, type: "square", gain: 0.025 });
      return;
    }
    this.blip({ freq: 120, duration: 0.1, type: "sawtooth", gain: 0.035 });
  }

  playZombieDeath() {
    this.blip({ freq: 160, duration: 0.14, type: "triangle", gain: 0.03 });
  }

  playZombieAttack() {
    this.blip({ freq: 90, duration: 0.07, type: "square", gain: 0.03 });
  }

  playExplosion() {
    this.blip({ freq: 70, duration: 0.18, type: "sawtooth", gain: 0.05 });
  }

  startMusic(mode) {
    if (this.musicMode === mode) {
      return;
    }
    this.stopMusic();
    this.musicMode = mode;
    const pattern =
      mode === "raid"
        ? [174, 220, 164, 196, 233, 185, 155, 185]
        : [130, 146, 164, 146, 138, 123, 138, 146];
    let idx = 0;
    this.musicTimer = window.setInterval(() => {
      this.blip({ freq: pattern[idx % pattern.length], duration: 0.18, type: "triangle", gain: 0.014 });
      idx += 1;
    }, mode === "raid" ? 280 : 420);
  }

  stopMusic() {
    if (this.musicTimer) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.musicMode = null;
  }
}
