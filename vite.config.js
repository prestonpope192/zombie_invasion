import { defineConfig } from "vite";
import { resolve } from "node:path";

const devHost = process.env.VITE_DEV_HOST ?? "127.0.0.1";
const previewHost = process.env.VITE_PREVIEW_HOST ?? "127.0.0.1";

export default defineConfig({
  server: {
    host: devHost,
    port: 5173,
  },
  preview: {
    host: previewHost,
    port: 8080,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        playcanvas: resolve(__dirname, "playcanvas.html"),
      },
    },
  },
});
