import * as pc from "playcanvas";
import { createZombieRig, animateZombieRig, applyZombieRigMaterials } from "./zombieRig";
import { loadZombieGlbContainer, createZombieGlbEntity, animateZombieGlbEntity } from "./zombieGlb";
import {
  loadVillagerGlbContainers,
  createVillagerGlbEntity,
  animateVillagerGlbEntity,
} from "./villagerGlb";
import buildingsConfig from "../fps/config/buildings_fps.json";
import qualityProfiles from "../fps/config/quality_profiles.json";
import { Audio3D } from "../fps/systems/audio3d";
import { worldRadiusToMiniMapPx, worldToMiniMapPoint } from "../fps/systems/minimapUtils";
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
  getPlayCanvasBossSnapshot,
  getPlayCanvasImpactSnapshot,
  getPlayCanvasMiniMapSnapshot,
  getPlayCanvasBuildingSnapshot,
  getPlayCanvasGuidanceSnapshot,
  getPlayCanvasAudioSnapshot,
  getPlayCanvasWeaponSnapshot,
  getPlayCanvasVillagerSnapshot,
  getShopItems,
  getWeaponDef,
  interactWithPlayCanvasWorld,
  reloadSliceWeapon,
  restartCampaign,
  resetSlice,
  revivePlayer,
  setPlayCanvasAudioSettings,
  setPlayerAds,
  SLICE_WORLD,
  startSlice,
  stepSlice,
  useOrdnance,
  useFlintAndSteel,
  getPlayCanvasSummaryOffers,
  getPlayCanvasGameOverOffers,
  applyPlayCanvasRewardedOffer,
  getGoalsSnapshot,
} from "./sliceSimulation";
import { showRewardedAd } from "../fps/systems/rewardedAds";
import "./playcanvas.css";

const MINIMAP_SIZE_PX = 180;
const MINIMAP_PADDING_PX = 10;

const WEAPON_SLOT_BINDINGS = [
  { code: "Digit1", id: "pistol" },
  { code: "Digit2", id: "revolver" },
  { code: "Digit3", id: "machine_pistol" },
  { code: "Digit4", id: "smg" },
  { code: "Digit5", id: "rifle" },
  { code: "Digit6", id: "battle_rifle" },
  { code: "Digit7", id: "shotgun" },
  { code: "Digit8", id: "dmr" },
  { code: "Digit9", id: "sniper" },
  { code: "Digit0", id: "lmg" },
  { code: "Minus", id: "rpg" },
  { code: "Equal", id: "grenade_launcher" },
  { code: "BracketRight", id: "flamethrower" },
  { code: "Backquote", id: "pipe" },
];

// Sky/backdrop materials that should not receive scene fog
const NO_FOG_MATERIALS = new Set(["skyBand", "cloud", "cloudDark", "moon", "moonHalo", "moonPool"]);

const MATERIALS = {
  skyBand: { diffuse: [0.05, 0.18, 0.34], emissive: [0.035, 0.12, 0.24], roughness: 1 },
  cloud: { diffuse: [0.30, 0.48, 0.72], emissive: [0.10, 0.20, 0.34], roughness: 0.92 },
  cloudDark: { diffuse: [0.055, 0.13, 0.22], emissive: [0.012, 0.035, 0.07], roughness: 0.96 },
  ground: { diffuse: [0.1, 0.15, 0.11], emissive: [0.008, 0.014, 0.01], roughness: 0.94 },
  grassDark: { diffuse: [0.055, 0.12, 0.09], emissive: [0.006, 0.014, 0.012], roughness: 0.96 },
  road: { diffuse: [0.19, 0.13, 0.09], emissive: [0.014, 0.01, 0.008], roughness: 0.76 },
  wetRoad: { diffuse: [0.12, 0.11, 0.1], emissive: [0.06, 0.1, 0.14], roughness: 0.22 },
  mudHighlight: { diffuse: [0.34, 0.23, 0.14], emissive: [0.06, 0.038, 0.018], roughness: 0.55 },
  pathEdge: { diffuse: [0.3, 0.26, 0.2], emissive: [0.024, 0.02, 0.014], roughness: 0.9 },
  wood: { diffuse: [0.42, 0.27, 0.15], emissive: [0.022, 0.014, 0.008], roughness: 0.82 },
  timber: { diffuse: [0.22, 0.13, 0.07], emissive: [0.014, 0.009, 0.005], roughness: 0.84 },
  houseWall: { diffuse: [0.5, 0.42, 0.34], emissive: [0.022, 0.018, 0.014], roughness: 0.9 },
  roof: { diffuse: [0.2, 0.08, 0.06], emissive: [0.012, 0.004, 0.003], roughness: 0.88 },
  roofDark: { diffuse: [0.16, 0.11, 0.11], emissive: [0.01, 0.009, 0.01], roughness: 0.82 },
  doorSafe: { diffuse: [0.72, 0.34, 0.12], emissive: [0.14, 0.06, 0.018], roughness: 0.65 },
  windowGlow: { diffuse: [1, 0.72, 0.32], emissive: [2.2, 0.95, 0.28], roughness: 0.22 },
  lantern: { diffuse: [1, 0.66, 0.26], emissive: [2.8, 1.15, 0.32], roughness: 0.22 },
  moonPool: { diffuse: [0.55, 0.72, 1], emissive: [0.03, 0.05, 0.12], roughness: 0.35, opacity: 0.28 },
  moon: { diffuse: [0.78, 0.9, 1], emissive: [0.95, 1.18, 1.55], roughness: 0.42 },
  fog: { diffuse: [0.3, 0.46, 0.68], emissive: [0.04, 0.07, 0.14], roughness: 1, opacity: 0.28 },
  zombie: { diffuse: [0.24, 0.19, 0.15], emissive: [0.01, 0.008, 0.006], roughness: 0.86 },
  runner: { diffuse: [0.28, 0.21, 0.16], emissive: [0.012, 0.009, 0.007], roughness: 0.82 },
  zombieHit: { diffuse: [0.96, 0.58, 0.18], emissive: [1.35, 0.48, 0.08], roughness: 0.58 },
  brute: { diffuse: [0.18, 0.14, 0.12], emissive: [0.008, 0.006, 0.005], roughness: 0.88 },
  zombieShirt: { diffuse: [0.28, 0.12, 0.09], emissive: [0.018, 0.006, 0.004], roughness: 0.9 },
  // Articulated rig materials — moonlit pale-green flesh, faint cool emissive for distance read
  zombieFlesh: { diffuse: [0.26, 0.34, 0.24], emissive: [0.04, 0.065, 0.05], roughness: 0.85 },
  runnerFlesh: { diffuse: [0.29, 0.35, 0.23], emissive: [0.045, 0.07, 0.05], roughness: 0.85 },
  bruteFlesh: { diffuse: [0.21, 0.26, 0.20], emissive: [0.032, 0.05, 0.04], roughness: 0.85 },
  zombieEye: { diffuse: [1, 0.92, 0.55], emissive: [14.0, 8.0, 1.2], roughness: 0.04 },
  // Eye corona — larger translucent additive sphere around each eye.
  // Provides a wide emissive seed for CameraFrame bloom; also reads as a warm
  // halo on hardware where bloom is disabled (mobile_low / SwiftShader).
  zombieEyeCorona: { diffuse: [1, 0.72, 0.2], emissive: [3.5, 1.8, 0.25], roughness: 1, opacity: 0.28, blend: "additive" },
  zombiePants: { diffuse: [0.10, 0.11, 0.14], emissive: [0.030, 0.036, 0.064], roughness: 0.92 },
  zombieBoots: { diffuse: [0.09, 0.07, 0.06], emissive: [0.018, 0.014, 0.012], roughness: 0.95 },
  zombieShirtRed: { diffuse: [0.32, 0.10, 0.07], emissive: [0.10, 0.022, 0.012], roughness: 0.9 },
  zombieShirtOlive: { diffuse: [0.28, 0.27, 0.15], emissive: [0.095, 0.090, 0.040], roughness: 0.9 },
  zombieShirtGrey: { diffuse: [0.20, 0.20, 0.22], emissive: [0.068, 0.068, 0.076], roughness: 0.9 },
  clothBlue: { diffuse: [0.18, 0.29, 0.42], emissive: [0.02, 0.035, 0.06], roughness: 0.86 },
  healthBack: { diffuse: [0.08, 0.09, 0.1], emissive: [0.01, 0.01, 0.012], roughness: 0.72 },
  healthFill: { diffuse: [0.55, 0.95, 0.38], emissive: [0.16, 0.38, 0.08], roughness: 0.52 },
  pumpkin: { diffuse: [0.98, 0.42, 0.08], emissive: [0.38, 0.12, 0.015], roughness: 0.68 },
  pine: { diffuse: [0.06, 0.14, 0.1], emissive: [0.005, 0.016, 0.016], roughness: 0.92 },
  stone: { diffuse: [0.45, 0.42, 0.36], emissive: [0.035, 0.035, 0.035], roughness: 0.86 },
  stoneDark: { diffuse: [0.3, 0.29, 0.26], emissive: [0.018, 0.018, 0.016], roughness: 0.9 },
  moonHalo: { diffuse: [0.58, 0.72, 1], emissive: [0.08, 0.14, 0.28], roughness: 1, opacity: 0.18 },
  groundMist: { diffuse: [0.32, 0.44, 0.64], emissive: [0.06, 0.11, 0.20], roughness: 1, opacity: 0.16 },
  metal: { diffuse: [0.46, 0.5, 0.5], emissive: [0.025, 0.032, 0.035], roughness: 0.42, metalness: 0.25 },
  // Task 2: brightened for edge readability at night
  blackMetal: { diffuse: [0.07, 0.082, 0.10], emissive: [0.008, 0.010, 0.015], roughness: 0.36, metalness: 0.55 },
  rail: { diffuse: [0.12, 0.13, 0.155], emissive: [0.014, 0.016, 0.022], roughness: 0.32, metalness: 0.5 },
  // Task 2: accent material for sights/slide-tops
  gunmetalLight: { diffuse: [0.18, 0.20, 0.24], emissive: [0.018, 0.020, 0.026], roughness: 0.35, metalness: 0.4 },
  // Task 3: hand/arm materials
  glove: { diffuse: [0.10, 0.095, 0.09], emissive: [0.006, 0.006, 0.005], roughness: 0.9 },
  sleeve: { diffuse: [0.16, 0.17, 0.12], emissive: [0.010, 0.011, 0.008], roughness: 0.95 },
  muzzle: { diffuse: [1, 0.88, 0.44], emissive: [2.2, 1.4, 0.25], roughness: 0.18 },
  impactGlass: { diffuse: [0.72, 0.92, 1], emissive: [0.5, 0.8, 1.15], roughness: 0.18, opacity: 0.7 },
  impactWood: { diffuse: [0.86, 0.48, 0.22], emissive: [0.28, 0.09, 0.025], roughness: 0.7 },
  impactConcrete: { diffuse: [0.66, 0.64, 0.58], emissive: [0.16, 0.14, 0.12], roughness: 0.88 },
  impactSoil: { diffuse: [0.42, 0.28, 0.18], emissive: [0.08, 0.045, 0.02], roughness: 0.94 },
};

export class PlayCanvasZombieSlice {
  constructor(root) {
    this.root = root;
    this.state = createSliceState();
    this.audio = new Audio3D(null);
    this.audio.setMusicEnabled(this.state.musicEnabled);
    this.audio.setSfxEnabled(this.state.sfxEnabled);
    this.audioDamagePulseSec = 0;
    this.audioPlayerDamagePulseSec = 0;
    this.lastAudioVillageHp = this.state.villageHp;
    this.lastAudioPlayerHp = this.state.playerHp;
    this.lastAudioCueId = "";
    this.input = {
      forward: 0,
      back: 0,
      left: 0,
      right: 0,
      sprint: false,
      crouch: false,
      jump: false,
      ads: false,
      pointerLocked: false,
      dragLooking: false,
      lastPointerX: 0,
      lastPointerY: 0,
      // Right-zone touch look (mobile only)
      lookTouch: null,   // { id, startX, startY, curX, curY }
      lookVelX: 0,       // smoothed look velocity (px/frame equivalent)
      lookVelY: 0,
    };
    this.playerDamageFlashSec = 0;
    this.villageDamageFlashSec = 0;
    this.recoilPitchOffset = 0;
    this.recoilRecoverySec = 0;
    this.summaryDisplaySec = 0;
    this.lastSummaryWave = -1;
    this.entitiesByZombie = new Map();
    this.entitiesByVillager = new Map();
    this.entitiesByLandscape = new Map();
    this.entitiesByWindow = new Map();
    this.entitiesByImpact = new Map();
    this.fx = [];
    // ?fxslow=1 — stretches shot-FX lifetimes 10x for screenshot capture; always off in prod
    this.fxSlowMo = new URLSearchParams(globalThis.location?.search ?? "").get("fxslow") === "1";
    // Pooled shot-FX subsystem — no per-shot heap allocations after warmup
    this.shotFx = { flashes: [], tracers: [], bursts: [] };
    this.sceneRandom = createSeededRandom(20260603);
    this.yaw = 0;
    this.pitch = -6;
    this.shopOpen = false;
    this.minimapOpen = true;
    this.lastRenderedPhase = null;
    this.minimapStructures = [];

    // GLB zombie flag — GLB is the DEFAULT.  Pass ?glb=0 to opt out to the procedural rig.
    // Until the container finishes loading (or if it fails), zombies use the procedural rig
    // automatically — glbContainer stays null and createZombieEntity falls back gracefully.
    this.useGlbZombies = new URLSearchParams(globalThis.location?.search ?? "").get("glb") !== "0";
    /** @type {pc.Asset|null} */
    this.glbContainer = null;

    // Villager GLB containers — loaded once alongside zombie GLB.
    // villagerGlbContainers stays null until both (or at least one) model loads.
    // createVillagerEntity falls back to primitive rig when null.
    /** @type {{man: pc.Asset|null, woman: pc.Asset|null}|null} */
    this.villagerGlbContainers = null;

    // ── Juice layer state ────────────────────────────────────────────────────
    // Screen shake — trauma^2 model, decays each frame
    this._shakeTrauma = 0;
    this._shakeCounter = 0; // incremented each frame for pseudo-noise variety
    this._reducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // Kill-streak tracking
    this._streakCount = 0;
    this._streakLastKillTime = 0;
    this._streakTimeoutMs = 3000; // reset streak if >3s between kills
    // Haptics
    this.hapticsEnabled = typeof localStorage !== "undefined"
      ? localStorage.getItem("zi_haptics") !== "false"
      : true;
    // Coin tracking for kill floater delta
    this._lastCoinsDelta = 0;
    this._lastKnownCoins = 0;
    // Low-HP vignette tracking
    this._vignetteActive = false;
    // ── Audio cue state ────────────────────────────────────────────────────────
    // Heartbeat: time-since-last-beat (drives the slow 2-thump loop)
    this._heartbeatPhaseSec = 0;
    this._heartbeatActive = false;
    // Reload state tracking (to detect start / finish transitions)
    this._wasReloading = false;
    // Ambient night bed
    this._nightBedTimerId = null;
    this._nightBedPhase = 0;   // index into evolving pad sequence
    this._nightBedRunning = false;
    // SFX call counters (verification only — no overhead at runtime)
    this._sfxCallCounts = {
      hitConfirm: 0, kill: 0, headshot: 0, streak: 0,
      reloadStart: 0, reloadFinish: 0, empty: 0,
      coin: 0, playerDamage: 0, heartbeat: 0, uiClick: 0, nightBedStart: 0,
    };

    // ── Village-distress visual state ──────────────────────────────────────────
    // Smoothed HP ratio (0–1); drives all staged visuals.  Initialised to 1 (pristine).
    this._villageDistressRatio = 1;
    // Per-window cloned material instances so we can dim them independently of
    // the shared MATERIALS.windowGlow entry.  Populated in _initVillageDistress().
    this._windowGlowMats = [];           // Array<{ entity, mat: pc.StandardMaterial }>
    // Pooled smoke column entities — lazy-created, capped at DISTRESS_SMOKE_CAP.
    this._distressSmokePool = [];
    // Red danger omni light near the village (active below ~20% HP).
    this._distressDangerLight = null;
    // Ember glow at village base (active below ~55%).
    this._distressEmberLight = null;

    this.buildDom();
    this.createApp();
    this.createMaterials();
    this.createScene();
    this._initCameraFrame();
    this._initVillageDistress();

    // Kick off GLB container loads asynchronously — never blocks startup.
    // Zombie and villager GLB loads run in parallel (both are ~1MB assets).
    if (this.useGlbZombies) {
      loadZombieGlbContainer(this.app).then((asset) => {
        this.glbContainer = asset;
        if (asset) {
          console.log("[PlayCanvas] GLB zombie container ready.");
        } else {
          console.warn("[PlayCanvas] GLB container load failed — falling back to procedural rig.");
        }
      });

      // Villager GLB load — primitive fallback until containers resolve
      loadVillagerGlbContainers(this.app).then((containers) => {
        const anyLoaded = containers.man || containers.woman;
        if (anyLoaded) {
          this.villagerGlbContainers = containers;
          console.log("[PlayCanvas] Villager GLB containers ready (man:", !!containers.man, "woman:", !!containers.woman, ").");
        } else {
          console.warn("[PlayCanvas] Villager GLB load failed — using primitive villager fallback.");
        }
      });
    }

    this.attachInput();
    this.exposeAutomationHooks();
    this.updateAudioState(0, { force: true });
    this.updateMiniMapVisibility();
    this.updateHud();
  }

  buildDom() {
    this.root.innerHTML = `
      <div class="pc-slice">
        <canvas class="pc-slice-canvas" aria-label="PlayCanvas zombie invasion prototype"></canvas>
        <div class="pc-slice-hud" aria-live="polite">

          <!-- TOP-LEFT: wave + village integrity -->
          <div class="zi-hud-objective">
            <div class="zi-wave-chip">
              <span class="zi-label">WAVE</span>
              <b data-field="wave">1</b><span class="zi-wave-total">/12</span>
            </div>
            <div class="zi-village-row">
              <span class="zi-label">VILLAGE</span>
              <div class="zi-bar-track">
                <i class="zi-bar-fill" data-bar="village"></i>
              </div>
              <b data-field="village">100/100</b>
            </div>
          </div>

          <!-- TOP-RIGHT: coins, kills, settings -->
          <div class="zi-hud-meta">
            <div class="zi-meta-stat">
              <span class="zi-glyph zi-glyph-coin" aria-hidden="true">⬡</span>
              <b data-field="coins">0</b>
            </div>
            <div class="zi-meta-stat">
              <span class="zi-glyph zi-glyph-skull" aria-hidden="true">☠</span>
              <b data-field="kills">0</b>
            </div>
            <button class="zi-settings-btn" data-action="hud-settings" aria-label="Settings" type="button">⚙</button>
          </div>

          <!-- BOTTOM-LEFT: health, stamina, weapon -->
          <div class="zi-hud-vitals">
            <div class="zi-vital-row">
              <span class="zi-glyph" aria-hidden="true">♥</span>
              <div class="zi-bar-track zi-bar-health">
                <i class="zi-bar-fill" data-bar="health"></i>
              </div>
              <b data-field="player">100</b>
            </div>
            <div class="zi-vital-row zi-vital-stamina">
              <span class="zi-glyph" aria-hidden="true">⚡</span>
              <div class="zi-bar-track zi-bar-stamina">
                <i class="zi-bar-fill" data-bar="stamina"></i>
              </div>
            </div>
            <div class="zi-weapon-row">
              <b data-field="weapon">Pistol</b>
              <span class="zi-sep">·</span>
              <span data-field="ammo">15/15</span>
              <span class="zi-sep">·</span>
              <span data-field="ordnance">Frag 5</span>
              <span data-field="reload-bar" hidden>&nbsp;<span class="zi-reload-label">RLD</span> <b data-field="reload">-</b></span>
            </div>
          </div>

          <!-- TOP-CENTER: phase / message toast -->
          <div class="zi-toast" aria-live="assertive">
            <span data-field="phase">Ready</span>
            <strong data-field="message">Click Start Slice</strong>
          </div>

          <!-- Hidden stash: fields still written by updateHud but not shown -->
          <div class="zi-hud-stash" hidden>
            <b data-field="stamina">100</b>
            <b data-field="armor">Cloth</b>
            <b data-field="gear">None</b>
            <b data-field="fire">0</b>
            <b data-field="inside">Out</b>
            <b data-field="rescued">0/6</b>
            <b data-field="town">1</b>
            <b data-field="live">0</b>
          </div>

        </div>
        <div class="pc-slice-reticle" data-reticle="sidearm" aria-hidden="true"></div>
        <div class="pc-damage-flash" data-flash="player" aria-hidden="true"></div>
        <div class="pc-damage-flash" data-flash="village" aria-hidden="true"></div>
        <!-- Juice layer overlays -->
        <div class="pc-hp-vignette" aria-hidden="true"></div>
        <div class="pc-hitmarker" aria-hidden="true"><span class="pc-hm-v"></span><span class="pc-hm-v2"></span></div>
        <div class="pc-kill-floater" aria-hidden="true"></div>
        <div class="pc-streak-badge" aria-hidden="true"></div>
        <div class="pc-grace-overlay" data-overlay="grace" hidden aria-live="assertive">
          <span data-grace-countdown>5</span>
        </div>
        <div class="pc-summary-overlay" data-overlay="summary" hidden aria-live="polite">
          <div class="pc-summary-content">
            <span data-summary-eyebrow>Wave Clear</span>
            <h2 data-summary-wave>Wave 1</h2>
            <div class="pc-summary-stats">
              <span>Kills <b data-summary-kills>0</b></span>
              <span>Coins <b data-summary-coins>0</b></span>
              <span>Village <b data-summary-village>100%</b></span>
            </div>
            <div class="pc-offer-list" data-offer-context="summary" aria-label="Bonus offers"></div>
          </div>
        </div>
        <!-- Guidance toast — auto-dismissing, replaces the old persistent guidance panel -->
        <aside class="pc-guidance-toast" data-panel="guidance" aria-live="polite" hidden>
          <span data-guidance-field="stage">Guide</span>
          <strong data-guidance-field="title">First run</strong>
          <p data-guidance-field="message">Start the campaign and protect the village.</p>
        </aside>
        <div class="pc-minimap-panel" data-panel="minimap">
          <canvas class="pc-minimap-canvas" width="${MINIMAP_SIZE_PX}" height="${MINIMAP_SIZE_PX}" aria-label="Mini map"></canvas>
          <div class="pc-minimap-legend-mini">
            <span class="player">You</span>
            <span class="enemy">Zombie</span>
            <span class="village">Village</span>
          </div>
        </div>
        <div class="pc-flow-panel" data-panel="flow" aria-live="polite">
          <span data-flow-field="eyebrow">Night Survival</span>
          <h1 data-flow-field="title">Zombie Invasion</h1>
          <p data-flow-field="body">Survive the 12-wave village defense in the new cinematic low-poly style.</p>
          <div class="pc-flow-stats">
            <span>Wave <b data-flow-field="wave">1</b></span>
            <span>Best <b data-flow-field="best">1</b></span>
            <span>Coins <b data-flow-field="coins">0</b></span>
            <span>Kills <b data-flow-field="kills">0</b></span>
          </div>
          <div class="pc-flow-lifetime" data-menu-section="lifetime" hidden>
            <div class="pc-flow-lifetime-grid">
              <span>Total Kills <b data-flow-field="lifetime-kills">0</b></span>
              <span>Waves Cleared <b data-flow-field="lifetime-waves">0</b></span>
              <span>Time Played <b data-flow-field="lifetime-time">0m</b></span>
              <span>Damage Dealt <b data-flow-field="lifetime-damage">0</b></span>
            </div>
          </div>
          <div class="pc-flow-settings" data-menu-section="settings" hidden>
            <label class="pc-flow-setting">
              <span>Music</span>
              <input type="checkbox" data-menu-setting="musicEnabled" checked />
            </label>
            <label class="pc-flow-setting">
              <span>Sound Effects</span>
              <input type="checkbox" data-menu-setting="sfxEnabled" checked />
            </label>
            <label class="pc-flow-setting">
              <span>Quality</span>
              <select data-menu-setting="qualityPreset">
                <option value="auto">Auto</option>
                <option value="mobile_low">Mobile Low</option>
                <option value="mobile_high">Mobile High</option>
                <option value="desktop_high">Desktop High</option>
              </select>
            </label>
          </div>
          <div class="pc-flow-goals" data-menu-section="goals" hidden>
            <div class="pc-flow-goals-list" data-goals-list></div>
          </div>
          <details class="pc-flow-help" data-menu-section="help">
            <summary>Controls &amp; How To Play</summary>
            <p><strong>Desktop:</strong> WASD move · Shift sprint · Ctrl crouch · Space jump (double-jump mid-air) · Left click / F fire · R reload · G grenade · T flint · E interact · V or right-click ADS · O cycle weapon · Q shop</p>
            <p><strong>Mobile:</strong> Left pad moves, right pad looks. Action pad: Run, Duck, Jump, ADS, Swap, Blast, Flint, Use, Map, Shop, Fire.</p>
          </details>
          <div class="pc-offer-list" data-offer-context="gameover" aria-label="Ad offers"></div>
          <div class="pc-flow-actions">
            <button type="button" data-flow-action="primary">Start Campaign</button>
            <button type="button" data-flow-action="revive" hidden>Watch Ad to Revive</button>
            <button type="button" data-flow-action="stats">Stats</button>
            <button type="button" data-flow-action="goals">Goals</button>
            <button type="button" data-flow-action="settings">Settings</button>
            <button type="button" data-flow-action="shop">Shop</button>
            <button type="button" data-flow-action="reset">Reset Run</button>
          </div>
        </div>
        <!-- Mobile controls: left joystick zone (invisible until touched) + right action cluster -->
        <div class="pc-mobile-controls" aria-label="Touch controls">
          <!-- Left joystick zone: covers bottom-left 45% width / lower 55% height.
               Visual base+knob are injected by JS on first touch. -->
          <div class="pc-joystick-zone" aria-label="Move" aria-hidden="true"></div>

          <!-- Right action cluster: FIRE + 4 primary actions + More popover -->
          <div class="pc-action-cluster" aria-label="Actions">
            <!-- More popover (secondary actions — hidden by default) -->
            <div class="pc-more-popover" aria-label="More actions" hidden>
              <button type="button" data-touch-action="sprint" aria-label="Sprint">Run</button>
              <button type="button" data-touch-action="crouch" aria-label="Crouch">Duck</button>
              <button type="button" data-touch-action="jump" aria-label="Jump">Jump</button>
              <button type="button" data-touch-action="ads" aria-label="Aim down sights">ADS</button>
              <button type="button" data-touch-action="flint" aria-label="Use flint and steel">Flint</button>
              <button type="button" data-touch-action="map" aria-label="Toggle minimap">Map</button>
              <button type="button" data-touch-action="interact" aria-label="Interact">Use</button>
            </div>
            <!-- Primary buttons row -->
            <div class="pc-primary-actions">
              <button type="button" class="pc-btn-more" data-action="more" aria-label="More actions">···</button>
              <button type="button" data-touch-action="ordnance" aria-label="Use ordnance">BLAST</button>
              <button type="button" data-touch-action="cycle" aria-label="Cycle weapon">SWAP</button>
              <button type="button" data-touch-action="shop" aria-label="Toggle shop">SHOP</button>
            </div>
            <!-- Large FIRE button -->
            <button type="button" class="pc-btn-fire" data-touch-action="fire" aria-label="Fire weapon">FIRE</button>
          </div>
        </div>
        <div class="pc-shop-panel" data-panel="shop" hidden>
          <div class="pc-shop-panel-head">
            <span data-shop-guide-title>Field Shop</span>
            <strong data-shop-guide-body>Upgrade whenever you have coins</strong>
          </div>
          <div class="pc-shop-grid" data-shop-items></div>
        </div>
        <!-- Settings sheet — opened by ⚙ button; houses dev/utility controls.
             data-action hooks are preserved so attachInput() wiring stays intact. -->
        <div class="zi-settings-sheet" data-panel="settings" hidden aria-modal="true" role="dialog" aria-label="Settings">
          <div class="zi-settings-backdrop"></div>
          <div class="zi-settings-card">
            <h2 class="zi-settings-title">Settings</h2>
            <div class="zi-settings-body">
              <div class="zi-settings-row">
                <span>Music</span>
                <button type="button" data-action="music" aria-label="Toggle music">Toggle</button>
              </div>
              <div class="zi-settings-row">
                <span>Sound FX</span>
                <button type="button" data-action="sfx" aria-label="Toggle sound effects">Toggle</button>
              </div>
              <div class="zi-settings-row">
                <span>Haptics</span>
                <button type="button" data-action="haptics" aria-label="Toggle haptic feedback">Toggle</button>
              </div>
              <div class="zi-settings-row">
                <span>Fullscreen</span>
                <button type="button" data-action="fullscreen" aria-label="Toggle fullscreen">Toggle</button>
              </div>
              <hr class="zi-settings-divider">
              <div class="zi-settings-row">
                <span>Reset Run</span>
                <button type="button" data-action="reset">Reset</button>
              </div>
              <div class="zi-settings-row">
                <span>Clear Save</span>
                <button type="button" data-action="restart">Clear</button>
              </div>
              <div class="zi-settings-row">
                <span>Legacy Build</span>
                <a href="/?legacy=1" class="zi-settings-link" aria-label="Open legacy Three.js build">Open</a>
              </div>
            </div>
            <button type="button" class="zi-settings-resume" data-action="settings-resume">Resume</button>
          </div>
        </div>
        <!-- Hidden stubs so attachInput() querySelector calls don't crash (data-action="start"/"ordnance"/"shop" live in flow/cluster) -->
        <div hidden aria-hidden="true">
          <button type="button" data-action="start" tabindex="-1">Start</button>
          <button type="button" data-action="ordnance" tabindex="-1">Blast</button>
          <button type="button" data-action="shop" tabindex="-1">Shop</button>
          <button type="button" data-action="map" tabindex="-1">Map</button>
        </div>
      </div>
    `;
    this.canvas = this.root.querySelector("canvas.pc-slice-canvas");
    this.minimapPanel = this.root.querySelector('[data-panel="minimap"]');
    this.guidancePanel = this.root.querySelector('[data-panel="guidance"]');
    this.guidanceFields = {
      stage: this.root.querySelector('[data-guidance-field="stage"]'),
      title: this.root.querySelector('[data-guidance-field="title"]'),
      message: this.root.querySelector('[data-guidance-field="message"]'),
    };
    this.reticle = this.root.querySelector(".pc-slice-reticle");
    this.minimapCanvas = this.root.querySelector(".pc-minimap-canvas");
    this.minimapCtx = this.minimapCanvas?.getContext("2d") ?? null;
    // Settings sheet
    this.settingsSheet = this.root.querySelector('[data-panel="settings"]');
    // More popover
    this.morePopover = this.root.querySelector(".pc-more-popover");
    this.fields = {
      phase: this.root.querySelector('[data-field="phase"]'),
      message: this.root.querySelector('[data-field="message"]'),
      wave: this.root.querySelector('[data-field="wave"]'),
      village: this.root.querySelector('[data-field="village"]'),
      player: this.root.querySelector('[data-field="player"]'),
      ammo: this.root.querySelector('[data-field="ammo"]'),
      ordnance: this.root.querySelector('[data-field="ordnance"]'),
      weapon: this.root.querySelector('[data-field="weapon"]'),
      armor: this.root.querySelector('[data-field="armor"]'),
      gear: this.root.querySelector('[data-field="gear"]'),
      fire: this.root.querySelector('[data-field="fire"]'),
      inside: this.root.querySelector('[data-field="inside"]'),
      rescued: this.root.querySelector('[data-field="rescued"]'),
      town: this.root.querySelector('[data-field="town"]'),
      coins: this.root.querySelector('[data-field="coins"]'),
      kills: this.root.querySelector('[data-field="kills"]'),
      live: this.root.querySelector('[data-field="live"]'),
    };
    this.bars = {
      village: this.root.querySelector('[data-bar="village"]'),
      health: this.root.querySelector('[data-bar="health"]'),
      stamina: this.root.querySelector('[data-bar="stamina"]'),
    };
    this.playerFlashOverlay = this.root.querySelector('[data-flash="player"]');
    this.villageFlashOverlay = this.root.querySelector('[data-flash="village"]');
    // Juice layer DOM refs
    this.hpVignette = this.root.querySelector('.pc-hp-vignette');
    this.hitmarkerEl = this.root.querySelector('.pc-hitmarker');
    this.killFloaterEl = this.root.querySelector('.pc-kill-floater');
    this.streakBadgeEl = this.root.querySelector('.pc-streak-badge');
    this.graceOverlay = this.root.querySelector('[data-overlay="grace"]');
    this.graceCountdown = this.root.querySelector('[data-grace-countdown]');
    this.summaryOverlay = this.root.querySelector('[data-overlay="summary"]');
    this.summaryFields = {
      eyebrow: this.root.querySelector('[data-summary-eyebrow]'),
      wave: this.root.querySelector('[data-summary-wave]'),
      kills: this.root.querySelector('[data-summary-kills]'),
      coins: this.root.querySelector('[data-summary-coins]'),
      village: this.root.querySelector('[data-summary-village]'),
    };
    this.reloadBarWrapper = this.root.querySelector('[data-field="reload-bar"]');
    this.shopPanel = this.root.querySelector('[data-panel="shop"]');
    this.shopGuideTitle = this.root.querySelector("[data-shop-guide-title]");
    this.shopGuideBody = this.root.querySelector("[data-shop-guide-body]");
    this.shopItemsRoot = this.root.querySelector("[data-shop-items]");
    this.flowPanel = this.root.querySelector('[data-panel="flow"]');
    // pc-slice-actions bar removed (Pass 2) — actions now live in settings sheet + action cluster
    this.actionBar = null;
    this.flowFields = {
      eyebrow: this.root.querySelector('[data-flow-field="eyebrow"]'),
      title: this.root.querySelector('[data-flow-field="title"]'),
      body: this.root.querySelector('[data-flow-field="body"]'),
      wave: this.root.querySelector('[data-flow-field="wave"]'),
      best: this.root.querySelector('[data-flow-field="best"]'),
      coins: this.root.querySelector('[data-flow-field="coins"]'),
      kills: this.root.querySelector('[data-flow-field="kills"]'),
      primary: this.root.querySelector('[data-flow-action="primary"]'),
      revive: this.root.querySelector('[data-flow-action="revive"]'),
      stats: this.root.querySelector('[data-flow-action="stats"]'),
      goals: this.root.querySelector('[data-flow-action="goals"]'),
      settings: this.root.querySelector('[data-flow-action="settings"]'),
      shop: this.root.querySelector('[data-flow-action="shop"]'),
      reset: this.root.querySelector('[data-flow-action="reset"]'),
      lifetimeKills: this.root.querySelector('[data-flow-field="lifetime-kills"]'),
      lifetimeWaves: this.root.querySelector('[data-flow-field="lifetime-waves"]'),
      lifetimeTime: this.root.querySelector('[data-flow-field="lifetime-time"]'),
      lifetimeDamage: this.root.querySelector('[data-flow-field="lifetime-damage"]'),
    };
    this.summaryOfferList = this.root.querySelector('[data-offer-context="summary"]');
    this.gameOverOfferList = this.root.querySelector('[data-offer-context="gameover"]');
    this.goalsListEl = this.root.querySelector('[data-goals-list]');
  }

  detectQualityProfile() {
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || (window.innerWidth < 768 && "ontouchstart" in window);
    const savedPreset = this.state?.qualityPreset;
    if (savedPreset && qualityProfiles[savedPreset]) {
      return { key: savedPreset, profile: qualityProfiles[savedPreset] };
    }
    if (isMobile) {
      const cores = navigator.hardwareConcurrency ?? 2;
      const key = cores >= 6 ? "mobile_high" : "mobile_low";
      return { key, profile: qualityProfiles[key] };
    }
    return { key: "desktop_high", profile: qualityProfiles["desktop_high"] };
  }

  createApp() {
    const { key, profile } = this.detectQualityProfile();
    this.qualityProfileKey = key;
    this.qualityProfile = profile;

    this.app = new pc.Application(this.canvas, {
      mouse: new pc.Mouse(this.canvas),
      keyboard: new pc.Keyboard(window),
      graphicsDeviceOptions: {
        antialias: true,
        powerPreference: "high-performance",
        preserveDrawingBuffer: true,
      },
    });
    this.app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    this.app.setCanvasResolution(pc.RESOLUTION_AUTO);
    const renderScaleDpr = (profile.renderScale ?? 1) * Math.min(window.devicePixelRatio || 1, 2);
    this.app.graphicsDevice.maxPixelRatio = renderScaleDpr;
    this.app.scene.exposure = 1.48;
    this.app.scene.ambientLight = new pc.Color(0.12, 0.17, 0.26);
    // Task 1: Distance fog — linear, night-sky colour, houses at 30-50m soften into dark
    // Fog start pushed to 42 so zombies at 25-40m are clear; end 95 keeps far background dark.
    this.app.scene.fog.type = pc.FOG_LINEAR;
    this.app.scene.fog.color = new pc.Color(0.04, 0.10, 0.22);
    this.app.scene.fog.start = 42;
    this.app.scene.fog.end = 95;
    this.app.start();
    // Hide the boot overlay on the first rendered frame — the canvas is live at this point.
    // GLB models may still be streaming (they use procedural fallback until ready), but the
    // scene is interactive and the menu panel is visible, so the overlay is no longer needed.
    let _bootHidden = false;
    this.app.on("update", (dt) => {
      if (!_bootHidden) {
        _bootHidden = true;
        if (typeof window.__ziBootHide === "function") {
          window.__ziBootHide();
        }
      }
      this.update(dt);
    });
    window.addEventListener("resize", () => this.app.resizeCanvas());
  }

  createMaterials() {
    this.materials = new Map();
    for (const [key, def] of Object.entries(MATERIALS)) {
      const material = new pc.StandardMaterial();
      material.diffuse = color(def.diffuse);
      material.emissive = color(def.emissive || [0, 0, 0]);
      material.emissiveIntensity = def.emissiveIntensity ?? 1;
      material.gloss = 1 - (def.roughness ?? 0.7);
      material.metalness = def.metalness ?? 0;
      material.useMetalness = true;
      if (def.opacity !== undefined) {
        material.opacity = def.opacity;
        material.blendType = def.blend === "additive" ? pc.BLEND_ADDITIVEALPHA : pc.BLEND_NORMAL;
        material.depthWrite = false;
      }
      // Sky/backdrop materials bypass scene fog so the moon and clouds don't wash out
      if (NO_FOG_MATERIALS.has(key)) {
        material.useFog = false;
      }
      material.update();
      this.materials.set(key, material);
    }
  }

  createScene() {
    this.camera = new pc.Entity("slice-camera");
    this.camera.addComponent("camera", {
      clearColor: new pc.Color(0.04, 0.12, 0.26),
      fov: 68,
      nearClip: 0.08,
      farClip: 170,
    });
    this.camera.camera.toneMapping = pc.TONEMAP_ACES;
    this.app.root.addChild(this.camera);

    const shadowRes = (this.qualityProfile?.shadows ?? true) ? 2048 : 512;
    const moon = new pc.Entity("moon-key");
    moon.addComponent("light", {
      type: "directional",
      color: new pc.Color(0.75, 0.86, 1),
      intensity: 2.6,
      castShadows: this.qualityProfile?.shadows ?? true,
      shadowDistance: 72,
      shadowResolution: shadowRes,
    });
    moon.setEulerAngles(42, 18, 0);
    this.app.root.addChild(moon);

    const fillLight = new pc.Entity("sky-fill");
    fillLight.addComponent("light", {
      type: "directional",
      color: new pc.Color(0.22, 0.35, 0.58),
      intensity: 0.55,
      castShadows: false,
    });
    fillLight.setEulerAngles(55, 210, 0);
    this.app.root.addChild(fillLight);

    // Cool upward street light — comes from low angle in front of zombies (+Z side, low pitch).
    // Mimics a street-lamp-like uplight: catches the underside of faces/chests, strong silhouette.
    const rimLight = new pc.Entity("zombie-rim");
    rimLight.addComponent("light", {
      type: "directional",
      color: new pc.Color(0.38, 0.58, 0.95),
      intensity: 0.55,
      castShadows: false,
    });
    // Pitch 22° from below, yaw 0 (light comes from +Z side toward -Z — hits zombie fronts as they approach)
    rimLight.setEulerAngles(22, 0, 0);
    this.app.root.addChild(rimLight);

    this.addSkyLayers();
    this.addPrimitive("moon-disc", "sphere", [0, 27, -72], [4.8, 4.8, 4.8], "moon");
    // Task 5: Moon halo — large translucent glow sphere behind the disc
    this.addPrimitive("moon-halo", "sphere", [0, 27, -71], [10, 10, 10], "moonHalo");
    this.addGround();
    this.addVillage();
    this.addBuildingInteriors();
    this.addLaneDressing();
    this.createWeaponModel();
    this.createGearVisuals();
    this.createShotFxPool();
  }

  // Approach 1 — pc.CameraFrame (PlayCanvas ≥1.70 / 2.x).
  // Bloom is gated by the quality profile's `bloom` flag:
  //   desktop_high: bloom true, mobile_high: bloom true, mobile_low: bloom false.
  // CameraFrame's FramePassCameraFrame auto-disables bloom when the GPU cannot
  // allocate an HDR render target (SwiftShader RGBA8 fallback) — so the smoke
  // test is safe without any extra guard.
  _initCameraFrame() {
    // Disabled by default: the CameraFrame HDR render path visibly alters the
    // tuned night look even with bloom off (mist billboards composite hotter,
    // sky washes toward grey — verified live on Metal GPU). The additive
    // eye/muzzle corona spheres deliver the halo look in the normal pipeline
    // instead. Re-enable for experiments with ?bloom=1.
    const params = new URLSearchParams(globalThis.location?.search ?? "");
    if (params.get("bloom") !== "1") return;
    if (!this.qualityProfile?.bloom) return;
    try {
      const cf = new pc.CameraFrame(this.app, this.camera.camera);
      // Bloom: soft halo for zombie eyes [14,8,1.2], muzzle [2.2,1.4,0.25],
      // lanterns [2.8,1.15,0.32], windows [2.2,0.95,0.28], moon [0.95,1.18,1.55].
      // intensity 0.08 — visible halo on eyes/flash while sky stays dark navy.
      //   0.04 was too subtle on small emissive spheres; 0.30+ washes the scene.
      //   Live-tested at 0.08: moon halos, muzzle flash corona, eye glow all read.
      // blurLevel 16 — max MIP chain for the widest soft spread.
      cf.bloom.intensity = 0.08;
      cf.bloom.blurLevel = 16;
      // Keep ACES tone mapping (was already on the camera component).
      // CameraFrame compose pass owns tone mapping when active.
      cf.rendering.toneMapping = pc.TONEMAP_ACES;
      // No SSAO (too expensive; already disabled on mobile_low, optional on desktop).
      // cf.ssao.type stays SSAOTYPE_NONE (default).
      this.cameraFrame = cf;
      console.log("[PlayCanvas] CameraFrame bloom enabled (quality:", this.qualityProfileKey, ")");
    } catch (e) {
      console.warn("[PlayCanvas] CameraFrame init failed — bloom disabled.", e);
      this.cameraFrame = null;
    }
  }

  addGround() {
    this.addPrimitive("ground", "box", [0, -0.08, -15], [70, 0.12, 104], "ground");
    this.addPrimitive("mud-lane", "box", [0, -0.03, -13], [9.4, 0.04, 88], "road");
    this.addPrimitive("left-path-edge", "box", [-5.2, 0, -13], [0.42, 0.05, 88], "pathEdge");
    this.addPrimitive("right-path-edge", "box", [5.2, 0, -13], [0.42, 0.05, 88], "pathEdge");
    for (let z = -48; z <= 18; z += 5.5) {
      this.addPrimitive(`lane-stone-${z}`, "box", [Math.sin(z) * 2.9, 0.02, z], [1.25, 0.05, 0.36], "stone").setEulerAngles(0, z * 7, 0);
      this.addPrimitive(`mud-shine-${z}`, "box", [Math.cos(z * 0.4) * 1.9, 0.025, z + 1.3], [1.7, 0.035, 0.22], z % 11 === 0 ? "mudHighlight" : "wetRoad").setEulerAngles(0, z * 9, 0);
    }
  }

  addVillage() {
    this.addBellTower(0, SLICE_WORLD.villageZ - 12);
    this.minimapStructures.push({ x: 0, z: SLICE_WORLD.villageZ - 12, sx: 3.3, sz: 2.8, kind: "tower" });
    // village-safe-pool: no ground disc, the bell tower glow is sufficient
    this.addLantern(-1.8, 2.6, SLICE_WORLD.villageZ + 0.3);
    this.addLantern(1.8, 2.6, SLICE_WORLD.villageZ + 0.3);

    const houses = [
      [-9.5, SLICE_WORLD.villageZ - 10, 5.8, 3.2, 5.8],
      [9.4, SLICE_WORLD.villageZ - 8.8, 5.6, 3.0, 5.4],
      [-13.2, SLICE_WORLD.villageZ - 1, 6.4, 3.5, 5.2],
      [13.4, SLICE_WORLD.villageZ + 0.2, 6.2, 3.4, 5.4],
      [-15.4, SLICE_WORLD.villageZ + 12.6, 7.2, 3.7, 6.8],
      [15.8, SLICE_WORLD.villageZ + 12.2, 7.4, 3.8, 7.0],
    ];
    houses.forEach(([x, z, sx, sy, sz], index) => {
      this.addHouseFacade(`house-${index}`, x, z, sx, sy, sz, index);
    });

    for (let x = -6; x <= 6; x += 2) {
      this.addPrimitive(`barricade-${x}`, "box", [x, 0.65, SLICE_WORLD.villageZ + 3.2], [1.35, 0.35, 0.38], "wood").setEulerAngles(0, x * 8, 12);
    }

    for (let i = 0; i < 8; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (5.7 + i * 0.55);
      const z = SLICE_WORLD.villageZ + 5.5 + (i % 4) * 1.6;
      this.addPrimitive(`pumpkin-${i}`, "sphere", [x, 0.28, z], [0.48, 0.32, 0.42], "pumpkin");
      this.addPrimitive(`crate-${i}`, "box", [x + side * 0.78, 0.34, z - 0.45], [0.62, 0.68, 0.62], "wood").setEulerAngles(0, i * 19, 0);
    }
  }

  addBuildingInteriors() {
    for (const building of buildingsConfig) {
      const { center, size, doorInside } = building.interior;
      this.addPrimitive(`${building.id}-interior-floor`, "box", [center.x, 0.02, center.z], [size.x, 0.06, size.z], "road");
      this.addPrimitive(`${building.id}-interior-back`, "box", [center.x, 1.15, center.z - size.z / 2], [size.x, 2.3, 0.16], "houseWall");
      this.addPrimitive(`${building.id}-interior-left`, "box", [center.x - size.x / 2, 1.15, center.z], [0.16, 2.3, size.z], "houseWall");
      this.addPrimitive(`${building.id}-interior-right`, "box", [center.x + size.x / 2, 1.15, center.z], [0.16, 2.3, size.z], "houseWall");
      this.addPrimitive(`${building.id}-interior-door-pad`, "cylinder", [doorInside.x, 0.08, doorInside.z], [0.58, 0.05, 0.58], "doorSafe");
      this.addPrimitive(`${building.id}-exterior-door-pad`, "cylinder", [building.exteriorDoor.x, 0.08, building.exteriorDoor.z], [0.54, 0.05, 0.54], "doorSafe");
      this.addLantern(center.x, 1.75, center.z - size.z * 0.24);
    }
  }

  addSkyLayers() {
    // Task 4: 6 cloud clusters, 1.4x scale vs old values — bolder moonlit tops
    const cloudRows = [
      [-22, 24, -74, 1.68],
      [16, 22.5, -70, 1.33],
      [-4, 28, -78, 1.05],
      [31, 27, -82, 1.01],
      [-38, 25, -68, 1.22],
      [8, 21, -66, 0.92],
    ];
    cloudRows.forEach(([x, y, z, scale], index) => this.addCloudCluster(`cloud-${index}`, x, y, z, scale));
    for (let i = 0; i < 28; i += 1) {
      const x = -42 + (i * 13) % 84;
      const y = 18 + ((i * 7) % 13);
      const z = -62 - ((i * 11) % 34);
      this.addPrimitive(`star-${i}`, "sphere", [x, y, z], [0.045, 0.045, 0.045], "moon");
    }
  }

  addCloudCluster(name, x, y, z, scale) {
    const offsets = [
      [0, 0, 0, 5.6, 0.7, 1.3],
      [-3.8, -0.2, 0.4, 3.8, 0.55, 1],
      [3.4, 0.25, -0.2, 4.2, 0.65, 1.1],
      [7.1, -0.08, 0.3, 2.9, 0.42, 0.85],
    ];
    for (const [ox, oy, oz, sx, sy, sz] of offsets) {
      const cloud = this.addPrimitive(`${name}-${ox}`, "sphere", [x + ox * scale, y + oy, z + oz], [sx * scale, sy * scale, sz * scale], oy > 0 ? "cloud" : "cloudDark");
      cloud.setEulerAngles(0, ox * 9, 0);
    }
  }

  addBellTower(x, z) {
    this.addPrimitive("bell-tower-base", "box", [x, 2.4, z], [3.3, 4.8, 2.8], "houseWall");
    this.addPrimitive("bell-tower-timber-left", "box", [x - 1.55, 2.5, z - 1.42], [0.18, 4.7, 0.18], "timber");
    this.addPrimitive("bell-tower-timber-right", "box", [x + 1.55, 2.5, z - 1.42], [0.18, 4.7, 0.18], "timber");
    this.registerWindowEntity("bell-window", this.addPrimitive("bell-window", "box", [x, 3.2, z - 1.43], [0.72, 1.15, 0.08], "windowGlow"));
    this.addPrimitive("bell-arch", "box", [x, 5.08, z - 1.35], [2.1, 1.1, 0.22], "timber");
    this.addPrimitive("bell", "sphere", [x, 5.1, z - 1.55], [0.55, 0.55, 0.55], "metal");
    this.addPitchedRoof("bell-roof", x, z, 4.2, 3.7, 6.6, "roofDark");
    this.addPrimitive("bell-cross-vertical", "box", [x, 8.55, z - 0.1], [0.12, 1.0, 0.12], "metal");
    this.addPrimitive("bell-cross-horizontal", "box", [x, 8.74, z - 0.1], [0.65, 0.1, 0.1], "metal");
  }

  addHouseFacade(name, x, z, sx, sy, sz, index) {
    const side = Math.sign(x) || 1;
    this.minimapStructures.push({ x, z, sx, sz, kind: "building" });
    this.addPrimitive(`${name}-body`, "box", [x, sy / 2, z], [sx, sy, sz], "houseWall");
    this.addPitchedRoof(`${name}-roof`, x, z, sx * 1.14, sz * 1.1, sy + 0.66, index > 3 ? "roofDark" : "roof");
    this.addPrimitive(`${name}-timber-mid`, "box", [x, sy * 0.58, z + sz / 2 + 0.05], [sx * 0.88, 0.16, 0.12], "timber");
    this.addPrimitive(`${name}-timber-left`, "box", [x - sx * 0.38, sy * 0.55, z + sz / 2 + 0.06], [0.16, sy * 0.8, 0.12], "timber");
    this.addPrimitive(`${name}-timber-right`, "box", [x + sx * 0.38, sy * 0.55, z + sz / 2 + 0.06], [0.16, sy * 0.8, 0.12], "timber");
    this.addPrimitive(`${name}-door`, "box", [x + side * sx * 0.18, 0.72, z + sz / 2 + 0.08], [0.76, 1.25, 0.09], "timber");
    this.registerWindowEntity(`${name}-window-a`, this.addPrimitive(`${name}-window-a`, "box", [x - side * sx * 0.22, sy * 0.78, z + sz / 2 + 0.09], [0.72, 0.82, 0.08], "windowGlow"));
    this.registerWindowEntity(`${name}-window-b`, this.addPrimitive(`${name}-window-b`, "box", [x + side * sx * 0.35, sy * 0.62, z + sz / 2 + 0.09], [0.48, 0.62, 0.08], "windowGlow"));
    this.addLantern(x - side * sx * 0.5, 1.55, z + sz / 2 + 0.28);
    if (index >= 4) {
      this.addPrimitive(`${name}-wagon`, "box", [x - side * 2.1, 0.55, z + sz / 2 + 1.3], [2.0, 0.6, 0.9], "wood");
      this.addPrimitive(`${name}-wheel-a`, "cylinder", [x - side * 2.9, 0.35, z + sz / 2 + 1.78], [0.34, 0.08, 0.34], "timber").setEulerAngles(90, 0, 0);
      this.addPrimitive(`${name}-wheel-b`, "cylinder", [x - side * 1.35, 0.35, z + sz / 2 + 1.78], [0.34, 0.08, 0.34], "timber").setEulerAngles(90, 0, 0);
    }
  }

  addPitchedRoof(name, x, z, width, depth, y, materialKey) {
    const left = this.addPrimitive(`${name}-left`, "box", [x - width * 0.19, y, z], [width * 0.62, 0.24, depth], materialKey);
    left.setEulerAngles(0, 0, -25);
    const right = this.addPrimitive(`${name}-right`, "box", [x + width * 0.19, y, z], [width * 0.62, 0.24, depth], materialKey);
    right.setEulerAngles(0, 0, 25);
    this.addPrimitive(`${name}-ridge`, "box", [x, y + width * 0.13, z], [0.18, 0.22, depth * 1.04], "timber");
  }

  addPine(name, x, z, scale, rotY = 0) {
    const root = new pc.Entity(name);
    this.app.root.addChild(root);
    // Task 3: thicker trunk + 4 tiers (was 3) + per-tree rotY variety
    this.addPrimitive(`${name}-trunk`, "cylinder", [x, 1.1 * scale, z], [0.28 * scale, 2.2 * scale, 0.28 * scale], "timber", root);
    for (let tier = 0; tier < 4; tier += 1) {
      const y = (1.65 + tier * 0.72) * scale;
      const size = (1.65 - tier * 0.28) * scale;
      this.addPrimitive(`${name}-tier-${tier}`, "cone", [x, y, z], [size, 1.6 * scale, size], "pine", root);
    }
    root.setEulerAngles(0, rotY, 0);
    return root;
  }

  addLaneDressing() {
    const rand = this.sceneRandom;

    // Trees: 32 positions — pines (every 3rd) get 4-tier treatment; deciduous get 3-4 sphere cluster
    for (let i = 0; i < 32; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const z = 18 - i * 2.65;
      const x = side * (11.5 + Math.sin(i * 1.7) * 4.4);
      const landscapeId = `landscape-${i}`;
      if (i % 3 === 0) {
        // Task 3: pines — extra tier + per-tree rotation
        const rotY = rand() * 360;
        this.entitiesByLandscape.set(landscapeId, this.addPine(`pine-${i}`, x, z, 1.3 + rand() * 0.8, rotY));
      } else {
        // Task 3: deciduous — cluster of 3-4 overlapping spheres + thicker trunk
        const root = new pc.Entity(`tree-${i}`);
        this.app.root.addChild(root);
        const trunkScale = 0.36 + rand() * 0.1;
        const trunkH = 2.0 + rand() * 0.6;
        const trunk = this.addPrimitive(`tree-trunk-${i}`, "cylinder", [x, trunkH * 0.5, z], [trunkScale, trunkH, trunkScale], "wood", root);
        trunk.setEulerAngles(Math.sin(i) * 4, 0, Math.cos(i) * 4);
        const crownY = trunkH + 0.3;
        const baseR = 1.4 + rand() * 0.5;
        const mats = ["pine", "grassDark", "pine", "grassDark"];
        // main crown sphere
        this.addPrimitive(`tree-crown-${i}-a`, "sphere", [x, crownY, z], [baseR, baseR * 0.88, baseR], mats[i % 2], root);
        // 2-3 offset lobes for foliage cluster look
        const lobes = 2 + (i % 2);
        for (let l = 0; l < lobes; l += 1) {
          const angle = (l / lobes) * Math.PI * 2 + rand() * 0.8;
          const r = baseR * (0.55 + rand() * 0.22);
          const ox = Math.cos(angle) * baseR * 0.55;
          const oz = Math.sin(angle) * baseR * 0.55;
          const oy = (rand() - 0.4) * baseR * 0.5;
          this.addPrimitive(`tree-crown-${i}-${l}`, "sphere", [x + ox, crownY + oy, z + oz], [r, r * 0.82, r], mats[(i + l + 1) % 2], root);
        }
        this.entitiesByLandscape.set(landscapeId, root);
      }
    }

    // Task 2: Replace 20 old tiny fog spheres with 16 large ground-mist billboards
    // Concentrated in midground z -35..-5, hugging the ground
    for (let i = 0; i < 16; i += 1) {
      const x = (rand() - 0.5) * 26;
      const z = -35 + rand() * 30;
      const sx = 6 + rand() * 4;
      const sy = 0.5 + rand() * 0.4;
      const sz = 2.5 + rand() * 1.5;
      const y = 0.3 + rand() * 0.4;
      const mist = this.addPrimitive(`mist-${i}`, "sphere", [x, y, z], [sx, sy, sz], "groundMist");
      mist.setEulerAngles(0, rand() * 360, 0);
    }

    // Task 6: Rocks — 24 faceted boxes along lane edges and midground
    for (let i = 0; i < 24; i += 1) {
      const side = (i % 2 === 0 ? -1 : 1);
      // spread between path edge (x~7) and tree line (x~16), and some center scatter
      const xOff = i < 18 ? (7.2 + rand() * 8.8) * side : (rand() - 0.5) * 8;
      const z = 16 - rand() * 62;
      const sx = 0.3 + rand() * 0.8;
      const sy = 0.28 + rand() * 0.5;
      const sz = 0.3 + rand() * 0.7;
      const yOff = rand() < 0.25 ? -0.1 : 0.0; // half-buried
      const rockMat = i % 3 === 0 ? "stoneDark" : "stone";
      const rock = this.addPrimitive(`rock-${i}`, "box", [xOff, yOff + sy * 0.4, z], [sx, sy, sz], rockMat);
      rock.setEulerAngles(rand() * 22 - 11, rand() * 360, rand() * 18 - 9);
    }

    // Task 6: Grass tufts — 20 small cones on grass strips beside path
    for (let i = 0; i < 20; i += 1) {
      const side = (i % 2 === 0 ? -1 : 1);
      const x = side * (6.0 + rand() * 9.5);
      const z = 18 - rand() * 66;
      const sx = 0.14 + rand() * 0.08;
      const sy = 0.22 + rand() * 0.12;
      this.addPrimitive(`grass-tuft-${i}`, "cone", [x, sy * 0.5, z], [sx, sy, sx], "grassDark");
    }

    // Fences
    for (let z = -46; z <= 18; z += 8) {
      this.addPrimitive(`fence-left-${z}`, "box", [-7.2, 0.72, z], [0.26, 1.25, 0.28], "wood");
      this.addPrimitive(`fence-right-${z}`, "box", [7.2, 0.72, z], [0.26, 1.25, 0.28], "wood");
      this.addPrimitive(`fence-rail-left-${z}`, "box", [-7.2, 0.95, z + 2], [0.18, 0.24, 4.2], "wood");
      this.addPrimitive(`fence-rail-right-${z}`, "box", [7.2, 0.95, z + 2], [0.18, 0.24, 4.2], "wood");
    }
  }

  addLantern(x, y, z) {
    this.addPrimitive(`lantern-${x}-${z}`, "sphere", [x, y, z], [0.22, 0.22, 0.22], "lantern");
    const light = new pc.Entity(`lantern-light-${x}-${z}`);
    light.addComponent("light", {
      type: "omni",
      color: new pc.Color(1, 0.52, 0.22),
      intensity: 2.6,
      range: 7.5,
      castShadows: false,
    });
    light.setLocalPosition(x, y, z);
    this.app.root.addChild(light);
  }

  createWeaponModel() {
    this.weaponRoot = new pc.Entity("weapon-viewmodel-root");
    this.camera.addChild(this.weaponRoot);
    this.weaponRoot.setLocalPosition(0.48, -0.5, -0.95);
    this.weaponRoot.setLocalEulerAngles(-1, -6, 0);

    // Task 1: viewmodel fill light — dim omni parented to camera so the held
    // weapon catches light at night and reads 3-dimensionally.
    // Range ≤ 2.5 so it does NOT noticeably illuminate the scene.
    const viewmodelLight = new pc.Entity("viewmodel-fill-light");
    viewmodelLight.addComponent("light", {
      type: "omni",
      color: new pc.Color(0.7, 0.78, 0.95),
      intensity: 1.25,
      range: 2.4,
      castShadows: false,
    });
    viewmodelLight.setLocalPosition(0.3, -0.2, -0.4);
    this.camera.addChild(viewmodelLight);

    this.weaponModels = new Map();
    this.createSidearmModel();
    this.createCompactModel();
    this.createRifleModel();
    this.createShotgunModel();
    this.createPrecisionModel();
    this.createHeavyModel();
    this.createLauncherModel();
    this.createFlamethrowerModel();
    this.createPipeModel();
    this.muzzleFlash = this.addPrimitive("muzzle-flash", "sphere", [0, 0.04, -1.35], [0.16, 0.16, 0.16], "muzzle", this.weaponRoot);
    this.muzzleFlash.enabled = false;
    this.activeWeaponViewModel = null;
    this.updateWeaponVisuals();
  }

  createWeaponGroup(key, options = {}) {
    const group = new pc.Entity(`weapon-${key}`);
    group.enabled = false;
    this.weaponRoot.addChild(group);
    group._muzzle = options.muzzle ?? [0, 0.04, -1.35];
    group._rootPosition = options.rootPosition ?? [0.48, -0.5, -0.95];
    group._rootEuler = options.rootEuler ?? [-1, -6, 0];
    this.weaponModels.set(key, group);
    return group;
  }

  createSidearmModel() {
    const root = this.createWeaponGroup("sidearm", { muzzle: [0.02, 0.03, -0.84], rootPosition: [0.42, -0.48, -0.76] });
    this.addPrimitive("sidearm-slide", "box", [0, 0.08, -0.2], [0.22, 0.16, 0.64], "blackMetal", root);
    this.addPrimitive("sidearm-slide-top", "box", [0, 0.165, -0.2], [0.22, 0.02, 0.64], "gunmetalLight", root);
    this.addPrimitive("sidearm-front-sight", "box", [0, 0.175, -0.48], [0.04, 0.05, 0.03], "gunmetalLight", root);
    this.addPrimitive("sidearm-rear-sight", "box", [0, 0.175, 0.06], [0.1, 0.05, 0.04], "gunmetalLight", root);
    this.addPrimitive("sidearm-muzzle-crown", "cylinder", [0.01, 0.07, -0.75], [0.042, 0.04, 0.042], "gunmetalLight", root).setLocalEulerAngles(90, 0, 0);
    this.addPrimitive("sidearm-frame", "box", [0.01, -0.03, -0.02], [0.2, 0.12, 0.42], "rail", root);
    this.addPrimitive("sidearm-grip", "box", [0.05, -0.22, 0.14], [0.18, 0.36, 0.16], "blackMetal", root).setLocalEulerAngles(-13, 0, 0);
    this.addPrimitive("sidearm-barrel", "cylinder", [0.01, 0.07, -0.58], [0.035, 0.32, 0.035], "metal", root).setLocalEulerAngles(90, 0, 0);
    // Right hand + forearm (sidearm: single-hand weapon)
    this.addPrimitive("sidearm-hand-r", "box", [0.05, -0.22, 0.14], [0.16, 0.14, 0.2], "glove", root).setLocalEulerAngles(-13, 0, 4);
    this.addPrimitive("sidearm-forearm-r", "box", [0.18, -0.38, 0.32], [0.14, 0.13, 0.5], "sleeve", root).setLocalEulerAngles(38, -14, 0);
  }

  createCompactModel() {
    const root = this.createWeaponGroup("compact", { muzzle: [0, 0.05, -1.02], rootPosition: [0.46, -0.49, -0.86] });
    this.addPrimitive("compact-receiver", "box", [0, 0.03, -0.16], [0.25, 0.18, 0.72], "blackMetal", root);
    this.addPrimitive("compact-top-rail", "box", [0, 0.125, -0.16], [0.25, 0.02, 0.72], "gunmetalLight", root);
    this.addPrimitive("compact-front-sight", "box", [0, 0.15, -0.78], [0.05, 0.06, 0.03], "gunmetalLight", root);
    this.addPrimitive("compact-fore", "box", [0, 0.02, -0.62], [0.2, 0.15, 0.44], "rail", root);
    this.addPrimitive("compact-mag", "box", [0.03, -0.21, -0.02], [0.14, 0.44, 0.18], "blackMetal", root).setLocalEulerAngles(-7, 0, 0);
    this.addPrimitive("compact-stock", "box", [0.02, 0.01, 0.35], [0.28, 0.12, 0.26], "rail", root);
    this.addPrimitive("compact-barrel", "cylinder", [0, 0.04, -0.92], [0.038, 0.42, 0.038], "blackMetal", root).setLocalEulerAngles(90, 0, 0);
    this.addPrimitive("compact-muzzle-crown", "cylinder", [0, 0.04, -1.15], [0.046, 0.04, 0.046], "gunmetalLight", root).setLocalEulerAngles(90, 0, 0);
    // Right hand on pistol grip + forearm; left support hand under foregrip
    this.addPrimitive("compact-hand-r", "box", [0.03, -0.21, -0.02], [0.16, 0.14, 0.2], "glove", root).setLocalEulerAngles(-7, 0, 4);
    this.addPrimitive("compact-forearm-r", "box", [0.18, -0.36, 0.16], [0.14, 0.13, 0.5], "sleeve", root).setLocalEulerAngles(36, -15, 0);
    this.addPrimitive("compact-hand-l", "box", [-0.06, -0.04, -0.62], [0.16, 0.14, 0.2], "glove", root).setLocalEulerAngles(0, 0, -8);
    this.addPrimitive("compact-forearm-l", "box", [-0.22, -0.18, -0.52], [0.13, 0.12, 0.44], "sleeve", root).setLocalEulerAngles(-28, 16, 0);
  }

  createRifleModel() {
    const root = this.createWeaponGroup("rifle", { muzzle: [0, 0.04, -1.35] });
    this.addPrimitive("rifle-receiver", "box", [0, 0, 0], [0.28, 0.18, 0.9], "blackMetal", root);
    this.addPrimitive("rifle-handguard", "box", [0, 0.015, -0.55], [0.22, 0.16, 0.72], "rail", root);
    this.addPrimitive("rifle-stock", "box", [0.04, -0.025, 0.48], [0.34, 0.18, 0.28], "blackMetal", root);
    this.addPrimitive("rifle-grip", "box", [0.02, -0.22, 0.2], [0.14, 0.36, 0.16], "blackMetal", root).setLocalEulerAngles(-12, 0, 0);
    this.addPrimitive("rifle-top-rail", "box", [0, 0.13, -0.18], [0.31, 0.035, 1.05], "rail", root);
    for (let i = 0; i < 7; i += 1) {
      this.addPrimitive(`rifle-rail-notch-${i}`, "box", [0, 0.17, 0.24 - i * 0.13], [0.34, 0.035, 0.045], "blackMetal", root);
    }
    this.addPrimitive("rifle-front-sight", "box", [0, 0.31, -0.82], [0.08, 0.23, 0.06], "gunmetalLight", root);
    this.addPrimitive("rifle-rear-sight", "box", [0, 0.25, 0.16], [0.12, 0.16, 0.06], "gunmetalLight", root);
    this.addPrimitive("rifle-barrel", "cylinder", [0, 0.04, -0.96], [0.045, 0.78, 0.045], "blackMetal", root).setLocalEulerAngles(90, 0, 0);
    this.addPrimitive("rifle-muzzle-crown", "cylinder", [0, 0.04, -1.38], [0.054, 0.05, 0.054], "gunmetalLight", root).setLocalEulerAngles(90, 0, 0);
    // Right hand on pistol grip + forearm; left support hand on handguard
    this.addPrimitive("rifle-hand-r", "box", [0.02, -0.22, 0.2], [0.16, 0.14, 0.2], "glove", root).setLocalEulerAngles(-12, 0, 4);
    this.addPrimitive("rifle-forearm-r", "box", [0.2, -0.38, 0.36], [0.14, 0.13, 0.5], "sleeve", root).setLocalEulerAngles(38, -15, 0);
    this.addPrimitive("rifle-hand-l", "box", [-0.04, -0.04, -0.55], [0.16, 0.14, 0.2], "glove", root).setLocalEulerAngles(0, 0, -8);
    this.addPrimitive("rifle-forearm-l", "box", [-0.22, -0.18, -0.44], [0.13, 0.12, 0.44], "sleeve", root).setLocalEulerAngles(-28, 16, 0);
  }

  createShotgunModel() {
    const root = this.createWeaponGroup("shotgun", { muzzle: [0, 0.02, -1.42], rootPosition: [0.5, -0.5, -0.98] });
    this.addPrimitive("shotgun-receiver", "box", [0.01, 0, -0.04], [0.3, 0.2, 0.62], "blackMetal", root);
    this.addPrimitive("shotgun-rib", "box", [0, 0.12, -0.62], [0.06, 0.02, 1.22], "gunmetalLight", root);
    this.addPrimitive("shotgun-pump", "box", [0, -0.005, -0.62], [0.3, 0.18, 0.48], "wood", root);
    this.addPrimitive("shotgun-stock", "box", [0.04, -0.02, 0.43], [0.4, 0.2, 0.36], "wood", root);
    this.addPrimitive("shotgun-barrel-a", "cylinder", [-0.04, 0.06, -0.96], [0.04, 0.84, 0.04], "blackMetal", root).setLocalEulerAngles(90, 0, 0);
    this.addPrimitive("shotgun-barrel-b", "cylinder", [0.04, 0.06, -0.96], [0.04, 0.84, 0.04], "blackMetal", root).setLocalEulerAngles(90, 0, 0);
    this.addPrimitive("shotgun-muzzle-a", "cylinder", [-0.04, 0.06, -1.4], [0.048, 0.04, 0.048], "gunmetalLight", root).setLocalEulerAngles(90, 0, 0);
    this.addPrimitive("shotgun-muzzle-b", "cylinder", [0.04, 0.06, -1.4], [0.048, 0.04, 0.048], "gunmetalLight", root).setLocalEulerAngles(90, 0, 0);
    this.addPrimitive("shotgun-bead-sight", "sphere", [0, 0.13, -1.36], [0.03, 0.03, 0.03], "gunmetalLight", root);
    // Right hand on pump grip + forearm; left support hand pumping the fore-end
    this.addPrimitive("shotgun-hand-r", "box", [0.04, -0.12, 0.18], [0.16, 0.14, 0.22], "glove", root).setLocalEulerAngles(-8, 0, 4);
    this.addPrimitive("shotgun-forearm-r", "box", [0.22, -0.28, 0.36], [0.14, 0.13, 0.5], "sleeve", root).setLocalEulerAngles(36, -14, 0);
    this.addPrimitive("shotgun-hand-l", "box", [-0.02, -0.06, -0.62], [0.16, 0.14, 0.22], "glove", root).setLocalEulerAngles(0, 0, -8);
    this.addPrimitive("shotgun-forearm-l", "box", [-0.2, -0.2, -0.52], [0.13, 0.12, 0.44], "sleeve", root).setLocalEulerAngles(-28, 16, 0);
  }

  createPrecisionModel() {
    const root = this.createWeaponGroup("precision", { muzzle: [0, 0.05, -1.72], rootPosition: [0.5, -0.5, -1.02] });
    this.addPrimitive("precision-body", "box", [0, 0, -0.08], [0.24, 0.16, 1.0], "blackMetal", root);
    this.addPrimitive("precision-stock", "box", [0.04, -0.02, 0.48], [0.36, 0.16, 0.34], "rail", root);
    this.addPrimitive("precision-scope", "cylinder", [0, 0.28, -0.22], [0.08, 0.52, 0.08], "metal", root).setLocalEulerAngles(90, 0, 0);
    this.addPrimitive("precision-scope-glass", "sphere", [0, 0.28, -0.5], [0.075, 0.075, 0.025], "impactGlass", root);
    this.addPrimitive("precision-barrel", "cylinder", [0, 0.04, -1.18], [0.035, 1.1, 0.035], "blackMetal", root).setLocalEulerAngles(90, 0, 0);
    this.addPrimitive("precision-muzzle-brake", "cylinder", [0, 0.04, -1.76], [0.05, 0.08, 0.05], "gunmetalLight", root).setLocalEulerAngles(90, 0, 0);
    this.addPrimitive("precision-bipod-l", "box", [-0.12, -0.18, -0.72], [0.04, 0.5, 0.04], "gunmetalLight", root).setLocalEulerAngles(18, 0, -12);
    this.addPrimitive("precision-bipod-r", "box", [0.12, -0.18, -0.72], [0.04, 0.5, 0.04], "gunmetalLight", root).setLocalEulerAngles(18, 0, 12);
    this.addPrimitive("precision-front-sight", "box", [0, 0.14, -1.52], [0.05, 0.08, 0.04], "gunmetalLight", root);
    // Right hand on pistol grip + forearm; left support hand near front
    this.addPrimitive("precision-hand-r", "box", [0.02, -0.18, 0.24], [0.16, 0.14, 0.2], "glove", root).setLocalEulerAngles(-10, 0, 4);
    this.addPrimitive("precision-forearm-r", "box", [0.2, -0.34, 0.4], [0.14, 0.13, 0.5], "sleeve", root).setLocalEulerAngles(38, -15, 0);
    this.addPrimitive("precision-hand-l", "box", [-0.04, -0.04, -0.72], [0.16, 0.14, 0.2], "glove", root).setLocalEulerAngles(0, 0, -8);
    this.addPrimitive("precision-forearm-l", "box", [-0.22, -0.18, -0.6], [0.13, 0.12, 0.44], "sleeve", root).setLocalEulerAngles(-28, 16, 0);
  }

  createHeavyModel() {
    const root = this.createWeaponGroup("heavy", { muzzle: [0, 0.06, -1.45], rootPosition: [0.54, -0.49, -1.02] });
    this.addPrimitive("heavy-receiver", "box", [0, 0, -0.08], [0.38, 0.26, 0.9], "blackMetal", root);
    this.addPrimitive("heavy-top-cover", "box", [0, 0.145, -0.08], [0.38, 0.025, 0.9], "gunmetalLight", root);
    this.addPrimitive("heavy-feed", "box", [-0.26, -0.04, -0.06], [0.24, 0.12, 0.54], "gunmetalLight", root);
    this.addPrimitive("heavy-box-mag", "box", [0.08, -0.26, -0.12], [0.34, 0.42, 0.36], "rail", root);
    this.addPrimitive("heavy-stock", "box", [0.08, -0.02, 0.5], [0.42, 0.2, 0.34], "blackMetal", root);
    this.addPrimitive("heavy-barrel", "cylinder", [0, 0.06, -1.02], [0.052, 0.88, 0.052], "blackMetal", root).setLocalEulerAngles(90, 0, 0);
    this.addPrimitive("heavy-flash-hider", "cylinder", [0, 0.06, -1.5], [0.062, 0.1, 0.062], "gunmetalLight", root).setLocalEulerAngles(90, 0, 0);
    this.addPrimitive("heavy-front-sight", "box", [0, 0.24, -1.08], [0.06, 0.1, 0.04], "gunmetalLight", root);
    // Right hand + forearm; left support hand on the box-mag area / foregrip
    this.addPrimitive("heavy-hand-r", "box", [0.08, -0.12, 0.28], [0.16, 0.14, 0.22], "glove", root).setLocalEulerAngles(-6, 0, 4);
    this.addPrimitive("heavy-forearm-r", "box", [0.24, -0.28, 0.46], [0.14, 0.13, 0.5], "sleeve", root).setLocalEulerAngles(36, -14, 0);
    this.addPrimitive("heavy-hand-l", "box", [-0.06, -0.06, -0.44], [0.16, 0.14, 0.22], "glove", root).setLocalEulerAngles(0, 0, -8);
    this.addPrimitive("heavy-forearm-l", "box", [-0.24, -0.22, -0.32], [0.13, 0.12, 0.46], "sleeve", root).setLocalEulerAngles(-30, 16, 0);
  }

  createLauncherModel() {
    const root = this.createWeaponGroup("launcher", { muzzle: [0, 0.06, -1.22], rootPosition: [0.55, -0.47, -0.93] });
    this.addPrimitive("launcher-tube", "cylinder", [0, 0.07, -0.35], [0.17, 1.45, 0.17], "blackMetal", root).setLocalEulerAngles(90, 0, 0);
    this.addPrimitive("launcher-mouth", "cylinder", [0, 0.07, -1.08], [0.22, 0.12, 0.22], "gunmetalLight", root).setLocalEulerAngles(90, 0, 0);
    this.addPrimitive("launcher-mouth-inner", "cylinder", [0, 0.07, -1.14], [0.17, 0.04, 0.17], "gunmetalLight", root).setLocalEulerAngles(90, 0, 0);
    this.addPrimitive("launcher-grip", "box", [0.02, -0.23, -0.18], [0.16, 0.4, 0.18], "rail", root).setLocalEulerAngles(-10, 0, 0);
    this.addPrimitive("launcher-sight", "box", [0, 0.34, -0.25], [0.12, 0.18, 0.22], "gunmetalLight", root);
    this.addPrimitive("launcher-rear-sight", "box", [0, 0.34, 0.28], [0.08, 0.12, 0.06], "gunmetalLight", root);
    // Right hand on pistol grip + forearm; left support hand under tube
    this.addPrimitive("launcher-hand-r", "box", [0.02, -0.23, -0.18], [0.16, 0.14, 0.2], "glove", root).setLocalEulerAngles(-10, 0, 4);
    this.addPrimitive("launcher-forearm-r", "box", [0.2, -0.38, 0.02], [0.14, 0.13, 0.5], "sleeve", root).setLocalEulerAngles(38, -15, 0);
    this.addPrimitive("launcher-hand-l", "box", [-0.04, -0.02, -0.62], [0.16, 0.14, 0.22], "glove", root).setLocalEulerAngles(0, 0, -10);
    this.addPrimitive("launcher-forearm-l", "box", [-0.22, -0.16, -0.5], [0.13, 0.12, 0.44], "sleeve", root).setLocalEulerAngles(-28, 16, 0);
  }

  createFlamethrowerModel() {
    const root = this.createWeaponGroup("flamethrower", { muzzle: [0.02, 0.02, -1.18], rootPosition: [0.52, -0.5, -0.9] });
    this.addPrimitive("flame-nozzle", "cylinder", [0.02, 0.02, -0.82], [0.05, 0.74, 0.05], "gunmetalLight", root).setLocalEulerAngles(90, 0, 0);
    this.addPrimitive("flame-nozzle-tip", "cylinder", [0.02, 0.02, -1.2], [0.038, 0.06, 0.038], "gunmetalLight", root).setLocalEulerAngles(90, 0, 0);
    this.addPrimitive("flame-body", "box", [0, 0, -0.22], [0.24, 0.16, 0.62], "blackMetal", root);
    this.addPrimitive("flame-body-top", "box", [0, 0.09, -0.22], [0.24, 0.02, 0.62], "gunmetalLight", root);
    this.addPrimitive("flame-tank-a", "cylinder", [0.22, -0.06, 0.05], [0.11, 0.52, 0.11], "pumpkin", root).setLocalEulerAngles(0, 0, 0);
    this.addPrimitive("flame-tank-b", "cylinder", [0.36, -0.06, 0.05], [0.11, 0.52, 0.11], "pumpkin", root).setLocalEulerAngles(0, 0, 0);
    this.addPrimitive("flame-hose", "box", [0.22, -0.18, -0.34], [0.07, 0.07, 0.62], "blackMetal", root).setLocalEulerAngles(0, 18, 0);
    // Right hand on body grip + forearm; left support hand near nozzle base
    this.addPrimitive("flame-hand-r", "box", [0.04, -0.14, 0.04], [0.16, 0.14, 0.2], "glove", root).setLocalEulerAngles(-4, 0, 4);
    this.addPrimitive("flame-forearm-r", "box", [0.2, -0.3, 0.22], [0.14, 0.13, 0.5], "sleeve", root).setLocalEulerAngles(36, -14, 0);
    this.addPrimitive("flame-hand-l", "box", [-0.02, -0.02, -0.52], [0.16, 0.14, 0.22], "glove", root).setLocalEulerAngles(0, 0, -10);
    this.addPrimitive("flame-forearm-l", "box", [-0.2, -0.16, -0.4], [0.13, 0.12, 0.44], "sleeve", root).setLocalEulerAngles(-28, 14, 0);
  }

  createPipeModel() {
    const root = this.createWeaponGroup("pipe", {
      muzzle: [0.18, 0.12, -0.88],
      rootPosition: [0.42, -0.5, -0.82],
      rootEuler: [8, -16, -28],
    });
    this.addPrimitive("pipe-shaft", "cylinder", [0, 0.04, -0.38], [0.055, 1.35, 0.055], "metal", root).setLocalEulerAngles(36, 0, -18);
    this.addPrimitive("pipe-wrap", "box", [-0.08, -0.16, 0.08], [0.18, 0.26, 0.2], "wood", root).setLocalEulerAngles(0, 0, -18);
    this.addPrimitive("pipe-coupler", "cylinder", [0.2, 0.26, -0.9], [0.09, 0.18, 0.09], "gunmetalLight", root).setLocalEulerAngles(36, 0, -18);
    this.addPrimitive("pipe-cap", "cylinder", [0.28, 0.34, -1.06], [0.1, 0.06, 0.1], "gunmetalLight", root).setLocalEulerAngles(36, 0, -18);
    // Right hand + forearm only (single-hand melee/shotgun)
    this.addPrimitive("pipe-hand-r", "box", [-0.08, -0.16, 0.08], [0.16, 0.14, 0.2], "glove", root).setLocalEulerAngles(0, 0, -22);
    this.addPrimitive("pipe-forearm-r", "box", [0.06, -0.34, 0.24], [0.14, 0.13, 0.5], "sleeve", root).setLocalEulerAngles(40, -14, -18);
  }

  updateWeaponVisuals() {
    if (!this.weaponModels) {
      return;
    }
    const weapon = getPlayCanvasWeaponSnapshot(this.state);
    const model = this.weaponModels.get(weapon.viewModel) ?? this.weaponModels.get("sidearm");
    if (this.activeWeaponViewModel !== weapon.viewModel) {
      for (const [key, entity] of this.weaponModels.entries()) {
        entity.enabled = key === weapon.viewModel;
      }
      this.activeWeaponViewModel = weapon.viewModel;
    }
    const position = model?._rootPosition ?? [0.48, -0.5, -0.95];
    const euler = model?._rootEuler ?? [-1, -6, 0];
    const kick = Math.max(0, this.weaponKickSec ?? 0) / Math.max(0.001, this.weaponKickMaxSec ?? 1);
    const kickPower = Math.max(0, this.weaponKickPower ?? 0);
    this.weaponRoot.setLocalPosition(position[0], position[1] - kick * kickPower * 0.2, position[2] + kick * kickPower);
    this.weaponRoot.setLocalEulerAngles(euler[0] + kick * kickPower * 20, euler[1], euler[2]);
    const muzzle = model?._muzzle ?? [0, 0.04, -1.35];
    if (this.muzzleFlash) {
      this.muzzleFlash.setLocalPosition(muzzle[0], muzzle[1], muzzle[2]);
    }
    if (this.reticle) {
      this.reticle.dataset.reticle = weapon.reticle;
      const ads = this.state.player?.ads ?? false;
      const crouching = this.state.player?.crouching ?? false;
      const sprinting = this.input.sprint && !crouching;
      const spreadMult = ads ? 0.4 : crouching ? 0.65 : sprinting ? 2.0 : 1.0;
      this.reticle.dataset.ads = ads ? "1" : "0";
      this.reticle.style.setProperty("--spread-mult", String(spreadMult));
    }
    this.root.dataset.weaponFamily = weapon.family;
    this.root.dataset.weaponViewModel = weapon.viewModel;
  }

  createGearVisuals() {
    this.fireEntitiesByPatch = new Map();
    this.flashlight = new pc.Entity("player-flashlight");
    this.flashlight.addComponent("light", {
      type: "spot",
      color: new pc.Color(0.86, 0.96, 0.82),
      intensity: 4.8,
      range: 32,
      innerConeAngle: 18,
      outerConeAngle: 32,
      castShadows: false,
    });
    this.flashlight.setLocalPosition(0.18, -0.08, -0.12);
    this.flashlight.enabled = false;
    this.camera.addChild(this.flashlight);
  }

  createZombieEntity(zombie) {
    let root;
    if (this.useGlbZombies && this.glbContainer) {
      // GLB path — skinned Quaternius model
      root = createZombieGlbEntity(this.app, zombie, this.glbContainer);
      // Attach bloom corona spheres alongside the GLB eye entities.
      // zombieGlb.js cannot be modified (in-flight), so we add them here.
      // Coronas are siblings on root (not children of eye entities) to avoid
      // inheriting the eye entity's local scale.  Their positions are synced
      // to the eye entities each frame in updateZombies after animateZombieGlbEntity.
      const coronaMat = this.materials.get("zombieEyeCorona");
      if (coronaMat) {
        const cs = 0.22; // world-space corona diameter — 4x GLB eye sphere (~0.055u)
        for (const side of ["coronaL", "coronaR"]) {
          const c = new pc.Entity(`glb-bloom-${side}-${zombie.id}`);
          c.addComponent("render", {
            type: "sphere",
            material: coronaMat,
            castShadows: false,
            receiveShadows: false,
          });
          c.setLocalScale(cs, cs, cs);
          root.addChild(c);
          root[`_bloomCorona${side === "coronaL" ? "L" : "R"}`] = c;
        }
      }
    } else {
      // Procedural rig — default behavior (also used as fallback if container not yet loaded)
      // Eye corona spheres are added inside createZombieRig / zombieRig.js.
      root = createZombieRig(this.app, this.materials, zombie);
    }
    this.entitiesByZombie.set(zombie.id, root);
    return root;
  }

  addPrimitive(name, type, position, scale, materialKey, parent = this.app.root) {
    const entity = new pc.Entity(name);
    entity.addComponent("render", {
      type,
      material: this.materials.get(materialKey),
      castShadows: true,
      receiveShadows: true,
    });
    entity.setLocalPosition(position[0], position[1], position[2]);
    entity.setLocalScale(scale[0], scale[1], scale[2]);
    parent.addChild(entity);
    return entity;
  }

  registerWindowEntity(id, entity) {
    this.entitiesByWindow.set(id, entity);
    return entity;
  }

  attachInput() {
    this.root.querySelector('[data-action="start"]').addEventListener("click", () => this.startOrContinueCampaign({ pointerLock: true }));
    this.root.querySelector('[data-action="reset"]').addEventListener("click", () => this.reset());
    this.root.querySelector('[data-action="restart"]').addEventListener("click", () => this.restart());
    this.root.querySelector('[data-action="music"]').addEventListener("click", () => this.toggleMusic());
    this.root.querySelector('[data-action="sfx"]').addEventListener("click", () => this.toggleSfx());
    this.root.querySelector('[data-action="haptics"]').addEventListener("click", () => this.toggleHaptics());
    this.root.querySelector('[data-action="fullscreen"]').addEventListener("click", () => this.toggleFullscreen());
    this.root.querySelector('[data-action="shop"]').addEventListener("click", () => this.toggleShop());
    this.root.querySelector('[data-action="map"]').addEventListener("click", () => this.toggleMiniMap());
    const hudSettingsBtn = this.root.querySelector('[data-action="hud-settings"]');
    if (hudSettingsBtn) {
      hudSettingsBtn.addEventListener("click", () => this.toggleHudSettings());
    }
    // "⋯ More" button toggles the secondary-action popover
    const moreBtn = this.root.querySelector('[data-action="more"]');
    if (moreBtn) {
      moreBtn.addEventListener("click", () => this.toggleMorePopover());
    }
    // Close more popover when any secondary action is triggered
    if (this.morePopover) {
      this.morePopover.addEventListener("pointerdown", () => {
        // small delay so the action registers before hiding
        setTimeout(() => this.closeMorePopover(), 120);
      });
    }
    // Settings backdrop click closes the sheet
    const backdrop = this.root.querySelector(".zi-settings-backdrop");
    if (backdrop) {
      backdrop.addEventListener("click", () => this.toggleHudSettings());
    }
    // Resume button also closes the sheet
    const resumeBtn = this.root.querySelector('[data-action="settings-resume"]');
    if (resumeBtn) {
      resumeBtn.addEventListener("click", () => this.toggleHudSettings());
    }
    this.flowPanel.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-flow-action]");
      if (!button) {
        return;
      }
      if (button.dataset.flowAction === "primary") {
        if (this.state.phase === "lost" || this.state.phase === "won") {
          this.restartAndStart();
        } else {
          this.startOrContinueCampaign({ pointerLock: true });
        }
      } else if (button.dataset.flowAction === "revive") {
        this._triggerReviveAd();
      } else if (button.dataset.flowAction === "stats") {
        this._toggleMenuSection("lifetime");
      } else if (button.dataset.flowAction === "goals") {
        this._toggleMenuSection("goals");
        this.renderGoals();
      } else if (button.dataset.flowAction === "settings") {
        this._toggleMenuSection("settings");
      } else if (button.dataset.flowAction === "shop") {
        this.shopOpen = true;
        this.updateHud();
      } else if (button.dataset.flowAction === "reset") {
        this.reset();
      }
    });
    this.flowPanel.addEventListener("change", (event) => {
      const input = event.target.closest("[data-menu-setting]");
      if (!input) return;
      const setting = input.dataset.menuSetting;
      if (setting === "musicEnabled" || setting === "sfxEnabled") {
        setPlayCanvasAudioSettings(this.state, {
          musicEnabled: setting === "musicEnabled" ? input.checked : this.state.musicEnabled,
          sfxEnabled: setting === "sfxEnabled" ? input.checked : this.state.sfxEnabled,
        });
        this.updateHud();
      } else if (setting === "qualityPreset") {
        this.state.qualityPreset = input.value === "auto" ? null : input.value;
        this.state.qualityPresetLabel = input.value;
      }
    });
    // Rewarded-offer click handler (flow panel game-over offers + summary overlay offers)
    const handleOfferClick = (event) => {
      const btn = event.target.closest("button[data-offer-id]");
      if (!btn || btn.disabled) return;
      const offerId = btn.dataset.offerId;
      const claimKey = btn.dataset.claimKey;
      this._triggerOfferAd(offerId, claimKey, btn);
    };
    if (this.gameOverOfferList) {
      this.gameOverOfferList.addEventListener("click", handleOfferClick);
    }
    if (this.summaryOfferList) {
      this.summaryOfferList.addEventListener("click", handleOfferClick);
    }

    this.shopItemsRoot.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-shop-type]");
      if (!button) {
        return;
      }
      if (button.dataset.shopType === "weapon") {
        buyOrEquipWeapon(this.state, button.dataset.shopId);
      } else if (button.dataset.shopType === "armor") {
        buyOrEquipArmor(this.state, button.dataset.shopId);
      } else if (button.dataset.shopType === "grenade") {
        buyGrenadePack(this.state, button.dataset.shopId);
      } else if (button.dataset.shopType === "c4") {
        buyC4Pack(this.state, button.dataset.shopId);
      } else if (button.dataset.shopType === "nuke") {
        buyNukePack(this.state, button.dataset.shopId);
      } else if (button.dataset.shopType === "gear") {
        buyGearItem(this.state, button.dataset.shopId);
      } else if (button.dataset.shopType === "village") {
        buyVillageUpgrade(this.state);
      } else if (button.dataset.shopType === "medkit") {
        buyMedKit(this.state);
      }
      this._sfxShopBuy();
      this.updateHud();
      this.renderShop();
    });

    window.addEventListener("keydown", (event) => this.setKey(event, true));
    window.addEventListener("keyup", (event) => this.setKey(event, false));
    this.root.querySelector('[data-action="ordnance"]').addEventListener("click", () => this.useActiveOrdnance());
    this.attachTouchControls();
    window.addEventListener("mousemove", (event) => this.handleLookMove(event));
    window.addEventListener("pointerup", () => {
      this.input.dragLooking = false;
    });
    window.addEventListener("blur", () => {
      this.input.dragLooking = false;
    });
    // pointerlockchange / pointerlockerror fire on document, not window.
    document.addEventListener("pointerlockchange", () => {
      this.input.pointerLocked = document.pointerLockElement === this.canvas;
      if (this.input.pointerLocked) {
        this.input.dragLooking = false;
        this.state.lastMessage = "Mouse look active — click to fire, Esc to release.";
        this.updateHud();
      }
    });
    document.addEventListener("pointerlockerror", () => {
      this.input.pointerLocked = false;
      this.state.lastMessage = "Pointer lock unavailable here; drag the mouse to look around.";
      this.updateHud();
    });
    this.canvas.addEventListener("pointerdown", (event) => {
      if (event.target.closest?.("button, a")) {
        return;
      }
      if (event.button === 2) {
        event.preventDefault();
        this.input.ads = true;
        setPlayerAds(this.state, true);
        return;
      }
      if (event.button !== 0) {
        return;
      }
      // Touch events in the right zone are handled by the look-zone handler;
      // skip the dragLooking path for them to avoid dual-handling.
      if (event.pointerType !== "mouse") {
        return;
      }
      this.input.dragLooking = true;
      this.input.lastPointerX = event.clientX;
      this.input.lastPointerY = event.clientY;
      this.canvas.setPointerCapture?.(event.pointerId);
    });
    this.canvas.addEventListener("pointerup", (event) => {
      if (event.button === 2) {
        this.input.ads = false;
        setPlayerAds(this.state, false);
      }
    });
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    this.canvas.addEventListener("click", () => {
      this.unlockAudio();
      if (this.state.phase === "ready") {
        this.startOrContinueCampaign();
      }
      // Only grab the pointer / fire while we're in active combat. During
      // intermission (and other menu phases) the flow panel + shop are up, so a
      // background click must not re-lock the pointer or fire — that would hide
      // the cursor and re-engage mouse-look behind the modal.
      if (!isActivePlayPhase(this.state.phase)) {
        return;
      }
      this.requestPointerLock();
      this.fire();
    });
  }

  handleLookMove(event) {
    if (this.input.pointerLocked) {
      this.applyLookDelta(event.movementX, event.movementY);
      return;
    }
    if (!this.input.dragLooking || !isActivePlayPhase(this.state.phase)) {
      return;
    }
    const dx = event.clientX - this.input.lastPointerX;
    const dy = event.clientY - this.input.lastPointerY;
    this.input.lastPointerX = event.clientX;
    this.input.lastPointerY = event.clientY;
    this.applyLookDelta(dx, dy);
  }

  applyLookDelta(dx, dy) {
    // Single chokepoint for every look source (pointer-lock, mouse drag, touch).
    // Suppress look entirely outside active combat so the camera can't be moved
    // while the intermission / menu panels are up.
    if (!isActivePlayPhase(this.state.phase)) {
      return;
    }
    this.yaw -= dx * 0.0022;
    this.pitch = clamp(this.pitch - dy * 0.11, -34, 24);
    this.state.player.yaw = this.yaw;
  }

  attachTouchControls() {
    // ── Virtual joystick (replaces the old 4-button d-pad) ──────────────────
    this._attachVirtualJoystick();

    const touchButtons = this.root.querySelectorAll("[data-touch-action]");
    for (const button of touchButtons) {
      const setActive = (active) => {
        const action = button.dataset.touchAction;
        if (action === "sprint") {
          this.input.sprint = active;
        } else if (action === "cycle" && active) {
          this.cycleWeapon();
        } else if (action === "ordnance" && active) {
          this.useActiveOrdnance();
        } else if (action === "flint" && active) {
          this.useFlint();
        } else if (action === "interact" && active) {
          this.interact();
        } else if (action === "map" && active) {
          this.toggleMiniMap();
        } else if (action === "shop" && active) {
          this.toggleShop();
        } else if (action === "crouch") {
          this.input.crouch = active;
        } else if (action === "jump" && active) {
          this.input.jump = true;
        } else if (action === "ads") {
          this.input.ads = active;
          setPlayerAds(this.state, active);
        } else if (action === "fire" && active) {
          this.unlockAudio();
          if (this.state.phase === "ready") {
            startSlice(this.state);
            this.playWaveStartAudio();
          }
          this.fire();
        }
        button.classList.toggle("is-active", active);
      };
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        button.setPointerCapture?.(event.pointerId);
        setActive(true);
      });
      button.addEventListener("pointerup", (event) => {
        event.preventDefault();
        setActive(false);
      });
      button.addEventListener("pointercancel", () => setActive(false));
      button.addEventListener("lostpointercapture", () => setActive(false));
    }
    this.attachTouchLookZone();
  }

  // ── Virtual joystick (left zone) ─────────────────────────────────────────────
  // Touches starting in the bottom-left ~45% width / lower 55% height spawn a
  // floating joystick base at the touch point. The knob vector maps to the
  // discrete forward/back/left/right input booleans. Multi-touch safe.
  _attachVirtualJoystick() {
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (!isTouch) return;

    const JOYSTICK_RADIUS = 50; // px clamp radius
    const DEAD = 0.35;          // normalised dead zone threshold

    // Build DOM elements for base+knob
    const base = document.createElement("div");
    base.className = "pc-joystick-base";
    base.setAttribute("aria-hidden", "true");
    const knob = document.createElement("div");
    knob.className = "pc-joystick-knob";
    base.appendChild(knob);
    this.root.appendChild(base);
    this._joystickBase = base;
    this._joystickKnob = knob;
    this._joystickPointerId = null;

    const clearMove = () => {
      this.input.forward = 0;
      this.input.back = 0;
      this.input.left = 0;
      this.input.right = 0;
    };

    const setKnob = (dx, dy) => {
      const mag = Math.hypot(dx, dy);
      const clamped = Math.min(mag, JOYSTICK_RADIUS);
      const kx = mag > 0 ? (dx / mag) * clamped : 0;
      const ky = mag > 0 ? (dy / mag) * clamped : 0;
      knob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
      const nx = mag > 0 ? dx / mag : 0; // normalised -1..1
      const ny = mag > 0 ? dy / mag : 0;
      this.input.forward = ny < -DEAD ? 1 : 0;
      this.input.back    = ny >  DEAD ? 1 : 0;
      this.input.left    = nx < -DEAD ? 1 : 0;
      this.input.right   = nx >  DEAD ? 1 : 0;
    };

    // Zone: bottom-left 45% width, lower 55% height (excluding button elements)
    const inJoystickZone = (event) => {
      if (event.target.closest?.("button, a")) return false;
      const relX = event.clientX / window.innerWidth;
      const relY = event.clientY / window.innerHeight;
      return relX < 0.45 && relY > 0.45;
    };

    const onPointerDown = (event) => {
      if (this._joystickPointerId !== null) return; // already tracking
      if (!inJoystickZone(event)) return;
      this._joystickPointerId = event.pointerId;
      this._joystickOriginX = event.clientX;
      this._joystickOriginY = event.clientY;
      base.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
      base.classList.add("is-active");
      knob.style.transform = "translate(-50%, -50%)";
      event.preventDefault();
    };

    const onPointerMove = (event) => {
      if (this._joystickPointerId !== event.pointerId) return;
      const dx = event.clientX - this._joystickOriginX;
      const dy = event.clientY - this._joystickOriginY;
      setKnob(dx, dy);
      event.preventDefault();
    };

    const onPointerUp = (event) => {
      if (this._joystickPointerId !== event.pointerId) return;
      this._joystickPointerId = null;
      base.classList.remove("is-active");
      knob.style.transform = "translate(-50%, -50%)";
      clearMove();
    };

    window.addEventListener("pointerdown", onPointerDown, { passive: false });
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  }

  // ── Right-zone touch look ─────────────────────────────────────────────────────
  // Touches starting in the right 55% of the canvas (and not on a button) drive
  // yaw/pitch via continuous delta, matching the feel of the legacy right stick.
  // Sensitivity is viewport-scaled; response curve + dead-zone mirror the legacy
  // mobileFpsControls right-stick (deadzone 0.24, exponent 1.75, gain 0.62).
  // Multi-touch safe: each touch has its own pointerId; the look touch keeps
  // working while move/fire buttons are held.
  attachTouchLookZone() {
    // Only active on coarse-pointer (touch) devices. Desktop mouse paths are
    // handled by handleLookMove and pointerLock — those remain unchanged.
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (!isTouch) {
      return;
    }

    this._buildLookGhost();

    const LOOK_ZONE_SPLIT = 0.45; // left 45% = move zone; right 55% = look zone
    const DEADZONE = 0.24;        // matches legacy right-stick
    const EXPONENT = 1.75;        // legacy right-stick power curve
    const GAIN = 0.62;            // legacy right-stick gain
    // Sensitivity: yaw degrees per px * (viewport normalisation). Tuned so a
    // ~100px swipe rotates ~90°; pitch capped by existing clamp (-34..24).
    const YAW_SENS_BASE = 0.0028;  // radians per css-pixel (pointer: coarse thumb)
    const PITCH_SENS_BASE = 0.13;  // degrees per css-pixel
    const SMOOTH = 0.28;           // exponential smoothing factor (0=frozen, 1=raw)

    const applyLookResponse = (normalised) => {
      const sign = Math.sign(normalised);
      const abs = Math.abs(normalised);
      if (abs <= DEADZONE) return 0;
      const n = (abs - DEADZONE) / (1 - DEADZONE);
      const curved = Math.pow(clamp(n, 0, 1), EXPONENT) * GAIN;
      return clamp(curved, 0, 1) * sign;
    };

    const onPointerDown = (event) => {
      // Ignore if something else already captured this pointer (e.g. a button).
      if (event.target.closest?.("button, a")) return;
      // Already tracking a look touch?
      if (this.input.lookTouch !== null) return;
      // Must start in the right look zone.
      const canvasRect = this.canvas.getBoundingClientRect();
      const relX = (event.clientX - canvasRect.left) / canvasRect.width;
      if (relX < LOOK_ZONE_SPLIT) return;

      this.canvas.setPointerCapture?.(event.pointerId);
      this.input.lookTouch = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        curX: event.clientX,
        curY: event.clientY,
      };
      this.input.lookVelX = 0;
      this.input.lookVelY = 0;
      this._showLookGhost(event.clientX, event.clientY);
      event.preventDefault();
    };

    const onPointerMove = (event) => {
      if (!this.input.lookTouch) return;
      if (event.pointerId !== this.input.lookTouch.id) return;
      const lt = this.input.lookTouch;
      const dx = event.clientX - lt.curX;
      const dy = event.clientY - lt.curY;
      lt.curX = event.clientX;
      lt.curY = event.clientY;
      // Normalise delta to a ±1 range by viewport scale so sensitivity is
      // consistent across screen sizes.
      const vpW = window.innerWidth || 360;
      const vpH = window.innerHeight || 640;
      const ndx = dx / (vpW * 0.08);   // ÷8% of viewport width ≈ full deflection at 80px
      const ndy = dy / (vpH * 0.08);
      // Apply response curve
      const rx = applyLookResponse(clamp(ndx, -1, 1));
      const ry = applyLookResponse(clamp(ndy, -1, 1));
      // Exponential smoothing — damp jitter while keeping responsiveness
      this.input.lookVelX = this.input.lookVelX * (1 - SMOOTH) + rx * SMOOTH;
      this.input.lookVelY = this.input.lookVelY * (1 - SMOOTH) + ry * SMOOTH;
      this._updateLookGhost(event.clientX, event.clientY);
      event.preventDefault();
    };

    const onPointerUp = (event) => {
      if (!this.input.lookTouch) return;
      if (event.pointerId !== this.input.lookTouch.id) return;
      this.input.lookTouch = null;
      this.input.lookVelX = 0;
      this.input.lookVelY = 0;
      this._hideLookGhost();
    };

    this.canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
    this.canvas.addEventListener("pointermove", onPointerMove, { passive: false });
    this.canvas.addEventListener("pointerup", onPointerUp);
    this.canvas.addEventListener("pointercancel", onPointerUp);
  }

  _buildLookGhost() {
    if (this._lookGhostEl) return;
    const ghost = document.createElement("div");
    ghost.className = "pc-look-ghost";
    ghost.setAttribute("aria-hidden", "true");
    const knob = document.createElement("div");
    knob.className = "pc-look-ghost-knob";
    ghost.appendChild(knob);
    this.root.appendChild(ghost);
    this._lookGhostEl = ghost;
    this._lookGhostKnob = knob;
    this._lookGhostOriginX = 0;
    this._lookGhostOriginY = 0;
  }

  _showLookGhost(x, y) {
    if (!this._lookGhostEl) return;
    this._lookGhostOriginX = x;
    this._lookGhostOriginY = y;
    this._lookGhostEl.style.transform = `translate(${x}px, ${y}px)`;
    this._lookGhostEl.classList.add("is-active");
    this._lookGhostKnob.style.transform = "translate(-50%, -50%)";
  }

  _updateLookGhost(x, y) {
    if (!this._lookGhostEl || !this._lookGhostEl.classList.contains("is-active")) return;
    const GHOST_RADIUS = 40;
    const ox = this._lookGhostOriginX;
    const oy = this._lookGhostOriginY;
    const dx = x - ox;
    const dy = y - oy;
    const mag = Math.hypot(dx, dy);
    const clampedMag = Math.min(mag, GHOST_RADIUS);
    const kx = mag > 0 ? (dx / mag) * clampedMag : 0;
    const ky = mag > 0 ? (dy / mag) * clampedMag : 0;
    this._lookGhostKnob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
  }

  _hideLookGhost() {
    if (!this._lookGhostEl) return;
    this._lookGhostEl.classList.remove("is-active");
    this._lookGhostKnob.style.transform = "translate(-50%, -50%)";
  }

  requestPointerLock() {
    const result = this.canvas.requestPointerLock?.();
    if (result && typeof result.catch === "function") {
      result.catch(() => {
        this.state.lastMessage = "Pointer lock unavailable here; drag the mouse to look around.";
        this.updateHud();
      });
    }
  }

  setKey(event, active) {
    if (active) {
      this.unlockAudio();
    }
    if (active && (event.code === "Enter" || event.code === "NumpadEnter")) {
      if (this.state.phase === "ready" || this.state.phase === "intermission") {
        event.preventDefault();
        this.startOrContinueCampaign({ pointerLock: true });
        return;
      }
      if (this.state.phase === "lost" || this.state.phase === "won") {
        event.preventDefault();
        this.restartAndStart();
        return;
      }
    }
    if (event.code === "KeyW" || event.code === "ArrowUp") this.input.forward = active ? 1 : 0;
    if (event.code === "KeyS" || event.code === "ArrowDown") this.input.back = active ? 1 : 0;
    if (event.code === "KeyA" || event.code === "ArrowLeft") this.input.left = active ? 1 : 0;
    if (event.code === "KeyD" || event.code === "ArrowRight") this.input.right = active ? 1 : 0;
    if (event.code === "ShiftLeft" || event.code === "ShiftRight") this.input.sprint = active;
    if (event.code === "ControlLeft" || event.code === "ControlRight") {
      this.input.crouch = active;
      if (active) event.preventDefault();
    }
    if (event.code === "Space") {
      this.input.jump = active;
      if (active) event.preventDefault();
    }
    if (event.code === "KeyV") this.input.ads = active;
    if (event.code === "KeyR" && active) reloadSliceWeapon(this.state);
    if (event.code === "KeyQ" && active) this.toggleShop();
    if (event.code === "KeyO" && active) this.cycleWeapon();
    if (active) this.selectWeaponByKey(event.code);
    if (event.code === "KeyC" && active) this.cycleActiveOrdnance();
    if (event.code === "KeyG" && active) this.useActiveOrdnance();
    if (event.code === "KeyT" && active) this.useFlint();
    if (event.code === "KeyE" && active) this.interact();
    if (event.code === "KeyM" && active) this.toggleMiniMap();
    if (event.code === "Escape" && active && this.shopOpen) this.closeShop();
    if (event.code === "KeyF" && active) this.toggleFullscreen();
  }

  toggleShop() {
    if (this.state.phase === "ready" || this.state.phase === "secret_boss" || this.state.phase === "lost" || this.state.phase === "won") {
      this.shopOpen = false;
    } else {
      this.shopOpen = !this.shopOpen;
    }
    this._sfxUiClick();
    this.updateHud();
  }

  toggleMiniMap() {
    this.minimapOpen = !this.minimapOpen;
    this.updateMiniMapVisibility();
  }

  updateMiniMapVisibility() {
    if (this.minimapPanel) {
      this.minimapPanel.hidden = !this.minimapOpen || this.shopOpen || !isActivePlayPhase(this.state.phase);
    }
  }

  closeShop() {
    this.shopOpen = false;
    this.updateHud();
  }

  unlockAudio() {
    this.audio.unlockAudio?.();
  }

  toggleMusic() {
    const settings = setPlayCanvasAudioSettings(this.state, { musicEnabled: !this.state.musicEnabled });
    this.audio.setMusicEnabled(settings.musicEnabled);
    if (settings.musicEnabled) {
      this.updateAudioState(0, { force: true });
    }
    this.updateHud();
  }

  toggleSfx() {
    const settings = setPlayCanvasAudioSettings(this.state, { sfxEnabled: !this.state.sfxEnabled });
    this.audio.setSfxEnabled(settings.sfxEnabled);
    this.updateHud();
  }

  toggleHaptics() {
    this.hapticsEnabled = !this.hapticsEnabled;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("zi_haptics", String(this.hapticsEnabled));
    }
    this.updateHud();
  }

  _vibrate(pattern) {
    if (!this.hapticsEnabled) return;
    try { navigator.vibrate?.(pattern); } catch { /* ignore */ }
  }

  toggleHudSettings() {
    if (!this.settingsSheet) return;
    const isOpen = !this.settingsSheet.hidden;
    this.settingsSheet.hidden = isOpen;
    this._sfxUiClick();
  }

  toggleMorePopover() {
    if (!this.morePopover) return;
    this.morePopover.hidden = !this.morePopover.hidden;
  }

  closeMorePopover() {
    if (this.morePopover) this.morePopover.hidden = true;
  }

  startOrContinueCampaign({ pointerLock = false } = {}) {
    const previousPhase = this.state.phase;
    this.unlockAudio();
    this._sfxUiClick();
    startSlice(this.state);
    this.shopOpen = false;
    if (this.state.phase === "running" && previousPhase !== "running") {
      this.playWaveStartAudio();
    }
    if (pointerLock) {
      this.requestPointerLock();
    }
    this.updateAudioState(0, { force: true });
    this.updateHud();
  }

  restartAndStart() {
    this.state = restartCampaign();
    this.clearZombieEntities();
    this.yaw = 0;
    this.pitch = -6;
    this.shopOpen = false;
    startSlice(this.state);
    this.playWaveStartAudio();
    this.requestPointerLock();
    this.updateAudioState(0, { force: true });
    this.updateHud();
  }

  cycleWeapon() {
    cycleOwnedWeapon(this.state);
    this.updateHud();
    if (this.shopOpen) {
      this.renderShop();
    }
  }

  selectWeaponByKey(code) {
    const slot = WEAPON_SLOT_BINDINGS.find((binding) => binding.code === code);
    if (!slot) {
      return;
    }
    equipOwnedWeapon(this.state, slot.id);
    this.updateHud();
    if (this.shopOpen) {
      this.renderShop();
    }
  }

  cycleActiveOrdnance() {
    cycleOrdnance(this.state);
    this.updateHud();
  }

  async toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen?.();
      } else {
        await this.root.requestFullscreen?.();
      }
      this.app.resizeCanvas();
    } catch {
      this.state.lastMessage = "Fullscreen is unavailable in this browser context.";
      this.updateHud();
    }
  }

  fire() {
    const coinsBefore = this.state.coins;
    const result = fireSliceWeapon(this.state);
    if (result.reason === "blocked") {
      return;
    }
    if (result.reason === "empty") {
      // Cue 5c: dry empty-mag click — no weapon shot, no visuals
      this._sfxEmpty();
      this.updateHud();
      return;
    }
    this.audio.playWeapon(this.state.equippedWeaponId, this.getAudioPositionAhead(2.4));
    if (result.impact) {
      this.audio.playImpact(result.materialId ?? "concrete", this.getAudioPositionAhead(7));
    } else if (result.hit) {
      this.audio.playImpact("flesh", this.getAudioPositionAhead(7));
    }
    this.flashMuzzle();
    this.spawnShotFx(result.hit, result);
    const weapon = getPlayCanvasWeaponSnapshot(this.state);
    this.recoilPitchOffset = Math.min(8, (this.recoilPitchOffset ?? 0) + (weapon.recoilKick ?? 1.5) * 1.2);

    // ── Juice effects on fire ────────────────────────────────────────────────
    // Small shot shake
    this._addShakeTrauma(result.blast ? 0.55 : 0.1);
    // Haptics: short buzz on fire
    this._vibrate(8);

    if (result.hit) {
      // Hitmarker
      this._showHitmarker(result.killCount > 0, result.headshot);
      // Cue 1: hit confirm (non-kill hits only — kill has its own heavier cue)
      if (!result.killCount) this._sfxHitConfirm();
      // Hit-confirm haptic
      this._vibrate(result.killCount > 0 ? [0, 10, 20, 30] : 15);
    }

    if (result.killCount > 0) {
      const coinsDelta = this.state.coins - coinsBefore;
      this._showKillFeedback(coinsDelta);
      this._updateStreak(result.killCount);
      // Cue 2: kill thud
      this._sfxKill();
      // Cue 3: headshot ding (layered on kill)
      if (result.headshot) this._sfxHeadshot();
      // Cue 6: coin ching when coins were awarded
      if (coinsDelta > 0) this._sfxCoin();
      // Kill haptic pattern
      this._vibrate([0, 15, 25, 45]);
    }

    if (result.blast) {
      this._addShakeTrauma(0.5); // extra blast trauma (stacks)
    }

    this.updateHud();
  }

  useActiveOrdnance() {
    const result = useOrdnance(this.state);
    if (result.ok) {
      this.audio.playExplosion(this.getAudioPositionAhead(10), result.ordnanceId);
      this.spawnBlastFx(result.ordnanceId);
      // Large blast shake + haptic
      const blastTrauma = result.ordnanceId === "nuke" ? 0.9 : result.ordnanceId === "c4" ? 0.7 : 0.55;
      this._addShakeTrauma(blastTrauma);
      this._vibrate([0, 20, 50, 60]);
    }
    this.updateHud();
  }

  useFlint() {
    const result = useFlintAndSteel(this.state);
    if (result.ok) {
      this.audio.playExplosion(this.getAudioPositionAhead(5), "nova");
      this.spawnFirePulse();
    }
    this.updateHud();
  }

  interact() {
    interactWithPlayCanvasWorld(this.state);
    this.updateVillagers();
    this.updateHud();
  }

  _toggleMenuSection(section) {
    const el = this.flowPanel.querySelector(`[data-menu-section="${section}"]`);
    if (!el) return;
    const wasHidden = el.hidden;
    this.flowPanel.querySelectorAll("[data-menu-section]").forEach((s) => { s.hidden = true; });
    el.hidden = !wasHidden;
  }

  async _triggerReviveAd() {
    if (this.state.reviveUsed) return;
    if (this.flowFields.revive) {
      this.flowFields.revive.disabled = true;
      this.flowFields.revive.textContent = "Loading ad...";
    }
    let completed = false;
    try {
      const provider = window?.CrazyGames?.SDK?.ad?.requestAd ? "crazygames" : window?.PokiSDK?.rewardedBreak ? "poki" : "none";
      if (provider === "crazygames") {
        const result = await new Promise((resolve) => {
          window.CrazyGames.SDK.ad.requestAd("rewarded", {
            adFinished: () => resolve({ completed: true }),
            adError: () => resolve({ completed: false }),
            adStarted: () => {},
          });
        });
        completed = result.completed;
      } else if (provider === "poki") {
        const result = await window.PokiSDK.rewardedBreak();
        completed = Boolean(result);
      } else {
        completed = true;
      }
    } catch {
      completed = false;
    }
    if (completed) {
      revivePlayer(this.state, { hp: 60, invulnerableSec: 3 });
      this.updateHud();
    } else if (this.flowFields.revive) {
      this.flowFields.revive.disabled = false;
      this.flowFields.revive.textContent = "Watch Ad to Revive";
    }
  }

  async _triggerOfferAd(offerId, claimKey, btn) {
    if (!offerId || !claimKey) return;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Loading ad...";
    let completed = false;
    try {
      const result = await showRewardedAd({ globalScope: window });
      completed = Boolean(result?.completed);
    } catch {
      completed = false;
    }
    if (completed) {
      const result = applyPlayCanvasRewardedOffer(this.state, offerId, claimKey);
      if (result.applied) {
        btn.textContent = "Claimed";
        btn.classList.add("is-claimed");
        this._showGoalToast(result.message);
        this.updateHud();
        // Re-render offers so claimed ones disappear
        this.renderSummaryOffers();
        this.renderGameOverOffers();
        if (this.state.phase === "running") {
          // Revive: hide the flow panel and resume
          this.flowPanel.hidden = true;
          this.canvas.requestPointerLock?.();
        }
      } else {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    } else {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  _buildOfferHtml(offer) {
    return `<button class="pc-offer-btn" type="button" data-offer-id="${escapeHtml(offer.id)}" data-claim-key="${escapeHtml(offer.claimKey)}">${escapeHtml(offer.label)}</button>`;
  }

  renderSummaryOffers() {
    if (!this.summaryOfferList) return;
    const offers = getPlayCanvasSummaryOffers(this.state);
    this.summaryOfferList.innerHTML = offers.map((offer) => this._buildOfferHtml(offer)).join("");
    this.summaryOfferList.hidden = offers.length === 0;
  }

  renderGameOverOffers() {
    if (!this.gameOverOfferList) return;
    const phase = this.state.phase;
    if (phase !== "lost" && phase !== "intermission") {
      this.gameOverOfferList.innerHTML = "";
      this.gameOverOfferList.hidden = true;
      return;
    }
    const offers = phase === "lost"
      ? getPlayCanvasGameOverOffers(this.state)
      : getPlayCanvasSummaryOffers(this.state);
    this.gameOverOfferList.innerHTML = offers.map((offer) => this._buildOfferHtml(offer)).join("");
    this.gameOverOfferList.hidden = offers.length === 0;
  }

  renderGoals() {
    if (!this.goalsListEl) return;
    const goals = getGoalsSnapshot(this.state);
    this.goalsListEl.innerHTML = goals.map((goal) => {
      const prog = goal.progress;
      const pct = prog.max > 0 ? Math.min(100, Math.round((prog.current / prog.max) * 100)) : 100;
      const statusText = goal.completed
        ? `Done +${goal.coinBonus} coins`
        : `${prog.current}/${prog.max} ${prog.unit}`;
      return `<div class="pc-goal-row ${goal.completed ? "is-done" : ""}" title="${escapeHtml(goal.description)}">
        <span class="pc-goal-label">${escapeHtml(goal.label)}</span>
        <span class="pc-goal-status">${escapeHtml(statusText)}</span>
        ${goal.completed ? "" : `<div class="pc-goal-bar"><div class="pc-goal-bar-fill" style="width:${pct}%"></div></div>`}
      </div>`;
    }).join("");
  }

  _showGoalToast(message) {
    // Reuse the guidance panel as a transient toast for goal/offer messages
    if (this.guidancePanel) {
      const stageEl = this.guidancePanel.querySelector('[data-guidance-field="stage"]');
      const titleEl = this.guidancePanel.querySelector('[data-guidance-field="title"]');
      const msgEl = this.guidancePanel.querySelector('[data-guidance-field="message"]');
      if (stageEl) stageEl.textContent = "Reward";
      if (titleEl) titleEl.textContent = "Offer Claimed";
      if (msgEl) msgEl.textContent = message;
      this.guidancePanel.hidden = false;
      this._guidanceToastRemainSec = 3.0;
    }
  }

  _checkAndAnnounceGoals(newlyCompletedIds) {
    if (!newlyCompletedIds || newlyCompletedIds.length === 0) return;
    const { GOAL_DEFS: goals } = { GOAL_DEFS: getGoalsSnapshot(this.state) };
    // Just use getGoalsSnapshot to get completed labels
    const snapshot = getGoalsSnapshot(this.state);
    for (const id of newlyCompletedIds) {
      const goal = snapshot.find((g) => g.id === id);
      if (goal) {
        this._showGoalToast(`Goal complete: ${goal.label}! +${goal.coinBonus} coins`);
        break; // show one at a time (latest)
      }
    }
  }

  // ── Shot-FX pool ─────────────────────────────────────────────────────────────
  // Pre-allocated entities recycled on each shot; no heap allocations after warmup.
  // Flash pool: 8 slots × 3 pieces (core sphere + 2 stretched arm boxes)
  // Tracer pool: 8 slots × 1 stretched box each
  // Burst pool: 3 concurrent bursts × 6 particle spheres each
  createShotFxPool() {
    const FLASH_SLOTS = 8;
    const TRACER_SLOTS = 8;
    const BURST_SLOTS = 3;
    const BURST_PARTS = 6;

    // Flash slots — each slot is a group with a core sphere + 2 arm boxes
    for (let i = 0; i < FLASH_SLOTS; i += 1) {
      const root = new pc.Entity(`sfx-flash-${i}`);
      root.enabled = false;
      this.app.root.addChild(root);
      const core = new pc.Entity(`sfx-flash-${i}-core`);
      core.addComponent("render", { type: "sphere", material: this.materials.get("muzzle"), castShadows: false, receiveShadows: false });
      root.addChild(core);
      const armH = new pc.Entity(`sfx-flash-${i}-armH`);
      armH.addComponent("render", { type: "box", material: this.materials.get("muzzle"), castShadows: false, receiveShadows: false });
      root.addChild(armH);
      const armV = new pc.Entity(`sfx-flash-${i}-armV`);
      armV.addComponent("render", { type: "box", material: this.materials.get("muzzle"), castShadows: false, receiveShadows: false });
      root.addChild(armV);
      root._sfxCore = core;
      root._sfxArmH = armH;
      root._sfxArmV = armV;
      root._sfxTtl = 0;
      root._sfxMaxTtl = 0;
      root._sfxBaseSize = 1;
      this.shotFx.flashes.push(root);
    }

    // Tracer slots — each a single stretched box parented to scene root
    for (let i = 0; i < TRACER_SLOTS; i += 1) {
      const tracer = new pc.Entity(`sfx-tracer-${i}`);
      tracer.addComponent("render", { type: "box", material: this.materials.get("muzzle"), castShadows: false, receiveShadows: false });
      tracer.enabled = false;
      this.app.root.addChild(tracer);
      tracer._sfxTtl = 0;
      tracer._sfxMaxTtl = 0;
      this.shotFx.tracers.push(tracer);
    }

    // Burst slots — each slot has BURST_PARTS sphere children + velocity data
    for (let i = 0; i < BURST_SLOTS; i += 1) {
      const root = new pc.Entity(`sfx-burst-${i}`);
      root.enabled = false;
      this.app.root.addChild(root);
      root._sfxParts = [];
      root._sfxVelocities = [];
      for (let p = 0; p < BURST_PARTS; p += 1) {
        const part = new pc.Entity(`sfx-burst-${i}-p${p}`);
        part.addComponent("render", { type: "sphere", material: this.materials.get("zombieHit"), castShadows: false, receiveShadows: false });
        root.addChild(part);
        root._sfxParts.push(part);
        root._sfxVelocities.push({ x: 0, y: 0, z: 0 });
      }
      root._sfxTtl = 0;
      root._sfxMaxTtl = 0;
      this.shotFx.bursts.push(root);
    }
  }

  flashMuzzle() {
    const weapon = getPlayCanvasWeaponSnapshot(this.state);
    this.weaponKickSec = 0.12;
    this.weaponKickMaxSec = 0.12;
    this.weaponKickPower = weapon.recoilKick;

    // Flamethrower uses the legacy rolling sphere; skip the new star flash
    if (weapon.muzzleFx === "flame") {
      this.muzzleFlash.enabled = true;
      this.muzzleFlash.setLocalScale(0.22, 0.22, 0.22);
      this.muzzleFlash._sliceTtl = 0.1;
      this._spawnMuzzleLight(weapon);
      return;
    }

    // Find a free flash slot (pick the one with lowest remaining TTL)
    const slot = this.shotFx.flashes.reduce((best, cur) => (cur._sfxTtl < best._sfxTtl ? cur : best));

    const isBlast = weapon.muzzleFx === "blast";
    const isWide = weapon.muzzleFx === "wide-flash";
    const baseSize = isBlast ? 0.42 : isWide ? 0.34 : 0.22;
    const ttl = (this.fxSlowMo ? 10 : 1) * (isBlast ? 0.09 : 0.065);
    const rollDeg = Math.random() * 360;

    // Compute muzzle world position analytically: camera pos + forward * ~1u + right * 0.48 + up * -0.46
    // This avoids relying on PlayCanvas transform-hierarchy sync during scripted updates.
    const camPos = this.camera.getPosition();
    const camFwd = this.camera.forward;
    const camRight = this.camera.right;
    const camUp = this.camera.up;
    const model = this.weaponModels?.get(this.activeWeaponViewModel);
    const muzzleLocal = model?._muzzle ?? [0, 0.04, -1.35];
    // weaponRoot local offset from camera: [0.48, -0.5, -0.95] + muzzleLocal (approx)
    const rootOff = model?._rootPosition ?? [0.48, -0.5, -0.95];
    // Approximate world pos: camera + right*rootOff.x + up*rootOff.y + forward*(-rootOff.z)
    // + right*muzzle.x + up*muzzle.y + forward*(-muzzle.z)
    const totalX = rootOff[0] + muzzleLocal[0];
    const totalY = rootOff[1] + muzzleLocal[1];
    const totalZ = -(rootOff[2] + muzzleLocal[2]); // negate Z because forward is -Z in view space
    const mwx = camPos.x + camRight.x * totalX + camUp.x * totalY + camFwd.x * totalZ;
    const mwy = camPos.y + camRight.y * totalX + camUp.y * totalY + camFwd.y * totalZ;
    const mwz = camPos.z + camRight.z * totalX + camUp.z * totalY + camFwd.z * totalZ;

    slot.setPosition(mwx, mwy, mwz);
    slot.setEulerAngles(0, 0, rollDeg);
    slot.enabled = true;

    // Core sphere: small bright center
    slot._sfxCore.setLocalScale(baseSize * 0.55, baseSize * 0.55, baseSize * 0.55);
    slot._sfxCore.setLocalPosition(0, 0, 0);

    // Horizontal arm: wide flat spike
    slot._sfxArmH.setLocalScale(baseSize * (isWide ? 3.2 : 2.6), baseSize * 0.14, baseSize * 0.14);
    slot._sfxArmH.setLocalPosition(0, 0, 0);
    slot._sfxArmH.setLocalEulerAngles(0, 0, 0);

    // Vertical arm: rotated 90° (makes a cross/star)
    slot._sfxArmV.setLocalScale(baseSize * 0.14, baseSize * (isWide ? 2.0 : 2.4), baseSize * 0.14);
    slot._sfxArmV.setLocalPosition(0, 0, 0);
    slot._sfxArmV.setLocalEulerAngles(0, 0, 0);

    slot._sfxTtl = ttl;
    slot._sfxMaxTtl = ttl;
    slot._sfxBaseSize = baseSize;

    this._spawnMuzzleLight(weapon);
  }

  _spawnMuzzleLight(weapon) {
    if (!this.muzzleLightEntity) {
      this.muzzleLightEntity = new pc.Entity("muzzle-light");
      this.muzzleLightEntity.addComponent("light", {
        type: "omni",
        castShadows: false,
        range: 6,
        intensity: 0,
        color: new pc.Color(1, 0.9, 0.6),
      });
      this.app.root.addChild(this.muzzleLightEntity);
    }
    const pos = this.camera.getPosition();
    const fwd = this.camera.forward;
    this.muzzleLightEntity.setPosition(pos.x + fwd.x * 1.2, pos.y + fwd.y * 1.2, pos.z + fwd.z * 1.2);
    const isBlast = weapon.muzzleFx === "blast";
    const isFlame = weapon.muzzleFx === "flame";
    const light = this.muzzleLightEntity.light;
    light.intensity = isBlast ? 3.5 : isFlame ? 2.8 : 2.5;
    light.range = isBlast ? 9 : isFlame ? 7 : 6;
    light.color = isFlame ? new pc.Color(1, 0.5, 0.1) : new pc.Color(1, 0.88, 0.44);
    const ttl = (this.fxSlowMo ? 10 : 1) * (isFlame ? 0.1 : 0.09);
    this.muzzleLightEntity._sliceTtl = ttl;
    this.muzzleLightEntity._sliceMuzzleLight = true;
    this.muzzleLightEntity._sfxLightMaxTtl = ttl;
    this.muzzleLightEntity._sfxLightPeakIntensity = light.intensity;
    if (!this.fx.includes(this.muzzleLightEntity)) {
      this.fx.push(this.muzzleLightEntity);
    }
  }

  spawnShotFx(hit, result = {}) {
    const weapon = getPlayCanvasWeaponSnapshot(this.state);
    const forward = this.camera.forward.clone();
    const origin = this.camera.getPosition().clone();
    const isFlame = weapon.shotFx === "flame-plume";
    const isBlast = weapon.shotFx === "blast-orb";
    const isArc = weapon.shotFx === "arc";
    const isPellet = weapon.shotFx === "pellet-burst";

    // ── Tracer (skip for flamethrower; launcher gets slower orb streak) ───────
    if (!isFlame && !isArc) {
      this._spawnTracer(weapon, forward, origin, hit, result, isPellet);
    }

    // ── Legacy arc/blast/flame spark for non-tracer weapons ───────────────────
    if (isBlast || isFlame || isArc) {
      const matKey = isFlame ? "pumpkin" : "muzzle";
      const spark = this.addPrimitive(`shot-fx-${performance.now()}`, isArc ? "box" : "sphere", [0, 0, 0], [0.09, 0.09, 0.09], matKey);
      const distance = isArc ? 2.2 : isFlame ? 5.2 : 8.8;
      spark.setLocalPosition(origin.x + forward.x * distance, origin.y + forward.y * distance, origin.z + forward.z * distance);
      spark._sliceTtl = isFlame ? 0.24 : isBlast ? 0.3 : 0.18;
      spark._sliceMaxTtl = spark._sliceTtl;
      spark._sliceBaseScale = isFlame ? [0.34, 0.22, 0.72] : isBlast ? [0.5, 0.5, 0.5] : [0.52, 0.05, 0.18];
      if (isArc) spark.setEulerAngles(0, this.yaw * pc.math.RAD_TO_DEG + 28, 18);
      this.fx.push(spark);
    }

    // ── Impact burst ──────────────────────────────────────────────────────────
    if (!isFlame && !isArc) {
      const impactDistance = this._resolveImpactDistance(hit, result);
      this._spawnImpactBurst(result, forward, origin, impactDistance, isPellet);
    }
  }

  _resolveImpactDistance(hit, result) {
    // If a zombie was hit, compute distance from player to that zombie
    if (hit && result.zombieId) {
      const zombie = this.state.zombies.find((z) => z.id === result.zombieId);
      if (zombie) {
        return Math.hypot(zombie.x - this.state.player.x, zombie.z - this.state.player.z);
      }
    }
    // Structure hit or miss — use a fixed distance representative of max effective range
    return hit ? 8 : 22;
  }

  _spawnTracer(weapon, forward, origin, hit, result, isPellet) {
    // Compute muzzle world pos analytically (same approach as flashMuzzle)
    const camPos = this.camera.getPosition();
    const camFwd = this.camera.forward;
    const camRight = this.camera.right;
    const camUp = this.camera.up;
    const model = this.weaponModels?.get(this.activeWeaponViewModel);
    const muzzleLocal = model?._muzzle ?? [0, 0.04, -1.35];
    const rootOff = model?._rootPosition ?? [0.48, -0.5, -0.95];
    const totalX = rootOff[0] + muzzleLocal[0];
    const totalY = rootOff[1] + muzzleLocal[1];
    const totalZ = -(rootOff[2] + muzzleLocal[2]);
    const mwx = camPos.x + camRight.x * totalX + camUp.x * totalY + camFwd.x * totalZ;
    const mwy = camPos.y + camRight.y * totalX + camUp.y * totalY + camFwd.y * totalZ;
    const mwz = camPos.z + camRight.z * totalX + camUp.z * totalY + camFwd.z * totalZ;
    const muzzleWorld = { x: mwx, y: mwy, z: mwz };

    const impactDist = this._resolveImpactDistance(hit, result);
    // Clamp trace length: pellets spread further, others cap at 40u
    const traceLen = isPellet ? Math.min(impactDist, 14) : Math.min(impactDist, 40);
    if (traceLen < 0.5) return;

    // Midpoint of tracer segment
    const midX = muzzleWorld.x + forward.x * traceLen * 0.5;
    const midY = muzzleWorld.y + forward.y * traceLen * 0.5;
    const midZ = muzzleWorld.z + forward.z * traceLen * 0.5;

    // Find a free tracer slot
    const slot = this.shotFx.tracers.reduce((best, cur) => (cur._sfxTtl < best._sfxTtl ? cur : best));

    // Orient the stretched box along the forward direction
    const yawDeg = this.yaw * pc.math.RAD_TO_DEG;
    const pitchDeg = -(this.pitch - (this.recoilPitchOffset ?? 0));
    slot.setPosition(midX, midY, midZ);
    slot.setEulerAngles(pitchDeg, yawDeg, 0);

    // Width proportional to weapon — heavier = thicker tracer
    const isBlast = weapon.shotFx === "blast-orb";
    const thickness = isPellet ? 0.05 : isBlast ? 0.08 : 0.035;
    slot.setLocalScale(thickness, thickness, traceLen);

    const ttl = (this.fxSlowMo ? 10 : 1) * (isPellet ? 0.08 : 0.09);
    slot._sfxTtl = ttl;
    slot._sfxMaxTtl = ttl;
    slot._sfxTracerLen = traceLen;
    slot._sfxTracerThick = thickness;
    slot.enabled = true;
  }

  _spawnImpactBurst(result, forward, origin, distance, isPellet) {
    const hasHit = result.hit || result.impact;
    if (!hasHit) return;

    const isFlesh = result.hit && !result.materialId;
    const isGlass = result.materialId === "glass";
    const isWood = result.materialId === "wood";
    const isConcrete = result.materialId === "concrete" || result.materialId === "brick";
    const isSoil = result.materialId === "soil";

    // Pick material and burst characteristics
    let matKey, ttlBase, speedBase, gravity, count, partSize;
    if (isFlesh) {
      matKey = "zombieHit";
      ttlBase = 0.28;
      speedBase = 3.8;
      gravity = 5.5;
      count = isPellet ? 6 : 5;
      partSize = 0.12;
    } else if (isGlass) {
      matKey = "impactGlass";
      ttlBase = 0.24;
      speedBase = 4.2;
      gravity = 5.8;
      count = 5;
      partSize = 0.10;
    } else if (isWood) {
      matKey = "impactWood";
      ttlBase = 0.24;
      speedBase = 3.2;
      gravity = 4.5;
      count = 5;
      partSize = 0.11;
    } else if (isConcrete) {
      matKey = "impactConcrete";
      ttlBase = 0.24;
      speedBase = 3.0;
      gravity = 6.0;
      count = 4;
      partSize = 0.10;
    } else if (isSoil) {
      matKey = "impactSoil";
      ttlBase = 0.26;
      speedBase = 2.4;
      gravity = 4.0;
      count = 4;
      partSize = 0.13;
    } else {
      // Fallback: generic dirt puff
      matKey = "impactSoil";
      ttlBase = 0.20;
      speedBase = 2.8;
      gravity = 4.5;
      count = 4;
      partSize = 0.10;
    }

    const ttl = (this.fxSlowMo ? 10 : 1) * ttlBase;

    // Find a free burst slot
    const slot = this.shotFx.bursts.reduce((best, cur) => (cur._sfxTtl < best._sfxTtl ? cur : best));

    // Impact world position
    const ix = origin.x + forward.x * distance;
    const iy = Math.max(0.05, origin.y + forward.y * distance);
    const iz = origin.z + forward.z * distance;
    slot.setPosition(ix, iy, iz);
    slot.enabled = true;

    // Update material on each part and set up velocities
    const mat = this.materials.get(matKey);
    for (let p = 0; p < slot._sfxParts.length; p += 1) {
      const part = slot._sfxParts[p];
      if (p < count) {
        // Outward velocity fan: forward direction + random spread
        const angle = (p / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
        const speed = speedBase * (0.7 + Math.random() * 0.6);
        // Tangent direction perpendicular to forward in XZ plane
        const tx = -forward.z;
        const tz = forward.x;
        const vx = (forward.x * 0.6 + tx * Math.sin(angle)) * speed;
        const vy = (0.4 + Math.random() * 0.6) * speed;
        const vz = (forward.z * 0.6 + tz * Math.sin(angle)) * speed;
        slot._sfxVelocities[p] = { x: vx, y: vy, z: vz };
        // Reset part to burst origin (local space = 0)
        part.setLocalPosition(0, 0, 0);
        part.setLocalScale(partSize, partSize, partSize);
        if (mat) part.render.material = mat;
        part.enabled = true;
      } else {
        part.enabled = false;
      }
    }
    slot._sfxTtl = ttl;
    slot._sfxMaxTtl = ttl;
    slot._sfxGravity = gravity;
    slot._sfxCount = count;
    slot._sfxPartSize = partSize;
  }

  _spawnImpactDebris(_result, _forward, _origin, _distance) {
    // Legacy stub — new system uses _spawnImpactBurst; kept for compatibility
  }

  spawnBlastFx(ordnanceId) {
    const scale = ordnanceId === "nuke" ? 1.2 : ordnanceId === "c4" ? 0.72 : 0.46;
    const blast = this.addPrimitive(`blast-fx-${performance.now()}`, "sphere", [0, 0.8, -10], [scale, scale, scale], ordnanceId === "nuke" ? "muzzle" : "lantern");
    const forward = this.camera.forward.clone();
    const origin = this.camera.getPosition().clone();
    blast.setLocalPosition(origin.x + forward.x * 10, 0.8, origin.z + forward.z * 10);
    blast._sliceTtl = 0.28;
    this.fx.push(blast);
  }

  reset() {
    this.state = resetSlice();
    this.audio.setMusicEnabled(this.state.musicEnabled);
    this.audio.setSfxEnabled(this.state.sfxEnabled);
    this.clearZombieEntities();
    this.clearFireEntities();
    this.clearImpactEntities();
    this.yaw = 0;
    this.pitch = -6;
    this.shopOpen = false;
    this.minimapOpen = true;
    this.lastRenderedPhase = null;
    this.resetAudioTracking();
    this.updateLandscapeMutationVisuals();
    this.updateWindowImpactVisuals();
    this.updateMiniMapVisibility();
    this.updateHud();
  }

  restart() {
    this.state = restartCampaign();
    this.audio.setMusicEnabled(this.state.musicEnabled);
    this.audio.setSfxEnabled(this.state.sfxEnabled);
    this.clearZombieEntities();
    this.clearFireEntities();
    this.clearImpactEntities();
    this.yaw = 0;
    this.pitch = -6;
    this.shopOpen = false;
    this.minimapOpen = true;
    this.lastRenderedPhase = null;
    this.resetAudioTracking();
    this.updateLandscapeMutationVisuals();
    this.updateWindowImpactVisuals();
    this.updateMiniMapVisibility();
    this.updateHud();
  }

  clearZombieEntities() {
    for (const entity of this.entitiesByZombie.values()) {
      entity.destroy();
    }
    this.entitiesByZombie.clear();
  }

  clearFireEntities() {
    for (const entity of this.fireEntitiesByPatch.values()) {
      entity.destroy();
    }
    this.fireEntitiesByPatch.clear();
  }

  clearImpactEntities() {
    for (const entity of this.entitiesByImpact.values()) {
      entity.destroy();
    }
    this.entitiesByImpact.clear();
  }

  resetAudioTracking() {
    this.audioDamagePulseSec = 0;
    this.audioPlayerDamagePulseSec = 0;
    this.lastAudioVillageHp = this.state.villageHp;
    this.lastAudioPlayerHp = this.state.playerHp;
    this.lastAudioCueId = "";
    this._wasReloading = false;
    this._heartbeatPhaseSec = 0;
    this._stopNightBed();
  }

  trackAudioDamage(previousVillageHp, previousPlayerHp) {
    if (this.state.villageHp < previousVillageHp - 0.1) {
      const intensity = Math.max(0.18, Math.min(1, (previousVillageHp - this.state.villageHp) / Math.max(1, this.state.maxVillageHp) * 12));
      this.audioDamagePulseSec = 1.25;
      this.audio.playVillageUnderAttack({ x: 0, y: 1.2, z: SLICE_WORLD.villageZ }, intensity);
    }
    if (this.state.playerHp < previousPlayerHp - 0.1) {
      this.audioPlayerDamagePulseSec = 1.0;
      this.audio.playImpact("flesh", this.getAudioPositionAhead(0.5));
    }
    this.lastAudioVillageHp = this.state.villageHp;
    this.lastAudioPlayerHp = this.state.playerHp;
  }

  updateAudioState(dt = 0, { force = false } = {}) {
    this.audioDamagePulseSec = Math.max(0, this.audioDamagePulseSec - dt);
    this.audioPlayerDamagePulseSec = Math.max(0, this.audioPlayerDamagePulseSec - dt);
    this.audio.setMusicEnabled(this.state.musicEnabled);
    this.audio.setSfxEnabled(this.state.sfxEnabled);
    this.audio.setListenerPosition({ x: this.state.player.x, y: 1.65, z: this.state.player.z });

    const audio = getPlayCanvasAudioSnapshot(this.state, {
      shopOpen: this.shopOpen,
      villageDamageRecent: this.audioDamagePulseSec > 0 ? 1 : 0,
      playerDamageRecent: this.audioPlayerDamagePulseSec > 0 ? 1 : 0,
    });
    this.lastAudioCueId = audio.cueId;
    this.audio.updateMusicState({
      mode: audio.mode,
      phase: this.state.phase,
      victory: this.state.phase === "won",
      waveNumber: this.state.waveNumber,
      aliveEnemies: audio.aliveEnemies,
      closestThreatDistance: audio.closestThreatDistance === "none" ? Infinity : audio.closestThreatDistance,
      playerHp: this.state.playerHp,
      villageHp: this.state.villageHp,
      maxVillageHp: this.state.maxVillageHp,
      villageDamageRecent: this.audioDamagePulseSec > 0 ? 1 : 0,
      playerDamageRecent: this.audioPlayerDamagePulseSec > 0 ? 1 : 0,
      secretBossActive: this.state.secretBossActive,
      bossActive: audio.cueId === "boss_battle",
      bossWave: audio.cueId === "boss_battle",
    }, dt, { force });
  }

  playWaveStartAudio() {
    this.audio.playWaveStartCue(this.state.waveNumber);
  }

  getAudioPositionAhead(distance = 3) {
    const forward = this.camera?.forward;
    if (!forward) {
      return { x: this.state.player.x, y: 1.2, z: this.state.player.z };
    }
    const origin = this.camera.getPosition();
    return {
      x: origin.x + forward.x * distance,
      y: origin.y + forward.y * distance,
      z: origin.z + forward.z * distance,
    };
  }

  update(dt) {
    this._lastUpdateDt = dt;
    // Drive CameraFrame post-processing (bloom, tone mapping compose) each frame.
    // cf.update() must be called before the PlayCanvas render tick processes the passes.
    this.cameraFrame?.update();
    const previousVillageHp = this.state.villageHp;
    const previousPlayerHp = this.state.playerHp;
    this.state.player.pitch = this.pitch;
    // Apply right-zone touch look velocity — only when there's an active look touch
    // and the pointer isn't locked (pointer-lock path uses handleLookMove).
    if (this.input.lookTouch !== null && !this.input.pointerLocked) {
      const vpW = window.innerWidth || 360;
      const vpH = window.innerHeight || 640;
      // lookVelX/Y are normalised ±1 after response curve; scale to pixels/frame
      // equivalent so applyLookDelta receives the same units it always does (px delta).
      const fakePixDx = this.input.lookVelX * vpW * 0.08;
      const fakePixDy = this.input.lookVelY * vpH * 0.08;
      if (Math.abs(fakePixDx) > 0.5 || Math.abs(fakePixDy) > 0.5) {
        this.applyLookDelta(fakePixDx, fakePixDy);
      }
    }
    const wasReloading = this._wasReloading;
    const goalCountBefore = Array.isArray(this.state.claimedGoalIds) ? this.state.claimedGoalIds.length : 0;
    stepSlice(this.state, this.input, Math.min(dt, 0.05));
    this.input.jump = false;
    // When combat ends (e.g. a wave clears into intermission), release the
    // pointer lock so the cursor reappears for the regroup panel / shop instead
    // of staying captured for mouse-look behind the modal.
    if (this._lastPlayPhase !== this.state.phase) {
      this._lastPlayPhase = this.state.phase;
      if (!isActivePlayPhase(this.state.phase) && document.pointerLockElement === this.canvas) {
        document.exitPointerLock?.();
      }
    }
    const goalCountAfter = Array.isArray(this.state.claimedGoalIds) ? this.state.claimedGoalIds.length : 0;
    if (goalCountAfter > goalCountBefore) {
      const newIds = this.state.claimedGoalIds.slice(goalCountBefore);
      this._checkAndAnnounceGoals(newIds);
    }
    // Cue 5: reload start / finish detection (pendingReload flag transition)
    if (!wasReloading && this.state.pendingReload) {
      this._sfxReloadStart();
    } else if (wasReloading && !this.state.pendingReload) {
      this._sfxReloadFinish();
    }
    this._wasReloading = this.state.pendingReload;
    this.trackAudioDamage(previousVillageHp, previousPlayerHp);
    if (this.state.playerHp < previousPlayerHp - 0.1) {
      this.playerDamageFlashSec = 0.45;
      // Shake on player bite — medium trauma
      this._addShakeTrauma(0.38);
      // Damage haptic
      this._vibrate(45);
      // Cue 7: player damage thud
      this._sfxPlayerDamage();
    }
    if (this.state.villageHp < previousVillageHp - 0.1) {
      this.villageDamageFlashSec = 0.45;
    }
    this.playerDamageFlashSec = Math.max(0, (this.playerDamageFlashSec ?? 0) - dt);
    this.villageDamageFlashSec = Math.max(0, (this.villageDamageFlashSec ?? 0) - dt);
    this.recoilPitchOffset = Math.max(0, (this.recoilPitchOffset ?? 0) - dt * 6);
    this.weaponKickSec = Math.max(0, (this.weaponKickSec ?? 0) - dt);
    // Juice: decay shake, update vignette
    this._decayShake(dt);
    this._updateVignette(this.state.playerHp);
    // Cue 8: low-health heartbeat
    if (this.state.playerHp < 25 && this.state.phase === "running") {
      this._sfxHeartbeatTick(dt);
    } else {
      this._heartbeatPhaseSec = 0;
    }
    // Cue 10: ambient night bed — start on first wave, stop when not in active play
    const isActiveCombat = this.state.phase === "running" || this.state.phase === "intermission";
    if (isActiveCombat && !this._nightBedRunning) {
      this._startNightBed();
    } else if (!isActiveCombat && this._nightBedRunning) {
      this._stopNightBed();
    }
    this.summaryDisplaySec = Math.max(0, (this.summaryDisplaySec ?? 0) - dt);
    if (this.state.phase === "intermission" && this.lastSummaryWave !== this.state.waveNumber) {
      this.lastSummaryWave = this.state.waveNumber;
      this.summaryDisplaySec = 4.0;
    }
    if (this.graceOverlay) {
      const graceActive = (this.state.waveGraceSec ?? 0) > 0;
      this.graceOverlay.hidden = !graceActive;
      if (graceActive && this.graceCountdown) {
        this.graceCountdown.textContent = String(Math.ceil(this.state.waveGraceSec));
      }
    }
    if (this.summaryOverlay) {
      const show = this.summaryDisplaySec > 0 && this.state.waveSummary;
      this.summaryOverlay.hidden = !show;
      if (show && this.summaryFields) {
        const s = this.state.waveSummary;
        if (this.summaryFields.wave) this.summaryFields.wave.textContent = `Wave ${s.wave ?? this.state.waveNumber}`;
        if (this.summaryFields.kills) this.summaryFields.kills.textContent = s.kills ?? 0;
        if (this.summaryFields.coins) this.summaryFields.coins.textContent = s.coinsEarned ?? 0;
        if (this.summaryFields.village) this.summaryFields.village.textContent = `${Math.round((this.state.villageHp / Math.max(1, this.state.maxVillageHp)) * 100)}%`;
        this.renderSummaryOffers();
      }
    }
    if (this.playerFlashOverlay) {
      this.playerFlashOverlay.style.opacity = String(this.playerDamageFlashSec * 2.2);
    }
    if (this.villageFlashOverlay) {
      this.villageFlashOverlay.style.opacity = String(this.villageDamageFlashSec * 2.2);
    }
    this.updateCamera();
    this.updateAudioState(dt);
    this.updateWeaponVisuals();
    this.updateZombies(dt);
    this.updateVillagers(dt);
    this.updateLandscapeMutationVisuals();
    this.updateWindowImpactVisuals();
    this.updateVillageDistress(dt);
    this.updateGearVisuals();
    this.drawMiniMap();
    this.updateFx(dt);
    this.updateHud();
  }

  updateCamera() {
    const player = this.state.player;
    const eyeHeight = player.crouching ? 1.3 : 1.62;
    const jumpY = player.y ?? 0;
    this.camera.setLocalPosition(player.x, eyeHeight + jumpY, player.z);
    const pitchWithRecoil = this.pitch - (this.recoilPitchOffset ?? 0);
    // Additive screen shake — trauma^2 model, reduced-motion aware
    const [shakePitch, shakeYaw] = this._computeShakeOffset();
    this.camera.setEulerAngles(
      pitchWithRecoil + shakePitch,
      this.yaw * pc.math.RAD_TO_DEG + shakeYaw,
      0
    );
  }

  // Yaw (degrees) a zombie should face: mirrors the sim's targeting rule in
  // stepZombies (chase player inside 8m or past the village line, else head
  // for the village), so facing always matches movement direction. Turns are
  // smoothed shortest-arc at a fixed rate so zombies pivot rather than snap.
  resolveZombieYawDeg(entity, zombie, dt) {
    const player = this.state.player;
    const playerDist = Math.hypot(player.x - zombie.x, player.z - zombie.z);
    const targetPlayer = playerDist < 8 || zombie.z > SLICE_WORLD.villageZ + 1;
    const tx = (targetPlayer ? player.x : 0) - zombie.x;
    const tz = (targetPlayer ? player.z : SLICE_WORLD.villageZ) - zombie.z;
    // PlayCanvas yaw 0 faces -Z, so facing direction (tx,tz) is atan2(-tx,-tz).
    const targetYaw = Math.atan2(-tx, -tz) * pc.math.RAD_TO_DEG;
    const current = entity._yawDeg ?? targetYaw;
    let delta = targetYaw - current;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    const maxStep = 540 * Math.max(dt, 0);
    const yaw = Math.abs(delta) <= maxStep ? targetYaw : current + Math.sign(delta) * maxStep;
    entity._yawDeg = yaw;
    return yaw;
  }

  updateZombies(dt = 0) {
    for (const zombie of this.state.zombies) {
      const entity = this.entitiesByZombie.get(zombie.id) ?? this.createZombieEntity(zombie);

      // ── Telegraph ring (pounce = amber, slam = red) ──────────────────────
      // Created lazily on first telegraph; parented to the app root at y=0 so
      // it stays on the ground even when the zombie body lifts.
      if (!zombie.dead) {
        this._updateZombieTelegraph(entity, zombie);
      } else if (entity._telegraphRing) {
        entity._telegraphRing.enabled = false;
      }

      const zombieY = zombie.y ?? 0;

      if (entity._glb) {
        // ── GLB path ──────────────────────────────────────────────────────────
        entity.enabled = true; // always keep root enabled; GLB manages dead state internally
        // Use zombie.y for hover/pounce lift; shadow stays at y=0 (it's on the root entity
        // but we pin the GLB shadow entity to ground-level inside _updateZombieTelegraph).
        entity.setLocalPosition(zombie.x, zombieY, zombie.z);
        if (!zombie.dead) {
          // Quaternius model's face is on its +Z side, opposite the -Z forward
          // convention, hence the 180° offset.
          const telegraphing = (zombie.telegraphSec ?? 0) > 0;
          // Wind-up crouch: squash Y slightly during telegraph
          const yScale = telegraphing ? 0.85 : 1.0;
          entity.setLocalEulerAngles(0, this.resolveZombieYawDeg(entity, zombie, dt) + 180, 0);
          entity.setLocalScale(1, yScale, 1);
        }
        animateZombieGlbEntity(entity, zombie, this.state.elapsedSec);
        // Keep blob shadow fixed at ground level (y=0) even when body lifts.
        // The GLB shadow is a child of the root which now moves on Y, so we
        // counter-translate it back to y=0.
        const glbShadow = entity._glb?.shadow;
        if (glbShadow && zombieY > 0) {
          glbShadow.setLocalPosition(0, -zombieY + 0.03, 0);
        } else if (glbShadow) {
          glbShadow.setLocalPosition(0, 0.03, 0);
        }
        // Sync bloom coronas to GLB eye positions (set by animateZombieGlbEntity above).
        // Coronas provide a wider emissive seed for CameraFrame bloom.
        const eyeLEnt = entity.findByName("glb-eye-l");
        const eyeREnt = entity.findByName("glb-eye-r");
        if (entity._bloomCoronaL && eyeLEnt) {
          entity._bloomCoronaL.setLocalPosition(eyeLEnt.getLocalPosition());
          entity._bloomCoronaL.enabled = !zombie.dead;
        }
        if (entity._bloomCoronaR && eyeREnt) {
          entity._bloomCoronaR.setLocalPosition(eyeREnt.getLocalPosition());
          entity._bloomCoronaR.enabled = !zombie.dead;
        }
      } else {
        // ── Procedural rig path (default) ─────────────────────────────────────
        entity.enabled = !zombie.dead;
        if (zombie.dead) {
          continue;
        }
        entity.setLocalPosition(zombie.x, zombieY, zombie.z);
        entity.setLocalEulerAngles(0, this.resolveZombieYawDeg(entity, zombie, dt), 0);
        // Wind-up crouch: squash Y during telegraph
        const telegraphing = (zombie.telegraphSec ?? 0) > 0;
        entity.setLocalScale(1, telegraphing ? 0.85 : 1.0, 1);
        // Subtle breathing on torso only (±0.015)
        const torsoPivot = entity._rig?.torsoPivot;
        if (torsoPivot) {
          const breathe = 1 + Math.sin(this.state.elapsedSec * (5 + zombie.speedMps)) * 0.015;
          torsoPivot.setLocalScale(breathe, 1, breathe);
        }
        // Keep blob shadow at ground level when body lifts
        const shadowEnt = entity._rig?.shadowEnt;
        if (shadowEnt && zombieY > 0) {
          shadowEnt.setLocalPosition(0, -zombieY, 0);
        } else if (shadowEnt) {
          shadowEnt.setLocalPosition(0, 0, 0);
        }
        const skinMat = entity._rig?.skinMat ?? "zombieFlesh";
        const shirtMatKey = entity._rig?.shirtMatKey ?? "zombieShirtGrey";
        applyZombieRigMaterials(entity, this.materials, skinMat, shirtMatKey, zombie.hitFlashSec > 0);
        animateZombieRig(entity, zombie, this.state.elapsedSec);
      }
    }
  }

  /**
   * Create or update a ground-level telegraph ring under a zombie.
   * Ring is parented to app.root (not the zombie entity) so it stays at y=0
   * even when the zombie body lifts during a pounce arc.
   * Color: pounce=amber (#e08a00), slam=red (#cc0000).
   */
  _updateZombieTelegraph(entity, zombie) {
    const telegSec = zombie.telegraphSec ?? 0;
    const telegType = zombie.telegraphType ?? "none";
    const active = telegSec > 0 && telegType !== "none";

    if (!entity._telegraphRing) {
      // Build a thin flat cylinder (disc) as a ground ring
      const ring = new pc.Entity(`telegraph-${zombie.id}`);
      const mat = new pc.StandardMaterial();
      mat.emissive = new pc.Color(0.88, 0.54, 0.0);
      mat.emissiveIntensity = 3.0;
      mat.diffuse = new pc.Color(0, 0, 0);
      mat.useLighting = false;
      mat.blendType = pc.BLEND_ADDITIVE;
      mat.depthWrite = false;
      mat.opacity = 0.8;
      mat.update();
      ring.addComponent("render", {
        type: "cylinder",
        material: mat,
        castShadows: false,
        receiveShadows: false,
      });
      ring.setLocalScale(0.9, 0.04, 0.9);
      ring.setLocalPosition(zombie.x, 0.02, zombie.z);
      this.app.root.addChild(ring);
      entity._telegraphRing = ring;
      entity._telegraphMat = mat;
    }

    const ring = entity._telegraphRing;
    const mat = entity._telegraphMat;
    ring.enabled = active;

    if (active) {
      // Move to zombie ground position
      ring.setLocalPosition(zombie.x, 0.02, zombie.z);

      // Color by type
      if (telegType === "slam") {
        mat.emissive = new pc.Color(0.9, 0.08, 0.08);
      } else {
        mat.emissive = new pc.Color(0.88, 0.54, 0.0);
      }

      // Pulse scale: shrinks from 1.0 → 0.4 as telegraph winds up, then pops
      const maxDuration = telegType === "slam" ? 0.70 : 0.40;
      const progress = Math.max(0, Math.min(1, 1 - telegSec / maxDuration));
      const scale = 0.9 - progress * 0.5; // 0.9 → 0.4
      const pulse = 1 + Math.sin(this.state.elapsedSec * 18) * 0.08;
      ring.setLocalScale(scale * pulse, 0.04, scale * pulse);
      mat.opacity = 0.6 + progress * 0.4;
      mat.update();
    }
  }

  // Resolve yaw (degrees) a villager should face.
  // Escorting: face movement direction (computed from per-frame position delta).
  //            Smoothed shortest-arc at 540°/s — same rate as resolveZombieYawDeg.
  // Idle:      face the player (stationary villager "noticing" you).
  // Uses the same shortest-arc smoothing pattern as resolveZombieYawDeg so turns
  // are gradual rather than snapping.
  resolveVillagerYawDeg(entity, villager, dt) {
    const player = this.state.player;

    if (villager.state === "escorting") {
      // Movement direction from per-frame position delta.
      // On the first call (no prev stored) or when standing still, fall back to
      // facing the player so there's no pop on escort-start.
      const prevX = entity._prevVillagerX ?? villager.x;
      const prevZ = entity._prevVillagerZ ?? villager.z;
      const dx = villager.x - prevX;
      const dz = villager.z - prevZ;
      entity._prevVillagerX = villager.x;
      entity._prevVillagerZ = villager.z;

      let targetYaw;
      const moveDist = Math.hypot(dx, dz);
      if (moveDist > 0.0005) {
        // PlayCanvas yaw 0 faces -Z: direction (dx,dz) → atan2(-dx,-dz)
        targetYaw = Math.atan2(-dx, -dz) * pc.math.RAD_TO_DEG;
      } else {
        // Standing still — face player (no pop, just hold current)
        const px = player.x - villager.x;
        const pz = player.z - villager.z;
        targetYaw = Math.atan2(-px, -pz) * pc.math.RAD_TO_DEG;
      }

      const current = entity._yawDeg ?? targetYaw;
      let delta = targetYaw - current;
      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;
      const maxStep = 540 * Math.max(dt, 0);
      const yaw = Math.abs(delta) <= maxStep ? targetYaw : current + Math.sign(delta) * maxStep;
      entity._yawDeg = yaw;
      return yaw;
    } else {
      // Idle — face the player so they "notice" you approaching
      const px = player.x - villager.x;
      const pz = player.z - villager.z;
      const targetYaw = Math.atan2(-px, -pz) * pc.math.RAD_TO_DEG;
      const current = entity._yawDeg ?? targetYaw;
      let delta = targetYaw - current;
      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;
      const maxStep = 180 * Math.max(dt, 0); // slower turn rate for idle villagers
      const yaw = Math.abs(delta) <= maxStep ? targetYaw : current + Math.sign(delta) * maxStep;
      entity._yawDeg = yaw;
      return yaw;
    }
  }

  updateVillagers(dt = 0) {
    for (const villager of this.state.villagers) {
      const entity = this.entitiesByVillager.get(villager.id) ?? this.createVillagerEntity(villager);
      entity.enabled = villager.state === "idle" || villager.state === "escorting";
      if (!entity.enabled) {
        continue;
      }

      entity.setLocalPosition(villager.x, 0, villager.z);

      // Facing: escorting villagers face movement direction, idle face player.
      // Both paths use shortest-arc smooth yaw — no backward-walking artefact.
      const yawDeg = this.resolveVillagerYawDeg(entity, villager, dt);
      if (entity._glb?.valid) {
        // GLB path: Quaternius model faces +Z at yaw=0, same as zombie (+180 flip
        // already applied in zombieGlb). Villager models also face +Z (not -Z),
        // so we need the same 180° offset as the zombie GLB.
        entity.setLocalEulerAngles(0, yawDeg + 180, 0);
        entity.setLocalScale(1, 1, 1);
        animateVillagerGlbEntity(entity, villager);
      } else {
        // Primitive rig path — no 180° flip needed (primitive faces correct direction)
        entity.setLocalEulerAngles(0, yawDeg, 0);
        // Pulse scale only on primitive root (skip for GLB — would squash the model)
        const pulse = villager.state === "escorting" ? 1 + Math.sin(this.state.elapsedSec * 8) * 0.04 : 1;
        entity.setLocalScale(pulse, 1, pulse);
      }

      // Health bar — same logic for both primitive and GLB
      if (entity._healthRoot && entity._healthFill) {
        const visible = villager.state === "escorting";
        entity._healthRoot.enabled = visible;
        if (visible) {
          const ratio = Math.max(0, Math.min(1, villager.hp / Math.max(1, villager.maxHp)));
          // GLB villager is taller (1.65u); primitive head is at 1.58u.
          // Health bar Y position is embedded in the entity at creation time —
          // the fill only needs its X scale and position updated here.
          const fillY = entity._healthBarY ?? 2.34; // set at entity creation
          entity._healthFill.setLocalScale(0.86 * ratio, 0.05, 0.035);
          entity._healthFill.setLocalPosition(-0.43 + (0.86 * ratio) / 2, fillY, -0.04);
        }
      }
    }
  }

  updateLandscapeMutationVisuals() {
    const mutated = new Set(this.state.mutatedLandscapeIds ?? []);
    for (const [id, entity] of this.entitiesByLandscape.entries()) {
      entity.enabled = !mutated.has(id);
    }
  }

  // ── Village-distress system ──────────────────────────────────────────────────
  // Max pooled smoke columns; kept small for mobile.
  static get DISTRESS_SMOKE_CAP() { return 5; }

  /**
   * Called once after createScene() to clone per-entity window materials and
   * build the smoke / danger-light pool.  Runs in the same JS tick as the
   * constructor — no async.
   */
  _initVillageDistress() {
    // ── 1. Per-entity window glow material clones ────────────────────────────
    const baseWG = this.materials.get("windowGlow");
    for (const [, entity] of this.entitiesByWindow.entries()) {
      const mat = baseWG.clone();
      mat.update();
      // Assign to this entity's render component so it no longer shares the
      // global material instance.
      if (entity.render) {
        entity.render.material = mat;
      }
      this._windowGlowMats.push({ entity, mat });
    }

    // ── 2. Smoke column pool ─────────────────────────────────────────────────
    // Pre-create all smoke entities disabled so there's no per-frame allocation
    // after warmup.
    const cap = PlayCanvasZombieSlice.DISTRESS_SMOKE_CAP;
    // Spread smoke positions over the village — houses, bell tower, flanks.
    // offsets are [dx, 0, dz] relative to SLICE_WORLD.villageZ.
    // Houses are at x≈±10–16, z=villageZ-10..+12; bell tower at z=villageZ-12.
    const smokeOffsets = [
      [-9.5, 0, -10.0],  // house-0 roof
      [ 9.4, 0,  -8.8],  // house-1 roof
      [-13.2, 0,  -1.0], // house-2 roof
      [ 13.4, 0,   0.2], // house-3 roof
      [  0.0, 0, -12.0], // bell tower
    ];
    for (let i = 0; i < cap; i += 1) {
      const off = smokeOffsets[i] ?? [0, 0, 0];
      const vz = SLICE_WORLD.villageZ;
      // Smoke is a translucent dark-grey sphere that drifts upward via scale
      // and opacity modulation each frame.
      const smoke = new pc.Entity(`distress-smoke-${i}`);
      smoke.addComponent("render", {
        type: "sphere",
        castShadows: false,
        receiveShadows: false,
      });
      // Clone a material for this smoke puff — dark grey translucent billow.
      const smokeMat = new pc.StandardMaterial();
      smokeMat.diffuse = new pc.Color(0.22, 0.20, 0.18);
      smokeMat.emissive = new pc.Color(0.10, 0.07, 0.04);
      smokeMat.emissiveIntensity = 1.0;
      smokeMat.opacity = 0;
      smokeMat.blendType = pc.BLEND_NORMAL;
      smokeMat.depthWrite = false;
      smokeMat.useFog = false; // don't let scene fog wash out the smoke read
      smokeMat.update();
      smoke.render.material = smokeMat;
      smoke.setLocalPosition(off[0], off[1], vz + off[2]);
      smoke.enabled = false;
      smoke._distressSmokeMat = smokeMat;
      smoke._distressSmokePhase = i / cap; // stagger animation phase (0, 0.2, 0.4, 0.6, 0.8)
      smoke._distressSmokeBaseX = off[0];
      smoke._distressSmokeBaseZ = vz + off[2];
      this.app.root.addChild(smoke);
      this._distressSmokePool.push(smoke);
    }

    // ── 3. Ember / fire-glow light at village base (low-mid distress) ────────
    const ember = new pc.Entity("distress-ember-light");
    ember.addComponent("light", {
      type: "omni",
      castShadows: false,
      range: 22,
      intensity: 0,
      color: new pc.Color(1.0, 0.38, 0.06),
    });
    ember.setLocalPosition(0, 0.8, SLICE_WORLD.villageZ - 4);
    this.app.root.addChild(ember);
    this._distressEmberLight = ember;

    // ── 4. Red danger omni light (very-low HP pulse) ─────────────────────────
    const danger = new pc.Entity("distress-danger-light");
    danger.addComponent("light", {
      type: "omni",
      castShadows: false,
      range: 28,
      intensity: 0,
      color: new pc.Color(1.0, 0.10, 0.04),
    });
    danger.setLocalPosition(0, 2.0, SLICE_WORLD.villageZ);
    this.app.root.addChild(danger);
    this._distressDangerLight = danger;
  }

  /**
   * updateVillageDistress(dt)
   *
   * Drives three staged visual degradation tiers purely from
   * this.state.villageHp / this.state.maxVillageHp each frame.
   *
   * Separation from bullet-impact system: we never touch entitiesByWindow's
   * enabled flag, entitiesByImpact, brokenWindows, structureHits, or
   * activeImpactFx counters.  We only mutate the cloned material instances in
   * _windowGlowMats and the dedicated distress entities created in
   * _initVillageDistress().
   */
  updateVillageDistress(dt) {
    const maxHp = Math.max(1, this.state.maxVillageHp);
    const rawRatio = Math.max(0, Math.min(1, this.state.villageHp / maxHp));

    // Smooth the ratio so visuals don't snap at exact thresholds.
    // Recover fast when healing (~3/s), degrade a bit slower (~1.5/s) for drama.
    const lerpSpeed = rawRatio > this._villageDistressRatio ? 3.0 : 1.5;
    this._villageDistressRatio += (rawRatio - this._villageDistressRatio) * Math.min(1, lerpSpeed * dt);
    const r = this._villageDistressRatio; // 0=destroyed, 1=pristine
    const t = this.state.elapsedSec ?? 0;

    // ── 1. Window glow ───────────────────────────────────────────────────────
    // Stages:
    //   r >= 0.82 → full warm glow (pristine)
    //   r  0.82→0.35 → dims from 1.0 → 0.12 with per-window flicker
    //   r  0.35→0.00 → near-dark guttering (0.12 → 0.05)
    // Base emissive from MATERIALS.windowGlow = [2.2, 0.95, 0.28]
    const WG_BASE_R = 2.2;
    const WG_BASE_G = 0.95;
    const WG_BASE_B = 0.28;

    for (let i = 0; i < this._windowGlowMats.length; i += 1) {
      const { entity, mat } = this._windowGlowMats[i];
      const phase = i * 1.57 + 0.4; // unique phase per window

      let intensity;
      if (r >= 0.82) {
        intensity = 1.0;
      } else if (r >= 0.35) {
        // Aggressive dim: 1.0 at r=0.82 → 0.12 at r=0.35
        const band = (r - 0.35) / (0.82 - 0.35); // 0 at r=0.35, 1 at r=0.82
        const flickerAmt = (1 - band) * 0.25;
        const flicker = this._reducedMotion ? 0 : Math.sin(t * 4.8 + phase) * flickerAmt;
        intensity = 0.12 + band * 0.88 + flicker;
      } else {
        // Critical guttering: 0.12 at r=0.35 → 0.05 at r=0
        const band = r / 0.35; // 0 at r=0, 1 at r=0.35
        const flicker = this._reducedMotion ? 0 : Math.sin(t * 8.2 + phase) * 0.06 * band;
        intensity = 0.05 + band * 0.07 + flicker;
      }

      // Never fully zero — avoids a pitch-black square artifact.
      intensity = Math.max(0.05, intensity);

      mat.emissive.set(WG_BASE_R * intensity, WG_BASE_G * intensity, WG_BASE_B * intensity);
      // Diffuse also shifts cooler/darker as windows go out.
      const diffuseDim = 0.40 + 0.60 * intensity;
      mat.diffuse.set(diffuseDim, diffuseDim * 0.72, diffuseDim * 0.32);
      mat.update();

      void entity; // keep reference (impact system may set enabled=false on this entity)
    }

    // ── 2. Smoke columns ─────────────────────────────────────────────────────
    // Smoke starts below r=0.72; scales to full 5 columns at r=0.
    // Opacity is kept high enough (≥0.20 when active) so it reads clearly.
    const cap = PlayCanvasZombieSlice.DISTRESS_SMOKE_CAP;
    let targetSmokeCount = 0;
    if (r < 0.72) {
      const smokeT = Math.max(0, (0.72 - r) / 0.72); // 0→1 as r drops 0.72→0
      targetSmokeCount = Math.min(cap, Math.ceil(smokeT * cap));
    }

    for (let i = 0; i < this._distressSmokePool.length; i += 1) {
      const smoke = this._distressSmokePool[i];
      const active = i < targetSmokeCount;
      smoke.enabled = active;
      if (!active) continue;

      // Slow rise cycle: ~5s period per column (staggered by phase).
      const cyclePeriod = 0.18; // cycles/sec  → period ≈ 5.6s
      const ph = (t * cyclePeriod + smoke._distressSmokePhase) % 1;
      // Rise fraction: 0→1 over the full cycle (column keeps rising).
      const riseFrac = ph;
      // Opacity: ramp in over first 8%, hold through 75%, ramp out last 25%.
      const fadeFrac = ph < 0.08 ? ph / 0.08 : ph < 0.75 ? 1 : Math.max(0, (1 - ph) / 0.25);

      // Deeper damage → higher opacity, more opaque smoke.
      const distressDepth = Math.max(0, (0.72 - r) / 0.72); // 0→1
      const baseOpacity = this._reducedMotion ? 0.12 : 0.30;
      const maxOpacity  = this._reducedMotion ? 0.24 : 0.62;
      const opacity = (baseOpacity + distressDepth * (maxOpacity - baseOpacity)) * fadeFrac;

      // Scale: large puff that grows as it rises — must be big enough to read
      // at the 15–30u viewing distance (houses are at x≈±10–14, z≈villageZ–10).
      // baseScale starts at 2.5 and scales up with distress depth.
      const baseScale = 2.5 + distressDepth * 2.5;
      const scaleX = baseScale * (1 + riseFrac * 0.5);
      const scaleY = baseScale * (0.55 + riseFrac * 1.8); // stretch tall as it rises
      const scaleZ = baseScale * (1 + riseFrac * 0.5);

      // Position: start at roof height (~4u), rise to ~10u so it clears the roofline.
      const baseY = 4.0;
      const riseY = riseFrac * 6.0;
      smoke.setLocalPosition(smoke._distressSmokeBaseX, baseY + riseY, smoke._distressSmokeBaseZ);
      smoke.setLocalScale(scaleX, scaleY, scaleZ);

      const smokeMat = smoke._distressSmokeMat;
      smokeMat.opacity = Math.max(0, Math.min(0.75, opacity));
      // Warm ember tinge at mid-distress (orange smoke reads against dark sky);
      // transitions to near-black at critical HP.
      const tinge = Math.max(0, 0.18 - distressDepth * 0.12);
      smokeMat.emissive.set(tinge + 0.06, tinge * 0.55 + 0.04, 0.02);
      smokeMat.update();
    }

    // ── 3. Ember glow light (below ~70%) ─────────────────────────────────────
    if (this._distressEmberLight?.light) {
      const el = this._distressEmberLight.light;
      if (r >= 0.72) {
        el.intensity = 0;
      } else {
        const emberT = Math.max(0, (0.72 - r) / 0.72); // 0→1 as r 0.72→0
        const flicker = this._reducedMotion ? 0 : Math.sin(t * 6.4 + 0.3) * 0.30 * emberT;
        el.intensity = Math.max(0, emberT * 3.5 + flicker);
        // Orange→deep-red shift as HP falls.
        el.color.set(1.0, Math.max(0.08, 0.50 - emberT * 0.42), 0.05);
      }
    }

    // ── 4. Red danger pulsing light (below ~25%) ─────────────────────────────
    if (this._distressDangerLight?.light) {
      const dl = this._distressDangerLight.light;
      if (r >= 0.26) {
        dl.intensity = 0;
      } else {
        const dangerT = Math.max(0, (0.26 - r) / 0.26); // 0→1 as r 0.26→0
        // 1.5 Hz heartbeat-like pulse; reduced-motion gets a steady glow.
        const pulse = this._reducedMotion
          ? 1
          : 0.45 + 0.55 * Math.sin(t * Math.PI * 1.5);
        dl.intensity = dangerT * 3.8 * pulse;
        dl.color.set(1.0, 0.06, 0.02);
      }
    }
  }

  updateWindowImpactVisuals() {
    const snapshot = getPlayCanvasImpactSnapshot(this.state);
    const broken = new Set(snapshot.brokenWindowIds);
    for (const [id, entity] of this.entitiesByWindow.entries()) {
      entity.enabled = !broken.has(id);
    }

    const liveIds = new Set(snapshot.impacts.map((event) => event.id));
    for (const [id, entity] of this.entitiesByImpact.entries()) {
      if (!liveIds.has(id)) {
        entity.destroy();
        this.entitiesByImpact.delete(id);
      }
    }

    for (const event of snapshot.impacts) {
      const entity = this.entitiesByImpact.get(event.id) ?? this.createImpactEntity(event);
      const pulse = Math.max(0.12, event.ttlSec / 0.72);
      const base = entity._baseScale ?? 1;
      entity.setLocalPosition(event.x, event.y, event.z);
      entity.setLocalScale(base * pulse, base * pulse, base * pulse);
      entity.setEulerAngles(0, (this.state.elapsedSec * 180 + event.id.length * 11) % 360, 0);
    }
  }

  createImpactEntity(event) {
    const materialKey = impactMaterialKey(event.materialId);
    const scale = event.windowShattered || event.materialId === "glass" ? 0.42 : 0.3;
    const root = new pc.Entity(`impact-root-${event.id}`);
    this.app.root.addChild(root);
    this.addPrimitive(`${event.id}-burst`, "sphere", [0, 0, 0], [scale, scale * 0.52, scale], materialKey, root);
    this.addPrimitive(`${event.id}-chip`, "box", [0.12, 0.03, -0.06], [scale * 0.8, 0.035, scale * 0.18], materialKey, root).setLocalEulerAngles(0, 35, 18);
    root.setLocalPosition(event.x, event.y, event.z);
    root._baseScale = 1;
    this.entitiesByImpact.set(event.id, root);
    return root;
  }

  createVillagerEntity(villager) {
    // GLB path — skinned Quaternius villager model (man/woman alternated by id hash)
    if (this.villagerGlbContainers) {
      const root = createVillagerGlbEntity(this.app, villager, this.villagerGlbContainers);
      // GLB entity has _glb, _healthRoot, _healthFill set by createVillagerGlbEntity.
      // Health bar Y for GLB is at 1.92u (set inside villagerGlb.js).
      root._healthBarY = 1.92;
      this.entitiesByVillager.set(villager.id, root);
      return root;
    }

    // Primitive rig fallback — used until GLB containers load or on GLB failure
    const root = new pc.Entity(`villager-${villager.id}`);
    this.app.root.addChild(root);
    this.addPrimitive(`${villager.id}-shadow`, "cylinder", [0, 0.04, 0], [0.5, 0.035, 0.5], "road", root);
    this.addPrimitive(`${villager.id}-body`, "capsule", [0, 0.92, 0], [0.42, 1.08, 0.42], "clothBlue", root);
    this.addPrimitive(`${villager.id}-head`, "sphere", [0, 1.58, -0.03], [0.28, 0.28, 0.26], "houseWall", root);
    this.addPrimitive(`${villager.id}-beacon`, "sphere", [0, 1.96, 0], [0.12, 0.12, 0.12], "lantern", root);
    const healthRoot = new pc.Entity(`${villager.id}-health`);
    root.addChild(healthRoot);
    this.addPrimitive(`${villager.id}-health-back`, "box", [0, 2.34, -0.045], [0.94, 0.07, 0.04], "healthBack", healthRoot);
    const healthFill = this.addPrimitive(`${villager.id}-health-fill`, "box", [0, 2.34, -0.04], [0.86, 0.05, 0.035], "healthFill", healthRoot);
    healthRoot.enabled = false;
    root._healthRoot = healthRoot;
    root._healthFill = healthFill;
    root._healthBarY = 2.34; // primitive health bar Y (head at 1.58u)
    this.entitiesByVillager.set(villager.id, root);
    return root;
  }

  updateGearVisuals() {
    if (this.flashlight) {
      this.flashlight.enabled = this.state.ownedGear.includes("flashlight");
    }
    const livePatchIds = new Set(this.state.firePatches.map((patch) => patch.id));
    for (const [id, entity] of this.fireEntitiesByPatch.entries()) {
      if (!livePatchIds.has(id)) {
        entity.destroy();
        this.fireEntitiesByPatch.delete(id);
      }
    }
    for (const patch of this.state.firePatches) {
      const entity = this.fireEntitiesByPatch.get(patch.id) ?? this.createFirePatchEntity(patch);
      entity.setLocalPosition(patch.x, 0, patch.z);
      const parts = entity._fireParts;
      if (parts) {
        const t = this.state.elapsedSec;
        const flicker = 0.9 + Math.sin(t * 9.4 + patch.id.length) * 0.14;
        const flicker2 = 0.9 + Math.sin(t * 7.1 + patch.id.length * 1.3) * 0.12;
        parts.flame0.setLocalScale(patch.radius * 0.9 * flicker, 0.32 * flicker, patch.radius * 0.9 * flicker);
        parts.flame0.setLocalPosition(0, 0.22 + Math.sin(t * 5.2) * 0.04, 0);
        parts.flame1.setLocalScale(patch.radius * 0.56 * flicker2, 0.44 * flicker2, patch.radius * 0.56 * flicker2);
        parts.flame1.setLocalPosition(0, 0.44 + Math.sin(t * 6.8 + 1.1) * 0.06, 0);
        parts.tip.setLocalScale(patch.radius * 0.26 * flicker, 0.28 * flicker, patch.radius * 0.26 * flicker);
        parts.tip.setLocalPosition(0, 0.74 + Math.sin(t * 11.2 + 0.7) * 0.08, 0);
        if (parts.light?.light) {
          parts.light.light.intensity = 1.4 + Math.sin(t * 8.4 + patch.id.length * 0.7) * 0.4;
        }
      }
    }
  }

  drawMiniMap() {
    if (!this.minimapOpen || !this.minimapCtx || !this.minimapCanvas) {
      return;
    }
    const ctx = this.minimapCtx;
    const size = this.minimapCanvas.width;
    const pad = MINIMAP_PADDING_PX;
    const drawSize = size - pad * 2;
    const snapshot = getPlayCanvasMiniMapSnapshot(this.state);
    const toMap = (point) =>
      worldToMiniMapPoint({
        x: point.x,
        z: point.z,
        worldHalfExtent: snapshot.worldHalfExtent,
        mapSizePx: size,
        paddingPx: pad,
      });

    ctx.clearRect(0, 0, size, size);
    const bg = ctx.createLinearGradient(0, 0, 0, size);
    bg.addColorStop(0, "rgba(9,23,27,0.94)");
    bg.addColorStop(1, "rgba(5,10,16,0.96)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = "rgba(216,255,125,0.26)";
    ctx.lineWidth = 1;
    ctx.strokeRect(pad, pad, drawSize, drawSize);

    for (const building of snapshot.buildings) {
      const point = toMap(building.exteriorDoor);
      ctx.fillStyle = building.opened ? "rgba(216,255,125,0.86)" : "rgba(188,235,135,0.58)";
      ctx.fillRect(point.x - 2, point.y - 2, 4, 4);
    }

    ctx.fillStyle = "rgba(93,108,121,0.58)";
    ctx.strokeStyle = "rgba(216,255,125,0.16)";
    for (const structure of this.minimapStructures) {
      const center = toMap(structure);
      const halfW = worldRadiusToMiniMapPx({
        radius: structure.sx * 0.5,
        worldHalfExtent: snapshot.worldHalfExtent,
        mapSizePx: size,
        paddingPx: pad,
        minPx: 2,
        maxPx: 20,
      });
      const halfH = worldRadiusToMiniMapPx({
        radius: structure.sz * 0.5,
        worldHalfExtent: snapshot.worldHalfExtent,
        mapSizePx: size,
        paddingPx: pad,
        minPx: 2,
        maxPx: 20,
      });
      ctx.fillRect(center.x - halfW, center.y - halfH, halfW * 2, halfH * 2);
      ctx.strokeRect(center.x - halfW, center.y - halfH, halfW * 2, halfH * 2);
    }

    const villagePoint = toMap(snapshot.village);
    const villageRadius = worldRadiusToMiniMapPx({
      radius: snapshot.village.radius,
      worldHalfExtent: snapshot.worldHalfExtent,
      mapSizePx: size,
      paddingPx: pad,
      minPx: 5,
      maxPx: 24,
    });
    ctx.fillStyle = "rgba(255,216,112,0.16)";
    ctx.beginPath();
    ctx.arc(villagePoint.x, villagePoint.y, villageRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,216,112,0.72)";
    ctx.beginPath();
    ctx.arc(villagePoint.x, villagePoint.y, villageRadius, 0, Math.PI * 2);
    ctx.stroke();

    for (const patch of snapshot.activeFirePatches) {
      const point = toMap(patch);
      const radiusPx = worldRadiusToMiniMapPx({
        radius: patch.radius,
        worldHalfExtent: snapshot.worldHalfExtent,
        mapSizePx: size,
        paddingPx: pad,
        minPx: 3,
        maxPx: 16,
      });
      ctx.fillStyle = "rgba(255,128,48,0.2)";
      ctx.beginPath();
      ctx.arc(point.x, point.y, radiusPx, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,178,99,0.95)";
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const villager of snapshot.villagers) {
      if (villager.state !== "idle" && villager.state !== "escorting") {
        continue;
      }
      const point = toMap(villager);
      ctx.fillStyle = villager.state === "escorting" ? "rgba(104,187,255,0.98)" : "rgba(74,171,255,0.9)";
      ctx.beginPath();
      ctx.arc(point.x, point.y, villager.state === "escorting" ? 2.8 : 2.1, 0, Math.PI * 2);
      ctx.fill();
    }

    if (snapshot.escortDropoff) {
      const dropoffPoint = toMap(snapshot.escortDropoff);
      const dropoffRadius = worldRadiusToMiniMapPx({
        radius: snapshot.escortDropoff.radius,
        worldHalfExtent: snapshot.worldHalfExtent,
        mapSizePx: size,
        paddingPx: pad,
        minPx: 4,
        maxPx: 18,
      });
      const escort = snapshot.villagers.find((villager) => villager.state === "escorting");
      if (escort) {
        const escortPoint = toMap(escort);
        ctx.strokeStyle = "rgba(104,187,255,0.48)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(escortPoint.x, escortPoint.y);
        ctx.lineTo(dropoffPoint.x, dropoffPoint.y);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(255,216,112,0.86)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(dropoffPoint.x, dropoffPoint.y, dropoffRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,216,112,0.96)";
      ctx.beginPath();
      ctx.arc(dropoffPoint.x, dropoffPoint.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const zombie of snapshot.liveZombies) {
      const point = toMap(zombie);
      const isHeavy = zombie.type === "mega_zombie" || zombie.type === "secret_boss" || zombie.type === "mini_boss" || zombie.type === "juggernaut";
      ctx.fillStyle = isHeavy ? "rgba(255,116,76,0.96)" : "rgba(118,227,96,0.9)";
      ctx.beginPath();
      ctx.arc(point.x, point.y, isHeavy ? 3.2 : 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    const playerPoint = toMap(snapshot.player);
    ctx.save();
    ctx.translate(playerPoint.x, playerPoint.y);
    ctx.rotate(-snapshot.player.yaw);
    ctx.fillStyle = "rgba(104,187,255,0.98)";
    ctx.beginPath();
    ctx.moveTo(0, -5.2);
    ctx.lineTo(3.6, 4.4);
    ctx.lineTo(-3.6, 4.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  createFirePatchEntity(patch) {
    const root = new pc.Entity(`fire-root-${patch.id}`);
    root.setLocalPosition(patch.x, 0, patch.z);
    this.app.root.addChild(root);
    const base = this.addPrimitive(`fire-base-${patch.id}`, "cylinder", [0, 0.03, 0], [patch.radius * 1.1, 0.04, patch.radius * 1.1], "road", root);
    base.render.castShadows = false;
    const flame0 = this.addPrimitive(`fire-f0-${patch.id}`, "sphere", [0, 0.22, 0], [patch.radius * 0.9, 0.32, patch.radius * 0.9], "muzzle", root);
    flame0.render.castShadows = false;
    const flame1 = this.addPrimitive(`fire-f1-${patch.id}`, "sphere", [0, 0.44, 0], [patch.radius * 0.56, 0.44, patch.radius * 0.56], "pumpkin", root);
    flame1.render.castShadows = false;
    const tip = this.addPrimitive(`fire-tip-${patch.id}`, "sphere", [0, 0.74, 0], [patch.radius * 0.26, 0.28, patch.radius * 0.26], "lantern", root);
    tip.render.castShadows = false;
    const light = new pc.Entity(`fire-light-${patch.id}`);
    light.addComponent("light", {
      type: "omni",
      castShadows: false,
      range: patch.radius * 5,
      intensity: 1.8,
      color: new pc.Color(1.0, 0.45, 0.1),
    });
    light.setLocalPosition(0, 0.6, 0);
    root.addChild(light);
    root._fireParts = { flame0, flame1, tip, light };
    this.fireEntitiesByPatch.set(patch.id, root);
    return root;
  }

  spawnFirePulse() {
    const forward = this.camera.forward.clone();
    const origin = this.camera.getPosition().clone();
    const pulse = this.addPrimitive(`flint-pulse-${performance.now()}`, "sphere", [origin.x + forward.x * 5, 0.35, origin.z + forward.z * 5], [0.38, 0.38, 0.38], "lantern");
    pulse._sliceTtl = 0.32;
    this.fx.push(pulse);
  }

  updateFx(dt) {
    // ── Legacy muzzle flash sphere (used only by flamethrower) ────────────────
    if (this.muzzleFlash?.enabled) {
      this.muzzleFlash._sliceTtl = (this.muzzleFlash._sliceTtl ?? 0) - dt;
      if (this.muzzleFlash._sliceTtl <= 0) {
        this.muzzleFlash.enabled = false;
      }
    }

    // ── Muzzle light decay ────────────────────────────────────────────────────
    if (this.muzzleLightEntity?._sliceMuzzleLight) {
      const ttl = (this.muzzleLightEntity._sliceTtl ?? 0) - dt;
      this.muzzleLightEntity._sliceTtl = ttl;
      if (this.muzzleLightEntity.light) {
        const maxTtl = this.muzzleLightEntity._sfxLightMaxTtl ?? 0.09;
        const peak = this.muzzleLightEntity._sfxLightPeakIntensity ?? 2.5;
        // Fast rise (first 20%) then smooth exponential decay
        const norm = Math.max(0, ttl / Math.max(0.001, maxTtl));
        this.muzzleLightEntity.light.intensity = Math.max(0, peak * norm * norm);
      }
    }

    // ── Pooled flash slots — animate scale up then collapse ───────────────────
    for (const slot of this.shotFx.flashes) {
      if (slot._sfxTtl <= 0) continue;
      slot._sfxTtl -= dt;
      if (slot._sfxTtl <= 0) {
        slot.enabled = false;
        continue;
      }
      const norm = slot._sfxTtl / Math.max(0.001, slot._sfxMaxTtl);
      // norm=1 when just spawned, 0 when expired.
      // Shape: immediate max scale, then quick collapse with slight overshoot spike:
      //   first 30% of life: hold near full; last 70%: rapid collapse to zero.
      const spike = norm > 0.7 ? 1.0 + (norm - 0.7) * 0.6 : norm / 0.7;
      const s = Math.max(0.01, spike);
      const b = slot._sfxBaseSize;
      slot._sfxCore.setLocalScale(b * 0.55 * s, b * 0.55 * s, b * 0.55 * s);
      // Arms collapse faster than core — spiked star → blob → gone
      const armS = Math.max(0.01, norm > 0.7 ? s : (norm / 0.7) * (norm / 0.7));
      slot._sfxArmH.setLocalScale(b * 2.6 * armS, b * 0.14 * s, b * 0.14 * s);
      slot._sfxArmV.setLocalScale(b * 0.14 * s, b * 2.4 * armS, b * 0.14 * s);
    }

    // ── Pooled tracer slots — fade out linearly ────────────────────────────────
    for (const slot of this.shotFx.tracers) {
      if (slot._sfxTtl <= 0) continue;
      slot._sfxTtl -= dt;
      if (slot._sfxTtl <= 0) {
        slot.enabled = false;
        continue;
      }
      const norm = Math.max(0.01, slot._sfxTtl / Math.max(0.001, slot._sfxMaxTtl));
      const thick = (slot._sfxTracerThick ?? 0.018) * norm;
      slot.setLocalScale(thick, thick, slot._sfxTracerLen ?? 8);
    }

    // ── Pooled burst slots — move particles with gravity ──────────────────────
    for (const slot of this.shotFx.bursts) {
      if (slot._sfxTtl <= 0) continue;
      slot._sfxTtl -= dt;
      if (slot._sfxTtl <= 0) {
        slot.enabled = false;
        continue;
      }
      const norm = Math.max(0, slot._sfxTtl / Math.max(0.001, slot._sfxMaxTtl));
      const count = slot._sfxCount ?? slot._sfxParts.length;
      const gravity = slot._sfxGravity ?? 4.5;
      const partSize = slot._sfxPartSize ?? 0.065;
      for (let p = 0; p < count; p += 1) {
        const part = slot._sfxParts[p];
        const vel = slot._sfxVelocities[p];
        // Integrate position in local space
        vel.y -= gravity * dt;
        const lp = part.getLocalPosition();
        part.setLocalPosition(lp.x + vel.x * dt, lp.y + vel.y * dt, lp.z + vel.z * dt);
        // Scale down as particles age
        const ps = partSize * Math.max(0.01, norm);
        part.setLocalScale(ps, ps, ps);
      }
    }

    // ── Legacy fx array (ordnance blasts, fire pulses, etc.) ─────────────────
    this.fx = this.fx.filter((entity) => {
      if (entity._sliceMuzzleLight) {
        return entity._sliceTtl > 0;
      }
      entity._sliceTtl = (entity._sliceTtl ?? 0) - dt;
      const baseScale = entity._sliceBaseScale;
      if (baseScale) {
        const progress = Math.max(0.01, entity._sliceTtl / Math.max(0.001, entity._sliceMaxTtl ?? entity._sliceTtl));
        entity.setLocalScale(baseScale[0] * progress, baseScale[1] * progress, baseScale[2] * progress);
      } else {
        const scale = Math.max(0.01, entity._sliceTtl);
        entity.setLocalScale(scale, scale, scale);
      }
      if (entity._sliceTtl > 0) {
        return true;
      }
      entity.destroy();
      return false;
    });
  }

  updateHud() {
    if (this.lastRenderedPhase !== this.state.phase) {
      this.lastRenderedPhase = this.state.phase;
    }
    const live = this.state.zombies.filter((zombie) => !zombie.dead).length;
    this.fields.phase.textContent = this.state.phase.toUpperCase();
    this.fields.message.textContent = this.state.lastMessage;
    this.fields.wave.textContent = this.state.waveNumber;
    this.fields.village.textContent = `${Math.ceil(this.state.villageHp)}/${this.state.maxVillageHp}`;
    this.fields.player.textContent = Math.ceil(this.state.playerHp);
    const weaponDef = this.state.equippedWeaponId ? getWeaponDef(this.state.equippedWeaponId) : null;
    if (weaponDef && weaponDef.magSize > 0) {
      this.fields.ammo.textContent = this.state.pendingReload ? "RELOAD" : `${this.state.ammo ?? 0}/${weaponDef.magSize}`;
    } else {
      this.fields.ammo.textContent = "INF";
    }
    const staminaField = this.root.querySelector('[data-field="stamina"]');
    if (staminaField) {
      staminaField.textContent = Math.floor(this.state.stamina ?? 100);
    }
    if (this.reloadBarWrapper) {
      const reloading = this.state.pendingReload && weaponDef;
      this.reloadBarWrapper.hidden = !reloading;
      if (reloading) {
        const reloadField = this.reloadBarWrapper.querySelector('[data-field="reload"]');
        if (reloadField) {
          const pct = Math.round((1 - (this.state.reloadTimerSec ?? 0) / Math.max(0.01, weaponDef.reloadSec ?? 1)) * 100);
          reloadField.textContent = `${pct}%`;
        }
      }
    }
    this.fields.ordnance.textContent = ordnanceLabel(this.state);
    this.fields.weapon.textContent = weaponLabel(this.state.equippedWeaponId);
    this.fields.armor.textContent = armorLabel(this.state.equippedArmorId);
    this.fields.gear.textContent = gearLabel(this.state);
    this.fields.fire.textContent = `${this.state.firePatches.length}${this.state.flintCooldownSec > 0 ? `/${Math.ceil(this.state.flintCooldownSec)}s` : ""}`;
    this.fields.inside.textContent = this.state.activeBuildingId ? buildingShortLabel(this.state.activeBuildingId) : "Out";
    this.fields.rescued.textContent = `${this.state.rescuedVillagers.length}/${this.state.villagers.length}`;
    this.fields.town.textContent = this.state.villageLevel;
    this.fields.coins.textContent = this.state.coins;
    this.fields.kills.textContent = this.state.kills;
    this.fields.live.textContent = live;
    // ── Bar fills ──────────────────────────────────────────────────────────
    const vRatio = clamp(this.state.villageHp / Math.max(1, this.state.maxVillageHp), 0, 1);
    if (this.bars.village) {
      this.bars.village.style.width = (vRatio * 100) + '%';
      this.bars.village.style.backgroundColor =
        vRatio > 0.5 ? 'var(--zi-village)' :
        vRatio > 0.25 ? '#e87e28' :
        'var(--zi-danger)';
    }
    const hRatio = clamp(this.state.playerHp / 100, 0, 1);
    if (this.bars.health) {
      this.bars.health.style.width = (hRatio * 100) + '%';
      this.bars.health.style.backgroundColor =
        hRatio > 0.35 ? 'var(--zi-hp)' : 'var(--zi-hp-low)';
    }
    const sRatio = clamp((this.state.stamina ?? 100) / 100, 0, 1);
    if (this.bars.stamina) {
      this.bars.stamina.style.width = (sRatio * 100) + '%';
    }
    this.root.querySelector('[data-action="start"]').textContent = this.state.phase === "intermission"
      ? `Start Wave ${this.state.waveNumber + 1}`
      : this.state.phase === "ready"
        ? "Start Campaign"
        : this.state.phase === "secret_boss"
          ? "Boss Active"
          : "Wave Running";
    this.root.querySelector('[data-action="start"]').disabled = this.state.phase !== "ready" && this.state.phase !== "intermission";
    this.root.querySelector('[data-action="shop"]').disabled = this.state.phase === "ready" || this.state.phase === "secret_boss" || this.state.phase === "lost" || this.state.phase === "won";
    this.root.querySelector('[data-action="ordnance"]').disabled = !isActivePlayPhase(this.state.phase);
    const musicButton = this.root.querySelector('[data-action="music"]');
    const sfxButton = this.root.querySelector('[data-action="sfx"]');
    if (musicButton) {
      musicButton.textContent = this.state.musicEnabled !== false ? "Music On" : "Music Off";
      musicButton.classList.toggle("is-active", this.state.musicEnabled !== false);
    }
    if (sfxButton) {
      sfxButton.textContent = this.state.sfxEnabled !== false ? "SFX On" : "SFX Off";
      sfxButton.classList.toggle("is-active", this.state.sfxEnabled !== false);
    }
    const hapticsButton = this.root.querySelector('[data-action="haptics"]');
    if (hapticsButton) {
      hapticsButton.textContent = this.hapticsEnabled ? "Haptics On" : "Haptics Off";
      hapticsButton.classList.toggle("is-active", this.hapticsEnabled);
    }
    if (this.state.phase === "ready" || this.state.phase === "secret_boss" || this.state.phase === "lost" || this.state.phase === "won") {
      this.shopOpen = false;
    }
    if (this.state.phase === "intermission") {
      this.shopOpen = true;
    }
    this.shopPanel.hidden = !this.shopOpen;
    if (this.shopOpen) {
      this.renderShop();
    }
    this.renderFlowPanel(live);
    this.updateGuidancePanel();
    this.updateMiniMapVisibility();
  }

  renderFlowPanel(live) {
    const visible = !isActivePlayPhase(this.state.phase);
    this.flowPanel.hidden = !visible;
    // The bottom action bar duplicates the modal's Start/Shop/Reset on the
    // menu, so hide it whenever the flow modal is up; it returns for in-game
    // controls (Blast/Shop/Reset/Map) once play starts.
    if (this.actionBar) {
      this.actionBar.hidden = visible;
    }
    // Add is-menu to root when fully-covering modal is showing (ready/lost/won)
    // to suppress the in-game HUD clusters. Keep HUD visible during intermission.
    const isFullCover = visible && this.state.phase !== "intermission";
    this.root.classList.toggle("is-menu", isFullCover);
    // Blur the 3D scene behind the intermission panel (HUD clusters stay sharp).
    this.root.classList.toggle("is-intermission", visible && this.state.phase === "intermission");
    if (!visible) {
      return;
    }

    const summary = this.state.waveSummary;
    const phaseCopy = {
      ready: {
        eyebrow: "Night Survival",
        title: "Zombie Invasion",
        body: "Defend the bell tower through 12 waves with infinite ammo, field upgrades, and ordnance.",
        primary: "Start Campaign",
        shop: "Shop",
        reset: "Reset Run",
      },
      intermission: {
        eyebrow: `Wave ${summary?.wave ?? this.state.waveNumber} Cleared`,
        title: "Regroup at the village",
        body: `Kills ${summary?.kills ?? this.state.kills}. Spend coins in the field shop before wave ${this.state.waveNumber + 1}.`,
        primary: `Start Wave ${this.state.waveNumber + 1}`,
        shop: "Open Shop",
        reset: "Reset Run",
      },
      lost: {
        eyebrow: "Campaign Failed",
        title: "The village was overrun",
        body: this.state.lastMessage,
        primary: "Retry Campaign",
        shop: "Shop",
        reset: "Back to Start",
      },
      won: {
        eyebrow: "Campaign Complete",
        title: "The bell tower stands",
        body: "The secret boss is defeated and the village survives the night.",
        primary: "Play Again",
        shop: "Shop",
        reset: "Back to Start",
      },
    }[this.state.phase] ?? {
      eyebrow: this.state.phase,
      title: "Zombie Invasion",
      body: this.state.lastMessage,
      primary: "Continue",
      shop: "Shop",
      reset: "Reset Run",
    };

    this.flowFields.eyebrow.textContent = phaseCopy.eyebrow;
    this.flowFields.title.textContent = phaseCopy.title;
    this.flowFields.body.textContent = phaseCopy.body;
    this.flowFields.wave.textContent = this.state.waveNumber;
    this.flowFields.best.textContent = this.state.bestWave;
    this.flowFields.coins.textContent = this.state.coins;
    this.flowFields.kills.textContent = this.state.kills;
    this.flowFields.primary.textContent = phaseCopy.primary;
    this.flowFields.shop.textContent = phaseCopy.shop;
    this.flowFields.reset.textContent = phaseCopy.reset;
    this.flowFields.shop.disabled = this.state.phase === "ready" || this.state.phase === "secret_boss" || this.state.phase === "lost" || this.state.phase === "won";
    if (this.flowFields.settings) this.flowFields.settings.hidden = !(this.state.phase === "ready");
    // Legacy revive button is superseded by the new pc-offer-list; keep it hidden.
    if (this.flowFields.revive) {
      this.flowFields.revive.hidden = true;
      this.flowFields.revive.disabled = true;
    }
    const isReady = this.state.phase === "ready";
    if (this.flowFields.stats) this.flowFields.stats.hidden = !isReady;
    if (this.flowFields.goals) this.flowFields.goals.hidden = !isReady;
    if (isReady) {
      const ls = this.state.lifetimeStats ?? {};
      if (this.flowFields.lifetimeKills) this.flowFields.lifetimeKills.textContent = ls.kills ?? 0;
      if (this.flowFields.lifetimeWaves) this.flowFields.lifetimeWaves.textContent = ls.wavesCleared ?? 0;
      if (this.flowFields.lifetimeTime) {
        const mins = Math.floor((ls.playSeconds ?? 0) / 60);
        this.flowFields.lifetimeTime.textContent = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
      }
      if (this.flowFields.lifetimeDamage) this.flowFields.lifetimeDamage.textContent = ls.damageDealt ?? 0;
      const musicInput = this.flowPanel.querySelector('[data-menu-setting="musicEnabled"]');
      const sfxInput = this.flowPanel.querySelector('[data-menu-setting="sfxEnabled"]');
      const qualitySelect = this.flowPanel.querySelector('[data-menu-setting="qualityPreset"]');
      if (musicInput) musicInput.checked = this.state.musicEnabled !== false;
      if (sfxInput) sfxInput.checked = this.state.sfxEnabled !== false;
      if (qualitySelect) qualitySelect.value = this.state.qualityPreset ?? "auto";
    } else {
      this.flowPanel.querySelectorAll("[data-menu-section]").forEach((s) => { s.hidden = true; });
    }
    this.renderGameOverOffers();
    this.flowPanel.dataset.phase = this.state.phase;
    this.flowPanel.dataset.liveZombies = String(live);
  }

  renderShop() {
    const items = getShopItems(this.state);
    const guidance = getPlayCanvasGuidanceSnapshot(this.state);
    const recommendation = guidance.recommendation;
    if (this.shopGuideTitle) {
      this.shopGuideTitle.textContent = recommendation?.title ?? "Field Shop";
    }
    if (this.shopGuideBody) {
      const threat = guidance.nextThreat ? ` Next: ${guidance.nextThreat.label}.` : "";
      this.shopGuideBody.textContent = recommendation ? `${recommendation.reason}${threat}` : "Upgrade whenever you have coins";
    }
    this.shopItemsRoot.innerHTML = items
      .map((item) => {
        const recommended = isRecommendedShopItem(item, recommendation);
        return `
          <article class="pc-shop-card ${item.equipped ? "is-equipped" : ""} ${recommended ? "is-recommended" : ""}" ${recommended ? 'data-recommended="true"' : ""}>
            <strong>${escapeHtml(item.label)}</strong>
            <span>${escapeHtml(item.detail)}</span>
            <button type="button" data-shop-type="${escapeHtml(item.type)}" data-shop-id="${escapeHtml(item.id)}" ${item.disabled ? "disabled" : ""}>${escapeHtml(item.status)}</button>
          </article>
        `;
      })
      .join("");
  }

  updateGuidancePanel() {
    if (!this.guidancePanel) {
      return;
    }
    const guidance = getPlayCanvasGuidanceSnapshot(this.state);
    // Suppress when: shop open, boss phase, OR flow modal is fully covering (ready/lost/won)
    const flowCovering = this.state.phase === "ready" || this.state.phase === "lost" || this.state.phase === "won";
    const suppress = this.shopOpen || guidance.stage === "secret_boss" || flowCovering;
    if (suppress) {
      this.guidancePanel.hidden = true;
      return;
    }
    const enemyIntro = guidance.enemyIntro;
    // Track enemy-intro cue separately (shows for 3.5s)
    if (enemyIntro && enemyIntro.type !== this._lastShownEnemyIntroType) {
      this._lastShownEnemyIntroType = enemyIntro.type;
      this._enemyCueDisplaySec = 3.5;
    }
    this._enemyCueDisplaySec = Math.max(0, (this._enemyCueDisplaySec ?? 0) - (this._lastUpdateDt ?? 0));
    const showEnemyCue = (this._enemyCueDisplaySec ?? 0) > 0 && enemyIntro;

    let stage, title, message, dataStage, dataAction;
    if (showEnemyCue) {
      stage = "New Threat";
      title = enemyIntro.label ?? guidance.title;
      message = enemyIntro.message ?? guidance.message;
      dataStage = "enemy_intro";
      dataAction = `learn_${enemyIntro.type}`;
    } else {
      stage = guidance.stage.replaceAll("_", " ");
      title = guidance.title;
      message = guidance.message;
      dataStage = guidance.stage;
      dataAction = guidance.action;
    }

    // Detect message change → show toast for 6s, then auto-dismiss
    const msgKey = `${dataStage}|${title}`;
    if (msgKey !== this._lastGuidanceMsgKey) {
      this._lastGuidanceMsgKey = msgKey;
      this._guidanceToastRemainSec = 6.0;
    }
    this._guidanceToastRemainSec = Math.max(0, (this._guidanceToastRemainSec ?? 0) - (this._lastUpdateDt ?? 0));

    const visible = (this._guidanceToastRemainSec ?? 0) > 0;
    this.guidancePanel.hidden = !visible;
    if (!visible) return;

    this.guidanceFields.stage.textContent = stage;
    this.guidanceFields.title.textContent = title;
    this.guidanceFields.message.textContent = message;
    this.guidancePanel.dataset.stage = dataStage;
    this.guidancePanel.dataset.action = dataAction;
  }

  // ── Juice layer ───────────────────────────────────────────────────────────
  // All effects are transient DOM/CSS or additive camera offsets.

  /** Show hitmarker with appropriate variant for 140-180ms */
  _showHitmarker(isKill, isHeadshot) {
    if (!this.hitmarkerEl) return;
    const el = this.hitmarkerEl;
    // Remove all classes first (to restart animation on rapid fire)
    el.classList.remove("is-hit", "is-kill", "is-headshot");
    // Force reflow to restart CSS animation
    void el.offsetWidth;
    if (isKill) {
      el.classList.add("is-kill");
    } else if (isHeadshot) {
      el.classList.add("is-headshot");
      el.classList.add("is-hit");
    } else {
      el.classList.add("is-hit");
    }
    // Clean up after animation
    clearTimeout(this._hitmarkerTimer);
    this._hitmarkerTimer = setTimeout(() => {
      el.classList.remove("is-hit", "is-kill", "is-headshot");
    }, isKill ? 200 : 160);
  }

  /** Float "+N coins" or "+KILL" text near centre and pop HUD value spans */
  _showKillFeedback(coinsDelta) {
    // Float text
    if (this.killFloaterEl) {
      const el = this.killFloaterEl;
      el.classList.remove("is-active");
      void el.offsetWidth;
      el.textContent = coinsDelta > 0 ? `+${coinsDelta}` : "+KILL";
      el.classList.add("is-active");
      clearTimeout(this._floaterTimer);
      this._floaterTimer = setTimeout(() => el.classList.remove("is-active"), 750);
    }
    // Pop coins value
    const coinsEl = this.fields?.coins;
    if (coinsEl) {
      const b = coinsEl.tagName === "B" ? coinsEl : coinsEl;
      b.classList.remove("is-popping");
      void b.offsetWidth;
      b.classList.add("is-popping");
      clearTimeout(this._coinsPopTimer);
      this._coinsPopTimer = setTimeout(() => b.classList.remove("is-popping"), 260);
    }
    // Pop kills value
    const killsEl = this.fields?.kills;
    if (killsEl) {
      killsEl.classList.remove("is-popping-kill");
      void killsEl.offsetWidth;
      killsEl.classList.add("is-popping-kill");
      clearTimeout(this._killsPopTimer);
      this._killsPopTimer = setTimeout(() => killsEl.classList.remove("is-popping-kill"), 260);
    }
  }

  /** Update kill streak indicator */
  _updateStreak(newKills) {
    if (newKills <= 0) return;
    const now = performance.now();
    if (now - this._streakLastKillTime > this._streakTimeoutMs) {
      this._streakCount = 0;
    }
    const prevCount = this._streakCount;
    this._streakCount += newKills;
    this._streakLastKillTime = now;

    // Cue 4: streak arpeggio — fire when crossing a milestone tier boundary
    const STREAK_MILESTONES = [3, 5, 7, 10];
    for (const milestone of STREAK_MILESTONES) {
      if (prevCount < milestone && this._streakCount >= milestone) {
        this._sfxStreak(milestone);
        break; // only fire the highest newly-crossed milestone per update
      }
    }

    if (this._streakCount < 3 || !this.streakBadgeEl) {
      // Show nothing below x3 — keeps it uncluttered
      if (this.streakBadgeEl) this.streakBadgeEl.classList.remove("is-active");
      return;
    }

    const label = this._streakCount >= 10 ? `x${this._streakCount} RAMPAGE`
                : this._streakCount >= 7  ? `x${this._streakCount} SLAYER`
                : this._streakCount >= 5  ? `x${this._streakCount} HOT STREAK`
                :                           `x${this._streakCount} COMBO`;

    this.streakBadgeEl.textContent = label;
    this.streakBadgeEl.classList.remove("is-new");
    void this.streakBadgeEl.offsetWidth;
    this.streakBadgeEl.classList.add("is-active", "is-new");

    // Auto-hide after 3s of no new kills
    clearTimeout(this._streakHideTimer);
    this._streakHideTimer = setTimeout(() => {
      if (this.streakBadgeEl) this.streakBadgeEl.classList.remove("is-active");
      this._streakCount = 0;
    }, this._streakTimeoutMs);
  }

  /** Update low-HP vignette — pulsing red edge when playerHp < 30% */
  _updateVignette(playerHp) {
    if (!this.hpVignette) return;
    const critical = playerHp < 30;
    if (critical !== this._vignetteActive) {
      this._vignetteActive = critical;
      this.hpVignette.classList.toggle("is-critical", critical);
    }
    if (critical) {
      // Pulse rate and amplitude scale with how low HP is: lower = faster/brighter
      const severity = Math.max(0, Math.min(1, 1 - playerHp / 30));
      const rate = (2 - severity * 0.9).toFixed(2) + "s";
      const lo = (0.35 + severity * 0.25).toFixed(2);
      const hi = (0.72 + severity * 0.22).toFixed(2);
      this.hpVignette.style.setProperty("--zi-vignette-rate", rate);
      this.hpVignette.style.setProperty("--zi-vignette-lo", lo);
      this.hpVignette.style.setProperty("--zi-vignette-hi", hi);
    }
  }

  /** Apply trauma-based screen shake — additive to camera pitch/yaw.
   *  trauma decays by 2.2/s. Returns [pitchOff, yawOff] in degrees. */
  _computeShakeOffset() {
    if (this._shakeTrauma <= 0.001) return [0, 0];
    const reduceFactor = this._reducedMotion ? 0.5 : 1.0;
    const t2 = this._shakeTrauma * this._shakeTrauma * reduceFactor;
    const MAX_ANGLE = 1.8; // degrees max at full trauma
    // Use counter to vary offset each frame without Math.random (deterministic feel)
    const c = this._shakeCounter;
    const px = Math.sin(c * 1.37) * Math.cos(c * 0.83);
    const py = Math.cos(c * 1.11) * Math.sin(c * 0.61);
    return [px * t2 * MAX_ANGLE, py * t2 * MAX_ANGLE];
  }

  _decayShake(dt) {
    this._shakeTrauma = Math.max(0, this._shakeTrauma - dt * 2.2);
    this._shakeCounter += 1;
  }

  _addShakeTrauma(amount) {
    this._shakeTrauma = Math.min(1, this._shakeTrauma + amount);
  }

  // ── Procedural SFX cues ───────────────────────────────────────────────────
  // All cues: early-return when sfxEnabled=false AND when AudioContext is not
  // yet unlocked (ctx===null) to ensure zero-throw behaviour before first click.

  /** Cue 1: Hit confirm — crisp high tick on flesh hit (non-kill) */
  _sfxHitConfirm() {
    if (this.state.sfxEnabled === false) return;
    this._sfxCallCounts.hitConfirm++;
    if (!this.audio.ctx) return;
    // Short high-pitched triangle blip — distinct from the flesh impact boom
    this.audio.playTone({ freq: 1850, freqEnd: 1380, duration: 0.04, gain: 0.024, gainEnd: 0.0001, type: "triangle", attack: 0.001, channel: "sfx" });
  }

  /** Cue 2: Kill — satisfying pitch-drop thud */
  _sfxKill() {
    if (this.state.sfxEnabled === false) return;
    this._sfxCallCounts.kill++;
    if (!this.audio.ctx) return;
    // Low descending thud
    this.audio.playTone({ freq: 320, freqEnd: 88, duration: 0.14, gain: 0.045, gainEnd: 0.0002, type: "triangle", attack: 0.003, channel: "sfx" });
    // Sub punch layer
    this.audio.playTone({ freq: 110, freqEnd: 55, duration: 0.11, gain: 0.022, gainEnd: 0.0002, type: "sine", attack: 0.002, channel: "sfx" });
  }

  /** Cue 3: Headshot ding — bright overtone layered on kill */
  _sfxHeadshot() {
    if (this.state.sfxEnabled === false) return;
    this._sfxCallCounts.headshot++;
    if (!this.audio.ctx) return;
    // Bright sine chime, decays fast
    this.audio.playTone({ freq: 1320, freqEnd: 1100, duration: 0.18, gain: 0.022, gainEnd: 0.0002, type: "sine", attack: 0.002, channel: "sfx" });
    this.audio.playTone({ freq: 2200, freqEnd: 1760, duration: 0.09, gain: 0.008, gainEnd: 0.0001, type: "triangle", attack: 0.001, channel: "sfx" });
  }

  /** Cue 4: Kill streak arpeggio — escalates with tier (x3/x5/x7/x10) */
  _sfxStreak(count) {
    if (this.state.sfxEnabled === false) return;
    if (count < 3) return;
    this._sfxCallCounts.streak++;
    if (!this.audio.ctx) return;
    // Each tier: higher root, brighter chord
    const tier = count >= 10 ? 3 : count >= 7 ? 2 : count >= 5 ? 1 : 0;
    const roots = [220, 277.18, 329.63, 415.30];
    const root = roots[tier];
    const arpeggioNotes = [
      root,
      root * 1.2599, // minor third ≈ ×2^(3/12)
      root * 1.4983, // perfect fifth ≈ ×2^(7/12)
      root * 1.7818, // minor seventh ≈ ×2^(10/12)
    ];
    const delayMs = [0, 55, 110, 165];
    for (let i = 0; i <= tier + 1 && i < arpeggioNotes.length; i++) {
      const noteFreq = arpeggioNotes[i];
      const delay = delayMs[i];
      if (delay === 0) {
        this.audio.playTone({ freq: noteFreq, freqEnd: noteFreq * 0.97, duration: 0.22, gain: 0.018, gainEnd: 0.0002, type: "triangle", attack: 0.005, channel: "sfx" });
      } else {
        setTimeout(() => {
          if (this.state.sfxEnabled === false || !this.audio.ctx) return;
          this.audio.playTone({ freq: noteFreq, freqEnd: noteFreq * 0.97, duration: 0.22, gain: 0.018, gainEnd: 0.0002, type: "triangle", attack: 0.005, channel: "sfx" });
        }, delay);
      }
    }
  }

  /** Cue 5a: Reload start — mechanical click-clack */
  _sfxReloadStart() {
    if (this.state.sfxEnabled === false) return;
    this._sfxCallCounts.reloadStart++;
    if (!this.audio.ctx) return;
    // Noisy low-mid click
    this.audio.playTone({ freq: 180, freqEnd: 120, duration: 0.038, gain: 0.032, gainEnd: 0.0002, type: "sawtooth", attack: 0.001, channel: "sfx" });
    this.audio.playTone({ freq: 340, freqEnd: 200, duration: 0.022, gain: 0.014, gainEnd: 0.0001, type: "square", attack: 0.001, channel: "sfx" });
  }

  /** Cue 5b: Reload finish — satisfying seating click */
  _sfxReloadFinish() {
    if (this.state.sfxEnabled === false) return;
    this._sfxCallCounts.reloadFinish++;
    if (!this.audio.ctx) return;
    // Crisper, slightly higher than start
    this.audio.playTone({ freq: 260, freqEnd: 160, duration: 0.032, gain: 0.036, gainEnd: 0.0002, type: "sawtooth", attack: 0.001, channel: "sfx" });
    this.audio.playTone({ freq: 520, freqEnd: 280, duration: 0.018, gain: 0.012, gainEnd: 0.0001, type: "square", attack: 0.001, channel: "sfx" });
  }

  /** Cue 5c: Empty-mag click — dry single tick */
  _sfxEmpty() {
    if (this.state.sfxEnabled === false) return;
    this._sfxCallCounts.empty++;
    if (!this.audio.ctx) return;
    this.audio.playTone({ freq: 280, freqEnd: 220, duration: 0.018, gain: 0.024, gainEnd: 0.0001, type: "square", attack: 0.001, channel: "sfx" });
  }

  /** Cue 6: Coin pickup ching — light bright ring */
  _sfxCoin() {
    if (this.state.sfxEnabled === false) return;
    this._sfxCallCounts.coin++;
    if (!this.audio.ctx) return;
    this.audio.playTone({ freq: 1560, freqEnd: 1040, duration: 0.12, gain: 0.014, gainEnd: 0.0001, type: "sine", attack: 0.002, channel: "sfx" });
    this.audio.playTone({ freq: 2080, freqEnd: 1560, duration: 0.07, gain: 0.007, gainEnd: 0.0001, type: "sine", attack: 0.001, channel: "sfx" });
  }

  /** Cue 7: Player damage — low thud/grunt on bite */
  _sfxPlayerDamage() {
    if (this.state.sfxEnabled === false) return;
    this._sfxCallCounts.playerDamage++;
    if (!this.audio.ctx) return;
    // Body-hit thud
    this.audio.playTone({ freq: 88, freqEnd: 52, duration: 0.14, gain: 0.055, gainEnd: 0.0002, type: "triangle", attack: 0.003, channel: "sfx" });
    // High distress overtone
    this.audio.playTone({ freq: 420, freqEnd: 180, duration: 0.08, gain: 0.018, gainEnd: 0.0001, type: "sawtooth", attack: 0.002, channel: "sfx" });
  }

  /** Cue 8: Low-health heartbeat — two soft low thumps; called from update loop.
   *  dt: frame delta in seconds */
  _sfxHeartbeatTick(dt) {
    if (this.state.sfxEnabled === false) return;
    // Heartbeat period scales with HP severity: lower HP = faster beat
    const severity = Math.max(0, Math.min(1, 1 - this.state.playerHp / 25));
    const period = 1.8 - severity * 0.9; // 1.8s at 25%HP, 0.9s at 0%HP
    this._heartbeatPhaseSec = (this._heartbeatPhaseSec ?? 0) + dt;
    if (this._heartbeatPhaseSec >= period) {
      this._heartbeatPhaseSec = 0;
      this._sfxCallCounts.heartbeat++;
      if (!this.audio.ctx) return;
      // First thump
      this.audio.playTone({ freq: 62, freqEnd: 44, duration: 0.12, gain: 0.038, gainEnd: 0.0002, type: "sine", attack: 0.004, channel: "sfx" });
      // Second thump (70ms later)
      setTimeout(() => {
        if (this.state.sfxEnabled === false || !this.audio.ctx) return;
        this.audio.playTone({ freq: 54, freqEnd: 40, duration: 0.10, gain: 0.028, gainEnd: 0.0002, type: "sine", attack: 0.003, channel: "sfx" });
      }, 70);
    }
  }

  /** Cue 9: UI click — soft subtle click for primary button presses */
  _sfxUiClick() {
    if (this.state.sfxEnabled === false) return;
    this._sfxCallCounts.uiClick++;
    if (!this.audio.ctx) return;
    this.audio.playTone({ freq: 620, freqEnd: 440, duration: 0.022, gain: 0.012, gainEnd: 0.0001, type: "triangle", attack: 0.001, channel: "sfx" });
  }

  /** Cue 9b: UI shop-buy confirm — slightly richer */
  _sfxShopBuy() {
    if (this.state.sfxEnabled === false) return;
    this._sfxCallCounts.uiClick++;
    if (!this.audio.ctx) return;
    this.audio.playTone({ freq: 880, freqEnd: 660, duration: 0.06, gain: 0.014, gainEnd: 0.0001, type: "triangle", attack: 0.003, channel: "sfx" });
    this.audio.playTone({ freq: 1320, freqEnd: 880, duration: 0.04, gain: 0.007, gainEnd: 0.0001, type: "sine", attack: 0.002, channel: "sfx" });
  }

  /** Cue 10: Ambient night bed — slow evolving low pad on "music" channel.
   *  Uses setInterval so it never clashes with the raid music timers list.
   *  Gain kept very low (0.003) to stay under raid music layers. */
  _startNightBed() {
    if (this._nightBedRunning) return;
    if (!this.state.musicEnabled) return;
    this._nightBedRunning = true;
    this._nightBedPhase = 0;
    this._sfxCallCounts.nightBedStart++;
    // Three evolving chord voicings that rotate slowly (~4s each)
    const BED_ROOTS = [82, 92.5, 87];   // low A / B-flat / A# area
    const BED_OFFSETS = [[0, 7, 12], [0, 5, 10], [2, 7, 14]];
    const _playBed = () => {
      if (!this._nightBedRunning || !this.state.musicEnabled) return;
      if (!this.audio.ctx) return;
      const phase = this._nightBedPhase % BED_ROOTS.length;
      const root = BED_ROOTS[phase];
      const offsets = BED_OFFSETS[phase];
      const notes = offsets.map((s) => root * Math.pow(2, s / 12));
      this.audio.playChord({ notes, duration: 4.2, gain: 0.005, gainEnd: 0.0003, type: "sine", attack: 0.35, channel: "music" });
      this._nightBedPhase++;
    };
    _playBed();
    this._nightBedTimerId = setInterval(_playBed, 3800);
  }

  _stopNightBed() {
    if (!this._nightBedRunning) return;
    this._nightBedRunning = false;
    if (this._nightBedTimerId !== null) {
      clearInterval(this._nightBedTimerId);
      this._nightBedTimerId = null;
    }
  }

  exposeAutomationHooks() {
    window.__playCanvasZombieSlice = this;
    window.__playCanvasZombieGame = this;
    window.advanceTime = (ms) => {
      const steps = Math.max(1, Math.round(ms / (1000 / 60)));
      for (let i = 0; i < steps; i += 1) {
        this.update(1 / 60);
      }
    };
    window.render_playcanvas_slice_to_text = () => {
      const live = this.state.zombies.filter((zombie) => !zombie.dead).length;
      const miniMap = getPlayCanvasMiniMapSnapshot(this.state);
      const buildings = getPlayCanvasBuildingSnapshot(this.state);
      const villagers = getPlayCanvasVillagerSnapshot(this.state);
      const boss = getPlayCanvasBossSnapshot(this.state);
      const impact = getPlayCanvasImpactSnapshot(this.state);
      const weaponState = getPlayCanvasWeaponSnapshot(this.state);
      const guidance = getPlayCanvasGuidanceSnapshot(this.state);
      const audio = getPlayCanvasAudioSnapshot(this.state, {
        shopOpen: this.shopOpen,
        villageDamageRecent: this.audioDamagePulseSec > 0 ? 1 : 0,
        playerDamageRecent: this.audioPlayerDamagePulseSec > 0 ? 1 : 0,
      });
      const escort = villagers.find((villager) => villager.state === "escorting");
      const perks = this.state.villagerPerkModifiers ?? {};
      return [
        `mode=playcanvas-game`,
        `style=cinematic-low-poly-survival`,
        `composition=target-village-street`,
        `mood=tense-not-too-scary`,
        `phase=${this.state.phase}`,
        `saveVersion=${this.state.version ?? 1}`,
        `profileType=${this.state.profileType ?? "playcanvas"}`,
        `wave=${this.state.waveNumber}`,
        `villageHp=${Math.ceil(this.state.villageHp)}`,
        `maxVillageHp=${this.state.maxVillageHp}`,
        `playerHp=${Math.ceil(this.state.playerHp)}`,
        `ammo=${this.state.ammo}`,
        `ammoMode=infinite`,
        `ordnance=${this.state.activeOrdnanceId}`,
        `ordnanceCount=${ordnanceCount(this.state)}`,
        `weapon=${this.state.equippedWeaponId}`,
        `weaponFamily=${weaponState.family}`,
        `weaponViewModel=${weaponState.viewModel}`,
        `weaponReticle=${weaponState.reticle}`,
        `weaponMuzzleFx=${weaponState.muzzleFx}`,
        `weaponShotFx=${weaponState.shotFx}`,
        `weaponSilhouette=${weaponState.silhouette}`,
        `weaponSpreadMoa=${weaponState.spreadMoa}`,
        `musicEnabled=${audio.musicEnabled}`,
        `sfxEnabled=${audio.sfxEnabled}`,
        `musicMode=${audio.mode}`,
        `musicCue=${audio.cueId}`,
        `musicThreat=${audio.threatScore}`,
        `audioUnlocked=${this.audio.audioUnlocked}`,
        `pendingMusicCue=${this.audio.pendingMusicCueId || "none"}`,
        `tutorialStage=${guidance.stage}`,
        `tutorialAction=${guidance.action}`,
        `tutorialTitle=${guidance.title}`,
        `tutorialMessage=${guidance.message}`,
        `tutorialRecommendation=${guidance.recommendation ? `${guidance.recommendation.targetType}:${guidance.recommendation.targetId}` : "none"}`,
        `tutorialNextThreat=${guidance.nextThreat ? `${guidance.nextThreat.wave}:${guidance.nextThreat.type}` : "none"}`,
        `tutorialEnemyIntro=${guidance.enemyIntro ? guidance.enemyIntro.type : "none"}`,
        `tutorialMotivation=${guidance.motivation ?? "none"}`,
        `combatEvent=${this.state.lastCombatEvent ? JSON.stringify(this.state.lastCombatEvent) : "none"}`,
        `bossWaveActive=${boss.bossWaveActive}`,
        `secretBossActive=${boss.secretBossActive}`,
        `secretBossSpawned=${boss.secretBossSpawned}`,
        `liveBosses=${boss.liveBosses.map((entry) => entry.type).join(",") || "none"}`,
        `landscapeZombified=${boss.landscapeZombified}`,
        `lastMutation=${boss.lastMutationEvent ? `${boss.lastMutationEvent.wave}:${boss.lastMutationEvent.count}` : "none"}`,
        `brokenWindows=${impact.brokenWindows}`,
        `activeImpactFx=${impact.activeImpactFx}`,
        `lastImpact=${impact.lastImpactEvent ? `${impact.lastImpactEvent.materialId}:${impact.lastImpactEvent.windowShattered ? "shattered" : "hit"}` : "none"}`,
        `structureHits=${impact.structureHits}`,
        `potentialVillageDamage=${impact.potentialVillageDamage}`,
        `appliedVillageDamage=${impact.appliedVillageDamage}`,
        `armor=${this.state.equippedArmorId}`,
        `gear=${this.state.ownedGear.join(",") || "none"}`,
        `flashlight=${this.state.ownedGear.includes("flashlight")}`,
        `firePatches=${this.state.firePatches.length}`,
        `flintCooldown=${Math.ceil(this.state.flintCooldownSec)}`,
        `miniMap=${this.minimapPanel?.hidden ? "hidden" : "visible"}`,
        `miniMapZombies=${miniMap.liveZombies.length}`,
        `miniMapStructures=${this.minimapStructures.length}`,
        `miniMapFires=${miniMap.activeFirePatches.length}`,
        `inside=${this.state.activeBuildingId ?? "outside"}`,
        `openedBuildings=${buildings.openedCount}`,
        `rescuedVillagers=${this.state.rescuedVillagers.length}`,
        `deadVillagers=${this.state.deadVillagers.length}`,
        `activeEscort=${escort?.id ?? "none"}`,
        `escortHp=${escort?.hp ?? "none"}`,
        `escortMaxHp=${escort?.maxHp ?? "none"}`,
        `escortHealthBar=${escort?.healthBarVisible ? "visible" : "hidden"}`,
        `escortDropoff=${miniMap.escortDropoff ? `${miniMap.escortDropoff.x},${miniMap.escortDropoff.z},${miniMap.escortDropoff.radius}` : "none"}`,
        `availableVillagers=${villagers.filter((villager) => villager.state === "idle").length}`,
        `perkStartGrenades=${perks.startingGrenadesBonus ?? 0}`,
        `perkKillCoins=${Number(perks.killCoinMultiplier ?? 1).toFixed(2)}`,
        `perkShopCost=${Number(perks.shopCostMultiplier ?? 1).toFixed(2)}`,
        `perkVillageHp=${Number(perks.villageHpMultiplier ?? 1).toFixed(2)}`,
        `perkDamageReduction=${Number(perks.damageReductionBonus ?? 0).toFixed(2)}`,
        `perkGrenadeCooldown=${Number(perks.grenadeCooldownMultiplier ?? 1).toFixed(2)}`,
        `villageLevel=${this.state.villageLevel}`,
        `bestWave=${this.state.bestWave}`,
        `flowPanel=${this.flowPanel.hidden ? "hidden" : this.state.phase}`,
        `shopOpen=${this.shopOpen}`,
        `coins=${this.state.coins}`,
        `kills=${this.state.kills}`,
        `lifetimeKills=${this.state.lifetimeStats?.kills ?? 0}`,
        `lifetimeDamageDealt=${this.state.lifetimeStats?.damageDealt ?? 0}`,
        `lifetimeDamageTaken=${this.state.lifetimeStats?.damageTaken ?? 0}`,
        `lifetimeVillageDamageTaken=${this.state.lifetimeStats?.villageDamageTaken ?? 0}`,
        `lifetimeWavesCleared=${this.state.lifetimeStats?.wavesCleared ?? 0}`,
        `lifetimePlaySeconds=${Number(this.state.lifetimeStats?.playSeconds ?? 0).toFixed(1)}`,
        `waveSummary=${this.state.waveSummary ? `${this.state.waveSummary.wave}:${this.state.waveSummary.kills}` : "none"}`,
        `spawned=${this.state.spawnedThisWave}`,
        `liveZombies=${live}`,
        `message=${this.state.lastMessage}`,
      ].join("\\n");
    };
    window.render_playcanvas_game_to_text = window.render_playcanvas_slice_to_text;
    window.render_game_to_text = window.render_playcanvas_slice_to_text;
  }
}

function color(values) {
  return new pc.Color(values[0], values[1], values[2]);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function weaponLabel(id) {
  const labels = {
    pipe: "Pipe",
    pistol: "Pistol",
    revolver: "Revolver",
    machine_pistol: "Machine Pistol",
    smg: "SMG",
    rifle: "Rifle",
    battle_rifle: "Battle Rifle",
    shotgun: "Shotgun",
    lmg: "LMG",
    dmr: "DMR",
    sniper: "Sniper",
    rpg: "RPG",
    grenade_launcher: "Grenade Launcher",
    flamethrower: "Flamethrower",
  };
  return labels[id] ?? id;
}

function impactMaterialKey(materialId) {
  if (materialId === "glass") return "impactGlass";
  if (materialId === "concrete" || materialId === "steel") return "impactConcrete";
  if (materialId === "soil") return "impactSoil";
  return "impactWood";
}

function isRecommendedShopItem(item, recommendation) {
  if (!item || !recommendation) {
    return false;
  }
  if (recommendation.targetType === "grenade" && item.type === "grenade") {
    return item.id === recommendation.targetId;
  }
  return item.type === recommendation.targetType && item.id === recommendation.targetId;
}

function armorLabel(id) {
  const labels = {
    cloth: "Cloth",
    leather: "Leather",
    kevlar: "Kevlar",
    reinforced: "Plate",
    chainmail: "Mail",
    tactical: "Tactical",
    hazmat: "Hazmat",
    juggernaut: "Juggernaut",
  };
  return labels[id] ?? id;
}

function gearLabel(state) {
  const labels = {
    flashlight: "Light",
    flint_steel: "Flint",
  };
  const owned = state.ownedGear.map((id) => labels[id] ?? id);
  return owned.length ? owned.join("+") : "None";
}

function buildingShortLabel(buildingId) {
  const labels = {
    village_house_a: "House A",
    village_house_b: "House B",
    village_blacksmith: "Smith",
    village_townhall: "Hall",
    village_chapel: "Chapel",
    village_barn: "Barn",
  };
  return labels[buildingId] ?? "Inside";
}

function ordnanceLabel(state) {
  const labels = {
    frag: "Frag",
    breacher: "Breach",
    nova: "Nova",
    c4: "C4",
    nuke: "Nuke",
  };
  const label = labels[state.activeOrdnanceId] ?? state.activeOrdnanceId;
  return `${label} ${ordnanceCount(state)}`;
}

function ordnanceCount(state) {
  if (state.activeOrdnanceId === "c4") {
    return state.c4Count;
  }
  if (state.activeOrdnanceId === "nuke") {
    return state.nukeCount;
  }
  return state.grenadeInventory?.[state.activeOrdnanceId] ?? 0;
}

function isActivePlayPhase(phase) {
  return phase === "running" || phase === "secret_boss";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

export function createPlayCanvasGame(root = document.getElementById("app")) {
  if (!root) {
    throw new Error("Missing #app root for PlayCanvas game");
  }
  return new PlayCanvasZombieSlice(root);
}
