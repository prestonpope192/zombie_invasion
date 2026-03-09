import { describe, expect, it } from "vitest";
import { computeForwardArmPose } from "../src/fps/systems/zombiePoseRules";

describe("zombie pose rules", () => {
  it("returns forward-facing chase arm pose with bounded sway", () => {
    const pose = computeForwardArmPose({
      state: "advance",
      time: 0.42,
      variant: "walker",
    });

    expect(pose).toBeTruthy();
    expect(pose.leftArmPivot.x).toBeLessThan(-0.8);
    expect(pose.rightArmPivot.x).toBeLessThan(-0.8);
    expect(Math.abs(pose.leftArmPivot.x + 1.05)).toBeLessThanOrEqual(0.100001);
    expect(Math.abs(pose.rightArmPivot.x + 1.05)).toBeLessThanOrEqual(0.100001);
    expect(Math.abs(pose.leftForearmPivotX + 0.45)).toBeLessThanOrEqual(0.060001);
    expect(Math.abs(pose.rightForearmPivotX + 0.45)).toBeLessThanOrEqual(0.060001);
  });

  it("returns attack pose with alternating left/right swipe offsets", () => {
    const pose = computeForwardArmPose({
      state: "attack_player",
      time: 0.13,
      variant: "brute",
    });

    expect(pose).toBeTruthy();
    expect(pose.leftArmPivot.x).toBeLessThan(-0.8);
    expect(pose.rightArmPivot.x).toBeLessThan(-0.8);
    expect(pose.leftArmPivot.x).not.toBeCloseTo(pose.rightArmPivot.x, 6);
    expect(pose.leftForearmPivotX).not.toBeCloseTo(pose.rightForearmPivotX, 6);
    expect(pose.leftArmPivot.y).toBeCloseTo(0.1, 6);
    expect(pose.rightArmPivot.y).toBeCloseTo(-0.1, 6);
  });

  it("returns null for non chase/attack states", () => {
    expect(computeForwardArmPose({ state: "hit_react", time: 1, variant: "walker" })).toBeNull();
    expect(computeForwardArmPose({ state: "dead", time: 1, variant: "walker" })).toBeNull();
  });

  it("keeps forward-arm output enabled for all variants in chase and attack", () => {
    const variants = [
      "walker",
      "crawler",
      "flyer",
      "skitter",
      "juggernaut",
      "leaper",
      "pouncer",
      "revenant",
      "armored",
      "brute",
      "runner",
      "mega_zombie",
    ];

    for (const variant of variants) {
      const chase = computeForwardArmPose({ state: "advance", time: 0.2, variant });
      const attack = computeForwardArmPose({ state: "attack_village", time: 0.2, variant });
      expect(chase).toBeTruthy();
      expect(attack).toBeTruthy();
      expect(chase.leftArmPivot.x).toBeLessThan(-0.8);
      expect(chase.rightArmPivot.x).toBeLessThan(-0.8);
      expect(attack.leftArmPivot.x).toBeLessThan(-0.8);
      expect(attack.rightArmPivot.x).toBeLessThan(-0.8);
    }
  });
});
