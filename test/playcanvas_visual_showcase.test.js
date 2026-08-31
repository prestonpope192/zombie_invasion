import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const mainSource = readFileSync(new URL("../src/playcanvas/main.js", import.meta.url), "utf8");
const visualQaSource = readFileSync(new URL("../scripts/visual-qa-playcanvas.mjs", import.meta.url), "utf8");

describe("PlayCanvas visual showcase contract", () => {
  it("keeps showcase camera and clean-surface behavior QA-only", () => {
    expect(mainSource).toContain('get("showcase") === "1"');
    expect(mainSource).toContain("hero-lane-locked");
    expect(mainSource).toContain("updateShowcaseEnemyStaging");
    expect(mainSource).toContain("this.showcaseMode ? glbParam === \"1\" : glbParam !== \"0\"");
    expect(mainSource).toContain("this.weaponRoot.enabled = !this.showcaseMode");
    expect(mainSource).toContain("const facadeZ = z + 1.48");
  });

  it("exposes the visual performance budget and QA signals", () => {
    expect(mainSource).toContain("perfTargetFps=");
    expect(mainSource).toContain("perfBudgetStatus=");
    expect(mainSource).toContain("backbufferPixelBudget=");
    expect(mainSource).toContain("showcaseWeapon=");
    expect(visualQaSource).toContain("desktop");
    expect(visualQaSource).toContain("mobile");
    expect(visualQaSource).toContain("requestfailed");
  });
});
