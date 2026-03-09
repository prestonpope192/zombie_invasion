import { describe, expect, it } from "vitest";
import { computeHeadshotResult } from "../src/fps/systems/headshotRules";

describe("headshot rules", () => {
  it("flags headshots near the top of the capsule", () => {
    const result = computeHeadshotResult({
      hitPointY: 1.9,
      bodyY: 1.2,
      halfHeight: 0.5,
      radius: 0.36,
      hitboxProfile: "human",
      multiplier: 1.5,
    });
    expect(result.isHeadshot).toBe(true);
    expect(result.multiplier).toBe(1.5);
  });

  it("does not flag body hits as headshots", () => {
    const result = computeHeadshotResult({
      hitPointY: 1.1,
      bodyY: 1.2,
      halfHeight: 0.5,
      radius: 0.36,
      hitboxProfile: "human",
      multiplier: 1.5,
    });
    expect(result.isHeadshot).toBe(false);
    expect(result.multiplier).toBe(1);
  });

  it("uses rendered head position for large zombies when available", () => {
    const nearNeck = computeHeadshotResult({
      hitPointY: 2.02,
      bodyY: 1.2,
      halfHeight: 0.74,
      radius: 0.58,
      hitboxProfile: "mega",
      renderedHeadY: 2.28,
      renderedHeadRadius: 0.34,
      multiplier: 1.5,
    });
    expect(nearNeck.isHeadshot).toBe(false);

    const onHead = computeHeadshotResult({
      hitPointY: 2.11,
      bodyY: 1.2,
      halfHeight: 0.74,
      radius: 0.58,
      hitboxProfile: "mega",
      renderedHeadY: 2.28,
      renderedHeadRadius: 0.34,
      multiplier: 1.5,
    });
    expect(onHead.isHeadshot).toBe(true);
    expect(onHead.multiplier).toBe(1.5);
  });
});
