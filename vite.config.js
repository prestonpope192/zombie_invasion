import { defineConfig } from "vite";

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
});
