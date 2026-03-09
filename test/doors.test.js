import { describe, expect, it } from "vitest";
import { canInteractWithDoor, nextDoorState } from "../src/fps/systems/doorRules";

describe("door interaction rules", () => {
  it("requires interact range", () => {
    expect(canInteractWithDoor(1.9, 2.2)).toBe(true);
    expect(canInteractWithDoor(2.4, 2.2)).toBe(false);
  });

  it("toggles open/close state", () => {
    expect(nextDoorState(false)).toBe(true);
    expect(nextDoorState(true)).toBe(false);
  });
});
