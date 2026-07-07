import { beforeEach, describe, expect, it } from "vitest";
import {
  buyC4Pack,
  buyGrenadePack,
  buyGearItem,
  buyMedKit,
  buyNukePack,
  buyOrEquipArmor,
  buyOrEquipWeapon,
  buyVillageUpgrade,
  createSliceState,
  cycleOrdnance,
  cycleOwnedWeapon,
  equipOwnedWeapon,
  fireSliceWeapon,
  getPlayCanvasAudioSnapshot,
  getPlayCanvasBossSnapshot,
  getPlayCanvasBuildingSnapshot,
  getPlayCanvasGuidanceSnapshot,
  getPlayCanvasImpactSnapshot,
  getPlayCanvasMiniMapSnapshot,
  getPlayCanvasWeaponSnapshot,
  getPlayCanvasVillagerSnapshot,
  getPlayCanvasOrdnanceProjectiles,
  consumePlayCanvasOrdnanceDetonations,
  getShopItems,
  interactWithPlayCanvasWorld,
  reloadSliceWeapon,
  PLAYCANVAS_SAVE_KEY,
  loadPlayCanvasSave,
  persistPlayCanvasSave,
  setPlayCanvasAudioSettings,
  startSlice,
  stepSlice,
  useOrdnance,
  useFlintAndSteel,
  applyPlayCanvasRewardedOffer,
  getPlayCanvasRewardedAdSnapshot,
  getPlayCanvasSummaryOffers,
  getPlayCanvasGameOverOffers,
  recordPlayCanvasRewardedAdEvent,
  evaluateGoals,
  getGoalsSnapshot,
  revivePlayer,
} from "../src/playcanvas/sliceSimulation";
import weaponsConfig from "../src/fps/config/weapons_fps.json";
import buildingsConfig from "../src/fps/config/buildings_fps.json";
import enemiesConfig from "../src/fps/config/enemies_fps.json";

describe("PlayCanvas campaign simulation", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts a 12-wave campaign shell and moves zombies toward the village", () => {
    const state = startSlice(createSliceState());
    state.waveGraceSec = 0; // skip grace period
    stepSlice(state, idleInput(), 0.1); // let spawner fire
    const before = state.zombies[0].z;

    stepSlice(state, idleInput(), 1);

    expect(state.waveNumber).toBe(1);
    expect(state.spawnedThisWave).toBeGreaterThan(0);
    expect(state.zombies[0].z).toBeGreaterThan(before);
    expect(state.phase).toBe("running");
  });

  it("moves relative to the camera heading (W/strafe match the aim basis at any yaw)", () => {
    // Regression: movement used to mismatch the camera/aim basis on the X axis,
    // so forward/strafe inverted once the player turned ~90deg from spawn.
    // Camera/aim forward is (-sin, -cos); camera right is (cos, -sin). The move
    // delta must point along those vectors (positive dot product) at every yaw.
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 2.3]) {
      const sin = Math.sin(yaw);
      const cos = Math.cos(yaw);
      const fwd = startSlice(createSliceState());
      fwd.player.yaw = yaw;
      const fx0 = fwd.player.x, fz0 = fwd.player.z;
      stepSlice(fwd, { ...idleInput(), forward: 1 }, 0.05);
      const fdot = (fwd.player.x - fx0) * -sin + (fwd.player.z - fz0) * -cos;
      expect(fdot).toBeGreaterThan(0.001);

      const str = startSlice(createSliceState());
      str.player.yaw = yaw;
      const sx0 = str.player.x, sz0 = str.player.z;
      stepSlice(str, { ...idleInput(), right: 1 }, 0.05);
      const sdot = (str.player.x - sx0) * cos + (str.player.z - sz0) * -sin;
      expect(sdot).toBeGreaterThan(0.001);
    }
  });

  it("lets the player land on village rooftops, jump from them, and fall off the edge", () => {
    const state = startSlice(createSliceState());
    state.waveGraceSec = 999;
    state.player.x = -9.5;
    state.player.z = -22;
    state.player.y = 5.1;
    state.player.yVelocity = -2;
    state.player.onGround = false;

    for (let i = 0; i < 20; i += 1) {
      stepSlice(state, idleInput(), 0.05);
    }

    expect(state.player.onGround).toBe(true);
    expect(state.player.supportSurfaceId).toBe("house-0-roof");
    expect(state.player.y).toBeGreaterThan(3.5);

    stepSlice(state, { ...idleInput(), jump: true }, 0.05);

    expect(state.player.onGround).toBe(false);
    expect(state.player.yVelocity).toBeGreaterThan(0);
    expect(state.player.supportSurfaceId).toBeNull();

    state.player.x = 0;
    state.player.z = 12;
    state.player.yVelocity = -2;
    for (let i = 0; i < 80; i += 1) {
      stepSlice(state, idleInput(), 0.05);
    }

    expect(state.player.onGround).toBe(true);
    expect(state.player.supportSurfaceId).toBe("ground");
    expect(state.player.y).toBe(0);
  });

  it("fires along the player forward vector and records a hit", () => {
    const state = startSlice(createSliceState());
    state.waveGraceSec = 0;
    state.player.x = -10;
    state.player.z = -26;
    state.player.yaw = 0;
    state.zombies = [{ ...nearbyZombie(), x: -10, z: -31 }];

    const result = fireSliceWeapon(state);

    expect(result.hit).toBe(true);
    expect(state.ammo).toBe(15);
    expect(state.pendingReload).toBe(false);
    expect(state.zombies[0].hp).toBeLessThan(state.zombies[0].maxHp);
  });

  it("requires the pistol's aim line to pass through a zombie's body (no wide cone auto-aim)", () => {
    const state = startSlice(createSliceState());
    state.waveGraceSec = 0;
    // Fire +Z (yaw = PI), away from the village structures, over open ground.
    state.player.x = 0;
    state.player.z = 8;
    state.player.yaw = Math.PI;
    state.player.onGround = true;
    // 20m down-range, 2.5m off the aim line — well outside the body radius.
    state.zombies = [{ ...nearbyZombie(), x: 2.5, z: 28, hp: 100, maxHp: 100 }];

    const result = fireSliceWeapon(state);

    expect(result.hit).toBe(false);
    expect(result.reason).toBe("miss");
    // The off-line zombie takes no damage…
    expect(state.zombies[0].hp).toBe(100);
  });

  it("lands the pistol when the reticle is actually on the zombie's body", () => {
    const state = startSlice(createSliceState());
    state.waveGraceSec = 0;
    state.player.x = 0;
    state.player.z = 8;
    state.player.yaw = Math.PI;
    state.player.onGround = true;
    // Same range, only 0.2m off-center — inside the body + forgiveness window.
    state.zombies = [{ ...nearbyZombie(), x: 0.2, z: 28, hp: 100, maxHp: 100 }];

    const result = fireSliceWeapon(state);

    expect(result.hit).toBe(true);
    expect(state.zombies[0].hp).toBeLessThan(100);
  });

  it("records PlayCanvas ballistic flight metadata for weapon hits", () => {
    const state = startSlice(createSliceState());
    state.waveGraceSec = 0;
    state.player.x = 0;
    state.player.z = 8;
    state.player.yaw = Math.PI;
    state.player.onGround = true;
    state.zombies = [{ ...nearbyZombie(), x: 0, z: 28, hp: 100, maxHp: 100 }];

    const result = fireSliceWeapon(state);

    expect(result.hit).toBe(true);
    expect(result.ballistic).toMatchObject({
      distanceMeters: 20,
      muzzleVelocityMps: 360,
      travelTimeSec: expect.closeTo(20 / 360, 3),
      dropMeters: expect.closeTo(0.015, 3),
      drag: 0.28,
      massGrams: 8,
    });
    expect(state.lastCombatEvent.ballistic).toEqual(result.ballistic);
  });

  it("makes PlayCanvas headshots hit much harder than body shots", () => {
    const makeAimState = (pitch) => {
      const state = startSlice(createSliceState());
      state.waveGraceSec = 0;
      state.player.x = 0;
      state.player.z = 8;
      state.player.yaw = Math.PI;
      state.player.pitch = pitch;
      state.player.onGround = true;
      state.zombies = [{ ...nearbyZombie(), x: 0, z: 18, hp: 200, maxHp: 200 }];
      return state;
    };

    const bodyShot = makeAimState(0);
    const headshot = makeAimState(-12);

    const bodyResult = fireSliceWeapon(bodyShot);
    const headshotResult = fireSliceWeapon(headshot);

    expect(bodyResult.hit).toBe(true);
    expect(headshotResult.hit).toBe(true);
    expect(headshotResult.headshot).toBe(true);
    expect(headshotResult.damage).toBeGreaterThanOrEqual(bodyResult.damage * 3);
    expect(headshot.zombies[0].hp).toBeLessThan(bodyShot.zombies[0].hp);
    expect(headshot.lastMessage).toContain("HEADSHOT");
  });

  it("kicks up terrain on a clean miss so the shot reads down-range", () => {
    const state = startSlice(createSliceState());
    state.waveGraceSec = 0;
    state.player.x = 0;
    state.player.z = 8;
    state.player.yaw = Math.PI; // fire +Z, away from the village
    state.player.onGround = true;
    state.player.pitch = -12; // looking down — round meets the ground
    state.zombies = [];

    const result = fireSliceWeapon(state);

    expect(result.hit).toBe(false);
    expect(result.reason).toBe("miss");
    expect(result.impact).toBe(true);
    expect(result.materialId).toBe("soil");
    expect(result.impactDistance).toBeGreaterThan(0);
    expect(result.ballistic).toMatchObject({
      muzzleVelocityMps: 360,
      travelTimeSec: expect.any(Number),
      dropMeters: expect.any(Number),
    });
    expect(result.ballistic.dropMeters).toBeGreaterThan(0);
    expect(state.lastCombatEvent).toMatchObject({
      hit: false,
      reason: "miss",
      impact: true,
      materialId: "soil",
      impactDistance: result.impactDistance,
      ballistic: result.ballistic,
    });
  });

  it("keeps the shotgun forgiving — off-axis zombies in the spread still get hit", () => {
    const state = startSlice(createSliceState({ coins: 5000 }));
    state.phase = "intermission";
    state.waveNumber = 5;
    expect(buyOrEquipWeapon(state, "shotgun")).toEqual({ ok: true });
    state.phase = "running";
    state.waveGraceSec = 0;
    state.player.x = 0;
    state.player.z = 8;
    state.player.yaw = Math.PI; // fire +Z, away from the village
    state.player.onGround = true;
    // 8m down-range, 1.5m off the line — a precise weapon would miss, the
    // shotgun's wide cone still catches it.
    state.zombies = [{ ...nearbyZombie(), x: 1.5, z: 16, hp: 100, maxHp: 100 }];

    const result = fireSliceWeapon(state);

    expect(result.hit).toBe(true);
    expect(state.zombies[0].hp).toBeLessThan(100);
  });

  it("clears a normal campaign wave into intermission", () => {
    const state = startSlice(createSliceState());
    state.spawnedThisWave = 5;
    for (const zombie of state.zombies) {
      zombie.dead = true;
    }

    stepSlice(state, idleInput(), 0.1);

    expect(state.phase).toBe("intermission");
    expect(state.lastMessage).toContain("Wave 1 cleared");
  });

  it("ends the PlayCanvas campaign when player or village health reaches zero", () => {
    const playerLost = startSlice(createSliceState());
    playerLost.playerHp = 0;
    stepSlice(playerLost, idleInput(), 0.1);

    const villageLost = startSlice(createSliceState());
    villageLost.villageHp = 0;
    stepSlice(villageLost, idleInput(), 0.1);

    expect(playerLost.phase).toBe("lost");
    expect(playerLost.lastMessage).toContain("overrun");
    expect(villageLost.phase).toBe("lost");
    expect(villageLost.lastMessage).toContain("bell tower");
  });

  it("keeps PlayCanvas campaign guns firing with infinite ammo and no reload block", () => {
    const state = startSlice(createSliceState());
    state.waveGraceSec = 0;
    state.player.x = 0;
    state.player.z = 8;
    state.player.yaw = Math.PI;
    state.zombies = [{ ...nearbyZombie(), x: 0, z: 28, hp: 999, maxHp: 999 }];
    state.ammo = 1;

    reloadSliceWeapon(state);
    expect(state.pendingReload).toBe(false);
    expect(state.reloadTimerSec).toBe(0);
    expect(state.ammo).toBe(15);
    expect(state.lastMessage).toContain("infinite ammo");

    for (let i = 0; i < 24; i += 1) {
      const result = fireSliceWeapon(state);
      expect(result.reason).not.toBe("empty");
      expect(state.pendingReload).toBe(false);
      expect(state.ammo).toBe(15);
      stepSlice(state, idleInput(), 0.05);
    }
  });

  it("exposes PlayCanvas first-session guidance for ready, running, and intermission states", () => {
    const ready = createSliceState({ ownedWeapons: ["pistol"], equippedWeaponId: "pistol" });
    expect(getPlayCanvasGuidanceSnapshot(ready)).toMatchObject({
      stage: "ready",
      action: "start_campaign",
    });

    const running = startSlice(createSliceState({ ownedWeapons: ["pistol"], equippedWeaponId: "pistol" }));
    running.zombies = [];
    running.spawnedThisWave = 0;
    const runningGuide = getPlayCanvasGuidanceSnapshot(running);
    expect(runningGuide.stage).toBe("running");
    expect(runningGuide.action).toBe("kill_first_zombie");

    const intermission = createSliceState({
      coins: 200,
      ownedWeapons: ["pipe", "pistol"],
      equippedWeaponId: "pistol",
    });
    intermission.phase = "intermission";
    intermission.waveNumber = 1;
    intermission.playerHp = 100;
    const intermissionGuide = getPlayCanvasGuidanceSnapshot(intermission);
    expect(intermissionGuide.stage).toBe("intermission");
    expect(intermissionGuide.recommendation).toMatchObject({ targetType: "weapon", targetId: "revolver" });
    expect(intermissionGuide.nextThreat).toMatchObject({ wave: 2, type: "runner" });
    expect(intermissionGuide.action).toBe("buy_weapon:revolver");
  });

  it("surfaces new enemy intro guidance when a new PlayCanvas threat spawns", () => {
    const state = startSlice(createSliceState({ ownedWeapons: ["pistol"], equippedWeaponId: "pistol" }));
    state.waveIndex = 1;
    state.waveNumber = 2;
    state.zombies = [];
    state.spawnedThisWave = 0;
    state.spawnTimerSec = -999;
    state.waveGraceSec = 0;
    state.randomState = 1765;

    stepSlice(state, idleInput(), 0.05);
    const guide = getPlayCanvasGuidanceSnapshot(state);

    expect(state.introducedEnemyTypes).toContain("runner");
    expect(guide.enemyIntro).toMatchObject({ type: "runner" });
    expect(guide.message).toContain("Runner spotted");
  });

  it("maps PlayCanvas phases to legacy adaptive music cues and persists audio settings", () => {
    localStorage.clear();
    const ready = createSliceState();
    expect(getPlayCanvasAudioSnapshot(ready)).toMatchObject({
      mode: "menu",
      cueId: "menu_theme",
      musicEnabled: true,
      sfxEnabled: true,
    });

    const running = startSlice(createSliceState());
    expect(getPlayCanvasAudioSnapshot(running)).toMatchObject({ mode: "raid", cueId: "raid_low" });

    running.waveNumber = 12;
    running.zombies = Array.from({ length: 15 }, (_, index) => ({
      ...nearbyZombie(),
      id: `pressure-${index}`,
      x: index % 3,
      z: 9 - index * 0.2,
    }));
    expect(getPlayCanvasAudioSnapshot(running).cueId).toBe("raid_high");

    const intermission = createSliceState();
    intermission.phase = "intermission";
    expect(getPlayCanvasAudioSnapshot(intermission)).toMatchObject({ mode: "shop", cueId: "shop_intermission" });

    const boss = createSliceState();
    boss.phase = "secret_boss";
    boss.secretBossActive = true;
    boss.zombies = [{ ...nearbyZombie(), id: "secret-boss", type: "secret_boss" }];
    expect(getPlayCanvasAudioSnapshot(boss)).toMatchObject({ mode: "raid", cueId: "boss_battle" });

    const won = createSliceState();
    won.phase = "won";
    expect(getPlayCanvasAudioSnapshot(won)).toMatchObject({ mode: "game_over", cueId: "victory_sting" });

    setPlayCanvasAudioSettings(ready, { musicEnabled: false, sfxEnabled: false });
    expect(JSON.parse(localStorage.getItem(PLAYCANVAS_SAVE_KEY))).toMatchObject({
      musicEnabled: false,
      sfxEnabled: false,
    });
    expect(createSliceState()).toMatchObject({ musicEnabled: false, sfxEnabled: false });
    localStorage.clear();
  });

  it("sanitizes and persists PlayCanvas saves with the old FPS progression surface", () => {
    localStorage.clear();
    localStorage.setItem(PLAYCANVAS_SAVE_KEY, JSON.stringify({
      version: 1,
      profileType: "old",
      coins: -10,
      bestWave: 4,
      grenades: 9,
      activeGrenadeId: "frag",
      c4Charges: 3,
      nukes: 2,
      unlockedWeapons: ["pipe", "pistol", "rpg"],
      ownedWeapons: ["pipe", "rpg", "not-real"],
      equippedWeaponId: "rpg",
      openedBuildings: ["house_1", 5, "house_1"],
      rescuedVillagers: ["villager_chapel"],
      deadVillagers: ["villager_chapel", "villager_barn"],
      villageLevel: 99,
      ownedArmors: ["cloth", "kevlar", "bad"],
      equippedArmorId: "kevlar",
      ownedGear: ["flashlight", "fake"],
      sensitivity: 2,
      graphicsPreset: 7,
      musicEnabled: false,
      sfxEnabled: false,
      lifetimeStats: {
        kills: 6,
        damageDealt: 700,
        damageTaken: 12,
        villageDamageTaken: 5,
        wavesCleared: 3,
        playSeconds: 18.5,
      },
    }));

    const loaded = loadPlayCanvasSave();
    expect(loaded).toMatchObject({
      version: 2,
      profileType: "playcanvas_village_v2",
      coins: 0,
      bestWave: 4,
      grenades: 9,
      activeGrenadeId: "frag",
      c4Charges: 3,
      nukes: 2,
      equippedWeaponId: "rpg",
      equippedArmorId: "kevlar",
      sensitivity: 0.6,
      graphicsPreset: "desktop_high",
      musicEnabled: false,
      sfxEnabled: false,
    });
    expect(loaded.ownedWeapons).toEqual(["pipe", "pistol", "rpg"]);
    expect(loaded.deadVillagers).toEqual(["villager_barn"]);
    expect(loaded.ownedArmors).toEqual(["cloth", "kevlar"]);
    expect(loaded.ownedGear).toEqual(["flashlight"]);
    expect(loaded.lifetimeStats).toMatchObject({ kills: 6, wavesCleared: 3, playSeconds: 18.5 });

    const state = createSliceState(loaded);
    state.coins = 80;
    state.c4Count = 4;
    state.nukeCount = 1;
    state.lifetimeStats.damageDealt = 900;
    const persisted = persistPlayCanvasSave(state);

    expect(persisted).toMatchObject({
      version: 2,
      profileType: "playcanvas_village_v2",
      coins: 80,
      c4Count: 4,
      c4Charges: 4,
      nukeCount: 1,
      nukes: 1,
      pistolUnlocked: true,
      lifetimeStats: expect.objectContaining({ damageDealt: 900 }),
    });
    expect(JSON.parse(localStorage.getItem(PLAYCANVAS_SAVE_KEY))).toMatchObject({
      version: 2,
      profileType: "playcanvas_village_v2",
      c4Charges: 4,
      nukes: 1,
    });
    localStorage.clear();
  });

  it("tracks PlayCanvas lifetime progression stats while playing", () => {
    const state = startSlice(createSliceState());
    state.waveGraceSec = 0;
    state.player.x = -10;
    state.player.z = -26;
    state.player.yaw = 0;
    state.zombies = [{ ...nearbyZombie(), x: -10, z: -31, hp: 1 }];

    fireSliceWeapon(state);
    expect(state.lifetimeStats.kills).toBe(1);
    expect(state.lifetimeStats.damageDealt).toBeGreaterThan(0);

    state.zombies = [nearbyZombie()];
    state.player.x = 0;
    state.player.z = 12;
    const beforePlayerDamage = state.lifetimeStats.damageTaken;
    stepSlice(state, idleInput(), 0.5);
    expect(state.lifetimeStats.playSeconds).toBeGreaterThan(0);
    expect(state.lifetimeStats.damageTaken).toBeGreaterThan(beforePlayerDamage);

    state.zombies = [{ ...nearbyZombie(), x: 0, z: -12.2 }];
    state.player.x = 30;
    state.player.z = 30;
    const beforeVillageDamage = state.lifetimeStats.villageDamageTaken;
    stepSlice(state, idleInput(), 0.5);
    expect(state.lifetimeStats.villageDamageTaken).toBeGreaterThan(beforeVillageDamage);

    state.zombies = [];
    state.spawnedThisWave = 5;
    stepSlice(state, idleInput(), 0.1);
    expect(state.phase).toBe("intermission");
    expect(state.lifetimeStats.wavesCleared).toBe(1);
  });

  it("unlocks, buys, and equips shop weapons during intermission", () => {
    const state = startSlice(createSliceState({ coins: 500 }));
    state.phase = "intermission";
    state.waveNumber = 1;
    const revolver = getShopItems(state).find((item) => item.id === "revolver");

    expect(revolver.unlocked).toBe(true);
    expect(revolver.affordable).toBe(true);
    expect(buyOrEquipWeapon(state, "revolver")).toEqual({ ok: true });
    expect(state.equippedWeaponId).toBe("revolver");
    expect(state.ownedWeapons).toContain("revolver");
  });

  it("cycles through owned PlayCanvas weapons", () => {
    const state = startSlice(createSliceState({ coins: 500 }));
    state.phase = "intermission";
    buyOrEquipWeapon(state, "revolver");

    const result = cycleOwnedWeapon(state);

    expect(result).toEqual({ ok: true, weaponId: "pipe" });
    expect(state.equippedWeaponId).toBe("pipe");
    expect(state.ammo).toBe(1);
  });

  it("buys and equips armor, then reduces incoming player damage", () => {
    const unarmored = startSlice(createSliceState());
    unarmored.waveGraceSec = 0;
    unarmored.zombies = [nearbyZombie()];
    stepSlice(unarmored, idleInput(), 1);

    const armored = startSlice(createSliceState({ coins: 500 }));
    armored.waveGraceSec = 0;
    expect(buyOrEquipArmor(armored, "kevlar")).toEqual({ ok: true });
    armored.zombies = [nearbyZombie()];
    stepSlice(armored, idleInput(), 1);

    expect(armored.equippedArmorId).toBe("kevlar");
    expect(armored.playerHp).toBeGreaterThan(unarmored.playerHp);
  });

  it("buys a med kit to restore player health", () => {
    const state = createSliceState({ coins: 50 });
    state.playerHp = 42;

    expect(buyMedKit(state)).toEqual({ ok: true });

    expect(state.playerHp).toBe(100);
    expect(state.coins).toBe(30);
  });

  it("upgrades town defenses and raises village max hp", () => {
    const state = createSliceState({ coins: 200 });
    state.villageHp = 50;

    expect(buyVillageUpgrade(state)).toEqual({ ok: true });

    expect(state.villageLevel).toBe(2);
    expect(state.maxVillageHp).toBeGreaterThan(100);
    expect(state.villageHp).toBe(state.maxVillageHp);
    expect(state.coins).toBe(20);
  });

  it("exposes mixed PlayCanvas shop items for weapons, armor, town defenses, and med kits", () => {
    const state = createSliceState({ coins: 200 });
    state.playerHp = 60;
    const items = getShopItems(state);

    expect(items.some((item) => item.type === "weapon" && item.id === "pistol")).toBe(true);
    expect(items.some((item) => item.type === "gear" && item.id === "flashlight")).toBe(true);
    expect(items.some((item) => item.type === "armor" && item.id === "leather")).toBe(true);
    expect(items.some((item) => item.type === "village" && item.id === "village_upgrade" && !item.disabled)).toBe(true);
    expect(items.some((item) => item.type === "medkit" && item.id === "medkit" && !item.disabled)).toBe(true);
  });

  it("exposes the full legacy weapon roster in the PlayCanvas field shop", () => {
    const state = createSliceState({ coins: 5000 });
    state.phase = "intermission";
    state.waveNumber = 11;
    const shopWeaponIds = getShopItems(state)
      .filter((item) => item.type === "weapon")
      .map((item) => item.id);

    expect(shopWeaponIds).toEqual(weaponsConfig.map((weapon) => weapon.id));
    expect(shopWeaponIds).toContain("pipe");
    expect(shopWeaponIds).toContain("machine_pistol");
    expect(shopWeaponIds).toContain("lmg");
    expect(shopWeaponIds).toContain("rpg");
    expect(shopWeaponIds).toContain("grenade_launcher");
    expect(shopWeaponIds).toContain("flamethrower");
  });

  it("direct-equips owned PlayCanvas weapons without purchasing from hotkey paths", () => {
    const state = createSliceState({ ownedWeapons: ["pipe", "pistol", "lmg"], equippedWeaponId: "pistol" });

    expect(equipOwnedWeapon(state, "lmg")).toEqual({ ok: true, weaponId: "lmg" });
    expect(state.equippedWeaponId).toBe("lmg");
    expect(equipOwnedWeapon(state, "flamethrower")).toEqual({ ok: false, reason: "not_owned" });
    expect(state.equippedWeaponId).toBe("lmg");
  });

  it("exposes distinct PlayCanvas weapon visual identities for major legacy weapon families", () => {
    const sidearm = getPlayCanvasWeaponSnapshot(createSliceState({ ownedWeapons: ["pistol"], equippedWeaponId: "pistol" }));
    const machinePistol = getPlayCanvasWeaponSnapshot(createSliceState({ ownedWeapons: ["machine_pistol"], equippedWeaponId: "machine_pistol" }));
    const lmg = getPlayCanvasWeaponSnapshot(createSliceState({ ownedWeapons: ["lmg"], equippedWeaponId: "lmg" }));
    const shotgun = getPlayCanvasWeaponSnapshot(createSliceState({ ownedWeapons: ["shotgun"], equippedWeaponId: "shotgun" }));
    const launcher = getPlayCanvasWeaponSnapshot(createSliceState({ ownedWeapons: ["rpg"], equippedWeaponId: "rpg" }));
    const flame = getPlayCanvasWeaponSnapshot(createSliceState({ ownedWeapons: ["flamethrower"], equippedWeaponId: "flamethrower" }));
    const melee = getPlayCanvasWeaponSnapshot(createSliceState({ ownedWeapons: ["pipe"], equippedWeaponId: "pipe" }));

    expect(sidearm).toMatchObject({ id: "pistol", family: "sidearm", fireMode: "semi", viewModel: "sidearm", reticle: "sidearm" });
    expect(machinePistol).toMatchObject({ id: "machine_pistol", family: "automatic", fireMode: "automatic", viewModel: "compact", reticle: "automatic" });
    expect(lmg).toMatchObject({ id: "lmg", family: "heavy", fireMode: "automatic", viewModel: "heavy", reticle: "heavy" });
    expect(shotgun).toMatchObject({ id: "shotgun", family: "scatter", viewModel: "shotgun", reticle: "spread", shotFx: "pellet-burst" });
    expect(launcher).toMatchObject({ id: "rpg", family: "explosive", viewModel: "launcher", reticle: "blast", shotFx: "blast-orb" });
    expect(flame).toMatchObject({ id: "flamethrower", family: "flame", fireMode: "automatic", viewModel: "flamethrower", reticle: "flame", shotFx: "flame-plume" });
    expect(melee).toMatchObject({ id: "pipe", family: "melee", viewModel: "pipe", reticle: "melee", shotFx: "arc" });
    expect(new Set([sidearm.viewModel, shotgun.viewModel, launcher.viewModel, flame.viewModel, melee.viewModel]).size).toBe(5);
  });

  it("fires launcher weapons as splash damage against clustered zombies", () => {
    const state = startSlice(createSliceState({ coins: 5000 }));
    state.phase = "intermission";
    state.waveNumber = 9;
    expect(buyOrEquipWeapon(state, "rpg")).toEqual({ ok: true });
    state.phase = "running";
    state.player.x = 0;
    state.player.z = 0;
    state.player.yaw = 0;
    state.zombies = [
      { ...nearbyZombie(), id: "primary", x: 0, z: -10, hp: 100, maxHp: 100 },
      { ...nearbyZombie(), id: "splash", x: 2, z: -10, hp: 100, maxHp: 100 },
    ];

    const result = fireSliceWeapon(state);

    expect(result.hit).toBe(true);
    expect(result.hitCount).toBe(2);
    expect(result.killCount).toBe(2);
    expect(state.kills).toBe(2);
    expect(state.coins).toBeGreaterThan(0);
    expect(result.ballistic).toMatchObject({ muzzleVelocityMps: 110, distanceMeters: 10 });
    expect(state.lastCombatEvent).toMatchObject({ weaponId: "rpg", blast: true, hitCount: 2, ballistic: result.ballistic });
  });

  it("breaks village windows and records material impact reactions without friendly-fire damage", () => {
    const state = startSlice(createSliceState());
    const target = getPlayCanvasImpactSnapshot(state).windows.find((windowDef) => windowDef.id === "bell-window");
    state.zombies = [];
    state.spawnedThisWave = 0;
    state.player.x = target.x;
    state.player.z = target.z + 8;
    state.player.yaw = 0;
    const villageHpBefore = state.villageHp;

    const result = fireSliceWeapon(state);
    const impact = getPlayCanvasImpactSnapshot(state);

    expect(result.reason).toBe("impact");
    expect(result.windowShattered).toBe(true);
    expect(result.materialId).toBe("glass");
    expect(impact.brokenWindows).toBe(1);
    expect(impact.brokenWindowIds).toContain("bell-window");
    expect(impact.activeImpactFx).toBe(1);
    expect(impact.lastImpactEvent).toMatchObject({
      materialId: "glass",
      windowId: "bell-window",
      windowShattered: true,
      appliedVillageDamage: 0,
    });
    expect(impact.potentialVillageDamage).toBeGreaterThan(0);
    expect(impact.appliedVillageDamage).toBe(0);
    expect(state.villageHp).toBe(villageHpBefore);
    expect(result.ballistic).toMatchObject({ muzzleVelocityMps: 360, distanceMeters: 8 });
    expect(state.lastCombatEvent).toMatchObject({ reason: "impact", impact: true, materialId: "glass", ballistic: result.ballistic });
  });

  it("expires PlayCanvas impact events after their visual lifetime", () => {
    const state = startSlice(createSliceState());
    const target = getPlayCanvasImpactSnapshot(state).windows.find((windowDef) => windowDef.id === "bell-window");
    state.zombies = [{ ...nearbyZombie(), id: "far-zombie", x: 20, z: -38 }];
    state.player.x = target.x;
    state.player.z = target.z + 8;
    state.player.yaw = 0;

    expect(fireSliceWeapon(state).reason).toBe("impact");
    expect(getPlayCanvasImpactSnapshot(state).activeImpactFx).toBe(1);

    for (let i = 0; i < 20; i += 1) {
      stepSlice(state, idleInput(), 0.05);
    }

    expect(getPlayCanvasImpactSnapshot(state).activeImpactFx).toBe(0);
  });

  it("buys grenade, C4, and nuke packs as wave-locked ordnance", () => {
    const state = createSliceState({ coins: 2000 });
    state.waveNumber = 10;

    expect(buyGrenadePack(state, "breacher_single")).toEqual({ ok: true });
    expect(buyC4Pack(state, "c4_single")).toEqual({ ok: true });
    expect(buyNukePack(state, "nuke_single")).toEqual({ ok: true });

    expect(state.grenadeInventory.breacher).toBe(1);
    expect(state.c4Count).toBe(1);
    expect(state.nukeCount).toBe(1);
    expect(state.activeOrdnanceId).toBe("nuke");
  });

  it("buys gear and uses flint to create damaging ground fire", () => {
    const state = startSlice(createSliceState({ coins: 500 }));
    state.waveNumber = 2;
    state.phase = "intermission";

    expect(buyGearItem(state, "flashlight")).toEqual({ ok: true, gearId: "flashlight" });
    expect(buyGearItem(state, "flint_steel")).toEqual({ ok: true, gearId: "flint_steel" });
    expect(state.ownedGear).toEqual(["flashlight", "flint_steel"]);

    state.phase = "running";
    state.player.x = 0;
    state.player.z = 0;
    state.player.yaw = 0;
    state.zombies = [{ ...nearbyZombie(), id: "fire-target", x: 0, z: -5.2, hp: 70, maxHp: 70 }];

    expect(useFlintAndSteel(state)).toEqual({ ok: true });
    expect(state.firePatches).toHaveLength(1);
    stepSlice(state, idleInput(), 1.5);

    expect(state.zombies[0].hp).toBeLessThan(70);
    expect(state.flintCooldownSec).toBeGreaterThan(0);
  });

  it("exposes PlayCanvas minimap data for player, village, zombies, and fire patches", () => {
    const state = startSlice(createSliceState({ coins: 500, ownedGear: ["flint_steel"] }));
    state.player.x = 2;
    state.player.z = 7;
    state.player.yaw = 0.25;
    state.zombies = [{ ...nearbyZombie(), id: "map-zombie", x: -3, z: -9 }];
    expect(useFlintAndSteel(state)).toEqual({ ok: true });

    const snapshot = getPlayCanvasMiniMapSnapshot(state);

    expect(snapshot.worldHalfExtent).toBeGreaterThan(0);
    expect(snapshot.player).toMatchObject({ x: 2, z: 7, yaw: 0.25 });
    expect(snapshot.village).toMatchObject({ x: 0, z: -12, radius: 4.4 });
    expect(snapshot.liveZombies).toHaveLength(1);
    expect(snapshot.liveZombies[0]).toMatchObject({ id: "map-zombie", type: "walker" });
    expect(snapshot.activeFirePatches).toHaveLength(1);
    expect(snapshot.objective).toBe("defend_village");
  });

  it("enters buildings, starts villager escort, exits, and rescues at the village", () => {
    const state = startSlice(createSliceState());
    const building = buildingsConfig.find((entry) => entry.id === "village_house_a");
    const villagerSpot = building.interior.villagerSpots[0];
    const townHall = buildingsConfig.find((entry) => entry.id === "village_townhall");

    state.player.x = building.exteriorDoor.x;
    state.player.z = building.exteriorDoor.z;
    expect(interactWithPlayCanvasWorld(state)).toEqual({ ok: true, action: "enter_building", buildingId: building.id });
    expect(state.activeBuildingId).toBe(building.id);
    expect(state.openedBuildings).toContain(building.id);
    expect(state.player).toMatchObject({ x: building.interior.spawnInside.x, z: building.interior.spawnInside.z });

    state.player.x = villagerSpot.x;
    state.player.z = villagerSpot.z;
    expect(interactWithPlayCanvasWorld(state)).toEqual({ ok: true, action: "escort_started", villagerId: villagerSpot.id });
    expect(state.activeEscortVillagerId).toBe(villagerSpot.id);

    state.player.x = building.interior.doorInside.x;
    state.player.z = building.interior.doorInside.z;
    expect(interactWithPlayCanvasWorld(state)).toEqual({ ok: true, action: "exit_building", buildingId: building.id });
    expect(state.activeBuildingId).toBe(null);

    state.player.x = townHall.exteriorSpawn.x;
    state.player.z = townHall.exteriorSpawn.z - 2.8;
    for (let i = 0; i < 80; i += 1) {
      stepSlice(state, idleInput(), 0.05);
    }

    expect(state.activeEscortVillagerId).toBe(null);
    expect(state.rescuedVillagers).toContain(villagerSpot.id);
    const rescuedVillager = getPlayCanvasVillagerSnapshot(state).find((villager) => villager.id === villagerSpot.id);
    expect(rescuedVillager.state).toBe("rescued");
    expect(rescuedVillager.healthBarVisible).toBe(false);
    expect(state.coins).toBeGreaterThanOrEqual(40);
    expect(state.villagerPerkModifiers.startingGrenadesBonus).toBe(2);
  });

  it("exposes PlayCanvas building and villager snapshots", () => {
    const state = createSliceState({
      openedBuildings: ["village_house_a"],
      rescuedVillagers: ["villager_house_a"],
      deadVillagers: ["villager_house_b"],
    });

    const buildingSnapshot = getPlayCanvasBuildingSnapshot(state);
    const villagerSnapshot = getPlayCanvasVillagerSnapshot(state);

    expect(buildingSnapshot.buildings).toHaveLength(buildingsConfig.length);
    expect(buildingSnapshot.buildings.find((building) => building.id === "village_house_a").opened).toBe(true);
    expect(villagerSnapshot.find((villager) => villager.id === "villager_house_a").state).toBe("rescued");
    expect(villagerSnapshot.find((villager) => villager.id === "villager_house_b").state).toBe("dead");
    expect(villagerSnapshot.filter((villager) => villager.state === "idle").length).toBeGreaterThan(0);
  });

  it("can permanently lose an escorted villager under nearby zombie pressure", () => {
    const state = startSlice(createSliceState());
    const building = buildingsConfig.find((entry) => entry.id === "village_house_b");
    const villagerSpot = building.interior.villagerSpots[0];

    state.activeBuildingId = building.id;
    state.player.x = villagerSpot.x;
    state.player.z = villagerSpot.z;
    expect(interactWithPlayCanvasWorld(state)).toEqual({ ok: true, action: "escort_started", villagerId: villagerSpot.id });
    const escort = getPlayCanvasVillagerSnapshot(state).find((villager) => villager.id === villagerSpot.id);
    expect(escort.healthBarVisible).toBe(true);
    state.activeBuildingId = null;
    const liveEscort = state.villagers.find((villager) => villager.id === villagerSpot.id);
    state.zombies = [
      { ...nearbyZombie(), id: "escort-biter-1", x: liveEscort.x, z: liveEscort.z },
      { ...nearbyZombie(), id: "escort-biter-2", x: liveEscort.x + 0.2, z: liveEscort.z },
      { ...nearbyZombie(), id: "escort-biter-3", x: liveEscort.x - 0.2, z: liveEscort.z },
    ];

    for (let i = 0; i < 90; i += 1) {
      stepSlice(state, idleInput(), 0.05);
    }

    expect(state.activeEscortVillagerId).toBe(null);
    expect(state.deadVillagers).toContain(villagerSpot.id);
    expect(state.rescuedVillagers).not.toContain(villagerSpot.id);
    expect(getPlayCanvasVillagerSnapshot(state).find((villager) => villager.id === villagerSpot.id)).toMatchObject({
      state: "dead",
      hp: 0,
      healthBarVisible: false,
    });
  });

  it("applies rescued villager perks to PlayCanvas economy, health, rewards, and ordnance", () => {
    const blacksmithDiscount = createSliceState({ rescuedVillagers: ["villager_blacksmith"], coins: 500 });
    blacksmithDiscount.phase = "intermission";
    blacksmithDiscount.waveNumber = 1;
    const revolverDef = weaponsConfig.find((weapon) => weapon.id === "revolver");
    const discountedRevolver = getShopItems(blacksmithDiscount).find((item) => item.id === "revolver");
    expect(discountedRevolver.cost).toBeLessThan(revolverDef.cost);
    expect(buyOrEquipWeapon(blacksmithDiscount, "revolver")).toEqual({ ok: true });
    expect(blacksmithDiscount.coins).toBe(500 - discountedRevolver.cost);

    const townHallPerk = createSliceState({ rescuedVillagers: ["villager_townhall"] });
    expect(townHallPerk.maxVillageHp).toBeGreaterThan(100);

    const grenadierPerk = createSliceState({ rescuedVillagers: ["villager_house_a"] });
    expect(grenadierPerk.grenadeInventory.frag).toBe(7);

    const bountyPerk = startSlice(createSliceState({ rescuedVillagers: ["villager_house_b"] }));
    bountyPerk.zombies = [{ ...nearbyZombie(), id: "bounty-target", x: 0, z: -5, hp: 5, maxHp: 5, coinReward: 10 }];
    bountyPerk.player.x = 0;
    bountyPerk.player.z = 0;
    bountyPerk.player.yaw = 0;
    fireSliceWeapon(bountyPerk);
    expect(bountyPerk.coins).toBe(11);

    const chapelPerk = startSlice(createSliceState({ rescuedVillagers: ["villager_chapel"] }));
    chapelPerk.waveGraceSec = 0;
    chapelPerk.zombies = [nearbyZombie()];
    stepSlice(chapelPerk, idleInput(), 1);
    const noPerk = startSlice(createSliceState());
    noPerk.waveGraceSec = 0;
    noPerk.zombies = [nearbyZombie()];
    stepSlice(noPerk, idleInput(), 1);
    expect(chapelPerk.playerHp).toBeGreaterThan(noPerk.playerHp);

    const barnPerk = startSlice(createSliceState({ rescuedVillagers: ["villager_barn"], c4Count: 1, activeOrdnanceId: "c4" }));
    barnPerk.zombies = [{ ...nearbyZombie(), id: "blast-target", x: 0, z: -6 }];
    expect(useOrdnance(barnPerk).ok).toBe(true);
    expect(barnPerk.ordnanceCooldownSec).toBeLessThan(0.7);
  });

  it("cycles and uses PlayCanvas ordnance to damage and consume inventory", () => {
    const state = startSlice(createSliceState({ coins: 500 }));
    state.waveNumber = 4;
    state.zombies = [nearbyZombie(), { ...nearbyZombie(), id: "second-zombie", x: 1, hp: 80, maxHp: 80 }];
    buyC4Pack(state, "c4_single");

    expect(cycleOrdnance(state)).toEqual({ ok: true, activeOrdnanceId: "frag" });
    state.activeOrdnanceId = "c4";
    const result = useOrdnance(state);

    expect(result.ok).toBe(true);
    expect(result.hitCount).toBeGreaterThan(0);
    expect(state.c4Count).toBe(0);
    expect(state.zombies.some((zombie) => zombie.dead)).toBe(true);
  });

  it("lobs a grenade as an in-flight projectile that detonates on landing", () => {
    const state = startSlice(createSliceState());
    state.waveGraceSec = 0;
    state.activeOrdnanceId = "frag";
    state.grenadeInventory.frag = 3;
    // Aim down-range over open ground; target sits where the lob will land.
    state.player.x = 0;
    state.player.z = 8;
    state.player.yaw = Math.PI; // fire +Z
    state.player.pitch = 0;
    state.zombies = [{ ...nearbyZombie(), x: 0, z: 30, hp: 200, maxHp: 200 }];

    const throwResult = useOrdnance(state);
    expect(throwResult).toMatchObject({ ok: true, lobbed: true, ordnanceId: "frag" });
    expect(state.grenadeInventory.frag).toBe(2); // consumed one
    // The grenade is now airborne — no immediate damage.
    expect(getPlayCanvasOrdnanceProjectiles(state)).toHaveLength(1);
    expect(state.zombies[0].hp).toBe(200);

    // Fly it out: step until it detonates (lands or hits the zombie).
    let detonations = [];
    for (let i = 0; i < 120 && detonations.length === 0; i += 1) {
      stepSlice(state, idleInput(), 0.05);
      detonations = detonations.concat(consumePlayCanvasOrdnanceDetonations(state));
    }

    expect(detonations.length).toBeGreaterThan(0);
    expect(getPlayCanvasOrdnanceProjectiles(state)).toHaveLength(0);
    // Detonation point is down-range from the throw origin, near ground level.
    expect(detonations[0].z).toBeGreaterThan(12);
    expect(detonations[0].y).toBeLessThan(2);
    // It actually damaged the nearby zombie when it went off.
    expect(state.zombies[0].hp).toBeLessThan(200);
  });

  it("throws airborne grenades from the player's current height before detonating on contact", () => {
    const state = startSlice(createSliceState());
    state.waveGraceSec = 0;
    state.activeOrdnanceId = "frag";
    state.grenadeInventory.frag = 3;
    state.player.x = 0;
    state.player.z = 8;
    state.player.y = 4;
    state.player.yaw = Math.PI; // throw +Z
    state.player.pitch = 0;
    state.zombies = [{ ...nearbyZombie(), x: 0, z: 9.42, hp: 200, maxHp: 200 }];

    const throwResult = useOrdnance(state);
    expect(throwResult).toMatchObject({ ok: true, lobbed: true, ordnanceId: "frag" });
    let projectiles = getPlayCanvasOrdnanceProjectiles(state);
    expect(projectiles).toHaveLength(1);
    expect(projectiles[0].y).toBeGreaterThan(5.4);

    stepSlice(state, idleInput(), 0.05);
    expect(consumePlayCanvasOrdnanceDetonations(state)).toHaveLength(0);
    projectiles = getPlayCanvasOrdnanceProjectiles(state);
    expect(projectiles).toHaveLength(1);
    expect(projectiles[0].y).toBeGreaterThan(5);
    expect(state.zombies[0].hp).toBe(200);
  });

  it("reserves configured mega zombie slots in escalation waves", () => {
    const state = startSlice(createSliceState());
    state.waveIndex = 4;
    state.waveNumber = 5;
    state.spawnedThisWave = 0;
    state.megaSpawnedThisWave = 0;
    state.bossSpawnedThisWave = false;
    state.zombies = [];
    state.spawnTimerSec = -999;
    state.waveGraceSec = 0;

    stepSlice(state, idleInput(), 0.05);

    expect(state.zombies.filter((zombie) => zombie.type === "mega_zombie")).toHaveLength(3);
  });

  it("spawns exactly one mini boss on wave 3", () => {
    const state = startSlice(createSliceState());
    state.waveIndex = 2;
    state.waveNumber = 3;
    state.spawnedThisWave = 0;
    state.megaSpawnedThisWave = 0;
    state.bossSpawnedThisWave = false;
    state.zombies = [];
    state.spawnTimerSec = -999;
    state.waveGraceSec = 0;

    stepSlice(state, idleInput(), 0.05);

    expect(state.zombies.filter((zombie) => zombie.type === "mini_boss")).toHaveLength(1);
    expect(state.zombies.filter((zombie) => zombie.type === "mega_zombie")).toHaveLength(0);
    expect(state.spawnedThisWave).toBe(12);
    expect(state.bossSpawnedThisWave).toBe(true);
  });

  it("spawns the configured PlayCanvas boss on boss waves", () => {
    const state = startSlice(createSliceState());
    state.waveIndex = 5;
    state.waveNumber = 6;
    state.spawnedThisWave = 0;
    state.megaSpawnedThisWave = 0;
    state.bossSpawnedThisWave = false;
    state.zombies = [];
    state.spawnTimerSec = -999;
    state.waveGraceSec = 0;

    stepSlice(state, idleInput(), 0.05);
    const bossSnapshot = getPlayCanvasBossSnapshot(state);

    expect(state.zombies.filter((zombie) => zombie.type === "mega_zombie")).toHaveLength(3);
    expect(state.zombies.some((zombie) => zombie.type === "mini_boss")).toBe(true);
    expect(state.zombies.some((zombie) => zombie.type === "secret_boss")).toBe(false);
    expect(bossSnapshot.bossWaveActive).toBe(true);
    expect(bossSnapshot.landscapeZombified).toBe(3);
    expect(bossSnapshot.lastMutationEvent).toMatchObject({ wave: 6, count: 3 });
    expect(bossSnapshot.mutatedLandscapeIds).toHaveLength(3);
  });

  // ── Enemy behaviour variety tests ────────────────────────────────────────

  it("leaper at ~5m with cooldown ready telegraphs then pounces faster than a walker", () => {
    const state = startSlice(createSliceState());
    state.waveGraceSec = 0;

    // Player at origin, leaper 5m away (within pounce window 2.5-8m)
    state.player.x = 0;
    state.player.z = 0;
    const leaper = makeLeaper({ x: 0, z: -5, jumpCooldownSec: 0 });
    // Reference walker that will travel the same elapsed time
    const walker = makeWalker({ x: 0, z: -5 });
    state.zombies = [leaper, walker];

    // Step 1: one tick (0.05s) — leaper should enter telegraph, walker walks
    stepSlice(state, idleInput(), 0.05);
    expect(leaper.telegraphType).toBe("pounce");
    expect(leaper.telegraphSec).toBeGreaterThan(0);

    const leaperZAtTelegraph = leaper.z;
    const walkerZAtTelegraph = walker.z;

    // Step 2: burn off telegraph (0.40s) + full pounce (0.45s) + buffer for last tick
    // stepSlice caps each call at 0.05s, so we loop at fixed 0.05s ticks.
    // Need 20 ticks after the first one (first tick sets telegraphSec=0.40,
    // which needs 8 ticks to drain, 1 to launch, 9 to complete, 1 slack = 19 more).
    advanceSec(state, 0.40 + 0.45 + 0.10);

    // Leaper should have covered more total ground than walker since telegraph
    // started, because jumpSpeed (4.8) >> walkSpeed (1.55).
    const leaperDisplacement = leaper.z - leaperZAtTelegraph;
    const walkerDisplacement = walker.z - walkerZAtTelegraph;
    expect(leaperDisplacement).toBeGreaterThan(walkerDisplacement);

    // After pounce completes: cooldown reset, telegraphType cleared
    expect(leaper.telegraphType).toBe("none");
    expect(leaper.jumpCooldownSec).toBeGreaterThan(0);
    expect(leaper.pounceSec).toBeLessThanOrEqual(0);
  });

  it("leaper telegraph transitions: none → pounce → none", () => {
    const state = startSlice(createSliceState());
    state.waveGraceSec = 0;
    state.player.x = 0;
    state.player.z = 0;
    const leaper = makeLeaper({ x: 0, z: -5, jumpCooldownSec: 0 });
    state.zombies = [leaper];

    // First tick: should start telegraph
    stepSlice(state, idleInput(), 0.05);
    expect(leaper.telegraphType).toBe("pounce");

    // Burn remaining telegraph (0.35s) + pounce (0.45s) + 2 ticks slack.
    // stepSlice caps at 0.05s each call; need 19 more ticks after the first one.
    advanceSec(state, 0.35 + 0.45 + 0.15);
    expect(leaper.telegraphType).toBe("none");
    expect(leaper.pounceSec).toBeLessThanOrEqual(0);
  });

  it("flyer y is approximately hoverHeight after a step", () => {
    const state = startSlice(createSliceState());
    state.waveGraceSec = 0;
    state.player.x = 0;
    state.player.z = 0;
    const flyer = makeFlyer({ x: 0, z: -10, hoverHeight: 1.45 });
    state.zombies = [flyer];

    stepSlice(state, idleInput(), 0.05);

    // y should be hoverHeight ± bob amplitude (0.12)
    const bobAmp = 0.12;
    expect(flyer.y).toBeGreaterThan(1.45 - bobAmp - 0.01);
    expect(flyer.y).toBeLessThan(1.45 + bobAmp + 0.01);

    // revenant style: higher hoverHeight
    flyer.hoverHeight = 1.9;
    stepSlice(state, idleInput(), 0.05);
    expect(flyer.y).toBeGreaterThan(1.9 - bobAmp - 0.01);
    expect(flyer.y).toBeLessThan(1.9 + bobAmp + 0.01);
  });

  it("boss (mini_boss) enters slam telegraph and charges faster than walk speed", () => {
    const state = startSlice(createSliceState());
    state.waveGraceSec = 0;
    state.player.x = 0;
    state.player.z = 0;
    // Place boss at 6m — within PLAYER_AGGRO_RADIUS * 0.6 = 7.8m so slam triggers
    const boss = makeBoss({ x: 0, z: -6, slamCooldownSec: 0 });
    state.zombies = [boss];

    // First tick: trigger slam telegraph
    stepSlice(state, idleInput(), 0.05);
    expect(boss.telegraphType).toBe("slam");
    expect(boss.telegraphSec).toBeGreaterThan(0);

    const zAfterTelegraphStart = boss.z;

    // Burn telegraph (0.70s) then run charge for 0.3s
    advanceSec(state, 0.70 + 0.30);

    // Boss should have charged at 1.8× walk speed during charge phase
    // 0.3s × 1.05 × 1.8 ≈ 0.567m toward player (z=0 from z=-6)
    const displacement = boss.z - zAfterTelegraphStart;
    const minimumExpected = 0.3 * 1.05 * 1.8 * 0.8; // 0.8 tolerance
    expect(displacement).toBeGreaterThan(minimumExpected);
  });

  it("boss slam hit fires at most once per charge when player is in range", () => {
    const state = startSlice(createSliceState());
    state.waveGraceSec = 0;
    state.player.x = 0;
    state.player.z = 0;
    state.playerHp = 100;

    // Place boss 1.5m away — inside SLAM_LAND_RADIUS (2.0m)
    const boss = makeBoss({ x: 0, z: -1.5, slamCooldownSec: 0 });
    // Fast-forward: skip telegraph and put boss directly into charge phase
    boss.telegraphSec = 0;
    boss.pounceSec = 0.60;  // already charging for 0.60s
    boss.pounceTargetX = 0;
    boss.pounceTargetZ = 0;
    boss.slamHitFired = false;
    state.zombies = [boss];

    const hpBefore = state.playerHp;

    // Advance just enough to finish the charge (1 tick of 0.05s removes 0.05 from pounceSec,
    // we need >0.60s to complete it — use 0.65s worth of ticks)
    advanceSec(state, 0.65);

    const hpAfter = state.playerHp;
    // Slam should have landed (boss within SLAM_LAND_RADIUS at charge end)
    expect(hpAfter).toBeLessThan(hpBefore);
    expect(hpAfter).toBeGreaterThan(0);   // not instakill
    expect(boss.slamHitFired).toBe(true);

    // slamHitFired stays true until next charge cycle starts
    const hpAfterExtra = state.playerHp;
    stepSlice(state, idleInput(), 0.05);
    expect(boss.slamHitFired).toBe(true); // not reset until next telegraph
  });

  it("starts a secret boss phase after final wave and wins only after the boss is defeated", () => {
    const state = startSlice(createSliceState());
    state.waveIndex = 11;
    state.waveNumber = 12;
    state.spawnedThisWave = 30;
    state.zombies = [];

    stepSlice(state, idleInput(), 0.1);

    expect(state.phase).toBe("secret_boss");
    expect(state.secretBossActive).toBe(true);
    expect(state.secretBossSpawned).toBe(true);
    expect(state.zombies.some((zombie) => zombie.type === "secret_boss")).toBe(true);
    expect(state.zombies.filter((zombie) => zombie.type === "mega_zombie")).toHaveLength(1);
    const bossSnapshot = getPlayCanvasBossSnapshot(state);
    expect(bossSnapshot.secretBossActive).toBe(true);
    expect(bossSnapshot.landscapeZombified).toBe(6);
    expect(bossSnapshot.lastMutationEvent).toMatchObject({ wave: 13, count: 6 });

    for (const zombie of state.zombies) {
      zombie.dead = true;
      zombie.hp = 0;
    }
    stepSlice(state, idleInput(), 0.1);

    expect(state.phase).toBe("won");
    expect(state.secretBossActive).toBe(false);
    expect(state.lastMessage).toContain("Secret boss defeated");
  });

  // ── Rewarded-ad offers (Deliverable A) ─────────────────────────────────────

  it("DOUBLE_WAVE_COINS adds wave coins once; re-claim is blocked by claimKey", () => {
    const state = createSliceState({ coins: 50 });
    state.phase = "intermission";
    state.waveSummary = { wave: 2, kills: 5, coins: 30, coinsEarned: 30 };
    state.claimedOfferKeys = [];

    const claimKey = "summary:2:double_wave_coins";
    const result1 = applyPlayCanvasRewardedOffer(state, "double_wave_coins", claimKey);
    expect(result1.applied).toBe(true);
    expect(state.coins).toBe(80); // 50 + 30
    expect(state.claimedOfferKeys).toContain(claimKey);

    // Second attempt with same key is blocked
    const result2 = applyPlayCanvasRewardedOffer(state, "double_wave_coins", claimKey);
    expect(result2.applied).toBe(false);
    expect(state.coins).toBe(80); // unchanged
  });

  it("FREE_MEDKIT heals player to full HP", () => {
    const state = createSliceState();
    state.phase = "intermission";
    state.waveSummary = { wave: 3, kills: 2, coins: 10 };
    state.playerHp = 45;
    state.maxPlayerHp = 100;
    state.claimedOfferKeys = [];

    const claimKey = "summary:3:free_medkit";
    const result = applyPlayCanvasRewardedOffer(state, "free_medkit", claimKey);
    expect(result.applied).toBe(true);
    expect(state.playerHp).toBe(100);
    expect(state.claimedOfferKeys).toContain(claimKey);

    // Re-claim blocked
    state.playerHp = 50;
    const result2 = applyPlayCanvasRewardedOffer(state, "free_medkit", claimKey);
    expect(result2.applied).toBe(false);
    expect(state.playerHp).toBe(50);
  });

  it("BONUS_GRENADES adds 3 frags to grenade inventory", () => {
    const state = createSliceState();
    state.phase = "intermission";
    state.waveSummary = { wave: 1, kills: 3, coins: 15 };
    state.claimedOfferKeys = [];
    const before = state.grenadeInventory.frag ?? 5;

    const claimKey = "summary:1:bonus_grenades";
    const result = applyPlayCanvasRewardedOffer(state, "bonus_grenades", claimKey);
    expect(result.applied).toBe(true);
    expect(state.grenadeInventory.frag).toBe(before + 3);
    expect(state.claimedOfferKeys).toContain(claimKey);

    // Re-claim blocked
    const result2 = applyPlayCanvasRewardedOffer(state, "bonus_grenades", claimKey);
    expect(result2.applied).toBe(false);
    expect(state.grenadeInventory.frag).toBe(before + 3);
  });

  it("REVIVE is one-per-run: succeeds once then blocks", () => {
    const state = createSliceState();
    state.phase = "lost";
    state.playerHp = 0;
    state.reviveUsed = false;

    const result1 = applyPlayCanvasRewardedOffer(state, "revive", "run:revive");
    expect(result1.applied).toBe(true);
    expect(state.reviveUsed).toBe(true);
    expect(state.playerHp).toBe(60);
    expect(state.phase).toBe("running");

    // Second attempt blocked
    state.phase = "lost";
    const result2 = applyPlayCanvasRewardedOffer(state, "revive", "run:revive");
    expect(result2.applied).toBe(false);
  });

  it("getPlayCanvasSummaryOffers filters by claimed status and hides double-coins if waveCoins=0", () => {
    const state = createSliceState();
    state.phase = "intermission";
    state.waveSummary = { wave: 4, kills: 8, coins: 0, coinsEarned: 0 }; // 0 coins this wave
    state.playerHp = 80; // not full
    state.claimedOfferKeys = [];

    const offers = getPlayCanvasSummaryOffers(state);
    // double_wave_coins hidden when waveCoins=0
    expect(offers.find((o) => o.id === "double_wave_coins")).toBeUndefined();
    // free_medkit and bonus_grenades present
    expect(offers.find((o) => o.id === "free_medkit")).toBeDefined();
    expect(offers.find((o) => o.id === "bonus_grenades")).toBeDefined();

    // Claim bonus_grenades — it should disappear from offers
    const grKey = "summary:4:bonus_grenades";
    state.claimedOfferKeys.push(grKey);
    const offers2 = getPlayCanvasSummaryOffers(state);
    expect(offers2.find((o) => o.id === "bonus_grenades")).toBeUndefined();
  });

  it("getPlayCanvasGameOverOffers includes revive when not yet used, excludes when used", () => {
    const state = createSliceState();
    state.phase = "lost";
    state.reviveUsed = false;
    state.waveSummary = { wave: 2, kills: 4, coins: 25 };
    state.claimedOfferKeys = [];

    const offers = getPlayCanvasGameOverOffers(state);
    expect(offers.find((o) => o.id === "revive")).toBeDefined();

    state.reviveUsed = true;
    const offers2 = getPlayCanvasGameOverOffers(state);
    expect(offers2.find((o) => o.id === "revive")).toBeUndefined();
  });

  it("records PlayCanvas rewarded-ad telemetry and caps the run buffer at 80 events", () => {
    const state = createSliceState();
    state.phase = "intermission";
    state.waveSummary = { wave: 2, kills: 4, coins: 40, coinsEarned: 40 };

    for (let i = 0; i < 82; i += 1) {
      recordPlayCanvasRewardedAdEvent(
        state,
        `event_${i}`,
        { offerId: "bonus_grenades", claimKey: "summary:2:bonus_grenades", provider: "test" },
        { now: () => 1000 + i },
      );
    }

    const snapshot = getPlayCanvasRewardedAdSnapshot(state);
    expect(snapshot.telemetryCount).toBe(80);
    expect(snapshot.lastEventType).toBe("event_81");
    expect(snapshot.lastOfferId).toBe("bonus_grenades");
    expect(snapshot.lastProvider).toBe("test");
    expect(state.rewardedRunState.telemetry[0].type).toBe("event_2");
  });

  it("mirrors rewarded run-state claim keys and revive status into the PlayCanvas snapshot", () => {
    const state = createSliceState();
    state.phase = "lost";
    state.playerHp = 0;

    const result = applyPlayCanvasRewardedOffer(state, "revive", "run:revive");
    recordPlayCanvasRewardedAdEvent(
      state,
      result.applied ? "reward_granted" : "reward_rejected",
      { offerId: "revive", claimKey: "run:revive", provider: "test", reward: result.reward ?? null },
      { now: () => 1234 },
    );

    const snapshot = getPlayCanvasRewardedAdSnapshot(state);
    expect(snapshot.reviveUsed).toBe(true);
    expect(snapshot.lastEventType).toBe("reward_granted");
    expect(snapshot.lastEvent?.reward).toEqual({ hp: 60 });
    expect(snapshot.claimedOfferKeys).toEqual([]);

    state.claimedOfferKeys.push("summary:3:bonus_grenades");
    expect(getPlayCanvasRewardedAdSnapshot(state).claimedOfferKeys).toContain("summary:3:bonus_grenades");
  });

  // ── Bug-fix regression tests ────────────────────────────────────────────────

  it("DOUBLE_WAVE_COINS only adds wave earnings, not the full bank (economy exploit fix)", () => {
    // Start a wave so coinsAtWaveStart is recorded, then earn some coins during wave.
    const state = startSlice(createSliceState());
    // Force a known bank balance at wave start (beginWave already captured coinsAtWaveStart).
    // Override coinsAtWaveStart to match current coins, then add earnings on top.
    state.coinsAtWaveStart = state.coins; // e.g. 0
    state.coins = state.coins + 80;       // earned 80 during the wave

    // Manually complete wave to build waveSummary with coinsEarned.
    state.phase = "intermission";
    state.waveSummary = {
      wave: state.waveNumber,
      kills: 3,
      coins: state.coins,
      coinsEarned: Math.max(0, state.coins - state.coinsAtWaveStart),
    };
    state.claimedOfferKeys = [];

    const coinsBefore = state.coins; // 80 (or whatever initial + 80)
    const earned = state.waveSummary.coinsEarned; // 80
    const claimKey = `summary:${state.waveNumber}:double_wave_coins`;
    const result = applyPlayCanvasRewardedOffer(state, "double_wave_coins", claimKey);

    expect(result.applied).toBe(true);
    expect(state.coins).toBe(coinsBefore + earned); // only wave earnings doubled, not full bank
  });

  it("rescueVillager awards coins exactly once even if triggered twice for the same villager", () => {
    const state = startSlice(createSliceState());
    // Find a villager in state and set it up for escort rescue via interactWithPlayCanvasWorld.
    const villager = state.villagers[0];
    const dropoff = { x: 0, z: -12 }; // approximate dropoff (Town Hall exteriorSpawn)

    // First rescue: position villager at dropoff and set escort active.
    villager.state = "escorting";
    villager.x = dropoff.x;
    villager.z = dropoff.z;
    state.activeEscortVillagerId = villager.id;
    state.activeBuildingId = null;

    const coinsBefore = state.coins;
    interactWithPlayCanvasWorld(state); // triggers rescueVillager → alreadyRescued=false → coins awarded

    const coinsAfterFirst = state.coins;
    expect(coinsAfterFirst).toBe(coinsBefore + 40); // VILLAGER_RESCUE_COIN_REWARD = 40

    // Second rescue attempt for same villager: re-set escort state so rescueVillager is called again.
    villager.state = "escorting";
    state.activeEscortVillagerId = villager.id;

    interactWithPlayCanvasWorld(state); // alreadyRescued=true → no extra coins

    expect(state.coins).toBe(coinsAfterFirst); // coins unchanged on duplicate rescue
  });

  // ── Persistent Goals (Deliverable B) ───────────────────────────────────────

  it("evaluateGoals completes reach_wave_5 when bestWave >= 5 and records it in claimedGoalIds", () => {
    const state = createSliceState();
    state.bestWave = 5;
    state.claimedGoalIds = [];
    state.coins = 0;

    const completed = evaluateGoals(state);
    expect(completed).toContain("reach_wave_5");
    expect(state.claimedGoalIds).toContain("reach_wave_5");
    // Coin bonus applied
    expect(state.coins).toBeGreaterThan(0);
  });

  it("evaluateGoals does not re-fire a goal already in claimedGoalIds", () => {
    const state = createSliceState();
    state.bestWave = 5;
    state.claimedGoalIds = ["reach_wave_5"];
    const coinsBefore = state.coins;

    const completed = evaluateGoals(state);
    expect(completed).not.toContain("reach_wave_5");
    expect(state.coins).toBe(coinsBefore); // no bonus re-applied
  });

  it("evaluateGoals completes kills_500 when lifetimeStats.kills >= 500", () => {
    const state = createSliceState({ lifetimeStats: { kills: 500, damageDealt: 0, damageTaken: 0, villageDamageTaken: 0, wavesCleared: 0, playSeconds: 0 } });
    state.claimedGoalIds = [];

    const completed = evaluateGoals(state);
    expect(completed).toContain("kills_500");
    expect(state.claimedGoalIds).toContain("kills_500");
  });

  it("getGoalsSnapshot returns progress for all 6 goals with correct shape", () => {
    const state = createSliceState();
    state.bestWave = 3;
    state.lifetimeStats = { kills: 120, damageDealt: 800, damageTaken: 50, villageDamageTaken: 10, wavesCleared: 5, playSeconds: 600 };
    state.claimedGoalIds = ["reach_wave_5"];
    state.rescuedVillagers = [];

    const snapshot = getGoalsSnapshot(state);
    expect(snapshot).toHaveLength(6);

    const wave5Goal = snapshot.find((g) => g.id === "reach_wave_5");
    expect(wave5Goal.completed).toBe(true);

    const wave10Goal = snapshot.find((g) => g.id === "reach_wave_10");
    expect(wave10Goal.completed).toBe(false);
    expect(wave10Goal.progress.current).toBe(3);
    expect(wave10Goal.progress.max).toBe(10);

    const killsGoal = snapshot.find((g) => g.id === "kills_500");
    expect(killsGoal.progress.current).toBe(120);
  });

  it("save round-trips claimedGoalIds and claimedOfferKeys; old save without fields loads cleanly", () => {
    localStorage.clear();

    // Old save without the new fields
    localStorage.setItem(PLAYCANVAS_SAVE_KEY, JSON.stringify({
      version: 2,
      profileType: "playcanvas_village_v2",
      coins: 100,
      bestWave: 3,
    }));

    const loaded = loadPlayCanvasSave();
    expect(loaded.claimedGoalIds).toEqual([]);
    expect(loaded.claimedOfferKeys).toEqual([]);

    // Now persist a state with populated fields
    const state = createSliceState(loaded);
    state.claimedGoalIds = ["reach_wave_5"];
    state.claimedOfferKeys = ["summary:3:bonus_grenades"];
    const persisted = persistPlayCanvasSave(state);
    expect(persisted.claimedGoalIds).toEqual(["reach_wave_5"]);
    expect(persisted.claimedOfferKeys).toEqual(["summary:3:bonus_grenades"]);

    // Re-load and confirm round-trip
    const reloaded = loadPlayCanvasSave();
    expect(reloaded.claimedGoalIds).toEqual(["reach_wave_5"]);
    expect(reloaded.claimedOfferKeys).toEqual(["summary:3:bonus_grenades"]);

    localStorage.clear();
  });
});

describe("zombie fence collision", () => {
  beforeEach(() => localStorage.clear());

  // Player parked outside the lane (past the right fence at x≈7.2); one zombie
  // inside the lane, aggroed onto the player so it drives toward the fence.
  function chaseState(overrides) {
    const state = startSlice(createSliceState());
    state.waveGraceSec = 0;
    state.spawnedThisWave = 9999; // suppress the wave spawner during the test
    state.player.x = 15;
    state.player.z = 0;
    state.zombies = [
      {
        ...nearbyZombie(),
        x: 5,
        z: 0,
        y: 0,
        speedMps: 4,
        aggroPlayerSec: 60,
        jumpCooldownSec: 0,
        telegraphSec: 0,
        pounceSec: 0,
        ...overrides,
      },
    ];
    return state;
  }

  function runChase(state, steps = 90) {
    for (let i = 0; i < steps; i += 1) stepSlice(state, idleInput(), 0.05);
    return state.zombies[0];
  }

  it("blocks a plain ground zombie at a side fence", () => {
    const z = runChase(chaseState({ type: "walker", movementMode: "ground", canClimb: false }));
    // Stopped on the lane side of the fence (inner edge ≈ 7.04), never through.
    expect(z.x).toBeLessThan(7);
  });

  it("blocks climber-flagged ground zombies at a side fence", () => {
    const z = runChase(chaseState({ type: "skitter", movementMode: "ground", canClimb: true }));
    expect(z.x).toBeLessThan(7);
  });

  it("blocks leapers at a side fence instead of letting them hop through wall geometry", () => {
    const z = runChase(
      chaseState({ type: "leaper", movementMode: "leaper", canClimb: false, jumpSpeed: 6, jumpIntervalSec: 1.2 }),
    );
    expect(z.x).toBeLessThan(7);
  });

  it("lets a flyer fly over a fence", () => {
    const z = runChase(chaseState({ type: "flyer", movementMode: "flyer", canClimb: false, hoverHeight: 1.45 }));
    expect(z.x).toBeGreaterThan(7.4);
  });

  it("does not lift climbers into an up-and-over arc through the fence plane", () => {
    const state = chaseState({ type: "skitter", movementMode: "ground", canClimb: true });
    let sawLift = false;
    for (let i = 0; i < 90; i += 1) {
      stepSlice(state, idleInput(), 0.05);
      if ((state.zombies[0].y ?? 0) > 0.4) sawLift = true;
    }
    expect(sawLift).toBe(false);
    expect(state.zombies[0].x).toBeLessThan(7);
  });

  it("blocks boss-class zombies at a side fence", () => {
    const z = runChase(chaseState({ type: "mega_zombie", movementMode: "ground", canClimb: false, speedMps: 4 }), 110);
    expect(z.x).toBeLessThan(7);
  });

  it("tags the intended climbers in the enemy config", () => {
    const byId = Object.fromEntries(enemiesConfig.map((e) => [e.id, e]));
    for (const id of ["skitter", "runner", "brute", "armored"]) {
      expect(byId[id]?.canClimb).toBe(true);
    }
    // A plain walker stays blocked by fences.
    expect(byId.walker?.canClimb ?? false).toBe(false);
  });

  it("uses configured zigzag strength for target-relative ground strafing", () => {
    const byId = Object.fromEntries(enemiesConfig.map((e) => [e.id, e]));
    expect(byId.runner?.zigzagStrength).toBe(0.24);
    expect(byId.skitter?.zigzagStrength).toBe(0.5);

    const runOneStep = (overrides) => {
      const state = startSlice(createSliceState());
      state.waveGraceSec = 0;
      state.spawnedThisWave = 9999;
      state.player.x = 0;
      state.player.z = 0;
      state.zombies = [
        {
          ...nearbyZombie(),
          id: `${overrides.type}-1`,
          x: 0,
          z: -8,
          speedMps: 1,
          aggroPlayerSec: 60,
          ...overrides,
        },
      ];
      stepSlice(state, idleInput(), 0.05);
      return state.zombies[0];
    };

    const walker = runOneStep({ type: "walker", movementMode: "ground", zigzagStrength: byId.walker?.zigzagStrength ?? 0 });
    const runner = runOneStep({ type: "runner", movementMode: "ground", zigzagStrength: byId.runner.zigzagStrength });
    const skitter = runOneStep({ type: "skitter", movementMode: "ground", zigzagStrength: byId.skitter.zigzagStrength });

    expect(Math.abs(walker.x)).toBeLessThan(0.001);
    expect(Math.abs(runner.x)).toBeGreaterThan(Math.abs(walker.x));
    expect(Math.abs(skitter.x)).toBeGreaterThan(Math.abs(runner.x));
  });

  it("spawns ground zombies inside the fenced lane corridor", () => {
    const state = startSlice(createSliceState());
    state.waveGraceSec = 0;
    for (let i = 0; i < 25; i += 1) stepSlice(state, idleInput(), 0.1);
    expect(state.zombies.length).toBeGreaterThan(0);
    for (const z of state.zombies) {
      expect(Math.abs(z.x)).toBeLessThan(7.04);
    }
  });
});

describe("revive + invulnerability", () => {
  beforeEach(() => localStorage.clear());

  it("revive sets phase to 'running' and sim advances afterward", () => {
    const state = startSlice(createSliceState());
    state.phase = "lost";
    state.playerHp = 0;
    state.reviveUsed = false;
    state.secretBossActive = false;

    const result = revivePlayer(state);
    expect(result.ok).toBe(true);
    expect(state.phase).toBe("running");

    // Sim must advance (stepSlice must not bail early)
    const elapsedBefore = state.elapsedSec;
    stepSlice(state, idleInput(), 0.05);
    expect(state.phase).toBe("running");
    expect(state.elapsedSec).toBeGreaterThan(elapsedBefore);
  });

  it("invulnerability frames protect the player from bites during the window", () => {
    const state = startSlice(createSliceState());
    state.phase = "lost";
    state.playerHp = 0;
    state.reviveUsed = false;
    state.secretBossActive = false;

    revivePlayer(state, { hp: 60, invulnerableSec: 3 });
    expect(state.invulnerableSec).toBe(3);

    // Place a zombie in bite range
    state.zombies = [{ ...nearbyZombie(), x: state.player.x, z: state.player.z + 0.8, biteCooldownSec: 0 }];
    state.waveGraceSec = 0;

    const hpAfterRevive = state.playerHp;

    // Step several ticks within the invulnerability window (0.3s << 3s)
    for (let i = 0; i < 6; i++) {
      stepSlice(state, idleInput(), 0.05);
    }
    // HP must be unchanged despite zombie in bite range
    expect(state.playerHp).toBe(hpAfterRevive);

    // Now advance past the window (3s total) and confirm damage can land
    // We've used 0.3s so far; step until invulnerableSec reaches 0, then one more bite interval
    for (let i = 0; i < 80; i++) {
      stepSlice(state, idleInput(), 0.05);
    }
    // After ~4s total, invulnerability is gone and zombie has had time to bite
    expect(state.playerHp).toBeLessThan(hpAfterRevive);
  });

  it("isWaveCleared (via stepSlice) does not throw with an out-of-range waveIndex", () => {
    const state = startSlice(createSliceState());
    state.phase = "running";
    state.waveIndex = 9999; // far out of range
    state.spawnedThisWave = 0;
    state.zombies = [];
    state.waveGraceSec = 0;

    // Must not throw
    expect(() => stepSlice(state, idleInput(), 0.05)).not.toThrow();
    // Phase should not have advanced to intermission (wave doesn't exist)
    expect(state.phase).not.toBe("intermission");
  });
});

function idleInput() {
  return {
    forward: 0,
    back: 0,
    left: 0,
    right: 0,
    sprint: false,
  };
}

function nearbyZombie() {
  return {
    id: "test-zombie",
    type: "walker",
    label: "Walker",
    x: 0,
    z: 12,
    hp: 100,
    maxHp: 100,
    speedMps: 0,
    attackDps: 20,
    coinReward: 10,
    movementMode: "ground",
    attackRange: 1.6,
    hitFlashSec: 0,
    biteCooldownSec: 0,
    dead: false,
  };
}

// ── Behaviour-variety test helpers ────────────────────────────────────────

/** Run stepSlice at 0.05s fixed steps for a total of `sec` seconds. */
function advanceSec(state, sec) {
  const STEP = 0.05;
  const n = Math.ceil(sec / STEP);
  for (let i = 0; i < n; i++) {
    stepSlice(state, idleInput(), STEP);
  }
}

function _baseZombie(overrides = {}) {
  return {
    y: 0,
    hitFlashSec: 0,
    biteCooldownSec: 0,
    dead: false,
    jumpIntervalSec: 0,
    jumpSpeed: 0,
    jumpCooldownSec: 0,
    telegraphSec: 0,
    telegraphType: "none",
    pounceSec: 0,
    pounceTargetX: 0,
    pounceTargetZ: 0,
    hoverHeight: 0,
    slamCooldownSec: 9999,
    slamHitFired: false,
    coinReward: 10,
    aggroPlayerSec: 0,
    ...overrides,
  };
}

function makeLeaper(overrides = {}) {
  return _baseZombie({
    id: "leaper-99",
    type: "leaper",
    label: "Leaper",
    x: 0, z: -5,
    hp: 122, maxHp: 122,
    speedMps: 1.95, attackDps: 14,
    movementMode: "leaper", attackRange: 1.85,
    jumpIntervalSec: 1.8, jumpSpeed: 4.8,
    jumpCooldownSec: 9999, // won't pounce unless overridden
    ...overrides,
  });
}

function makeWalker(overrides = {}) {
  return _baseZombie({
    id: "walker-99",
    type: "walker",
    label: "Walker",
    x: 0, z: -5,
    hp: 98, maxHp: 98,
    speedMps: 1.55, attackDps: 9,
    movementMode: "ground", attackRange: 1.6,
    ...overrides,
  });
}

function makeFlyer(overrides = {}) {
  return _baseZombie({
    id: "flyer-3",
    type: "flyer",
    label: "Banshee Flyer",
    x: 0, z: -10,
    hp: 118, maxHp: 118,
    speedMps: 2.35, attackDps: 14,
    movementMode: "flyer", attackRange: 1.9,
    hoverHeight: 1.45,
    ...overrides,
  });
}

function makeBoss(overrides = {}) {
  return _baseZombie({
    id: "mini_boss-1",
    type: "mini_boss",
    label: "Mini Boss",
    x: 0, z: -6,
    hp: 860, maxHp: 860,
    speedMps: 1.05, attackDps: 34,
    coinReward: 300,
    movementMode: "ground", attackRange: 2.2,
    slamCooldownSec: 9999, // won't slam unless overridden
    ...overrides,
  });
}
