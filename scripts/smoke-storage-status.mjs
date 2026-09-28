import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { findAvailablePort } from "./smoke-port.mjs";

const host = "127.0.0.1";
const preferredPort = Number(process.env.STORAGE_STATUS_SMOKE_PORT || 5179);
const outputDirectory = process.env.STORAGE_STATUS_SMOKE_DIR || "output/playwright";
const saveKey = "zombie_invasion_playcanvas_save_v1";
const probePrefix = "__zi_storage_probe__";
const cases = ["healthy", "missing", "getter-throws", "probe-read-throws", "probe-write-throws", "probe-readback-mismatch", "cleanup-retry"];
let server;
let browser;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForServer(url) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`storage status smoke server did not become ready: ${url}`);
}

async function installStorageCase(page, scenario) {
  await page.addInitScript(({ scenario, saveKey }) => {
    const nativeStorage = window.localStorage;
    window.__ziNativeStorage = nativeStorage;
    const seed = {
      version: 2,
      profileType: "playcanvas_village_v2",
      coins: 321,
      bestWave: 1,
      ownedWeapons: ["pipe"],
      equippedWeaponId: "pipe",
      musicEnabled: true,
      sfxEnabled: true,
    };
    nativeStorage.setItem(saveKey, JSON.stringify(seed));
    nativeStorage.setItem("zi_onboarded", "1");

    if (scenario === "missing") {
      Object.defineProperty(window, "localStorage", { configurable: true, get: () => undefined });
      return;
    }
    if (scenario === "getter-throws") {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get: () => { throw new DOMException("storage access denied", "SecurityError"); },
      });
      return;
    }

    const nativeGet = Storage.prototype.getItem;
    const nativeSet = Storage.prototype.setItem;
    const nativeRemove = Storage.prototype.removeItem;
    let probeSet = false;
    let removeFailures = 0;
    Storage.prototype.getItem = function (key) {
      if (String(key).startsWith("__zi_storage_probe__")) {
        if (scenario === "probe-read-throws") throw new DOMException("read denied", "SecurityError");
        if (scenario === "probe-readback-mismatch" && probeSet) return null;
      }
      return nativeGet.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (String(key).startsWith("__zi_storage_probe__")) {
        probeSet = true;
        if (scenario === "probe-write-throws") throw new DOMException("write denied", "QuotaExceededError");
      }
      if (key === saveKey && window.__ziFailSaveWrites) {
        throw new DOMException("save write denied", "QuotaExceededError");
      }
      return nativeSet.call(this, key, value);
    };
    Storage.prototype.removeItem = function (key) {
      if (scenario === "cleanup-retry" && String(key).startsWith("__zi_storage_probe__") && removeFailures++ === 0) {
        throw new DOMException("temporary cleanup failure", "SecurityError");
      }
      return nativeRemove.call(this, key);
    };
  }, { scenario, saveKey });
}

async function runCase(baseUrl, scenario) {
  const mobile = scenario !== "healthy";
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile,
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await installStorageCase(page, scenario);
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForFunction(() => Boolean(window.render_game_to_text?.()) && document.querySelector("#zi-boot")?.classList.contains("is-gone"), null, { timeout: 20000 });

  const initial = await page.evaluate(({ saveKey, probePrefix }) => {
    const warning = document.querySelector("[data-storage-warning]");
    const rect = warning.getBoundingClientRect();
    const native = window.__ziNativeStorage;
    return {
      warningVisible: !warning.hidden && getComputedStyle(warning).display !== "none" && rect.width > 0 && rect.height > 0,
      warningText: warning.textContent.trim(),
      warningFitsViewport: rect.left >= 0 && rect.right <= innerWidth,
      coins: window.__playCanvasZombieGame?.state?.coins,
      savedValue: native.getItem(saveKey),
      probeKeys: Array.from({ length: native.length }, (_, index) => native.key(index)).filter((key) => key?.startsWith(probePrefix)),
    };
  }, { saveKey, probePrefix });

  const shouldWarn = !["healthy", "cleanup-retry"].includes(scenario);
  assert(initial.warningVisible === shouldWarn, `${scenario}: unexpected initial warning visibility`);
  assert(initial.warningText === "SESSION ONLY", `${scenario}: status text was not exact`);
  assert(initial.warningFitsViewport, `${scenario}: warning exceeded viewport bounds`);
  assert(initial.savedValue === JSON.stringify({
    version: 2,
    profileType: "playcanvas_village_v2",
    coins: 321,
    bestWave: 1,
    ownedWeapons: ["pipe"],
    equippedWeaponId: "pipe",
    musicEnabled: true,
    sfxEnabled: true,
  }), `${scenario}: startup probe changed the game-save value`);
  assert(initial.probeKeys.length === 0, `${scenario}: probe key remained after startup cleanup`);
  if (scenario === "healthy" || scenario === "cleanup-retry") {
    assert(initial.coins === 321, `${scenario}: healthy save was not loaded`);
  }

  if (scenario === "healthy") {
    await mkdir(outputDirectory, { recursive: true });
    await page.screenshot({ path: `${outputDirectory}/storage-status-healthy.png` });
    await page.evaluate(() => { window.__ziFailSaveWrites = true; });
  } else if (scenario === "missing") {
    await mkdir(outputDirectory, { recursive: true });
    await page.screenshot({ path: `${outputDirectory}/storage-status-mobile.png` });
  }

  await page.evaluate(() => window.__playCanvasZombieGame.startOrContinueCampaign());
  await page.waitForFunction(() => window.__playCanvasZombieGame?.state?.phase === "running", null, { timeout: 8000 });
  if (scenario === "healthy") {
    const restartError = await page.evaluate(() => {
      try {
        window.__playCanvasZombieGame.restartAndStart();
        return null;
      } catch (error) {
        return error.message;
      }
    });
    assert(restartError === null, `later save failure escaped through restartAndStart: ${restartError}`);
    await page.waitForFunction(() => !document.querySelector("[data-storage-warning]")?.hidden, null, { timeout: 5000 });
    assert(await page.locator("[data-storage-warning]").textContent().then((text) => text.trim()) === "SESSION ONLY",
      "later save failure did not show SESSION ONLY");
  } else {
    assert(await page.evaluate(() => Number.isFinite(window.__playCanvasZombieGame.state.coins)), `${scenario}: in-memory campaign state was unavailable`);
  }
  assert(pageErrors.length === 0, `${scenario}: browser threw while keeping the game playable: ${pageErrors.join(" | ")}`);
  await context.close();
  return { scenario, initialWarning: initial.warningVisible, playable: true, probeKeysAfterProbe: initial.probeKeys.length };
}

try {
  const port = await findAvailablePort(preferredPort, host);
  const baseUrl = `http://${host}:${port}`;
  server = spawn("npm", ["run", "dev", "--", "--host", host, "--port", String(port)], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  server.stdout.on("data", (chunk) => process.stdout.write(chunk));
  server.stderr.on("data", (chunk) => process.stderr.write(chunk));
  await waitForServer(baseUrl);
  browser = await chromium.launch({
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const results = [];
  for (const scenario of cases) {
    results.push(await runCase(baseUrl, scenario));
    console.log(`[storage-status] ${scenario} passed`);
  }
  console.log(JSON.stringify({ results, screenshots: [`${outputDirectory}/storage-status-mobile.png`, `${outputDirectory}/storage-status-healthy.png`] }));
} catch (error) {
  console.error(`storage status smoke failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (server) {
    try { process.kill(-server.pid, "SIGTERM"); } catch { server.kill("SIGTERM"); }
    server.unref();
  }
}
