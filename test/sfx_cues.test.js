import { describe, expect, it, vi } from "vitest";
import { SfxCues } from "../src/playcanvas/sfxCues";

describe("SfxCues", () => {
  it("no-ops safely on every cue while the AudioContext is locked (ctx null)", () => {
    const audio = { ctx: null, playTone: vi.fn() };
    const samples = { playSample: vi.fn(() => false) };
    const cues = new SfxCues({ audio, samples, isSfxEnabled: () => true });

    expect(() => {
      cues.hitConfirm();
      cues.kill();
      cues.headshot();
      cues.streak(10);
      cues.reloadStart();
      cues.reloadFinish();
      cues.empty();
      cues.coin();
      cues.playerDamage();
      cues.heartbeatTick(2.0, 10);
      cues.uiClick();
      cues.shopBuy();
      cues.resetHeartbeat();
    }).not.toThrow();
    expect(audio.playTone).not.toHaveBeenCalled();
    expect(samples.playSample).not.toHaveBeenCalled();
  });

  it("plays synth fallbacks when samples are missing and sfx is enabled", () => {
    const audio = { ctx: {}, playTone: vi.fn() };
    const samples = { playSample: vi.fn(() => false) };
    const cues = new SfxCues({ audio, samples, isSfxEnabled: () => true });

    cues.kill();
    expect(samples.playSample).toHaveBeenCalledWith("impact-flesh", audio.ctx, undefined, expect.any(Object));
    expect(audio.playTone).toHaveBeenCalled();
  });

  it("stays silent when the sfx toggle is off", () => {
    const audio = { ctx: {}, playTone: vi.fn() };
    const samples = { playSample: vi.fn(() => true) };
    const cues = new SfxCues({ audio, samples, isSfxEnabled: () => false });

    cues.kill();
    cues.uiClick();
    expect(audio.playTone).not.toHaveBeenCalled();
    expect(samples.playSample).not.toHaveBeenCalled();
  });
});
