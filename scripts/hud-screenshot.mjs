/**
 * hud-screenshot.mjs — HUD visual verification
 * Outputs:
 *   output/hud-desktop.png  (1280×800)
 *   output/hud-mobile.png   (375×812)
 */
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const port = 5179;
const host = "127.0.0.1";
const baseUrl = `http://${host}:${port}`;
let server = null;
let browser = null;
let exitCode = 0;

try {
  server = spawn("npm", ["run", "dev", "--", "--host", host, "--port", String(port)], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  server.stdout.on("data", (c) => process.stdout.write(c));
  server.stderr.on("data", (c) => process.stderr.write(c));

  await waitForServer(`${baseUrl}/`);
  await mkdir("output", { recursive: true });

  browser = await chromium.launch({
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });

  async function shoot(viewport, path) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    const logs = [];
    page.on("console", (m) => logs.push({ t: m.type(), tx: m.text() }));
    page.on("pageerror", (e) => logs.push({ t: "pageerror", tx: e.message }));

    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle", timeout: 25000 });
    await page.evaluate((k) => localStorage.removeItem(k), "zombie_invasion_playcanvas_save_v1");
    await page.reload({ waitUntil: "networkidle" });

    // Start campaign via flow panel primary button (action bar is hidden while modal is open)
    await page.locator('[data-flow-action="primary"]').click();

    // Advance sim: skip grace + spawn + partial wave progress
    await page.evaluate(() => {
      const g = window.__playCanvasZombieGame;
      g.state.waveGraceSec = 0;
      window.advanceTime(3500);
      g.state.villageHp = 74;  // depleted but amber zone
      g.state.playerHp = 58;   // mid-green health
      g.state.stamina = 65;
      g.state.coins = 120;
      g.state.kills = 7;
    });
    await page.evaluate(() => window.advanceTime(3000));
    await page.waitForTimeout(600);

    const errors = logs.filter(l => l.t === "pageerror" || l.t === "error");
    if (errors.length) console.error("JS errors:", JSON.stringify(errors));

    await page.screenshot({ path, fullPage: false });
    console.log(`Saved ${path} at ${viewport.width}x${viewport.height}`);
    await page.close();
  }

  await shoot({ width: 1280, height: 800 }, "output/hud-desktop.png");
  await shoot({ width: 375, height: 812 }, "output/hud-mobile.png");

} catch (err) {
  exitCode = 1;
  console.error(err);
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) {
    try { process.kill(-server.pid, "SIGTERM"); } catch { server.kill("SIGTERM"); }
  }
  setTimeout(() => process.exit(exitCode), 50);
}

async function waitForServer(url) {
  const start = Date.now();
  while (Date.now() - start < 20000) {
    try { const r = await fetch(url); if (r.ok) return; } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`Timeout waiting for ${url}`);
}
