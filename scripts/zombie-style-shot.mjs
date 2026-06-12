/**
 * zombie-style-shot.mjs
 * Visual screenshot harness for the articulated zombie rig.
 * Output (procedural, ?glb=0):
 *   output/zombie-style-close.png  — single zombie at close range
 *   output/zombie-style-group.png  — 5 zombies fanned in a group
 *   output/zombie-style-street.png — three zombies at street distances
 * Output (GLB default):
 *   output/zombie-glb-close.png
 *   output/zombie-glb-group.png
 *   output/zombie-glb-street.png
 *   output/zombie-glb-types.png   — walker, runner, brute, crawler side-by-side
 *   output/zombie-glb-death.png   — zombie mid-Death pose
 */
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const port = 5178;
const host = "127.0.0.1";
const baseUrl = `http://${host}:${port}`;
const targetUrl = `${baseUrl}/`;

let server = null;
let browser = null;
let exitCode = 0;

try {
  server = spawn("npm", ["run", "dev", "--", "--host", host, "--port", String(port)], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });

  server.stdout.on("data", (chunk) => process.stdout.write(chunk));
  server.stderr.on("data", (chunk) => process.stderr.write(chunk));

  await waitForServer(targetUrl);
  await mkdir("output", { recursive: true });

  browser = await chromium.launch({
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const logs = [];
  page.on("console", (msg) => logs.push({ type: msg.type(), text: msg.text() }));
  page.on("pageerror", (err) => logs.push({ type: "pageerror", text: err.message }));

  // ── Boot the game (procedural rig via ?glb=0) ─────────────────────────────
  // GLB is now the default; opt out to procedural for the first three shots.
  await page.goto(`${targetUrl}?glb=0`, { waitUntil: "networkidle", timeout: 25000 });
  await page.evaluate((saveKey) => localStorage.removeItem(saveKey), "zombie_invasion_playcanvas_save_v1");
  await page.reload({ waitUntil: "networkidle" });
  await page.locator('[data-action="start"]').click();

  // Skip grace period so zombies spawn immediately, then top up health.
  await page.evaluate(() => {
    const g = window.__playCanvasZombieGame;
    g.state.waveGraceSec = 0;
    window.advanceTime(2000);
    g.state.villageHp = 100;
    g.state.playerHp = 100;
    g.yaw = 0;
    g.pitch = -2;
    g.state.player.yaw = 0;
    g.updateCamera();
  });

  // ── Shot A: single zombie close-up ────────────────────────────────────────
  await page.evaluate(() => {
    const g = window.__playCanvasZombieGame;
    // Push all existing zombies far away, then bring one close.
    for (const z of g.state.zombies) {
      z.x = 0;
      z.z = -30;
    }
    // Move first live zombie to close position.
    const close = g.state.zombies.find((z) => !z.dead);
    if (close) {
      close.x = 0;
      close.z = 8.2;
    }
  });
  await page.evaluate(() => window.advanceTime(50));
  await page.waitForTimeout(400);

  await page.screenshot({ path: "output/zombie-style-close.png", fullPage: false });
  console.log("Shot A saved: output/zombie-style-close.png");

  // ── Shot B: group of 5 fanned zombies ─────────────────────────────────────
  // Advance more if fewer than 5 zombies exist (cap at 6 retries).
  for (let attempt = 0; attempt < 6; attempt++) {
    const count = await page.evaluate(
      () => window.__playCanvasZombieGame.state.zombies.filter((z) => !z.dead).length
    );
    if (count >= 5) break;
    await page.evaluate(() => window.advanceTime(1000));
    await page.waitForTimeout(200);
  }

  await page.evaluate(() => {
    const g = window.__playCanvasZombieGame;
    const live = g.state.zombies.filter((z) => !z.dead);
    const slots = [
      { x: -6, z: 2 },
      { x: -3, z: 4 },
      { x:  0, z: 5 },
      { x:  3, z: 4 },
      { x:  6, z: 6 },
    ];
    const count = Math.min(live.length, slots.length);
    for (let i = 0; i < count; i++) {
      live[i].x = slots[i].x;
      live[i].z = slots[i].z;
    }
    // Hide any extra zombies beyond our 5 slots.
    for (let i = count; i < live.length; i++) {
      live[i].z = -30;
    }
  });
  await page.evaluate(() => window.advanceTime(50));
  await page.waitForTimeout(400);

  await page.screenshot({ path: "output/zombie-style-group.png", fullPage: false });
  console.log("Shot B saved: output/zombie-style-group.png");

  // ── Shot C: street-distance view from player position ─────────────────────
  // Camera at default player pos (0,1.62,12) looking down -Z.
  // Three zombies at z=-10 (~22u), z=-16 (~28u), z=-24 (~36u) — true street distances.
  // Reuse the wave-B zombies: just reposition them and pull extras into view.
  const shotCDiag = await page.evaluate(() => {
    const g = window.__playCanvasZombieGame;
    // Reset wave grace so simulation keeps running
    g.state.waveGraceSec = 0;
    g.state.villageHp = 100;
    g.state.playerHp = 100;
    // Reset camera
    g.yaw = 0;
    g.pitch = -6;
    g.state.player.yaw = 0;
    g.updateCamera();

    // Place ALL zombies in a visible spread — three distances representing gameplay range
    // Camera at z=12: these are 20, 26, and 34 units away respectively
    const all = g.state.zombies;
    const slots = [
      { x:  0.5, z:  -8 },  // 20 units from camera — close street
      { x: -1.2, z: -14 },  // 26 units from camera — mid street
      { x:  1.8, z: -22 },  // 34 units from camera — far street
    ];
    for (let i = 0; i < all.length; i++) {
      const slot = slots[i % slots.length];
      // Spread extras slightly so they don't stack exactly
      all[i].x = slot.x + (i >= slots.length ? (i - slots.length + 1) * 3 - 4 : 0);
      all[i].z = slot.z;
      all[i].dead = false;  // un-kill any that died
    }
    // Run several update ticks so entity positions sync
    window.advanceTime(200);
    return {
      totalZombies: all.length,
      liveZombies: all.filter(z => !z.dead).length,
      phase: g.state.phase,
      entityCount: g.entitiesByZombie?.size ?? -1,
      firstZombiePos: all[0] ? { x: all[0].x, z: all[0].z, dead: all[0].dead } : null,
    };
  });
  console.log("Shot C diagnostics:", JSON.stringify(shotCDiag));
  // Multiple render ticks to sync entity positions
  await page.waitForTimeout(800);

  await page.screenshot({ path: "output/zombie-style-street.png", fullPage: false });
  console.log("Shot C saved: output/zombie-style-street.png");

  // ── GLB shots — navigate to default (GLB is now default, no flag needed) ─
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle", timeout: 30000 });
  await page.evaluate((saveKey) => localStorage.removeItem(saveKey), "zombie_invasion_playcanvas_save_v1");
  await page.reload({ waitUntil: "networkidle" });
  await page.locator('[data-action="start"]').click();

  // Wait for GLB container to load and zombies to spawn
  await page.evaluate(() => {
    const g = window.__playCanvasZombieGame;
    g.state.waveGraceSec = 0;
    window.advanceTime(2500); // extra time for GLB load + spawn
    g.state.villageHp = 100;
    g.state.playerHp = 100;
    g.yaw = 0;
    g.pitch = -2;
    g.state.player.yaw = 0;
    g.updateCamera();
  });
  // Give async GLB load time to complete (container is ~960KB)
  await page.waitForTimeout(1500);

  // ── GLB Shot A: single close-up ───────────────────────────────────────────
  await page.evaluate(() => {
    const g = window.__playCanvasZombieGame;
    for (const z of g.state.zombies) { z.x = 0; z.z = -30; }
    const close = g.state.zombies.find((z) => !z.dead);
    if (close) { close.x = 0; close.z = 8.2; }
  });
  await page.evaluate(() => window.advanceTime(50));
  await page.waitForTimeout(500);
  await page.screenshot({ path: "output/zombie-glb-close.png", fullPage: false });
  console.log("GLB Shot A saved: output/zombie-glb-close.png");

  // ── GLB Shot B: group of 5 ────────────────────────────────────────────────
  for (let attempt = 0; attempt < 6; attempt++) {
    const count = await page.evaluate(
      () => window.__playCanvasZombieGame.state.zombies.filter((z) => !z.dead).length
    );
    if (count >= 5) break;
    await page.evaluate(() => window.advanceTime(1000));
    await page.waitForTimeout(200);
  }
  await page.evaluate(() => {
    const g = window.__playCanvasZombieGame;
    const live = g.state.zombies.filter((z) => !z.dead);
    const slots = [{ x: -6, z: 2 }, { x: -3, z: 4 }, { x: 0, z: 5 }, { x: 3, z: 4 }, { x: 6, z: 6 }];
    const count = Math.min(live.length, slots.length);
    for (let i = 0; i < count; i++) { live[i].x = slots[i].x; live[i].z = slots[i].z; }
    for (let i = count; i < live.length; i++) { live[i].z = -30; }
  });
  await page.evaluate(() => window.advanceTime(50));
  await page.waitForTimeout(500);
  await page.screenshot({ path: "output/zombie-glb-group.png", fullPage: false });
  console.log("GLB Shot B saved: output/zombie-glb-group.png");

  // ── GLB Shot C: street distances ──────────────────────────────────────────
  await page.evaluate(() => {
    const g = window.__playCanvasZombieGame;
    g.state.waveGraceSec = 0;
    g.state.villageHp = 100;
    g.state.playerHp = 100;
    // Slightly more elevated pitch so the street silhouettes show against the buildings
    g.yaw = 0;
    g.pitch = -4;
    g.state.player.yaw = 0;
    g.updateCamera();
    const all = g.state.zombies;
    // Keep zombies at gameplay-realistic street distances but close enough to see on dark scene
    // Camera is at z=12; these put zombies 7, 10, 15 units ahead
    const slots = [{ x: 0.5, z: 5 }, { x: -1.5, z: 2 }, { x: 1.8, z: -3 }];
    for (let i = 0; i < all.length; i++) {
      const slot = slots[i % slots.length];
      all[i].x = slot.x + (i >= slots.length ? (i - slots.length + 1) * 3 - 4 : 0);
      all[i].z = slot.z;
      all[i].dead = false;
    }
    window.advanceTime(200);
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: "output/zombie-glb-street.png", fullPage: false });
  console.log("GLB Shot C saved: output/zombie-glb-street.png");

  // ── GLB Shot D: type variants side-by-side (walker, runner, brute, crawler) ─
  // Strategy: mutate the .type field of the first 4 live zombies, then delete
  // their entities from entitiesByZombie so updateZombies() recreates them with
  // the correct type-specific scale and animation.
  const typeDiag = await page.evaluate(() => {
    const g = window.__playCanvasZombieGame;
    g.state.waveGraceSec = 0;
    g.state.villageHp = 100;
    g.state.playerHp = 100;
    // Camera pitched slightly down so zombies at z=4 (8 units ahead) fill the frame.
    g.yaw = 0;
    g.pitch = -2;   // very shallow pitch — near-level so upright bodies are visible
    g.state.player.yaw = 0;
    g.updateCamera();

    // Ensure at least 4 live zombies
    while (g.state.zombies.filter(z => !z.dead).length < 4) {
      window.advanceTime(1000);
    }

    const live = g.state.zombies.filter(z => !z.dead);
    // Camera at z=12, pitch=-2, FOV ~70°.  At z=8 (4 units ahead) each unit of X
    // is roughly 14% of viewport width.  Keep X within ±3 to stay in-frame.
    const typeSlots = [
      { type: "walker",  x: -3.0, z: 8 },
      { type: "runner",  x: -1.0, z: 8 },
      { type: "brute",   x:  1.0, z: 8 },
      { type: "crawler", x:  3.0, z: 8 },
    ];

    const reassigned = [];
    for (let i = 0; i < Math.min(live.length, typeSlots.length); i++) {
      const z = live[i];
      const slot = typeSlots[i];
      z.type = slot.type;
      z.x = slot.x;
      z.z = slot.z;
      z.dead = false;
      // Delete the existing entity so updateZombies re-creates with new type
      const existingEnt = g.entitiesByZombie.get(z.id);
      if (existingEnt) {
        existingEnt.destroy();
        g.entitiesByZombie.delete(z.id);
      }
      reassigned.push({ id: z.id, type: z.type });
    }
    // Push all other zombies offscreen
    for (let i = typeSlots.length; i < g.state.zombies.length; i++) {
      g.state.zombies[i].x = -30;
      g.state.zombies[i].z = -30;
    }
    window.advanceTime(300);
    return { reassigned, totalZombies: g.state.zombies.length };
  });
  console.log("Types shot diagnostics:", JSON.stringify(typeDiag));
  // Wait for GLB entities to be instantiated, animations to bind, and render to settle
  await page.waitForTimeout(2000);
  // Run a few more animation ticks to ensure entity positions sync
  await page.evaluate(() => window.advanceTime(200));
  await page.waitForTimeout(500);
  await page.screenshot({ path: "output/zombie-glb-types.png", fullPage: false });
  console.log("GLB Shot D (types) saved: output/zombie-glb-types.png");

  // ── GLB Shot E: Death pose ────────────────────────────────────────────────
  // Kill one zombie and wait for the Death animation to play through.
  // Use a walker at close-medium range so it's fully visible.
  const deathDiag = await page.evaluate(() => {
    const g = window.__playCanvasZombieGame;
    g.state.waveGraceSec = 0;
    g.state.villageHp = 100;
    g.state.playerHp = 100;
    // Camera pitched down to see dying zombie on the ground
    g.yaw = 0;
    g.pitch = -18;  // look down so a ground-level Death pose is fully visible
    g.state.player.yaw = 0;
    g.updateCamera();

    // Push all zombies offscreen first
    for (const z of g.state.zombies) { z.x = -30; z.z = -30; }

    // Pick one live zombie, reset it as a walker very close, then kill it
    const z = g.state.zombies.find(zz => !zz.dead) ?? g.state.zombies[0];
    z.type = "walker";
    z.x = 0;
    z.z = 9;   // very close — only 3 units from camera (camera at z=12)
    z.dead = false;
    z.hp = 1;

    // Delete existing entity so it re-creates with walker type
    const ent = g.entitiesByZombie.get(z.id);
    if (ent) { ent.destroy(); g.entitiesByZombie.delete(z.id); }

    // Let the entity be created, then mark it dead
    window.advanceTime(100);
    z.dead = true;
    window.advanceTime(200);
    return { id: z.id, type: z.type, dead: z.dead };
  });
  console.log("Death shot diagnostics:", JSON.stringify(deathDiag));
  // Allow ~2 seconds for Death animation to play into a clear pose
  await page.waitForTimeout(2000);

  // Diagnostic: check entity/anim state just before screenshot
  const deathEntityDiag = await page.evaluate(() => {
    const g = window.__playCanvasZombieGame;
    const z = g.state.zombies.find(zz => zz.dead);
    if (!z) return { err: "no dead zombie found" };
    const ent = g.entitiesByZombie.get(z.id);
    if (!ent) return { err: "no entity for dead zombie", id: z.id };
    const glb = ent._glb;
    const model = glb?.modelEntity;
    return {
      id: z.id,
      type: z.type,
      dead: z.dead,
      pos: { x: z.x, z: z.z },
      entEnabled: ent.enabled,
      entPos: ent.getPosition()?.toString?.(),
      glbValid: glb?.valid,
      currentAnim: glb?.currentAnim,
      deathFinished: glb?.deathFinished,
      animSpeed: model?.anim?.speed,
      animPlaying: model?.anim?.playing,
    };
  });
  console.log("Death entity diagnostics:", JSON.stringify(deathEntityDiag));

  await page.screenshot({ path: "output/zombie-glb-death.png", fullPage: false });
  console.log("GLB Shot E (death) saved: output/zombie-glb-death.png");

  // ── Shot F: weapon-fire FX (muzzle flash + tracer) ───────────────────────
  // Navigate to ?fxslow=1 so FX lifetimes are 10x; screenshot during the flash.
  await page.goto(`${baseUrl}/?fxslow=1`, { waitUntil: "networkidle", timeout: 30000 });
  await page.evaluate((saveKey) => localStorage.removeItem(saveKey), "zombie_invasion_playcanvas_save_v1");
  await page.reload({ waitUntil: "networkidle" });
  await page.locator('[data-action="start"]').click();

  // Skip grace + spawn zombies, freeze one at 10u ahead
  await page.evaluate(() => {
    const g = window.__playCanvasZombieGame;
    g.state.waveGraceSec = 0;
    window.advanceTime(2000);
    g.state.playerHp = 100;
    g.state.villageHp = 100;
    g.yaw = 0;
    g.pitch = -6;
    g.state.player.yaw = 0;
    g.updateCamera();
    // Place a single zombie 10 units ahead
    for (const z of g.state.zombies) { z.x = 0; z.z = -30; }
    const target = g.state.zombies.find((z) => !z.dead);
    if (target) {
      target.x = 0;
      target.z = g.state.player.z - 10;
    }
    window.advanceTime(100);
  });
  await page.waitForTimeout(300);

  // Fire once — fxslow stretches flash+tracer TTL 10x so the next tick catches it
  await page.evaluate(() => {
    const g = window.__playCanvasZombieGame;
    g.fire();
    // Advance exactly 1 frame to place FX entities but keep them alive
    g.update(1 / 60);
  });
  // Give the SwiftShader renderer one real frame to compose the scene
  await page.waitForTimeout(200);
  await page.screenshot({ path: "output/weapon-fire-fx.png", fullPage: false });
  console.log("Shot F (flash+tracer) saved: output/weapon-fire-fx.png");

  // ── Shot G: impact burst on a zombie ─────────────────────────────────────
  // Ensure zombie is still at 10u, fire again; advance 2 frames so burst particles spread
  await page.evaluate(() => {
    const g = window.__playCanvasZombieGame;
    // Refresh zombie position (it may have moved)
    const target = g.state.zombies.find((z) => !z.dead);
    if (target) {
      target.x = 0;
      target.z = g.state.player.z - 10;
    }
    g.fire();
    // 3 frames: burst particles spread apart but still well within TTL (10x)
    g.update(1 / 60);
    g.update(1 / 60);
    g.update(1 / 60);
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: "output/weapon-fire-impact.png", fullPage: false });
  console.log("Shot G (impact burst) saved: output/weapon-fire-impact.png");

  // ── Report any blocking errors ─────────────────────────────────────────────
  const blockingLogs = logs.filter((e) => e.type === "pageerror" || e.type === "error");
  if (blockingLogs.length > 0) {
    console.error("Browser errors:", JSON.stringify(blockingLogs, null, 2));
    exitCode = 1;
  }
} catch (error) {
  exitCode = 1;
  console.error(error);
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
  while (Date.now() - startedAt < 20000) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Retry until Vite is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
