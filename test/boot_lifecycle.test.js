import { afterEach, describe, expect, it, vi } from "vitest";
import { createBootOverlayController, runBootAttempt } from "../src/bootLifecycle.js";

function makeBootElements() {
  const classes = new Set();
  const attributes = new Map();
  const handlers = new Map();
  const element = {
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
    },
    setAttribute: (name, value) => attributes.set(name, value),
    querySelector: (selector) => selector === "[data-zi-boot-retry]" ? retryButton : message,
  };
  const retryButton = {
    addEventListener: (type, handler) => handlers.set(type, handler),
  };
  const message = { textContent: "Hold the village through the night" };
  const windowObject = {
    listeners: new Map(),
    addEventListener(type, handler) {
      this.listeners.set(type, handler);
    },
    removeEventListener(type, handler) {
      if (this.listeners.get(type) === handler || type === "pointerdown") this.listeners.delete(type);
    },
  };
  return { element, retryButton, message, windowObject, classes, attributes, handlers };
}

function makeController(options = {}) {
  const parts = makeBootElements();
  return {
    ...parts,
    controller: createBootOverlayController({ element: parts.element, windowObject: parts.windowObject, ...options }),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("boot overlay lifecycle", () => {
  it("keeps ordinary pointer dismissal hidden and click-through", () => {
    vi.useFakeTimers();
    const { controller, windowObject, classes } = makeController();

    windowObject.listeners.get("pointerdown")({ target: { closest: () => null } });

    expect(controller.state).toBe("hidden");
    expect(classes.has("is-hidden")).toBe(true);
    vi.advanceTimersByTime(450);
    expect(controller.state).toBe("gone");
    expect(classes.has("is-gone")).toBe(true);
  });

  it("keeps ordinary key dismissal working", () => {
    vi.useFakeTimers();
    const { controller, windowObject, classes } = makeController();

    windowObject.listeners.get("keydown")();

    expect(controller.state).toBe("hidden");
    expect(classes.has("is-hidden")).toBe(true);
    vi.advanceTimersByTime(450);
    expect(controller.state).toBe("gone");
  });

  it("restores failure after the safety timer hid the overlay", () => {
    vi.useFakeTimers();
    const { controller, classes, message } = makeController();

    vi.advanceTimersByTime(4000);
    expect(controller.state).toBe("hidden");
    controller.showFailure();

    expect(controller.state).toBe("failed");
    expect(classes.has("is-hidden")).toBe(false);
    expect(classes.has("is-gone")).toBe(false);
    expect(classes.has("is-error")).toBe(true);
    expect(message.textContent).toMatch(/couldn't start/i);
  });

  it("invalidates a pending is-gone transition and ignores first-frame hides after failure", () => {
    vi.useFakeTimers();
    const { controller, windowObject, classes } = makeController();
    windowObject.listeners.get("pointerdown")({ target: { closest: () => null } });
    controller.showFailure();
    vi.advanceTimersByTime(500);
    controller.hide();

    expect(controller.state).toBe("failed");
    expect(classes.has("is-gone")).toBe(false);
    expect(classes.has("is-error")).toBe(true);
  });

  it("cannot dismiss a failed overlay through pointer, key, or safety timeout", () => {
    vi.useFakeTimers();
    const { controller, windowObject, classes } = makeController();
    const pointerDismiss = windowObject.listeners.get("pointerdown");
    const keyDismiss = windowObject.listeners.get("keydown");
    vi.advanceTimersByTime(3999);
    controller.showFailure();

    pointerDismiss({ target: { closest: () => null } });
    keyDismiss();
    vi.advanceTimersByTime(5000);

    expect(controller.state).toBe("failed");
    expect(classes.has("is-error")).toBe(true);
    expect(classes.has("is-hidden")).toBe(false);
    expect(classes.has("is-gone")).toBe(false);
  });

  it("keeps Retry actionable without treating its pointerdown as dismissal", () => {
    const onRetry = vi.fn();
    const { controller, retryButton, windowObject, handlers } = makeController({ onRetry });
    controller.showFailure();

    windowObject.listeners.get("pointerdown")?.({
      target: { closest: (selector) => selector === "[data-zi-boot-retry]" ? retryButton : null },
    });
    handlers.get("click")();

    expect(controller.state).toBe("failed");
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("preserves boothold for normal boot but still allows failures to surface", () => {
    vi.useFakeTimers();
    const { controller, windowObject, classes } = makeController({ hold: true });

    expect(windowObject.listeners.size).toBe(0);
    vi.advanceTimersByTime(5000);
    expect(controller.state).toBe("loading");
    controller.showFailure();
    expect(controller.state).toBe("failed");
    expect(classes.has("is-error")).toBe(true);
  });
});

describe("boot attempt error handling", () => {
  it("surfaces asynchronous import rejection", async () => {
    const error = new Error("module load failed");
    const onFailure = vi.fn();
    const started = await runBootAttempt({
      load: () => Promise.reject(error),
      start: vi.fn(),
      onFailure,
    });

    expect(started).toBe(false);
    expect(onFailure).toHaveBeenCalledWith(error);
  });

  it("surfaces synchronous startup failure", async () => {
    const error = new Error("constructor failed");
    const onFailure = vi.fn();
    const started = await runBootAttempt({
      load: async () => ({}),
      start: () => { throw error; },
      onFailure,
    });

    expect(started).toBe(false);
    expect(onFailure).toHaveBeenCalledWith(error);
  });
});
