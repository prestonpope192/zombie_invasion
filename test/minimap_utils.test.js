import { describe, expect, it } from "vitest";
import { worldRadiusToMiniMapPx, worldToMiniMapPoint } from "../src/fps/systems/minimapUtils";

describe("minimap utils", () => {
  it("maps world center to minimap center", () => {
    const point = worldToMiniMapPoint({
      x: 0,
      z: 0,
      worldHalfExtent: 42,
      mapSizePx: 180,
      paddingPx: 10,
    });
    expect(point.x).toBeCloseTo(90);
    expect(point.y).toBeCloseTo(90);
  });

  it("clamps out-of-bounds points to minimap edge", () => {
    const point = worldToMiniMapPoint({
      x: 999,
      z: -999,
      worldHalfExtent: 42,
      mapSizePx: 180,
      paddingPx: 10,
    });
    expect(point.x).toBe(170);
    expect(point.y).toBe(10);
  });

  it("converts world radius into pixel radius", () => {
    const radius = worldRadiusToMiniMapPx({
      radius: 5.6,
      worldHalfExtent: 42,
      mapSizePx: 180,
      paddingPx: 10,
      minPx: 1,
      maxPx: 26,
    });
    expect(radius).toBeGreaterThan(8);
    expect(radius).toBeLessThan(14);
  });
});
