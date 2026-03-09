import { describe, expect, it } from "vitest";
import { computeHealthRatio, computeVillageDamageStage } from "../src/fps/systems/villageFeedback";

describe("village feedback helpers", () => {
  it("clamps health ratio safely", () => {
    expect(computeHealthRatio(100, 100)).toBe(1);
    expect(computeHealthRatio(50, 100)).toBe(0.5);
    expect(computeHealthRatio(-10, 100)).toBe(0);
    expect(computeHealthRatio(180, 100)).toBe(1);
    expect(computeHealthRatio(20, 0)).toBe(0);
  });

  it("maps village health to damage stages", () => {
    expect(computeVillageDamageStage(700, 700)).toBe(0);
    expect(computeVillageDamageStage(525, 700)).toBe(1);
    expect(computeVillageDamageStage(350, 700)).toBe(2);
    expect(computeVillageDamageStage(175, 700)).toBe(3);
    expect(computeVillageDamageStage(20, 700)).toBe(3);
  });
});
