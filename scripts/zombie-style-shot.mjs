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

  // ── Bloom Shot: zombie eyes glow at 8-20u ─────────────────────────────────
  // Two zombies at 8u and 16u ahead; night scene, eyes should read as soft halos
  // from CameraFrame bloom. Pitch=-3 keeps them centred in frame.
  await page.evaluate(() => {
    const g = window.__playCanvasZombieGame;
    g.yaw = 0;
    g.pitch = -3;
    g.state.player.yaw = 0;
    g.updateCamera();
    const all = g.state.zombies;
    const eyeSlots = [
      { x:  0.6, z: g.state.player.z - 8 },   //  8u — close, eyes prominent
      { x: -0.8, z: g.state.player.z - 16 },  // 16u — mid-range halo
    ];
    for (let i = 0; i < all.length; i++) {
      all[i].dead = false;
      if (i < eyeSlots.length) {
        all[i].x = eyeSlots[i].x;
        all[i].z = eyeSlots[i].z;
      } else {
        all[i].x = -30; all[i].z = -30;
      }
    }
    window.advanceTime(150);
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: "output/bloom-eyes.png", fullPage: false });
  console.log("Bloom Shot (eye glow) saved: output/bloom-eyes.png");

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

  // ── Bloom Shot: muzzle flash bloom ───────────────────────────────────────
  // Still in ?fxslow=1 session. Fire again; we catch the stretched muzzle flash.
  // Intentional night scene: sky stays dark, only the muzzle corona blooms.
  await page.evaluate(() => {
    const g = window.__playCanvasZombieGame;
    const target = g.state.zombies.find((z) => !z.dead);
    if (target) { target.x = 0; target.z = g.state.player.z - 12; }
    g.fire();
    g.update(1 / 60);
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: "output/bloom-muzzle.png", fullPage: false });
  console.log("Bloom Shot (muzzle bloom) saved: output/bloom-muzzle.png");

  // ── Shot H: villager GLB — man + woman near a building, health bar visible ──
  // Navigate back to default (GLB) route. Villager GLB containers load alongside
  // zombie GLB. Force 2+ villagers into escorting state: one with low HP so the
  // health bar is visibly depleted — easier to verify in the screenshot.
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle", timeout: 30000 });
  await page.evaluate((saveKey) => localStorage.removeItem(saveKey), "zombie_invasion_playcanvas_save_v1");
  await page.reload({ waitUntil: "networkidle" });
  await page.locator('[data-action="start"]').click();

  // Boot and wait for villager GLB containers to load (~2s) plus initial spawns
  await page.evaluate(() => {
    const g = window.__playCanvasZombieGame;
    g.state.waveGraceSec = 0;
    window.advanceTime(1000);
    g.state.villageHp = 100;
    g.state.playerHp = 100;
    // Camera: slightly above head height, looking forward at the main building block
    g.yaw = 0;
    g.pitch = -8;
    g.state.player.yaw = 0;
    g.updateCamera();
  });
  // Wait for async GLB container loads (villager models are ~300KB each)
  await page.waitForTimeout(2500);

  // Inject 2 villagers in escorting state near the building, one with depleted HP.
  // Strategy: freeze sim (set player to static pos), pin villager positions AFTER
  // the advance so the escort follow logic doesn't teleport them away.
  const villagerDiag = await page.evaluate(() => {
    const g = window.__playCanvasZombieGame;
    const villagers = g.state.villagers;
    if (!villagers || villagers.length < 2) return { err: "not enough villagers", count: villagers?.length };

    // Push all zombies offscreen so they don't clutter the shot
    for (const z of g.state.zombies) { z.x = -30; z.z = -30; }

    // Place player/camera further back so villagers at z~0 are 12u ahead — full body visible.
    // Player camera is at z=12, so villagers at z=0 are 12 units ahead (good for full-body shot).
    g.state.player.x = 0;
    g.state.player.z = 12;
    // Pitch down to -12° so we see their full height; yaw 0 faces -Z toward villagers
    g.yaw = 0;
    g.pitch = -10;
    g.state.player.yaw = 0;
    g.updateCamera();

    // Destroy and clear old entities so updateVillagers() recreates with GLB
    if (g.entitiesByVillager) {
      for (const [id, ent] of g.entitiesByVillager.entries()) {
        ent.destroy();
      }
      g.entitiesByVillager.clear();
    }

    // Set villager states BEFORE advance so entities are created as GLB.
    // Villagers at z=0 → 12 units from camera → full-body visible at pitch=-10.
    // Villager 0 (one gender): escorting, full HP
    const v0 = villagers[0];
    v0.state = "escorting";
    v0.hp = v0.maxHp;
    v0.x = -1.6;
    v0.z = 0;
    g.state.activeEscortVillagerId = v0.id;

    // Villager 1 (other gender): escorting, low HP (~35%) so health bar shows damage
    const v1 = villagers[1];
    v1.state = "escorting";
    v1.hp = Math.ceil(v1.maxHp * 0.35);
    v1.x = 1.4;
    v1.z = 0.5;

    // Advance 2 frames — enough for entity creation + anim component init,
    // not enough for significant escort movement (4.8 m/s × 0.1s = 0.48u)
    window.advanceTime(100);

    // Pin positions AFTER advance so escort follow-logic doesn't drift them
    v0.x = -1.6;
    v0.z = 0;
    v1.x = 1.4;
    v1.z = 0.5;

    return {
      v0: { id: v0.id, state: v0.state, hp: v0.hp, x: v0.x, z: v0.z },
      v1: { id: v1.id, state: v1.state, hp: v1.hp, x: v1.x, z: v1.z },
      villagerGlbContainersReady: !!(g.villagerGlbContainers),
      glbContainerReady: !!(g.glbContainer),
      totalVillagers: villagers.length,
    };
  });
  console.log("Villager GLB shot diagnostics:", JSON.stringify(villagerDiag));

  // Extra render time: GLB anim binding is async — give it 1.5s
  await page.waitForTimeout(1500);
  // Pin positions again, flush ticks, and gather entity diagnostics
  const villagerEntityDiag = await page.evaluate(() => {
    const g = window.__playCanvasZombieGame;
    const v0 = g.state.villagers[0];
    const v1 = g.state.villagers[1];
    if (v0) { v0.x = -1.6; v0.z = 0; }
    if (v1) { v1.x = 1.4; v1.z = 0.5; }
    window.advanceTime(50);

    const results = [];
    for (const v of [v0, v1]) {
      if (!v) continue;
      const ent = g.entitiesByVillager?.get(v.id);
      if (!ent) { results.push({ id: v.id, err: "no entity" }); continue; }
      const glb = ent._glb;
      const model = glb?.modelEntity;
      results.push({
        id: v.id,
        hasGlb: !!glb,
        glbValid: glb?.valid,
        currentAnim: glb?.currentAnim,
        animSetupOk: glb?.animSetupOk,
        animKeys: glb?.animMap ? [...glb.animMap.keys()] : null,
        animSpeed: model?.anim?.speed,
        animPlaying: model?.anim?.playing,
        healthBarEnabled: ent._healthRoot?.enabled,
      });
    }
    return results;
  });
  console.log("Villager entity diagnostics:", JSON.stringify(villagerEntityDiag));
  await page.waitForTimeout(400);

  await page.screenshot({ path: "output/villager-glb.png", fullPage: false });
  console.log("Shot H (villager GLB) saved: output/villager-glb.png");

  // ── Shot I: heavy zombie types line-up (walker, brute, armored, mega_zombie, mini_boss) ──
  // Navigate to the GLB default route fresh so no left-over sim state.
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle", timeout: 30000 });
  await page.evaluate((saveKey) => localStorage.removeItem(saveKey), "zombie_invasion_playcanvas_save_v1");
  await page.reload({ waitUntil: "networkidle" });
  await page.locator('[data-action="start"]').click();

  // Boot + wait for GLB container to load, then skip grace so zombies spawn.
  await page.evaluate(() => {
    const g = window.__playCanvasZombieGame;
    g.state.waveGraceSec = 0;
    window.advanceTime(2000);
    g.state.villageHp = 100;
    g.state.playerHp = 100;
    g.yaw = 0;
    g.pitch = -4;
    g.state.player.yaw = 0;
    g.updateCamera();
  });
  await page.waitForTimeout(1500);

  // Ensure at least 5 live zombies for the 5 heavy slots.
  for (let attempt = 0; attempt < 8; attempt++) {
    const count = await page.evaluate(
      () => window.__playCanvasZombieGame.state.zombies.filter((z) => !z.dead).length
    );
    if (count >= 5) break;
    await page.evaluate(() => window.advanceTime(1000));
    await page.waitForTimeout(200);
  }

  const heaviesDiag = await page.evaluate(() => {
    const g = window.__playCanvasZombieGame;
    g.state.waveGraceSec = 0;
    g.state.villageHp = 100;
    g.state.playerHp = 100;
    // Camera: player at default z=12, pitch=-4 → zombies at z=4 are 8 units ahead.
    // Spread 5 types across x=[-6, -3, 0, 3, 6] so all fit in frame at 1280x800.
    g.yaw = 0;
    g.pitch = -4;
    g.state.player.yaw = 0;
    g.updateCamera();

    const live = g.state.zombies.filter((z) => !z.dead);

    const heavySlots = [
      { type: "walker",     x: -6.0, z: 4 },
      { type: "brute",      x: -3.0, z: 4 },
      { type: "armored",    x:  0.0, z: 4 },
      { type: "mega_zombie",x:  3.0, z: 4 },
      { type: "mini_boss",  x:  6.0, z: 4 },
    ];

    const reassigned = [];
    for (let i = 0; i < Math.min(live.length, heavySlots.length); i++) {
      const z = live[i];
      const slot = heavySlots[i];
      z.type = slot.type;
      z.x = slot.x;
      z.z = slot.z;
      z.dead = false;
      // Delete existing visual entity so updateZombies() recreates with new type-specific appearance
      const existing = g.entitiesByZombie.get(z.id);
      if (existing) {
        existing.destroy();
        g.entitiesByZombie.delete(z.id);
      }
      reassigned.push({ id: z.id, type: z.type, x: z.x });
    }
    // Push remaining zombies offscreen
    for (let i = heavySlots.length; i < g.state.zombies.length; i++) {
      g.state.zombies[i].x = -50;
      g.state.zombies[i].z = -50;
    }
    window.advanceTime(400);
    return { reassigned, totalZombies: g.state.zombies.length };
  });
  console.log("Heavy types shot diagnostics:", JSON.stringify(heaviesDiag));

  // Wait for GLB entities to instantiate, anim to bind, props to attach
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.advanceTime(200));
  await page.waitForTimeout(600);

  await page.screenshot({ path: "output/zombie-heavies.png", fullPage: false });
  console.log("Shot I (zombie-heavies) saved: output/zombie-heavies.png");

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
