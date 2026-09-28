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
        window.__ziSaveWriteAttempts = (window.__ziSaveWriteAttempts ?? 0) + 1;
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
      warningFitsViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
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
  } else if (scenario === "missing") {
    await mkdir(outputDirectory, { recursive: true });
    await page.screenshot({ path: `${outputDirectory}/storage-status-mobile.png` });
  }

  const onboardingDismiss = page.locator('[data-action="onboarding-dismiss"]');
  const startCampaign = page.locator('[data-flow-action="primary"]');
  let startPath;
  if (await onboardingDismiss.isVisible()) {
    if (scenario === "missing") {
      startPath = "onboarding-escape-menu";
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.querySelector("#zi-onboarding")?.hidden === true, null, { timeout: 5000 });
      assert(await startCampaign.isVisible(), `${scenario}: campaign menu did not appear after onboarding dismissal`);
      await startCampaign.click();
    } else {
      startPath = "onboarding-dismiss";
      await onboardingDismiss.click();
      await page.waitForFunction(() => document.querySelector("#zi-onboarding")?.hidden === true, null, { timeout: 5000 });
    }
  } else {
    assert(await startCampaign.isVisible(), `${scenario}: campaign menu was not visible before interaction`);
    startPath = "campaign-menu";
    await startCampaign.click();
  }
  await page.waitForFunction(() => window.__playCanvasZombieGame?.state?.phase === "running", null, { timeout: 8000 });
  if (mobile && shouldWarn) {
    const gameplayLayout = await page.evaluate(() => {
      const bounds = (selector) => {
        const element = document.querySelector(selector);
        const rect = element?.getBoundingClientRect();
        const style = element && getComputedStyle(element);
        return {
          visible: Boolean(element && !element.hidden && rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && Number(style.opacity) > 0),
          left: rect?.left ?? 0,
          top: rect?.top ?? 0,
          right: rect?.right ?? 0,
          bottom: rect?.bottom ?? 0,
          text: element?.textContent.trim() ?? "",
        };
      };
      const warning = bounds("[data-storage-warning]");
      const toast = bounds(".zi-toast");
      const objective = bounds(".zi-hud-objective");
      const intersects = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      return {
        warning,
        toast,
        objective,
        toastObjectiveOverlap: intersects(toast, objective),
        warningFitsViewport: warning.left >= 0 && warning.top >= 0 && warning.right <= innerWidth && warning.bottom <= innerHeight,
      };
    });
    assert(gameplayLayout.warning.visible && gameplayLayout.warning.text === "SESSION ONLY", `${scenario}: gameplay warning was not visible with exact text`);
    assert(gameplayLayout.warningFitsViewport, `${scenario}: gameplay warning exceeded viewport bounds`);
    assert(gameplayLayout.toast.visible && gameplayLayout.toast.text.length > 0, `${scenario}: gameplay toast was not actually visible`);
    assert(gameplayLayout.objective.visible && gameplayLayout.objective.text.length > 0, `${scenario}: village objective was not actually visible`);
    assert(!gameplayLayout.toastObjectiveOverlap, `${scenario}: gameplay toast overlaps village objective at 390x844`);
  }

  await page.evaluate(() => { window.__ziFailSaveWrites = true; });
  const restartResult = await page.evaluate(() => {
    try {
      window.__playCanvasZombieGame.restartAndStart();
      return { error: null, phase: window.__playCanvasZombieGame.state.phase, coins: window.__playCanvasZombieGame.state.coins };
    } catch (error) {
      return { error: error.message };
    }
  });
  assert(restartResult.error === null, `${scenario}: later save failure escaped through restartAndStart: ${restartResult.error}`);
  assert(restartResult.phase === "running" && Number.isFinite(restartResult.coins), `${scenario}: failed save did not preserve playable in-memory state`);
  await page.waitForFunction(() => {
    const warning = document.querySelector("[data-storage-warning]");
    return warning && !warning.hidden && warning.textContent.trim() === "SESSION ONLY";
  }, null, { timeout: 5000 });
  if (!["missing", "getter-throws"].includes(scenario)) {
    assert(await page.evaluate(() => window.__ziSaveWriteAttempts > 0), `${scenario}: later failed save did not attempt PLAYCANVAS_SAVE_KEY write`);
  }
  assert(await page.locator("[data-storage-warning]").textContent().then((text) => text.trim()) === "SESSION ONLY",
    `${scenario}: later save failure did not show SESSION ONLY`);
  assert(pageErrors.length === 0, `${scenario}: browser threw while keeping the game playable: ${pageErrors.join(" | ")}`);
  await context.close();
  return { scenario, initialWarning: initial.warningVisible, startPath, playable: true, probeKeysAfterProbe: initial.probeKeys.length };
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
