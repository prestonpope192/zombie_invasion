import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    environmentOptions: {
      jsdom: {
        url: "http://127.0.0.1:5173/",
      },
    },
    include: ["test/**/*.test.js"],
    setupFiles: ["test/setupLocalStorage.js"],
  },
});
