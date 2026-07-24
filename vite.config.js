import { defineConfig } from "vite";
import { resolve } from "node:path";

const devHost = process.env.VITE_DEV_HOST ?? "127.0.0.1";
const devPort = Number(process.env.PORT ?? process.env.VITE_DEV_PORT ?? 5173);
const previewHost = process.env.VITE_PREVIEW_HOST ?? "127.0.0.1";

export default defineConfig({
  server: {
    host: devHost,
    port: devPort,
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
