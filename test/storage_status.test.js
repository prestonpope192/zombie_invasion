import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isSessionOnly,
  probeBrowserStorage,
  resetStorageStatusForTests,
  safeStorageGetItem,
  safeStorageSetItem,
  STORAGE_PROBE_KEY_PREFIX,
} from "../src/playcanvas/storageStatus";
import { createSliceState, loadPlayCanvasSave, persistPlayCanvasSave, PLAYCANVAS_SAVE_KEY } from "../src/playcanvas/sliceSimulation";

function memoryStorage(seed = {}) {
  const entries = new Map(Object.entries(seed));
  return {
    entries,
    getItem: vi.fn((key) => entries.has(key) ? entries.get(key) : null),
    setItem: vi.fn((key, value) => entries.set(key, String(value))),
    removeItem: vi.fn((key) => entries.delete(key)),
  };
}

describe("PlayCanvas storage status", () => {
  let storageDescriptor;

  beforeEach(() => {
    storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    resetStorageStatusForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (storageDescriptor) Object.defineProperty(globalThis, "localStorage", storageDescriptor);
    else delete globalThis.localStorage;
    resetStorageStatusForTests();
  });

  it("probes healthy storage and removes its temporary key without changing the save", () => {
    const originalSave = JSON.stringify({ version: 2, coins: 321 });
    const storage = memoryStorage({ [PLAYCANVAS_SAVE_KEY]: originalSave });
    vi.stubGlobal("localStorage", storage);

    expect(probeBrowserStorage()).toBe(true);
    expect(isSessionOnly()).toBe(false);
    expect(storage.entries.get(PLAYCANVAS_SAVE_KEY)).toBe(originalSave);
    expect([...storage.entries.keys()].filter((key) => key.startsWith(STORAGE_PROBE_KEY_PREFIX))).toEqual([]);
  });

  it("marks absent storage unavailable", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(probeBrowserStorage()).toBe(false);
    expect(isSessionOnly()).toBe(true);
  });

  it("marks a throwing localStorage property getter unavailable", () => {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get: () => { throw new Error("denied"); } });
    expect(probeBrowserStorage()).toBe(false);
    expect(isSessionOnly()).toBe(true);
  });

  it("marks probe reads unavailable", () => {
    const storage = memoryStorage();
    storage.getItem.mockImplementation((key) => {
      if (key.startsWith(STORAGE_PROBE_KEY_PREFIX)) throw new Error("read denied");
      return null;
    });
    vi.stubGlobal("localStorage", storage);
    expect(probeBrowserStorage()).toBe(false);
    expect(isSessionOnly()).toBe(true);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("marks probe writes unavailable and removes a partially written key", () => {
    const storage = memoryStorage();
    storage.setItem.mockImplementation((key, value) => {
      storage.entries.set(key, String(value));
      throw new Error("quota denied after write");
    });
    vi.stubGlobal("localStorage", storage);
    expect(probeBrowserStorage()).toBe(false);
    expect(isSessionOnly()).toBe(true);
    expect([...storage.entries.keys()].filter((key) => key.startsWith(STORAGE_PROBE_KEY_PREFIX))).toEqual([]);
  });

  it("marks mismatched probe readback unavailable and cleans up", () => {
    const storage = memoryStorage();
    storage.getItem.mockImplementation((key) => key.startsWith(STORAGE_PROBE_KEY_PREFIX) ? null : null);
    vi.stubGlobal("localStorage", storage);
    expect(probeBrowserStorage()).toBe(false);
    expect(isSessionOnly()).toBe(true);
    expect([...storage.entries.keys()].filter((key) => key.startsWith(STORAGE_PROBE_KEY_PREFIX))).toEqual([]);
  });

  it("retries one transient cleanup failure and verifies no probe key remains", () => {
    const storage = memoryStorage();
    storage.removeItem.mockImplementationOnce(() => { throw new Error("temporary cleanup failure"); });
    vi.stubGlobal("localStorage", storage);
    expect(probeBrowserStorage()).toBe(true);
    expect(storage.removeItem).toHaveBeenCalledTimes(2);
    expect(isSessionOnly()).toBe(false);
    expect([...storage.entries.keys()].filter((key) => key.startsWith(STORAGE_PROBE_KEY_PREFIX))).toEqual([]);
  });

  it("fails closed when cleanup remains denied and records the unavoidable probe residue", () => {
    const storage = memoryStorage();
    storage.removeItem.mockImplementation(() => { throw new Error("cleanup denied"); });
    vi.stubGlobal("localStorage", storage);
    expect(probeBrowserStorage()).toBe(false);
    expect(isSessionOnly()).toBe(true);
    expect([...storage.entries.keys()].filter((key) => key.startsWith(STORAGE_PROBE_KEY_PREFIX))).toHaveLength(1);
  });

  it("reports later save write failure without throwing and preserves in-memory state", () => {
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    const state = createSliceState({ coins: 55, ownedWeapons: ["pipe"] });
    expect(probeBrowserStorage()).toBe(true);
    expect(persistPlayCanvasSave(state)?.coins).toBe(55);
    expect(isSessionOnly()).toBe(false);
    const savedValue = storage.entries.get(PLAYCANVAS_SAVE_KEY);
    storage.setItem.mockImplementation(() => { throw new Error("save denied"); });

    let failedSave;
    expect(() => { failedSave = persistPlayCanvasSave(state); }).not.toThrow();
    expect(failedSave).toBeNull();
    expect(isSessionOnly()).toBe(true);
    expect(state.coins).toBe(55);
    expect(storage.entries.get(PLAYCANVAS_SAVE_KEY)).toBe(savedValue);
  });

  it("uses safe reads and writes when storage methods throw", () => {
    const storage = memoryStorage();
    storage.getItem.mockImplementation(() => { throw new Error("read denied"); });
    storage.setItem.mockImplementation(() => { throw new Error("write denied"); });
    vi.stubGlobal("localStorage", storage);
    expect(safeStorageGetItem("zi_haptics")).toBeNull();
    expect(safeStorageSetItem("zi_haptics", "false")).toBe(false);
    expect(isSessionOnly()).toBe(true);
  });

  it("retains existing save/load behavior after a healthy probe", () => {
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    const state = createSliceState({ coins: 321, ownedWeapons: ["pipe"] });
    expect(persistPlayCanvasSave(state)?.coins).toBe(321);
    expect(loadPlayCanvasSave()?.coins).toBe(321);
    expect(isSessionOnly()).toBe(false);
  });
});
