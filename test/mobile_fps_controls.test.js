// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { MobileFpsControls } from "../src/fps/systems/mobileFpsControls";

function pointerEvent(type, props = {}) {
  return new Event(type, { bubbles: true, cancelable: true, ...props });
}

describe("MobileFpsControls", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    window.matchMedia = () => ({ matches: true });
    Element.prototype.setPointerCapture = () => {};
  });

  it("builds touch controls only on coarse pointers and hides contextual USE by default", () => {
    const controls = new MobileFpsControls();

    expect(controls.enabled).toBe(true);
    expect(document.querySelector(".fps-mobile-controls")).toBeTruthy();
    expect(controls.buttons.get("fire")).toBeTruthy();
    expect(controls.buttons.get("interact").style.display).toBe("none");

    controls.setButtonVisible("interact", true);
    expect(controls.buttons.get("interact").style.display).toBe("inline-flex");
  });

  it("supports hold, toggle, and one-shot button semantics", () => {
    const controls = new MobileFpsControls();
    const fire = controls.buttons.get("fire");
    const crouch = controls.buttons.get("crouch");
    const map = controls.buttons.get("map");

    fire.dispatchEvent(pointerEvent("pointerdown"));
    expect(controls.snapshot().fire).toBe(true);
    fire.dispatchEvent(pointerEvent("pointerup"));
    expect(controls.snapshot().fire).toBe(true);

    crouch.dispatchEvent(pointerEvent("pointerdown"));
    expect(controls.snapshot().crouch).toBe(true);
    crouch.dispatchEvent(pointerEvent("pointerdown"));
    expect(controls.snapshot().crouch).toBe(false);

    map.dispatchEvent(pointerEvent("pointerdown"));
    expect(controls.snapshot().map).toBe(true);
    expect(controls.snapshot().map).toBe(false);
  });

  it("can be shown and hidden without destroying state", () => {
    const controls = new MobileFpsControls();

    controls.hide();
    expect(controls.root.style.display).toBe("none");

    controls.show();
    expect(controls.root.style.display).toBe("block");
  });
});
