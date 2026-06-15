/**
 * sfxSamples.js — CC0 sample manager for the PlayCanvas route.
 *
 * Loads a small set of recorded OGG/MP3 files via fetch + decodeAudioData,
 * caches them as AudioBuffers, then exposes a `playSample(id, ctx, gainNode, opts)`
 * helper that creates a BufferSource per-call with slight random pitch/gain variation.
 *
 * Design constraints:
 *  - Pure logic: no PlayCanvas or Three.js imports.
 *  - Safe before audio-unlock: all public calls no-op if ctx is null/suspended.
 *  - Falls back gracefully: callers must keep synth fallbacks (see main.js).
 *  - Does NOT modify Audio3D — it is additive-only.
 */

// ---------------------------------------------------------------------------
// Sample catalogue
// ---------------------------------------------------------------------------

/**
 * Each entry maps a logical id to a public URL path.
 * Paths are relative to the web root (served from public/).
 */
export const SAMPLE_CATALOGUE = {
  "gunshot-1":       "/audio/gunshot-1.ogg",
  "gunshot-2":       "/audio/gunshot-2.ogg",
  "zombie-groan-1":  "/audio/zombie-groan-1.ogg",
  "zombie-groan-2":  "/audio/zombie-groan-2.ogg",
  "zombie-groan-3":  "/audio/zombie-groan-3.ogg",
  "impact-flesh":    "/audio/impact-flesh.ogg",
  "impact-concrete": "/audio/impact-concrete.ogg",
  "reload":          "/audio/reload.ogg",
  "empty":           "/audio/empty.ogg",
  "coin":            "/audio/coin.ogg",
  "ambient-night":   "/audio/ambient-night.mp3",
};

// ---------------------------------------------------------------------------
// SfxSampleManager class
// ---------------------------------------------------------------------------

export class SfxSampleManager {
  constructor() {
    /** @type {Map<string, AudioBuffer>} */
    this._buffers = new Map();
    /** @type {Set<string>} currently in-flight fetches */
    this._loading = new Set();
    /** @type {AudioBufferSourceNode|null} the looping ambient bed source */
    this._bedSource = null;
    /** @type {GainNode|null} the ambient bed gain node */
    this._bedGain = null;
    this._bedPlaying = false;
  }

  // -------------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------------

  /**
   * Kick off loading all samples.  Safe to call multiple times — already
   * loading/loaded entries are skipped.
   *
   * @param {AudioContext} ctx
   */
  loadAll(ctx) {
    for (const [id, url] of Object.entries(SAMPLE_CATALOGUE)) {
      this._loadOne(id, url, ctx);
    }
  }

  /**
   * @param {string} id
   * @param {string} url
   * @param {AudioContext} ctx
   */
  _loadOne(id, url, ctx) {
    if (this._buffers.has(id) || this._loading.has(id)) return;
    this._loading.add(id);
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
        return r.arrayBuffer();
      })
      .then((ab) => ctx.decodeAudioData(ab))
      .then((buf) => {
        this._buffers.set(id, buf);
        this._loading.delete(id);
      })
      .catch((err) => {
        // Non-fatal: synth fallback will cover this sample.
        console.warn(`[sfxSamples] Could not load "${id}" (${url}):`, err.message ?? err);
        this._loading.delete(id);
      });
  }

  // -------------------------------------------------------------------------
  // Count (for diagnostics)
  // -------------------------------------------------------------------------

  /** Number of buffers that have successfully decoded. */
  get loadedCount() {
    return this._buffers.size;
  }

  // -------------------------------------------------------------------------
  // Playback helpers
  // -------------------------------------------------------------------------

  /**
   * Returns true if the sample is ready to play.
   * @param {string} id
   */
  isReady(id) {
    return this._buffers.has(id);
  }

  /**
   * Play a one-shot sample.
   *
   * @param {string}       id          — key into SAMPLE_CATALOGUE
   * @param {AudioContext} ctx
   * @param {AudioNode}    destination — typically the sfx gain node
   * @param {object}       [opts]
   * @param {number}       [opts.gainScale=1]   — additional gain multiplier (0–2)
   * @param {number}       [opts.pitchVariance=0] — max semitone variance (±)
   * @param {number}       [opts.gainVariance=0]  — max gain variance (±fraction of gainScale)
   * @returns {boolean} true if the sample was actually started
   */
  playSample(id, ctx, destination, opts = {}) {
    if (!ctx || !destination) return false;
    const buf = this._buffers.get(id);
    if (!buf) return false;

    const {
      gainScale = 1,
      pitchVariance = 0,
      gainVariance = 0,
    } = opts;

    // Random ± pitch in semitones → playback rate multiplier
    const pitchShift = pitchVariance > 0
      ? (Math.random() * 2 - 1) * pitchVariance
      : 0;
    const rate = Math.pow(2, pitchShift / 12);

    // Random ± gain
    const gainJitter = gainVariance > 0
      ? (Math.random() * 2 - 1) * gainVariance
      : 0;
    const finalGain = Math.max(0, gainScale + gainJitter);

    try {
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(finalGain, ctx.currentTime);
      gain.connect(destination);

      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      src.connect(gain);
      src.start(ctx.currentTime);
    } catch (e) {
      // Guard against suspended context race.
    }
    return true;
  }

  // -------------------------------------------------------------------------
  // Ambient night bed
  // -------------------------------------------------------------------------

  /**
   * Start the looping ambient night bed on a given destination node.
   * Safe to call multiple times — will not double-start.
   *
   * @param {AudioContext} ctx
   * @param {AudioNode}    destination
   * @param {number}       [gainValue=0.18] — volume of the bed layer
   */
  startNightBed(ctx, destination, gainValue = 0.18) {
    if (!ctx || !destination) return;
    if (this._bedPlaying) return;
    const buf = this._buffers.get("ambient-night");
    if (!buf) return;

    this._bedPlaying = true;
    try {
      this._bedGain = ctx.createGain();
      this._bedGain.gain.setValueAtTime(0, ctx.currentTime);
      this._bedGain.gain.linearRampToValueAtTime(gainValue, ctx.currentTime + 2.0);
      this._bedGain.connect(destination);

      this._bedSource = ctx.createBufferSource();
      this._bedSource.buffer = buf;
      this._bedSource.loop = true;
      this._bedSource.connect(this._bedGain);
      this._bedSource.start(ctx.currentTime);
    } catch (e) {
      this._bedPlaying = false;
    }
  }

  /**
   * Stop the looping ambient bed with a short fade-out.
   * @param {AudioContext} ctx
   */
  stopNightBed(ctx) {
    if (!this._bedPlaying) return;
    this._bedPlaying = false;
    const src = this._bedSource;
    const gain = this._bedGain;
    this._bedSource = null;
    this._bedGain = null;
    if (!src || !gain || !ctx) return;
    try {
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + 1.2);
      src.stop(t + 1.3);
    } catch (e) {
      // Already stopped.
    }
  }
}
