if (typeof globalThis.localStorage === "undefined") {
  const entries = new Map();
  globalThis.localStorage = {
    get length() {
      return entries.size;
    },
    clear() {
      entries.clear();
    },
    getItem(key) {
      return entries.has(String(key)) ? entries.get(String(key)) : null;
    },
    key(index) {
      return Array.from(entries.keys())[index] ?? null;
    },
    removeItem(key) {
      entries.delete(String(key));
    },
    setItem(key, value) {
      entries.set(String(key), String(value));
    },
  };
}
