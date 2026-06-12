import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const port = Number(process.env.PLAYCANVAS_SMOKE_PORT || 5176);
const host = "127.0.0.1";
const baseUrl = `http://${host}:${port}`;
const targetUrl = process.env.PLAYCANVAS_SMOKE_URL || `${baseUrl}/`;
const screenshotPath = process.env.PLAYCANVAS_SMOKE_SCREENSHOT || "output/playcanvas-slice-smoke.png";

let server = null;
let browser = null;
let exitCode = 0;

try {
  if (!process.env.PLAYCANVAS_SMOKE_URL) {
    server = spawn("npm", ["run", "dev", "--", "--host", host, "--port", String(port)], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });

    server.stdout.on("data", (chunk) => process.stdout.write(chunk));
    server.stderr.on("data", (chunk) => process.stderr.write(chunk));

    await waitForServer(targetUrl);
  }
  await mkdir("output", { recursive: true });

  browser = await chromium.launch({
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const logs = [];
  page.on("console", (msg) => logs.push({ type: msg.type(), text: msg.text() }));
  page.on("pageerror", (err) => logs.push({ type: "pageerror", text: err.message }));
  page.on("requestfailed", (req) => logs.push({ type: "requestfailed", text: `${req.url()} ${req.failure()?.errorText}` }));

  await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 20000 });
  await page.evaluate((saveKey) => localStorage.removeItem(saveKey), "zombie_invasion_playcanvas_save_v1");
  await page.reload({ waitUntil: "networkidle" });
  const readyText = await page.evaluate(() => window.render_game_to_text?.() ?? "");
  const readyPrimaryText = await page.locator('[data-flow-action="primary"]').textContent();
  await page.locator('[data-action="start"]').click();
  // Poll until the game transitions to running phase (up to 5s) before capturing the impact
  // baseline. Capturing immediately after the click races against async state setup and can
  // return an empty string or a stale "ready" snapshot — both will fail the impact assertions.
  const impactBaselineText = await page.waitForFunction(
    () => {
      const t = window.render_playcanvas_game_to_text?.() ?? "";
      return t.includes("phase=running") ? t : null;
    },
    { polling: 100, timeout: 5000 }
  ).then((handle) => handle.jsonValue()).catch(() => "");
  await page.keyboard.press("KeyQ");
  const shopText = await page.evaluate(() => window.render_playcanvas_game_to_text?.() ?? "");
  const shopTypes = await page.evaluate(() => {
    return [...document.querySelectorAll("[data-shop-type]")].map((button) => button.dataset.shopType);
  });
  await page.keyboard.press("KeyQ");
  const yawBeforeDrag = await page.evaluate(() => window.__playCanvasZombieGame?.yaw ?? 0);
  await page.mouse.move(640, 420);
  await page.mouse.down();
  await page.mouse.move(760, 450, { steps: 6 });
  await page.mouse.up();
  const yawAfterDrag = await page.evaluate(() => window.__playCanvasZombieGame?.yaw ?? 0);
  await page.evaluate(() => {
    const game = window.__playCanvasZombieGame;
    if (game) {
      game.yaw = 0;
      game.pitch = -6;
      game.state.player.yaw = 0;
      game.updateCamera();
    }
  });
  await page.evaluate(() => window.advanceTime?.(6200)); // 5.5s grace + buffer for spawns
  const preBlastScreenshot = await page.screenshot({ path: screenshotPath, fullPage: false });
  await page.keyboard.press("KeyG");
  const ordnanceText = await page.evaluate(() => window.render_playcanvas_game_to_text?.() ?? "");
  const advanced = await page.evaluate(() => {
    if (typeof window.advanceTime !== "function") {
      return false;
    }
    window.advanceTime(1000);
    return true;
  });
  await page.waitForTimeout(250);
  const nonBlackPixels = await countNonBlackPixels(page, preBlastScreenshot);
  await page.setViewportSize({ width: 390, height: 760 });
  await page.waitForTimeout(100);
  const mobileControlsVisible = await page.locator('[data-touch-action="fire"]').isVisible();
  const mobileShopVisible = await page.locator('[data-touch-action="shop"]').isVisible();
  const mobileCycleVisible = await page.locator('[data-touch-action="cycle"]').isVisible();
  const mobileOrdnanceVisible = await page.locator('[data-touch-action="ordnance"]').isVisible();
  const mobileFlintVisible = await page.locator('[data-touch-action="flint"]').isVisible();
  const mobileInteractVisible = await page.locator('[data-touch-action="interact"]').isVisible();
  const mobileMapVisible = await page.locator('[data-touch-action="map"]').isVisible();
  const musicToggleVisible = await page.locator('[data-action="music"]').isVisible();
  const sfxToggleVisible = await page.locator('[data-action="sfx"]').isVisible();

  const state = await page.evaluate(() => ({
    text: window.render_playcanvas_game_to_text?.() ?? window.render_playcanvas_slice_to_text?.() ?? "",
    genericText: window.render_game_to_text?.() ?? "",
    canvas: [...document.querySelectorAll("canvas")].map((canvas) => ({
      width: canvas.width,
      height: canvas.height,
      clientWidth: canvas.clientWidth,
      clientHeight: canvas.clientHeight,
    })),
  }));
  const lifecycle = await page.evaluate(() => {
    const game = window.__playCanvasZombieGame;
    if (!game) {
      return { ok: false };
    }
    game.state.phase = "intermission";
    game.state.waveIndex = 0;
    game.state.waveNumber = 1;
    game.state.waveSummary = { wave: 1, kills: game.state.kills, coins: game.state.coins, weapon: "Pistol" };
    game.updateHud();
    const intermissionText = window.render_game_to_text?.() ?? "";
    const intermissionTitle = document.querySelector('[data-flow-field="title"]')?.textContent ?? "";
    const intermissionPrimary = document.querySelector('[data-flow-action="primary"]')?.textContent ?? "";
    game.state.phase = "lost";
    game.state.lastMessage = "Test loss state.";
    game.updateHud();
    const lostText = window.render_game_to_text?.() ?? "";
    const lostTitle = document.querySelector('[data-flow-field="title"]')?.textContent ?? "";
    const lostPrimary = document.querySelector('[data-flow-action="primary"]')?.textContent ?? "";
    game.state.phase = "won";
    game.updateHud();
    const wonText = window.render_game_to_text?.() ?? "";
    const wonTitle = document.querySelector('[data-flow-field="title"]')?.textContent ?? "";
    const wonPrimary = document.querySelector('[data-flow-action="primary"]')?.textContent ?? "";
    return {
      ok: true,
      intermissionText,
      intermissionTitle,
      intermissionPrimary,
      lostText,
      lostTitle,
      lostPrimary,
      wonText,
      wonTitle,
      wonPrimary,
    };
  });

  const blockingLogs = logs.filter((entry) => entry.type === "pageerror" || entry.type === "requestfailed" || entry.type === "error");
  assert(readyText.includes("phase=ready"), "default route did not start in ready phase");
  assert(readyText.includes("flowPanel=ready"), "ready campaign flow panel missing");
  assert(readyText.includes("tutorialStage=ready"), "ready tutorial guidance stage missing");
  assert(readyText.includes("tutorialAction=start_campaign"), "ready tutorial guidance action missing");
  assert(readyPrimaryText?.includes("Start Campaign"), "ready campaign panel primary action is wrong");
  assert(state.text.includes("mode=playcanvas-game"), "full-game hook missing playcanvas-game mode");
  assert(state.genericText.includes("mode=playcanvas-game"), "generic render_game_to_text hook missing PlayCanvas state");
  assert(state.text.includes("style=cinematic-low-poly-survival"), "style hook missing cinematic low-poly marker");
  assert(state.text.includes("composition=target-village-street"), "style hook missing target village-street composition marker");
  assert(state.text.includes("mood=tense-not-too-scary"), "style hook missing not-too-scary mood marker");
  assert(state.text.includes("phase=running"), "slice did not enter running phase");
  assert(state.text.includes("saveVersion=2"), "PlayCanvas save telemetry did not report v2 save version");
  assert(state.text.includes("profileType=playcanvas_village_v2"), "PlayCanvas save telemetry did not report PlayCanvas profile type");
  assert(state.text.includes("tutorialStage=running"), "running tutorial guidance stage missing");
  assert(state.text.includes("flowPanel=hidden"), "campaign flow panel did not hide during running play");
  assert(state.text.includes("miniMap=visible"), "PlayCanvas minimap did not render during running play");
  assert(/miniMapZombies=[1-9]/.test(state.text), "PlayCanvas minimap did not report live zombies");
  assert(/miniMapStructures=[1-9]/.test(state.text), "PlayCanvas minimap did not report village structures");
  assert(state.text.includes("inside=outside"), "PlayCanvas building state did not report outside baseline");
  assert(state.text.includes("openedBuildings=0"), "PlayCanvas building state did not report unopened baseline");
  assert(state.text.includes("rescuedVillagers=0"), "PlayCanvas villager state did not report rescue baseline");
  assert(state.text.includes("deadVillagers=0"), "PlayCanvas villager state did not report death baseline");
  assert(state.text.includes("activeEscort=none"), "PlayCanvas villager state did not report inactive escort baseline");
  assert(state.text.includes("escortHp=none"), "PlayCanvas villager state did not report inactive escort HP baseline");
  assert(state.text.includes("escortHealthBar=hidden"), "PlayCanvas villager state did not report hidden escort health bar baseline");
  assert(state.text.includes("escortDropoff=none"), "PlayCanvas villager state did not report inactive dropoff baseline");
  assert(/availableVillagers=[1-9]/.test(state.text), "PlayCanvas villager state did not report available villagers");
  assert(state.text.includes("perkStartGrenades=0"), "PlayCanvas perk state did not report default starting grenades");
  assert(state.text.includes("perkKillCoins=1.00"), "PlayCanvas perk state did not report default kill coin multiplier");
  assert(state.text.includes("perkShopCost=1.00"), "PlayCanvas perk state did not report default shop multiplier");
  assert(state.text.includes("perkVillageHp=1.00"), "PlayCanvas perk state did not report default village HP multiplier");
  assert(state.text.includes("perkDamageReduction=0.00"), "PlayCanvas perk state did not report default damage reduction");
  assert(state.text.includes("perkGrenadeCooldown=1.00"), "PlayCanvas perk state did not report default grenade cooldown");
  assert(/lifetimeKills=\d+/.test(state.text), "PlayCanvas lifetime stats did not report kills");
  assert(/lifetimeDamageDealt=\d+/.test(state.text), "PlayCanvas lifetime stats did not report damage dealt");
  assert(/lifetimePlaySeconds=\d+\.\d/.test(state.text), "PlayCanvas lifetime stats did not report play seconds");
  assert(state.text.includes("bossWaveActive=false"), "PlayCanvas boss state did not report inactive boss-wave baseline");
  assert(state.text.includes("secretBossActive=false"), "PlayCanvas boss state did not report inactive secret-boss baseline");
  assert(state.text.includes("secretBossSpawned=false"), "PlayCanvas boss state did not report unspawned secret-boss baseline");
  assert(state.text.includes("liveBosses=none"), "PlayCanvas boss state did not report no live bosses baseline");
  assert(state.text.includes("landscapeZombified=0"), "PlayCanvas landscape mutation baseline was not reported");
  assert(state.text.includes("lastMutation=none"), "PlayCanvas landscape mutation event baseline was not reported");
  assert(impactBaselineText.includes("brokenWindows=0"), `PlayCanvas impact state did not report unbroken window baseline (got: ${JSON.stringify(impactBaselineText.slice(0, 300))})`);
  assert(impactBaselineText.includes("activeImpactFx=0"), "PlayCanvas impact state did not report inactive impact FX baseline");
  assert(impactBaselineText.includes("lastImpact=none"), "PlayCanvas impact state did not report empty last-impact baseline");
  assert(impactBaselineText.includes("structureHits=0"), "PlayCanvas impact state did not report structure hit baseline");
  assert(state.text.includes("appliedVillageDamage=0"), "PlayCanvas impact state did not report disabled friendly-fire damage baseline");
  assert(state.text.includes("wave=1"), "campaign did not start on wave 1");
  assert(state.text.includes("ammoMode=infinite"), "PlayCanvas smoke did not report infinite ammo");
  assert(state.text.includes("weaponFamily=sidearm"), "PlayCanvas weapon identity did not report sidearm family baseline");
  assert(state.text.includes("weaponViewModel=sidearm"), "PlayCanvas weapon identity did not report sidearm viewmodel baseline");
  assert(state.text.includes("weaponReticle=sidearm"), "PlayCanvas weapon identity did not report sidearm reticle baseline");
  assert(state.text.includes("weaponShotFx=spark"), "PlayCanvas weapon identity did not report sidearm shot FX baseline");
  assert(state.text.includes("musicEnabled=true"), "PlayCanvas audio state did not report enabled music baseline");
  assert(state.text.includes("sfxEnabled=true"), "PlayCanvas audio state did not report enabled SFX baseline");
  assert(state.text.includes("musicMode=raid"), "PlayCanvas audio state did not report raid music mode while running");
  assert(/musicCue=raid_(low|mid|high)/.test(state.text), "PlayCanvas audio state did not report adaptive raid music cue");
  assert(state.text.includes("audioUnlocked=true"), "PlayCanvas audio did not unlock after user-like input");
  assert(shopText.includes("shopOpen=true"), "Q hotkey did not open the PlayCanvas field shop");
  assert(shopTypes.includes("weapon"), "field shop did not render weapon items");
  assert(shopTypes.includes("gear"), "field shop did not render gear items");
  assert(shopTypes.includes("armor"), "field shop did not render armor items");
  assert(shopTypes.includes("grenade"), "field shop did not render grenade pack items");
  assert(shopTypes.includes("c4"), "field shop did not render C4 pack items");
  assert(shopTypes.includes("nuke"), "field shop did not render nuke pack items");
  assert(shopTypes.includes("village"), "field shop did not render village upgrade item");
  assert(shopTypes.includes("medkit"), "field shop did not render med kit item");
  assert(Math.abs(yawAfterDrag - yawBeforeDrag) > 0.01, "mouse drag did not update PlayCanvas look yaw");
  assert(ordnanceText.includes("ordnance=frag"), "PlayCanvas smoke did not report active frag ordnance");
  assert(ordnanceText.includes("ordnanceCount=4"), "G hotkey did not consume one starting frag grenade");
  assert(advanced, "advanceTime(ms) hook missing");
  assert(nonBlackPixels > 1000, `screenshot appears blank or black: ${nonBlackPixels} lit pixels`);
  assert(mobileControlsVisible, "mobile fire control is not visible at phone viewport");
  assert(mobileShopVisible, "mobile shop control is not visible at phone viewport");
  assert(mobileCycleVisible, "mobile weapon-cycle control is not visible at phone viewport");
  assert(mobileOrdnanceVisible, "mobile ordnance control is not visible at phone viewport");
  assert(mobileFlintVisible, "mobile flint control is not visible at phone viewport");
  assert(mobileInteractVisible, "mobile interact control is not visible at phone viewport");
  assert(mobileMapVisible, "mobile map control is not visible at phone viewport");
  assert(musicToggleVisible, "music toggle is not visible");
  assert(sfxToggleVisible, "SFX toggle is not visible");
  assert(state.canvas.some((canvas) => canvas.width > 0 && canvas.height > 0), "no live PlayCanvas canvas found");
  assert(lifecycle.ok, "PlayCanvas lifecycle test could not access game instance");
  assert(lifecycle.intermissionText.includes("flowPanel=intermission"), "intermission flow panel missing");
  assert(lifecycle.intermissionTitle.includes("Regroup"), "intermission flow title missing");
  assert(lifecycle.intermissionPrimary.includes("Start Wave 2"), "intermission primary action did not advance next wave");
  assert(lifecycle.lostText.includes("flowPanel=lost"), "lost flow panel missing");
  assert(lifecycle.lostTitle.includes("overrun"), "lost flow title missing");
  assert(lifecycle.lostPrimary.includes("Retry"), "lost primary retry action missing");
  assert(lifecycle.wonText.includes("flowPanel=won"), "victory flow panel missing");
  assert(lifecycle.wonTitle.includes("bell tower"), "victory flow title missing");
  assert(lifecycle.wonPrimary.includes("Play Again"), "victory primary action missing");
  assert(blockingLogs.length === 0, `browser smoke had blocking logs: ${JSON.stringify(blockingLogs, null, 2)}`);

  console.log(state.text);
  console.log(`screenshot=${screenshotPath}`);
} catch (error) {
  exitCode = 1;
  throw error;
} finally {
  if (browser) {
    const browserProcess = browser.process?.();
    await Promise.race([browser.close(), delay(1500)]).catch(() => {});
    if (browserProcess && !browserProcess.killed) {
      browserProcess.kill("SIGTERM");
    }
  }
  if (server) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      server.kill("SIGTERM");
    }
  }
  setTimeout(() => process.exit(exitCode), 50);
}

async function waitForServer(url) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 15000) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until Vite is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function countNonBlackPixels(page, pngBuffer) {
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });
    const sample = document.createElement("canvas");
    sample.width = image.naturalWidth;
    sample.height = image.naturalHeight;
    const context = sample.getContext("2d");
    context.drawImage(image, 0, 0);
    const { data, width, height } = context.getImageData(0, 0, sample.width, sample.height);
    const stride = Math.max(1, Math.floor((width * height) / 20000));
    let count = 0;
    for (let pixel = 0; pixel < width * height; pixel += stride) {
      const index = pixel * 4;
      if (data[index] + data[index + 1] + data[index + 2] > 28) {
        count += 1;
      }
    }
    return count;
  }, pngBuffer.toString("base64"));
}
