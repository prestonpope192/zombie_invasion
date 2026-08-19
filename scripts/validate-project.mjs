import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

function validateSourceContracts() {
  const scripts = packageJson.scripts ?? {};
  for (const name of ["test:unit", "test:build", "test:smoke", "test:legacy", "validate", "validate:dist", "verify"]) {
    assert(scripts[name], `missing canonical script: ${name}`);
  }

  const main = read("src/main.js");
  assert(main.includes('params.get("legacy") === "1"'), "legacy route selector is missing");
  assert(main.includes('await import("./fps/app/FpsGame")'), "legacy route is not lazy-loaded");
  assert(main.includes('await import("./playcanvas/main")'), "PlayCanvas route is not lazy-loaded");

  const smoke = read("scripts/smoke-playcanvas-slice.mjs");
  assert(smoke.includes("findAvailablePort"), "smoke test does not resolve a collision-safe port");

  const runtimeContract = read("docs/runtime-contract.md");
  assert(runtimeContract.includes("PlayCanvas"), "runtime contract does not name the primary route");
  assert(runtimeContract.includes("?legacy=1"), "runtime contract does not document the legacy route");

  const cueSource = read("src/fps/systems/musicDirector.js");
  for (const filename of cueSource.matchAll(/src:\s*["`]\/audio\/music\/([^"`]+)["`]/g)) {
    assert(existsSync(join(root, "public/audio/music", filename[1])), `missing runtime audio asset: ${filename[1]}`);
  }
}

function validateDist() {
  const dist = join(root, "dist");
  assert(existsSync(join(dist, "index.html")), "dist/index.html is missing; run the build first");
  const assetDir = join(dist, "assets");
  assert(existsSync(assetDir), "dist/assets is missing; run the build first");
  const jsFiles = readdirSync(assetDir).filter((name) => name.endsWith(".js"));
  assert(jsFiles.length >= 2, "the build collapsed the runtime routes into one JavaScript file");
  for (const filename of ["main_motif.mp3", "shop_intermission_alt.mp3"]) {
    assert(!existsSync(join(dist, "audio/music", filename)), `reference-only asset leaked into dist: ${filename}`);
  }
  const totalBytes = jsFiles.reduce((sum, name) => sum + statSync(join(assetDir, name)).size, 0);
  const largestBytes = Math.max(...jsFiles.map((name) => statSync(join(assetDir, name)).size));
  console.log(`dist contract ok: ${jsFiles.length} JS files, ${(totalBytes / 1024 / 1024).toFixed(2)} MiB total, ${(largestBytes / 1024 / 1024).toFixed(2)} MiB largest`);
}

try {
  validateSourceContracts();
  if (process.argv.includes("--dist")) validateDist();
  console.log(`project contracts ok: ${root}`);
} catch (error) {
  console.error(`project validation failed: ${error.message}`);
  process.exitCode = 1;
}
