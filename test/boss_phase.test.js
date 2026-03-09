import { describe, expect, it } from "vitest";
import { shouldTriggerSecretBossPhase } from "../src/fps/systems/progressionRules";

describe("secret boss phase trigger", () => {
  it("starts only after final wave clear when not already active", () => {
    expect(shouldTriggerSecretBossPhase(11, 12, false)).toBe(false);
    expect(shouldTriggerSecretBossPhase(12, 12, false)).toBe(true);
    expect(shouldTriggerSecretBossPhase(12, 12, true)).toBe(false);
  });
});
