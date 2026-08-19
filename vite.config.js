import { defineConfig } from "vite";
import { resolve } from "node:path";
import { unlink } from "node:fs/promises";

const devHost = process.env.VITE_DEV_HOST ?? "127.0.0.1";
const devPort = Number(process.env.PORT ?? process.env.VITE_DEV_PORT ?? 5173);
const previewHost = process.env.VITE_PREVIEW_HOST ?? "127.0.0.1";

const REFERENCE_ONLY_ASSETS = [
  "audio/music/main_motif.mp3",
  "audio/music/shop_intermission_alt.mp3",
];

function omitReferenceOnlyAssets() {
  return {
    name: "omit-reference-only-assets",
    apply: "build",
    async writeBundle(options) {
      const outDir = resolve(__dirname, options.dir ?? "dist");
      await Promise.all(
        REFERENCE_ONLY_ASSETS.map(async (relativePath) => {
          try {
            await unlink(resolve(outDir, relativePath));
          } catch (error) {
            if (error.code !== "ENOENT") throw error;
          }
        }),
      );
    },
  };
}

export default defineConfig({
  plugins: [omitReferenceOnlyAssets()],
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
