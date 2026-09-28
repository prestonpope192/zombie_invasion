export const STORAGE_PROBE_KEY_PREFIX = "__zi_storage_probe__";

let sessionOnly = false;
let probeSequence = 0;
const listeners = new Set();

function getStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function isSessionOnly() {
  return sessionOnly;
}

export function markStorageUnavailable() {
  if (sessionOnly) return;
  sessionOnly = true;
  for (const listener of listeners) {
    try { listener(true); } catch { /* status reporting must not break gameplay */ }
  }
}

export function subscribeStorageStatus(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function safeStorageGetItem(key) {
  const storage = getStorage();
  if (!storage) {
    markStorageUnavailable();
    return null;
  }
  try {
    return storage.getItem(key);
  } catch {
    markStorageUnavailable();
    return null;
  }
}

export function safeStorageSetItem(key, value) {
  const storage = getStorage();
  if (!storage) {
    markStorageUnavailable();
    return false;
  }
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    markStorageUnavailable();
    return false;
  }
}

export function probeBrowserStorage() {
  const storage = getStorage();
  if (!storage) {
    markStorageUnavailable();
    return false;
  }

  let key;
  try {
    let attempts = 0;
    do {
      key = `${STORAGE_PROBE_KEY_PREFIX}${Date.now()}_${probeSequence++}_${Math.random().toString(36).slice(2)}`;
      attempts += 1;
      if (attempts > 8) throw new Error("could not reserve a probe key");
    } while (storage.getItem(key) !== null);
  } catch {
    markStorageUnavailable();
    return false;
  }

  let writeAttempted = false;
  let available = false;
  try {
    writeAttempted = true;
    storage.setItem(key, "probe");
    available = storage.getItem(key) === "probe";
  } catch {
    available = false;
  } finally {
    if (writeAttempted) {
      let cleaned = false;
      for (let attempt = 0; attempt < 2 && !cleaned; attempt += 1) {
        try {
          storage.removeItem(key);
          cleaned = storage.getItem(key) === null;
        } catch {
          cleaned = false;
        }
      }
      available = available && cleaned;
    }
  }

  if (!available) markStorageUnavailable();
  return available;
}

export function resetStorageStatusForTests() {
  sessionOnly = false;
  probeSequence = 0;
  listeners.clear();
}
