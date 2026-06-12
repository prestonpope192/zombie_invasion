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
} from "../src/playcanvas/sliceSimulation";
import weaponsConfig from "../src/fps/config/weapons_fps.json";
import buildingsConfig from "../src/fps/config/buildings_fps.json";

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

  it("fires along the player forward vector and records a hit", () => {
    const state = startSlice(createSliceState());
    state.waveGraceSec = 0;
    state.player.x = -10;
    state.player.z = -26;
    state.player.yaw = 0;
    state.zombies = [{ ...nearbyZombie(), x: -10, z: -31 }];

    const result = fireSliceWeapon(state);

    expect(result.hit).toBe(true);
    expect(state.ammo).toBe(14); // 15-shot magazine decremented by 1
    expect(state.zombies[0].hp).toBeLessThan(state.zombies[0].maxHp);
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

  it("supports magazine-based reload for PlayCanvas campaign weapons", () => {
    const state = startSlice(createSliceState());
    state.ammo = 2;

    reloadSliceWeapon(state);
    expect(state.pendingReload).toBe(true);
    expect(state.reloadTimerSec).toBeGreaterThan(0);

    // Step through the reload (pistol reloadSec = 1.3, step 30 * 0.05 = 1.5s)
    for (let i = 0; i < 30; i += 1) {
      stepSlice(state, idleInput(), 0.05);
    }

    expect(state.pendingReload).toBe(false);
    expect(state.ammo).toBe(15); // full magazine after reload
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
    const shotgun = getPlayCanvasWeaponSnapshot(createSliceState({ ownedWeapons: ["shotgun"], equippedWeaponId: "shotgun" }));
    const launcher = getPlayCanvasWeaponSnapshot(createSliceState({ ownedWeapons: ["rpg"], equippedWeaponId: "rpg" }));
    const flame = getPlayCanvasWeaponSnapshot(createSliceState({ ownedWeapons: ["flamethrower"], equippedWeaponId: "flamethrower" }));
    const melee = getPlayCanvasWeaponSnapshot(createSliceState({ ownedWeapons: ["pipe"], equippedWeaponId: "pipe" }));

    expect(sidearm).toMatchObject({ id: "pistol", family: "sidearm", viewModel: "sidearm", reticle: "sidearm" });
    expect(shotgun).toMatchObject({ id: "shotgun", family: "scatter", viewModel: "shotgun", reticle: "spread", shotFx: "pellet-burst" });
    expect(launcher).toMatchObject({ id: "rpg", family: "explosive", viewModel: "launcher", reticle: "blast", shotFx: "blast-orb" });
    expect(flame).toMatchObject({ id: "flamethrower", family: "flame", viewModel: "flamethrower", reticle: "flame", shotFx: "flame-plume" });
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
    expect(state.lastCombatEvent).toMatchObject({ weaponId: "rpg", blast: true, hitCount: 2 });
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
    expect(state.lastCombatEvent).toMatchObject({ reason: "impact", impact: true, materialId: "glass" });
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
