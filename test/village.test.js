import { describe, expect, it } from "vitest";
import { applyRecoilImpulse, initRecoilState, recoverRecoil } from "../src/fps/systems/weaponBallistics";

describe("recoil and recovery", () => {
  it("accumulates and decays recoil", () => {
    const state = initRecoilState();
    applyRecoilImpulse(state, { vertical: 0.8, horizontal: 0.2, recovery: 6 }, false);
    const peak = state.pitchKick;
    recoverRecoil(state, 0.2);
    expect(peak).toBeGreaterThan(0);
    expect(state.pitchKick).toBeLessThan(peak);
  });
});
