import { describe, expect, it } from "vitest";
import { shouldTriggerSecretBossPhase } from "../src/fps/systems/progressionRules";

describe("secret boss phase trigger", () => {
  it("stays disabled in endless survival mode", () => {
    expect(shouldTriggerSecretBossPhase(11, 12, false)).toBe(false);
    expect(shouldTriggerSecretBossPhase(12, 12, false)).toBe(false);
    expect(shouldTriggerSecretBossPhase(24, 12, false)).toBe(false);
    expect(shouldTriggerSecretBossPhase(12, 12, true)).toBe(false);
  });
});
