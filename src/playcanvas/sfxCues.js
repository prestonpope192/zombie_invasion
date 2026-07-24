// Procedural SFX cues — extracted from main.js. Each cue prefers a loaded
// sample and falls back to synth tones. Construction takes callbacks/handles
// so the class always reads live state:
//   audio        — Audio3D instance (owns the AudioContext + playTone)
//   samples      — sample library with playSample(id, ctx, destination, opts)
//   isSfxEnabled — () => boolean; cues no-op when it returns false
// Every cue also no-ops while the AudioContext is not yet unlocked (ctx null)
// so nothing throws before the first user click.
export class SfxCues {
  constructor({ audio, samples, isSfxEnabled }) {
    this.audio = audio;
    this.samples = samples;
    this.isSfxEnabled = isSfxEnabled;
    this._heartbeatPhaseSec = 0;
  }

  _ready() {
    return this.isSfxEnabled() !== false && Boolean(this.audio.ctx);
  }

  // Shared sample→synth fallback shape used by most cues.
  _playOrSynth(sampleId, options, synthFn) {
    const usedSample = this.samples.playSample(sampleId, this.audio.ctx, this.audio.ctx.destination, options);
    if (!usedSample) {
      synthFn();
    }
  }

  /** Cue 1: Hit confirm — crisp high tick on flesh hit (non-kill) */
  hitConfirm() {
    if (!this._ready()) return;
    this._playOrSynth("impact-flesh", { gainScale: 0.45, pitchVariance: 2, gainVariance: 0.1 }, () => {
      // Short high-pitched triangle blip — distinct from the flesh impact boom
      this.audio.playTone({ freq: 1850, freqEnd: 1380, duration: 0.04, gain: 0.024, gainEnd: 0.0001, type: "triangle", attack: 0.001, channel: "sfx" });
    });
  }

  /** Cue 2: Kill — satisfying pitch-drop thud */
  kill() {
    if (!this._ready()) return;
    this._playOrSynth("impact-flesh", { gainScale: 0.85, pitchVariance: 1.5, gainVariance: 0.12 }, () => {
      // Low descending thud
      this.audio.playTone({ freq: 320, freqEnd: 88, duration: 0.14, gain: 0.045, gainEnd: 0.0002, type: "triangle", attack: 0.003, channel: "sfx" });
      // Sub punch layer
      this.audio.playTone({ freq: 110, freqEnd: 55, duration: 0.11, gain: 0.022, gainEnd: 0.0002, type: "sine", attack: 0.002, channel: "sfx" });
    });
  }

  /** Cue 3: Headshot ding — bright overtone layered on kill */
  headshot() {
    if (!this._ready()) return;
    // Bright sine chime, decays fast
    this.audio.playTone({ freq: 1320, freqEnd: 1100, duration: 0.18, gain: 0.022, gainEnd: 0.0002, type: "sine", attack: 0.002, channel: "sfx" });
    this.audio.playTone({ freq: 2200, freqEnd: 1760, duration: 0.09, gain: 0.008, gainEnd: 0.0001, type: "triangle", attack: 0.001, channel: "sfx" });
  }

  /** Cue 4: Kill streak arpeggio — escalates with tier (x3/x5/x7/x10) */
  streak(count) {
    if (count < 3) return;
    if (!this._ready()) return;
    // Each tier: higher root, brighter chord
    const tier = count >= 10 ? 3 : count >= 7 ? 2 : count >= 5 ? 1 : 0;
    const roots = [220, 277.18, 329.63, 415.30];
    const root = roots[tier];
    const arpeggioNotes = [
      root,
      root * 1.2599, // minor third ≈ ×2^(3/12)
      root * 1.4983, // perfect fifth ≈ ×2^(7/12)
      root * 1.7818, // minor seventh ≈ ×2^(10/12)
    ];
    const delayMs = [0, 55, 110, 165];
    for (let i = 0; i <= tier + 1 && i < arpeggioNotes.length; i++) {
      const noteFreq = arpeggioNotes[i];
      const delay = delayMs[i];
      if (delay === 0) {
        this.audio.playTone({ freq: noteFreq, freqEnd: noteFreq * 0.97, duration: 0.22, gain: 0.018, gainEnd: 0.0002, type: "triangle", attack: 0.005, channel: "sfx" });
      } else {
        setTimeout(() => {
          if (!this._ready()) return;
          this.audio.playTone({ freq: noteFreq, freqEnd: noteFreq * 0.97, duration: 0.22, gain: 0.018, gainEnd: 0.0002, type: "triangle", attack: 0.005, channel: "sfx" });
        }, delay);
      }
    }
  }

  /** Cue 5a: Reload start — mechanical click-clack */
  reloadStart() {
    if (!this._ready()) return;
    this._playOrSynth("reload", { gainScale: 0.7, pitchVariance: 1, gainVariance: 0.08 }, () => {
      // Noisy low-mid click
      this.audio.playTone({ freq: 180, freqEnd: 120, duration: 0.038, gain: 0.032, gainEnd: 0.0002, type: "sawtooth", attack: 0.001, channel: "sfx" });
      this.audio.playTone({ freq: 340, freqEnd: 200, duration: 0.022, gain: 0.014, gainEnd: 0.0001, type: "square", attack: 0.001, channel: "sfx" });
    });
  }

  /** Cue 5b: Reload finish — satisfying seating click */
  reloadFinish() {
    if (!this._ready()) return;
    this._playOrSynth("reload", { gainScale: 0.85, pitchVariance: 1.5, gainVariance: 0.08 }, () => {
      // Crisper, slightly higher than start
      this.audio.playTone({ freq: 260, freqEnd: 160, duration: 0.032, gain: 0.036, gainEnd: 0.0002, type: "sawtooth", attack: 0.001, channel: "sfx" });
      this.audio.playTone({ freq: 520, freqEnd: 280, duration: 0.018, gain: 0.012, gainEnd: 0.0001, type: "square", attack: 0.001, channel: "sfx" });
    });
  }

  /** Cue 5c: Empty-mag click — dry single tick */
  empty() {
    if (!this._ready()) return;
    this._playOrSynth("empty", { gainScale: 0.6, pitchVariance: 0.5, gainVariance: 0.06 }, () => {
      this.audio.playTone({ freq: 280, freqEnd: 220, duration: 0.018, gain: 0.024, gainEnd: 0.0001, type: "square", attack: 0.001, channel: "sfx" });
    });
  }

  /** Cue 6: Coin pickup ching — light bright ring */
  coin() {
    if (!this._ready()) return;
    this._playOrSynth("coin", { gainScale: 0.65, pitchVariance: 2, gainVariance: 0.1 }, () => {
      this.audio.playTone({ freq: 1560, freqEnd: 1040, duration: 0.12, gain: 0.014, gainEnd: 0.0001, type: "sine", attack: 0.002, channel: "sfx" });
      this.audio.playTone({ freq: 2080, freqEnd: 1560, duration: 0.07, gain: 0.007, gainEnd: 0.0001, type: "sine", attack: 0.001, channel: "sfx" });
    });
  }

  /** Cue 7: Player damage — zombie groan + thud on bite */
  playerDamage() {
    if (!this._ready()) return;
    // Sample: zombie groan on player bite — pick randomly from 3 variants
    const groanId = `zombie-groan-${1 + Math.floor(Math.random() * 3)}`;
    this._playOrSynth(groanId, { gainScale: 0.48, pitchVariance: 1.5, gainVariance: 0.12 }, () => {
      // Body-hit thud
      this.audio.playTone({ freq: 88, freqEnd: 52, duration: 0.14, gain: 0.055, gainEnd: 0.0002, type: "triangle", attack: 0.003, channel: "sfx" });
      // High distress overtone
      this.audio.playTone({ freq: 420, freqEnd: 180, duration: 0.08, gain: 0.018, gainEnd: 0.0001, type: "sawtooth", attack: 0.002, channel: "sfx" });
    });
  }

  /** Cue 8: Low-health heartbeat — two soft low thumps; called from the update
   *  loop. Period scales with HP severity: lower HP = faster beat. */
  heartbeatTick(dt, playerHp) {
    if (this.isSfxEnabled() === false) return;
    const severity = Math.max(0, Math.min(1, 1 - playerHp / 25));
    const period = 1.8 - severity * 0.9; // 1.8s at 25%HP, 0.9s at 0%HP
    this._heartbeatPhaseSec += dt;
    if (this._heartbeatPhaseSec >= period) {
      this._heartbeatPhaseSec = 0;
      if (!this.audio.ctx) return;
      // First thump
      this.audio.playTone({ freq: 62, freqEnd: 44, duration: 0.12, gain: 0.038, gainEnd: 0.0002, type: "sine", attack: 0.004, channel: "sfx" });
      // Second thump (70ms later)
      setTimeout(() => {
        if (!this._ready()) return;
        this.audio.playTone({ freq: 54, freqEnd: 40, duration: 0.10, gain: 0.028, gainEnd: 0.0002, type: "sine", attack: 0.003, channel: "sfx" });
      }, 70);
    }
  }

  /** Reset the heartbeat phase (player back above the low-HP threshold). */
  resetHeartbeat() {
    this._heartbeatPhaseSec = 0;
  }

  /** Cue 9: UI click — soft subtle click for primary button presses */
  uiClick() {
    if (!this._ready()) return;
    this.audio.playTone({ freq: 620, freqEnd: 440, duration: 0.022, gain: 0.012, gainEnd: 0.0001, type: "triangle", attack: 0.001, channel: "sfx" });
  }

  /** Cue 9b: UI shop-buy confirm — slightly richer */
  shopBuy() {
    if (!this._ready()) return;
    this.audio.playTone({ freq: 880, freqEnd: 660, duration: 0.06, gain: 0.014, gainEnd: 0.0001, type: "triangle", attack: 0.003, channel: "sfx" });
    this.audio.playTone({ freq: 1320, freqEnd: 880, duration: 0.04, gain: 0.007, gainEnd: 0.0001, type: "sine", attack: 0.002, channel: "sfx" });
  }
}
