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
  await mkdir("output/village-defense", { recursive: true });

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
  // Skip the first-run onboarding overlay (it suppresses the campaign modal,
  // and the smoke isn't testing onboarding — it clicks the campaign primary).
  await page.evaluate(() => localStorage.setItem("zi_onboarded", "1"));
  await page.reload({ waitUntil: "networkidle" });
  const readyText = await page.evaluate(() => window.render_game_to_text?.() ?? "");
  const readyPrimaryText = await page.locator('[data-flow-action="primary"]').textContent();
  // Click the modal's primary button; the bottom-bar start button is hidden
  // while the campaign modal is open (it returns for in-game controls).
  await page.locator('[data-flow-action="primary"]').click();
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
  const topToastMessage = await page.evaluate(() => {
    const el = document.querySelector(".zi-toast strong");
    if (!el) {
      return { exists: false };
    }
    const style = window.getComputedStyle(el);
    return {
      exists: true,
      text: el.textContent ?? "",
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      whiteSpace: style.whiteSpace,
      overflow: style.overflow,
      textOverflow: style.textOverflow,
    };
  });
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
  await page.evaluate(() => {
    const game = window.__playCanvasZombieGame;
    window.__rewardedAdEvents = [];
    window.addEventListener("zombie_invasion_rewarded_ad", (event) => {
      window.__rewardedAdEvents.push(event.detail);
    });
    window.history.replaceState(null, "", "/?mockRewardedAds=1");
    if (game) {
      game.state.phase = "intermission";
      game.state.waveSummary = { wave: 1, kills: game.state.kills, coins: game.state.coins, coinsEarned: 20, weapon: "Pistol" };
      game.state.playerHp = 50;
      game.state.claimedOfferKeys = [];
      game.updateHud();
    }
  });
  const rewardedButtonClicked = await page.evaluate(() => {
    const button = document.querySelector('[data-offer-id="double_wave_coins"]');
    button?.click();
    return Boolean(button);
  });
  await page.waitForFunction(
    () => window.__rewardedAdEvents?.some((event) => event.type === "reward_granted"),
    { polling: 100, timeout: 3000 }
  );
  const rewardedFlow = await page.evaluate(() => ({
    events: window.__rewardedAdEvents ?? [],
    text: window.render_playcanvas_game_to_text?.() ?? "",
  }));
  await page.evaluate(() => {
    const game = window.__playCanvasZombieGame;
    if (game) {
      game.state.phase = "running";
      game.state.waveSummary = null;
      game.state.playerHp = 100;
      game.state.coins = 0;
      game.state.claimedOfferKeys = [];
      if (game.state.rewardedRunState) {
        game.state.rewardedRunState.claimedOfferKeys = [];
        game.state.rewardedRunState.telemetry = [];
      }
      game.updateHud();
    }
  });
  await page.evaluate(() => {
    const game = window.__playCanvasZombieGame;
    if (game) {
      game.fxSlowMo = true;
      game.state.phase = "running";
      game.state.shotCooldownSec = 0;
      game.fire();
      game.updateHud();
    }
  });
  await page.setViewportSize({ width: 390, height: 760 });
  await page.waitForTimeout(100);
  // PRIMARY controls: visible in the right action cluster at phone viewport.
  const mobileControlsVisible = await page.locator('[data-touch-action="fire"]').isVisible();
  const mobileShopVisible = await page.locator('[data-touch-action="shop"]').isVisible();
  const mobileCycleVisible = await page.locator('[data-touch-action="cycle"]').isVisible();
  const mobileOrdnanceVisible = await page.locator('[data-touch-action="ordnance"]').isVisible();
  // SECONDARY controls: live in the More popover (hidden by default).
  // Assert the element EXISTS (count===1) rather than isVisible — they are reachable
  // via the ⋯ More button; testing DOM presence confirms they were not deleted.
  const mobileFlintCount = await page.locator('[data-touch-action="flint"]').count();
  const mobileInteractCount = await page.locator('[data-touch-action="interact"]').count();
  const mobileMapCount = await page.locator('[data-touch-action="map"]').count();
  // SETTINGS toggles: live in the settings sheet (hidden by default).
  // Assert element exists (count===1); reachable via the ⚙ settings button.
  const musicToggleCount = await page.locator('[data-action="music"]').count();
  const sfxToggleCount = await page.locator('[data-action="sfx"]').count();

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

  await page.setViewportSize({ width: 1280, height: 800 });
  const villageAttackProof = await page.evaluate(() => {
    const game = window.__playCanvasZombieGame;
    if (!game?.state?.villageStructures?.length || !game.state.zombies?.length) return { ok: false };
    game.state.phase = "running";
    game.state.waveGraceSec = 0;
    game.state.spawnedThisWave = 9999;
    game.state.player.x = 30;
    game.state.player.z = 30;
    for (const structure of game.state.villageStructures) {
      structure.hp = structure.maxHp;
      structure.underAttackSec = 0;
      structure.attackerCount = 0;
      structure.destroyedAtWave = null;
    }
    const attacker = game.state.zombies.find((zombie) => !zombie.dead) ?? game.state.zombies[0];
    for (const zombie of game.state.zombies) zombie.dead = zombie !== attacker;
    Object.assign(attacker, {
      dead: false,
      hp: Math.max(1, attacker.maxHp ?? 100),
      x: -6.7,
      z: -22,
      y: 0,
      speedMps: 0,
      attackDps: 7,
      movementMode: "ground",
      aggroPlayerSec: 0,
      targetStructureId: null,
      biteCooldownSec: 0,
      bitePhase: "none",
      biteTimerSec: 0,
      telegraphType: "none",
      telegraphSec: 0,
      pounceSec: 0,
      hitStunSec: 0,
      knockVx: 0,
      knockVz: 0,
    });
    const target = game.state.villageStructures.find((structure) => structure.id === "north_lodge");
    const before = target.hp;
    window.advanceTime?.(700);
    const visual = game.villageStructureVisuals.get("north_lodge");
    return {
      ok: true,
      before,
      after: target.hp,
      targetStructureId: attacker.targetStructureId,
      underAttackSec: target.underAttackSec,
      alertVisible: !document.querySelector("[data-structure-alert]")?.hidden,
      alertLabel: document.querySelector("[data-structure-alert-label]")?.textContent ?? "",
      ringVisible: Boolean(visual?.attackRing?.enabled),
      healthBarVisible: Boolean(visual?.alertRoot?.enabled),
      beaconStemVisible: Boolean(visual?.beaconStem?.enabled),
      text: window.render_playcanvas_game_to_text?.() ?? "",
    };
  });
  await page.evaluate(() => {
    const game = window.__playCanvasZombieGame;
    if (!game) return;
    const target = { x: -9.5, z: -22 };
    game.state.waveGraceSec = 0;
    game.state.player.x = 2;
    game.state.player.z = -16;
    game.state.player.y = 0;
    game.state.player.yVelocity = 0;
    game.yaw = Math.atan2(-(target.x - game.state.player.x), -(target.z - game.state.player.z));
    game.pitch = -4;
    game.state.player.yaw = game.yaw;
    game.updateCamera(0);
  });
  await page.waitForTimeout(100);
  await page.screenshot({ path: "output/village-defense/under-attack.png", fullPage: false });

  const criticalStructureProof = await page.evaluate(() => {
    const game = window.__playCanvasZombieGame;
    const structure = game?.state?.villageStructures?.find((entry) => entry.id === "north_lodge");
    if (!game || !structure) return { ok: false };
    game.state.waveGraceSec = 0;
    structure.hp = structure.maxHp * 0.15;
    structure.underAttackSec = 2;
    game.update(0.016);
    const visual = game.villageStructureVisuals.get(structure.id);
    return {
      ok: true,
      intact: Boolean(visual?.intactRoot?.enabled),
      cracks: Boolean(visual?.cracks?.enabled),
      critical: Boolean(visual?.critical?.enabled),
      fire: Boolean(visual?.fire?.enabled),
      smoke: Boolean(visual?.smoke?.enabled),
      rubble: Boolean(visual?.rubble?.enabled),
      text: window.render_playcanvas_game_to_text?.() ?? "",
    };
  });
  await page.waitForTimeout(100);
  await page.screenshot({ path: "output/village-defense/critical-building.png", fullPage: false });

  const destroyedStructureProof = await page.evaluate(() => {
    const game = window.__playCanvasZombieGame;
    const structure = game?.state?.villageStructures?.find((entry) => entry.id === "north_lodge");
    if (!game || !structure) return { ok: false };
    structure.hp = 0;
    structure.underAttackSec = 0;
    game.update(0.016);
    const visual = game.villageStructureVisuals.get(structure.id);
    return {
      ok: true,
      intact: Boolean(visual?.intactRoot?.enabled),
      rubble: Boolean(visual?.rubble?.enabled),
      smoke: Boolean(visual?.smoke?.enabled),
      alertVisible: !document.querySelector("[data-structure-alert]")?.hidden,
      text: window.render_playcanvas_game_to_text?.() ?? "",
    };
  });
  await page.waitForTimeout(100);
  await page.screenshot({ path: "output/village-defense/destroyed-building.png", fullPage: false });

  await page.setViewportSize({ width: 390, height: 760 });
  const mobileStructureAlertLayout = await page.evaluate(() => {
    const game = window.__playCanvasZombieGame;
    const structure = game?.state?.villageStructures?.find((entry) => entry.id === "safe_house");
    if (!game || !structure) return { ok: false, overlaps: [] };
    structure.hp = structure.maxHp * 0.35;
    structure.underAttackSec = 2;
    game.update(0.016);
    const selectors = {
      alert: "[data-structure-alert]",
      toast: ".zi-toast",
      guidance: ".pc-guidance-toast",
      meta: ".zi-hud-meta",
      minimap: ".pc-minimap-panel",
    };
    const rects = Object.fromEntries(Object.entries(selectors).map(([key, selector]) => {
      const element = document.querySelector(selector);
      const rect = element?.getBoundingClientRect();
      return [key, rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } : null];
    }));
    const intersects = (a, b) => Boolean(a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
    const overlaps = ["toast", "guidance", "meta", "minimap"].filter((key) => intersects(rects.alert, rects[key]));
    const guidanceBody = document.querySelector(`${selectors.guidance} p`);
    return {
      ok: true,
      overlaps,
      rects,
      alertVisible: !document.querySelector(selectors.alert)?.hidden,
      guidanceBodyDisplay: guidanceBody ? getComputedStyle(guidanceBody).display : null,
    };
  });
  await page.waitForTimeout(100);
  await page.screenshot({ path: "output/village-defense/mobile-alert.png", fullPage: false });
  await page.setViewportSize({ width: 1280, height: 800 });

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

  await page.setViewportSize({ width: 1280, height: 800 });
  const telegraphProof = await page.evaluate(() => {
    const game = window.__playCanvasZombieGame;
    const zombie = game?.state?.zombies?.find((entry) => !entry.dead);
    if (!game || !zombie) return { ok: false };

    game.state.phase = "running";
    game.state.waveGraceSec = 999;
    game.yaw = 0;
    game.pitch = -15;
    game.state.player.yaw = 0;
    zombie.x = game.state.player.x;
    zombie.z = game.state.player.z - 4;
    zombie.y = 0;
    zombie.speedMps = 0;
    zombie.bitePhase = "windup";
    zombie.biteWindupSec = 0.24;
    zombie.biteTimerSec = 0.2;
    zombie.telegraphType = "bite";
    zombie.telegraphSec = 0;
    zombie.pounceSec = 0;
    game.updateCamera(0.016);
    game.updateZombies(0.016);

    const entity = game.entitiesByZombie.get(zombie.id);
    const ring = entity?._telegraphRing;
    if (!ring) return { ok: false };
    const bitePosition = ring.getLocalPosition().clone();
    const biteEnabled = ring.enabled;
    const biteError = Math.hypot(bitePosition.x - zombie.x, bitePosition.z - zombie.z);

    zombie.bitePhase = "none";
    zombie.telegraphType = "pounce";
    zombie.telegraphSec = 0.2;
    zombie.pounceSec = 0;
    zombie.pounceTargetX = game.state.player.x + 1.25;
    zombie.pounceTargetZ = game.state.player.z - 5;
    zombie.x = game.state.player.x - 2;
    zombie.z = game.state.player.z - 8;
    game.updateZombies(0.016);
    const targetPosition = ring.getLocalPosition().clone();

    zombie.telegraphSec = 0;
    zombie.pounceSec = 0.3;
    zombie.x += 1;
    zombie.z += 1;
    game.updateZombies(0.016);
    const committedPosition = ring.getLocalPosition().clone();
    game.updateHud();

    return {
      ok: true,
      biteEnabled,
      biteError,
      targetError: Math.hypot(targetPosition.x - zombie.pounceTargetX, targetPosition.z - zombie.pounceTargetZ),
      lockDelta: Math.hypot(committedPosition.x - targetPosition.x, committedPosition.z - targetPosition.z),
    };
  });
  await page.waitForTimeout(120);
  await page.screenshot({ path: "output/holistic-graphics-pass/final-pounce-telegraph.png", fullPage: false });

  const blockingLogs = logs.filter((entry) => {
    if (entry.type === "requestfailed" && isBenignAudioAbort(entry.text)) {
      return false;
    }
    return entry.type === "pageerror" || entry.type === "requestfailed" || entry.type === "error";
  });
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
  assert(state.text.includes("maxVillageHp=700"), "PlayCanvas village did not start with the tuned 700 HP structure budget");
  assert(state.text.includes("villageStructures=7"), "PlayCanvas village did not expose all seven defense structures");
  assert(state.text.includes("survivingStructures=7"), "PlayCanvas village did not start with seven surviving structures");
  assert(state.text.includes("destroyedStructures=none"), "PlayCanvas village reported a destroyed structure at baseline");
  assert(state.text.includes("tutorialStage=running"), "running tutorial guidance stage missing");
  assert(state.text.includes("flowPanel=hidden"), "campaign flow panel did not hide during running play");
  assert(topToastMessage.exists, "top status toast message element missing");
  assert(topToastMessage.text.includes("drag the mouse to look around"), "top status toast did not show pointer-lock fallback guidance");
  assert(topToastMessage.whiteSpace !== "nowrap", "top status toast still forces single-line truncation");
  assert(topToastMessage.overflow !== "hidden", "top status toast still hides overflowing text");
  assert(topToastMessage.textOverflow !== "ellipsis", "top status toast still ellipsizes messages");
  assert(topToastMessage.scrollWidth <= topToastMessage.clientWidth + 1, "top status toast message overflows its rendered box");
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
  assert(state.text.includes("weaponViewYawDeg=-2.0"), "PlayCanvas sidearm viewmodel is not aimed nearly straight ahead");
  assert(state.text.includes("weaponReticle=sidearm"), "PlayCanvas weapon identity did not report sidearm reticle baseline");
  assert(state.text.includes("weaponShotFx=spark"), "PlayCanvas weapon identity did not report sidearm shot FX baseline");
  assert(state.text.includes('"ballistic"'), "PlayCanvas combat event did not expose ballistic telemetry");
  const tracerDrop = Number(state.text.match(/tracerDropVisual=(\d+\.\d{3})/)?.[1] ?? 0);
  assert(tracerDrop > 0, `PlayCanvas tracer did not expose positive ballistic visual sag (got: ${tracerDrop})`);
  assert(state.text.includes("rewardedTelemetry=0"), "PlayCanvas rewarded-ad telemetry baseline was not reported");
  assert(state.text.includes("rewardedLastEvent=none"), "PlayCanvas rewarded-ad last-event baseline was not reported");
  assert(state.text.includes("rewardedLastOffer=none"), "PlayCanvas rewarded-ad last-offer baseline was not reported");
  assert(state.text.includes("rewardedLastProvider=none"), "PlayCanvas rewarded-ad last-provider baseline was not reported");
  assert(state.text.includes("rewardedReviveUsed=false"), "PlayCanvas rewarded-ad revive status baseline was not reported");
  assert(state.text.includes("rewardedClaimedOffers=0"), "PlayCanvas rewarded-ad claimed-offer baseline was not reported");
  assert(/perfFpsAvg=\d+\.\d/.test(state.text), "PlayCanvas performance telemetry did not report average FPS");
  assert(/perfFrameMsAvg=\d+\.\d/.test(state.text), "PlayCanvas performance telemetry did not report average frame time");
  assert(/perfSlowFrames=\d+/.test(state.text), "PlayCanvas performance telemetry did not report slow-frame count");
  assert(/perfWorstFrameMs=\d+\.\d/.test(state.text), "PlayCanvas performance telemetry did not report worst frame time");
  assert(/qualityProfile=(desktop_high|mobile_high|mobile_low)/.test(state.text), "PlayCanvas performance telemetry did not report quality profile");
  assert(/renderScale=\d+\.\d{2}/.test(state.text), "PlayCanvas performance telemetry did not report render scale");
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
  assert(rewardedButtonClicked, "PlayCanvas rewarded offer button was not rendered for smoke interaction");
  assert(rewardedFlow.events.map((event) => event.type).join(",") === "offer_clicked,ad_completed,reward_granted", "PlayCanvas rewarded ad did not emit the expected browser event sequence");
  assert(rewardedFlow.events.every((event) => event.mode === "playcanvas"), "PlayCanvas rewarded ad events did not include mode=playcanvas");
  assert(rewardedFlow.events.some((event) => event.provider === "mock"), "PlayCanvas rewarded ad completion did not report mock provider");
  assert(rewardedFlow.text.includes("rewardedTelemetry=3"), "PlayCanvas rewarded telemetry count did not update after mock ad claim");
  assert(rewardedFlow.text.includes("rewardedLastEvent=reward_granted"), "PlayCanvas rewarded telemetry did not report reward_granted as the last event");
  assert(rewardedFlow.text.includes("rewardedLastOffer=double_wave_coins"), "PlayCanvas rewarded telemetry did not report the claimed offer");
  assert(rewardedFlow.text.includes("rewardedLastProvider=mock"), "PlayCanvas rewarded telemetry did not report the mock provider");
  // Primary controls visible in the right cluster
  assert(mobileControlsVisible, "mobile fire control is not visible at phone viewport");
  assert(mobileShopVisible, "mobile shop control is not visible at phone viewport (primary cluster)");
  assert(mobileCycleVisible, "mobile weapon-cycle control is not visible at phone viewport (primary cluster)");
  assert(mobileOrdnanceVisible, "mobile ordnance control is not visible at phone viewport (primary cluster)");
  // Secondary controls in More popover: assert they exist (reachable via ⋯ button)
  assert(mobileFlintCount === 1, "mobile flint control not found in DOM (expected in More popover)");
  assert(mobileInteractCount === 1, "mobile interact control not found in DOM (expected in More popover)");
  assert(mobileMapCount >= 1, "mobile map control not found in DOM (expected in More popover)");
  // Settings toggles in settings sheet: assert they exist (reachable via ⚙ button)
  assert(musicToggleCount >= 1, "music toggle not found in DOM (expected in settings sheet)");
  assert(sfxToggleCount >= 1, "SFX toggle not found in DOM (expected in settings sheet)");
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
  assert(telegraphProof.ok, "PlayCanvas game-feel telegraph proof could not access a live zombie ring");
  assert(telegraphProof.biteEnabled, "ordinary bite windup did not enable its ground cue");
  assert(telegraphProof.biteError < 0.05, `bite cue did not stay under its attacker (${telegraphProof.biteError})`);
  assert(telegraphProof.targetError < 0.05, `pounce cue did not move to its locked target (${telegraphProof.targetError})`);
  assert(telegraphProof.lockDelta < 0.001, `pounce cue moved after commitment (${telegraphProof.lockDelta})`);
  assert(villageAttackProof.ok, "PlayCanvas village attack proof could not access the structure runtime");
  assert(villageAttackProof.after < villageAttackProof.before, "A real zombie attack did not reduce its selected building health");
  assert(villageAttackProof.targetStructureId === "north_lodge", `Zombie selected the wrong nearest building (${villageAttackProof.targetStructureId})`);
  assert(villageAttackProof.underAttackSec > 0, "Building damage did not refresh its active alert lifetime");
  assert(villageAttackProof.alertVisible, "Building damage did not show the HUD attack alert");
  assert(villageAttackProof.alertLabel === "North Lodge", `HUD attack alert named the wrong building (${villageAttackProof.alertLabel})`);
  assert(villageAttackProof.ringVisible, "Building damage did not show its world-space attack ring");
  assert(villageAttackProof.healthBarVisible, "Building damage did not show its world-space health bar");
  assert(villageAttackProof.beaconStemVisible, "Building damage did not show its world-space exclamation beacon");
  assert(villageAttackProof.text.includes("underAttackStructures=north_lodge"), "Building attack was not exposed through browser telemetry");
  assert(criticalStructureProof.ok, "Critical-building browser proof could not access the structure runtime");
  assert(criticalStructureProof.intact, "Critical building disappeared before destruction");
  assert(criticalStructureProof.cracks && criticalStructureProof.critical, "Critical building did not enable both staged damage overlays");
  assert(criticalStructureProof.fire && criticalStructureProof.smoke, "Critical building did not enable fire and smoke feedback");
  assert(!criticalStructureProof.rubble, "Critical building showed rubble before destruction");
  assert(/north_lodge:\d+\/91:t3/.test(criticalStructureProof.text), "Critical building telemetry did not report damage tier 3");
  assert(destroyedStructureProof.ok, "Destroyed-building browser proof could not access the structure runtime");
  assert(!destroyedStructureProof.intact, "Destroyed building left its intact facade visible");
  assert(destroyedStructureProof.rubble && destroyedStructureProof.smoke, "Destroyed building did not switch to rubble and lingering smoke");
  assert(!destroyedStructureProof.alertVisible, "Destroyed building kept an active attack alert after falling");
  assert(destroyedStructureProof.text.includes("destroyedStructures=north_lodge"), "Destroyed building was not exposed through browser telemetry");
  assert(mobileStructureAlertLayout.ok && mobileStructureAlertLayout.alertVisible, "Mobile structure alert did not render");
  assert(mobileStructureAlertLayout.overlaps.length === 0, `Mobile structure alert overlaps HUD regions: ${mobileStructureAlertLayout.overlaps.join(",")}`);
  assert(mobileStructureAlertLayout.guidanceBodyDisplay === "none", "Mobile attack alert did not compact the guidance panel");
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

function isBenignAudioAbort(text) {
  return /\/audio\/music\/[^ ]+\.mp3/.test(text) && text.includes("net::ERR_ABORTED");
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
