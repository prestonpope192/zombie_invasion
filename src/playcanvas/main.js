import * as pc from "playcanvas";
import { createZombieRig, animateZombieRig, applyZombieRigMaterials } from "./zombieRig";
import { loadZombieGlbContainer, createZombieGlbEntity, animateZombieGlbEntity } from "./zombieGlb";
import {
  loadVillagerGlbContainers,
  createVillagerGlbEntity,
  animateVillagerGlbEntity,
} from "./villagerGlb";
import {
  loadAnimalGlbContainers,
  createAnimalGlbEntity,
  animateAnimalGlbEntity,
} from "./animalGlb";
import buildingsConfig from "../fps/config/buildings_fps.json";
import qualityProfiles from "../fps/config/quality_profiles.json";
import { Audio3D } from "../fps/systems/audio3d";
import { renderMiniMap } from "./minimapRenderer";
import { SfxCues } from "./sfxCues";
import {
  VILLAGE_FENCE_SEGMENTS,
  VILLAGE_FENCE_X,
  VILLAGE_STRUCTURE_DEFS,
} from "./villageStructures";
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
  getPlayCanvasVillageStructureSnapshot,
  getPlayCanvasGuidanceSnapshot,
  getPlayCanvasTargetFov,
  getPlayCanvasAudioSnapshot,
  getPlayCanvasWeaponSnapshot,
  getPlayCanvasVillagerSnapshot,
  getPlayCanvasOrdnanceProjectiles,
  consumePlayCanvasOrdnanceDetonations,
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
  getPlayCanvasRewardedAdSnapshot,
  recordPlayCanvasRewardedAdEvent,
  getGoalsSnapshot,
} from "./sliceSimulation";
import { showRewardedAd } from "../fps/systems/rewardedAds";
import { SfxSampleManager } from "./sfxSamples";
import { computeBallisticTracerDrop } from "./shotFxRules";
import "./playcanvas.css";

const MINIMAP_SIZE_PX = 180;
const VIEWPORT_RESIZE_CONFIRM_MS = 120;
const VIEWPORT_RESIZE_SETTLE_MS = 220;
const DESKTOP_BACKBUFFER_PIXEL_BUDGET = 1_800_000;
const MOBILE_BACKBUFFER_PIXEL_BUDGET = 1_200_000;
const MIN_RENDER_PIXEL_RATIO = 0.8;

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
const NO_FOG_MATERIALS = new Set(["cloud", "cloudDark", "moon", "moonHalo"]);

const WEAPON_FIRE_PROFILES = {
    // ── Tier 0: melee ──────────────────────────────────────────────────────
    pipe: {
      kickback: 0.02, rise: 4,  roll: 8,   lateral: 0.03, duration: 0.10,
      recover: 14, flashSize: 0,   flashWide: 1.0, flashTtl: 1.0,
      shake: 0.02, camKick: 0.4, actionAmt: 0,    shells: false, smoke: false, smokeSz: 0,
    },
    // ── Tier 1: pistol ($50) ───────────────────────────────────────────────
    pistol: {
      kickback: 0.06, rise: 12,  roll: 2,   lateral: 0.01, duration: 0.13,
      recover: 10, flashSize: 0.18, flashWide: 1.2, flashTtl: 0.9,
      shake: 0.06, camKick: 1.0, actionAmt: 0.18, shells: true,  smoke: false, smokeSz: 0,
    },
    // ── Tier 2: revolver ($120) ────────────────────────────────────────────
    revolver: {
      kickback: 0.12, rise: 22,  roll: -4,  lateral: 0.02, duration: 0.18,
      recover: 7,  flashSize: 0.26, flashWide: 1.6, flashTtl: 1.1,
      shake: 0.10, camKick: 1.8, actionAmt: 0,    shells: false, smoke: true,  smokeSz: 0.10,
    },
    // ── Tier 3: smg ($220) ─────────────────────────────────────────────────
    smg: {
      kickback: 0.07, rise: 10,  roll: 3,   lateral: 0.03, duration: 0.08,
      recover: 12, flashSize: 0.16, flashWide: 1.0, flashTtl: 0.7,
      shake: 0.05, camKick: 0.8, actionAmt: 0.12, shells: true,  smoke: false, smokeSz: 0,
    },
    // ── Tier 4: machine_pistol ($300) ──────────────────────────────────────
    machine_pistol: {
      kickback: 0.06, rise: 9,   roll: 4,   lateral: 0.04, duration: 0.07,
      recover: 13, flashSize: 0.14, flashWide: 1.1, flashTtl: 0.6,
      shake: 0.04, camKick: 0.7, actionAmt: 0.10, shells: true,  smoke: false, smokeSz: 0,
    },
    // ── Tier 5: rifle ($420) ───────────────────────────────────────────────
    rifle: {
      kickback: 0.14, rise: 18,  roll: -3,  lateral: 0.02, duration: 0.16,
      recover: 8,  flashSize: 0.28, flashWide: 1.4, flashTtl: 1.0,
      shake: 0.12, camKick: 1.4, actionAmt: 0.14, shells: true,  smoke: true,  smokeSz: 0.12,
    },
    // ── Tier 6: battle_rifle ($560) ────────────────────────────────────────
    battle_rifle: {
      kickback: 0.20, rise: 26,  roll: -5,  lateral: 0.03, duration: 0.20,
      recover: 6,  flashSize: 0.34, flashWide: 1.6, flashTtl: 1.1,
      shake: 0.18, camKick: 2.0, actionAmt: 0.16, shells: true,  smoke: true,  smokeSz: 0.14,
    },
    // ── Tier 7: shotgun ($620) ─────────────────────────────────────────────
    shotgun: {
      kickback: 0.30, rise: 32,  roll: -8,  lateral: 0.04, duration: 0.26,
      recover: 4,  flashSize: 0.42, flashWide: 2.6, flashTtl: 1.3,
      shake: 0.26, camKick: 2.6, actionAmt: 0.32, shells: false, smoke: true,  smokeSz: 0.18,
    },
    // ── Tier 8: lmg ($760) ────────────────────────────────────────────────
    lmg: {
      kickback: 0.16, rise: 16,  roll: 2,   lateral: 0.05, duration: 0.14,
      recover: 7,  flashSize: 0.30, flashWide: 1.5, flashTtl: 1.0,
      shake: 0.14, camKick: 1.6, actionAmt: 0.14, shells: true,  smoke: true,  smokeSz: 0.13,
    },
    // ── Tier 9: dmr ($840) ────────────────────────────────────────────────
    dmr: {
      kickback: 0.24, rise: 30,  roll: -4,  lateral: 0.02, duration: 0.24,
      recover: 5,  flashSize: 0.38, flashWide: 1.8, flashTtl: 1.2,
      shake: 0.22, camKick: 2.4, actionAmt: 0.28, shells: true,  smoke: true,  smokeSz: 0.16,
    },
    // ── Tier 10: sniper ($980) ────────────────────────────────────────────
    sniper: {
      kickback: 0.38, rise: 44,  roll: -6,  lateral: 0.01, duration: 0.34,
      recover: 3,  flashSize: 0.44, flashWide: 1.4, flashTtl: 1.6,
      shake: 0.36, camKick: 3.4, actionAmt: 0.38, shells: true,  smoke: true,  smokeSz: 0.22,
    },
    // ── Tier 11: grenade_launcher ($940) ──────────────────────────────────
    grenade_launcher: {
      kickback: 0.32, rise: 36,  roll: 6,   lateral: 0.05, duration: 0.30,
      recover: 3,  flashSize: 0.48, flashWide: 2.8, flashTtl: 1.5,
      shake: 0.40, camKick: 2.8, actionAmt: 0,    shells: false, smoke: true,  smokeSz: 0.28,
    },
    // ── Tier 12: rpg ($1000) ──────────────────────────────────────────────
    rpg: {
      kickback: 0.44, rise: 40,  roll: 8,   lateral: 0.06, duration: 0.36,
      recover: 2,  flashSize: 0.55, flashWide: 3.0, flashTtl: 1.8,
      shake: 0.55, camKick: 3.8, actionAmt: 0,    shells: false, smoke: true,  smokeSz: 0.38,
    },
    // ── Tier 13: flamethrower ($1320) ─────────────────────────────────────
    flamethrower: {
      kickback: 0.04, rise: 3,   roll: 0,   lateral: 0.02, duration: 0.06,
      recover: 16, flashSize: 0.22, flashWide: 1.0, flashTtl: 0.9,
      shake: 0.03, camKick: 0.3, actionAmt: 0,    shells: false, smoke: false, smokeSz: 0,
    },
  };

const MATERIALS = {
  cloud: { diffuse: [0.16, 0.25, 0.38], emissive: [0.035, 0.065, 0.11], roughness: 0.96 },
  cloudDark: { diffuse: [0.075, 0.12, 0.19], emissive: [0.012, 0.025, 0.045], roughness: 0.98 },
  ground: { diffuse: [0.11, 0.145, 0.11], emissive: [0.008, 0.014, 0.011], roughness: 0.96 },
  grassDark: { diffuse: [0.045, 0.095, 0.075], emissive: [0.004, 0.01, 0.01], roughness: 0.98 },
  road: { diffuse: [0.21, 0.16, 0.12], emissive: [0.014, 0.011, 0.008], roughness: 0.86 },
  wetRoad: { diffuse: [0.09, 0.085, 0.078], emissive: [0.028, 0.04, 0.052], roughness: 0.32 },
  mudHighlight: { diffuse: [0.24, 0.16, 0.1], emissive: [0.028, 0.018, 0.01], roughness: 0.68 },
  pathEdge: { diffuse: [0.22, 0.2, 0.17], emissive: [0.012, 0.011, 0.008], roughness: 0.94 },
  wood: { diffuse: [0.4, 0.29, 0.18], emissive: [0.017, 0.011, 0.006], roughness: 0.9 },
  weatheredWood: { diffuse: [0.31, 0.24, 0.18], emissive: [0.012, 0.009, 0.006], roughness: 0.95 },
  timber: { diffuse: [0.16, 0.095, 0.052], emissive: [0.007, 0.004, 0.002], roughness: 0.92 },
  houseWall: { diffuse: [0.46, 0.43, 0.38], emissive: [0.014, 0.015, 0.015], roughness: 0.94 },
  plasterShadow: { diffuse: [0.34, 0.32, 0.29], emissive: [0.008, 0.008, 0.007], roughness: 0.96 },
  roof: { diffuse: [0.31, 0.105, 0.07], emissive: [0.008, 0.003, 0.002], roughness: 0.94 },
  roofDark: { diffuse: [0.19, 0.15, 0.15], emissive: [0.006, 0.005, 0.005], roughness: 0.94 },
  roofEdge: { diffuse: [0.095, 0.055, 0.04], emissive: [0.004, 0.002, 0.001], roughness: 0.96 },
  doorSafe: { diffuse: [0.72, 0.34, 0.12], emissive: [0.14, 0.06, 0.018], roughness: 0.65 },
  windowGlow: { diffuse: [1, 0.76, 0.45], emissive: [1.45, 0.62, 0.2], roughness: 0.38 },
  lantern: { diffuse: [1, 0.62, 0.28], emissive: [2.15, 0.88, 0.24], roughness: 0.35 },
  moon: { diffuse: [0.78, 0.9, 1], emissive: [0.95, 1.18, 1.55], roughness: 0.42 },
  moonHalo: { diffuse: [0.36, 0.52, 0.82], emissive: [0.08, 0.14, 0.28], roughness: 1, opacity: 0.08, blend: "additive" },
  zombie: { diffuse: [0.24, 0.19, 0.15], emissive: [0.01, 0.008, 0.006], roughness: 0.86 },
  runner: { diffuse: [0.28, 0.21, 0.16], emissive: [0.012, 0.009, 0.007], roughness: 0.82 },
  zombieHit: { diffuse: [0.72, 0.10, 0.12], emissive: [0.5, 0.06, 0.06], roughness: 0.7 },
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
  lanternPool: { diffuse: [0.56, 0.25, 0.08], emissive: [0.16, 0.055, 0.012], roughness: 1, opacity: 0.22, blend: "additive" },
  groundMist: { diffuse: [0.32, 0.44, 0.64], emissive: [0.06, 0.11, 0.20], roughness: 1, opacity: 0.16 },
  // Barrel/scope — neutral steel; low emissive avoids the old blue plastic read.
  metal: { diffuse: [0.34, 0.34, 0.32], emissive: [0.075, 0.08, 0.085], emissiveIntensity: 0.7, roughness: 0.28, metalness: 0.78 },
  blackMetal: { diffuse: [0.105, 0.11, 0.115], emissive: [0.05, 0.055, 0.06], emissiveIntensity: 0.72, roughness: 0.42, metalness: 0.82 },
  rail: { diffuse: [0.25, 0.245, 0.23], emissive: [0.075, 0.078, 0.08], emissiveIntensity: 0.7, roughness: 0.36, metalness: 0.78 },
  gunmetalLight: { diffuse: [0.46, 0.45, 0.4], emissive: [0.09, 0.092, 0.085], emissiveIntensity: 0.55, roughness: 0.24, metalness: 0.86 },
  gunBlackVoid: { diffuse: [0.005, 0.005, 0.004], emissive: [0, 0, 0], roughness: 0.7, metalness: 0.4 },
  gripRubber: { diffuse: [0.035, 0.04, 0.034], emissive: [0.008, 0.01, 0.008], roughness: 0.92, metalness: 0.05 },
  // Hand/arm materials — warm dark leather + olive drab sleeve
  glove: { diffuse: [0.16, 0.13, 0.10], emissive: [0.07, 0.05, 0.04], emissiveIntensity: 0.9, roughness: 0.88 },
  sleeve: { diffuse: [0.22, 0.24, 0.17], emissive: [0.08, 0.09, 0.06], emissiveIntensity: 0.8, roughness: 0.93 },
  muzzle: { diffuse: [1, 0.88, 0.44], emissive: [2.2, 1.4, 0.25], roughness: 0.18 },
  blastFire: { diffuse: [1, 0.55, 0.16], emissive: [3.2, 1.5, 0.35], roughness: 1, opacity: 0.9, blend: "additive" },
  blastSmoke: { diffuse: [0.18, 0.16, 0.15], emissive: [0.05, 0.04, 0.035], roughness: 1, opacity: 0.55 },
  structureSmoke: { diffuse: [0.32, 0.29, 0.27], emissive: [0.09, 0.055, 0.025], roughness: 1, opacity: 0.68 },
  structureAlert: { diffuse: [0.92, 0.34, 0.08], emissive: [1.4, 0.32, 0.04], roughness: 0.8, opacity: 0.72 },
  structureCritical: { diffuse: [0.72, 0.055, 0.035], emissive: [1.8, 0.08, 0.025], roughness: 0.82, opacity: 0.78 },
  rubbleDark: { diffuse: [0.11, 0.09, 0.075], emissive: [0.025, 0.012, 0.006], roughness: 0.98 },
  bloodDecal: { diffuse: [0.26, 0.028, 0.03], emissive: [0.02, 0.002, 0.002], roughness: 0.55, opacity: 0.8 },
  scorchDecal: { diffuse: [0.05, 0.045, 0.04], emissive: [0.008, 0.006, 0.005], roughness: 1, opacity: 0.72 },
  // Muzzle smoke puff — grey translucent, expands and fades on shot
  smokeGrey: { diffuse: [0.22, 0.22, 0.24], emissive: [0.06, 0.06, 0.07], roughness: 1, opacity: 0.38 },
  blastRing: { diffuse: [1, 0.78, 0.4], emissive: [2.6, 1.7, 0.6], roughness: 1, opacity: 0.8, blend: "additive" },
  blastEmber: { diffuse: [1, 0.7, 0.25], emissive: [3.0, 1.6, 0.4], roughness: 1, opacity: 1, blend: "additive" },
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
    this.samples = new SfxSampleManager();
    this.sfxCues = new SfxCues({ audio: this.audio, samples: this.samples, isSfxEnabled: () => this.state.sfxEnabled });
    this.samples.setMuted(this.state.sfxEnabled === false);
    // Zombie ambient groan throttle — emit at most one groan per 4s
    this._zombieGroanCooldownSec = 0;
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
      fire: false,
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
    this.villageStructureVisuals = new Map();
    this.ordnanceEntitiesById = new Map();
    this.fx = [];
    // ?fxslow=1 — stretches shot-FX lifetimes 10x for screenshot capture; always off in prod
    this.fxSlowMo = new URLSearchParams(globalThis.location?.search ?? "").get("fxslow") === "1";
    this.performanceTelemetry = {
      frameCount: 0,
      frameMsAvg: 0,
      fpsAvg: 0,
      slowFrames: 0,
      worstFrameMs: 0,
      lastFrameMs: 0,
    };
    // Pooled shot-FX subsystem — no per-shot heap allocations after warmup
    this.shotFx = { flashes: [], tracers: [], bursts: [] };
    this.sceneRandom = createSeededRandom(20260603);
    this.yaw = 0;
    this.pitch = -6;
    this.shopOpen = false;
    this.minimapOpen = true;
    this.lastRenderedPhase = null;
    this.minimapStructures = [];
    this.viewportMetrics = this.getViewportMetrics();
    this._viewportResizeRaf = 0;
    this._viewportResizeConfirmTimer = 0;
    this._viewportResizeSettledTimer = 0;
    this._viewportResizeObserver = null;
    this._lastViewportFrameKey = "";

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

    // Animal GLB containers — loaded once; each animal type independently null-able.
    // createAnimalGlbEntity returns null if a specific animal isn't loaded;
    // createZombieEntity falls back to zombie GLB / procedural rig gracefully.
    /** @type {{cow: pc.Asset|null, pig: pc.Asset|null, horse: pc.Asset|null, chicken: pc.Asset|null}|null} */
    this.animalGlbContainers = null;
    this.animalGlbLoadStarted = false;

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
    this.sfxCues.resetHeartbeat();
    this._heartbeatActive = false;
    // Reload state tracking (to detect start / finish transitions)
    this._wasReloading = false;
    // Ambient night bed
    this._nightBedTimerId = null;
    this._nightBedPhase = 0;   // index into evolving pad sequence
    this._nightBedRunning = false;

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
          console.debug("[PlayCanvas] GLB zombie container ready.");
        } else {
          console.warn("[PlayCanvas] GLB container load failed — falling back to procedural rig.");
        }
      });

      // Villager GLB load — primitive fallback until containers resolve
      loadVillagerGlbContainers(this.app).then((containers) => {
        const anyLoaded = containers.man || containers.woman;
        if (anyLoaded) {
          this.villagerGlbContainers = containers;
          console.debug("[PlayCanvas] Villager GLB containers ready (man:", !!containers.man, "woman:", !!containers.woman, ").");
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
        <canvas class="pc-slice-canvas" aria-label="Zombie Invasion 3D view"></canvas>
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
            <div class="zi-structure-alert" data-structure-alert hidden role="status" aria-live="assertive">
              <span class="zi-structure-alert-icon" aria-hidden="true">!</span>
              <span><small>UNDER ATTACK</small><b data-structure-alert-label>Village</b></span>
              <strong data-structure-alert-health>100%</strong>
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
              <div class="zi-bar-track zi-bar-health" role="progressbar" aria-label="Health" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100">
                <i class="zi-bar-fill" data-bar="health"></i>
              </div>
              <b data-field="player">100</b>
            </div>
            <div class="zi-vital-row zi-vital-stamina">
              <span class="zi-glyph" aria-hidden="true">⚡</span>
              <div class="zi-bar-track zi-bar-stamina" role="progressbar" aria-label="Stamina" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100">
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
            <strong data-field="message">Press Start</strong>
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
          <span class="pc-grace-label">Zombies incoming</span>
          <span class="pc-grace-count"><b data-grace-countdown>5</b><i>s</i></span>
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
          <p data-flow-field="body">Survive the 12-wave village defense.</p>
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
            <p><strong>Desktop:</strong> WASD move · Shift sprint · Ctrl crouch · Space jump (double-jump mid-air) · Left click / E fire · R reload · G grenade · T flint · V or right-click ADS · O cycle weapon · Q shop</p>
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
            <div class="pc-shop-head-text">
              <span data-shop-guide-title>Field Shop</span>
              <strong data-shop-guide-body>Upgrade whenever you have coins</strong>
            </div>
            <button type="button" class="pc-shop-close" data-action="shop-close" aria-label="Close shop">Close</button>
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
                <span>Sound Effects</span>
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
        <!-- First-run onboarding overlay — shown only on first visit (zi_onboarded flag).
             pointer-events: none on the backdrop so [data-flow-action="primary"] stays
             clickable even when the overlay is visible. Only the "Got it" button has
             pointer-events so the smoke's click on primary still works. -->
        <div class="zi-onboarding" id="zi-onboarding" role="dialog" aria-modal="true" aria-label="How to Survive" hidden>
          <div class="zi-onboarding-card">
            <div class="zi-onboarding-eyebrow">New Survivor</div>
            <h2 class="zi-onboarding-title">How to Survive</h2>
            <!-- Desktop control list — hidden on touch devices via CSS -->
            <ul class="zi-onboarding-list zi-onboarding-desktop">
              <li><span class="zi-onboarding-key">WASD</span><span class="zi-onboarding-desc">Move</span></li>
              <li><span class="zi-onboarding-key">Mouse</span><span class="zi-onboarding-desc">Look</span></li>
              <li><span class="zi-onboarding-key">Click / E</span><span class="zi-onboarding-desc">Fire</span></li>
              <li><span class="zi-onboarding-key">G</span><span class="zi-onboarding-desc">Grenade</span></li>
              <li><span class="zi-onboarding-key">Q</span><span class="zi-onboarding-desc">Shop</span></li>
            </ul>
            <!-- Mobile control list — hidden on non-touch devices via CSS -->
            <ul class="zi-onboarding-list zi-onboarding-mobile">
              <li><span class="zi-onboarding-key">Left pad</span><span class="zi-onboarding-desc">Move</span></li>
              <li><span class="zi-onboarding-key">Right drag</span><span class="zi-onboarding-desc">Look</span></li>
              <li><span class="zi-onboarding-key">FIRE</span><span class="zi-onboarding-desc">Fire weapon</span></li>
              <li><span class="zi-onboarding-key">BLAST</span><span class="zi-onboarding-desc">Grenade</span></li>
              <li><span class="zi-onboarding-key">SHOP</span><span class="zi-onboarding-desc">Buy upgrades</span></li>
            </ul>
            <p class="zi-onboarding-hint">Defend the village through 12 waves. Spend coins between waves.</p>
            <button type="button" class="zi-onboarding-btn" data-action="onboarding-dismiss">GOT IT — PLAY</button>
          </div>
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
    this.structureAlert = this.root.querySelector("[data-structure-alert]");
    this.structureAlertLabel = this.root.querySelector("[data-structure-alert-label]");
    this.structureAlertHealth = this.root.querySelector("[data-structure-alert-health]");
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
      stamina: this.root.querySelector('[data-field="stamina"]'),
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
    this.reloadField = this.reloadBarWrapper?.querySelector('[data-field="reload"]') ?? null;
    // Cached action buttons — avoids per-frame querySelector in updateHud
    this.actionButtons = {
      start:   this.root.querySelector('[data-action="start"]'),
      shop:    this.root.querySelector('[data-action="shop"]'),
      ordnance: this.root.querySelector('[data-action="ordnance"]'),
      music:   this.root.querySelector('[data-action="music"]'),
      sfx:     this.root.querySelector('[data-action="sfx"]'),
      haptics: this.root.querySelector('[data-action="haptics"]'),
      fullscreen: this.root.querySelector('[data-action="fullscreen"]'),
    };
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
    // First-run onboarding overlay
    this.onboardingOverlay = this.root.querySelector('#zi-onboarding');
    this._shopNudgeFired = false;
    // Show only on first visit; zi_onboarded flag tracks dismissal
    const alreadyOnboarded = typeof localStorage !== 'undefined' && localStorage.getItem('zi_onboarded') === '1';
    if (!alreadyOnboarded && this.onboardingOverlay) {
      this.onboardingOverlay.hidden = false;
      // Suppress the campaign modal behind the onboarding card so its text
      // doesn't bleed through (renderFlowPanel checks this flag).
      this._onboardingVisible = true;
      // Trap focus inside the onboarding card; Escape also dismisses.
      const card = this.onboardingOverlay.querySelector('.zi-onboarding-card');
      this._trapFocus(card ?? this.onboardingOverlay, {
        onEscape: () => this._dismissOnboarding(),
      });
      // Auto-dismiss on ANY first pointerdown (capture phase, before click fires).
      // This lets the smoke's click on [data-flow-action="primary"] still work:
      // pointerdown removes the overlay → click reaches the button underneath.
      const _onFirstPointerDown = (event) => {
        // Let the onboarding button complete its own pointerdown/click pair.
        // Dismissing during pointerdown hides the target before the browser can
        // dispatch click, which makes a real tap/click appear unresponsive.
        if (event.target?.closest?.('[data-action="onboarding-dismiss"]')) {
          return;
        }
        this._dismissOnboarding();
        document.removeEventListener('pointerdown', _onFirstPointerDown, true);
      };
      document.addEventListener('pointerdown', _onFirstPointerDown, true);
    }
  }

  detectQualityProfile() {
    const viewportWidth = Math.round(window.visualViewport?.width ?? window.innerWidth);
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || (viewportWidth < 768 && "ontouchstart" in window);
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

    const renderParams = new URLSearchParams(globalThis.location?.search ?? "");
    const preserveDrawingBuffer = renderParams.get("preserveDrawingBuffer") === "1" || navigator.webdriver === true;

    this.app = new pc.Application(this.canvas, {
      mouse: new pc.Mouse(this.canvas),
      keyboard: new pc.Keyboard(window),
      graphicsDeviceOptions: {
        antialias: true,
        powerPreference: "high-performance",
        preserveDrawingBuffer,
      },
    });
    this.app.setCanvasFillMode(pc.FILLMODE_NONE);
    this.app.setCanvasResolution(pc.RESOLUTION_AUTO);
    this.app.graphicsDevice.maxPixelRatio = this.getRenderPixelRatio(this.viewportMetrics.width, this.viewportMetrics.height);
    this.app.scene.exposure = 1.48;
    this.app.scene.ambientLight = new pc.Color(0.12, 0.17, 0.26);
    // Task 1: Distance fog — linear, night-sky colour, houses at 30-50m soften into dark
    // Fog start pushed to 42 so zombies at 25-40m are clear; end 95 keeps far background dark.
    this.app.scene.fog.type = pc.FOG_LINEAR;
    this.app.scene.fog.color = new pc.Color(0.04, 0.10, 0.22);
    this.app.scene.fog.start = 42;
    this.app.scene.fog.end = 95;
    this.syncViewportFrame();
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
    this.installViewportResizeHandlers();
  }

  getViewportMetrics() {
    const viewport = window.visualViewport;
    const rawWidth = viewport?.width ?? window.innerWidth;
    const rawHeight = viewport?.height ?? window.innerHeight;
    const width = Math.max(1, Math.round(rawWidth));
    const height = Math.max(1, Math.round(rawHeight));
    const left = Math.max(0, Math.round(viewport?.offsetLeft ?? 0));
    const top = Math.max(0, Math.round(viewport?.offsetTop ?? 0));
    const layoutWidth = Math.max(width, Math.round(window.innerWidth || width));
    const layoutHeight = Math.max(height, Math.round(window.innerHeight || height));
    const right = Math.max(0, layoutWidth - left - width);
    const bottom = Math.max(0, layoutHeight - top - height);

    return { width, height, left, top, right, bottom };
  }

  syncViewportFrame() {
    this.viewportMetrics = this.getViewportMetrics();
    const { width, height, left, top, right, bottom } = this.viewportMetrics;
    const frameKey = `${width}x${height}:${left},${top},${right},${bottom}:dpr${window.devicePixelRatio || 1}`;

    if (frameKey === this._lastViewportFrameKey) {
      return;
    }
    this._lastViewportFrameKey = frameKey;

    const rootStyle = document.documentElement.style;

    rootStyle.setProperty("--game-left", `${left}px`);
    rootStyle.setProperty("--game-top", `${top}px`);
    rootStyle.setProperty("--game-right", `${right}px`);
    rootStyle.setProperty("--game-bottom", `${bottom}px`);
    rootStyle.setProperty("--game-width", `${width}px`);
    rootStyle.setProperty("--game-height", `${height}px`);

    if (this.root) {
      this.root.style.left = `${left}px`;
      this.root.style.top = `${top}px`;
      this.root.style.width = `${width}px`;
      this.root.style.height = `${height}px`;
    }

    if (this.canvas) {
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
    }

    if (this.app) {
      this.app.graphicsDevice.maxPixelRatio = this.getRenderPixelRatio(width, height);
      this.app.resizeCanvas(width, height);
      this.app.renderNextFrame = true;
    }
  }

  getRenderPixelRatio(width, height) {
    const deviceRatio = Math.min(window.devicePixelRatio || 1, 2);
    const profileScale = this.qualityProfile?.renderScale ?? 1;
    const requestedRatio = deviceRatio * profileScale;
    const pixelBudget = this.qualityProfileKey === "desktop_high"
      ? DESKTOP_BACKBUFFER_PIXEL_BUDGET
      : MOBILE_BACKBUFFER_PIXEL_BUDGET;
    const cssPixelArea = Math.max(1, width * height);
    const adaptiveCap = Math.sqrt(pixelBudget / cssPixelArea);
    const minimumRatio = deviceRatio <= 1.05 ? 1 : MIN_RENDER_PIXEL_RATIO;

    return Math.max(minimumRatio, Math.min(requestedRatio, adaptiveCap));
  }

  scheduleViewportFrameSync() {
    document.body.classList.add("viewport-resizing");
    if (!this._viewportResizeRaf) {
      this._viewportResizeRaf = window.requestAnimationFrame(() => {
        this._viewportResizeRaf = 0;
        this.syncViewportFrame();
      });
    }

    window.clearTimeout(this._viewportResizeConfirmTimer);
    this._viewportResizeConfirmTimer = window.setTimeout(() => {
      this.syncViewportFrame();
    }, VIEWPORT_RESIZE_CONFIRM_MS);

    window.clearTimeout(this._viewportResizeSettledTimer);
    this._viewportResizeSettledTimer = window.setTimeout(() => {
      document.body.classList.remove("viewport-resizing");
    }, VIEWPORT_RESIZE_SETTLE_MS);
  }

  installViewportResizeHandlers() {
    const sync = () => this.scheduleViewportFrameSync();

    this._on(window, "resize", sync);
    this._on(window, "orientationchange", sync);
    this._on(window, "fullscreenchange", sync);
    this._on(window, "webkitfullscreenchange", sync);
    if (window.visualViewport) {
      this._on(window.visualViewport, "resize", sync);
      this._on(window.visualViewport, "scroll", sync);
    }

    if (typeof ResizeObserver !== "undefined") {
      this._viewportResizeObserver = new ResizeObserver(sync);
      this._viewportResizeObserver.observe(document.documentElement);
      if (this.root) {
        this._viewportResizeObserver.observe(this.root);
      }
    }
  }

  getGameFrameRect() {
    const rect = this.canvas?.getBoundingClientRect();
    if (rect?.width && rect?.height) {
      return rect;
    }
    const metrics = this.viewportMetrics ?? this.getViewportMetrics();
    return {
      left: metrics.left,
      top: metrics.top,
      width: metrics.width,
      height: metrics.height,
    };
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
    this.moonKeyLight = moon; // kept for the boss-wave blood-moon tint

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
    // One restrained translucent shell is less elaborate than a textured
    // billboard, but stays reliable on SwiftShader and mobile WebGL fallbacks.
    this.addPrimitive("moon-soft-halo", "sphere", [0, 27, -72.8], [8.5, 8.5, 8.5], "moonHalo");
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
    // Grass shoulder strips either side of the mud lane — break the flat plane
    this.addPrimitive("grass-left",  "box", [-8.8, -0.04, -13], [6.8, 0.03, 88], "grassDark");
    this.addPrimitive("grass-right", "box", [ 8.8, -0.04, -13], [6.8, 0.03, 88], "grassDark");
    this.addPrimitive("left-path-edge", "box", [-5.2, 0, -13], [0.42, 0.05, 88], "pathEdge");
    this.addPrimitive("right-path-edge", "box", [5.2, 0, -13], [0.42, 0.05, 88], "pathEdge");
    for (let z = -48; z <= 18; z += 5.5) {
      this.addPrimitive(`lane-stone-${z}`, "box", [Math.sin(z) * 2.9, 0.02, z], [1.25, 0.05, 0.36], "stone").setEulerAngles(0, z * 7, 0);
      this.addPrimitive(`mud-shine-${z}`, "box", [Math.cos(z * 0.4) * 1.9, 0.025, z + 1.3], [1.7, 0.035, 0.22], z % 11 === 0 ? "mudHighlight" : "wetRoad").setEulerAngles(0, z * 9, 0);
    }
    for (let z = -52; z <= 24; z += 3.8) {
      const seam = this.addPrimitive(`lane-rut-${z}`, "box", [-2.8 + Math.sin(z * 0.6) * 0.18, 0.032, z], [0.08, 0.035, 2.6], "wetRoad");
      seam.setEulerAngles(0, 1.8 + Math.sin(z) * 1.5, 0);
      const seamR = this.addPrimitive(`lane-rut-r-${z}`, "box", [2.7 + Math.cos(z * 0.4) * 0.2, 0.032, z + 0.7], [0.07, 0.035, 2.3], "wetRoad");
      seamR.setEulerAngles(0, -1.4 + Math.cos(z) * 1.5, 0);
    }
  }

  addVillage() {
    const tower = VILLAGE_STRUCTURE_DEFS.find((structure) => structure.kind === "tower");
    this.addBellTower(tower.x, tower.z, tower.id);
    this.minimapStructures.push({ id: tower.id, x: tower.x, z: tower.z, sx: tower.sx, sz: tower.sz, kind: "tower" });
    // village-safe-pool: no ground disc, the bell tower glow is sufficient
    this.addLantern(-1.8, 2.6, SLICE_WORLD.villageZ + 0.3);
    this.addLantern(1.8, 2.6, SLICE_WORLD.villageZ + 0.3);

    for (const structure of VILLAGE_STRUCTURE_DEFS.filter((entry) => entry.kind === "house")) {
      this.addHouseFacade(
        `house-${structure.visualIndex}`,
        structure.x,
        structure.z,
        structure.sx,
        structure.sy,
        structure.sz,
        structure.visualIndex,
        structure.id,
      );
    }

    for (let x = -6; x <= 6; x += 2) {
      // Low barrier resting on the ground (was floating at y=0.65 + tilted 12°,
      // which read as a plank hovering in mid-air).
      this.addPrimitive(`barricade-${x}`, "box", [x, 0.28, SLICE_WORLD.villageZ + 3.2], [1.35, 0.52, 0.42], "wood").setEulerAngles(0, x * 8, 0);
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
    // (Removed the scattered "star" spheres — at 0.045u they read as stray
    // dots/artifacts rather than stars; the moon + clouds carry the night sky.)
  }

  // Drift clouds slowly. Transform-only updates
  // (a handful of setLocalPosition/Scale calls) so the living sky costs
  // essentially nothing per frame. Skipped under prefers-reduced-motion.
  _updateSky(dt) {
    if (this._reducedMotion || !(dt > 0)) return;
    this._skyTimeSec = (this._skyTimeSec ?? 0) + dt;
    const t = this._skyTimeSec;
    if (this._cloudDrift?.length) {
      for (const puff of this._cloudDrift) {
        const pos = puff.entity.getLocalPosition();
        puff.entity.setLocalPosition(
          puff.baseX + Math.sin(t * puff.speed + puff.phase) * puff.range,
          pos.y,
          pos.z,
        );
      }
    }
  }

  // Blood-moon escalation: while a boss-tier zombie is alive (or the secret
  // boss phase is active) the fog, ambient, and moonlight shift toward a deep
  // red, then ease back when the threat dies. Scene-level color writes only —
  // no per-frame material.update(). Factor eases over ~2s each way.
  _updateAtmosphere(dt) {
    if (!(dt > 0)) return;
    let bossAlive = this.state.phase === "secret_boss";
    if (!bossAlive) {
      for (const z of this.state.zombies) {
        if (!z.dead && (z.type === "mini_boss" || z.type === "mega_zombie" || z.type === "secret_boss")) {
          bossAlive = true;
          break;
        }
      }
    }
    const target = bossAlive ? 1 : 0;
    const current = this._bloodMoonFactor ?? 0;
    if (current === target) return;
    const step = Math.min(Math.abs(target - current), dt * 0.5);
    const f = current + Math.sign(target - current) * step;
    this._bloodMoonFactor = f;
    const mix = (a, b) => a + (b - a) * f;
    this.app.scene.fog.color.set(mix(0.04, 0.14), mix(0.10, 0.045), mix(0.22, 0.06));
    this.app.scene.ambientLight = new pc.Color(mix(0.12, 0.19), mix(0.17, 0.10), mix(0.26, 0.10));
    if (this.moonKeyLight?.light) {
      this.moonKeyLight.light.color.set(mix(0.75, 1.0), mix(0.86, 0.42), mix(1.0, 0.34));
    }
  }

  addCloudCluster(name, x, y, z, scale) {
    // Five overlapping, vertically varied puffs form one broad storm mass.
    // The restrained count and dark lower lobes avoid both bubble piles and strips.
    // [ox, oy, oz, sx, sy, sz, materialKey]
    const offsets = [
      [0, 0, 0, 5.4, 2.6, 2.7, "cloudDark"],
      [-3.8, -0.35, 0.35, 4.1, 1.9, 2.3, "cloudDark"],
      [4.0, -0.2, 0.2, 4.4, 2.0, 2.4, "cloudDark"],
      [-1.5, 1.25, -0.25, 3.8, 2.45, 2.15, "cloud"],
      [2.0, 1.05, -0.45, 3.5, 2.2, 2.0, "cloud"],
    ];
    // Whole-cluster drift parameters — every puff of a cluster shares them so
    // the cloud moves as one body (see _updateSky).
    if (!this._cloudDrift) this._cloudDrift = [];
    const drift = {
      speed: 0.05 + (scale % 0.13) * 0.35, // ~120s+ period, varied per cluster
      phase: x * 0.37,
      range: 2.2 + scale * 1.4,
    };
    for (const [ox, oy, oz, sx, sy, sz, mat] of offsets) {
      const cloud = this.addPrimitive(`${name}-${ox}`, "sphere", [x + ox * scale, y + oy * scale, z + oz * scale], [sx * scale, sy * scale, sz * scale], mat);
      cloud.setEulerAngles(0, ox * 9, 0);
      this._cloudDrift.push({ entity: cloud, baseX: x + ox * scale, ...drift });
    }
  }

  addBellTower(x, z, structureId) {
    const intactRoot = new pc.Entity(`${structureId}-intact`);
    this.app.root.addChild(intactRoot);
    // Wall rises to ~6.0 so the roof eaves (≈6.05) cap it directly — previously
    // the wall stopped at 4.8 while the roof sat at 6.6, leaving the roof
    // floating above a ~1.2m sky gap.
    this.addPrimitive("bell-tower-base", "box", [x, 3.0, z], [3.3, 6.0, 2.8], "houseWall", intactRoot);
    this.addPrimitive("bell-tower-plaster-stain", "box", [x - 0.65, 2.0, z - 1.43], [0.9, 1.6, 0.05], "plasterShadow", intactRoot);
    this.addPrimitive("bell-tower-timber-left", "box", [x - 1.55, 3.0, z - 1.42], [0.18, 5.9, 0.18], "timber", intactRoot);
    this.addPrimitive("bell-tower-timber-right", "box", [x + 1.55, 3.0, z - 1.42], [0.18, 5.9, 0.18], "timber", intactRoot);
    this.registerWindowEntity("bell-window", this.addPrimitive("bell-window", "box", [x, 3.2, z - 1.43], [0.72, 1.15, 0.08], "windowGlow", intactRoot), structureId);
    this.addWindowFrame("bell-window-frame", x, 3.2, z - 1.48, 0.9, 1.34, intactRoot);
    // Belfry arch + bell read against the upper wall, just under the roofline.
    this.addPrimitive("bell-arch", "box", [x, 5.35, z - 1.45], [2.1, 1.1, 0.22], "timber", intactRoot);
    this.addPrimitive("bell", "sphere", [x, 5.0, z - 1.62], [0.55, 0.55, 0.55], "metal", intactRoot);
    this.addPitchedRoof("bell-roof", x, z, 4.2, 3.7, 6.6, "roofDark", intactRoot);
    this.addPrimitive("bell-cross-vertical", "box", [x, 8.55, z - 0.1], [0.12, 1.0, 0.12], "metal", intactRoot);
    this.addPrimitive("bell-cross-horizontal", "box", [x, 8.74, z - 0.1], [0.65, 0.1, 0.1], "metal", intactRoot);
    this.createVillageStructureDamageVisuals(structureId, intactRoot);
  }

  addHouseFacade(name, x, z, sx, sy, sz, index, structureId) {
    const side = Math.sign(x) || 1;
    const intactRoot = new pc.Entity(`${structureId}-intact`);
    this.app.root.addChild(intactRoot);
    this.minimapStructures.push({ id: structureId, x, z, sx, sz, kind: "building" });
    this.addPrimitive(`${name}-body`, "box", [x, sy / 2, z], [sx, sy, sz], "houseWall", intactRoot);
    this.addPrimitive(`${name}-foundation`, "box", [x, 0.22, z + sz / 2 + 0.035], [sx * 0.96, 0.42, 0.16], "stoneDark", intactRoot);
    this.addPrimitive(`${name}-plaster-patch-a`, "box", [x - side * sx * 0.08, sy * 0.42, z + sz / 2 + 0.062], [sx * 0.28, sy * 0.34, 0.045], "plasterShadow", intactRoot);
    this.addPrimitive(`${name}-plaster-patch-b`, "box", [x + side * sx * 0.26, sy * 0.28, z + sz / 2 + 0.064], [sx * 0.18, sy * 0.22, 0.045], "plasterShadow", intactRoot);
    this.addPitchedRoof(`${name}-roof`, x, z, sx * 1.14, sz * 1.1, sy + 0.66, index > 3 ? "roofDark" : "roof", intactRoot);
    this.addPrimitive(`${name}-timber-mid`, "box", [x, sy * 0.58, z + sz / 2 + 0.05], [sx * 0.88, 0.16, 0.12], "timber", intactRoot);
    this.addPrimitive(`${name}-timber-upper`, "box", [x, sy * 0.86, z + sz / 2 + 0.055], [sx * 0.82, 0.13, 0.12], "timber", intactRoot);
    this.addPrimitive(`${name}-timber-left`, "box", [x - sx * 0.38, sy * 0.55, z + sz / 2 + 0.06], [0.16, sy * 0.8, 0.12], "timber", intactRoot);
    this.addPrimitive(`${name}-timber-right`, "box", [x + sx * 0.38, sy * 0.55, z + sz / 2 + 0.06], [0.16, sy * 0.8, 0.12], "timber", intactRoot);
    this.addPrimitive(`${name}-brace-left`, "box", [x - sx * 0.2, sy * 0.43, z + sz / 2 + 0.07], [0.12, sy * 0.62, 0.11], "timber", intactRoot).setEulerAngles(0, 0, 22);
    this.addPrimitive(`${name}-brace-right`, "box", [x + sx * 0.2, sy * 0.43, z + sz / 2 + 0.07], [0.12, sy * 0.62, 0.11], "timber", intactRoot).setEulerAngles(0, 0, -22);
    this.addPrimitive(`${name}-door`, "box", [x + side * sx * 0.18, 0.72, z + sz / 2 + 0.08], [0.76, 1.25, 0.09], "timber", intactRoot);
    this.addPrimitive(`${name}-door-panel`, "box", [x + side * sx * 0.18, 0.78, z + sz / 2 + 0.135], [0.52, 0.86, 0.045], "weatheredWood", intactRoot);
    this.addPrimitive(`${name}-door-step`, "box", [x + side * sx * 0.18, 0.11, z + sz / 2 + 0.45], [1.05, 0.18, 0.5], "stone", intactRoot);
    this.registerWindowEntity(`${name}-window-a`, this.addPrimitive(`${name}-window-a`, "box", [x - side * sx * 0.22, sy * 0.78, z + sz / 2 + 0.09], [0.72, 0.82, 0.08], "windowGlow", intactRoot), structureId);
    this.registerWindowEntity(`${name}-window-b`, this.addPrimitive(`${name}-window-b`, "box", [x + side * sx * 0.35, sy * 0.62, z + sz / 2 + 0.09], [0.48, 0.62, 0.08], "windowGlow", intactRoot), structureId);
    this.addWindowFrame(`${name}-window-a-frame`, x - side * sx * 0.22, sy * 0.78, z + sz / 2 + 0.135, 0.88, 0.98, intactRoot);
    this.addWindowFrame(`${name}-window-b-frame`, x + side * sx * 0.35, sy * 0.62, z + sz / 2 + 0.135, 0.62, 0.78, intactRoot);
    this.addLantern(x - side * sx * 0.5, 1.55, z + sz / 2 + 0.28);
    if (index >= 4) {
      this.addPrimitive(`${name}-wagon`, "box", [x - side * 2.1, 0.55, z + sz / 2 + 1.3], [2.0, 0.6, 0.9], "wood", intactRoot);
      this.addPrimitive(`${name}-wheel-a`, "cylinder", [x - side * 2.9, 0.35, z + sz / 2 + 1.78], [0.34, 0.08, 0.34], "timber", intactRoot).setEulerAngles(90, 0, 0);
      this.addPrimitive(`${name}-wheel-b`, "cylinder", [x - side * 1.35, 0.35, z + sz / 2 + 1.78], [0.34, 0.08, 0.34], "timber", intactRoot).setEulerAngles(90, 0, 0);
    }
    this.createVillageStructureDamageVisuals(structureId, intactRoot);
  }

  addWindowFrame(name, x, y, z, width, height, parent = this.app.root) {
    this.addPrimitive(`${name}-top`, "box", [x, y + height * 0.5, z], [width, 0.08, 0.08], "timber", parent);
    this.addPrimitive(`${name}-bottom`, "box", [x, y - height * 0.5, z], [width, 0.08, 0.08], "timber", parent);
    this.addPrimitive(`${name}-left`, "box", [x - width * 0.5, y, z], [0.08, height, 0.08], "timber", parent);
    this.addPrimitive(`${name}-right`, "box", [x + width * 0.5, y, z], [0.08, height, 0.08], "timber", parent);
    this.addPrimitive(`${name}-cross-v`, "box", [x, y, z + 0.015], [0.045, height * 0.72, 0.06], "weatheredWood", parent);
    this.addPrimitive(`${name}-cross-h`, "box", [x, y, z + 0.015], [width * 0.68, 0.045, 0.06], "weatheredWood", parent);
  }

  addPitchedRoof(name, x, z, width, depth, y, materialKey, parent = this.app.root) {
    // Panels slope UP toward the centre ridge (∧). The inner edge of each panel
    // must be high and the outer eave low — the previous signs were swapped,
    // which raised the eaves and dropped the centre (an upside-down ∨ roof).
    const left = this.addPrimitive(`${name}-left`, "box", [x - width * 0.19, y, z], [width * 0.62, 0.24, depth], materialKey, parent);
    left.setEulerAngles(0, 0, 25);
    const right = this.addPrimitive(`${name}-right`, "box", [x + width * 0.19, y, z], [width * 0.62, 0.24, depth], materialKey, parent);
    right.setEulerAngles(0, 0, -25);
    this.addPrimitive(`${name}-ridge`, "box", [x, y + width * 0.13, z], [0.18, 0.22, depth * 1.04], "roofEdge", parent);
    for (let i = -2; i <= 2; i += 1) {
      const zOff = i * depth * 0.18;
      const leftBatten = this.addPrimitive(`${name}-batten-l-${i}`, "box", [x - width * 0.2, y + 0.045, z + zOff], [width * 0.56, 0.055, 0.045], "roofEdge", parent);
      leftBatten.setEulerAngles(0, 0, 25);
      const rightBatten = this.addPrimitive(`${name}-batten-r-${i}`, "box", [x + width * 0.2, y + 0.045, z + zOff], [width * 0.56, 0.055, 0.045], "roofEdge", parent);
      rightBatten.setEulerAngles(0, 0, -25);
    }
  }

  createVillageStructureDamageVisuals(structureId, intactRoot) {
    const definition = VILLAGE_STRUCTURE_DEFS.find((structure) => structure.id === structureId);
    if (!definition) return;
    const { x, z, sx, sy, sz } = definition;
    const facadeZ = z + sz * 0.5 + 0.17;

    const cracks = new pc.Entity(`${structureId}-damage-cracks`);
    this.app.root.addChild(cracks);
    const crackA = this.addPrimitive(`${structureId}-crack-a`, "box", [x - sx * 0.16, sy * 0.62, facadeZ], [0.11, sy * 0.56, 0.07], "scorchDecal", cracks);
    crackA.setEulerAngles(0, 0, 31);
    const crackB = this.addPrimitive(`${structureId}-crack-b`, "box", [x + sx * 0.18, sy * 0.42, facadeZ + 0.01], [0.1, sy * 0.44, 0.07], "scorchDecal", cracks);
    crackB.setEulerAngles(0, 0, -38);
    this.addPrimitive(`${structureId}-scorch`, "box", [x, sy * 0.22, facadeZ - 0.01], [sx * 0.44, sy * 0.28, 0.06], "scorchDecal", cracks);

    const critical = new pc.Entity(`${structureId}-damage-critical`);
    this.app.root.addChild(critical);
    const fallenBeam = this.addPrimitive(`${structureId}-fallen-beam`, "box", [x, sy * 0.72, facadeZ + 0.08], [sx * 0.72, 0.2, 0.16], "timber", critical);
    fallenBeam.setEulerAngles(0, 0, 12);
    this.addPrimitive(`${structureId}-char-panel`, "box", [x + sx * 0.28, sy * 0.54, facadeZ + 0.06], [sx * 0.22, sy * 0.74, 0.08], "rubbleDark", critical);

    const fire = new pc.Entity(`${structureId}-damage-fire`);
    fire.setLocalPosition(x, 0, z);
    this.app.root.addChild(fire);
    this.addPrimitive(`${structureId}-fire-a`, "sphere", [-sx * 0.2, sy * 0.7, sz * 0.5 + 0.29], [0.42, 0.74, 0.42], "blastFire", fire);
    this.addPrimitive(`${structureId}-fire-a-core`, "sphere", [-sx * 0.2, sy * 0.62, sz * 0.5 + 0.37], [0.2, 0.38, 0.2], "lantern", fire);
    this.addPrimitive(`${structureId}-fire-b`, "sphere", [sx * 0.24, sy * 0.42, sz * 0.5 + 0.27], [0.34, 0.58, 0.34], "blastFire", fire);
    this.addPrimitive(`${structureId}-fire-roof`, "sphere", [sx * 0.08, sy + 0.58, sz * 0.28], [0.34, 0.64, 0.34], "blastFire", fire);

    const smoke = this.addPrimitive(
      `${structureId}-damage-smoke`,
      "sphere",
      [x, sy + 1.5, z + sz * 0.22],
      [1.05, 1.4, 1.05],
      "structureSmoke",
    );
    smoke._villageSmokeBaseY = sy + 1.5;
    smoke._villageSmokeBaseZ = z + sz * 0.22;

    const rubble = new pc.Entity(`${structureId}-rubble`);
    this.app.root.addChild(rubble);
    const rubblePieces = [
      [-0.32, -0.2, 0.34, 0.28, 0.38, "stoneDark", 18],
      [0.26, 0.18, 0.28, 0.34, 0.3, "rubbleDark", -16],
      [-0.08, 0.3, 0.42, 0.2, 0.28, "roofDark", 34],
      [0.36, -0.24, 0.3, 0.26, 0.44, "timber", 58],
      [-0.38, 0.24, 0.26, 0.3, 0.32, "houseWall", -28],
      [0.04, -0.34, 0.46, 0.18, 0.24, "roofDark", 9],
    ];
    rubblePieces.forEach(([ox, oz, psx, psy, psz, material, rot], index) => {
      const piece = this.addPrimitive(
        `${structureId}-rubble-${index}`,
        "box",
        [x + ox * sx, 0.12 + psy * 0.7, z + oz * sz],
        [Math.max(0.5, psx * sx), Math.max(0.3, psy * sy), Math.max(0.5, psz * sz)],
        material,
        rubble,
      );
      piece.setEulerAngles(index * 7, rot, rot * 0.32);
    });

    const attackRing = this.addPrimitive(
      `${structureId}-attack-ring`,
      "cylinder",
      [x, 0.045, z],
      [Math.max(sx, sz) * 0.68, 0.025, Math.max(sx, sz) * 0.68],
      "structureAlert",
    );

    const alertRoot = new pc.Entity(`${structureId}-alert`);
    alertRoot.setLocalPosition(x, sy + 1.55, z);
    this.app.root.addChild(alertRoot);
    this.addPrimitive(`${structureId}-health-back`, "box", [0, 0, 0], [2.35, 0.24, 0.08], "healthBack", alertRoot);
    const alertFill = this.addPrimitive(`${structureId}-health-fill`, "box", [0, 0, 0.055], [2.18, 0.13, 0.065], "structureAlert", alertRoot);
    const criticalFill = this.addPrimitive(`${structureId}-health-critical`, "box", [0, 0, 0.065], [2.18, 0.13, 0.065], "structureCritical", alertRoot);
    const beaconStem = this.addPrimitive(`${structureId}-alert-beacon-stem`, "box", [-1.4, 0.15, 0], [0.11, 0.32, 0.08], "structureAlert", alertRoot);
    const beacon = this.addPrimitive(`${structureId}-alert-beacon`, "sphere", [-1.4, -0.15, 0], [0.18, 0.18, 0.18], "structureAlert", alertRoot);

    cracks.enabled = false;
    critical.enabled = false;
    fire.enabled = false;
    smoke.enabled = false;
    rubble.enabled = false;
    attackRing.enabled = false;
    alertRoot.enabled = false;
    criticalFill.enabled = false;
    this.villageStructureVisuals.set(structureId, {
      definition,
      intactRoot,
      cracks,
      critical,
      fire,
      smoke,
      rubble,
      attackRing,
      alertRoot,
      alertFill,
      criticalFill,
      beaconStem,
      beacon,
      displayRatio: 1,
      lastTier: -1,
    });
  }

  addPine(name, x, z, scale, rotY = 0) {
    const root = new pc.Entity(name);
    root.setLocalPosition(x, 0, z);
    this.app.root.addChild(root);
    // Task 3: thicker trunk + 4 tiers (was 3) + per-tree rotY variety
    this.addPrimitive(`${name}-trunk`, "cylinder", [0, 1.1 * scale, 0], [0.24 * scale, 2.05 * scale, 0.24 * scale], "timber", root);
    for (let tier = 0; tier < 4; tier += 1) {
      const y = (1.65 + tier * 0.72) * scale;
      const size = (1.65 - tier * 0.28) * scale;
      this.addPrimitive(`${name}-tier-${tier}`, "cone", [0, y, 0], [size, 1.6 * scale, size], "pine", root);
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
      const x = side * (36 + Math.sin(i * 1.7) * 6);
      const landscapeId = `landscape-${i}`;
      // Cull every foreground tree around spawn. Even side trees just outside the
      // lane can project as huge black columns in the first-person camera.
      if (z > -54) {
        continue;
      }
      if (i % 3 === 0) {
        // Task 3: pines — extra tier + per-tree rotation
        const rotY = rand() * 360;
        this.entitiesByLandscape.set(landscapeId, this.addPine(`pine-${i}`, x, z, 0.9 + rand() * 0.36, rotY));
      } else {
        // Task 3: deciduous — cluster of 3-4 overlapping spheres + thicker trunk
        const root = new pc.Entity(`tree-${i}`);
        this.app.root.addChild(root);
        const trunkScale = 0.22 + rand() * 0.06;
        const trunkH = 1.45 + rand() * 0.35;
        const trunk = this.addPrimitive(`tree-trunk-${i}`, "cylinder", [x, trunkH * 0.5, z], [trunkScale, trunkH, trunkScale], "wood", root);
        trunk.setEulerAngles(Math.sin(i) * 4, 0, Math.cos(i) * 4);
        const crownY = trunkH + 0.3;
        const baseR = 0.92 + rand() * 0.26;
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
      mist.render.castShadows = false;
      mist.render.receiveShadows = false;
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

    // Split fence runs leave three authored gates on each side. Zombies route
    // through the gate nearest their selected structure, and the player can
    // use the same openings to rotate between threatened buildings.
    for (const side of [-1, 1]) {
      const sideName = side < 0 ? "left" : "right";
      const x = side * VILLAGE_FENCE_X;
      for (const [segmentIndex, segment] of VILLAGE_FENCE_SEGMENTS.entries()) {
        const length = segment.maxZ - segment.minZ;
        const centerZ = (segment.minZ + segment.maxZ) * 0.5;
        for (const [rail, ry] of [["top", 1.04], ["mid", 0.58]]) {
          this.addPrimitive(`fence-${rail}-${sideName}-${segmentIndex}`, "box", [x, ry, centerZ], [0.16, 0.2, length], "wood");
        }
        const postCount = Math.max(1, Math.ceil(length / 4));
        for (let postIndex = 0; postIndex <= postCount; postIndex += 1) {
          const z = segment.minZ + (length * postIndex) / postCount;
          this.addPrimitive(`fence-${sideName}-${segmentIndex}-${postIndex}`, "box", [x, 0.72, z], [0.26, 1.25, 0.28], "wood");
          this.addPrimitive(`fence-cap-${sideName}-${segmentIndex}-${postIndex}`, "box", [x, 1.38, z], [0.34, 0.12, 0.36], "weatheredWood");
        }
      }
    }
  }

  addLantern(x, y, z) {
    this.addPrimitive(`lantern-${x}-${z}`, "sphere", [x, y, z], [0.22, 0.22, 0.22], "lantern");
    this.addPrimitive(`lantern-pool-${x}-${z}`, "cylinder", [x, 0.035, z], [2.4, 0.018, 2.4], "lanternPool");
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

    // Viewmodel key light — cool moonlit blue-white from upper-left of camera.
    // Range 2.2 so it cannot reach scene geometry (zombies stay unchanged).
    const viewmodelLight = new pc.Entity("viewmodel-fill-light");
    viewmodelLight.addComponent("light", {
      type: "omni",
      color: new pc.Color(0.86, 0.9, 0.94),
      intensity: 1.45,
      range: 2.2,
      castShadows: false,
    });
    viewmodelLight.setLocalPosition(-0.15, 0.12, -0.55);
    this.camera.addChild(viewmodelLight);

    // Viewmodel warm rim/fill — subtle orange-amber from the right/below to give
    // the gun 3-D read (frame vs slide catch different light temperatures).
    // Range 1.8 keeps it strictly on the viewmodel.
    const viewmodelRim = new pc.Entity("viewmodel-rim-light");
    viewmodelRim.addComponent("light", {
      type: "omni",
      color: new pc.Color(1.0, 0.72, 0.38),
      intensity: 0.68,
      range: 1.8,
      castShadows: false,
    });
    viewmodelRim.setLocalPosition(0.55, -0.35, -0.60);
    this.camera.addChild(viewmodelRim);

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
    const rootPosition = options.rootPosition ?? [0.48, -0.5, -0.95];
    group._rootPosition = [rootPosition[0] * 0.9, rootPosition[1] - 0.1, rootPosition[2] - 0.1];
    group._rootEuler = options.rootEuler ?? [-1, -6, 0];
    this.weaponModels.set(key, group);
    return group;
  }

  createSidearmModel() {
    // Root offset: X=0.28 places the gun well in the bottom-right without being cut off.
    // Internal parts are shifted slightly left (X reduced) so the rightmost piece (forearm-r)
    // stays within screen bounds at 375px mobile width.
    const root = this.createWeaponGroup("sidearm", { muzzle: [0.02, 0.03, -0.84], rootPosition: [0.36, -0.43, -1.08], rootEuler: [-1, -2, 0] });
    // Tag the slide entity so the per-weapon animation can rack it back on fire.
    const slide = this.addPrimitive("sidearm-slide", "box", [0, 0.08, -0.2], [0.22, 0.16, 0.64], "blackMetal", root);
    root._actionPart = slide;
    root._actionRestX = 0;
    root._actionRestY = 0.08;
    root._actionRestZ = -0.2;   // local Z at rest
    root._actionType = "slide"; // drives backward travel on kick peak
    this.addPrimitive("sidearm-slide-top", "box", [0, 0.165, -0.2], [0.22, 0.02, 0.64], "gunmetalLight", root);
    this.addPrimitive("sidearm-ejection-port", "box", [0.085, 0.17, -0.18], [0.065, 0.026, 0.18], "gunBlackVoid", root);
    for (let i = 0; i < 4; i += 1) {
      this.addPrimitive(`sidearm-rear-serration-${i}`, "box", [0.114, 0.1, 0.02 + i * 0.04], [0.018, 0.13, 0.012], "gunmetalLight", root).setLocalEulerAngles(0, 0, -14);
    }
    this.addPrimitive("sidearm-front-sight", "box", [0, 0.175, -0.48], [0.04, 0.05, 0.03], "gunmetalLight", root);
    this.addPrimitive("sidearm-rear-sight", "box", [0, 0.175, 0.06], [0.1, 0.05, 0.04], "gunmetalLight", root);
    this.addPrimitive("sidearm-muzzle-crown", "cylinder", [0.01, 0.07, -0.75], [0.042, 0.04, 0.042], "gunmetalLight", root).setLocalEulerAngles(90, 0, 0);
    this.addPrimitive("sidearm-bore", "cylinder", [0.01, 0.07, -0.775], [0.024, 0.022, 0.024], "gunBlackVoid", root).setLocalEulerAngles(90, 0, 0);
    this.addPrimitive("sidearm-frame", "box", [0.01, -0.03, -0.02], [0.2, 0.12, 0.42], "rail", root);
    this.addPrimitive("sidearm-trigger-guard", "box", [0.012, -0.13, -0.08], [0.16, 0.035, 0.18], "blackMetal", root).setLocalEulerAngles(-8, 0, 0);
    this.addPrimitive("sidearm-trigger", "box", [0.012, -0.16, -0.06], [0.035, 0.12, 0.035], "gunBlackVoid", root).setLocalEulerAngles(-14, 0, 0);
    // Grip/hand shifted slightly left (-0.02 on X) to reduce off-screen extension
    this.addPrimitive("sidearm-grip", "box", [0.03, -0.22, 0.14], [0.18, 0.36, 0.16], "gripRubber", root).setLocalEulerAngles(-13, 0, 0);
    for (let i = 0; i < 4; i += 1) {
      this.addPrimitive(`sidearm-grip-rib-${i}`, "box", [0.032, -0.31 + i * 0.06, 0.055], [0.19, 0.012, 0.018], "gunBlackVoid", root).setLocalEulerAngles(-13, 0, 0);
    }
    this.addPrimitive("sidearm-barrel", "cylinder", [0.01, 0.07, -0.58], [0.035, 0.32, 0.035], "metal", root).setLocalEulerAngles(90, 0, 0);
    // Right hand + forearm — forearm-r X reduced from 0.18 to 0.10 to keep it on screen
    this.addPrimitive("sidearm-hand-r", "box", [0.03, -0.24, 0.14], [0.14, 0.12, 0.18], "glove", root).setLocalEulerAngles(-13, 0, 4);
    this.addPrimitive("sidearm-forearm-r", "box", [0.11, -0.43, 0.34], [0.12, 0.1, 0.42], "sleeve", root).setLocalEulerAngles(38, -12, 0);
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
    this.addPrimitive("rifle-trigger-guard", "box", [0.01, -0.13, 0.08], [0.17, 0.035, 0.19], "blackMetal", root).setLocalEulerAngles(-8, 0, 0);
    this.addPrimitive("rifle-trigger", "box", [0.01, -0.17, 0.09], [0.035, 0.12, 0.035], "gunBlackVoid", root).setLocalEulerAngles(-14, 0, 0);
    this.addPrimitive("rifle-magwell", "box", [0.02, -0.13, -0.14], [0.2, 0.16, 0.16], "rail", root).setLocalEulerAngles(-4, 0, 0);
    this.addPrimitive("rifle-magazine", "box", [0.03, -0.33, -0.18], [0.18, 0.42, 0.18], "blackMetal", root).setLocalEulerAngles(-9, 0, 0);
    this.addPrimitive("rifle-ejection-port", "box", [0.125, 0.055, -0.05], [0.035, 0.08, 0.2], "gunBlackVoid", root);
    this.addPrimitive("rifle-top-rail", "box", [0, 0.13, -0.18], [0.31, 0.035, 1.05], "rail", root);
    for (let i = 0; i < 7; i += 1) {
      this.addPrimitive(`rifle-rail-notch-${i}`, "box", [0, 0.17, 0.24 - i * 0.13], [0.34, 0.035, 0.045], "blackMetal", root);
    }
    for (let i = 0; i < 5; i += 1) {
      this.addPrimitive(`rifle-handguard-slot-l-${i}`, "box", [-0.115, 0.02, -0.78 + i * 0.11], [0.018, 0.08, 0.052], "gunBlackVoid", root);
      this.addPrimitive(`rifle-handguard-slot-r-${i}`, "box", [0.115, 0.02, -0.78 + i * 0.11], [0.018, 0.08, 0.052], "gunBlackVoid", root);
    }
    this.addPrimitive("rifle-front-sight", "box", [0, 0.31, -0.82], [0.08, 0.23, 0.06], "gunmetalLight", root);
    this.addPrimitive("rifle-rear-sight", "box", [0, 0.25, 0.16], [0.12, 0.16, 0.06], "gunmetalLight", root);
    this.addPrimitive("rifle-barrel", "cylinder", [0, 0.04, -0.96], [0.045, 0.78, 0.045], "blackMetal", root).setLocalEulerAngles(90, 0, 0);
    this.addPrimitive("rifle-muzzle-crown", "cylinder", [0, 0.04, -1.38], [0.054, 0.05, 0.054], "gunmetalLight", root).setLocalEulerAngles(90, 0, 0);
    this.addPrimitive("rifle-bore", "cylinder", [0, 0.04, -1.41], [0.03, 0.024, 0.03], "gunBlackVoid", root).setLocalEulerAngles(90, 0, 0);
    // Right hand on pistol grip + forearm; left support hand on handguard
    this.addPrimitive("rifle-hand-r", "box", [0.02, -0.22, 0.2], [0.16, 0.14, 0.2], "glove", root).setLocalEulerAngles(-12, 0, 4);
    this.addPrimitive("rifle-forearm-r", "box", [0.2, -0.38, 0.36], [0.14, 0.13, 0.5], "sleeve", root).setLocalEulerAngles(38, -15, 0);
    this.addPrimitive("rifle-hand-l", "box", [-0.04, -0.04, -0.55], [0.16, 0.14, 0.2], "glove", root).setLocalEulerAngles(0, 0, -8);
    this.addPrimitive("rifle-forearm-l", "box", [-0.22, -0.18, -0.44], [0.13, 0.12, 0.44], "sleeve", root).setLocalEulerAngles(-28, 16, 0);
  }

  createShotgunModel() {
    const root = this.createWeaponGroup("shotgun", { muzzle: [0, 0.02, -1.42], rootPosition: [0.5, -0.5, -0.98] });
    this.addPrimitive("shotgun-receiver", "box", [0.01, 0, -0.04], [0.3, 0.2, 0.62], "blackMetal", root);
    this.addPrimitive("shotgun-ejection-port", "box", [0.15, 0.065, -0.04], [0.035, 0.08, 0.22], "gunBlackVoid", root);
    this.addPrimitive("shotgun-rib", "box", [0, 0.12, -0.62], [0.06, 0.02, 1.22], "gunmetalLight", root);
    // Tag the pump fore-end so the animation can slam it rearward on each shot.
    const pump = this.addPrimitive("shotgun-pump", "box", [0, -0.005, -0.62], [0.3, 0.18, 0.48], "wood", root);
    for (let i = 0; i < 5; i += 1) {
      this.addPrimitive(`shotgun-pump-groove-${i}`, "box", [0, 0.092, -0.81 + i * 0.095], [0.32, 0.018, 0.024], "weatheredWood", root);
    }
    root._actionPart = pump;
    root._actionRestX = 0;
    root._actionRestY = -0.005;
    root._actionRestZ = -0.62;
    root._actionType = "pump";
    this.addPrimitive("shotgun-stock", "box", [0.04, -0.02, 0.43], [0.4, 0.2, 0.36], "wood", root);
    this.addPrimitive("shotgun-recoil-pad", "box", [0.06, -0.025, 0.63], [0.38, 0.18, 0.055], "gripRubber", root);
    this.addPrimitive("shotgun-barrel-a", "cylinder", [-0.04, 0.06, -0.96], [0.04, 0.84, 0.04], "blackMetal", root).setLocalEulerAngles(90, 0, 0);
    this.addPrimitive("shotgun-barrel-b", "cylinder", [0.04, 0.06, -0.96], [0.04, 0.84, 0.04], "blackMetal", root).setLocalEulerAngles(90, 0, 0);
    this.addPrimitive("shotgun-muzzle-a", "cylinder", [-0.04, 0.06, -1.4], [0.048, 0.04, 0.048], "gunmetalLight", root).setLocalEulerAngles(90, 0, 0);
    this.addPrimitive("shotgun-muzzle-b", "cylinder", [0.04, 0.06, -1.4], [0.048, 0.04, 0.048], "gunmetalLight", root).setLocalEulerAngles(90, 0, 0);
    this.addPrimitive("shotgun-bore-a", "cylinder", [-0.04, 0.06, -1.425], [0.031, 0.022, 0.031], "gunBlackVoid", root).setLocalEulerAngles(90, 0, 0);
    this.addPrimitive("shotgun-bore-b", "cylinder", [0.04, 0.06, -1.425], [0.031, 0.022, 0.031], "gunBlackVoid", root).setLocalEulerAngles(90, 0, 0);
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
    // Bolt-handle: a small cylinder that travels rearward/up on fire (simulates bolt cycle).
    const bolt = this.addPrimitive("precision-bolt-handle", "cylinder", [0.13, 0.04, 0.08], [0.025, 0.18, 0.025], "gunmetalLight", root).setLocalEulerAngles(0, 0, 90);
    root._actionPart = bolt;
    root._actionRestX = 0.13;
    root._actionRestY = 0.04;
    root._actionRestZ = 0.08;
    root._actionType = "bolt";
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
    const narrowView = (this.viewportMetrics?.width ?? window.innerWidth) <= 600;
    const viewmodelScale = narrowView ? 0.66 : 0.84;
    const frameOffsetX = narrowView ? -0.13 : 0.025;
    const frameOffsetY = narrowView ? 0.02 : -0.025;

    // ── Per-weapon recoil curve ───────────────────────────────────────────────
    // kick = normalized [0..1]: 1 = just fired (peak), 0 = fully recovered.
    // We use a fast-rise / eased-decay shape: spike immediately, then exponential return.
    const rawKick = Math.max(0, this.weaponKickSec ?? 0) / Math.max(0.001, this.weaponKickMaxSec ?? 1);
    // Shape the curve: sharp spike at start (first 20%) then smooth decay.
    const kick = rawKick > 0.8 ? 1.0 : rawKick / 0.8; // linear ramp during first 20%, then direct
    const kickPower = Math.max(0, this.weaponKickPower ?? 0);

    // Fetch the active fire profile (cached by flashMuzzle, or look up by weapon id)
    const prof = this._activeFireProfile ?? this._getWeaponFireProfile(weapon.id);

    // ── Viewmodel root transform ──────────────────────────────────────────────
    // kickback: weapon punches toward camera (+Z in local space)
    // rise:     muzzle climbs (positive euler X = pitch up in PlayCanvas)
    // roll:     lateral snap (Z-axis rotation)
    // lateral:  small X-axis sway
    const kickZ = kick * kickPower * prof.kickback * 6;    // z kickback
    const kickY = -(kick * kickPower * 0.15);              // small dip on Y
    const kickX = kick * prof.lateral * kickPower * 3;     // lateral sway
    const pitchDeg = kick * kickPower * prof.rise;         // muzzle rise
    const rollDeg  = kick * prof.roll;                     // snap roll
    this.weaponRoot.setLocalPosition(
      position[0] + frameOffsetX + kickX,
      position[1] + frameOffsetY + kickY,
      position[2] + kickZ,
    );
    this.weaponRoot.setLocalScale(viewmodelScale, viewmodelScale, viewmodelScale);
    this.weaponRoot.setLocalEulerAngles(
      euler[0] + pitchDeg,
      euler[1],
      euler[2] + rollDeg,
    );

    // ── Action-part animation (slide / pump / bolt) ───────────────────────────
    // Drive tagged model parts through their travel arc using the kick curve.
    if (model?._actionPart && prof.actionAmt > 0) {
      const part = model._actionPart;
      const restX = model._actionRestX ?? 0;
      const restY = model._actionRestY ?? 0;
      const restZ = model._actionRestZ ?? 0;
      const actionType = model._actionType ?? "slide";
      // Peak travel at kick=1, return to rest at kick=0.
      // Slide/auto: travels rearward (+Z in local space).
      // Pump:       travels rearward (+Z).
      // Bolt:       travels rearward (+Z) then up slightly.
      const travel = kick * prof.actionAmt;
      if (actionType === "bolt") {
        part.setLocalPosition(restX, restY + kick * 0.06, restZ + travel);
      } else {
        // slide or pump: pure Z travel
        part.setLocalPosition(restX, restY, restZ + travel);
      }
    }

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

  // Freshly spawned zombies scale in over this window (rise-from-the-dirt read
  // instead of popping into existence). Timer lives on the entity; consumed in
  // updateZombies. Skipped when reduced motion is preferred.
  static SPAWN_IN_SEC = 0.35;

  createZombieEntity(zombie) {
    let root;

    // Boss-tier entrance: a thump of screen shake (and a heavy haptic pattern)
    // announces the arrival before the player has even spotted it.
    if (zombie.type === "mini_boss" || zombie.type === "mega_zombie" || zombie.type === "secret_boss") {
      this._addShakeTrauma(0.45);
      this._vibrate?.([0, 40, 70, 50]);
    }

    // Animal-type zombie: use dedicated animal GLB if the container is ready.
    // Falls through to zombie GLB / procedural rig on any failure or missing model.
    const ANIMAL_TYPES = new Set(["zombie_cow", "zombie_pig", "zombie_horse", "zombie_chicken"]);
    if (ANIMAL_TYPES.has(zombie.type) && this.useGlbZombies && !this.animalGlbLoadStarted) {
      this.animalGlbLoadStarted = true;
      loadAnimalGlbContainers(this.app).then((containers) => {
        const anyLoaded = Object.values(containers).some(Boolean);
        if (anyLoaded) {
          this.animalGlbContainers = containers;
          const loaded = Object.entries(containers).filter(([, v]) => v).map(([k]) => k);
          console.debug("[PlayCanvas] Deferred animal GLB containers ready:", loaded.join(", "));
        } else {
          console.warn("[PlayCanvas] Deferred animal GLB load failed — using zombie GLB fallback for animals.");
        }
      });
    }
    if (ANIMAL_TYPES.has(zombie.type) && this.useGlbZombies && this.animalGlbContainers) {
      try {
        const animalRoot = createAnimalGlbEntity(this.app, zombie, this.animalGlbContainers);
        if (animalRoot) {
          // Animal GLB root uses the same _glb interface as zombieGlb.js.
          // No bloom corona spheres on animals (they have smaller eye structures).
          this.entitiesByZombie.set(zombie.id, animalRoot);
          return animalRoot;
        }
        // null → fall through to zombie GLB / procedural
      } catch (ex) {
        console.warn("[PlayCanvas] createAnimalGlbEntity failed, using fallback:", ex);
      }
    }

    if (this.useGlbZombies && this.glbContainer) {
      // GLB path — skinned Quaternius humanoid model
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

  registerWindowEntity(id, entity, structureId = null) {
    entity._villageStructureId = structureId;
    this.entitiesByWindow.set(id, entity);
    return entity;
  }

  // Register a listener on a GLOBAL target (window/document/visualViewport)
  // and record it for dispose(). Listeners on this.root's descendants don't
  // need this — they die with the DOM.
  _on(target, event, handler, options) {
    target.addEventListener(event, handler, options);
    if (!this._teardownListeners) this._teardownListeners = [];
    this._teardownListeners.push({ target, event, handler, options });
  }

  // Full teardown: global listeners, timers, focus traps, the PlayCanvas app,
  // the DOM, and the window automation globals. Makes re-initialising the game
  // on the same page (hot reload, embeds, tests) leak-free.
  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    for (const { target, event, handler, options } of this._teardownListeners ?? []) {
      target.removeEventListener(event, handler, options);
    }
    this._teardownListeners = [];
    const traps = [...(this._focusTraps ?? [])];
    this._focusTraps = [];
    for (const teardown of traps) {
      try { teardown(); } catch { /* trap already released */ }
    }
    if (this._viewportResizeRaf) cancelAnimationFrame(this._viewportResizeRaf);
    clearTimeout(this._viewportResizeConfirmTimer);
    clearTimeout(this._viewportResizeSettledTimer);
    clearTimeout(this._hitmarkerTimer);
    clearTimeout(this._floaterTimer);
    clearTimeout(this._coinsPopTimer);
    clearTimeout(this._killsPopTimer);
    clearTimeout(this._streakHideTimer);
    this._viewportResizeObserver?.disconnect();
    this._stopNightBed();
    try {
      this.app?.destroy();
    } catch { /* engine teardown is best-effort */ }
    this.root?.replaceChildren?.();
    // Only clear the automation globals if they still point at THIS instance —
    // a newer instance may have claimed them already.
    if (typeof window !== "undefined" && window.__playCanvasZombieGame === this) {
      for (const key of [
        "__playCanvasZombieSlice",
        "__playCanvasZombieGame",
        "advanceTime",
        "render_playcanvas_slice_to_text",
        "render_playcanvas_game_to_text",
        "render_game_to_text",
      ]) {
        delete window[key];
      }
    }
  }

  // ── Pooled transient FX (shell casings, smoke puffs, decals) ──────────────
  // addPrimitive assigns SHARED material instances, so transient FX that fade
  // `opacity` used to fight over one material (simultaneous smoke puffs each
  // writing the same instance) and churned an entity create/destroy per shot.
  // Pool entities per kind and give each a CLONED material it can fade safely.
  _acquireFx(kind, shape, materialKey) {
    if (!this._fxFree) this._fxFree = new Map();
    let list = this._fxFree.get(kind);
    if (!list) {
      list = [];
      this._fxFree.set(kind, list);
    }
    let entity = list.pop();
    if (!entity) {
      this._fxPoolSeq = (this._fxPoolSeq ?? 0) + 1;
      entity = this.addPrimitive(`fx-${kind}-${this._fxPoolSeq}`, shape, [0, -40, 0], [0.01, 0.01, 0.01], materialKey);
      const mat = this.materials.get(materialKey)?.clone?.();
      if (mat && entity.render?.meshInstances?.[0]) {
        mat.update();
        entity.render.meshInstances[0].material = mat;
      }
      entity._fxPoolKind = kind;
    }
    entity.enabled = true;
    entity.setEulerAngles(0, 0, 0);
    return entity;
  }

  // Return a pooled FX entity to its free list (updateFx calls this instead of
  // destroy() for pooled kinds).
  _retireFxEntity(entity) {
    if (!entity._fxPoolKind || !this._fxFree) {
      entity.destroy();
      return;
    }
    entity.enabled = false;
    const mat = entity.render?.meshInstances?.[0]?.material;
    if (mat && mat.opacity !== 1) {
      mat.opacity = 1;
      mat.update();
    }
    this._fxFree.get(entity._fxPoolKind)?.push(entity);
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
    this.root.querySelector('[data-action="shop-close"]')?.addEventListener("click", () => {
      this.shopOpen = false;
      this.sfxCues.uiClick();
      this.updateHud();
    });
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
    // Onboarding overlay dismiss button
    const onboardingDismissBtn = this.root.querySelector('[data-action="onboarding-dismiss"]');
    if (onboardingDismissBtn) {
      onboardingDismissBtn.addEventListener("click", () => {
        this._dismissOnboarding();
        // "GOT IT — PLAY" jumps straight into the campaign (no redundant menu step).
        if (this.state.phase === "ready") {
          this.startOrContinueCampaign({ pointerLock: true });
        }
      });
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
        const s = setPlayCanvasAudioSettings(this.state, {
          musicEnabled: setting === "musicEnabled" ? input.checked : this.state.musicEnabled,
          sfxEnabled: setting === "sfxEnabled" ? input.checked : this.state.sfxEnabled,
        });
        this.audio.setSfxEnabled(s.sfxEnabled);
        this.audio.setMusicEnabled(s.musicEnabled);
        this.samples?.setMuted(s.sfxEnabled === false);
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

    this.attachShopInput();

    this._on(window, "keydown", (event) => this.setKey(event, true));
    this._on(window, "keyup", (event) => this.setKey(event, false));
    this.root.querySelector('[data-action="ordnance"]').addEventListener("click", () => this.useActiveOrdnance());
    this.attachTouchControls();
    this._on(window, "mousemove", (event) => this.handleLookMove(event));
    this._on(window, "pointerup", () => {
      this.input.dragLooking = false;
      this.input.fire = false;
    });
    this._on(window, "pointercancel", () => {
      this.input.dragLooking = false;
      this.input.fire = false;
    });
    // Losing focus (alt-tab, click another window) or backgrounding the tab
    // (mobile app-switch) means held-key `keyup` events never arrive, which used
    // to leave movement stuck on — controls felt "locked up" mid-game. Clear ALL
    // input on focus/visibility loss so nothing gets stuck down.
    this._on(window, "blur", () => this._clearAllInput());
    this._on(document, "visibilitychange", () => {
      if (document.hidden) this._clearAllInput();
    });
    // pointerlockchange / pointerlockerror fire on document, not window.
    this._on(document, "pointerlockchange", () => {
      this.input.pointerLocked = document.pointerLockElement === this.canvas;
      if (this.input.pointerLocked) {
        this.input.dragLooking = false;
        this.state.lastMessage = "Mouse look active — click to fire, Esc to release.";
        this.updateHud();
      }
    });
    this._on(document, "pointerlockerror", () => {
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
      if (isActivePlayPhase(this.state.phase) && !this._isUiOverlayOpen()) {
        this.unlockAudio();
        this.requestPointerLock();
        this.input.fire = true;
        this.fire();
      }
      this.input.dragLooking = true;
      this.input.lastPointerX = event.clientX;
      this.input.lastPointerY = event.clientY;
      this.safeSetPointerCapture(this.canvas, event.pointerId);
    });
    this.canvas.addEventListener("pointerup", (event) => {
      if (event.button === 2) {
        this.input.ads = false;
        setPlayerAds(this.state, false);
      } else if (event.button === 0) {
        this.input.fire = false;
      }
    });
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    this.canvas.addEventListener("click", () => {
      this.unlockAudio();
      if (this.state.phase === "ready") {
        this.startOrContinueCampaign();
      }
      // Only grab the pointer / fire while we're in active combat AND no
      // interactive overlay is open. The shop can be opened mid-combat (phase
      // stays "running"); a background click behind it must not re-lock the
      // pointer or fire — that recaptures the cursor so shop items can no
      // longer be clicked. (This is the "can't click shop weapons" bug.)
      if (!isActivePlayPhase(this.state.phase) || this._isUiOverlayOpen()) {
        return;
      }
      this.requestPointerLock();
    });
  }

  attachShopInput() {
    const TAP_SLOP_PX = 16;
    let pendingTap = null;
    let lastPointerActionAt = Number.NEGATIVE_INFINITY;

    const getShopActionEl = (target) => target.closest?.("[data-shop-type][data-shop-id]");

    this.shopItemsRoot.addEventListener("pointerdown", (event) => {
      const item = getShopActionEl(event.target);
      if (!item || item.dataset.shopDisabled === "true") {
        pendingTap = null;
        return;
      }
      pendingTap = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        shopType: item.dataset.shopType,
        shopId: item.dataset.shopId,
      };
      this.safeSetPointerCapture(item, event.pointerId);
    });
    this.shopItemsRoot.addEventListener("pointerup", (event) => {
      if (!pendingTap || pendingTap.pointerId !== event.pointerId) {
        return;
      }
      const item = getShopActionEl(event.target);
      const moved = Math.hypot(event.clientX - pendingTap.startX, event.clientY - pendingTap.startY);
      const sameItem = item
        && item.dataset.shopType === pendingTap.shopType
        && item.dataset.shopId === pendingTap.shopId;
      const action = pendingTap;
      pendingTap = null;
      if (!sameItem || moved > TAP_SLOP_PX || item.dataset.shopDisabled === "true") {
        return;
      }
      event.preventDefault();
      lastPointerActionAt = performance.now();
      this.activateShopItem(action.shopType, action.shopId);
    });
    this.shopItemsRoot.addEventListener("pointercancel", () => {
      pendingTap = null;
    });
    this.shopItemsRoot.addEventListener("lostpointercapture", () => {
      pendingTap = null;
    });

    this.shopItemsRoot.addEventListener("click", (event) => {
      const item = getShopActionEl(event.target);
      if (!item) {
        return;
      }
      event.preventDefault();
      if (performance.now() - lastPointerActionAt < 450) {
        return;
      }
      if (item.dataset.shopDisabled === "true") {
        this.explainShopItemUnavailable(item.dataset.shopType, item.dataset.shopId);
        return;
      }
      this.activateShopItem(item.dataset.shopType, item.dataset.shopId);
    });

    this.shopItemsRoot.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      const item = getShopActionEl(event.target);
      if (!item) {
        return;
      }
      event.preventDefault();
      if (item.dataset.shopDisabled === "true") {
        this.explainShopItemUnavailable(item.dataset.shopType, item.dataset.shopId);
        return;
      }
      this.activateShopItem(item.dataset.shopType, item.dataset.shopId);
    });
  }

  explainShopItemUnavailable(shopType, shopId) {
    const item = getShopItems(this.state).find((entry) => entry.type === shopType && entry.id === shopId);
    if (!item) {
      this.state.lastMessage = "That shop item is unavailable.";
    } else if (item.equipped || item.status === "Equipped") {
      this.state.lastMessage = `${item.label} is already equipped.`;
    } else if (item.owned || item.status === "Owned") {
      this.state.lastMessage = `${item.label} is already owned.`;
    } else if (item.atMax || item.status === "Maxed") {
      this.state.lastMessage = `${item.label} is already maxed.`;
    } else if (item.atFullHealth || item.status === "Full Health") {
      this.state.lastMessage = "Health is already full.";
    } else if (!item.unlocked) {
      this.state.lastMessage = `${item.label} unlocks at wave ${item.unlockWave}.`;
    } else if (!item.affordable && Number.isFinite(item.cost)) {
      this.state.lastMessage = `Need ${item.cost} coins for ${item.label}. You have ${this.state.coins}.`;
    } else {
      this.state.lastMessage = `${item.label} is unavailable right now.`;
    }
    this.sfxCues.uiClick();
    this.updateHud();
  }

  activateShopItem(shopType, shopId) {
    let result = { ok: false };
    if (shopType === "weapon") {
      result = buyOrEquipWeapon(this.state, shopId);
    } else if (shopType === "armor") {
      result = buyOrEquipArmor(this.state, shopId);
    } else if (shopType === "grenade") {
      result = buyGrenadePack(this.state, shopId);
    } else if (shopType === "c4") {
      result = buyC4Pack(this.state, shopId);
    } else if (shopType === "nuke") {
      result = buyNukePack(this.state, shopId);
    } else if (shopType === "gear") {
      result = buyGearItem(this.state, shopId);
    } else if (shopType === "village") {
      result = buyVillageUpgrade(this.state);
    } else if (shopType === "medkit") {
      result = buyMedKit(this.state);
    }

    if (result?.ok) {
      this.sfxCues.shopBuy();
    } else {
      this.sfxCues.uiClick();
    }
    this.updateHud();
    this.renderShop();
    return result;
  }

  // Zero every movement/look input. Called on focus/visibility loss so a key or
  // touch that was "down" when focus left can't stay stuck (the matching keyup/
  // pointerup never fires in that case).
  _clearAllInput() {
    if (!this.input) return;
    this.input.forward = 0;
    this.input.back = 0;
    this.input.left = 0;
    this.input.right = 0;
    this.input.sprint = false;
    this.input.crouch = false;
    this.input.jump = false;
    this.input.ads = false;
    this.input.fire = false;
    this.input.dragLooking = false;
    this.input.lookTouch = null;
    this.input.lookVelX = 0;
    this.input.lookVelY = 0;
    // Release the virtual joystick if a touch was mid-drag.
    if (this._joystickPointerId != null) {
      this._joystickPointerId = null;
      this._joystickBase?.classList.remove("is-active");
      if (this._joystickKnob) this._joystickKnob.style.transform = "translate(-50%, -50%)";
    }
  }

  safeSetPointerCapture(target, pointerId) {
    try {
      target?.setPointerCapture?.(pointerId);
    } catch {
      // Some browser/test pointer streams are already released by the time the
      // handler runs. Capture is an input enhancement, not required for firing.
    }
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
        } else if (action === "fire") {
          this.input.fire = active;
          if (active) {
            this.unlockAudio();
            if (this.state.phase === "ready") {
              this.startOrContinueCampaign();
            }
            this.fire();
          }
        }
        button.classList.toggle("is-active", active);
      };
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        this.safeSetPointerCapture(button, event.pointerId);
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
    if (this._joystickBase) return; // already attached — guard against duplicate calls
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
      const frameRect = this.getGameFrameRect();
      const relX = (event.clientX - frameRect.left) / frameRect.width;
      const relY = (event.clientY - frameRect.top) / frameRect.height;
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

    this._on(window, "pointerdown", onPointerDown, { passive: false });
    this._on(window, "pointermove", onPointerMove, { passive: false });
    this._on(window, "pointerup", onPointerUp);
    this._on(window, "pointercancel", onPointerUp);
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

      this.safeSetPointerCapture(this.canvas, event.pointerId);
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
      const frameRect = this.getGameFrameRect();
      const vpW = frameRect.width || 360;
      const vpH = frameRect.height || 640;
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
    // Never recapture the cursor while an interactive overlay needs it.
    if (this._isUiOverlayOpen()) return;
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
    if (active && (event.code === "Enter" || event.code === "NumpadEnter" || event.code === "Space")) {
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
    if (event.code === "KeyE") {
      this.input.fire = active && !this._isUiOverlayOpen();
      if (active && !this._isUiOverlayOpen()) {
        event.preventDefault();
        this.fire();
      }
      return;
    }
    if (event.code === "KeyM" && active) this.toggleMiniMap();
    if (event.code === "Escape" && active && this.morePopover && !this.morePopover.hidden) { this.closeMorePopover(); return; }
    if (event.code === "Escape" && active && this.shopOpen) this.closeShop();
    if (event.code === "KeyF" && active) this.toggleFullscreen();
  }

  toggleShop() {
    if (this.state.phase === "secret_boss" || this.state.phase === "lost" || this.state.phase === "won") {
      this.shopOpen = false;
    } else {
      this.shopOpen = !this.shopOpen;
    }
    // Opening the shop mid-combat must free the cursor — otherwise the pointer
    // stays locked to the canvas for mouse-look and you can't click shop items.
    if (this.shopOpen) this._releasePointerLockForUi();
    this.sfxCues.uiClick();
    this.updateHud();
  }

  // Release pointer lock so the cursor is usable for an interactive overlay.
  _releasePointerLockForUi() {
    if (typeof document !== "undefined" && document.pointerLockElement === this.canvas) {
      document.exitPointerLock?.();
    }
  }

  // True when a DOM overlay needs a free cursor (shop or settings sheet).
  // Used to suppress pointer-lock re-grab + fire on stray canvas clicks that
  // land behind the overlay.
  _isUiOverlayOpen() {
    return Boolean(this.shopOpen || this._isSettingsOpen() || (this.morePopover && !this.morePopover.hidden));
  }

  _isSettingsOpen() {
    return Boolean(this.settingsSheet && !this.settingsSheet.hidden);
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
    // Kick off sample loading on first audio unlock (AudioContext is now live).
    if (this.audio.ctx && !this._samplesLoading) {
      this._samplesLoading = true;
      this.samples.loadAll(this.audio.ctx);
    }
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
    this.samples?.setMuted(settings.sfxEnabled === false);
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

  // ── Focus-trap helpers ────────────────────────────────────────────────────
  // _trapFocus(containerEl) — moves focus to the first focusable child and
  // intercepts Tab/Shift-Tab so focus cycles within `containerEl`. Also closes
  // the trap on Escape by calling `onEscape()`. Returns a teardown function.
  _trapFocus(containerEl, { onEscape } = {}) {
    const FOCUSABLE = 'button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])';
    const getFocusable = () => Array.from(containerEl.querySelectorAll(FOCUSABLE));
    const first = getFocusable()[0];
    if (first) first.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && onEscape) { onEscape(); return; }
      if (e.key !== 'Tab') return;
      const focusable = getFocusable();
      if (!focusable.length) { e.preventDefault(); return; }
      const idx = focusable.indexOf(document.activeElement);
      if (e.shiftKey) {
        // Shift-Tab: go to last if before first
        if (idx <= 0) { e.preventDefault(); focusable[focusable.length - 1].focus(); }
      } else {
        // Tab: wrap to first if at last
        if (idx === focusable.length - 1) { e.preventDefault(); focusable[0].focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    if (!this._focusTraps) this._focusTraps = [];
    const teardown = () => {
      document.removeEventListener('keydown', onKeyDown, true);
      const idx = this._focusTraps ? this._focusTraps.indexOf(teardown) : -1;
      if (idx !== -1) this._focusTraps.splice(idx, 1);
    };
    this._focusTraps.push(teardown);
    return teardown;
  }

  _releaseFocusTrap() {
    if (this._focusTraps && this._focusTraps.length > 0) {
      const teardown = this._focusTraps[this._focusTraps.length - 1];
      teardown();
    }
  }

  toggleHudSettings() {
    if (!this.settingsSheet) return;
    const isOpen = !this.settingsSheet.hidden;
    this.settingsSheet.hidden = isOpen;
    if (!isOpen) {
      // Opening: trap focus inside the card, Escape closes
      this._releasePointerLockForUi();
      // Capture the opener before _trapFocus moves focus into the dialog.
      this._settingsReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const card = this.settingsSheet.querySelector('.zi-settings-card');
      this._trapFocus(card ?? this.settingsSheet, {
        onEscape: () => this.toggleHudSettings(),
      });
    } else {
      // Closing: release trap and return focus to the ⚙ button
      this._releaseFocusTrap();
      const btn = this._settingsReturnFocus ?? this.root.querySelector('[data-action="hud-settings"]');
      btn?.focus();
      this._settingsReturnFocus = null;
    }
    this.sfxCues.uiClick();
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
    this.sfxCues.uiClick();
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
    this.sfxCues.uiClick();
    this.updateHud();
    if (this.shopOpen) {
      this.renderShop();
    }
  }

  selectWeaponByKey(code) {
    const slot = WEAPON_SLOT_BINDINGS.find((binding) => binding.code === code);
    if (!slot || slot.id === this.state.equippedWeaponId) return;
    equipOwnedWeapon(this.state, slot.id);
    this.sfxCues.uiClick();
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
      this.syncViewportFrame();
      this.scheduleViewportFrameSync();
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
      this.sfxCues.empty();
      this.updateHud();
      return;
    }
    // All shot audio (samples + synth fallback) respects the SFX toggle. The
    // sample manager plays straight to ctx.destination, so it bypasses audio3d's
    // own sfx gate — guard here or gunshots keep firing with SFX off.
    if (this.state.sfxEnabled !== false) {
      // Gunshot — try real sample first, fall back to synth profile
      if (!this.audio.ctx || !this.samples.playSample(
        Math.random() < 0.5 ? "gunshot-1" : "gunshot-2",
        this.audio.ctx,
        this.audio.ctx.destination,
        { gainScale: 0.82, pitchVariance: 1.2, gainVariance: 0.1 },
      )) {
        this.audio.playWeapon(this.state.equippedWeaponId, this.getAudioPositionAhead(2.4));
      }
      if (result.impact) {
        if (result.materialId === "soil") {
          // Soft terrain miss — low dirt thud, no hard concrete crack
          this.audio.playImpact("soil", this.getAudioPositionAhead(7));
        } else if (!this.audio.ctx || !this.samples.playSample("impact-concrete", this.audio.ctx, this.audio.ctx.destination, {
          gainScale: 0.5, pitchVariance: 2, gainVariance: 0.1,
        })) {
          // Bullet impact on structure — concrete/stone sample
          this.audio.playImpact(result.materialId ?? "concrete", this.getAudioPositionAhead(7));
        }
      } else if (result.hit) {
        // Bullet impact on zombie flesh
        if (!this.audio.ctx || !this.samples.playSample("impact-flesh", this.audio.ctx, this.audio.ctx.destination, {
          gainScale: 0.55, pitchVariance: 1.5, gainVariance: 0.1,
        })) {
          this.audio.playImpact("flesh", this.getAudioPositionAhead(7));
        }
      }
    }
    this.flashMuzzle(); // also caches _activeFireProfile
    this.spawnShotFx(result.hit, result);
    const weapon = getPlayCanvasWeaponSnapshot(this.state);
    // Use per-weapon camera kick multiplier from profile
    const _fireProf = this._activeFireProfile ?? this._getWeaponFireProfile(weapon.id);
    this.recoilPitchOffset = Math.min(8, (this.recoilPitchOffset ?? 0) + (weapon.recoilKick ?? 1.5) * _fireProf.camKick);

    // ── Juice effects on fire ────────────────────────────────────────────────
    // Per-weapon screen shake: profile.shake overrides the old flat value.
    // Blast weapons already get extra trauma via the result.blast block below.
    this._addShakeTrauma(result.blast ? _fireProf.shake * 1.4 : _fireProf.shake);
    // Haptics: short buzz on fire
    this._vibrate(8);

    if (result.hit) {
      // Hitmarker
      this._showHitmarker(result.killCount > 0, result.headshot);
      // Cue 1: hit confirm (non-kill hits only — kill has its own heavier cue)
      if (!result.killCount) this.sfxCues.hitConfirm();
      // Hit-confirm haptic
      this._vibrate(result.killCount > 0 ? [0, 10, 20, 30] : 15);
    }

    if (result.killCount > 0) {
      const coinsDelta = this.state.coins - coinsBefore;
      this._showKillFeedback(coinsDelta);
      this._updateStreak(result.killCount);
      // Cue 2: kill thud
      this.sfxCues.kill();
      // Cue 3: headshot ding (layered on kill)
      if (result.headshot) this.sfxCues.headshot();
      // Cue 6: coin ching when coins were awarded
      if (coinsDelta > 0) this.sfxCues.coin();
      // Kill haptic pattern
      this._vibrate([0, 15, 25, 45]);
    }

    if (result.blast) {
      // Extra blast stacking trauma from profile (RPG/GL get much bigger shakes)
      this._addShakeTrauma(_fireProf.shake * 0.8);
    }

    this.updateHud();
  }

  useActiveOrdnance() {
    const result = useOrdnance(this.state);
    if (result.ok) {
      if (result.lobbed) {
        // Grenade thrown — soft whoosh now; the blast FX fires when it lands
        // (driven by updateOrdnanceProjectiles draining detonation events).
        this.audio.playTone?.({ freq: 320, duration: 0.12, gain: 0.025, position: this.getAudioPositionAhead(1.5), type: "triangle" });
        this._vibrate(12);
      } else {
        this.audio.playExplosion(this.getAudioPositionAhead(10), result.ordnanceId);
        this.spawnBlastFx(result.ordnanceId);
        // Large blast shake + haptic
        const blastTrauma = result.ordnanceId === "nuke" ? 0.9 : result.ordnanceId === "c4" ? 0.7 : 0.55;
        this._addShakeTrauma(blastTrauma);
        this._vibrate([0, 20, 50, 60]);
      }
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
    const source = this.state.phase === "lost" ? "gameover" : "summary";
    const wave = this.state.waveSummary?.wave ?? this.state.waveNumber ?? null;
    this._recordRewardedAdEvent("offer_clicked", { offerId, claimKey, source, wave });
    let completed = false;
    let provider = "unknown";
    try {
      const result = await showRewardedAd({ globalScope: window });
      completed = Boolean(result?.completed);
      provider = result?.provider ?? "none";
    } catch {
      completed = false;
      provider = "error";
    }
    this._recordRewardedAdEvent(completed ? "ad_completed" : "ad_failed", { offerId, claimKey, source, wave, provider });
    if (completed) {
      const result = applyPlayCanvasRewardedOffer(this.state, offerId, claimKey);
      this._recordRewardedAdEvent(result.applied ? "reward_granted" : "reward_rejected", {
        offerId,
        claimKey,
        source,
        wave,
        provider,
        message: result.message,
        reward: result.reward ?? null,
      });
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

  _recordRewardedAdEvent(type, details = {}) {
    const event = recordPlayCanvasRewardedAdEvent(this.state, type, details);
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function" && typeof window.CustomEvent === "function") {
      window.dispatchEvent(new window.CustomEvent("zombie_invasion_rewarded_ad", { detail: event }));
    }
    return event;
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

  _dismissOnboarding() {
    if (this.onboardingOverlay) {
      this.onboardingOverlay.hidden = true;
    }
    this._onboardingVisible = false;
    // Release the focus trap that was set when the onboarding was shown.
    this._releaseFocusTrap();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('zi_onboarded', '1');
    }
    // Reveal the campaign modal again now that onboarding is gone.
    this.updateHud?.();
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
      tracer._sfxBallisticDrop = 0;
      tracer._sfxBallisticActualDrop = 0;
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

  // ── Per-weapon fire animation profiles ───────────────────────────────────────
  // Keyed by weapon id. Each field drives a distinct aspect of the firing feel.
  // Fields:
  //   kickback   — forward Z punch of the weaponRoot (cheaper guns: small, expensive: large)
  //   rise       — muzzle-climb pitch multiplier applied to weaponRoot euler X
  //   roll       — Z-roll snap on fire (lateral twist)
  //   lateral    — X-sway on fire (left/right jerk)
  //   duration   — total kick animation seconds (fast = snappy, slow = heavy)
  //   recover    — decay speed multiplier for recoilPitchOffset (>1 = faster return)
  //   flashSize  — base size of the muzzle-flash cross (0.12 = tiny → 0.55 = huge)
  //   flashWide  — horizontal arm width multiplier (1.0 = balanced, 2.0 = very wide)
  //   flashTtl   — flash duration multiplier (1.0 = default)
  //   shake      — per-shot screen-shake trauma added via _addShakeTrauma
  //   camKick    — camera recoilPitchOffset multiplier per shot
  //   actionAmt  — how far the action part travels (slide/pump/bolt travel distance)
  //   shells     — whether to spawn an ejected shell casing FX
  //   smoke      — whether to spawn a smoke puff on each shot
  //   smokeSz    — size of the smoke puff sphere
  // Cost tiers: pipe(0) · pistol(50) · revolver(120) · smg(220) · machine_pistol(300) ·
  //             rifle(420) · battle_rifle(560) · shotgun(620) · lmg(760) · dmr(840) ·
  //             sniper(980) · grenade_launcher(940) · rpg(1000) · flamethrower(1320)
  // Per-weapon fire feel (kick, flash, shells, smoke). Table hoisted to
  // module scope — it used to be rebuilt on every shot.
  _getWeaponFireProfile(weaponId) {
    return WEAPON_FIRE_PROFILES[weaponId] ?? WEAPON_FIRE_PROFILES.pistol; // safe default
  }

  flashMuzzle() {
    const weapon = getPlayCanvasWeaponSnapshot(this.state);
    const prof = this._getWeaponFireProfile(weapon.id);

    // Set kick parameters from profile
    this.weaponKickSec = prof.duration;
    this.weaponKickMaxSec = prof.duration;
    this.weaponKickPower = weapon.recoilKick; // still driven by game balance value
    // Store profile fields needed by updateWeaponVisuals
    this._activeFireProfile = prof;

    // Flamethrower uses the legacy rolling sphere; skip the star flash
    if (weapon.muzzleFx === "flame") {
      this.muzzleFlash.enabled = true;
      this.muzzleFlash.setLocalScale(0.22, 0.22, 0.22);
      this.muzzleFlash._sliceTtl = 0.1;
      this._spawnMuzzleLight(weapon);
      return;
    }

    // Smoke puff on qualifying weapons
    if (prof.smoke && prof.smokeSz > 0) {
      const muzzlePos = this.muzzleFlash.getPosition();
      const fwd = this.camera.forward;
      const puff = this._acquireFx("muzzle-puff", "sphere", "smokeGrey");
      puff.setLocalPosition(muzzlePos.x + fwd.x * 0.3, muzzlePos.y + fwd.y * 0.3 + 0.04, muzzlePos.z + fwd.z * 0.3);
      puff.setLocalScale(0.01, 0.01, 0.01);
      puff._sliceTtl = 0.32;
      puff._sliceMaxTtl = 0.32;
      puff._sliceExpand = true;
      puff._sliceStartScale = [0.01, 0.01, 0.01];
      puff._sliceBaseScale = [prof.smokeSz, prof.smokeSz, prof.smokeSz];
      this.fx.push(puff);
    }

    // Shell casing ejection (fast tiny box arcing right/up)
    if (prof.shells) {
      const muzzlePos = this.muzzleFlash.getPosition();
      const shell = this._acquireFx("shell", "box", "gunmetalLight");
      shell.setPosition(muzzlePos.x + 0.18, muzzlePos.y + 0.02, muzzlePos.z + 0.1);
      shell.setLocalScale(0.025, 0.008, 0.008);
      shell._sfxVelocity = {
        x: 2.4 + Math.random() * 1.2,
        y: 1.8 + Math.random() * 0.8,
        z: 0.4 + Math.random() * 0.4,
      };
      shell._sfxGravity = 6.5;
      shell._sliceTtl = 0.40;
      shell._sliceMaxTtl = 0.40;
      shell._sfxIsShell = true;
      this.fx.push(shell);
    }

    // Find a free flash slot (pick the one with lowest remaining TTL)
    const slot = this.shotFx.flashes.reduce((best, cur) => (cur._sfxTtl < best._sfxTtl ? cur : best));

    const flashSize = prof.flashSize;
    if (flashSize <= 0) {
      // No muzzle flash (e.g. pipe)
      this._spawnMuzzleLight(weapon);
      return;
    }

    const isBlast = weapon.muzzleFx === "blast";
    const isWide = weapon.muzzleFx === "wide-flash";
    const ttl = (this.fxSlowMo ? 10 : 1) * prof.flashTtl * (isBlast ? 0.09 : 0.065);
    const rollDeg = Math.random() * 360;

    // Use the muzzle flash entity's actual world position — it is a child of
    // weaponRoot (child of camera) and its local position is updated every frame
    // by updateWeaponVisuals() to match the active weapon's _muzzle offset.
    // getPosition() returns a live shared Vec3; clone it immediately.
    const muzzleWorldPos = this.muzzleFlash.getPosition().clone();

    slot.setPosition(muzzleWorldPos.x, muzzleWorldPos.y, muzzleWorldPos.z);
    slot.setEulerAngles(0, 0, rollDeg);
    slot.enabled = true;

    // Core sphere: small bright center
    slot._sfxCore.setLocalScale(flashSize * 0.55, flashSize * 0.55, flashSize * 0.55);
    slot._sfxCore.setLocalPosition(0, 0, 0);

    // Horizontal arm: width driven by profile flashWide
    const hWidth = isBlast ? flashSize * 3.2 : isWide ? flashSize * prof.flashWide : flashSize * prof.flashWide;
    slot._sfxArmH.setLocalScale(hWidth, flashSize * 0.14, flashSize * 0.14);
    slot._sfxArmH.setLocalPosition(0, 0, 0);
    slot._sfxArmH.setLocalEulerAngles(0, 0, 0);

    // Vertical arm: height
    const vHeight = isBlast ? flashSize * 2.4 : flashSize * (prof.flashWide * 0.8);
    slot._sfxArmV.setLocalScale(flashSize * 0.14, vHeight, flashSize * 0.14);
    slot._sfxArmV.setLocalPosition(0, 0, 0);
    slot._sfxArmV.setLocalEulerAngles(0, 0, 0);

    slot._sfxTtl = ttl;
    slot._sfxMaxTtl = ttl;
    slot._sfxBaseSize = flashSize;
    // Store peak arm dimensions so the collapse animation can read them
    slot._sfxArmHWidth = hWidth;
    slot._sfxArmVHeight = vHeight;

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
    // The sim resolves where a clean miss meets terrain — use that so tracer and
    // dirt puff land where the round actually went.
    if (typeof result.impactDistance === "number") {
      return result.impactDistance;
    }
    // Structure hit or miss — use a fixed distance representative of max effective range
    return hit ? 8 : 22;
  }

  _spawnTracer(weapon, forward, origin, hit, result, isPellet) {
    // Source the muzzle world position from the actual muzzle flash entity.
    // updateWeaponVisuals() keeps its local position synced to the active weapon's
    // _muzzle offset each frame, so getPosition() returns the true barrel tip in
    // world space.  Clone immediately — PlayCanvas reuses the Vec3 internally.
    const muzzlePos = this.muzzleFlash.getPosition().clone();
    const muzzleWorld = { x: muzzlePos.x, y: muzzlePos.y, z: muzzlePos.z };

    const impactDist = this._resolveImpactDistance(hit, result);
    // Clamp trace length: pellets spread further, others cap at 40u
    const traceLen = isPellet ? Math.min(impactDist, 14) : Math.min(impactDist, 40);
    if (traceLen < 0.5) return;

    const ballisticDrop = computeBallisticTracerDrop(result.ballistic, traceLen);
    const actualDrop = Number(result.ballistic?.dropMeters ?? 0);

    // Midpoint of tracer segment. Ballistic shots get a subtle visual sag so
    // the PlayCanvas route reads less like a perfectly flat hitscan beam.
    const midX = muzzleWorld.x + forward.x * traceLen * 0.5;
    const midY = muzzleWorld.y + forward.y * traceLen * 0.5 - ballisticDrop * 0.5;
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
    slot._sfxBallisticDrop = ballisticDrop;
    slot._sfxBallisticActualDrop = Number.isFinite(actualDrop) ? actualDrop : 0;
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

    // Impact world position. A clean terrain miss kicks up dirt on the ground,
    // so pin it to ground level rather than tracing the ray into the sky.
    const isGroundMiss = !result.hit && isSoil;
    const ix = origin.x + forward.x * distance;
    const iy = isGroundMiss ? 0.06 : Math.max(0.05, origin.y + forward.y * distance);
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


  spawnBlastFx(ordnanceId, center = null) {
    // Blast centre: explicit landing point for lobbed grenades, else a bit
    // ahead of the player on the ground (placed C4 / nuke strike).
    let cx;
    let cz;
    if (center) {
      cx = center.x;
      cz = center.z;
    } else {
      const forward = this.camera.forward.clone();
      const origin = this.camera.getPosition().clone();
      const dist = ordnanceId === "nuke" ? 13 : ordnanceId === "c4" ? 9 : 9;
      cx = origin.x + forward.x * dist;
      cz = origin.z + forward.z * dist;
    }

    // Lingering scorch mark on the street where the blast landed.
    this._spawnGroundDecal("scorch", cx, cz, ordnanceId === "nuke" ? 4.6 : ordnanceId === "c4" ? 2.6 : 2.0);
    // Per-ordnance blast radius.
    const R = ordnanceId === "nuke" ? 8.5 : ordnanceId === "c4" ? 4.6 : 3.2;
    const seq = Math.round(performance.now());

    // 1) Core fireball — expands fast + fades.
    const core = this.addPrimitive(`blast-core-${seq}`, "sphere", [cx, 1.1, cz], [0.3, 0.3, 0.3], "blastFire");
    core._sliceTtl = 0.45; core._sliceMaxTtl = 0.45; core._sliceExpand = true;
    core._sliceStartScale = [0.4, 0.4, 0.4]; core._sliceBaseScale = [R * 1.5, R * 1.5, R * 1.5];
    core._sliceFadeFrom = 0.95;
    this.fx.push(core);

    // 2) Smoke ball — bigger, slower, lingers behind the fire.
    const smoke = this.addPrimitive(`blast-smoke-${seq}`, "sphere", [cx, 1.4, cz], [0.5, 0.5, 0.5], "blastSmoke");
    smoke._sliceTtl = 0.9; smoke._sliceMaxTtl = 0.9; smoke._sliceExpand = true;
    smoke._sliceStartScale = [0.6, 0.6, 0.6]; smoke._sliceBaseScale = [R * 1.7, R * 1.5, R * 1.7];
    smoke._sliceFadeFrom = 0.55;
    this.fx.push(smoke);

    // 3) Ground shockwave ring — flat disc that expands outward.
    const ring = this.addPrimitive(`blast-ring-${seq}`, "cylinder", [cx, 0.18, cz], [0.6, 0.06, 0.6], "blastRing");
    ring._sliceTtl = 0.5; ring._sliceMaxTtl = 0.5; ring._sliceExpand = true;
    ring._sliceStartScale = [0.6, 0.06, 0.6]; ring._sliceBaseScale = [R * 2.4, 0.06, R * 2.4];
    ring._sliceFadeFrom = 0.8;
    this.fx.push(ring);

    // 4) Ember sparks flying outward (with gravity).
    const emberCount = ordnanceId === "nuke" ? 16 : 10;
    for (let i = 0; i < emberCount; i += 1) {
      const ang = (i / emberCount) * Math.PI * 2 + (seq % 7);
      const spd = R * (1.8 + (i % 3) * 0.6);
      const ember = this.addPrimitive(`blast-ember-${seq}-${i}`, "box", [cx, 1.0, cz], [0.18, 0.18, 0.18], "blastEmber");
      ember._sliceTtl = 0.55; ember._sliceMaxTtl = 0.55; ember._sliceExpand = true;
      ember._sliceStartScale = [0.22, 0.22, 0.22]; ember._sliceBaseScale = [0.05, 0.05, 0.05];
      ember._sliceFadeFrom = 1;
      ember._sliceVel = [Math.cos(ang) * spd, 3.2 + (i % 4), Math.sin(ang) * spd];
      this.fx.push(ember);
    }

    // 5) Bright flash light at the blast.
    const flash = new pc.Entity(`blast-light-${seq}`);
    flash.addComponent("light", {
      type: "omni",
      color: new pc.Color(1, 0.6, 0.25),
      intensity: ordnanceId === "nuke" ? 10 : 6,
      range: R * 3,
      castShadows: false,
    });
    flash.setLocalPosition(cx, 1.4, cz);
    this.app.root.addChild(flash);
    flash._sliceTtl = 0.3;
    const fadeLight = () => {
      flash._sliceTtl -= 1 / 60;
      if (flash.light) flash.light.intensity = Math.max(0, (ordnanceId === "nuke" ? 10 : 6) * (flash._sliceTtl / 0.3));
      if (this._disposed) { flash.destroy(); return; }
      if (flash._sliceTtl > 0) { requestAnimationFrame(fadeLight); } else { flash.destroy(); }
    };
    requestAnimationFrame(fadeLight);
  }

  updateOrdnanceProjectiles(dt) {
    // 1) Drain detonations → blast FX, audio, and distance-attenuated shake.
    const detonations = consumePlayCanvasOrdnanceDetonations(this.state);
    for (const det of detonations) {
      this.spawnBlastFx(det.ordnanceId, { x: det.x, y: det.y, z: det.z });
      this.audio.playExplosion({ x: det.x, y: Math.max(0.4, det.y), z: det.z }, det.ordnanceId);
      const dist = Math.hypot(det.x - this.state.player.x, det.z - this.state.player.z);
      const atten = Math.max(0.2, 1 - dist / 26);
      this._addShakeTrauma(0.5 * atten);
      this._vibrate([0, 16, 36, 48]);
    }

    // 2) Render live grenades: one tumbling entity + smoke trail per projectile.
    const projectiles = getPlayCanvasOrdnanceProjectiles(this.state);
    const liveIds = new Set();
    for (const p of projectiles) {
      liveIds.add(p.id);
      let entity = this.ordnanceEntitiesById.get(p.id);
      if (!entity) {
        const size = Math.max(0.18, (p.projectileRadius ?? 0.1) * 3.2);
        entity = this.addPrimitive(`ordnance-${p.id}`, "sphere", [p.x, p.y, p.z], [size, size, size], "metal");
        const light = new pc.Entity(`ordnance-light-${p.id}`);
        light.addComponent("light", { type: "omni", color: new pc.Color(1, 0.7, 0.35), intensity: 1.3, range: 3.0, castShadows: false });
        entity.addChild(light);
        entity._trailCdSec = 0;
        this.ordnanceEntitiesById.set(p.id, entity);
      }
      entity.setLocalPosition(p.x, p.y, p.z);
      const rot = entity.getEulerAngles();
      entity.setEulerAngles(rot.x + 420 * dt, rot.y + 260 * dt, 0); // tumble in flight
      entity._trailCdSec -= dt;
      if (entity._trailCdSec <= 0) {
        entity._trailCdSec = 0.035;
        const puff = this._acquireFx("trail-puff", "sphere", "blastSmoke");
        puff.setLocalPosition(p.x, p.y, p.z);
        puff.setLocalScale(0.12, 0.12, 0.12);
        puff._sliceTtl = 0.34; puff._sliceMaxTtl = 0.34; puff._sliceExpand = true;
        puff._sliceStartScale = [0.12, 0.12, 0.12]; puff._sliceBaseScale = [0.03, 0.03, 0.03];
        puff._sliceFadeFrom = 0.5;
        this.fx.push(puff);
      }
    }
    // Destroy entities whose grenade has detonated/left play.
    for (const [id, entity] of this.ordnanceEntitiesById) {
      if (!liveIds.has(id)) {
        entity.destroy();
        this.ordnanceEntitiesById.delete(id);
      }
    }
  }

  clearOrdnanceEntities() {
    for (const entity of this.ordnanceEntitiesById.values()) {
      entity.destroy();
    }
    this.ordnanceEntitiesById.clear();
  }

  reset() {
    this.state = resetSlice();
    this.audio.setMusicEnabled(this.state.musicEnabled);
    this.audio.setSfxEnabled(this.state.sfxEnabled);
    this.clearZombieEntities();
    this.clearFireEntities();
    this.clearImpactEntities();
    this.clearOrdnanceEntities();
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
    this.clearOrdnanceEntities();
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
      // Telegraph rings are parented to app.root (they must hug the ground
      // while the body lifts), so destroying the zombie entity alone leaked
      // one ring per zombie every reset.
      entity._telegraphRing?.destroy();
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
    this.sfxCues.resetHeartbeat();
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
    if (this.state.musicEnabled !== this._lastMusicEnabled) {
      this.audio.setMusicEnabled(this.state.musicEnabled);
      this._lastMusicEnabled = this.state.musicEnabled;
    }
    if (this.state.sfxEnabled !== this._lastSfxEnabled) {
      this.audio.setSfxEnabled(this.state.sfxEnabled);
      this._lastSfxEnabled = this.state.sfxEnabled;
    }
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
    if (this._disposed) return;
    this.recordPerformanceTelemetry(dt);
    const gameplayPausedByUi = this._isUiOverlayOpen();
    const frameDt = gameplayPausedByUi ? 0 : dt;
    this._lastUpdateDt = frameDt;
    // Drive CameraFrame post-processing (bloom, tone mapping compose) each frame.
    // cf.update() must be called before the PlayCanvas render tick processes the passes.
    this.cameraFrame?.update();
    const previousVillageHp = this.state.villageHp;
    const previousPlayerHp = this.state.playerHp;
    this.state.player.pitch = this.pitch;
    // Apply right-zone touch look velocity — only when there's an active look touch
    // and the pointer isn't locked (pointer-lock path uses handleLookMove).
    if (!gameplayPausedByUi && this.input.lookTouch !== null && !this.input.pointerLocked) {
      const frameRect = this.getGameFrameRect();
      const vpW = frameRect.width || 360;
      const vpH = frameRect.height || 640;
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
    // Clamp dt to a sane positive range: never advance the sim backwards (a
    // negative/NaN frame delta would inflate countdown timers like the wave
    // grace) and never take a huge step after a tab stall.
    if (!gameplayPausedByUi) {
      if (this.input.fire && getPlayCanvasWeaponSnapshot(this.state).fireMode === "automatic") {
        this.fire();
      }
      const simulationDt = Number.isFinite(frameDt) && frameDt > 0 ? Math.min(frameDt, 0.15) : 0;
      stepSlice(this.state, this.input, simulationDt);
    }
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
      this.sfxCues.reloadStart();
    } else if (wasReloading && !this.state.pendingReload) {
      this.sfxCues.reloadFinish();
    }
    this._wasReloading = this.state.pendingReload;
    this.trackAudioDamage(previousVillageHp, previousPlayerHp);
    // Throttle the audible/physical bite feedback so being swarmed by many
    // zombies doesn't machine-gun groans + screen shake. The visual flash
    // stays per-hit (it's brief and reads as "I'm getting hurt").
    this._playerHurtFxCdSec = Math.max(0, (this._playerHurtFxCdSec ?? 0) - frameDt);
    if (this.state.playerHp < previousPlayerHp - 0.1) {
      this.playerDamageFlashSec = 0.45;
      if (this._playerHurtFxCdSec <= 0) {
        this._addShakeTrauma(0.3);
        this._vibrate(45);
        this.sfxCues.playerDamage();
        this._playerHurtFxCdSec = 0.7;
      }
    }
    if (this.state.villageHp < previousVillageHp - 0.1) {
      this.villageDamageFlashSec = 0.45;
    }
    this.playerDamageFlashSec = Math.max(0, (this.playerDamageFlashSec ?? 0) - frameDt);
    this.villageDamageFlashSec = Math.max(0, (this.villageDamageFlashSec ?? 0) - frameDt);
    this.recoilPitchOffset = Math.max(0, (this.recoilPitchOffset ?? 0) - frameDt * 6);
    this.weaponKickSec = Math.max(0, (this.weaponKickSec ?? 0) - frameDt);
    // Juice: decay shake, update vignette
    this._decayShake(frameDt);
    this._updateVignette(this.state.playerHp);
    // Cue 8: low-health heartbeat
    if (this.state.playerHp < 25 && this.state.phase === "running") {
      this.sfxCues.heartbeatTick(frameDt, this.state.playerHp);
    } else {
      this.sfxCues.resetHeartbeat();
    }
    // Cue 10: ambient night bed — start on first wave, stop when not in active play
    // The cricket ambience is a sound effect, so it follows the SFX toggle —
    // turning SFX off stops it within a frame (it used to keep playing because
    // it was gated on music and routed past both gain nodes).
    const bedShouldRun =
      (this.state.phase === "running" || this.state.phase === "intermission") &&
      this.state.sfxEnabled !== false;
    if (bedShouldRun && !this._nightBedRunning) {
      this._startNightBed();
    } else if (!bedShouldRun && this._nightBedRunning) {
      this._stopNightBed();
    }
    // Zombie ambient groans — emit from a random live nearby zombie ~every 4s
    this._zombieGroanCooldownSec = Math.max(0, (this._zombieGroanCooldownSec ?? 0) - frameDt);
    if (this.state.sfxEnabled !== false && this.state.phase === "running" && this._zombieGroanCooldownSec <= 0 && this.audio.ctx) {
      const liveZombies = this.state.zombies.filter((z) => !z.dead);
      if (liveZombies.length > 0) {
        const randomZombie = liveZombies[Math.floor(Math.random() * liveZombies.length)];
        const groanId = `zombie-groan-${1 + Math.floor(Math.random() * 3)}`;
        const played = this.samples.playSample(groanId, this.audio.ctx, this.audio.ctx.destination, {
          gainScale: 0.16, pitchVariance: 3, gainVariance: 0.08,
        });
        if (played) {
          // Vary cooldown 5–8s so ambient groans stay sparse, even in a swarm
          this._zombieGroanCooldownSec = 5 + Math.random() * 3;
        }
      }
    }
    this.summaryDisplaySec = Math.max(0, (this.summaryDisplaySec ?? 0) - frameDt);
    if (this.state.phase === "intermission" && this.lastSummaryWave !== this.state.waveNumber) {
      this.lastSummaryWave = this.state.waveNumber;
      this.summaryDisplaySec = 4.0;
      // Wave-1 shop nudge — fires once ever (gated by zi_shop_nudged localStorage flag)
      if (this.state.waveNumber === 1 && !this._shopNudgeFired) {
        this._shopNudgeFired = true;
        const alreadyNudged = typeof localStorage !== 'undefined' && localStorage.getItem('zi_shop_nudged') === '1';
        if (!alreadyNudged) {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('zi_shop_nudged', '1');
          }
          // Show after a short delay so the wave-clear summary is visible first
          setTimeout(() => {
            if (this._disposed) return;
            this._showGoalToast('Spend your coins in the Shop between waves!');
          }, 4200);
        }
      }
    }
    if (this.graceOverlay) {
      const graceActive = (this.state.waveGraceSec ?? 0) > 0;
      this.graceOverlay.hidden = !graceActive;
      if (graceActive && this.graceCountdown) {
        this.graceCountdown.textContent = String(Math.ceil(this.state.waveGraceSec));
      }
    }
    if (this.summaryOverlay) {
      // The intermission "Regroup" flow card already presents the wave-clear
      // summary, so suppress the separate overlay there to avoid two stacked
      // panels. (summaryDisplaySec is only set at intermission today, so this
      // effectively retires the redundant overlay.)
      const show = this.summaryDisplaySec > 0 && this.state.waveSummary && this.state.phase !== "intermission";
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
    this.updateCamera(frameDt);
    this._updateSky(frameDt);
    this._updateAtmosphere(frameDt);
    this.updateAudioState(frameDt);
    this.updateWeaponVisuals();
    this.updateZombies(frameDt);
    this.updateVillagers(frameDt);
    this.updateOrdnanceProjectiles(frameDt);
    this.updateLandscapeMutationVisuals();
    this.updateWindowImpactVisuals();
    this.updateVillageStructureVisuals(frameDt);
    this.updateVillageDistress(frameDt);
    this.updateGearVisuals();
    this.drawMiniMap();
    this.updateFx(frameDt);
    this.updateHud();
  }

  recordPerformanceTelemetry(dt) {
    const frameMs = Math.max(0, Math.min(1000, Number(dt) * 1000 || 0));
    if (frameMs <= 0) return;
    const perf = this.performanceTelemetry;
    perf.frameCount += 1;
    perf.lastFrameMs = frameMs;
    perf.worstFrameMs = Math.max(perf.worstFrameMs, frameMs);
    if (frameMs > 50) {
      perf.slowFrames += 1;
    }
    if (perf.frameMsAvg <= 0) {
      perf.frameMsAvg = frameMs;
    } else {
      perf.frameMsAvg += (frameMs - perf.frameMsAvg) * 0.08;
    }
    perf.fpsAvg = perf.frameMsAvg > 0 ? 1000 / perf.frameMsAvg : 0;
  }

  updateCamera(dt = 0) {
    const player = this.state.player;
    const eyeHeight = player.crouching ? 1.3 : 1.62;
    const jumpY = player.y ?? 0;

    // ── Locomotion feel: walk bob + landing dip (reduced-motion aware) ──────
    // The view used to be dead-still while moving; a small stride-locked bob
    // plus a dip when landing from a fall makes locomotion read as footsteps
    // instead of a gliding tripod.
    let bobY = 0;
    let bobLateral = 0;
    if (!this._reducedMotion && dt > 0) {
      const dx = player.x - (this._camPrevX ?? player.x);
      const dz = player.z - (this._camPrevZ ?? player.z);
      const speed = Math.hypot(dx, dz) / dt;
      const speedRatio = Math.min(1, speed / 6);
      if (speed > 0.4 && player.onGround) {
        this._bobPhase = (this._bobPhase ?? 0) + dt * (7 + speedRatio * 4);
        this._bobBlend = Math.min(1, (this._bobBlend ?? 0) + dt * 5);
      } else {
        this._bobBlend = Math.max(0, (this._bobBlend ?? 0) - dt * 7);
      }
      const amp = (this._bobBlend ?? 0) * (0.02 + speedRatio * 0.025);
      bobY = -Math.abs(Math.sin(this._bobPhase ?? 0)) * amp; // step rhythm dips down
      bobLateral = Math.cos((this._bobPhase ?? 0) * 0.5) * amp * 0.7;
      // Landing dip: brief knee-bend of the eye line after a real fall.
      if (!(this._camPrevOnGround ?? true) && player.onGround && (this._camPrevYVel ?? 0) < -3) {
        this._landDipSec = 0.2;
        this._landDipDepth = Math.min(0.2, Math.abs(this._camPrevYVel ?? 0) * 0.014);
      }
      if ((this._landDipSec ?? 0) > 0) {
        this._landDipSec = Math.max(0, this._landDipSec - dt);
        const t = 1 - this._landDipSec / 0.2;
        bobY -= Math.sin(t * Math.PI) * (this._landDipDepth ?? 0.1);
      }
    }
    this._camPrevX = player.x;
    this._camPrevZ = player.z;
    this._camPrevOnGround = player.onGround ?? true;
    this._camPrevYVel = player.yVelocity ?? 0;

    // ── Stance FOV: ADS zooms in, sprint widens (sim owns the targets) ──────
    const cam = this.camera?.camera;
    if (cam && dt > 0) {
      const targetFov = getPlayCanvasTargetFov(this.state);
      const ease = this._reducedMotion ? 1 : Math.min(1, dt * 9);
      cam.fov += (targetFov - cam.fov) * ease;
    }

    // Lateral bob is applied along the camera-right axis (cos, -sin).
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);
    this.camera.setLocalPosition(
      player.x + rightX * bobLateral,
      eyeHeight + jumpY + bobY,
      player.z + rightZ * bobLateral,
    );
    const pitchWithRecoil = this.pitch - (this.recoilPitchOffset ?? 0);
    // Additive screen shake — trauma^2 model, reduced-motion aware
    const [shakePitch, shakeYaw] = this._computeShakeOffset();
    this.camera.setEulerAngles(
      pitchWithRecoil + shakePitch,
      this.yaw * pc.math.RAD_TO_DEG + shakeYaw,
      0
    );
  }

  // Yaw follows the simulation-owned navigation point. That point may be the
  // player, a gate waypoint, or the selected building perimeter.
  resolveZombieYawDeg(entity, zombie, dt) {
    const tx = Number(zombie.navTargetX ?? this.state.player.x) - zombie.x;
    const tz = Number(zombie.navTargetZ ?? this.state.player.z) - zombie.z;
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

  // Drop a pooled ground decal (blood splat on kills, scorch ring on blasts).
  // Decals persist ~9-12s then fade — kills leave a mark on the street instead
  // of evaporating with the body. depthWrite is already off for these
  // materials; the y jitter keeps overlapping decals from z-fighting.
  _spawnGroundDecal(kind, x, z, size) {
    this._decalSeq = (this._decalSeq ?? 0) + 1;
    const decal = this._acquireFx(kind, "cylinder", kind === "blood" ? "bloodDecal" : "scorchDecal");
    decal.setLocalPosition(x, 0.016 + (this._decalSeq % 7) * 0.0022, z);
    decal.setLocalScale(size, 0.01, size);
    decal.setEulerAngles(0, (this._decalSeq * 53) % 360, 0);
    const ttl = kind === "blood" ? 9 : 12;
    decal._sliceTtl = ttl;
    decal._sliceMaxTtl = ttl;
    decal._sfxIsDecal = true;
    decal._sfxDecalOpacity = kind === "blood" ? 0.8 : 0.72;
    this.fx.push(decal);
  }

  // Scale factor for the spawn-in window (see SPAWN_IN_SEC). Returns 1 once
  // grown, immediately 1 under reduced motion.
  _spawnInScale(entity, dt) {
    if (this._reducedMotion) return 1;
    if (entity._spawnInSec === undefined) entity._spawnInSec = PlayCanvasZombieSlice.SPAWN_IN_SEC;
    if (entity._spawnInSec <= 0) return 1;
    entity._spawnInSec = Math.max(0, entity._spawnInSec - dt);
    const t = 1 - entity._spawnInSec / PlayCanvasZombieSlice.SPAWN_IN_SEC;
    return 0.15 + 0.85 * t * t; // ease-in growth
  }

  updateZombies(dt = 0) {
    let liveCount = 0;
    for (const zombie of this.state.zombies) {
      if (!zombie.dead) liveCount += 1;
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

      // First frame of death → leave a blood splat on the street (covers every
      // kill source: gunfire, blasts, fire patches).
      if (zombie.dead && !entity._bloodDecalDone) {
        entity._bloodDecalDone = true;
        const heavy = zombie.type === "mega_zombie" || zombie.type === "secret_boss" ||
          zombie.type === "mini_boss" || zombie.type === "juggernaut" || zombie.type === "brute";
        this._spawnGroundDecal("blood", zombie.x, zombie.z, (heavy ? 1.7 : 0.85) + ((this._decalSeq ?? 0) % 5) * 0.08);
      }

      if (entity._glb) {
        // ── GLB path ──────────────────────────────────────────────────────────
        entity.enabled = true; // always keep root enabled; fade logic disables after completion
        entity.setLocalPosition(zombie.x, zombieY, zombie.z);

        if (zombie.dead) {
          // ── Death fade lifecycle ─────────────────────────────────────────────
          // Phase 1 (0–1.5 s): death animation plays, no visual change.
          // Phase 2 (1.5–2.7 s, 1.2 s duration): sink 0.4 m + shrink to 0.
          // After 2.7 s: disable entity.
          const FADE_START = 1.5;
          const FADE_DUR   = 1.2;
          const FADE_END   = FADE_START + FADE_DUR;
          if (entity._deathFadeSec === undefined) entity._deathFadeSec = 0;
          entity._deathFadeSec += dt;

          if (entity._deathFadeSec >= FADE_END) {
            entity.enabled = false;
          } else if (entity._deathFadeSec >= FADE_START) {
            const t = (entity._deathFadeSec - FADE_START) / FADE_DUR; // 0→1
            const scale = 1.0 - t;
            const sinkY  = -t * 0.4;
            entity.setLocalPosition(zombie.x, sinkY, zombie.z);
            entity.setLocalScale(scale, scale, scale);
            // Fade shadow opacity
            const glbShadow = entity._glb?.shadow;
            if (glbShadow) {
              const shadowMat = glbShadow.render?.meshInstances?.[0]?.material;
              if (shadowMat) {
                shadowMat.opacity = Math.max(0, 0.55 * (1 - t));
                shadowMat.update();
              }
            }
          }
          // Always drive death animation.
          // Animals use animateAnimalGlbEntity; humanoid GLB uses animateZombieGlbEntity.
          if (entity._glb?.isAnimal) {
            animateAnimalGlbEntity(entity, zombie, this.state.elapsedSec);
          } else {
            animateZombieGlbEntity(entity, zombie, this.state.elapsedSec);
          }
          // Bloom coronas off while dead (animals have no bloom coronas)
          if (entity._bloomCoronaL) entity._bloomCoronaL.enabled = false;
          if (entity._bloomCoronaR) entity._bloomCoronaR.enabled = false;
        } else {
          // ── Living zombie ────────────────────────────────────────────────────
          entity._deathFadeSec = undefined; // reset in case entity is reused
          // All Quaternius animal models (and humanoid) face +Z at rest (opposite the -Z
          // forward convention), hence the 180° yaw offset applies to animals too.
          const telegraphing = (zombie.telegraphSec ?? 0) > 0 || zombie.bitePhase === "windup" || (zombie.structureAttackSec ?? 0) > 0;
          // Wind-up crouch: squash Y slightly during telegraph
          const yScale = telegraphing ? 0.85 : 1.0;
          entity.setLocalEulerAngles(0, this.resolveZombieYawDeg(entity, zombie, dt) + 180, 0);
          const spawnK = this._spawnInScale(entity, dt);
          entity.setLocalScale(spawnK, yScale * spawnK, spawnK);
          if (entity._glb?.isAnimal) {
            animateAnimalGlbEntity(entity, zombie, this.state.elapsedSec);
          } else {
            animateZombieGlbEntity(entity, zombie, this.state.elapsedSec);
          }
          // Per-zombie hit-freeze: the sim already halts movement during
          // hitStunSec; freezing the AnimComponent makes the impact read.
          // The animator rewrites anim.speed every frame, so the freeze is
          // re-applied after it and recovers by itself on the next
          // unstunned frame.
          const glbAnim = entity._glb?.modelEntity?.anim;
          if (glbAnim && (zombie.hitStunSec ?? 0) > 0) {
            glbAnim.speed = 0;
          }
          // Keep blob shadow fixed at ground level (y=0) even when body lifts.
          const glbShadow = entity._glb?.shadow;
          if (glbShadow && zombieY > 0) {
            glbShadow.setLocalPosition(0, -zombieY + 0.03, 0);
          } else if (glbShadow) {
            glbShadow.setLocalPosition(0, 0.03, 0);
          }
          // Sync bloom coronas to GLB eye positions (set by animateZombieGlbEntity above).
          // Cache eye entities on first lookup — findByName walks the full tree.
          if (entity._eyeL === undefined) {
            entity._eyeL = entity.findByName("glb-eye-l") || null;
            entity._eyeR = entity.findByName("glb-eye-r") || null;
          }
          if (entity._bloomCoronaL && entity._eyeL) {
            entity._bloomCoronaL.setLocalPosition(entity._eyeL.getLocalPosition());
            entity._bloomCoronaL.enabled = true;
          }
          if (entity._bloomCoronaR && entity._eyeR) {
            entity._bloomCoronaR.setLocalPosition(entity._eyeR.getLocalPosition());
            entity._bloomCoronaR.enabled = true;
          }
          // Menace cue: eye coronas flare up to ~1.7× as the zombie closes the
          // last 10m to the player. Transform-only (no material writes).
          if (entity._bloomCoronaL || entity._bloomCoronaR) {
            const eyeDist = Math.hypot(this.state.player.x - zombie.x, this.state.player.z - zombie.z);
            const flare = 1 + Math.max(0, (10 - eyeDist) / 10) * 0.7;
            for (const corona of [entity._bloomCoronaL, entity._bloomCoronaR]) {
              if (!corona) continue;
              if (corona._baseCoronaScale === undefined) {
                corona._baseCoronaScale = corona.getLocalScale().x;
              }
              const cs = corona._baseCoronaScale * flare;
              corona.setLocalScale(cs, cs, cs);
            }
          }
        }
      } else {
        // ── Procedural rig path ───────────────────────────────────────────────
        if (zombie.dead) {
          // Death fade: sink + shrink over 1.2 s then disable.
          // No death animation on the procedural rig — immediately start fading.
          const FADE_DUR = 1.2;
          if (entity._deathFadeSec === undefined) entity._deathFadeSec = 0;
          entity._deathFadeSec += dt;

          if (entity._deathFadeSec >= FADE_DUR) {
            entity.enabled = false;
          } else {
            entity.enabled = true;
            const t     = entity._deathFadeSec / FADE_DUR; // 0→1
            const scale = 1.0 - t;
            const sinkY  = -t * 0.4;
            // Topple: pitch the whole rig over (fast at first, easing out) so
            // the death reads as a fall rather than a shrink-in-place.
            const topple = this._reducedMotion ? 0 : Math.min(1, t * 1.6) * 80;
            entity.setLocalPosition(zombie.x, sinkY, zombie.z);
            entity.setLocalEulerAngles(topple, entity._yawDeg ?? 0, 0);
            entity.setLocalScale(scale, scale, scale);
            // Apply rig materials WITHOUT hit flash tint (dead = normal color)
            const skinMat    = entity._rig?.skinMat ?? "zombieFlesh";
            const shirtMatKey = entity._rig?.shirtMatKey ?? "zombieShirtGrey";
            applyZombieRigMaterials(entity, this.materials, skinMat, shirtMatKey, false);
          }
          continue;
        }
        entity._deathFadeSec = undefined;
        entity.enabled = true;
        entity.setLocalPosition(zombie.x, zombieY, zombie.z);
        entity.setLocalEulerAngles(0, this.resolveZombieYawDeg(entity, zombie, dt), 0);
        // Wind-up crouch: squash Y during telegraph
        const telegraphing = (zombie.telegraphSec ?? 0) > 0 || zombie.bitePhase === "windup" || (zombie.structureAttackSec ?? 0) > 0;
        const spawnK = this._spawnInScale(entity, dt);
        entity.setLocalScale(spawnK, (telegraphing ? 0.85 : 1.0) * spawnK, spawnK);
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
        // Per-zombie hit-freeze: the rig is a stateless pose function of the
        // passed time, so simply not driving it holds the current pose for
        // the stun window (materials above keep flashing).
        if ((zombie.hitStunSec ?? 0) <= 0) {
          animateZombieRig(entity, zombie, this.state.elapsedSec);
        }
      }
    }
    // Cached for updateHud — avoids a fresh filter() allocation every frame.
    this._liveZombieCount = liveCount;

    // Orphan sweep: if the sim ever drops a zombie from state.zombies without
    // a full clear, its entity would otherwise linger frozen in its last pose
    // until the next wave reset. Size mismatch is the cheap trigger.
    if (this.entitiesByZombie.size > this.state.zombies.length) {
      const liveIds = new Set();
      for (const z of this.state.zombies) liveIds.add(z.id);
      for (const [id, entity] of this.entitiesByZombie) {
        if (!liveIds.has(id)) {
          entity._telegraphRing?.destroy();
          entity.destroy();
          this.entitiesByZombie.delete(id);
        }
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
    const biteActive = zombie.bitePhase === "windup";
    const specialActive = (telegType === "pounce" || telegType === "slam") &&
      (telegSec > 0 || (zombie.pounceSec ?? 0) > 0);
    const active = biteActive || specialActive;

    if (!entity._telegraphRing) {
      // Build a thin flat cylinder (disc) as a ground ring
      const ring = new pc.Entity(`telegraph-${zombie.id}`);
      const mat = new pc.StandardMaterial();
      mat.emissive = new pc.Color(0.88, 0.54, 0.0);
      mat.emissiveIntensity = 4.5;
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
      const targetLocked = telegType === "pounce" || telegType === "slam";
      ring.setLocalPosition(
        targetLocked ? (zombie.pounceTargetX ?? zombie.x) : zombie.x,
        0.02,
        targetLocked ? (zombie.pounceTargetZ ?? zombie.z) : zombie.z,
      );

      // Color by type — StandardMaterial.update() re-uploads shader params, so
      // only touch the material when the telegraph type actually changes. The
      // per-frame pulse is carried entirely by the (transform-only) ring scale.
      const teleKey = telegType === "slam" ? "slam" : biteActive ? "bite" : "pounce";
      if (entity._telegraphKey !== teleKey) {
        entity._telegraphKey = teleKey;
        if (teleKey === "slam") {
          mat.emissive.set(1.0, 0.31, 0.64);
        } else if (teleKey === "bite") {
          mat.emissive.set(1.0, 0.24, 0.08);
        } else {
          mat.emissive.set(0.88, 0.54, 0.0);
        }
        mat.opacity = 0.78;
        mat.update();
      }

      // Pulse scale: shrinks from 1.0 → 0.4 as telegraph winds up, then pops
      const maxDuration = biteActive ? (zombie.biteWindupSec ?? 0.24) : telegType === "slam" ? 0.70 : 0.40;
      const remainingSec = biteActive ? (zombie.biteTimerSec ?? 0) : telegSec;
      const progress = Math.max(0, Math.min(1, 1 - remainingSec / maxDuration));
      const baseScale = biteActive ? 0.48 : 0.9;
      const scale = baseScale - progress * (biteActive ? 0.16 : 0.5);
      const pulse = 1 + Math.sin(this.state.elapsedSec * 18) * 0.08;
      ring.setLocalScale(scale * pulse, 0.04, scale * pulse);
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

  updateVillageStructureVisuals(dt) {
    const structures = getPlayCanvasVillageStructureSnapshot(this.state);
    const activeAlerts = [];
    const t = this.state.elapsedSec ?? 0;
    for (const structure of structures) {
      const visual = this.villageStructureVisuals.get(structure.id);
      if (!visual) continue;
      const targetRatio = Math.max(0, Math.min(1, structure.healthRatio));
      const ease = Math.min(1, Math.max(0, dt) * (targetRatio > visual.displayRatio ? 4 : 2.2));
      visual.displayRatio += (targetRatio - visual.displayRatio) * ease;
      const tier = structure.damageTier;
      const destroyed = structure.destroyed;
      const underAttack = structure.underAttackSec > 0 && !destroyed;

      visual.intactRoot.enabled = !destroyed;
      visual.cracks.enabled = tier >= 1 && !destroyed;
      visual.critical.enabled = tier >= 2 && !destroyed;
      visual.fire.enabled = tier >= 3 && !destroyed;
      visual.smoke.enabled = tier >= 2 || destroyed;
      visual.rubble.enabled = destroyed;
      visual.attackRing.enabled = underAttack;
      visual.alertRoot.enabled = underAttack;

      const width = Math.max(0.02, 2.18 * targetRatio);
      for (const fill of [visual.alertFill, visual.criticalFill]) {
        fill.setLocalScale(width, 0.13, 0.065);
        fill.setLocalPosition(-1.09 + width * 0.5, 0, 0.06);
      }
      visual.alertFill.enabled = tier < 2;
      visual.criticalFill.enabled = tier >= 2;

      if (visual.smoke.enabled) {
        const smokePulse = this._reducedMotion ? 0 : Math.sin(t * 1.25 + structure.x * 0.17) * 0.22;
        visual.smoke.setLocalPosition(
          structure.x,
          visual.smoke._villageSmokeBaseY + smokePulse * 1.3,
          visual.smoke._villageSmokeBaseZ,
        );
        const smokeScale = 0.72 + (1 - targetRatio) * 0.85 + smokePulse * 0.08;
        visual.smoke.setLocalScale(smokeScale, smokeScale * 1.45, smokeScale);
      }
      if (visual.fire.enabled) {
        const firePulse = this._reducedMotion ? 1 : 0.88 + Math.sin(t * 7 + structure.z) * 0.12;
        visual.fire.setLocalScale(1, 0.9 + firePulse * 0.18, 1);
      }
      if (underAttack) {
        const pulse = this._reducedMotion ? 1 : 0.92 + Math.sin(t * 6.4) * 0.08;
        const ringSize = Math.max(structure.sx, structure.sz) * 0.68 * pulse;
        visual.attackRing.setLocalScale(ringSize, 0.025, ringSize);
        visual.beacon.setLocalScale(0.18 * pulse, 0.18 * pulse, 0.18 * pulse);
        const playerDx = this.state.player.x - structure.x;
        const playerDz = this.state.player.z - structure.z;
        const playerDistance = Math.max(0.001, Math.hypot(playerDx, playerDz));
        const markerOffset = Math.max(structure.sx, structure.sz) * 0.56;
        visual.alertRoot.setLocalPosition(
          structure.x + (playerDx / playerDistance) * markerOffset,
          structure.sy + 1.2,
          structure.z + (playerDz / playerDistance) * markerOffset,
        );
        visual.alertRoot.setLocalEulerAngles(0, Math.atan2(playerDx, playerDz) * pc.math.RAD_TO_DEG, 0);
        activeAlerts.push(structure);
      }
      visual.lastTier = tier;
    }

    activeAlerts.sort((a, b) =>
      b.attackerCount - a.attackerCount ||
      a.healthRatio - b.healthRatio ||
      a.id.localeCompare(b.id)
    );
    const primary = activeAlerts[0] ?? null;
    if (this.structureAlert) this.structureAlert.hidden = !primary;
    this.root.classList.toggle("has-structure-alert", Boolean(primary));
    if (primary) {
      if (this.structureAlertLabel) this.structureAlertLabel.textContent = primary.label;
      if (this.structureAlertHealth) this.structureAlertHealth.textContent = `${Math.ceil(primary.healthRatio * 100)}%`;
    }
    this._activeStructureAlertId = primary?.id ?? null;
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
      this._windowGlowMats.push({ entity, mat, structureId: entity._villageStructureId ?? null });
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
      // Smoke is a small translucent puff that drifts upward via scale and
      // opacity modulation each frame.
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
      smokeMat.useFog = true;
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
      const { entity, mat, structureId } = this._windowGlowMats[i];
      const phase = i * 1.57 + 0.4; // unique phase per window
      const windowRatio = structureId
        ? (this.villageStructureVisuals.get(structureId)?.displayRatio ?? r)
        : r;

      let intensity;
      if (windowRatio >= 0.82) {
        intensity = 1.0;
      } else if (windowRatio >= 0.35) {
        // Aggressive dim: 1.0 at r=0.82 → 0.12 at r=0.35
        const band = (windowRatio - 0.35) / (0.82 - 0.35); // 0 at r=0.35, 1 at r=0.82
        const flickerAmt = (1 - band) * 0.25;
        const flicker = this._reducedMotion ? 0 : Math.sin(t * 4.8 + phase) * flickerAmt;
        intensity = 0.12 + band * 0.88 + flicker;
      } else {
        // Critical guttering: 0.12 at r=0.35 → 0.05 at r=0
        const band = windowRatio / 0.35; // 0 at r=0, 1 at r=0.35
        const flicker = this._reducedMotion ? 0 : Math.sin(t * 8.2 + phase) * 0.06 * band;
        intensity = 0.05 + band * 0.07 + flicker;
      }

      // Never fully zero — avoids a pitch-black square artifact.
      intensity = Math.max(0.05, intensity);

      // material.update() re-uploads shader params — skip it when this frame's
      // intensity is unchanged (the common case: healthy village, no flicker).
      if (Math.abs((mat._lastGlowIntensity ?? -1) - intensity) < 0.004) {
        void entity;
        continue;
      }
      mat._lastGlowIntensity = intensity;

      mat.emissive.set(WG_BASE_R * intensity, WG_BASE_G * intensity, WG_BASE_B * intensity);
      // Diffuse also shifts cooler/darker as windows go out.
      const diffuseDim = 0.40 + 0.60 * intensity;
      mat.diffuse.set(diffuseDim, diffuseDim * 0.72, diffuseDim * 0.32);
      mat.update();

      void entity; // keep reference (impact system may set enabled=false on this entity)
    }

    // ── 2. Smoke columns ─────────────────────────────────────────────────────
    // Smoke starts below r=0.72; scales to full 5 columns at r=0.
    const cap = PlayCanvasZombieSlice.DISTRESS_SMOKE_CAP;
    let targetSmokeCount = 0;
    if (this.villageStructureVisuals.size === 0 && r < 0.72) {
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
      const baseOpacity = this._reducedMotion ? 0.08 : 0.12;
      const maxOpacity  = this._reducedMotion ? 0.16 : 0.28;
      const opacity = (baseOpacity + distressDepth * (maxOpacity - baseOpacity)) * fadeFrac;

      // Keep each puff subordinate to the buildings; the previous 5-12u
      // ellipsoids read as floating opaque balloons at mid village damage.
      const baseScale = 0.9 + distressDepth * 0.9;
      const scaleX = baseScale * (1 + riseFrac * 0.25);
      const scaleY = baseScale * (0.75 + riseFrac * 0.8);
      const scaleZ = baseScale * (1 + riseFrac * 0.25);

      // Rise just above the roofline instead of crossing the entire skyline.
      const baseY = 3.8;
      const riseY = riseFrac * 4.5;
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
    // Rendering lives in minimapRenderer.js (pure, unit-tested); this wrapper
    // just feeds it the live snapshot and the persistent gradient cache.
    if (!this._minimapGradientCache) this._minimapGradientCache = {};
    renderMiniMap(this.minimapCtx, {
      size: this.minimapCanvas.width,
      snapshot: getPlayCanvasMiniMapSnapshot(this.state),
      structures: this.minimapStructures,
      gradientCache: this._minimapGradientCache,
    });
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
      slot._sfxArmH.setLocalScale((slot._sfxArmHWidth ?? b * 2.6) * armS, b * 0.14 * s, b * 0.14 * s);
      slot._sfxArmV.setLocalScale(b * 0.14 * s, (slot._sfxArmVHeight ?? b * 2.4) * armS, b * 0.14 * s);
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

    // ── Legacy fx array (ordnance blasts, fire pulses, shells, smoke, etc.) ────
    // In-place compaction: write-index pattern avoids allocating a new array each frame.
    let _fxW = 0;
    for (let _fxI = 0; _fxI < this.fx.length; _fxI++) {
      const entity = this.fx[_fxI];
      let keep;
      if (entity._sliceMuzzleLight) {
        keep = entity._sliceTtl > 0;
      } else {
        entity._sliceTtl = (entity._sliceTtl ?? 0) - dt;

        // Ground decals: hold position/scale, fade opacity over the last 30%.
        if (entity._sfxIsDecal) {
          if (entity._sliceTtl <= 0) {
            this._retireFxEntity(entity);
            keep = false;
          } else {
            const norm = entity._sliceTtl / Math.max(0.001, entity._sliceMaxTtl ?? 1);
            if (norm < 0.3) {
              const mat = entity.render?.meshInstances?.[0]?.material;
              if (mat) {
                mat.opacity = (entity._sfxDecalOpacity ?? 0.8) * (norm / 0.3);
                mat.update();
              }
            }
            keep = true;
          }
          if (keep) { this.fx[_fxW++] = entity; }
          continue;
        }

        // Shell casings: arc through world space with gravity then shrink/fade out.
        if (entity._sfxIsShell) {
          if (entity._sliceTtl <= 0) { this._retireFxEntity(entity); keep = false; }
          else {
            const vel = entity._sfxVelocity;
            if (vel) {
              vel.y -= (entity._sfxGravity ?? 6.5) * dt;
              const p = entity.getPosition();
              entity.setPosition(p.x + vel.x * dt, p.y + vel.y * dt, p.z + vel.z * dt);
              // Tumble on all axes for realism
              const rot = entity.getEulerAngles();
              entity.setEulerAngles(rot.x + 480 * dt, rot.y + 320 * dt, rot.z + 200 * dt);
            }
            // Fade out in final 25% of life
            const norm = entity._sliceTtl / Math.max(0.001, entity._sliceMaxTtl ?? 0.4);
            const mat = entity.render?.meshInstances?.[0]?.material;
            if (mat && norm < 0.25) { mat.opacity = Math.max(0, norm / 0.25); mat.update(); }
            keep = true;
          }
        } else {
          const baseScale = entity._sliceBaseScale;
          if (entity._sliceExpand) {
            // Explosion-style FX: grow from start→base over life (ease-out) + fade.
            const maxTtl = Math.max(0.001, entity._sliceMaxTtl ?? entity._sliceTtl);
            const lifeT = Math.min(1, Math.max(0, 1 - entity._sliceTtl / maxTtl));
            const e = 1 - (1 - lifeT) * (1 - lifeT); // ease-out
            const s0 = entity._sliceStartScale ?? [0.1, 0.1, 0.1];
            const s1 = baseScale ?? [1, 1, 1];
            entity.setLocalScale(
              s0[0] + (s1[0] - s0[0]) * e,
              s0[1] + (s1[1] - s0[1]) * e,
              s0[2] + (s1[2] - s0[2]) * e,
            );
            if (entity._sliceVel) {
              const p = entity.getLocalPosition();
              entity.setLocalPosition(p.x + entity._sliceVel[0] * dt, p.y + entity._sliceVel[1] * dt, p.z + entity._sliceVel[2] * dt);
              entity._sliceVel[1] -= 9 * dt; // gravity on ember sparks
            }
            const mat = entity.render?.meshInstances?.[0]?.material;
            if (mat) { mat.opacity = Math.max(0, (entity._sliceFadeFrom ?? 1) * (1 - lifeT)); mat.update(); }
          } else if (baseScale) {
            const progress = Math.max(0.01, entity._sliceTtl / Math.max(0.001, entity._sliceMaxTtl ?? entity._sliceTtl));
            entity.setLocalScale(baseScale[0] * progress, baseScale[1] * progress, baseScale[2] * progress);
          } else {
            const scale = Math.max(0.01, entity._sliceTtl);
            entity.setLocalScale(scale, scale, scale);
          }
          if (entity._sliceTtl > 0) {
            keep = true;
          } else {
            this._retireFxEntity(entity);
            keep = false;
          }
        }
      }
      if (keep) { this.fx[_fxW++] = entity; }
    }
    this.fx.length = _fxW;
  }

  updateHud() {
    if (this.lastRenderedPhase !== this.state.phase) {
      this.lastRenderedPhase = this.state.phase;
    }
    // Count cached by updateZombies (runs earlier each frame) — avoids a fresh
    // filter() array allocation per frame in this hot path.
    const live = this._liveZombieCount ?? this.state.zombies.filter((zombie) => !zombie.dead).length;
    const vRatio = clamp(this.state.villageHp / Math.max(1, this.state.maxVillageHp), 0, 1);
    const structureCount = this.state.villageStructures?.length ?? 0;
    const survivingStructures = this.state.villageStructures?.reduce((count, structure) => count + (structure.hp > 0 ? 1 : 0), 0) ?? 0;
    this.fields.phase.textContent = this.state.phase.toUpperCase();
    this.fields.message.textContent = this.state.lastMessage;
    this.fields.wave.textContent = this.state.waveNumber;
    this.fields.village.textContent = `${Math.ceil(vRatio * 100)}% · ${survivingStructures}/${structureCount}`;
    this.fields.player.textContent = Math.ceil(this.state.playerHp);
    const weaponDef = this.state.equippedWeaponId ? getWeaponDef(this.state.equippedWeaponId) : null;
    if (weaponDef && weaponDef.magSize > 0) {
      this.fields.ammo.textContent = this.state.pendingReload ? "RELOAD" : `${this.state.ammo ?? 0}/${weaponDef.magSize}`;
    } else {
      this.fields.ammo.textContent = "INF";
    }
    if (this.fields.stamina) {
      this.fields.stamina.textContent = Math.floor(this.state.stamina ?? 100);
    }
    if (this.reloadBarWrapper) {
      const reloading = this.state.pendingReload && weaponDef;
      this.reloadBarWrapper.hidden = !reloading;
      if (reloading) {
        if (this.reloadField) {
          const pct = Math.round((1 - (this.state.reloadTimerSec ?? 0) / Math.max(0.01, weaponDef.reloadSec ?? 1)) * 100);
          this.reloadField.textContent = `${pct}%`;
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
      this.bars.health.parentElement?.setAttribute('aria-valuenow', String(Math.round(hRatio * 100)));
    }
    const sRatio = clamp((this.state.stamina ?? 100) / 100, 0, 1);
    if (this.bars.stamina) {
      this.bars.stamina.style.width = (sRatio * 100) + '%';
      this.bars.stamina.parentElement?.setAttribute('aria-valuenow', String(Math.round(sRatio * 100)));
    }
    this.actionButtons.start.textContent = this.state.phase === "intermission"
      ? `Start Wave ${this.state.waveNumber + 1}`
      : this.state.phase === "ready"
        ? "Start Campaign"
        : this.state.phase === "secret_boss"
          ? "Boss Active"
          : "Wave Running";
    this.actionButtons.start.disabled = this.state.phase !== "ready" && this.state.phase !== "intermission";
    if (this.actionButtons.shop) this.actionButtons.shop.disabled = this.state.phase === "secret_boss" || this.state.phase === "lost" || this.state.phase === "won";
    if (this.actionButtons.ordnance) this.actionButtons.ordnance.disabled = !isActivePlayPhase(this.state.phase);
    if (this.actionButtons.music) {
      this.actionButtons.music.textContent = this.state.musicEnabled !== false ? "Music On" : "Music Off";
      this.actionButtons.music.classList.toggle("is-active", this.state.musicEnabled !== false);
    }
    if (this.actionButtons.sfx) {
      this.actionButtons.sfx.textContent = this.state.sfxEnabled !== false ? "SFX On" : "SFX Off";
      this.actionButtons.sfx.classList.toggle("is-active", this.state.sfxEnabled !== false);
    }
    if (this.actionButtons.haptics) {
      this.actionButtons.haptics.textContent = this.hapticsEnabled ? "Haptics On" : "Haptics Off";
      this.actionButtons.haptics.classList.toggle("is-active", this.hapticsEnabled);
    }
    if (this.actionButtons.fullscreen) {
      // Reflect real state like its sibling toggles (it used to sit at the
      // static label "Toggle" forever).
      const fullscreenOn = typeof document !== "undefined" && Boolean(document.fullscreenElement);
      this.actionButtons.fullscreen.textContent = fullscreenOn ? "Fullscreen On" : "Fullscreen Off";
      this.actionButtons.fullscreen.classList.toggle("is-active", fullscreenOn);
    }
    if (this.state.phase === "secret_boss" || this.state.phase === "lost" || this.state.phase === "won") {
      this.shopOpen = false;
    }
    // Intermission starts on the Regroup card (shop closed); the player opens the
    // shop on demand via OPEN SHOP. Card and shop never show at once — see
    // renderFlowPanel — so the two panels can't overlap.
    if (this.state.phase === "intermission" && this._lastShopPhase !== "intermission") {
      this.shopOpen = false;
    }
    this._lastShopPhase = this.state.phase;
    this.shopPanel.hidden = !this.shopOpen;
    if (this.shopOpen) {
      this.renderShop();
    }
    this.renderFlowPanel(live);
    this.updateGuidancePanel();
    this.updateMiniMapVisibility();
  }

  renderFlowPanel(live) {
    // At intermission the shop replaces the Regroup card (mutually exclusive) so
    // the two panels never overlap. Other menu phases always show the card.
    const visible =
      !isActivePlayPhase(this.state.phase) &&
      !this.shopOpen &&
      !this._onboardingVisible;
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
    const threat = guidance.nextThreat ? ` Next: ${guidance.nextThreat.label}.` : "";
    const guideTitle = recommendation?.title ?? "Field Shop";
    const guideBody = recommendation ? `${recommendation.reason}${threat}` : "Upgrade whenever you have coins";
    if (this.shopGuideTitle) {
      this.shopGuideTitle.textContent = guideTitle;
    }
    if (this.shopGuideBody) {
      this.shopGuideBody.textContent = guideBody;
    }

    const signature = JSON.stringify({
      guideTitle,
      guideBody,
      recommendation: recommendation ? `${recommendation.targetType}:${recommendation.targetId}` : "none",
      items: items.map((item) => ({
        type: item.type,
        id: item.id,
        label: item.label,
        detail: item.detail,
        status: item.status,
        disabled: Boolean(item.disabled),
        equipped: Boolean(item.equipped),
        recommended: isRecommendedShopItem(item, recommendation),
      })),
    });
    if (this._shopRenderSignature === signature && this.shopItemsRoot.children.length > 0) {
      return;
    }
    this._shopRenderSignature = signature;

    this.shopItemsRoot.innerHTML = items
      .map((item) => {
        const recommended = isRecommendedShopItem(item, recommendation);
        const disabled = item.disabled ? "true" : "false";
        const actionAttrs = `data-shop-type="${escapeHtml(item.type)}" data-shop-id="${escapeHtml(item.id)}" data-shop-disabled="${disabled}"`;
        return `
          <article class="pc-shop-card ${item.disabled ? "is-disabled" : "is-actionable"} ${item.equipped ? "is-equipped" : ""} ${recommended ? "is-recommended" : ""}" ${actionAttrs} ${item.disabled ? 'aria-disabled="true" tabindex="0"' : 'role="button" tabindex="0"'} ${recommended ? 'data-recommended="true"' : ""}>
            <strong>${escapeHtml(item.label)}</strong>
            <span>${escapeHtml(item.detail)}</span>
            <button type="button" ${actionAttrs} ${item.disabled ? "disabled" : ""}>${escapeHtml(item.status)}</button>
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
        this.sfxCues.streak(milestone);
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

  // ── Procedural SFX cues live in sfxCues.js (this.sfxCues) ────────────────

  /** Cue 10: Ambient night bed — crickets loop (real sample) or synth pad fallback.
   *  The real sample plays on the music channel destination (ctx.destination, gated by
   *  musicEnabled).  The synth fallback uses setInterval as before. */
  _startNightBed() {
    if (this._nightBedRunning) return;
    if (this.state.sfxEnabled === false) return;
    this._nightBedRunning = true;
    this._nightBedPhase = 0;
    // Try real sample first
    if (this.audio.ctx && this.samples.isReady("ambient-night")) {
      this.samples.startNightBed(this.audio.ctx, this.audio.ctx.destination, 0.14);
      return;
    }
    // Synth fallback: evolving low pad chords (unchanged from before)
    const BED_ROOTS = [82, 92.5, 87];   // low A / B-flat / A# area
    const BED_OFFSETS = [[0, 7, 12], [0, 5, 10], [2, 7, 14]];
    const _playBed = () => {
      if (!this._nightBedRunning || this.state.sfxEnabled === false) return;
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
    // Stop real sample bed
    if (this.audio.ctx) {
      this.samples.stopNightBed(this.audio.ctx);
    }
    // Stop synth fallback (no-op if sample was used)
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
      const villageStructures = buildings.defenseStructures ?? [];
      const villagers = getPlayCanvasVillagerSnapshot(this.state);
      const boss = getPlayCanvasBossSnapshot(this.state);
      const impact = getPlayCanvasImpactSnapshot(this.state);
      const weaponState = getPlayCanvasWeaponSnapshot(this.state);
      const weaponModel = this.weaponModels?.get(weaponState.viewModel);
      const weaponViewYawDeg = Number(weaponModel?._rootEuler?.[1] ?? -6).toFixed(1);
      const guidance = getPlayCanvasGuidanceSnapshot(this.state);
      const rewarded = getPlayCanvasRewardedAdSnapshot(this.state);
      const perf = this.performanceTelemetry;
      const audio = getPlayCanvasAudioSnapshot(this.state, {
        shopOpen: this.shopOpen,
        villageDamageRecent: this.audioDamagePulseSec > 0 ? 1 : 0,
        playerDamageRecent: this.audioPlayerDamagePulseSec > 0 ? 1 : 0,
      });
      const escort = villagers.find((villager) => villager.state === "escorting");
      const perks = this.state.villagerPerkModifiers ?? {};
      const activeTracers = this.shotFx.tracers.filter((tracer) => tracer.enabled && tracer._sfxTtl > 0);
      const tracerDropVisual = activeTracers.reduce((max, tracer) => Math.max(max, tracer._sfxBallisticDrop ?? 0), 0);
      const tracerDropActual = activeTracers.reduce((max, tracer) => Math.max(max, tracer._sfxBallisticActualDrop ?? 0), 0);
      return [
        `mode=playcanvas-game`,
        `style=cinematic-low-poly-survival`,
        `composition=target-village-street`,
        `mood=tense-not-too-scary`,
        `phase=${this.state.phase}`,
        `saveVersion=${this.state.version ?? 1}`,
        `profileType=${this.state.profileType ?? "playcanvas"}`,
        `wave=${this.state.waveNumber}`,
        `playerY=${Number(this.state.player?.y ?? 0).toFixed(2)}`,
        `playerSurface=${this.state.player?.supportSurfaceId ?? "ground"}`,
        `playerGrounded=${Boolean(this.state.player?.onGround)}`,
        `villageHp=${Math.ceil(this.state.villageHp)}`,
        `maxVillageHp=${this.state.maxVillageHp}`,
        `villageStructures=${villageStructures.length}`,
        `survivingStructures=${villageStructures.filter((structure) => !structure.destroyed).length}`,
        `destroyedStructures=${villageStructures.filter((structure) => structure.destroyed).map((structure) => structure.id).join(",") || "none"}`,
        `underAttackStructures=${villageStructures.filter((structure) => structure.underAttackSec > 0).map((structure) => structure.id).join(",") || "none"}`,
        `activeStructureAlert=${this._activeStructureAlertId ?? "none"}`,
        `structureHealth=${villageStructures.map((structure) => `${structure.id}:${Math.ceil(structure.hp)}/${Math.ceil(structure.maxHp)}:t${structure.damageTier}`).join("|")}`,
        `playerHp=${Math.ceil(this.state.playerHp)}`,
        `ammo=${this.state.ammo}`,
        `ammoMode=infinite`,
        `ordnance=${this.state.activeOrdnanceId}`,
        `ordnanceCount=${ordnanceCount(this.state)}`,
        `weapon=${this.state.equippedWeaponId}`,
        `weaponFamily=${weaponState.family}`,
        `weaponViewModel=${weaponState.viewModel}`,
        `weaponViewYawDeg=${weaponViewYawDeg}`,
        `weaponReticle=${weaponState.reticle}`,
        `weaponMuzzleFx=${weaponState.muzzleFx}`,
        `weaponShotFx=${weaponState.shotFx}`,
        `weaponSilhouette=${weaponState.silhouette}`,
        `weaponSpreadMoa=${weaponState.spreadMoa}`,
        `rewardedTelemetry=${rewarded.telemetryCount}`,
        `rewardedLastEvent=${rewarded.lastEventType ?? "none"}`,
        `rewardedLastOffer=${rewarded.lastOfferId ?? "none"}`,
        `rewardedLastProvider=${rewarded.lastProvider ?? "none"}`,
        `rewardedReviveUsed=${rewarded.reviveUsed}`,
        `rewardedClaimedOffers=${rewarded.claimedOfferKeys.length}`,
        `perfFpsAvg=${Number(perf.fpsAvg || 0).toFixed(1)}`,
        `perfFrameMsAvg=${Number(perf.frameMsAvg || 0).toFixed(1)}`,
        `perfSlowFrames=${perf.slowFrames}`,
        `perfWorstFrameMs=${Number(perf.worstFrameMs || 0).toFixed(1)}`,
        `qualityProfile=${this.qualityProfileKey}`,
        `renderScale=${Number(this.qualityProfile?.renderScale ?? 1).toFixed(2)}`,
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
        `tracerDropVisual=${tracerDropVisual.toFixed(3)}`,
        `tracerDropActual=${tracerDropActual.toFixed(3)}`,
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
        `settingsOpen=${this._isSettingsOpen()}`,
        `gameplayPaused=${this._isUiOverlayOpen()}`,
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
        `samplesLoaded=${this.samples.loadedCount}`,
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
