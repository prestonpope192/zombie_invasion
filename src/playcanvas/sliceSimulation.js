import enemiesConfig from "../fps/config/enemies_fps.json";
import bossConfig from "../fps/config/boss_fps.json";
import buildingsConfig from "../fps/config/buildings_fps.json";
import economyConfig from "../fps/config/economy_fps.json";
import { computeVillageStructureDamage } from "../fps/systems/villageDamageRules";
import { canInteractWithDoor } from "../fps/systems/doorRules";
import {
  getEnemyIntroMessage,
  getFirstSessionShopRecommendation,
  getNextWaveThreatBrief,
  getRunMotivation,
} from "../fps/systems/firstSessionRules";
import {
  computeRaidThreatScore,
  selectMusicCue,
} from "../fps/systems/musicDirector";
import {
  DEFAULT_GRENADE_TYPE_ID,
  GRENADE_TYPE_DEFS,
  normalizeGrenadeInventory,
} from "../fps/systems/grenadeLoadout";
import {
  REWARDED_OFFER_IDS,
  getSummaryOfferClaimKey,
} from "../fps/systems/rewardedAdOffers";
import {
  VILLAGER_PERK_DEFS,
  computeDiscountedCost,
  computeEscortDamage,
  computeEscortFollowTarget,
  getVillagerPerkModifiers,
  isVillagerAvailable,
} from "../fps/systems/villagerEscortRules";
import wavesConfig from "../fps/config/waves_fps.json";
import weaponsConfig from "../fps/config/weapons_fps.json";

export const PLAYCANVAS_SAVE_KEY = "zombie_invasion_playcanvas_save_v1";
const PLAYCANVAS_SAVE_VERSION = 2;
const PLAYCANVAS_PROFILE_TYPE = "playcanvas_village_v2";

export const SLICE_WORLD = {
  playerRadius: 0.55,
  zombieRadius: 0.5,
  arenaHalf: 38,
  villageZ: -12,
  villageRadius: 4.4,
  fireRange: 40,
  fireConeCos: 0.976,
  zombieBiteRange: 1.15,
  villageBiteRange: 2.2,
  // Solid obstacles the zombie sim collides against. These mirror the fence
  // runs the PlayCanvas renderer draws at x=±7.2 (main.js scenery). Ground
  // zombies, leapers, climbers, and bosses are stopped so no enemy appears to
  // walk out of a wall; flyers are the only type allowed to pass over.
  obstacles: [
    { id: "fence-left", kind: "fence", minX: -7.36, maxX: -7.04, minZ: -46, maxZ: 22, height: 1.35 },
    { id: "fence-right", kind: "fence", minX: 7.04, maxX: 7.36, minZ: -46, maxZ: 22, height: 1.35 },
  ],
};

const PLAYABLE_WEAPON_IDS = weaponsConfig.map((weapon) => weapon.id);
const STARTING_WEAPON_ID = "pistol";
const STARTER_WEAPON_IDS = ["pipe", STARTING_WEAPON_ID];
const STARTING_ARMOR_ID = "cloth";
const FINAL_WAVE = 12;
const BOSS_WAVE_TYPE_ID = "mini_boss";
const DOOR_INTERACT_RANGE = 2.45;
const VILLAGER_INTERACT_RANGE = 2.25;
const ESCORT_FOLLOW_OFFSET = { x: 0, z: 2.8 };
const ESCORT_HP_BASE = 130;
const ESCORT_ZOMBIE_THREAT_RANGE = 2.2;
const ESCORT_DAMAGE_PER_SEC = 13;
const ESCORT_MAX_ATTACKERS = 3;
const TOWN_HALL_DROPOFF_RADIUS = 3.1;
const VILLAGER_RESCUE_COIN_REWARD = 40;
const BOSS_LANDSCAPE_ZOMBIE_COUNT = 3;
const FINAL_BOSS_LANDSCAPE_FALLBACK_COUNT = 4;
const FRIENDLY_FIRE_VILLAGE_DAMAGE = false;
const IMPACT_EVENT_TTL_SEC = 0.72;
const MAX_ACTIVE_IMPACT_EVENTS = 14;

const ENEMY_DEFS = new Map(enemiesConfig.map((enemy) => [enemy.id, enemy]));
const BOSS_DEF = {
  ...bossConfig,
  id: bossConfig.id ?? "secret_boss",
  label: bossConfig.label ?? "Catacomb Titan",
};
const BOSS_WAVE_DEF = ENEMY_DEFS.get(BOSS_WAVE_TYPE_ID) ?? BOSS_DEF;
const WEAPON_DEFS = new Map(weaponsConfig.map((weapon) => [weapon.id, weapon]));
const PLAYABLE_WEAPONS = PLAYABLE_WEAPON_IDS.map((id) => WEAPON_DEFS.get(id)).filter(Boolean);
const BUILDING_DEFS = buildingsConfig;
const BUILDING_DEF_BY_ID = new Map(BUILDING_DEFS.map((building) => [building.id, building]));
const ARMOR_DEFS = economyConfig.armorUpgrades ?? [];
const ARMOR_DEF_BY_ID = new Map(ARMOR_DEFS.map((armor) => [armor.id, armor]));
const GEAR_DEFS = economyConfig.gearItems ?? [];
const GEAR_DEF_BY_ID = new Map(GEAR_DEFS.map((gear) => [gear.id, gear]));
const GRENADE_DEF_BY_ID = new Map(GRENADE_TYPE_DEFS.map((grenade) => [grenade.id, grenade]));
const MED_KIT_COST = economyConfig.medKit?.cost ?? 20;
const VILLAGE_UPGRADE = economyConfig.villageUpgrade ?? {};
const C4_DEF = { id: "c4", label: "C4 Charge", shortLabel: "C4", damage: 420, radius: 8.4, cooldownSec: 0.7 };
const NUKE_DEF = { id: "nuke", label: "Nuke Device", shortLabel: "Nuke", damage: 1400, radius: 80, cooldownSec: 1.1 };

// ── Lobbed ordnance (grenades) ─────────────────────────────────────────────
// Grenades arc through the air and detonate where they land, instead of an
// immediate blast. The renderer reads ordnanceProjectiles each frame to draw
// the throw, and drains ordnanceDetonations to spawn blast FX on impact.
const ORDNANCE_GRAVITY = 12;          // m/s² applied to the lob arc
const ORDNANCE_LAUNCH_HEIGHT = 1.5;   // throw origin height (≈ shoulder)
const ORDNANCE_LOB_BIAS_DEG = 24;     // base upward angle added to the aim pitch
const ORDNANCE_MIN_ELEV_DEG = 6;      // clamp so a steep down-aim still arcs a little
const ORDNANCE_MAX_ELEV_DEG = 60;     // clamp so a steep up-aim doesn't go vertical
const ORDNANCE_MAX_AIRTIME = 4;       // safety fuse so a stray throw still detonates
const FLINT_COOLDOWN_SEC = 5;
const FIRE_PATCH_TTL_SEC = 5.2;
const FIRE_PATCH_RADIUS = 3.1;
const FIRE_PATCH_DPS = 32;
const FIRE_PATCH_MAX_COUNT = 3;
const FIRE_PATCH_MERGE_DIST = 2.4;

const BITE_INTERVAL_SEC = 0.42;
const BITE_MAX_DAMAGE = 9;

// ── Enemy behaviour variety ────────────────────────────────────────────────
// Leaper/pouncer pounce constants
const POUNCE_TELEGRAPH_SEC  = 0.40;  // wind-up freeze before launch
const POUNCE_DURATION_SEC   = 0.45;  // airborne arc duration
const POUNCE_MIN_DIST       = 2.5;   // don't pounce at melee range
const POUNCE_MAX_DIST       = 8.0;   // don't pounce across the whole map
const POUNCE_PEAK_Y         = 1.1;   // parabola peak (metres)

// Boss charge-slam constants
const SLAM_TELEGRAPH_SEC    = 0.70;  // boss wind-up
const SLAM_DURATION_SEC     = 0.60;  // charge duration
const SLAM_SPEED_MULT       = 1.8;   // charge speed multiplier vs. walk
const SLAM_COOLDOWN_SEC     = 3.5;
const SLAM_LAND_RADIUS      = 2.0;   // distance at which slam hit triggers
const BOSS_TYPE_IDS = new Set(["mini_boss", "mega_zombie", "secret_boss"]);

// Deterministic phase offset so each zombie pounces at slightly different times
// Uses zombie sequence number embedded in id string (e.g. "leaper-7" → 7).
function _idSeq(zombieId) {
  const m = zombieId?.match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}
// Village is far more durable than a one-on-one melee: a lone walker chews
// ~2.5 dmg/s (was ~6.5), so the player has time to thin a wave before the
// bell tower falls. Capped so a brute can't melt the village in one bite.
const VILLAGE_BITE_MULTIPLIER = 0.34;
const VILLAGE_BITE_MAX_DAMAGE = 3.4;
// How close the player must be for a zombie to break off the village and
// chase them, and how long a zombie stays aggro'd after the player shoots it.
const PLAYER_AGGRO_RADIUS = 13;
const PLAYER_AGGRO_ON_HIT_SEC = 4;

const JUMP_SPEED_MPS = 6.2;
const DOUBLE_JUMP_SPEED_MPS = 8.4;
const GRAVITY_MPS2 = 14.6;
const MAX_FALL_SPEED_MPS = 14;
const DOUBLE_JUMP_FLOAT_WINDOW_SEC = 0.36;
const DOUBLE_JUMP_ASCENT_GRAVITY_SCALE = 0.48;
const JUMP_STAMINA_COST = 12;
const DOUBLE_JUMP_STAMINA_COST = 16;
const STAMINA_SPRINT_DRAIN_PER_SEC = 12;
const STAMINA_RECOVERY_PER_SEC = 8;
const SPRINT_SPEED_MPS = 6.0;
const WALK_SPEED_MPS = 4.2;
const CROUCH_SPEED_MPS = 2.2;

const HEADSHOT_MULTIPLIER = 2.2;
const ADS_SPREAD_MULT = 0.4;
const CROUCH_SPREAD_MULT = 0.65;
const SPRINT_SPREAD_MULT = 2.0;

// ── Aim model (precise weapons) ───────────────────────────────────────────
// Per-type half-width of a zombie's body in the XZ plane. Precise weapons
// (pistols, rifles, snipers, SMGs) only land when the aim line passes within
// this radius (plus a small per-weapon forgiveness) of the target's center —
// a true ray-vs-cylinder test instead of a wide angular cone.
const ZOMBIE_BODY_RADIUS = {
  crawler: 0.42,
  walker: 0.5,
  runner: 0.46,
  leaper: 0.5,
  skitter: 0.4,
  pouncer: 0.52,
  revenant: 0.56,
  armored: 0.66,
  brute: 0.85,
  juggernaut: 1.0,
  flyer: 0.5,
  zombie_chicken: 0.36,
  zombie_pig: 0.62,
  zombie_horse: 0.82,
  zombie_cow: 0.86,
  mega_zombie: 1.2,
  mini_boss: 1.6,
};
const DEFAULT_ZOMBIE_BODY_RADIUS = 0.52;

function getZombieBodyRadius(zombie) {
  return ZOMBIE_BODY_RADIUS[zombie?.type] ?? DEFAULT_ZOMBIE_BODY_RADIUS;
}

function getZombieBodyHeight(zombie) {
  return Math.max(1.15, getZombieBodyRadius(zombie) * 2.7);
}

const WAVE_GRACE_SEC = 5.5;
const BREAKABLE_WINDOW_DEFS = createBreakableWindowDefs();
const STRUCTURE_IMPACT_DEFS = createStructureImpactDefs();
const LANDSCAPE_DEFS = createTransformableLandscapeDefs();

// ── Persistent Goals (Deliverable B) ─────────────────────────────────────
export const GOAL_DEFS = [
  {
    id: "reach_wave_5",
    label: "Wave Survivor",
    description: "Reach Wave 5",
    evaluate: (stats, bestWave) => bestWave >= 5,
    progress: (stats, bestWave) => ({ current: Math.min(bestWave, 5), max: 5, unit: "wave" }),
    coinBonus: 50,
  },
  {
    id: "reach_wave_10",
    label: "Veteran Defender",
    description: "Reach Wave 10",
    evaluate: (stats, bestWave) => bestWave >= 10,
    progress: (stats, bestWave) => ({ current: Math.min(bestWave, 10), max: 10, unit: "wave" }),
    coinBonus: 100,
  },
  {
    id: "kills_500",
    label: "Exterminator",
    description: "500 lifetime kills",
    evaluate: (stats) => (stats.kills ?? 0) >= 500,
    progress: (stats) => ({ current: Math.min(stats.kills ?? 0, 500), max: 500, unit: "kills" }),
    coinBonus: 75,
  },
  {
    id: "waves_cleared_10",
    label: "Iron Endurance",
    description: "Clear 10 waves total (across runs)",
    evaluate: (stats) => (stats.wavesCleared ?? 0) >= 10,
    progress: (stats) => ({ current: Math.min(stats.wavesCleared ?? 0, 10), max: 10, unit: "waves" }),
    coinBonus: 60,
  },
  {
    id: "survive_20min",
    label: "Night Shift",
    description: "Survive 20 minutes total",
    evaluate: (stats) => (stats.playSeconds ?? 0) >= 1200,
    progress: (stats) => ({ current: Math.min(Math.floor((stats.playSeconds ?? 0) / 60), 20), max: 20, unit: "min" }),
    coinBonus: 80,
  },
  {
    id: "rescue_6_villagers",
    label: "Guardian of the Village",
    description: "Rescue 6 villagers (across runs)",
    evaluate: (stats, bestWave, rescuedVillagersCount) => rescuedVillagersCount >= 6,
    progress: (stats, bestWave, rescuedVillagersCount) => ({ current: Math.min(rescuedVillagersCount, 6), max: 6, unit: "villagers" }),
    coinBonus: 120,
  },
];

/**
 * Evaluate all goals against current state. Returns array of newly completed goal ids.
 * Mutates state.claimedGoalIds and state.coins for bonus.
 */
export function evaluateGoals(state) {
  if (!Array.isArray(state.claimedGoalIds)) {
    state.claimedGoalIds = [];
  }
  const newlyCompleted = [];
  const rescuedCount = Array.isArray(state.rescuedVillagers) ? state.rescuedVillagers.length : 0;
  for (const goal of GOAL_DEFS) {
    if (state.claimedGoalIds.includes(goal.id)) {
      continue;
    }
    if (goal.evaluate(state.lifetimeStats ?? {}, state.bestWave ?? 1, rescuedCount)) {
      state.claimedGoalIds.push(goal.id);
      if (goal.coinBonus > 0) {
        state.coins = Math.max(0, (state.coins ?? 0) + goal.coinBonus);
      }
      newlyCompleted.push(goal.id);
    }
  }
  return newlyCompleted;
}

/**
 * Returns a display snapshot of all goals (for UI rendering).
 * No mutation.
 */
export function getGoalsSnapshot(state) {
  const claimedIds = Array.isArray(state.claimedGoalIds) ? state.claimedGoalIds : [];
  const rescuedCount = Array.isArray(state.rescuedVillagers) ? state.rescuedVillagers.length : 0;
  return GOAL_DEFS.map((goal) => {
    const completed = claimedIds.includes(goal.id);
    const prog = goal.progress(state.lifetimeStats ?? {}, state.bestWave ?? 1, rescuedCount);
    return {
      id: goal.id,
      label: goal.label,
      description: goal.description,
      completed,
      coinBonus: goal.coinBonus,
      progress: prog,
    };
  });
}

// ── Rewarded-offer pure helpers (PlayCanvas-native, Deliverable A) ─────────

// Per-state claim helpers (work directly with state.claimedOfferKeys)
function _isOfferClaimed(state, claimKey) {
  return Array.isArray(state.claimedOfferKeys) && state.claimedOfferKeys.includes(claimKey);
}

function _markOfferClaimed(state, claimKey) {
  if (!Array.isArray(state.claimedOfferKeys)) {
    state.claimedOfferKeys = [];
  }
  if (!state.claimedOfferKeys.includes(claimKey)) {
    state.claimedOfferKeys.push(claimKey);
  }
}

/** Build the list of offers to show on the wave-clear summary overlay. */
export function getPlayCanvasSummaryOffers(state) {
  const wave = Math.max(1, Number.parseInt(state.waveSummary?.wave, 10) || 1);
  const waveCoins = Math.max(0, Number.parseInt(state.waveSummary?.coins, 10) || 0);
  const hp = Math.max(0, Math.min(100, Number(state.playerHp ?? 100)));
  const offers = [];

  if (waveCoins > 0) {
    const claimKey = getSummaryOfferClaimKey({ offerId: REWARDED_OFFER_IDS.DOUBLE_WAVE_COINS, wave });
    if (!_isOfferClaimed(state, claimKey)) {
      offers.push({
        id: REWARDED_OFFER_IDS.DOUBLE_WAVE_COINS,
        claimKey,
        label: `+${waveCoins} Bonus Coins`,
        description: `Watch an ad to add ${waveCoins} bonus coins from this wave.`,
        claimed: false,
      });
    }
  }

  if (hp < 100) {
    const claimKey = getSummaryOfferClaimKey({ offerId: REWARDED_OFFER_IDS.FREE_MEDKIT, wave });
    if (!_isOfferClaimed(state, claimKey)) {
      offers.push({
        id: REWARDED_OFFER_IDS.FREE_MEDKIT,
        claimKey,
        label: "Free Med Kit",
        description: `Watch an ad to heal from ${Math.round(hp)}/100 HP to full.`,
        claimed: false,
      });
    }
  }

  const grenadeClaimKey = getSummaryOfferClaimKey({ offerId: REWARDED_OFFER_IDS.BONUS_GRENADES, wave });
  if (!_isOfferClaimed(state, grenadeClaimKey)) {
    offers.push({
      id: REWARDED_OFFER_IDS.BONUS_GRENADES,
      claimKey: grenadeClaimKey,
      label: "+3 Frag Grenades",
      description: "Watch an ad to add 3 bonus grenades for the next wave.",
      claimed: false,
    });
  }

  return offers;
}

/** Build the list of offers to show on the game-over panel. */
export function getPlayCanvasGameOverOffers(state) {
  const offers = [];
  if (!state.reviveUsed) {
    offers.push({
      id: REWARDED_OFFER_IDS.REVIVE,
      claimKey: "run:revive",
      label: "Revive Once",
      description: "Watch an ad to revive with 60 HP.",
      claimed: Boolean(state.reviveUsed),
    });
  }
  const wave = Math.max(1, Number.parseInt(state.waveSummary?.wave, 10) || (state.waveNumber ?? 1));
  const waveCoins = Math.max(0, Number.parseInt(state.waveSummary?.coins, 10) || 0);
  if (waveCoins > 0) {
    const claimKey = getSummaryOfferClaimKey({ offerId: REWARDED_OFFER_IDS.DOUBLE_WAVE_COINS, wave });
    if (!_isOfferClaimed(state, claimKey)) {
      offers.push({
        id: REWARDED_OFFER_IDS.DOUBLE_WAVE_COINS,
        claimKey,
        label: `+${waveCoins} Wave Coins`,
        description: `Watch an ad to salvage ${waveCoins} bonus coins from the last wave.`,
        claimed: false,
      });
    }
  }
  const grenadeClaimKey = getSummaryOfferClaimKey({ offerId: REWARDED_OFFER_IDS.BONUS_GRENADES, wave });
  if (!_isOfferClaimed(state, grenadeClaimKey)) {
    offers.push({
      id: REWARDED_OFFER_IDS.BONUS_GRENADES,
      claimKey: grenadeClaimKey,
      label: "+3 Frag Grenades",
      description: "Watch an ad to start next run with bonus grenades.",
      claimed: false,
    });
  }
  return offers;
}

/**
 * Apply a rewarded offer effect to PlayCanvas state (native — does NOT touch legacy game shape).
 * Returns { applied, message, reward? }.
 */
export function applyPlayCanvasRewardedOffer(state, offerId, claimKey) {
  if (!state || !offerId) return { applied: false, message: "Invalid offer." };

  if (offerId === REWARDED_OFFER_IDS.REVIVE) {
    if (state.reviveUsed) return { applied: false, message: "Revive already used." };
    if (state.phase !== "lost") return { applied: false, message: "Not in lost state." };
    state.reviveUsed = true;
    state.playerHp = Math.min(state.maxPlayerHp ?? 100, 60);
    state.invulnerableSec = 3;
    state.phase = "running";
    state.lastMessage = "Revived! Get back in there!";
    return { applied: true, message: "Revived with 60 HP.", reward: { hp: 60 } };
  }

  if (offerId === REWARDED_OFFER_IDS.DOUBLE_WAVE_COINS) {
    if (_isOfferClaimed(state, claimKey)) return { applied: false, message: "Already claimed." };
    const waveCoins = Math.max(0, Number.parseInt(state.waveSummary?.coins, 10) || 0);
    if (waveCoins <= 0) return { applied: false, message: "No wave coins to double." };
    state.coins = Math.max(0, (state.coins ?? 0) + waveCoins);
    _markOfferClaimed(state, claimKey);
    persistPlayCanvasSave(state);
    return { applied: true, message: `+${waveCoins} bonus coins added.`, reward: { coins: waveCoins } };
  }

  if (offerId === REWARDED_OFFER_IDS.FREE_MEDKIT) {
    if (_isOfferClaimed(state, claimKey)) return { applied: false, message: "Already claimed." };
    state.playerHp = state.maxPlayerHp ?? 100;
    _markOfferClaimed(state, claimKey);
    return { applied: true, message: "Healed to full HP.", reward: { hp: state.playerHp } };
  }

  if (offerId === REWARDED_OFFER_IDS.BONUS_GRENADES) {
    if (_isOfferClaimed(state, claimKey)) return { applied: false, message: "Already claimed." };
    state.grenadeInventory = state.grenadeInventory ?? {};
    state.grenadeInventory[DEFAULT_GRENADE_TYPE_ID] = Math.max(0, (state.grenadeInventory[DEFAULT_GRENADE_TYPE_ID] ?? 0) + 3);
    _markOfferClaimed(state, claimKey);
    persistPlayCanvasSave(state);
    return { applied: true, message: "+3 frag grenades added.", reward: { grenades: 3 } };
  }

  return { applied: false, message: "Unknown offer." };
}

export function createSliceState(save = loadPlayCanvasSave()) {
  const rawSave = save;
  const safeSave = sanitizePlayCanvasSave(save);
  const ownedWeapons = normalizeOwnedWeapons(safeSave?.ownedWeapons);
  const equippedWeaponId = ownedWeapons.includes(safeSave?.equippedWeaponId) ? safeSave.equippedWeaponId : STARTING_WEAPON_ID;
  const weapon = getWeaponDef(equippedWeaponId);
  const ownedArmors = normalizeOwnedArmors(safeSave?.ownedArmors);
  const equippedArmorId = ownedArmors.includes(safeSave?.equippedArmorId) ? safeSave.equippedArmorId : STARTING_ARMOR_ID;
  const ownedGear = normalizeOwnedGear(safeSave?.ownedGear);
  const openedBuildings = normalizeBuildingIds(safeSave?.openedBuildings);
  const rescuedVillagers = normalizeVillagerIds(safeSave?.rescuedVillagers);
  const deadVillagers = normalizeVillagerIds(safeSave?.deadVillagers).filter((id) => !rescuedVillagers.includes(id));
  const villagerPerkModifiers = getVillagerPerkModifiers({ rescuedVillagers });
  const villageLevel = normalizeVillageLevel(safeSave?.villageLevel);
  const maxVillageHp = getVillageMaxHp(villageLevel, villagerPerkModifiers);
  const startingFragCount = 5 + Math.max(0, villagerPerkModifiers.startingGrenadesBonus ?? 0);
  const hasSavedGrenades = Boolean(rawSave?.grenadeInventory && typeof rawSave.grenadeInventory === "object") || rawSave?.grenades !== undefined;
  const grenadeInventory = normalizeGrenadeInventory(
    hasSavedGrenades ? safeSave?.grenadeInventory : null,
    hasSavedGrenades ? (safeSave?.grenades ?? startingFragCount) : startingFragCount,
  );
  const c4Count = Math.max(0, Math.round(Number(safeSave?.c4Count ?? safeSave?.c4Charges ?? 0)));
  const nukeCount = Math.max(0, Math.round(Number(safeSave?.nukeCount ?? safeSave?.nukes ?? 0)));
  const activeOrdnanceId = normalizeActiveOrdnance(safeSave?.activeOrdnanceId ?? safeSave?.activeGrenadeId, grenadeInventory, c4Count, nukeCount);
  const lifetimeStats = normalizeLifetimeStats(safeSave?.lifetimeStats);
  const claimedGoalIds = normalizeClaimedGoalIds(safeSave?.claimedGoalIds);
  const claimedOfferKeys = normalizeClaimedOfferKeys(safeSave?.claimedOfferKeys);

  return {
    version: PLAYCANVAS_SAVE_VERSION,
    profileType: PLAYCANVAS_PROFILE_TYPE,
    phase: "ready",
    elapsedSec: 0,
    villageHp: maxVillageHp,
    maxVillageHp,
    playerHp: 100,
    maxPlayerHp: 100,
    coins: Math.max(0, Number(safeSave?.coins ?? 0)),
    bestWave: Math.max(1, Number(safeSave?.bestWave ?? 1)),
    ownedWeapons,
    equippedWeaponId,
    ownedArmors,
    equippedArmorId,
    ownedGear,
    openedBuildings,
    rescuedVillagers,
    deadVillagers,
    activeBuildingId: null,
    activeEscortVillagerId: null,
    villagerPerkModifiers,
    villageLevel,
    grenadeInventory,
    c4Count,
    nukeCount,
    activeOrdnanceId,
    ordnanceCooldownSec: 0,
    flintCooldownSec: 0,
    ammo: weapon.magSize,
    kills: 0,
    totalKills: Math.max(lifetimeStats.kills, Number(safeSave?.totalKills ?? 0)),
    lifetimeStats,
    musicEnabled: safeSave?.musicEnabled !== false,
    sfxEnabled: safeSave?.sfxEnabled !== false,
    shotsFired: 0,
    shotCooldownSec: 0,
    lastCombatEvent: null,
    introducedEnemyTypes: ["walker", "crawler"],
    lastEnemyIntro: null,
    brokenWindowIds: [],
    impactEvents: [],
    nextImpactSeq: 1,
    lastImpactEvent: null,
    structureHits: 0,
    potentialVillageDamage: 0,
    appliedVillageDamage: 0,
    reloadTimerSec: 0,
    waveIndex: 0,
    waveNumber: 1,
    waveElapsedSec: 0,
    spawnTimerSec: 0,
    spawnedThisWave: 0,
    megaSpawnedThisWave: 0,
    bossSpawnedThisWave: false,
    bossLandscapeTriggeredThisWave: false,
    secretBossSpawned: false,
    secretBossActive: false,
    landscapeZombified: 0,
    mutatedLandscapeIds: [],
    lastMutationEvent: null,
    nextZombieSeq: 1,
    waveSummary: null,
    lastMessage: "Defend the village — survive all 12 waves.",
    stamina: 100,
    maxStamina: 100,
    waveGraceSec: 0,
    reviveUsed: false,
    claimedOfferKeys,
    claimedGoalIds,
    player: {
      x: 0,
      z: 12,
      y: 0,
      yaw: 0,
      pitch: 0,
      yVelocity: 0,
      onGround: true,
      canDoubleJump: false,
      jumpHeldLast: false,
      crouching: false,
      doubleJumpFloatTimer: 0,
    },
    zombies: [],
    villagers: createPlayCanvasVillagers({ rescuedVillagers, deadVillagers }),
    firePatches: [],
    nextFireSeq: 1,
    ordnanceProjectiles: [],
    ordnanceDetonations: [],
    nextOrdnanceSeq: 1,
    randomState: 20260603,
  };
}

export function startSlice(state) {
  if (state.phase === "ready") {
    beginWave(state, 0);
  } else if (state.phase === "intermission") {
    beginWave(state, state.waveIndex + 1);
  }
  return state;
}

export function resetSlice() {
  return createSliceState();
}

export function restartCampaign() {
  const state = createSliceState({
    version: PLAYCANVAS_SAVE_VERSION,
    profileType: PLAYCANVAS_PROFILE_TYPE,
    coins: 0,
    bestWave: 1,
    ownedWeapons: [STARTING_WEAPON_ID],
    equippedWeaponId: STARTING_WEAPON_ID,
    ownedArmors: [STARTING_ARMOR_ID],
    equippedArmorId: STARTING_ARMOR_ID,
    ownedGear: [],
    openedBuildings: [],
    rescuedVillagers: [],
    deadVillagers: [],
    villageLevel: 1,
    grenadeInventory: normalizeGrenadeInventory(null, 5),
    c4Count: 0,
    nukeCount: 0,
    activeOrdnanceId: DEFAULT_GRENADE_TYPE_ID,
    totalKills: 0,
    lifetimeStats: defaultLifetimeStats(),
    musicEnabled: true,
    sfxEnabled: true,
  });
  state.lastMessage = "Campaign reset. Start wave 1 when ready.";
  persistPlayCanvasSave(state);
  return state;
}

export function stepSlice(state, input, dt) {
  if (!isCombatPhase(state.phase)) {
    return state;
  }

  const stepDt = Math.min(dt, 0.05);
  state.elapsedSec += stepDt;
  state.waveElapsedSec += stepDt;
  state.lifetimeStats.playSeconds = Number(((state.lifetimeStats.playSeconds ?? 0) + stepDt).toFixed(3));
  state.shotCooldownSec = Math.max(0, state.shotCooldownSec - stepDt);
  state.ordnanceCooldownSec = Math.max(0, state.ordnanceCooldownSec - stepDt);
  state.flintCooldownSec = Math.max(0, state.flintCooldownSec - stepDt);
  state.invulnerableSec = Math.max(0, (state.invulnerableSec ?? 0) - stepDt);

  // Reload countdown
  if (state.pendingReload && state.reloadTimerSec > 0) {
    state.reloadTimerSec = Math.max(0, state.reloadTimerSec - stepDt);
    if (state.reloadTimerSec <= 0) {
      state.ammo = getWeaponDef(state.equippedWeaponId).magSize;
      state.pendingReload = false;
    }
  }

  // Stamina recovery when not sprinting or crouching interrupts sprint
  const sprintActive = Boolean(input.sprint) && !input.crouch && (state.stamina ?? 100) > 0;
  if (!sprintActive) {
    state.stamina = Math.min(state.maxStamina ?? 100, (state.stamina ?? 100) + STAMINA_RECOVERY_PER_SEC * stepDt);
  }

  // Wave grace countdown
  if (state.waveGraceSec > 0) {
    state.waveGraceSec = Math.max(0, state.waveGraceSec - stepDt);
  }

  stepImpactEvents(state, stepDt);

  movePlayer(state, input, stepDt);
  if (state.phase === "running") {
    spawnWaveZombies(state, stepDt);
  }
  stepZombies(state, stepDt);
  stepVillagerEscort(state, stepDt);
  stepFirePatches(state, stepDt);
  stepOrdnanceProjectiles(state, stepDt);

  if (state.playerHp <= 0) {
    state.phase = "lost";
    state.lastMessage = "You were overrun. Restart the campaign to try again.";
    evaluateGoals(state);
    persistPlayCanvasSave(state);
  } else if (state.villageHp <= 0) {
    state.phase = "lost";
    state.lastMessage = "The bell tower fell. Restart the campaign to try again.";
    evaluateGoals(state);
    persistPlayCanvasSave(state);
  } else if (state.phase === "secret_boss" && isSecretBossCleared(state)) {
    completeSecretBoss(state);
  } else if (state.phase === "running" && isWaveCleared(state)) {
    completeWave(state);
  }

  return state;
}

function beginWave(state, waveIndex) {
  state.phase = "running";
  state.waveIndex = Math.max(0, Math.min(wavesConfig.length - 1, waveIndex));
  state.waveNumber = state.waveIndex + 1;
  state.waveElapsedSec = 0;
  const wave = wavesConfig[state.waveIndex];
  const openingPressure = Math.min(4, Math.max(1, Math.ceil((wave?.budget ?? 1) * 0.6)));
  state.spawnTimerSec = -(Math.max(0, openingPressure - 1) * (wave?.spawnIntervalSec ?? 1));
  state.spawnedThisWave = 0;
  state.megaSpawnedThisWave = 0;
  state.bossSpawnedThisWave = false;
  state.bossLandscapeTriggeredThisWave = false;
  state.waveSummary = null;
  state.zombies = [];
  syncVillagerPerkModifiers(state);
  state.maxVillageHp = getVillageMaxHp(state.villageLevel, state.villagerPerkModifiers);
  state.villageHp = Math.min(state.maxVillageHp, state.villageHp + (state.waveNumber === 1 ? 0 : 14));
  state.playerHp = Math.min(state.maxPlayerHp, state.playerHp + (state.waveNumber === 1 ? 0 : 20));
  state.ammo = getWeaponDef(state.equippedWeaponId).magSize;
  state.pendingReload = false;
  state.reloadTimerSec = 0;
  state.waveGraceSec = WAVE_GRACE_SEC;
  state.lastMessage = `Wave ${state.waveNumber}: brace — zombies incoming in ${Math.ceil(WAVE_GRACE_SEC)}s.`;
}

function completeWave(state) {
  state.bestWave = Math.max(state.bestWave, state.waveNumber);
  state.lifetimeStats.wavesCleared += 1;
  state.waveSummary = {
    wave: state.waveNumber,
    kills: state.kills,
    coins: state.coins,
    weapon: getWeaponDef(state.equippedWeaponId).label,
  };

  evaluateGoals(state);
  if (state.waveNumber >= FINAL_WAVE) {
    beginSecretBossPhase(state);
  } else {
    state.phase = "intermission";
    state.lastMessage = `Wave ${state.waveNumber} cleared. Upgrade before wave ${state.waveNumber + 1}.`;
    persistPlayCanvasSave(state);
  }
}

function beginSecretBossPhase(state) {
  if (state.secretBossSpawned) {
    return;
  }
  state.phase = "secret_boss";
  state.secretBossActive = true;
  state.secretBossSpawned = true;
  state.waveSummary = {
    wave: FINAL_WAVE,
    kills: state.kills,
    coins: state.coins,
    weapon: getWeaponDef(state.equippedWeaponId).label,
  };
  state.waveElapsedSec = 0;
  state.spawnedThisWave = 0;
  state.megaSpawnedThisWave = 0;
  state.bossSpawnedThisWave = true;
  state.bossLandscapeTriggeredThisWave = true;
  state.zombies = [];
  const mutationCount = Math.max(
    0,
    Math.round(Number(BOSS_DEF.landscapeMutationCount ?? FINAL_BOSS_LANDSCAPE_FALLBACK_COUNT)),
  );
  triggerBossLandscapeMutation(state, FINAL_WAVE + 1, mutationCount);
  spawnZombie(state, BOSS_DEF.id, getBossSpawnPoint());
  state.lastMessage = "Secret boss awakened. Defeat it to finish the run.";
  persistPlayCanvasSave(state);
}

function completeSecretBoss(state) {
  state.secretBossActive = false;
  state.phase = "won";
  state.lastMessage = "Secret boss defeated. The village survives the night.";
  state.lifetimeStats.wavesCleared = Math.max(state.lifetimeStats.wavesCleared, FINAL_WAVE);
  evaluateGoals(state);
  persistPlayCanvasSave(state);
}

function spawnWaveZombies(state, dt) {
  if (state.waveGraceSec > 0) {
    return;
  }
  const wave = wavesConfig[state.waveIndex];
  if (!wave || state.spawnedThisWave >= wave.budget) {
    return;
  }

  state.spawnTimerSec -= dt;
  while (state.spawnTimerSec <= 0 && state.spawnedThisWave < wave.budget) {
    const type = pickWaveSpawnType(state, wave);
    spawnZombie(state, type);
    state.spawnedThisWave += 1;
    const pressureScale = Math.max(0.72, 1 - state.waveIndex * 0.025);
    state.spawnTimerSec += Math.max(0.45, wave.spawnIntervalSec * pressureScale);
  }
}

function pickWaveSpawnType(state, wave) {
  const remainingSlots = wave.budget - state.spawnedThisWave;
  const bossReserved = wave.boss && !state.bossSpawnedThisWave ? 1 : 0;
  const megaRemaining = Math.max(0, (wave.megaCount ?? 0) - state.megaSpawnedThisWave);

  if (bossReserved && remainingSlots <= bossReserved) {
    state.bossSpawnedThisWave = true;
    if (!state.bossLandscapeTriggeredThisWave) {
      triggerBossLandscapeMutation(state, wave.wave, BOSS_LANDSCAPE_ZOMBIE_COUNT);
      state.bossLandscapeTriggeredThisWave = true;
    }
    return BOSS_WAVE_TYPE_ID;
  }
  if (megaRemaining > 0 && remainingSlots - bossReserved <= megaRemaining) {
    state.megaSpawnedThisWave += 1;
    return "mega_zombie";
  }

  const type = weightedEnemyPick(wave.composition, () => nextRandom(state));
  if (type === "mega_zombie") {
    state.megaSpawnedThisWave += 1;
  }
  return type;
}

function spawnZombie(state, type, spawn = null) {
  const def = type === BOSS_DEF.id ? BOSS_DEF : type === BOSS_WAVE_TYPE_ID ? BOSS_WAVE_DEF : ENEMY_DEFS.get(type) ?? ENEMY_DEFS.get("walker");
  registerEnemyIntro(state, def);
  const side = nextRandom(state) < 0.5 ? -1 : 1;
  // Spawn inside the fenced lane corridor (fences sit at x=±7.2) so ground
  // zombies funnel down the lane instead of clipping through the side fences.
  const laneOffset = (nextRandom(state) * 5.6 + 0.6) * side;
  const depth = -18 - nextRandom(state) * 12 - state.waveIndex * 0.9;
  const waveScale = 1 + state.waveIndex * 0.085;
  const isBoss = def.id === BOSS_DEF.id || def.id === BOSS_WAVE_TYPE_ID;
  const id = `${def.id}-${state.nextZombieSeq++}`;
  const jumpIntervalSec = def.jumpIntervalSec ?? 0;
  const isBossType = BOSS_TYPE_IDS.has(def.id);
  state.zombies.push({
    id,
    type: def.id,
    label: def.label,
    x: spawn?.x ?? laneOffset,
    z: spawn?.z ?? depth,
    y: 0,
    hp: Math.round(def.hp * (isBoss ? 1 : waveScale)),
    maxHp: Math.round(def.hp * (isBoss ? 1 : waveScale)),
    speedMps: def.speedMps * (1 + state.waveIndex * 0.018),
    attackDps: def.attackDps * (1 + state.waveIndex * 0.025),
    coinReward: def.coinReward ?? 10,
    movementMode: def.movementMode ?? "ground",
    canClimb: Boolean(def.canClimb),
    attackRange: def.attackRange ?? 1.6,
    hitFlashSec: 0,
    biteCooldownSec: 0,
    dead: false,
    // Leaper / pouncer
    jumpIntervalSec,
    jumpSpeed: def.jumpSpeed ?? 0,
    jumpCooldownSec: jumpIntervalSec,   // first pounce delayed by full interval
    telegraphSec: 0,
    telegraphType: "none",
    pounceSec: 0,
    pounceTargetX: 0,
    pounceTargetZ: 0,
    // Flyer / revenant
    hoverHeight: def.hoverHeight ?? 0,
    // Boss slam (reuses telegraph / pounce primitives)
    slamCooldownSec: isBossType ? SLAM_COOLDOWN_SEC * 0.5 : 0, // short initial delay
    slamHitFired: false,
  });
}

function registerEnemyIntro(state, def) {
  if (!def?.id) {
    return;
  }
  if (!Array.isArray(state.introducedEnemyTypes)) {
    state.introducedEnemyTypes = ["walker", "crawler"];
  }
  if (state.introducedEnemyTypes.includes(def.id)) {
    return;
  }
  state.introducedEnemyTypes.push(def.id);
  state.lastEnemyIntro = {
    type: def.id,
    label: def.label,
    message: getEnemyIntroMessage(def.id, def.label),
    wave: state.waveNumber,
  };
}

function triggerBossLandscapeMutation(state, waveNum, overrideCount = null) {
  const mutated = new Set(state.mutatedLandscapeIds ?? []);
  const available = LANDSCAPE_DEFS.filter((entry) => !mutated.has(entry.id));
  if (!available.length) {
    state.lastMutationEvent = null;
    return [];
  }

  const desired = Number.isFinite(overrideCount)
    ? Math.max(0, Math.round(overrideCount))
    : waveNum > FINAL_WAVE
      ? FINAL_BOSS_LANDSCAPE_FALLBACK_COUNT
      : BOSS_LANDSCAPE_ZOMBIE_COUNT;
  const targetCount = Math.min(desired, available.length);
  if (targetCount <= 0) {
    state.lastMutationEvent = null;
    return [];
  }

  const preferred = available
    .filter((entry) => {
      const villageDist = Math.hypot(entry.x, entry.z - SLICE_WORLD.villageZ);
      const playerDist = Math.hypot(entry.x - state.player.x, entry.z - state.player.z);
      return villageDist > 8 && villageDist < 34 && playerDist > 5;
    })
    .sort((a, b) => {
      const aDist = Math.hypot(a.x, a.z - SLICE_WORLD.villageZ);
      const bDist = Math.hypot(b.x, b.z - SLICE_WORLD.villageZ);
      return Math.abs(aDist - 19) - Math.abs(bDist - 19);
    });
  const pool = (preferred.length >= targetCount ? preferred : available).slice();
  const selected = [];
  while (selected.length < targetCount && pool.length > 0) {
    const pickIndex = Math.floor(nextRandom(state) * Math.min(pool.length, 8));
    selected.push(pool.splice(pickIndex, 1)[0]);
  }

  for (let i = 0; i < selected.length; i += 1) {
    const entry = selected[i];
    mutated.add(entry.id);
    const shouldSpawnMega = waveNum > FINAL_WAVE && i === selected.length - 1;
    spawnZombie(state, shouldSpawnMega ? "mega_zombie" : "walker", { x: entry.x, z: entry.z });
  }

  state.mutatedLandscapeIds = Array.from(mutated);
  state.landscapeZombified += selected.length;
  state.lastMutationEvent = {
    wave: waveNum,
    count: selected.length,
    ids: selected.map((entry) => entry.id),
  };
  return selected;
}

function getBossSpawnPoint() {
  const spawn = BOSS_DEF.spawn ?? {};
  return {
    x: Number(spawn.x ?? 0),
    z: Number(spawn.z ?? -15.8),
  };
}

function weightedEnemyPick(composition, random) {
  const entries = Object.entries(composition || { walker: 1 }).filter(([, weight]) => weight > 0);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let target = random() * total;
  for (const [id, weight] of entries) {
    target -= weight;
    if (target <= 0) {
      return id;
    }
  }
  return entries[0]?.[0] ?? "walker";
}

function isWaveCleared(state) {
  const wave = wavesConfig[state.waveIndex];
  if (!wave) return false;
  return state.spawnedThisWave >= wave.budget && state.zombies.every((zombie) => zombie.dead);
}

function isSecretBossCleared(state) {
  return state.secretBossActive && state.secretBossSpawned && state.zombies.every((zombie) => zombie.dead);
}

function isCombatPhase(phase) {
  return phase === "running" || phase === "secret_boss";
}

function movePlayer(state, input, dt) {
  const crouching = Boolean(input.crouch);
  const canSprint = Boolean(input.sprint) && !crouching && (state.stamina ?? 100) > 10;
  const speed = crouching ? CROUCH_SPEED_MPS : canSprint ? SPRINT_SPEED_MPS : WALK_SPEED_MPS;

  state.player.crouching = crouching;

  if (canSprint) {
    state.stamina = Math.max(0, (state.stamina ?? 100) - STAMINA_SPRINT_DRAIN_PER_SEC * dt);
  }

  const forward = input.forward - input.back;
  const strafe = input.right - input.left;
  if (forward !== 0 || strafe !== 0) {
    const length = Math.hypot(forward, strafe) || 1;
    const yaw = state.player.yaw;
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    // Move relative to where the camera looks. Camera forward is
    // (-sin, -cos) and camera right is (cos, -sin) — the SAME basis the
    // aim/shot direction uses (forwardX=-sin, forwardZ=-cos). The previous
    // mapping mismatched this on the X axis, so W/A/S/D inverted once the
    // player turned ~90° away from the spawn heading.
    const f = forward / length;
    const s = strafe / length;
    state.player.x += (f * -sin + s * cos) * speed * dt;
    state.player.z += (f * -cos + s * -sin) * speed * dt;
  }

  const activeBuilding = getActiveBuilding(state);
  if (activeBuilding?.interior?.center && activeBuilding?.interior?.size) {
    const { center, size } = activeBuilding.interior;
    state.player.x = clamp(state.player.x, center.x - size.x * 0.46, center.x + size.x * 0.46);
    state.player.z = clamp(state.player.z, center.z - size.z * 0.46, center.z + size.z * 0.46);
  } else {
    state.player.x = clamp(state.player.x, -SLICE_WORLD.arenaHalf, SLICE_WORLD.arenaHalf);
    state.player.z = clamp(state.player.z, -SLICE_WORLD.arenaHalf, SLICE_WORLD.arenaHalf + 3);
  }

  // Vertical / jump / gravity
  const jumpPressed = Boolean(input.jump) && !state.player.jumpHeldLast;
  state.player.jumpHeldLast = Boolean(input.jump);

  if ((state.player.doubleJumpFloatTimer ?? 0) > 0) {
    state.player.doubleJumpFloatTimer = Math.max(0, state.player.doubleJumpFloatTimer - dt);
  }
  const usingFloat = (state.player.doubleJumpFloatTimer ?? 0) > 0;
  const gravScale = usingFloat ? DOUBLE_JUMP_ASCENT_GRAVITY_SCALE : 1;
  state.player.yVelocity = Math.max(-MAX_FALL_SPEED_MPS, (state.player.yVelocity ?? 0) - GRAVITY_MPS2 * gravScale * dt);

  const onGround = (state.player.y ?? 0) <= 0;
  if (onGround && jumpPressed && (state.stamina ?? 100) >= JUMP_STAMINA_COST) {
    state.player.yVelocity = JUMP_SPEED_MPS;
    state.player.canDoubleJump = true;
    state.player.onGround = false;
    state.stamina = Math.max(0, (state.stamina ?? 100) - JUMP_STAMINA_COST);
  } else if (!onGround && state.player.canDoubleJump && jumpPressed && (state.stamina ?? 100) >= DOUBLE_JUMP_STAMINA_COST) {
    state.player.yVelocity = DOUBLE_JUMP_SPEED_MPS;
    state.player.canDoubleJump = false;
    state.player.doubleJumpFloatTimer = DOUBLE_JUMP_FLOAT_WINDOW_SEC;
    state.stamina = Math.max(0, (state.stamina ?? 100) - DOUBLE_JUMP_STAMINA_COST);
  }

  state.player.y = Math.max(0, (state.player.y ?? 0) + state.player.yVelocity * dt);
  if (state.player.y <= 0) {
    state.player.y = 0;
    state.player.yVelocity = 0;
    state.player.onGround = true;
    state.player.canDoubleJump = false;
    state.player.doubleJumpFloatTimer = 0;
  } else {
    state.player.onGround = false;
  }
}

// ── Obstacle collision ──────────────────────────────────────────────────────
// Eject a circle (cx,cz,r) from an axis-aligned box. Returns the pushed-out
// {x,z}, or null when the circle is clear. Pure geometry.
function pushCircleOutOfAabb(cx, cz, r, box) {
  const nx = clamp(cx, box.minX, box.maxX);
  const nz = clamp(cz, box.minZ, box.maxZ);
  const dx = cx - nx;
  const dz = cz - nz;
  const d2 = dx * dx + dz * dz;
  if (d2 > r * r) return null; // clear of the box
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    const push = (r - d) / d;
    return { x: cx + dx * push, z: cz + dz * push };
  }
  // Center inside the box — eject along the axis of least penetration.
  const toMinX = cx - box.minX;
  const toMaxX = box.maxX - cx;
  const toMinZ = cz - box.minZ;
  const toMaxZ = box.maxZ - cz;
  if (Math.min(toMinX, toMaxX) < Math.min(toMinZ, toMaxZ)) {
    return { x: toMinX < toMaxX ? box.minX - r : box.maxX + r, z: cz };
  }
  return { x: cx, z: toMinZ < toMaxZ ? box.minZ - r : box.maxZ + r };
}

// How a zombie deals with a fence:
//   "fly"   — flyers pass over low outdoor walls/fences.
//   "block" — everyone else is stopped by fences and walls.
function fenceCapability(zombie) {
  const mode = zombie.movementMode ?? "ground";
  if (mode === "flyer") return "fly";
  return "block";
}

// Resolve every live zombie against SLICE_WORLD.obstacles after movement.
// Blocked zombies are pushed back out; this keeps the simulation consistent
// with the rendered walls so enemies do not appear to walk through geometry.
function resolveZombieObstacles(state) {
  const obstacles = SLICE_WORLD.obstacles;
  if (!obstacles?.length) return;
  const r = SLICE_WORLD.zombieRadius;
  for (const zombie of state.zombies) {
    if (zombie.dead) continue;
    const cap = fenceCapability(zombie);
    if (cap === "fly") {
      zombie.crossingFence = false;
      continue;
    }
    for (const obs of obstacles) {
      const res = pushCircleOutOfAabb(zombie.x, zombie.z, r, obs);
      if (res) {
        zombie.x = res.x;
        zombie.z = res.z;
      }
    }
    if (zombie.crossingFence) {
      zombie.crossingFence = false;
      zombie.fenceCrossType = "none";
      // Settle back to the ground unless something else owns the height (a
      // pounce arc sets zombie.y itself every frame).
      if ((zombie.movementMode ?? "ground") !== "flyer" && (zombie.pounceSec ?? 0) <= 0) {
        zombie.y = 0;
      }
    }
  }
}

function stepZombies(state, dt) {
  if (state.waveGraceSec > 0) {
    return;
  }
  for (const zombie of state.zombies) {
    if (zombie.dead) {
      continue;
    }

    zombie.hitFlashSec = Math.max(0, zombie.hitFlashSec - dt);
    zombie.biteCooldownSec = Math.max(0, (zombie.biteCooldownSec ?? 0) - dt);
    zombie.aggroPlayerSec = Math.max(0, (zombie.aggroPlayerSec ?? 0) - dt);

    const toPlayerX = state.player.x - zombie.x;
    const toPlayerZ = state.player.z - zombie.z;
    const playerDist = Math.hypot(toPlayerX, toPlayerZ);
    const toVillageX = -zombie.x;
    const toVillageZ = SLICE_WORLD.villageZ - zombie.z;
    const villageDist = Math.hypot(toVillageX, toVillageZ);
    // Chase the player when they're near, when the zombie is already on the
    // player's side of the village line, or when freshly shot (aggro-on-hit).
    const targetPlayer =
      playerDist < PLAYER_AGGRO_RADIUS ||
      zombie.z > SLICE_WORLD.villageZ + 1 ||
      zombie.aggroPlayerSec > 0;
    const tx = targetPlayer ? toPlayerX : toVillageX;
    const tz = targetPlayer ? toPlayerZ : toVillageZ;
    const dist = Math.hypot(tx, tz) || 1;

    // ── Bite check (same for all movement modes) ──────────────────────────
    if (targetPlayer && playerDist < SLICE_WORLD.zombieBiteRange) {
      if (zombie.biteCooldownSec <= 0) {
        if ((state.invulnerableSec ?? 0) <= 0) {
          const biteDamage = Math.min(BITE_MAX_DAMAGE, zombie.attackDps * getArmorDamageMultiplier(state) * BITE_INTERVAL_SEC);
          const before = state.playerHp;
          state.playerHp = Math.max(0, state.playerHp - biteDamage);
          state.lifetimeStats.damageTaken += Math.max(0, Math.round(before - state.playerHp));
        }
        zombie.biteCooldownSec = BITE_INTERVAL_SEC;
      }
      // Boss slam: if the boss lands in bite range during a charge, fire slam hit here
      if (zombie.pounceSec > 0 && BOSS_TYPE_IDS.has(zombie.type) && !zombie.slamHitFired) {
        if ((state.invulnerableSec ?? 0) <= 0) {
          const slamDmg = Math.min(BITE_MAX_DAMAGE, zombie.attackDps * 0.4);
          const before = state.playerHp;
          state.playerHp = Math.max(0, state.playerHp - slamDmg);
          state.lifetimeStats.damageTaken += Math.max(0, Math.round(before - state.playerHp));
        }
        zombie.slamHitFired = true;
        zombie.slamCooldownSec = SLAM_COOLDOWN_SEC;
      }
      // Reset aerial state when biting
      zombie.y = 0;
      zombie.pounceSec = 0;
      zombie.telegraphSec = 0;
      zombie.telegraphType = "none";
      continue;
    }

    if (!targetPlayer && villageDist < SLICE_WORLD.villageBiteRange) {
      if (zombie.biteCooldownSec <= 0) {
        const biteDamage = Math.min(
          VILLAGE_BITE_MAX_DAMAGE,
          zombie.attackDps * VILLAGE_BITE_MULTIPLIER * BITE_INTERVAL_SEC,
        );
        const before = state.villageHp;
        state.villageHp = Math.max(0, state.villageHp - biteDamage);
        state.lifetimeStats.villageDamageTaken += Math.max(0, Math.round(before - state.villageHp));
        zombie.biteCooldownSec = BITE_INTERVAL_SEC;
      }
      zombie.y = 0;
      continue;
    }

    const mode = zombie.movementMode ?? "ground";

    // ── FLYER / REVENANT: hover + direct approach ─────────────────────────
    if (mode === "flyer") {
      const seq = _idSeq(zombie.id);
      const bobAmp = 0.12;
      zombie.y = (zombie.hoverHeight ?? 1.45) + Math.sin(state.elapsedSec * 2 + seq) * bobAmp;
      // Straight approach at full speed (flyers ignore zigzag)
      zombie.x += (tx / dist) * zombie.speedMps * dt;
      zombie.z += (tz / dist) * zombie.speedMps * dt;
      continue;
    }

    // ── LEAPER / POUNCER: pounce state machine ────────────────────────────
    if (mode === "leaper") {
      // Decrement cooldowns
      zombie.jumpCooldownSec = Math.max(0, (zombie.jumpCooldownSec ?? 0) - dt);

      if (zombie.pounceSec > 0) {
        // ── Active pounce: move at jumpSpeed toward locked target ──
        zombie.pounceSec -= dt;
        const ptx = zombie.pounceTargetX - zombie.x;
        const ptz = zombie.pounceTargetZ - zombie.z;
        const pDist = Math.hypot(ptx, ptz) || 1;
        zombie.x += (ptx / pDist) * zombie.jumpSpeed * dt;
        zombie.z += (ptz / pDist) * zombie.jumpSpeed * dt;
        // Parabolic Y arc: 0 → peak at 50% → 0 at end
        const prog = Math.max(0, Math.min(1, 1 - zombie.pounceSec / POUNCE_DURATION_SEC)); // 0..1
        zombie.y = POUNCE_PEAK_Y * 4 * prog * (1 - prog);       // sin²-shaped parabola
        if (zombie.pounceSec <= 0) {
          zombie.y = 0;
          zombie.telegraphType = "none";
          zombie.jumpCooldownSec = zombie.jumpIntervalSec ?? 1.8;
        }
      } else if (zombie.telegraphSec > 0) {
        // ── Telegraph wind-up: freeze in place ──
        zombie.telegraphSec -= dt;
        zombie.y = 0;
        if (zombie.telegraphSec <= 0) {
          // Launch pounce
          zombie.pounceSec = POUNCE_DURATION_SEC;
          zombie.pounceTargetX = state.player.x;
          zombie.pounceTargetZ = state.player.z;
        }
      } else {
        // ── Idle approach / decide to pounce ──
        const canPounce =
          targetPlayer &&
          playerDist >= POUNCE_MIN_DIST &&
          playerDist <= POUNCE_MAX_DIST &&
          zombie.jumpCooldownSec <= 0;
        if (canPounce) {
          // Start telegraph
          zombie.telegraphSec = POUNCE_TELEGRAPH_SEC;
          zombie.telegraphType = "pounce";
          // Don't move this frame (wind-up freeze)
        } else {
          // Normal creep approach
          const zigzag = Math.sin(state.elapsedSec * 2.2 + _idSeq(zombie.id)) * 0.18;
          zombie.x += (tx / dist) * zombie.speedMps * dt + zigzag * dt;
          zombie.z += (tz / dist) * zombie.speedMps * dt;
          zombie.y = 0;
        }
      }
      continue;
    }

    // ── BOSS SLAM: charge-slam state machine (reuses telegraph / pounce fields) ──
    if (BOSS_TYPE_IDS.has(zombie.type)) {
      zombie.slamCooldownSec = Math.max(0, (zombie.slamCooldownSec ?? 0) - dt);

      if (zombie.pounceSec > 0) {
        // Charge phase
        zombie.pounceSec -= dt;
        const ptx = zombie.pounceTargetX - zombie.x;
        const ptz = zombie.pounceTargetZ - zombie.z;
        const pDist = Math.hypot(ptx, ptz) || 1;
        const chargeSpeed = zombie.speedMps * SLAM_SPEED_MULT;
        zombie.x += (ptx / pDist) * chargeSpeed * dt;
        zombie.z += (ptz / pDist) * chargeSpeed * dt;
        // Slam land: one-shot bonus hit when charge ends and within radius
        if (zombie.pounceSec <= 0) {
          zombie.telegraphType = "none";
          zombie.slamCooldownSec = SLAM_COOLDOWN_SEC;
          // Apply slam hit once if player is close (slamHitFired gates it per charge)
          if (!zombie.slamHitFired) {
            const landDist = Math.hypot(state.player.x - zombie.x, state.player.z - zombie.z);
            if (landDist < SLAM_LAND_RADIUS && (state.invulnerableSec ?? 0) <= 0) {
              const slamDmg = Math.min(BITE_MAX_DAMAGE, zombie.attackDps * 0.4);
              const before = state.playerHp;
              state.playerHp = Math.max(0, state.playerHp - slamDmg);
              state.lifetimeStats.damageTaken += Math.max(0, Math.round(before - state.playerHp));
            }
            // Mark fired whether or not hit landed (distance gated per charge, not per frame)
            zombie.slamHitFired = true;
          }
        }
      } else if (zombie.telegraphSec > 0) {
        // Telegraph wind-up
        zombie.telegraphSec -= dt;
        if (zombie.telegraphSec <= 0) {
          zombie.pounceSec = SLAM_DURATION_SEC;
          zombie.pounceTargetX = state.player.x;
          zombie.pounceTargetZ = state.player.z;
          zombie.slamHitFired = false;
        }
      } else {
        // Decide to slam (only when targeting player and in a usable range)
        const canSlam =
          targetPlayer &&
          playerDist < PLAYER_AGGRO_RADIUS * 0.6 &&
          zombie.slamCooldownSec <= 0;
        if (canSlam) {
          zombie.telegraphSec = SLAM_TELEGRAPH_SEC;
          zombie.telegraphType = "slam";
        } else {
          // Normal boss walk
          zombie.x += (tx / dist) * zombie.speedMps * dt;
          zombie.z += (tz / dist) * zombie.speedMps * dt;
        }
      }
      continue;
    }

    // ── GROUND (walker, runner, skitter, brute, etc.) ─────────────────────
    const zigzag = zombie.type === "runner" || zombie.type === "skitter" ? Math.sin(state.elapsedSec * 3 + zombie.id.length) * 0.45 : 0;
    zombie.x += (tx / dist) * zombie.speedMps * dt + zigzag * dt;
    zombie.z += (tz / dist) * zombie.speedMps * dt;
    zombie.y = 0;
  }

  // Stop non-flying zombies at fences/walls; flyers are allowed to pass over.
  resolveZombieObstacles(state);
}

function stepVillagerEscort(state, dt) {
  const villager = getActiveEscortVillager(state);
  if (!villager) {
    return;
  }
  const target = computeEscortFollowTarget(
    { x: state.player.x, y: 1.2, z: state.player.z },
    state.player.yaw,
    ESCORT_FOLLOW_OFFSET,
  );
  const dx = target.x - villager.x;
  const dz = target.z - villager.z;
  const distance = Math.hypot(dx, dz);
  const step = Math.min(distance, 4.8 * dt);
  if (distance > 0.001) {
    villager.x += (dx / distance) * step;
    villager.z += (dz / distance) * step;
  }

  const attackerCount = state.zombies.filter((zombie) => {
    if (!zombie || zombie.dead || zombie.hp <= 0) {
      return false;
    }
    return Math.hypot(zombie.x - villager.x, zombie.z - villager.z) <= ESCORT_ZOMBIE_THREAT_RANGE;
  }).length;
  const incomingDamage = computeEscortDamage(dt, attackerCount, ESCORT_DAMAGE_PER_SEC, ESCORT_MAX_ATTACKERS);
  if (incomingDamage > 0) {
    villager.hp = Math.max(0, villager.hp - incomingDamage);
    if (villager.hp <= 0) {
      killEscortedVillager(state, villager);
      return;
    }
  }

  const dropoff = getEscortDropoff();
  if (!state.activeBuildingId && Math.hypot(villager.x - dropoff.x, villager.z - dropoff.z) <= dropoff.radius) {
    rescueVillager(state, villager);
  }
}

function stepFirePatches(state, dt) {
  if (!state.firePatches.length) {
    return;
  }
  for (const patch of state.firePatches) {
    patch.ttlSec -= dt;
    for (const zombie of state.zombies) {
      if (zombie.dead) {
        continue;
      }
      const distance = Math.hypot(zombie.x - patch.x, zombie.z - patch.z);
      if (distance > patch.radius) {
        continue;
      }
      const falloff = Math.max(0.28, 1 - distance / Math.max(0.1, patch.radius));
      damageZombie(state, zombie, patch.dps * falloff * dt);
      zombie.hitFlashSec = Math.max(zombie.hitFlashSec ?? 0, 0.1);
    }
  }
  state.firePatches = state.firePatches.filter((patch) => patch.ttlSec > 0);
}

export function fireSliceWeapon(state) {
  const weapon = getWeaponDef(state.equippedWeaponId);
  if (!isCombatPhase(state.phase) || state.shotCooldownSec > 0 || state.pendingReload) {
    return { hit: false, reason: "blocked" };
  }

  if (weapon.category !== "melee" && (state.ammo ?? 0) <= 0) {
    if (!state.pendingReload && (weapon.reloadSec ?? 0) > 0) {
      state.pendingReload = true;
      state.reloadTimerSec = weapon.reloadSec;
      state.lastMessage = `${weapon.label} empty — reloading…`;
    }
    return { hit: false, reason: "empty" };
  }

  state.shotCooldownSec = 60 / Math.max(1, weapon.rpm);
  if (weapon.category !== "melee") {
    state.ammo = Math.max(0, (state.ammo ?? weapon.magSize) - 1);
    if (state.ammo <= 0 && (weapon.reloadSec ?? 0) > 0) {
      state.pendingReload = true;
      state.reloadTimerSec = weapon.reloadSec;
    }
  }
  state.shotsFired += 1;
  state.lastCombatEvent = null;

  // Spread multiplier based on stance
  const isCrouching = Boolean(state.player.crouching);
  const isAds = Boolean(state.player.ads);
  const isSprinting = !state.player.onGround || Boolean(state.player.yVelocity && state.player.yVelocity > 0.5);
  const spreadMult = isAds ? ADS_SPREAD_MULT : isCrouching ? CROUCH_SPREAD_MULT : isSprinting ? SPRINT_SPREAD_MULT : 1;
  const profile = getWeaponAttackProfile(weapon, spreadMult);

  const forwardX = -Math.sin(state.player.yaw);
  const forwardZ = -Math.cos(state.player.yaw);
  // Precise weapons require the aim line to actually pass through the target's
  // body (ray-vs-cylinder). Spread/area weapons (shotgun, flamethrower,
  // launchers, melee) keep the forgiving angular cone so they stay easy to land.
  const usePreciseAim = Boolean(profile.precise) && profile.blastRadius <= 0;
  const candidates = [];

  for (const zombie of state.zombies) {
    if (zombie.dead) {
      continue;
    }
    const dx = zombie.x - state.player.x;
    const dz = zombie.z - state.player.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 1e-4 || distance > profile.range) {
      continue;
    }
    const dot = (dx / distance) * forwardX + (dz / distance) * forwardZ;
    if (dot <= 0) {
      continue; // target is behind the shooter
    }
    // Perpendicular distance from the aim line to the zombie's center.
    const missRadius = Math.sqrt(Math.max(0, 1 - dot * dot)) * distance;
    if (usePreciseAim) {
      // Body radius is always struck; forgiveness is the aim margin, tightened
      // when ADS/crouched and widened while sprinting (via spreadMult).
      const hitRadius =
        getZombieBodyRadius(zombie) + (profile.aimForgiveness ?? 0.2) / Math.max(0.25, spreadMult);
      if (missRadius > hitRadius) {
        continue;
      }
    } else if (dot < profile.coneCos) {
      continue;
    }
    candidates.push({ zombie, distance, dot, missRadius });
  }

  if (usePreciseAim) {
    // Nearest body along the line is struck first (realistic occlusion).
    candidates.sort((a, b) => a.distance - b.distance || a.missRadius - b.missRadius);
  } else {
    candidates.sort((a, b) => b.dot - a.dot || a.distance - b.distance);
  }
  const primaryTarget = candidates[0] ?? null;
  if (!primaryTarget) {
    const structureImpact = resolvePlayCanvasStructureShot(state, weapon, profile, { forwardX, forwardZ });
    if (structureImpact) {
      state.lastMessage = structureImpact.windowShattered
        ? `${weapon.label} shattered village glass.`
        : `${weapon.label} struck ${structureImpact.materialId} siding.`;
      state.lastCombatEvent = {
        weaponId: weapon.id,
        hit: false,
        reason: "impact",
        impact: true,
        materialId: structureImpact.materialId,
        windowId: structureImpact.windowId ?? null,
        windowShattered: Boolean(structureImpact.windowShattered),
        potentialVillageDamage: structureImpact.potentialVillageDamage,
        appliedVillageDamage: structureImpact.appliedVillageDamage,
      };
      return { hit: false, reason: "impact", impact: true, ...structureImpact };
    }
    if (weapon.category === "melee") {
      state.lastMessage = "Pipe swing missed. Close the gap before attacking.";
      state.lastCombatEvent = { weaponId: weapon.id, hit: false, reason: "miss" };
      return { hit: false, reason: "miss" };
    }
    // Nothing in the way — the round kicks up terrain down-range so the player
    // can read where the shot actually went.
    const ground = resolvePlayCanvasGroundMiss(state, profile);
    state.lastMessage = "Shot missed — round kicked up dirt.";
    state.lastCombatEvent = {
      weaponId: weapon.id,
      hit: false,
      reason: "miss",
      impact: true,
      materialId: ground.materialId,
    };
    return {
      hit: false,
      reason: "miss",
      impact: true,
      materialId: ground.materialId,
      impactDistance: ground.impactDistance,
    };
  }

  if (profile.blastRadius > 0) {
    const result = applyBlastDamage(state, primaryTarget.zombie, weapon.damage * profile.damageScale, profile.blastRadius);
    state.lastMessage = `${weapon.label} detonated: ${result.hitCount} hit, ${result.killCount} down.`;
    state.lastCombatEvent = { weaponId: weapon.id, hit: true, blast: true, ...result };
    return {
      hit: true,
      zombieId: primaryTarget.zombie.id,
      damage: result.primaryDamage,
      hitCount: result.hitCount,
      killCount: result.killCount,
    };
  }

  const targets = candidates.slice(0, profile.maxTargets);
  let totalDamage = 0;
  let killCount = 0;
  let rewardCoins = 0;
  const pitchDeg = state.player.pitch ?? 0;
  const headshotEligible = pitchDeg < -8 && targets.length === 1 && targets[0].distance < 14;
  for (const target of targets) {
    const distanceFalloff = Math.max(profile.minFalloff, 1 - target.distance / profile.falloffRange);
    let damage = Math.max(1, Math.round(weapon.damage * profile.damageScale * distanceFalloff));
    const headshot = headshotEligible && target === targets[0];
    if (headshot) {
      damage = Math.round(damage * HEADSHOT_MULTIPLIER);
    }
    const result = damageZombie(state, target.zombie, damage);
    if (headshot && !result.killed) {
      result.headshot = true;
    }
    totalDamage += result.damage;
    if (result.killed) {
      killCount += 1;
      rewardCoins += result.rewardCoins ?? 0;
    }
  }

  const wasHeadshot = headshotEligible;
  if (killCount > 0) {
    state.lastMessage = wasHeadshot
      ? `HEADSHOT — ${weapon.label} dropped ${killCount} target${killCount === 1 ? "" : "s"}. +${rewardCoins} coins.`
      : `${weapon.label} dropped ${killCount} target${killCount === 1 ? "" : "s"}. +${rewardCoins} coins.`;
  } else if (targets.length > 1) {
    state.lastMessage = `${weapon.label} hit ${targets.length} targets for ${totalDamage}.`;
  } else {
    state.lastMessage = wasHeadshot
      ? `HEADSHOT — ${weapon.label} hit ${primaryTarget.zombie.label} for ${totalDamage}.`
      : `${weapon.label} hit ${primaryTarget.zombie.label} for ${totalDamage}.`;
  }
  state.lastCombatEvent = {
    weaponId: weapon.id,
    hit: true,
    headshot: wasHeadshot,
    hitCount: targets.length,
    killCount,
    damage: totalDamage,
    primaryZombieId: primaryTarget.zombie.id,
  };

  return { hit: true, zombieId: primaryTarget.zombie.id, damage: totalDamage, hitCount: targets.length, killCount, headshot: wasHeadshot };
}

export function reloadSliceWeapon(state) {
  const weapon = getWeaponDef(state.equippedWeaponId);
  if (weapon.category === "melee") {
    state.lastMessage = "Melee weapons do not reload.";
    return state;
  }
  if (state.pendingReload) {
    state.lastMessage = `Already reloading ${weapon.label}…`;
    return state;
  }
  if ((state.ammo ?? 0) >= weapon.magSize) {
    state.lastMessage = `${weapon.label} magazine is already full.`;
    return state;
  }
  state.pendingReload = true;
  state.reloadTimerSec = weapon.reloadSec ?? 1.5;
  state.lastMessage = `Reloading ${weapon.label}…`;
  return state;
}

export function cycleOwnedWeapon(state) {
  const owned = PLAYABLE_WEAPON_IDS.filter((id) => state.ownedWeapons.includes(id));
  if (owned.length <= 1) {
    state.lastMessage = "Buy another weapon to cycle loadout.";
    return { ok: false, reason: "single" };
  }
  const currentIndex = Math.max(0, owned.indexOf(state.equippedWeaponId));
  const nextWeaponId = owned[(currentIndex + 1) % owned.length];
  state.equippedWeaponId = nextWeaponId;
  state.ammo = getWeaponDef(nextWeaponId).magSize;
  state.pendingReload = false;
  state.reloadTimerSec = 0;
  state.lastMessage = `${getWeaponDef(nextWeaponId).label} equipped.`;
  persistPlayCanvasSave(state);
  return { ok: true, weaponId: nextWeaponId };
}

export function equipOwnedWeapon(state, weaponId) {
  const weapon = getWeaponDef(weaponId);
  if (!PLAYABLE_WEAPON_IDS.includes(weapon.id)) {
    return { ok: false, reason: "unknown" };
  }
  if (!state.ownedWeapons.includes(weapon.id)) {
    state.lastMessage = `${weapon.label} is not owned yet.`;
    return { ok: false, reason: "not_owned" };
  }
  state.equippedWeaponId = weapon.id;
  state.ammo = weapon.magSize;
  state.pendingReload = false;
  state.reloadTimerSec = 0;
  state.lastMessage = `${weapon.label} equipped.`;
  persistPlayCanvasSave(state);
  return { ok: true, weaponId: weapon.id };
}

export function getShopItems(state) {
  const costMultiplier = getShopCostMultiplier(state);
  const nextWave = Math.min(FINAL_WAVE, state.waveNumber + (state.phase === "intermission" ? 1 : 0));
  const weaponItems = PLAYABLE_WEAPONS.map((weapon) => {
    const owned = state.ownedWeapons.includes(weapon.id);
    const unlocked = weapon.unlockWave <= nextWave;
    const equipped = state.equippedWeaponId === weapon.id;
    const cost = getDiscountedCost(weapon.cost, costMultiplier);
    const affordable = state.coins >= cost;
    return {
      type: "weapon",
      id: weapon.id,
      label: weapon.label,
      cost,
      unlockWave: weapon.unlockWave,
      damage: weapon.damage,
      magSize: weapon.magSize,
      owned,
      unlocked,
      equipped,
      affordable,
      disabled: equipped || !unlocked || (!owned && !affordable),
      status: equipped ? "Equipped" : owned ? "Equip" : unlocked ? `${cost} coins` : `Wave ${weapon.unlockWave}`,
      detail: `DMG ${weapon.damage} · AMMO INF`,
    };
  });

  const armorItems = ARMOR_DEFS.map((armor) => {
    const owned = state.ownedArmors.includes(armor.id);
    const equipped = state.equippedArmorId === armor.id;
    const cost = getDiscountedCost(armor.cost, costMultiplier);
    const affordable = state.coins >= cost;
    const reductionPercent = Math.round((armor.damageReduction ?? 0) * 100);
    return {
      type: "armor",
      id: armor.id,
      label: armor.label,
      cost,
      owned,
      equipped,
      unlocked: true,
      affordable,
      disabled: equipped || (!owned && !affordable),
      status: equipped ? "Equipped" : owned ? "Equip" : `${cost} coins`,
      detail: `${reductionPercent}% damage reduction`,
    };
  });

  const villageUpgrade = getVillageUpgradeItem(state);
  const medKit = getMedKitItem(state);
  const gearItems = getGearShopItems(state, nextWave);
  const grenadeItems = getGrenadePackItems(state, nextWave);
  const c4Items = getC4PackItems(state, nextWave);
  const nukeItems = getNukePackItems(state, nextWave);
  return [...weaponItems, ...gearItems, ...grenadeItems, ...c4Items, ...nukeItems, ...armorItems, villageUpgrade, medKit];
}

export function buyOrEquipWeapon(state, weaponId) {
  const weapon = getWeaponDef(weaponId);
  if (!PLAYABLE_WEAPON_IDS.includes(weapon.id)) {
    return { ok: false, reason: "unknown" };
  }
  const nextWave = Math.min(FINAL_WAVE, state.waveNumber + (state.phase === "intermission" ? 1 : 0));
  if (weapon.unlockWave > nextWave) {
    state.lastMessage = `${weapon.label} unlocks at wave ${weapon.unlockWave}.`;
    return { ok: false, reason: "locked" };
  }
  const cost = getDiscountedCost(weapon.cost, getShopCostMultiplier(state));
  if (!state.ownedWeapons.includes(weapon.id)) {
    if (state.coins < cost) {
      state.lastMessage = `Need ${cost - state.coins} more coins for ${weapon.label}.`;
      return { ok: false, reason: "coins" };
    }
    state.coins -= cost;
    state.coins = Math.max(0, state.coins);
    state.ownedWeapons.push(weapon.id);
  }
  state.equippedWeaponId = weapon.id;
  state.ammo = weapon.magSize;
  state.pendingReload = false;
  state.reloadTimerSec = 0;
  state.lastMessage = `${weapon.label} equipped.`;
  persistPlayCanvasSave(state);
  return { ok: true };
}

export function buyOrEquipArmor(state, armorId) {
  const armor = getArmorDef(armorId);
  if (!armor) {
    return { ok: false, reason: "unknown" };
  }
  const cost = getDiscountedCost(armor.cost, getShopCostMultiplier(state));
  if (!state.ownedArmors.includes(armor.id)) {
    if (state.coins < cost) {
      state.lastMessage = `Need ${cost - state.coins} more coins for ${armor.label}.`;
      return { ok: false, reason: "coins" };
    }
    state.coins -= cost;
    state.coins = Math.max(0, state.coins);
    state.ownedArmors.push(armor.id);
  }
  state.equippedArmorId = armor.id;
  state.lastMessage = `${armor.label} equipped.`;
  persistPlayCanvasSave(state);
  return { ok: true };
}

export function setPlayerAds(state, ads) {
  state.player.ads = Boolean(ads);
}

export function buyGearItem(state, gearId) {
  const gear = GEAR_DEF_BY_ID.get(gearId);
  if (!gear) {
    return { ok: false, reason: "unknown" };
  }
  const unlockWave = Math.max(1, Math.round(Number(gear.unlockWave ?? 1)));
  if (state.waveNumber < unlockWave) {
    state.lastMessage = `${gear.label} unlocks at wave ${unlockWave}.`;
    return { ok: false, reason: "locked" };
  }
  if (state.ownedGear.includes(gear.id)) {
    state.lastMessage = `${gear.label} already owned.`;
    return { ok: false, reason: "owned" };
  }
  const cost = getDiscountedCost(gear.cost, getShopCostMultiplier(state));
  if (state.coins < cost) {
    state.lastMessage = `Need ${cost - state.coins} more coins for ${gear.label}.`;
    return { ok: false, reason: "coins" };
  }
  state.coins -= cost;
  state.coins = Math.max(0, state.coins);
  state.ownedGear.push(gear.id);
  state.lastMessage = `${gear.label} purchased.`;
  persistPlayCanvasSave(state);
  return { ok: true, gearId: gear.id };
}

export function useFlintAndSteel(state) {
  if (!isCombatPhase(state.phase)) {
    return { ok: false, reason: "blocked" };
  }
  if (!state.ownedGear.includes("flint_steel")) {
    state.lastMessage = "Buy Flint & Steel in the field shop to ignite ground fire.";
    return { ok: false, reason: "not_owned" };
  }
  if (state.flintCooldownSec > 0) {
    state.lastMessage = `Flint cooling down: ${Math.ceil(state.flintCooldownSec)}s.`;
    return { ok: false, reason: "cooldown" };
  }
  const x = clamp(state.player.x - Math.sin(state.player.yaw) * 5.2, -SLICE_WORLD.arenaHalf, SLICE_WORLD.arenaHalf);
  const z = clamp(state.player.z - Math.cos(state.player.yaw) * 5.2, -SLICE_WORLD.arenaHalf, SLICE_WORLD.arenaHalf + 3);
  state.flintCooldownSec = FLINT_COOLDOWN_SEC;

  // Merge nearby patch instead of creating a new one
  const nearby = state.firePatches.find((patch) => Math.hypot(patch.x - x, patch.z - z) <= FIRE_PATCH_MERGE_DIST);
  if (nearby) {
    nearby.ttlSec = Math.max(nearby.ttlSec, FIRE_PATCH_TTL_SEC * 0.85);
    state.lastMessage = "Ground fire refreshed.";
    return { ok: true, merged: true };
  }

  // Hard cap: max 3 concurrent fire patches
  if (state.firePatches.length >= FIRE_PATCH_MAX_COUNT) {
    state.lastMessage = "Max ground fires active. Wait for one to fade.";
    return { ok: false, reason: "cap" };
  }

  state.firePatches.push({
    id: `fire-${state.nextFireSeq++}`,
    x,
    z,
    radius: FIRE_PATCH_RADIUS,
    dps: FIRE_PATCH_DPS,
    ttlSec: FIRE_PATCH_TTL_SEC,
  });
  state.lastMessage = "Ground fire ignited.";
  return { ok: true };
}

export function hasGear(state, gearId) {
  return state.ownedGear.includes(gearId);
}

export function interactWithPlayCanvasWorld(state) {
  if (!isCombatPhase(state.phase)) {
    return { ok: false, reason: "blocked" };
  }

  if (state.activeBuildingId) {
    const activeBuilding = getActiveBuilding(state);
    const villager = getNearestAvailableVillagerInBuilding(state, activeBuilding);
    if (villager && distance2d(state.player, villager) <= VILLAGER_INTERACT_RANGE) {
      villager.state = "escorting";
      villager.hp = villager.maxHp;
      state.activeEscortVillagerId = villager.id;
      const target = computeEscortFollowTarget(
        { x: state.player.x, y: 1.2, z: state.player.z },
        state.player.yaw,
        ESCORT_FOLLOW_OFFSET,
      );
      villager.x = target.x;
      villager.z = target.z;
      state.lastMessage = `${villager.label} is following you. Deliver them to Town Hall.`;
      return { ok: true, action: "escort_started", villagerId: villager.id };
    }

    const door = activeBuilding?.interior?.doorInside;
    if (door && canInteractWithDoor(distance2d(state.player, door), DOOR_INTERACT_RANGE)) {
      exitActiveBuilding(state, activeBuilding);
      return { ok: true, action: "exit_building", buildingId: activeBuilding.id };
    }

    state.lastMessage = "Move to the villager or the interior door to interact.";
    return { ok: false, reason: "nothing_nearby" };
  }

  const escort = getActiveEscortVillager(state);
  const dropoff = getEscortDropoff();
  if (escort && Math.hypot(escort.x - dropoff.x, escort.z - dropoff.z) <= dropoff.radius) {
    rescueVillager(state, escort);
    return { ok: true, action: "rescued", villagerId: escort.id };
  }
  if (escort) {
    state.lastMessage = "Deliver villager to Town Hall first.";
    return { ok: false, reason: "escort_active" };
  }

  const building = getNearestExteriorDoorBuilding(state);
  if (!building) {
    state.lastMessage = "No door or villager nearby.";
    return { ok: false, reason: "nothing_nearby" };
  }

  enterBuilding(state, building);
  return { ok: true, action: "enter_building", buildingId: building.id };
}

export function getPlayCanvasMiniMapSnapshot(state) {
  const liveZombies = state.zombies
    .filter((zombie) => !zombie.dead)
    .map((zombie) => ({
      id: zombie.id,
      type: zombie.type,
      x: Number(zombie.x.toFixed(2)),
      z: Number(zombie.z.toFixed(2)),
      hp: Math.ceil(zombie.hp),
    }));
  return {
    worldHalfExtent: SLICE_WORLD.arenaHalf,
    player: {
      x: Number(state.player.x.toFixed(2)),
      z: Number(state.player.z.toFixed(2)),
      yaw: Number(state.player.yaw.toFixed(3)),
    },
    village: {
      x: 0,
      z: SLICE_WORLD.villageZ,
      radius: SLICE_WORLD.villageRadius,
      hp: Math.ceil(state.villageHp),
      maxHp: state.maxVillageHp,
    },
    liveZombies,
    activeFirePatches: state.firePatches.map((patch) => ({
      id: patch.id,
      x: Number(patch.x.toFixed(2)),
      z: Number(patch.z.toFixed(2)),
      radius: patch.radius,
      ttlSec: Number(patch.ttlSec.toFixed(2)),
    })),
    buildings: getPlayCanvasBuildingSnapshot(state).buildings,
    villagers: getPlayCanvasVillagerSnapshot(state),
    escortDropoff: state.activeEscortVillagerId ? getEscortDropoff() : null,
    objective: state.phase === "secret_boss" ? "defeat_secret_boss" : state.phase === "running" ? "defend_village" : state.phase,
  };
}

export function getPlayCanvasBuildingSnapshot(state) {
  return {
    activeBuildingId: state.activeBuildingId,
    openedCount: state.openedBuildings.length,
    buildings: BUILDING_DEFS.map((building) => ({
      id: building.id,
      label: building.label,
      opened: state.openedBuildings.includes(building.id),
      exteriorDoor: { x: building.exteriorDoor.x, z: building.exteriorDoor.z },
      interiorDoor: { x: building.interior.doorInside.x, z: building.interior.doorInside.z },
    })),
  };
}

export function getPlayCanvasVillagerSnapshot(state) {
  return state.villagers.map((villager) => ({
    id: villager.id,
    buildingId: villager.buildingId,
    state: villager.state,
    x: Number(villager.x.toFixed(2)),
    z: Number(villager.z.toFixed(2)),
    hp: Math.ceil(villager.hp),
    maxHp: Math.ceil(villager.maxHp),
    healthBarVisible: villager.state === "escorting",
  }));
}

export function getPlayCanvasBossSnapshot(state) {
  const liveBosses = state.zombies
    .filter((zombie) => !zombie.dead && (zombie.type === BOSS_WAVE_TYPE_ID || zombie.type === BOSS_DEF.id))
    .map((zombie) => ({
      id: zombie.id,
      type: zombie.type,
      label: zombie.label,
      hp: Math.ceil(zombie.hp),
      maxHp: Math.ceil(zombie.maxHp),
      x: Number(zombie.x.toFixed(2)),
      z: Number(zombie.z.toFixed(2)),
    }));
  return {
    phase: state.phase,
    bossWaveActive: liveBosses.some((boss) => boss.type === BOSS_WAVE_TYPE_ID),
    secretBossActive: state.secretBossActive,
    secretBossSpawned: state.secretBossSpawned,
    liveBosses,
    landscapeZombified: state.landscapeZombified,
    mutatedLandscapeIds: [...state.mutatedLandscapeIds],
    lastMutationEvent: state.lastMutationEvent
      ? {
          wave: state.lastMutationEvent.wave,
          count: state.lastMutationEvent.count,
          ids: [...state.lastMutationEvent.ids],
        }
      : null,
  };
}

export function getPlayCanvasImpactSnapshot(state) {
  const broken = new Set(state.brokenWindowIds ?? []);
  return {
    windows: BREAKABLE_WINDOW_DEFS.map((windowDef) => ({
      id: windowDef.id,
      x: windowDef.x,
      y: windowDef.y,
      z: windowDef.z,
      broken: broken.has(windowDef.id),
      materialId: windowDef.materialId,
    })),
    brokenWindows: broken.size,
    brokenWindowIds: [...broken],
    activeImpactFx: (state.impactEvents ?? []).length,
    impacts: (state.impactEvents ?? []).map((event) => ({
      id: event.id,
      materialId: event.materialId,
      x: Number(event.x.toFixed(2)),
      y: Number(event.y.toFixed(2)),
      z: Number(event.z.toFixed(2)),
      ttlSec: Number(event.ttlSec.toFixed(2)),
      windowId: event.windowId ?? null,
      windowShattered: Boolean(event.windowShattered),
    })),
    lastImpactEvent: state.lastImpactEvent
      ? {
          ...state.lastImpactEvent,
          x: Number(state.lastImpactEvent.x.toFixed(2)),
          y: Number(state.lastImpactEvent.y.toFixed(2)),
          z: Number(state.lastImpactEvent.z.toFixed(2)),
        }
      : null,
    structureHits: state.structureHits ?? 0,
    potentialVillageDamage: Number((state.potentialVillageDamage ?? 0).toFixed(2)),
    appliedVillageDamage: Number((state.appliedVillageDamage ?? 0).toFixed(2)),
  };
}

export function getPlayCanvasWeaponSnapshot(state) {
  const weapon = getWeaponDef(state.equippedWeaponId);
  const identity = getWeaponIdentity(weapon);
  return {
    id: weapon.id,
    label: weapon.label,
    category: weapon.category,
    damage: weapon.damage,
    rpm: weapon.rpm,
    spreadMoa: Number((weapon.spreadMoa ?? 0).toFixed(2)),
    family: identity.family,
    viewModel: identity.viewModel,
    reticle: identity.reticle,
    muzzleFx: identity.muzzleFx,
    shotFx: identity.shotFx,
    silhouette: identity.silhouette,
    recoilKick: identity.recoilKick,
  };
}

export function getPlayCanvasGuidanceSnapshot(state) {
  if (state.phase === "ready") {
    return {
      stage: "ready",
      title: "First run: hold the village line",
      message: "Start the campaign, move with WASD or touch controls, fire with click or Space, and use G/Blast when zombies cluster. The shop opens between waves.",
      action: "start_campaign",
      recommendation: null,
      nextThreat: null,
      enemyIntro: null,
      motivation: null,
    };
  }

  if (isCombatPhase(state.phase)) {
    const escort = getActiveEscortVillager(state);
    let title = "Wave guide";
    let message = "Keep the reticle on the closest zombie. Backpedal to protect your health, and stop anything that reaches the bell tower.";
    let action = "defend_village";
    if (state.lastEnemyIntro?.message) {
      title = `New threat: ${state.lastEnemyIntro.label}`;
      message = state.lastEnemyIntro.message;
      action = `learn_${state.lastEnemyIntro.type}`;
    } else if (escort) {
      title = "Escort active";
      message = "Keep zombies off the survivor and lead them to the Town Hall dropoff ring for a permanent perk.";
      action = "escort_to_townhall";
    } else if (state.activeBuildingId) {
      title = "Inside a building";
      message = "Find the survivor, press E or Use nearby, then return through the interior door.";
      action = "find_survivor";
    } else if (state.waveElapsedSec < 10 && state.kills === 0) {
      title = "First contact";
      message = "Aim down the village street, fire in short bursts, and use Blast when a group reaches the barricades.";
      action = "kill_first_zombie";
    } else if (state.openedBuildings.length === 0 && state.waveNumber >= 2) {
      title = "Rescue survivors";
      message = "Doors are marked on the minimap. Press E or Use at a door between threats to start rescuing villagers for permanent perks.";
      action = "rescue_survivor";
    }
    return {
      stage: state.phase,
      title,
      message,
      action,
      recommendation: null,
      nextThreat: null,
      enemyIntro: state.lastEnemyIntro ? { ...state.lastEnemyIntro } : null,
      motivation: null,
    };
  }

  if (state.phase === "intermission") {
    const nextThreat = getNextWaveThreatBrief({
      clearedWave: state.waveNumber,
      waveDefs: wavesConfig,
      enemyMap: ENEMY_DEFS,
    });
    const recommendation = normalizePlayCanvasRecommendation(getFirstSessionShopRecommendation({
      save: createRecommendationSave(state),
      waveNumber: Math.min(FINAL_WAVE, state.waveNumber + 1),
      weapons: weaponsConfig,
      economy: economyConfig,
      currentHp: state.playerHp,
      costMultiplier: getShopCostMultiplier(state),
    }));
    const threatCopy = nextThreat ? ` Next threat: ${nextThreat.label}. ${nextThreat.message}` : "";
    return {
      stage: "intermission",
      title: recommendation?.title ?? "Upgrade before the next wave",
      message: `${recommendation?.reason ?? "Spend coins before continuing."}${threatCopy}`,
      action: recommendation ? `buy_${recommendation.targetType}:${recommendation.targetId}` : "open_shop",
      recommendation,
      nextThreat,
      enemyIntro: null,
      motivation: null,
    };
  }

  if (state.phase === "lost" || state.phase === "won") {
    const victory = state.phase === "won";
    const motivation = getRunMotivation({
      victory,
      waveReached: state.waveNumber,
      bestWave: state.bestWave,
    });
    return {
      stage: state.phase,
      title: victory ? "Run complete" : "Next attempt",
      message: motivation,
      action: victory ? "play_again" : "retry",
      recommendation: null,
      nextThreat: null,
      enemyIntro: null,
      motivation,
    };
  }

  return {
    stage: state.phase,
    title: "Campaign guide",
    message: state.lastMessage,
    action: "continue",
    recommendation: null,
    nextThreat: null,
    enemyIntro: null,
    motivation: null,
  };
}

export function getPlayCanvasAudioSnapshot(state, ui = {}) {
  const mode = getPlayCanvasMusicMode(state, ui);
  const closestThreatDistance = getClosestLiveZombieDistance(state);
  const aliveEnemies = state.zombies.filter((zombie) => !zombie.dead).length;
  const snapshot = {
    mode,
    phase: state.phase,
    victory: state.phase === "won",
    waveNumber: state.waveNumber,
    aliveEnemies,
    closestThreatDistance,
    playerHp: state.playerHp,
    villageHp: state.villageHp,
    maxVillageHp: state.maxVillageHp,
    secretBossActive: Boolean(state.secretBossActive || state.phase === "secret_boss"),
    bossActive: hasLiveBoss(state),
    bossWave: hasLiveBoss(state),
    villageDamageRecent: Math.max(0, Number(ui.villageDamageRecent ?? 0)),
    playerDamageRecent: Math.max(0, Number(ui.playerDamageRecent ?? 0)),
  };
  return {
    musicEnabled: state.musicEnabled !== false,
    sfxEnabled: state.sfxEnabled !== false,
    mode,
    cueId: selectMusicCue(snapshot),
    threatScore: Number(computeRaidThreatScore(snapshot).toFixed(3)),
    aliveEnemies,
    closestThreatDistance: Number.isFinite(closestThreatDistance) ? Number(closestThreatDistance.toFixed(2)) : "none",
  };
}

export function revivePlayer(state, { hp = 60, invulnerableSec = 3 } = {}) {
  if (state.phase !== "lost") return { ok: false, reason: "not_lost" };
  if (state.reviveUsed) return { ok: false, reason: "already_used" };
  state.reviveUsed = true;
  state.playerHp = Math.min(state.maxPlayerHp ?? 100, hp);
  state.invulnerableSec = invulnerableSec;
  state.phase = state.secretBossActive ? "secret_boss" : "running";
  state.lastMessage = "Revived! Get back in there!";
  return { ok: true };
}

export function setPlayCanvasAudioSettings(state, settings = {}) {
  if ("musicEnabled" in settings) {
    state.musicEnabled = settings.musicEnabled !== false;
  }
  if ("sfxEnabled" in settings) {
    state.sfxEnabled = settings.sfxEnabled !== false;
  }
  persistPlayCanvasSave(state);
  return {
    musicEnabled: state.musicEnabled !== false,
    sfxEnabled: state.sfxEnabled !== false,
  };
}

function getPlayCanvasMusicMode(state, ui = {}) {
  if (ui.shopOpen || state.phase === "intermission") {
    return "shop";
  }
  if (state.phase === "ready") {
    return "menu";
  }
  if (state.phase === "lost" || state.phase === "won") {
    return "game_over";
  }
  return "raid";
}

function getClosestLiveZombieDistance(state) {
  let closest = Infinity;
  for (const zombie of state.zombies) {
    if (zombie.dead) {
      continue;
    }
    closest = Math.min(closest, distance2d(state.player, zombie));
  }
  return closest;
}

function hasLiveBoss(state) {
  return state.zombies.some((zombie) => {
    if (zombie.dead) {
      return false;
    }
    return zombie.type === BOSS_DEF.id || zombie.type === BOSS_WAVE_TYPE_ID || zombie.type === "mega_zombie";
  });
}

export function buyVillageUpgrade(state) {
  const item = getVillageUpgradeItem(state);
  if (item.atMax) {
    state.lastMessage = "Town defenses are fully upgraded.";
    return { ok: false, reason: "max" };
  }
  if (!item.affordable) {
    state.lastMessage = `Need ${item.cost - state.coins} more coins for town defenses.`;
    return { ok: false, reason: "coins" };
  }
  state.coins -= item.cost;
  state.coins = Math.max(0, state.coins);
  state.villageLevel = item.nextLevel;
  syncVillagerPerkModifiers(state);
  state.maxVillageHp = getVillageMaxHp(state.villageLevel, state.villagerPerkModifiers);
  state.villageHp = state.maxVillageHp;
  state.lastMessage = `Town defenses upgraded to level ${state.villageLevel}.`;
  persistPlayCanvasSave(state);
  return { ok: true };
}

export function buyMedKit(state) {
  const item = getMedKitItem(state);
  if (item.atFullHealth) {
    state.lastMessage = "Player health is already full.";
    return { ok: false, reason: "full" };
  }
  if (!item.affordable) {
    state.lastMessage = `Need ${item.cost - state.coins} more coins for a med kit.`;
    return { ok: false, reason: "coins" };
  }
  state.coins -= item.cost;
  state.coins = Math.max(0, state.coins);
  state.playerHp = state.maxPlayerHp;
  state.lastMessage = "Med kit used. Health restored.";
  persistPlayCanvasSave(state);
  return { ok: true };
}

export function buyGrenadePack(state, packId) {
  const pack = economyConfig.grenadePacks?.find((item) => item.id === packId);
  if (!pack) {
    return { ok: false, reason: "unknown" };
  }
  return buyCountPack(state, pack, "grenade");
}

export function buyC4Pack(state, packId) {
  const pack = economyConfig.c4Packs?.find((item) => item.id === packId);
  if (!pack) {
    return { ok: false, reason: "unknown" };
  }
  return buyCountPack(state, pack, "c4");
}

export function buyNukePack(state, packId) {
  const pack = economyConfig.nukePacks?.find((item) => item.id === packId);
  if (!pack) {
    return { ok: false, reason: "unknown" };
  }
  return buyCountPack(state, pack, "nuke");
}

export function cycleOrdnance(state) {
  const ids = getAvailableOrdnanceIds(state);
  if (!ids.length) {
    state.lastMessage = "Buy ordnance packs in the field shop.";
    return { ok: false, reason: "empty" };
  }
  const currentIndex = ids.indexOf(state.activeOrdnanceId);
  state.activeOrdnanceId = ids[(currentIndex + 1 + ids.length) % ids.length];
  state.lastMessage = `${getOrdnanceLabel(state.activeOrdnanceId)} selected.`;
  persistPlayCanvasSave(state);
  return { ok: true, activeOrdnanceId: state.activeOrdnanceId };
}

export function useOrdnance(state) {
  if (!isCombatPhase(state.phase) || state.ordnanceCooldownSec > 0) {
    return { ok: false, reason: "blocked" };
  }
  const def = getActiveOrdnanceDef(state);
  if (!def || getOrdnanceCount(state, def.id) <= 0) {
    state.lastMessage = "No ordnance ready. Buy packs in the field shop.";
    return { ok: false, reason: "empty" };
  }

  consumeOrdnance(state, def.id);
  const cooldownMultiplier = Math.max(0, Number(getCurrentPerkModifiers(state).grenadeCooldownMultiplier ?? 1));
  state.ordnanceCooldownSec = def.cooldownSec * cooldownMultiplier;

  // Grenades are lobbed — they arc out and detonate on landing/impact. C4 and
  // the nuke device stay instant (a placed charge / a fixed strike).
  if (GRENADE_DEF_BY_ID.has(def.id)) {
    launchOrdnanceProjectile(state, def);
    state.activeOrdnanceId = normalizeActiveOrdnance(state.activeOrdnanceId, state.grenadeInventory, state.c4Count, state.nukeCount);
    state.lastMessage = `${def.label} away!`;
    persistPlayCanvasSave(state);
    return { ok: true, lobbed: true, ordnanceId: def.id };
  }

  const center = getBlastCenter(state, def);
  const { hitCount, killCount, structureImpact } = applyOrdnanceBlast(state, def, center);
  state.activeOrdnanceId = normalizeActiveOrdnance(state.activeOrdnanceId, state.grenadeInventory, state.c4Count, state.nukeCount);
  state.lastMessage = structureImpact
    ? `${def.label} detonated: ${hitCount} hit, ${killCount} down; ${structureImpact.materialId} impact.`
    : `${def.label} detonated: ${hitCount} hit, ${killCount} down.`;
  persistPlayCanvasSave(state);
  return { ok: true, hitCount, killCount, ordnanceId: def.id, structureImpact };
}

// Shared blast application — used by instant ordnance (C4/nuke) and by lobbed
// grenade detonations. Returns hit/kill counts plus any structure impact.
function applyOrdnanceBlast(state, def, center) {
  let hitCount = 0;
  let killCount = 0;
  for (const zombie of state.zombies) {
    if (zombie.dead) {
      continue;
    }
    const distance = Math.hypot(zombie.x - center.x, zombie.z - center.z);
    if (distance > def.radius) {
      continue;
    }
    const falloff = def.id === "nuke" ? 1 : Math.max(0.35, 1 - distance / Math.max(1, def.radius));
    const { killed } = damageZombie(state, zombie, Math.round(def.damage * falloff));
    zombie.hitFlashSec = 0.24;
    hitCount += 1;
    if (killed) {
      killCount += 1;
    }
  }
  const structureImpact = resolvePlayCanvasBlastImpact(state, def, center);
  return { hitCount, killCount, structureImpact };
}

// Spawn a lobbed grenade from the player's aim. Higher aim throws farther; a
// steep down-aim still arcs a short distance (clamped elevation).
function launchOrdnanceProjectile(state, def) {
  const yaw = state.player.yaw ?? 0;
  const pitchDeg = state.player.pitch ?? 0; // positive = looking up
  const elevationDeg = clamp(pitchDeg + ORDNANCE_LOB_BIAS_DEG, ORDNANCE_MIN_ELEV_DEG, ORDNANCE_MAX_ELEV_DEG);
  const elevation = (elevationDeg * Math.PI) / 180;
  const speed = def.muzzleVelocityMps ?? 18;
  const horizSpeed = speed * Math.cos(elevation);
  const dirX = -Math.sin(yaw);
  const dirZ = -Math.cos(yaw);
  const projectile = {
    id: `ord-${state.nextOrdnanceSeq++}`,
    ordnanceId: def.id,
    x: state.player.x + dirX * 0.6,
    y: Math.max(0, state.player.y ?? 0) + ORDNANCE_LAUNCH_HEIGHT,
    z: state.player.z + dirZ * 0.6,
    vx: dirX * horizSpeed,
    vy: speed * Math.sin(elevation),
    vz: dirZ * horizSpeed,
    airSec: 0,
    projectileRadius: def.projectileRadius ?? 0.1,
  };
  state.ordnanceProjectiles.push(projectile);
  return projectile;
}

function stepOrdnanceProjectiles(state, dt) {
  // Detonation events are drained by the renderer each frame; clear any that the
  // renderer never consumed (e.g. headless stepping) so the queue can't grow.
  if (state.ordnanceDetonations?.length) {
    state.ordnanceDetonations = state.ordnanceDetonations.filter((event) => {
      event.ageSec = (event.ageSec ?? 0) + dt;
      return event.ageSec < 1;
    });
  }
  if (!state.ordnanceProjectiles?.length) {
    return;
  }
  const survivors = [];
  for (const projectile of state.ordnanceProjectiles) {
    projectile.airSec += dt;
    projectile.vy -= ORDNANCE_GRAVITY * dt;
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.z += projectile.vz * dt;

    let detonate = false;
    if (projectile.y <= 0.1 && projectile.vy < 0) {
      projectile.y = 0.1;
      detonate = true; // hit the ground
    }
    if (!detonate) {
      for (const zombie of state.zombies) {
        if (zombie.dead) {
          continue;
        }
        const dx = zombie.x - projectile.x;
        const dz = zombie.z - projectile.z;
        const contact = getZombieBodyRadius(zombie) + projectile.projectileRadius + 0.15;
        const baseY = Math.max(0, zombie.y ?? 0);
        const topY = baseY + getZombieBodyHeight(zombie);
        const verticalContact = projectile.y >= baseY - projectile.projectileRadius
          && projectile.y <= topY + projectile.projectileRadius;
        if (verticalContact && dx * dx + dz * dz <= contact * contact) {
          detonate = true; // bonked a zombie mid-flight
          break;
        }
      }
    }
    if (!detonate && (projectile.airSec >= ORDNANCE_MAX_AIRTIME
      || Math.abs(projectile.x) > SLICE_WORLD.arenaHalf + 6
      || Math.abs(projectile.z) > SLICE_WORLD.arenaHalf + 6)) {
      detonate = true;
    }

    if (detonate) {
      detonateOrdnanceProjectile(state, projectile);
    } else {
      survivors.push(projectile);
    }
  }
  state.ordnanceProjectiles = survivors;
}

function detonateOrdnanceProjectile(state, projectile) {
  const def = GRENADE_DEF_BY_ID.get(projectile.ordnanceId) ?? GRENADE_DEF_BY_ID.get(DEFAULT_GRENADE_TYPE_ID);
  const center = { x: projectile.x, z: projectile.z };
  const { hitCount, killCount, structureImpact } = applyOrdnanceBlast(state, def, center);
  state.ordnanceDetonations.push({
    id: projectile.id,
    ordnanceId: def.id,
    x: projectile.x,
    y: Math.max(0.1, projectile.y),
    z: projectile.z,
    hitCount,
    killCount,
    ageSec: 0,
  });
  state.lastMessage = structureImpact
    ? `${def.label} detonated: ${hitCount} hit, ${killCount} down; ${structureImpact.materialId} impact.`
    : `${def.label} detonated: ${hitCount} hit, ${killCount} down.`;
}

// Live grenades in the air — the renderer draws one entity per id and a trail.
export function getPlayCanvasOrdnanceProjectiles(state) {
  return (state.ordnanceProjectiles ?? []).map((projectile) => ({
    id: projectile.id,
    ordnanceId: projectile.ordnanceId,
    x: projectile.x,
    y: projectile.y,
    z: projectile.z,
    projectileRadius: projectile.projectileRadius,
  }));
}

// Drain detonations so each blast spawns FX exactly once. Returns and clears.
export function consumePlayCanvasOrdnanceDetonations(state) {
  const events = state.ordnanceDetonations ?? [];
  state.ordnanceDetonations = [];
  return events.map((event) => ({
    id: event.id,
    ordnanceId: event.ordnanceId,
    x: event.x,
    y: event.y,
    z: event.z,
    hitCount: event.hitCount,
    killCount: event.killCount,
  }));
}

export function persistPlayCanvasSave(state) {
  if (typeof localStorage === "undefined") {
    return null;
  }
  const grenadeInventory = normalizeGrenadeInventory(state.grenadeInventory, 5);
  const grenades = Math.max(0, Math.round(Number(grenadeInventory.frag ?? state.grenades ?? 0)));
  const activeGrenadeId = GRENADE_DEF_BY_ID.has(state.activeOrdnanceId) ? state.activeOrdnanceId : DEFAULT_GRENADE_TYPE_ID;
  const save = {
    version: PLAYCANVAS_SAVE_VERSION,
    profileType: PLAYCANVAS_PROFILE_TYPE,
    coins: state.coins,
    bestWave: state.bestWave,
    grenades,
    unlockedWeapons: Array.from(new Set(["pipe", ...state.ownedWeapons])),
    ownedWeapons: state.ownedWeapons,
    equippedWeaponId: state.equippedWeaponId,
    pistolUnlocked: state.ownedWeapons.includes("pistol"),
    ownedArmors: state.ownedArmors,
    equippedArmorId: state.equippedArmorId,
    ownedGear: state.ownedGear,
    openedBuildings: state.openedBuildings,
    rescuedVillagers: state.rescuedVillagers,
    deadVillagers: state.deadVillagers,
    villageLevel: state.villageLevel,
    grenadeInventory,
    activeOrdnanceId: state.activeOrdnanceId,
    activeGrenadeId,
    c4Count: state.c4Count,
    c4Charges: state.c4Count,
    nukeCount: state.nukeCount,
    nukes: state.nukeCount,
    totalKills: state.totalKills,
    sensitivity: Number(state.sensitivity ?? 0.18),
    graphicsPreset: state.graphicsPreset ?? "desktop_high",
    musicEnabled: state.musicEnabled !== false,
    sfxEnabled: state.sfxEnabled !== false,
    lifetimeStats: normalizeLifetimeStats(state.lifetimeStats),
    claimedOfferKeys: normalizeClaimedOfferKeys(state.claimedOfferKeys),
    claimedGoalIds: normalizeClaimedGoalIds(state.claimedGoalIds),
  };
  const safe = sanitizePlayCanvasSave(save);
  localStorage.setItem(PLAYCANVAS_SAVE_KEY, JSON.stringify(safe));
  return safe;
}

export function loadPlayCanvasSave() {
  if (typeof localStorage === "undefined") {
    return null;
  }
  try {
    return sanitizePlayCanvasSave(JSON.parse(localStorage.getItem(PLAYCANVAS_SAVE_KEY) || "null"));
  } catch {
    return null;
  }
}

export function sanitizePlayCanvasSave(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const ownedWeapons = normalizeOwnedWeapons(raw.ownedWeapons ?? raw.unlockedWeapons);
  const equippedWeaponId = ownedWeapons.includes(raw.equippedWeaponId) ? raw.equippedWeaponId : STARTING_WEAPON_ID;
  const ownedArmors = normalizeOwnedArmors(raw.ownedArmors);
  const equippedArmorId = ownedArmors.includes(raw.equippedArmorId) ? raw.equippedArmorId : STARTING_ARMOR_ID;
  const rescuedVillagers = normalizeVillagerIds(raw.rescuedVillagers);
  const rescuedSet = new Set(rescuedVillagers);
  const deadVillagers = normalizeVillagerIds(raw.deadVillagers).filter((id) => !rescuedSet.has(id));
  const c4Count = Math.max(0, Math.round(Number(raw.c4Count ?? raw.c4Charges ?? 0)));
  const nukeCount = Math.max(0, Math.round(Number(raw.nukeCount ?? raw.nukes ?? 0)));
  const grenadeInventory = normalizeGrenadeInventory(raw.grenadeInventory, raw.grenades ?? 5);
  const activeOrdnanceId = normalizeActiveOrdnance(raw.activeOrdnanceId ?? raw.activeGrenadeId, grenadeInventory, c4Count, nukeCount);
  const stats = normalizeLifetimeStats(raw.lifetimeStats);
  stats.kills = Math.max(stats.kills, Math.max(0, Math.round(Number(raw.totalKills ?? 0))));
  return {
    version: PLAYCANVAS_SAVE_VERSION,
    profileType: PLAYCANVAS_PROFILE_TYPE,
    coins: Math.max(0, Math.round(Number(raw.coins ?? 0))),
    bestWave: Math.max(1, Math.round(Number(raw.bestWave ?? 1))),
    grenades: Math.max(0, Math.round(Number(grenadeInventory.frag ?? raw.grenades ?? 0))),
    grenadeInventory,
    activeOrdnanceId,
    activeGrenadeId: GRENADE_DEF_BY_ID.has(activeOrdnanceId) ? activeOrdnanceId : DEFAULT_GRENADE_TYPE_ID,
    c4Count,
    c4Charges: c4Count,
    nukeCount,
    nukes: nukeCount,
    unlockedWeapons: Array.from(new Set(["pipe", ...ownedWeapons])),
    ownedWeapons,
    equippedWeaponId,
    pistolUnlocked: ownedWeapons.includes("pistol"),
    openedBuildings: normalizeBuildingIds(raw.openedBuildings),
    rescuedVillagers,
    deadVillagers,
    villageLevel: normalizeVillageLevel(raw.villageLevel),
    ownedArmors,
    equippedArmorId,
    ownedGear: normalizeOwnedGear(raw.ownedGear),
    sensitivity: clampNumber(raw.sensitivity, 0.05, 0.6, 0.18),
    graphicsPreset: typeof raw.graphicsPreset === "string" ? raw.graphicsPreset : "desktop_high",
    musicEnabled: raw.musicEnabled !== false,
    sfxEnabled: raw.sfxEnabled !== false,
    totalKills: stats.kills,
    lifetimeStats: stats,
    claimedOfferKeys: normalizeClaimedOfferKeys(raw.claimedOfferKeys),
    claimedGoalIds: normalizeClaimedGoalIds(raw.claimedGoalIds),
  };
}

function defaultLifetimeStats() {
  return {
    kills: 0,
    damageDealt: 0,
    damageTaken: 0,
    villageDamageTaken: 0,
    wavesCleared: 0,
    playSeconds: 0,
  };
}

function normalizeLifetimeStats(raw) {
  const stats = raw && typeof raw === "object" ? raw : {};
  return {
    kills: Math.max(0, Math.round(Number(stats.kills ?? 0))),
    damageDealt: Math.max(0, Math.round(Number(stats.damageDealt ?? 0))),
    damageTaken: Math.max(0, Math.round(Number(stats.damageTaken ?? 0))),
    villageDamageTaken: Math.max(0, Math.round(Number(stats.villageDamageTaken ?? 0))),
    wavesCleared: Math.max(0, Math.round(Number(stats.wavesCleared ?? 0))),
    playSeconds: Math.max(0, Number(stats.playSeconds ?? 0)),
  };
}

function normalizeClaimedOfferKeys(raw) {
  return Array.isArray(raw) ? raw.filter((k) => typeof k === "string") : [];
}

function normalizeClaimedGoalIds(raw) {
  const validIds = new Set(GOAL_DEFS.map((g) => g.id));
  return Array.isArray(raw) ? raw.filter((id) => typeof id === "string" && validIds.has(id)) : [];
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function normalizeOwnedWeapons(ownedWeapons) {
  const owned = Array.isArray(ownedWeapons) ? ownedWeapons.filter((id) => PLAYABLE_WEAPON_IDS.includes(id)) : [];
  return Array.from(new Set([...STARTER_WEAPON_IDS, ...owned]));
}

function normalizeOwnedArmors(ownedArmors) {
  const owned = Array.isArray(ownedArmors) ? ownedArmors.filter((id) => ARMOR_DEF_BY_ID.has(id)) : [];
  return Array.from(new Set([STARTING_ARMOR_ID, ...owned]));
}

function normalizeOwnedGear(ownedGear) {
  const owned = Array.isArray(ownedGear) ? ownedGear.filter((id) => GEAR_DEF_BY_ID.has(id)) : [];
  return Array.from(new Set(owned));
}

function normalizeBuildingIds(ids) {
  const valid = new Set(BUILDING_DEFS.map((building) => building.id));
  const values = Array.isArray(ids) ? ids.filter((id) => valid.has(id)) : [];
  return Array.from(new Set(values));
}

function normalizeVillagerIds(ids) {
  const valid = new Set(BUILDING_DEFS.flatMap((building) => building.interior.villagerSpots.map((spot) => spot.id)));
  const values = Array.isArray(ids) ? ids.filter((id) => valid.has(id)) : [];
  return Array.from(new Set(values));
}

function createPlayCanvasVillagers({ rescuedVillagers = [], deadVillagers = [] } = {}) {
  return BUILDING_DEFS.flatMap((building) =>
    building.interior.villagerSpots.map((spot) => {
      const save = { rescuedVillagers, deadVillagers };
      const available = isVillagerAvailable(save, spot.id);
      return {
        id: spot.id,
        label: villagerLabel(spot.id, building.label),
        buildingId: building.id,
        x: spot.x,
        z: spot.z,
        homeX: spot.x,
        homeZ: spot.z,
        hp: ESCORT_HP_BASE,
        maxHp: ESCORT_HP_BASE,
        state: rescuedVillagers.includes(spot.id) ? "rescued" : available ? "idle" : "dead",
      };
    }),
  );
}

function villagerLabel(villagerId, buildingLabel) {
  const suffix = villagerId.replace(/^villager_/, "").replaceAll("_", " ");
  return `${buildingLabel} survivor (${suffix})`;
}

function getActiveBuilding(state) {
  return state.activeBuildingId ? BUILDING_DEF_BY_ID.get(state.activeBuildingId) : null;
}

function getActiveEscortVillager(state) {
  return state.activeEscortVillagerId
    ? state.villagers.find((villager) => villager.id === state.activeEscortVillagerId && villager.state === "escorting")
    : null;
}

function getNearestAvailableVillagerInBuilding(state, building) {
  if (!building) {
    return null;
  }
  const ids = new Set(building.interior.villagerSpots.map((spot) => spot.id));
  return state.villagers
    .filter((villager) => ids.has(villager.id) && villager.state === "idle")
    .sort((a, b) => distance2d(state.player, a) - distance2d(state.player, b))[0] ?? null;
}

function getNearestExteriorDoorBuilding(state) {
  return BUILDING_DEFS
    .map((building) => ({
      building,
      distance: distance2d(state.player, building.exteriorDoor),
    }))
    .filter((entry) => canInteractWithDoor(entry.distance, DOOR_INTERACT_RANGE))
    .sort((a, b) => a.distance - b.distance)[0]?.building ?? null;
}

function enterBuilding(state, building) {
  state.activeBuildingId = building.id;
  state.player.x = building.interior.spawnInside.x;
  state.player.z = building.interior.spawnInside.z;
  if (!state.openedBuildings.includes(building.id)) {
    state.openedBuildings.push(building.id);
  }
  state.lastMessage = `Entered ${building.label}. Find the survivor and lead them out.`;
  persistPlayCanvasSave(state);
}

function exitActiveBuilding(state, building) {
  state.activeBuildingId = null;
  state.player.x = building.exteriorSpawn.x;
  state.player.z = building.exteriorSpawn.z;
  const escort = getActiveEscortVillager(state);
  if (escort) {
    escort.x = state.player.x;
    escort.z = state.player.z + 1.8;
    state.lastMessage = `${escort.label} is outside. Deliver them to Town Hall.`;
  } else {
    state.lastMessage = `Exited ${building.label}.`;
  }
}

function rescueVillager(state, villager) {
  villager.state = "rescued";
  const dropoff = getEscortDropoff();
  villager.x = dropoff.x;
  villager.z = dropoff.z;
  state.activeEscortVillagerId = null;
  if (!state.rescuedVillagers.includes(villager.id)) {
    state.rescuedVillagers.push(villager.id);
  }
  state.deadVillagers = state.deadVillagers.filter((id) => id !== villager.id);
  const previousMaxVillageHp = Math.max(1, Number(state.maxVillageHp) || 1);
  const previousVillageRatio = Math.max(0, Math.min(1, (Number(state.villageHp) || 0) / previousMaxVillageHp));
  syncVillagerPerkModifiers(state);
  state.maxVillageHp = getVillageMaxHp(state.villageLevel, state.villagerPerkModifiers);
  state.villageHp = Math.max(0, Math.min(state.maxVillageHp, state.maxVillageHp * previousVillageRatio));
  state.coins += VILLAGER_RESCUE_COIN_REWARD;
  const perk = VILLAGER_PERK_DEFS[villager.id];
  const perkLabel = perk?.summary ? ` ${perk.summary}.` : "";
  state.lastMessage = `${villager.label} rescued. Permanent upgrade unlocked.${perkLabel} +${VILLAGER_RESCUE_COIN_REWARD} coins.`;
  persistPlayCanvasSave(state);
}

function killEscortedVillager(state, villager) {
  villager.state = "dead";
  villager.hp = 0;
  state.activeEscortVillagerId = null;
  if (!state.deadVillagers.includes(villager.id)) {
    state.deadVillagers.push(villager.id);
  }
  state.rescuedVillagers = state.rescuedVillagers.filter((id) => id !== villager.id);
  syncVillagerPerkModifiers(state);
  state.lastMessage = "Escort failed. Villager died and is permanently lost.";
  persistPlayCanvasSave(state);
}

function syncVillagerPerkModifiers(state) {
  state.villagerPerkModifiers = getVillagerPerkModifiers({
    rescuedVillagers: state.rescuedVillagers,
    deadVillagers: state.deadVillagers,
  });
  return state.villagerPerkModifiers;
}

function getCurrentPerkModifiers(state) {
  return state.villagerPerkModifiers ?? syncVillagerPerkModifiers(state);
}

function getShopCostMultiplier(state) {
  return Math.max(0, Number(getCurrentPerkModifiers(state).shopCostMultiplier ?? 1));
}

function createRecommendationSave(state) {
  return {
    coins: state.coins,
    pistolUnlocked: true,
    ownedWeapons: [...state.ownedWeapons],
    unlockedWeapons: [...state.ownedWeapons],
    equippedWeaponId: state.equippedWeaponId,
    ownedArmors: [...state.ownedArmors],
    equippedArmorId: state.equippedArmorId,
    ownedGear: [...state.ownedGear],
    grenadeInventory: { ...state.grenadeInventory },
    grenades: state.grenadeInventory?.frag ?? 0,
    activeGrenadeId: GRENADE_DEF_BY_ID.has(state.activeOrdnanceId) ? state.activeOrdnanceId : DEFAULT_GRENADE_TYPE_ID,
    villageLevel: state.villageLevel,
    rescuedVillagers: [...state.rescuedVillagers],
    deadVillagers: [...state.deadVillagers],
  };
}

function normalizePlayCanvasRecommendation(recommendation) {
  if (!recommendation) {
    return null;
  }
  const targetType = recommendation.targetType === "pack" ? "grenade" : recommendation.targetType;
  const targetId = recommendation.targetId === "village-upgrade" ? "village_upgrade" : recommendation.targetId;
  return {
    ...recommendation,
    targetType,
    targetId,
  };
}

function getDiscountedCost(cost, multiplier = 1) {
  return computeDiscountedCost(cost, multiplier);
}

function getEscortDropoff() {
  const townHall = BUILDING_DEF_BY_ID.get("village_townhall");
  return {
    buildingId: "village_townhall",
    x: townHall?.exteriorSpawn?.x ?? 0,
    z: townHall?.exteriorSpawn?.z ?? SLICE_WORLD.villageZ,
    radius: TOWN_HALL_DROPOFF_RADIUS,
  };
}

function distance2d(a, b) {
  return Math.hypot((Number(a?.x) || 0) - (Number(b?.x) || 0), (Number(a?.z) || 0) - (Number(b?.z) || 0));
}

export function getWeaponDef(weaponId) {
  return WEAPON_DEFS.get(weaponId) ?? WEAPON_DEFS.get(STARTING_WEAPON_ID);
}

function getArmorDef(armorId) {
  return ARMOR_DEF_BY_ID.get(armorId) ?? ARMOR_DEF_BY_ID.get(STARTING_ARMOR_ID);
}

function getArmorDamageMultiplier(state) {
  const armor = getArmorDef(state.equippedArmorId);
  const armorReduction = Math.max(0, Number(armor?.damageReduction ?? 0));
  const perkReduction = Math.max(0, Number(getCurrentPerkModifiers(state).damageReductionBonus ?? 0));
  return Math.max(0.25, 1 - armorReduction - perkReduction);
}

function getKillRewardCoins(state, baseReward) {
  const multiplier = Math.max(0, Number(getCurrentPerkModifiers(state).killCoinMultiplier ?? 1));
  return Math.max(0, Math.round((Number(baseReward) || 0) * multiplier));
}

function getEnemyDef(type) {
  if (type === BOSS_DEF.id) {
    return BOSS_DEF;
  }
  if (type === BOSS_WAVE_TYPE_ID) {
    return BOSS_WAVE_DEF;
  }
  return ENEMY_DEFS.get(type) ?? ENEMY_DEFS.get("walker");
}

function damageZombie(state, zombie, rawDamage) {
  if (!zombie || zombie.dead) {
    return { damage: 0, killed: false };
  }
  const def = getEnemyDef(zombie.type);
  const multiplier = Math.max(0.1, Number(def?.damageTakenMultiplier ?? 1));
  const damage = Math.max(1, Math.round(rawDamage * multiplier));
  zombie.hp = Math.max(0, zombie.hp - damage);
  state.lifetimeStats.damageDealt += damage;
  zombie.hitFlashSec = 0.18;
  // Getting shot makes a village-bound zombie turn and come for the player.
  zombie.aggroPlayerSec = PLAYER_AGGRO_ON_HIT_SEC;
  if (zombie.hp > 0) {
    return { damage, killed: false };
  }
  zombie.dead = true;
  state.kills += 1;
  state.totalKills += 1;
  state.lifetimeStats.kills += 1;
  const rewardCoins = getKillRewardCoins(state, zombie.coinReward);
  state.coins += rewardCoins;
  return { damage, killed: true, rewardCoins };
}

function applyBlastDamage(state, primaryZombie, rawDamage, radius) {
  const center = { x: primaryZombie.x, z: primaryZombie.z };
  let hitCount = 0;
  let killCount = 0;
  let primaryDamage = 0;
  for (const zombie of state.zombies) {
    if (zombie.dead) {
      continue;
    }
    const distance = Math.hypot(zombie.x - center.x, zombie.z - center.z);
    if (distance > radius) {
      continue;
    }
    const falloff = Math.max(0.35, 1 - distance / Math.max(1, radius));
    const result = damageZombie(state, zombie, rawDamage * falloff);
    hitCount += 1;
    killCount += result.killed ? 1 : 0;
    if (zombie.id === primaryZombie.id) {
      primaryDamage = result.damage;
    }
  }
  return { hitCount, killCount, primaryDamage, center };
}

function getWeaponAttackProfile(weapon, spreadMult = 1) {
  const applySpread = (cos) => {
    // Widen or tighten the cone based on spread multiplier
    const angle = Math.acos(Math.max(0, Math.min(1, cos)));
    const adjusted = angle * spreadMult;
    return Math.cos(Math.min(Math.PI / 2, adjusted));
  };
  if (weapon.id === "pipe" || weapon.category === "melee") {
    return { range: 2.4, coneCos: 0.25, falloffRange: 2.8, minFalloff: 0.82, maxTargets: 1, damageScale: 1, blastRadius: 0, precise: false };
  }
  if (weapon.id === "shotgun") {
    return { range: 24, coneCos: applySpread(0.88), falloffRange: 30, minFalloff: 0.35, maxTargets: 4, damageScale: 6.4, blastRadius: 0, precise: false };
  }
  if (weapon.id === "flamethrower") {
    return { range: 16, coneCos: applySpread(0.84), falloffRange: 18, minFalloff: 0.55, maxTargets: 7, damageScale: 1.4, blastRadius: 0, precise: false };
  }
  if (weapon.id === "rpg") {
    return { range: 56, coneCos: applySpread(0.988), falloffRange: 80, minFalloff: 0.8, maxTargets: 1, damageScale: 2.55, blastRadius: 7.2, precise: false };
  }
  if (weapon.id === "grenade_launcher") {
    return { range: 48, coneCos: applySpread(0.982), falloffRange: 70, minFalloff: 0.75, maxTargets: 1, damageScale: 2.2, blastRadius: 5.8, precise: false };
  }
  if (weapon.id === "sniper") {
    return { range: 64, coneCos: applySpread(0.992), falloffRange: 110, minFalloff: 0.82, maxTargets: 1, damageScale: 1.15, blastRadius: 0, precise: true, aimForgiveness: 0.1 };
  }
  if (weapon.id === "dmr" || weapon.id === "battle_rifle") {
    return { range: 52, coneCos: applySpread(0.986), falloffRange: 96, minFalloff: 0.78, maxTargets: 1, damageScale: 1.05, blastRadius: 0, precise: true, aimForgiveness: 0.16 };
  }
  if (weapon.id === "smg" || weapon.id === "machine_pistol" || weapon.id === "lmg") {
    return { range: 38, coneCos: applySpread(0.962), falloffRange: 74, minFalloff: 0.64, maxTargets: 1, damageScale: 1, blastRadius: 0, precise: true, aimForgiveness: 0.24 };
  }
  return { range: SLICE_WORLD.fireRange, coneCos: applySpread(SLICE_WORLD.fireConeCos), falloffRange: 90, minFalloff: 0.72, maxTargets: 1, damageScale: 1, blastRadius: 0, precise: true, aimForgiveness: 0.2 };
}

function getWeaponIdentity(weapon) {
  if (weapon.id === "pipe" || weapon.category === "melee") {
    return {
      family: "melee",
      viewModel: "pipe",
      reticle: "melee",
      muzzleFx: "swing",
      shotFx: "arc",
      silhouette: "blunt-pipe",
      recoilKick: 0.08,
    };
  }
  if (weapon.id === "rpg" || weapon.id === "grenade_launcher" || weapon.category === "explosive") {
    return {
      family: "explosive",
      viewModel: "launcher",
      reticle: "blast",
      muzzleFx: "blast",
      shotFx: "blast-orb",
      silhouette: weapon.id === "rpg" ? "tube-launcher" : "break-action-launcher",
      recoilKick: 0.34,
    };
  }
  if (weapon.id === "flamethrower") {
    return {
      family: "flame",
      viewModel: "flamethrower",
      reticle: "flame",
      muzzleFx: "flame",
      shotFx: "flame-plume",
      silhouette: "tank-and-nozzle",
      recoilKick: 0.04,
    };
  }
  if (weapon.id === "shotgun") {
    return {
      family: "scatter",
      viewModel: "shotgun",
      reticle: "spread",
      muzzleFx: "wide-flash",
      shotFx: "pellet-burst",
      silhouette: "pump-shotgun",
      recoilKick: 0.26,
    };
  }
  if (weapon.id === "sniper" || weapon.id === "dmr") {
    return {
      family: "precision",
      viewModel: "precision",
      reticle: "precision",
      muzzleFx: "needle",
      shotFx: "tracer",
      silhouette: weapon.id === "sniper" ? "scoped-long-rifle" : "scoped-dmr",
      recoilKick: weapon.id === "sniper" ? 0.3 : 0.22,
    };
  }
  if (weapon.id === "lmg") {
    return {
      family: "heavy",
      viewModel: "heavy",
      reticle: "heavy",
      muzzleFx: "strobe",
      shotFx: "tracer",
      silhouette: "belt-fed-heavy",
      recoilKick: 0.18,
    };
  }
  if (weapon.id === "smg" || weapon.id === "machine_pistol") {
    return {
      family: "automatic",
      viewModel: "compact",
      reticle: "automatic",
      muzzleFx: "strobe",
      shotFx: "tracer",
      silhouette: weapon.id === "smg" ? "compact-smg" : "machine-pistol",
      recoilKick: 0.12,
    };
  }
  if (weapon.id === "rifle" || weapon.id === "battle_rifle") {
    return {
      family: "rifle",
      viewModel: "rifle",
      reticle: "rifle",
      muzzleFx: "flash",
      shotFx: "tracer",
      silhouette: weapon.id === "battle_rifle" ? "battle-rifle" : "assault-rifle",
      recoilKick: weapon.id === "battle_rifle" ? 0.22 : 0.16,
    };
  }
  return {
    family: "sidearm",
    viewModel: "sidearm",
    reticle: "sidearm",
    muzzleFx: weapon.id === "revolver" ? "heavy-flash" : "flash",
    shotFx: "spark",
    silhouette: weapon.id === "revolver" ? "revolver" : "service-pistol",
    recoilKick: weapon.id === "revolver" ? 0.2 : 0.12,
  };
}

// Where a clean miss meets the terrain, so the FX layer can kick up dirt at a
// believable down-range point. Pitch convention: positive = looking up,
// negative = looking down (camera forward.y = sin(pitch)).
function resolvePlayCanvasGroundMiss(state, profile) {
  const range = Math.max(4, profile?.range ?? SLICE_WORLD.fireRange);
  const eyeHeight = state.player?.crouching ? 1.3 : 1.62;
  const downDeg = Math.max(0, -(state.player?.pitch ?? 0));
  let impactDistance;
  if (downDeg < 0.5) {
    // Level or upward shot — round carries down-range before meeting terrain.
    impactDistance = range;
  } else {
    const slant = eyeHeight / Math.sin((downDeg * Math.PI) / 180);
    impactDistance = clamp(slant, 4, range);
  }
  return { impactDistance, materialId: "soil" };
}

function resolvePlayCanvasStructureShot(state, weapon, profile, forward) {
  const target = getBestStructureShotTarget(state, profile, forward);
  if (!target) {
    return null;
  }
  const brokenWindows = new Set(state.brokenWindowIds ?? []);
  const isWindow = target.kind === "window";
  const windowShattered = isWindow && !brokenWindows.has(target.id);
  if (windowShattered) {
    brokenWindows.add(target.id);
    state.brokenWindowIds = [...brokenWindows];
  }
  const materialId = windowShattered ? "glass" : target.materialId;
  return recordPlayCanvasStructureImpact(state, {
    target,
    materialId,
    windowId: isWindow ? target.id : null,
    windowShattered,
    projectileDamage: Math.max(1, weapon.damage * (profile.damageScale ?? 1)),
    weaponCategory: weapon.category,
    weaponId: weapon.id,
  });
}

function resolvePlayCanvasBlastImpact(state, def, center) {
  const brokenWindows = new Set(state.brokenWindowIds ?? []);
  const candidates = [...BREAKABLE_WINDOW_DEFS, ...STRUCTURE_IMPACT_DEFS]
    .map((target) => ({ target, distance: Math.hypot(target.x - center.x, target.z - center.z) }))
    .filter((entry) => entry.distance <= Math.max(1, def.radius))
    .sort((a, b) => a.distance - b.distance);
  const target = candidates[0]?.target ?? null;
  if (!target) {
    return null;
  }
  const isWindow = target.kind === "window";
  const windowShattered = isWindow && !brokenWindows.has(target.id);
  if (windowShattered) {
    brokenWindows.add(target.id);
    state.brokenWindowIds = [...brokenWindows];
  }
  const materialId = windowShattered ? "glass" : target.materialId;
  return recordPlayCanvasStructureImpact(state, {
    target,
    materialId,
    windowId: isWindow ? target.id : null,
    windowShattered,
    projectileDamage: def.damage,
    weaponCategory: "explosive",
    weaponId: def.id,
  });
}

function getBestStructureShotTarget(state, profile, forward) {
  const range = Math.max(0, profile.range ?? SLICE_WORLD.fireRange);
  if (range <= 0) {
    return null;
  }
  const brokenWindows = new Set(state.brokenWindowIds ?? []);
  const windowCandidates = BREAKABLE_WINDOW_DEFS.map((target) => ({
    target,
    priority: brokenWindows.has(target.id) ? 0 : 2,
    ...scoreRayTarget(state, target, forward, range),
  })).filter((entry) => entry.ok);
  const structureCandidates = STRUCTURE_IMPACT_DEFS.map((target) => ({
    target,
    priority: 1,
    ...scoreRayTarget(state, target, forward, range),
  })).filter((entry) => entry.ok);
  return [...windowCandidates, ...structureCandidates]
    .sort((a, b) => b.priority - a.priority || b.dot - a.dot || a.distance - b.distance)[0]?.target ?? null;
}

function scoreRayTarget(state, target, forward, range) {
  const dx = target.x - state.player.x;
  const dz = target.z - state.player.z;
  const distance = Math.hypot(dx, dz);
  if (distance <= 0.001 || distance > range) {
    return { ok: false, distance, dot: -1 };
  }
  const dot = (dx / distance) * forward.forwardX + (dz / distance) * forward.forwardZ;
  const coneCos = target.kind === "window" ? Math.max(0.94, (SLICE_WORLD.fireConeCos ?? 0.976) - 0.035) : 0.965;
  const missRadius = Math.sqrt(Math.max(0, 1 - dot * dot)) * distance;
  const hitRadius = target.hitRadius ?? (target.kind === "window" ? 0.82 : 1.5);
  return {
    ok: dot >= coneCos && missRadius <= hitRadius,
    distance,
    dot,
  };
}

function recordPlayCanvasStructureImpact(state, details) {
  const potentialVillageDamage = computeVillageStructureDamage({
    projectileDamage: details.projectileDamage,
    weaponCategory: details.weaponCategory,
    materialId: details.materialId,
    windowShattered: details.windowShattered,
  });
  const appliedVillageDamage = FRIENDLY_FIRE_VILLAGE_DAMAGE ? potentialVillageDamage : 0;
  if (appliedVillageDamage > 0) {
    state.villageHp = Math.max(0, state.villageHp - appliedVillageDamage);
    state.lifetimeStats.villageDamageTaken += Math.round(appliedVillageDamage);
  }

  state.structureHits = (state.structureHits ?? 0) + 1;
  state.potentialVillageDamage = Number(((state.potentialVillageDamage ?? 0) + potentialVillageDamage).toFixed(2));
  state.appliedVillageDamage = Number(((state.appliedVillageDamage ?? 0) + appliedVillageDamage).toFixed(2));

  const event = {
    id: `impact-${state.nextImpactSeq++}`,
    materialId: details.materialId,
    x: details.target.x,
    y: details.target.y ?? 1.25,
    z: details.target.z,
    ttlSec: IMPACT_EVENT_TTL_SEC,
    windowId: details.windowId ?? null,
    windowShattered: Boolean(details.windowShattered),
    weaponId: details.weaponId,
    potentialVillageDamage,
    appliedVillageDamage,
  };
  state.lastImpactEvent = {
    id: event.id,
    materialId: event.materialId,
    x: event.x,
    y: event.y,
    z: event.z,
    windowId: event.windowId,
    windowShattered: event.windowShattered,
    weaponId: event.weaponId,
    potentialVillageDamage,
    appliedVillageDamage,
  };
  state.impactEvents = [...(state.impactEvents ?? []), event].slice(-MAX_ACTIVE_IMPACT_EVENTS);
  return { ...state.lastImpactEvent };
}

function stepImpactEvents(state, dt) {
  if (!state.impactEvents?.length) {
    return;
  }
  for (const event of state.impactEvents) {
    event.ttlSec -= dt;
  }
  state.impactEvents = state.impactEvents.filter((event) => event.ttlSec > 0);
}

function getAvailableOrdnanceIds(state) {
  const grenadeIds = GRENADE_TYPE_DEFS.map((grenade) => grenade.id).filter((id) => (state.grenadeInventory[id] ?? 0) > 0);
  const specialIds = [];
  if (state.c4Count > 0) {
    specialIds.push(C4_DEF.id);
  }
  if (state.nukeCount > 0) {
    specialIds.push(NUKE_DEF.id);
  }
  return [...grenadeIds, ...specialIds];
}

function normalizeActiveOrdnance(activeId, grenadeInventory, c4Count, nukeCount) {
  const probe = {
    grenadeInventory: grenadeInventory ?? normalizeGrenadeInventory(null, 5),
    c4Count: Math.max(0, Math.round(Number(c4Count ?? 0))),
    nukeCount: Math.max(0, Math.round(Number(nukeCount ?? 0))),
  };
  const ids = getAvailableOrdnanceIds(probe);
  return ids.includes(activeId) ? activeId : ids[0] ?? DEFAULT_GRENADE_TYPE_ID;
}

function getActiveOrdnanceDef(state) {
  if (state.activeOrdnanceId === C4_DEF.id) {
    return C4_DEF;
  }
  if (state.activeOrdnanceId === NUKE_DEF.id) {
    return NUKE_DEF;
  }
  return GRENADE_DEF_BY_ID.get(state.activeOrdnanceId) ?? GRENADE_DEF_BY_ID.get(DEFAULT_GRENADE_TYPE_ID);
}

function getOrdnanceCount(state, ordnanceId) {
  if (ordnanceId === C4_DEF.id) {
    return state.c4Count;
  }
  if (ordnanceId === NUKE_DEF.id) {
    return state.nukeCount;
  }
  return state.grenadeInventory[ordnanceId] ?? 0;
}

function consumeOrdnance(state, ordnanceId) {
  if (ordnanceId === C4_DEF.id) {
    state.c4Count = Math.max(0, state.c4Count - 1);
  } else if (ordnanceId === NUKE_DEF.id) {
    state.nukeCount = Math.max(0, state.nukeCount - 1);
  } else {
    state.grenadeInventory[ordnanceId] = Math.max(0, (state.grenadeInventory[ordnanceId] ?? 0) - 1);
  }
}

function getBlastCenter(state, def) {
  if (def.id === NUKE_DEF.id) {
    return { x: 0, z: SLICE_WORLD.villageZ - 12 };
  }
  let best = null;
  for (const zombie of state.zombies) {
    if (zombie.dead) {
      continue;
    }
    const distance = Math.hypot(zombie.x - state.player.x, zombie.z - state.player.z);
    if (!best || distance < best.distance) {
      best = { x: zombie.x, z: zombie.z, distance };
    }
  }
  if (best) {
    return best;
  }
  return {
    x: state.player.x - Math.sin(state.player.yaw) * 10,
    z: state.player.z - Math.cos(state.player.yaw) * 10,
  };
}

function getOrdnanceLabel(ordnanceId) {
  if (ordnanceId === C4_DEF.id) {
    return C4_DEF.label;
  }
  if (ordnanceId === NUKE_DEF.id) {
    return NUKE_DEF.label;
  }
  return GRENADE_DEF_BY_ID.get(ordnanceId)?.label ?? ordnanceId;
}

function buyCountPack(state, pack, type) {
  const unlockWave = Math.max(1, Math.round(Number(pack.unlockWave ?? 1)));
  if (state.waveNumber < unlockWave) {
    state.lastMessage = `${pack.label} unlocks at wave ${unlockWave}.`;
    return { ok: false, reason: "locked" };
  }
  const cost = getDiscountedCost(pack.cost, getShopCostMultiplier(state));
  if (state.coins < cost) {
    state.lastMessage = `Need ${cost - state.coins} more coins for ${pack.label}.`;
    return { ok: false, reason: "coins" };
  }
  state.coins -= cost;
  state.coins = Math.max(0, state.coins);
  if (type === "grenade") {
    const grenadeTypeId = pack.grenadeTypeId ?? DEFAULT_GRENADE_TYPE_ID;
    state.grenadeInventory[grenadeTypeId] = Math.max(0, (state.grenadeInventory[grenadeTypeId] ?? 0) + pack.amount);
    state.activeOrdnanceId = grenadeTypeId;
  } else if (type === "c4") {
    state.c4Count += pack.amount;
    state.activeOrdnanceId = C4_DEF.id;
  } else if (type === "nuke") {
    state.nukeCount += pack.amount;
    state.activeOrdnanceId = NUKE_DEF.id;
  }
  state.lastMessage = `${pack.label} purchased.`;
  persistPlayCanvasSave(state);
  return { ok: true };
}

function getPackShopItems(packs, state, nextWave, type) {
  return (packs ?? []).map((pack) => {
    const unlockWave = Math.max(1, Math.round(Number(pack.unlockWave ?? 1)));
    const unlocked = nextWave >= unlockWave;
    const cost = getDiscountedCost(pack.cost, getShopCostMultiplier(state));
    const affordable = state.coins >= cost;
    const detail = type === "grenade"
      ? `${GRENADE_DEF_BY_ID.get(pack.grenadeTypeId ?? DEFAULT_GRENADE_TYPE_ID)?.shortLabel ?? "Grenade"} +${pack.amount}`
      : `${type.toUpperCase()} +${pack.amount}`;
    return {
      type,
      id: pack.id,
      label: pack.label,
      cost,
      unlockWave,
      owned: false,
      equipped: false,
      unlocked,
      affordable,
      disabled: !unlocked || !affordable,
      status: unlocked ? `${cost} coins` : `Wave ${unlockWave}`,
      detail,
    };
  });
}

function getGrenadePackItems(state, nextWave) {
  return getPackShopItems(economyConfig.grenadePacks, state, nextWave, "grenade");
}

function getC4PackItems(state, nextWave) {
  return getPackShopItems(economyConfig.c4Packs, state, nextWave, "c4");
}

function getNukePackItems(state, nextWave) {
  return getPackShopItems(economyConfig.nukePacks, state, nextWave, "nuke");
}

function normalizeVillageLevel(value) {
  const maxLevel = Math.max(1, Number(VILLAGE_UPGRADE.maxLevel ?? 8));
  const parsed = Math.round(Number(value ?? 1));
  return Number.isFinite(parsed) ? clamp(parsed, 1, maxLevel) : 1;
}

function getVillageMaxHp(level, modifiers = {}) {
  const hpPerLevel = Math.max(0, Number(VILLAGE_UPGRADE.hpPerLevel ?? 0.08));
  const perkMultiplier = Math.max(0.1, Number(modifiers?.villageHpMultiplier ?? 1));
  return Math.round(100 * perkMultiplier * (1 + (normalizeVillageLevel(level) - 1) * hpPerLevel));
}

function getVillageUpgradeCost(level) {
  const baseCost = Math.max(1, Math.round(Number(VILLAGE_UPGRADE.baseCost ?? 180)));
  const costGrowth = Math.max(1, Number(VILLAGE_UPGRADE.costGrowth ?? 1.45));
  return Math.round(baseCost * Math.pow(costGrowth, Math.max(0, normalizeVillageLevel(level) - 1)));
}

function getVillageUpgradeItem(state) {
  const maxLevel = Math.max(1, Math.round(Number(VILLAGE_UPGRADE.maxLevel ?? 8)));
  const level = normalizeVillageLevel(state.villageLevel);
  const atMax = level >= maxLevel;
  const nextLevel = atMax ? level : level + 1;
  const cost = atMax ? 0 : getDiscountedCost(getVillageUpgradeCost(level), getShopCostMultiplier(state));
  const affordable = !atMax && state.coins >= cost;
  const modifiers = getCurrentPerkModifiers(state);
  return {
    type: "village",
    id: "village_upgrade",
    label: VILLAGE_UPGRADE.label ?? "Town Defenses",
    cost,
    level,
    nextLevel,
    maxLevel,
    atMax,
    owned: true,
    equipped: false,
    unlocked: true,
    affordable,
    disabled: atMax || !affordable,
    status: atMax ? "Maxed" : `${cost} coins`,
    detail: atMax
      ? `Level ${level}/${maxLevel} · ${getVillageMaxHp(level, modifiers)} HP`
      : `Level ${level}->${nextLevel} · ${getVillageMaxHp(nextLevel, modifiers)} HP`,
  };
}

function getMedKitItem(state) {
  const atFullHealth = state.playerHp >= state.maxPlayerHp - 0.001;
  const affordable = state.coins >= MED_KIT_COST;
  return {
    type: "medkit",
    id: "medkit",
    label: economyConfig.medKit?.label ?? "Med Kit",
    cost: MED_KIT_COST,
    owned: false,
    equipped: false,
    unlocked: true,
    affordable,
    atFullHealth,
    disabled: atFullHealth || !affordable,
    status: atFullHealth ? "Full Health" : `${MED_KIT_COST} coins`,
    detail: `Restore to ${state.maxPlayerHp} HP`,
  };
}

function getGearShopItems(state, nextWave) {
  return GEAR_DEFS.map((gear) => {
    const unlockWave = Math.max(1, Math.round(Number(gear.unlockWave ?? 1)));
    const owned = state.ownedGear.includes(gear.id);
    const unlocked = nextWave >= unlockWave;
    const cost = getDiscountedCost(gear.cost, getShopCostMultiplier(state));
    const affordable = state.coins >= cost;
    return {
      type: "gear",
      id: gear.id,
      label: gear.label,
      cost,
      unlockWave,
      owned,
      equipped: owned,
      unlocked,
      affordable,
      disabled: owned || !unlocked || !affordable,
      status: owned ? "Owned" : unlocked ? `${cost} coins` : `Wave ${unlockWave}`,
      detail: gear.description ?? "Utility gear",
    };
  });
}

function createBreakableWindowDefs() {
  const bellZ = SLICE_WORLD.villageZ - 12;
  const windows = [
    {
      id: "bell-window",
      kind: "window",
      materialId: "wood",
      x: 0,
      y: 3.2,
      z: bellZ - 1.43,
      hitRadius: 0.9,
    },
  ];
  const houses = [
    [-9.5, SLICE_WORLD.villageZ - 10, 5.8, 3.2, 5.8],
    [9.4, SLICE_WORLD.villageZ - 8.8, 5.6, 3.0, 5.4],
    [-13.2, SLICE_WORLD.villageZ - 1, 6.4, 3.5, 5.2],
    [13.4, SLICE_WORLD.villageZ + 0.2, 6.2, 3.4, 5.4],
    [-15.4, SLICE_WORLD.villageZ + 12.6, 7.2, 3.7, 6.8],
    [15.8, SLICE_WORLD.villageZ + 12.2, 7.4, 3.8, 7.0],
  ];
  houses.forEach(([x, z, sx, sy, sz], index) => {
    const side = Math.sign(x) || 1;
    windows.push(
      {
        id: `house-${index}-window-a`,
        kind: "window",
        materialId: "wood",
        x: x - side * sx * 0.22,
        y: sy * 0.78,
        z: z + sz / 2 + 0.09,
        hitRadius: 0.82,
      },
      {
        id: `house-${index}-window-b`,
        kind: "window",
        materialId: "wood",
        x: x + side * sx * 0.35,
        y: sy * 0.62,
        z: z + sz / 2 + 0.09,
        hitRadius: 0.68,
      },
    );
  });
  return windows;
}

function createStructureImpactDefs() {
  const defs = [
    {
      id: "bell-tower-base",
      kind: "structure",
      materialId: "concrete",
      x: 0,
      y: 2.4,
      z: SLICE_WORLD.villageZ - 12,
      hitRadius: 1.9,
    },
  ];
  const houses = [
    [-9.5, SLICE_WORLD.villageZ - 10, 5.8, 3.2, 5.8],
    [9.4, SLICE_WORLD.villageZ - 8.8, 5.6, 3.0, 5.4],
    [-13.2, SLICE_WORLD.villageZ - 1, 6.4, 3.5, 5.2],
    [13.4, SLICE_WORLD.villageZ + 0.2, 6.2, 3.4, 5.4],
    [-15.4, SLICE_WORLD.villageZ + 12.6, 7.2, 3.7, 6.8],
    [15.8, SLICE_WORLD.villageZ + 12.2, 7.4, 3.8, 7.0],
  ];
  houses.forEach(([x, z, sx, sy, sz], index) => {
    defs.push({
      id: `house-${index}-body`,
      kind: "structure",
      materialId: "wood",
      x,
      y: sy * 0.58,
      z: z + sz / 2 + 0.08,
      hitRadius: Math.max(1.35, sx * 0.34),
    });
  });
  for (let x = -6; x <= 6; x += 2) {
    defs.push({
      id: `barricade-${x}`,
      kind: "structure",
      materialId: "wood",
      x,
      y: 0.65,
      z: SLICE_WORLD.villageZ + 3.2,
      hitRadius: 0.9,
    });
  }
  return defs;
}

function createTransformableLandscapeDefs() {
  const defs = [];
  for (let i = 0; i < 32; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const z = 18 - i * 2.65;
    const x = side * (11.5 + Math.sin(i * 1.7) * 4.4);
    defs.push({
      id: `landscape-${i}`,
      visualId: i % 3 === 0 ? `pine-${i}` : `tree-${i}`,
      kind: i % 3 === 0 ? "pine" : "tree",
      x,
      z,
    });
  }
  return defs;
}

function nextRandom(state) {
  state.randomState = (state.randomState * 1664525 + 1013904223) >>> 0;
  return state.randomState / 0x100000000;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
