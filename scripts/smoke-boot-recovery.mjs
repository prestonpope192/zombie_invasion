import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { findAvailablePort } from "./smoke-port.mjs";

const host = "127.0.0.1";
const preferredPort = Number(process.env.BOOT_RECOVERY_SMOKE_PORT || 5178);
const screenshotDirectory = process.env.BOOT_RECOVERY_SMOKE_DIR || "output/playwright";
let server = null;
let browser = null;

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
  throw new Error(`boot recovery smoke server did not become ready: ${url}`);
}

async function installOneShotImportFailure(page, delayMs = 100) {
  let requests = 0;
  await page.route("**/src/playcanvas/main.js*", async (route) => {
    requests += 1;
    if (requests === 1) {
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
      await route.abort("failed");
    } else {
      await route.continue();
    }
  });
  return () => requests;
}

async function installOnboardingConstructorFailure(page) {
  await page.addInitScript(() => {
    const nativeGetContext = HTMLCanvasElement.prototype.getContext;
    const failureKey = "zi_test_failed_after_onboarding_focus";
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      const onboarding = document.querySelector("#zi-onboarding");
      if (["webgl2", "webgl", "experimental-webgl"].includes(type)
        && !sessionStorage.getItem(failureKey)
        && onboarding && !onboarding.hidden && onboarding.contains(document.activeElement)) {
        sessionStorage.setItem(failureKey, "1");
        window.__ziFailureAfterOnboardingFocus = true;
        throw new Error("injected PlayCanvas context initialization failure");
      }
      return nativeGetContext.call(this, type, ...args);
    };
  });
}

async function verifyRecoveredPage(page, errors) {
  await page.waitForFunction(
    () => document.body.innerText.includes("WAVE") && document.body.innerText.includes("VILLAGE"),
    null,
    { timeout: 10000 },
  );
  assert(await page.locator("#app").innerText().then((text) => text.includes("WAVE") && text.includes("VILLAGE")),
    "Retry reload did not render the PlayCanvas game HUD");
  assert(await page.locator("#zi-boot.is-error").count() === 0, "Retry reload remained in the boot failure state");
  assert(errors.every((message) => message.includes("Failed to load resource") || message.includes("failed to boot")),
    `unexpected browser errors after Retry: ${errors.join(" | ")}`);
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
  await mkdir(screenshotDirectory, { recursive: true });
  browser = await chromium.launch({
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });

  const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const desktopErrors = [];
  desktop.on("pageerror", (error) => desktopErrors.push(error.message));
  desktop.on("console", (message) => {
    if (message.type() === "error") desktopErrors.push(message.text());
  });
  const desktopRequestCount = await installOneShotImportFailure(desktop);
  const firstDesktopImport = desktop.waitForRequest((request) => request.url().includes("/src/playcanvas/main.js"));
  await desktop.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await firstDesktopImport;
  await desktop.mouse.click(640, 400);
  await desktop.waitForSelector("#zi-boot.is-error", { timeout: 10000 });
  await desktop.waitForTimeout(500);
  const desktopErrorState = await desktop.locator("#zi-boot").evaluate((element) => {
    const retry = element.querySelector("[data-zi-boot-retry]");
    const rect = retry.getBoundingClientRect();
    return {
      visible: getComputedStyle(element).opacity === "1" && getComputedStyle(element).pointerEvents === "auto",
      retryVisible: rect.width >= 44 && rect.height >= 44 && getComputedStyle(retry).display !== "none",
      retryCenter: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
      staleGone: element.classList.contains("is-gone"),
      message: element.querySelector("[data-zi-boot-message]")?.textContent,
    };
  });
  assert(desktopErrorState.visible, "failure overlay was not restored as a pointer target");
  assert(desktopErrorState.retryVisible, "Retry did not have a visible hit target");
  assert(!desktopErrorState.staleGone, "pending ordinary-hide callback hid the failure overlay");
  assert(/couldn't start/i.test(desktopErrorState.message), "failure copy was not shown");
  const desktopScreenshot = `${screenshotDirectory}/boot-recovery-desktop.png`;
  await desktop.screenshot({ path: desktopScreenshot, fullPage: false });
  const desktopNavigation = desktop.waitForEvent("framenavigated");
  await desktop.mouse.click(desktopErrorState.retryCenter.x, desktopErrorState.retryCenter.y);
  await desktopNavigation;
  await verifyRecoveredPage(desktop, desktopErrors);
  assert(desktopRequestCount() >= 2, "desktop Retry did not reload the failed game module");

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const mobile = await mobileContext.newPage();
  const mobileErrors = [];
  mobile.on("pageerror", (error) => mobileErrors.push(error.message));
  mobile.on("console", (message) => {
    if (message.type() === "error") mobileErrors.push(message.text());
  });
  const mobileRequestCount = await installOneShotImportFailure(mobile, 0);
  await mobile.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await mobile.waitForSelector("#zi-boot.is-error", { timeout: 10000 });
  const mobileRetry = mobile.locator("[data-zi-boot-retry]");
  assert(await mobileRetry.isVisible(), "touch Retry button was not visible");
  const mobileScreenshot = `${screenshotDirectory}/boot-recovery-touch.png`;
  await mobile.screenshot({ path: mobileScreenshot, fullPage: false });
  const retriedMobileImport = mobile.waitForResponse((response) => response.url().includes("/src/playcanvas/main.js"));
  const mobileNavigation = mobile.waitForEvent("framenavigated");
  await mobileRetry.tap();
  await mobileNavigation;
  const mobileImportResponse = await retriedMobileImport;
  await mobile.waitForLoadState("domcontentloaded");
  assert(mobileImportResponse.status() === 200, `touch Retry module response was ${mobileImportResponse.status()}`);
  assert(mobileRequestCount() >= 2, "touch Retry did not reload the failed game module");
  assert(await mobile.locator("#zi-boot.is-error").count() === 0, "touch Retry remained in the boot failure state");

  const constructorFailure = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await installOnboardingConstructorFailure(constructorFailure);
  let constructorRequests = 0;
  await constructorFailure.route("**/src/playcanvas/main.js*", async (route) => {
    constructorRequests += 1;
    await route.continue();
  });
  await constructorFailure.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await constructorFailure.waitForSelector("#zi-boot.is-error", { timeout: 15000 });
  assert(await constructorFailure.evaluate(() => window.__ziFailureAfterOnboardingFocus === true),
    "constructor failure did not occur after onboarding focus was trapped");
  assert(await constructorFailure.evaluate(() => {
    const app = document.querySelector("#app");
    const retry = document.querySelector("[data-zi-boot-retry]");
    return app.inert && app.getAttribute("aria-hidden") === "true" && document.activeElement === retry;
  }), "failure did not inert the game and focus Retry");
  await constructorFailure.keyboard.press("Shift+Tab");
  assert(await constructorFailure.evaluate(() => document.activeElement === document.querySelector("[data-zi-boot-retry]")),
    "an active onboarding trap redirected Shift-Tab away from Retry");
  const constructorNavigation = constructorFailure.waitForEvent("framenavigated");
  await constructorFailure.keyboard.press("Enter");
  await constructorNavigation;
  await constructorFailure.waitForFunction(() => Boolean(window.__playCanvasZombieGame), null, { timeout: 10000 });
  assert(await constructorFailure.locator("#zi-boot.is-error").count() === 0,
    "keyboard Retry remained in the boot failure state");
  assert(constructorRequests >= 2, "keyboard Retry did not reload after the constructor failure");
  await constructorFailure.close();

  console.log(JSON.stringify({
    desktop: { failureRestored: true, staleCallbackIgnored: true, retryReloaded: true, screenshot: desktopScreenshot },
    touch: { failureRestored: true, retryReloaded: true, moduleStatus: mobileImportResponse.status(), screenshot: mobileScreenshot },
    onboardingConstructorFailure: { focusTrapped: true, underlyingAppInert: true, shiftTabContained: true, keyboardRetryReloaded: true },
    target: "local",
  }));
  await mobileContext.close();
  await desktop.close();
} catch (error) {
  console.error(`boot recovery smoke failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (server) {
    server.kill();
    server.unref();
  }
}
