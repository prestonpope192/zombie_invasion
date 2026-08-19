import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { findAvailablePort } from "./smoke-port.mjs";

const host = "127.0.0.1";
const preferredPort = Number(process.env.LEGACY_SMOKE_PORT || 5177);
const screenshotPath = process.env.LEGACY_SMOKE_SCREENSHOT || "output/playwright/legacy-route.png";

let server = null;
let browser = null;
let exitCode = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForServer(url) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`legacy smoke server did not become ready: ${url}`);
}

try {
  const port = await findAvailablePort(preferredPort, host);
  const baseUrl = `http://${host}:${port}`;
  server = spawn("npm", ["run", "dev", "--", "--host", host, "--port", String(port)], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  await waitForServer(`${baseUrl}/?legacy=1`);

  await mkdir("output/playwright", { recursive: true });
  browser = await chromium.launch({
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText ?? "";
    const expectedAudioAbort = request.url().includes("/audio/music/") && errorText === "net::ERR_ABORTED";
    if (!expectedAudioAbort) {
      errors.push(`requestfailed: ${request.url()} ${errorText}`);
    }
  });

  await page.goto(`${baseUrl}/?legacy=1`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForFunction(() => typeof window.render_game_to_text === "function", { timeout: 5000 });
  await page.waitForFunction(
    () => document.querySelector("#zi-boot")?.classList.contains("is-gone") === true,
    { timeout: 5000 },
  );

  const state = await page.evaluate(() => ({
    url: window.location.href,
    text: window.render_game_to_text(),
    startButton: Boolean(document.querySelector('[data-action="start"]')),
    canvas: Boolean(document.querySelector("canvas")),
    bootOverlayGone: document.querySelector("#zi-boot")?.classList.contains("is-gone") === true,
  }));
  const parsed = JSON.parse(state.text);
  assert(state.url.includes("legacy=1"), "legacy query flag was not preserved");
  assert(parsed.mode === "menu", `legacy runtime did not reach menu mode: ${state.text}`);
  assert(state.startButton, "legacy menu did not render the Start Mission button");
  assert(state.canvas, "legacy runtime did not render a canvas");
  assert(state.bootOverlayGone, "legacy boot overlay remained over the ready menu");
  assert(errors.length === 0, `legacy browser errors: ${errors.join(" | ")}`);
  await page.screenshot({ path: screenshotPath, fullPage: false });

  console.log(JSON.stringify({
    route: "legacy",
    mode: parsed.mode,
    startButton: state.startButton,
    canvas: state.canvas,
    bootOverlayGone: state.bootOverlayGone,
    screenshot: screenshotPath,
  }));
} catch (error) {
  exitCode = 1;
  console.error(`legacy smoke failed: ${error.message}`);
} finally {
  await browser?.close();
  if (server) {
    server.kill();
    server.unref();
  }
}

process.exitCode = exitCode;
