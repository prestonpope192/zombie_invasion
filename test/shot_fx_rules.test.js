import { describe, expect, it } from "vitest";
import { computeBallisticTracerDrop } from "../src/playcanvas/shotFxRules";

describe("PlayCanvas shot FX rules", () => {
  it("scales ballistic tracer sag from shot drop without exceeding the visual cap", () => {
    expect(computeBallisticTracerDrop({ dropMeters: 0.4, distanceMeters: 40 }, 40)).toBe(1.2);
    expect(computeBallisticTracerDrop({ dropMeters: 2, distanceMeters: 40 }, 40)).toBe(1.6);
  });

  it("reduces sag when the rendered tracer is shorter than the full shot distance", () => {
    const full = computeBallisticTracerDrop({ dropMeters: 0.4, distanceMeters: 40 }, 40);
    const half = computeBallisticTracerDrop({ dropMeters: 0.4, distanceMeters: 40 }, 20);

    expect(half).toBeLessThan(full);
    expect(half).toBe(0.3);
  });

  it("ignores missing or invalid ballistic data", () => {
    expect(computeBallisticTracerDrop(null, 20)).toBe(0);
    expect(computeBallisticTracerDrop({ dropMeters: Number.NaN, distanceMeters: 20 }, 20)).toBe(0);
    expect(computeBallisticTracerDrop({ dropMeters: 0.2, distanceMeters: 20 }, 0)).toBe(0);
  });
});
