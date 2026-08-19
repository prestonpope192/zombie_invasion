import * as THREE from "three";
import weapons from "../config/weapons_fps.json";
import enemies from "../config/enemies_fps.json";
import waves from "../config/waves_fps.json";
import materials from "../config/materials_physics.json";
import qualityProfiles from "../config/quality_profiles.json";
import buildings from "../config/buildings_fps.json";
import economy from "../config/economy_fps.json";
import boss from "../config/boss_fps.json";
import { BootScene3D } from "../scenes/BootScene3D";
import { MenuScene3D } from "../scenes/MenuScene3D";
import { RaidScene3D } from "../scenes/RaidScene3D";
import { ShopScene3D } from "../scenes/ShopScene3D";
import { SummaryScene3D } from "../scenes/SummaryScene3D";
import { GameOverScene3D } from "../scenes/GameOverScene3D";
import { Audio3D } from "../systems/audio3d";
import { MobileFpsControls } from "../systems/mobileFpsControls";
import { PhysicsWorld } from "../systems/physicsWorld";
import { chooseGraphicsPreset, RenderPipeline } from "../systems/renderPipeline";
import { getGrenadeTypeDefs } from "../systems/grenadeLoadout";
import { defaultFpsSave, loadFpsSave, persistFpsSave } from "../systems/saveFps";
import { showRewardedAd } from "../systems/rewardedAds";
import { applyRewardedOffer, createRewardedRunState, ensureRewardedRunState } from "../systems/rewardedAdOffers";

const FIXED_DT = 1 / 60;

export class FpsGame {
  constructor(root) {
    this.root = root;
    this.mode = "boot";
    this.running = false;
    this.pendingVisualRemovals = [];

    this.weapons = weapons;
    this.weaponMap = new Map(this.weapons.map((weapon) => [weapon.id, weapon]));
    this.enemies = enemies;
    this.enemyMap = new Map(this.enemies.map((enemy) => [enemy.id, enemy]));
    this.waveDefs = waves;
    this.buildingDefs = buildings;
    this.economy = economy;
    this.grenadeTypes = getGrenadeTypeDefs();
    this.grenadeTypeMap = new Map(this.grenadeTypes.map((grenade) => [grenade.id, grenade]));
    this.bossDef = boss;
    this.materialDefs = new Map(materials.map((item) => [item.material, item]));
    this.qualityProfiles = qualityProfiles;

    this.save = loadFpsSave();
    this.defaultSaveFactory = defaultFpsSave;
    this.rewardedRunState = createRewardedRunState();

    this.qualityPreset = this.save.graphicsPreset in qualityProfiles ? this.save.graphicsPreset : chooseGraphicsPreset(qualityProfiles);
    this.qualityProfile = qualityProfiles[this.qualityPreset];
    this.version = window.__zombieInvasionVersion || "dev";
    this.viewportMetrics = this.getViewportMetrics();

    this.scene3d = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, this.viewportMetrics.width / this.viewportMetrics.height, 0.1, 180);
    this.scene3d.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setSize(this.viewportMetrics.width, this.viewportMetrics.height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * this.qualityProfile.renderScale);
    this.root.innerHTML = "";
    this.root.classList.add("fps-root");
    this.root.appendChild(this.renderer.domElement);

    this.physics = new PhysicsWorld();
    this.audio = new Audio3D(this.camera);
    this.audio.setMusicEnabled(this.save.musicEnabled);
    this.audio.setSfxEnabled(this.save.sfxEnabled);
    this.mobileControls = new MobileFpsControls();

    this.renderPipeline = new RenderPipeline({
      renderer: this.renderer,
      scene: this.scene3d,
      camera: this.camera,
      qualityProfile: this.qualityProfile,
    });
    this.renderPipeline.init();

    this.bootScene = new BootScene3D(this);
    this.menuScene = new MenuScene3D(this);
    this.raidScene = new RaidScene3D(this);
    this.shopScene = new ShopScene3D(this);
    this.summaryScene = new SummaryScene3D(this);
    this.gameOverScene = new GameOverScene3D(this);

    this.overlayScene = null;

    this.lastFrameTime = performance.now();
    this.accumulator = 0;

    this.attachGlobalHandlers();
  }

  attachGlobalHandlers() {
    window.addEventListener("contextmenu", (event) => event.preventDefault());
    const unlockAudio = () => this.audio.unlockAudio?.();
    window.addEventListener("pointerdown", unlockAudio, { capture: true });
    window.addEventListener("keydown", unlockAudio, { capture: true });
    const preventGesture = (event) => event.preventDefault();
    let lastTouchEndAt = 0;
    window.addEventListener("gesturestart", preventGesture, { passive: false });
    window.addEventListener("gesturechange", preventGesture, { passive: false });
    window.addEventListener("gestureend", preventGesture, { passive: false });
    window.addEventListener("dblclick", preventGesture, { passive: false });
    window.addEventListener(
      "touchend",
      (event) => {
        const now = performance.now();
        if (now - lastTouchEndAt < 320) {
          event.preventDefault();
        }
        lastTouchEndAt = now;
      },
      { passive: false },
    );

    const syncViewport = () => this.updateViewportMetrics();

    window.addEventListener("resize", syncViewport);
    window.addEventListener("orientationchange", syncViewport);
    window.addEventListener("fullscreenchange", syncViewport);
    window.addEventListener("webkitfullscreenchange", syncViewport);
    window.visualViewport?.addEventListener("resize", syncViewport);
    window.visualViewport?.addEventListener("scroll", syncViewport);

    document.body.classList.toggle("touch-device", window.matchMedia("(pointer: coarse)").matches);
    this.updateViewportMetrics();
    this.applyOrientationClass();
  }

  applyOrientationClass() {
    const portrait = window.matchMedia("(orientation: portrait)").matches;
    document.body.classList.toggle("portrait", portrait);
  }

  getViewportMetrics() {
    const viewport = window.visualViewport;
    const rawWidth = viewport?.width ?? window.innerWidth;
    const rawHeight = viewport?.height ?? window.innerHeight;
    const width = Math.max(1, Math.round(rawWidth));
    const height = Math.max(1, Math.round(rawHeight));
    const left = Math.max(0, Math.round(viewport?.offsetLeft ?? 0));
    const top = Math.max(0, Math.round(viewport?.offsetTop ?? 0));
    const right = Math.max(0, window.innerWidth - left - width);
    const bottom = Math.max(0, window.innerHeight - top - height);

    return { width, height, left, top, right, bottom };
  }

  updateViewportMetrics() {
    this.viewportMetrics = this.getViewportMetrics();
    const { width, height, left, top, right, bottom } = this.viewportMetrics;
    const rootStyle = document.documentElement.style;

    rootStyle.setProperty("--game-left", `${left}px`);
    rootStyle.setProperty("--game-top", `${top}px`);
    rootStyle.setProperty("--game-right", `${right}px`);
    rootStyle.setProperty("--game-bottom", `${bottom}px`);
    rootStyle.setProperty("--game-width", `${width}px`);
    rootStyle.setProperty("--game-height", `${height}px`);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * this.qualityProfile.renderScale);
    this.renderPipeline.resize(width, height);
    this.applyOrientationClass();
    this.syncFullscreenState();
  }

  isFullscreenSupported() {
    return Boolean(
      document.fullscreenEnabled ||
        document.webkitFullscreenEnabled ||
        document.documentElement.requestFullscreen ||
        document.documentElement.webkitRequestFullscreen
    );
  }

  isFullscreenActive() {
    return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  }

  syncFullscreenState() {
    const supported = this.isFullscreenSupported();
    const active = this.isFullscreenActive();
    document.body.classList.toggle("fullscreen-supported", supported);
    document.body.classList.toggle("fullscreen-active", active);
    if (this.raidScene?.syncFullscreenButtonState) {
      this.raidScene.syncFullscreenButtonState({ supported, active });
    }
  }

  async toggleFullscreen() {
    const root = document.documentElement;
    try {
      if (this.isFullscreenActive()) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      } else if (root.requestFullscreen) {
        await root.requestFullscreen({ navigationUI: "hide" });
      } else if (root.webkitRequestFullscreen) {
        root.webkitRequestFullscreen();
      }
    } catch {
      // Some mobile browsers reject fullscreen. The fit-to-frame viewport remains as fallback.
    } finally {
      this.updateViewportMetrics();
    }
  }

  async start() {
    await this.bootScene.enter();
    this.running = true;
    this.lastFrameTime = performance.now();
    requestAnimationFrame((time) => this.frame(time));
  }

  frame(now) {
    if (!this.running) {
      return;
    }

    const dt = Math.min(0.1, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;
    this.accumulator += dt;

    while (this.accumulator >= FIXED_DT) {
      this.fixedStep(FIXED_DT);
      this.accumulator -= FIXED_DT;
    }

    this.renderPipeline.render(dt);
    requestAnimationFrame((time) => this.frame(time));
  }

  fixedStep(dt) {
    if (this.mode === "raid") {
      this.raidScene.updateFixed(dt);
    }
    if (this.overlayScene && typeof this.overlayScene.advanceSimulation === "function") {
      this.overlayScene.advanceSimulation(dt * 1000);
    }
  }

  startRaidRun() {
    this.audio.unlockAudio?.();
    this.rewardedRunState = createRewardedRunState();
    this.clearOverlay();
    this.raidScene.enter();
    this.mode = "raid";
    this.mobileControls.show();
  }

  recordRewardedAdEvent(type, details = {}) {
    const state = ensureRewardedRunState(this);
    const event = {
      type,
      mode: this.mode,
      at: Date.now(),
      ...details,
    };
    state.telemetry.push(event);
    if (state.telemetry.length > 80) {
      state.telemetry.splice(0, state.telemetry.length - 80);
    }
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function" && typeof window.CustomEvent === "function") {
      window.dispatchEvent(new CustomEvent("zombie_invasion_rewarded_ad", { detail: event }));
    }
    return event;
  }

  async claimRewardedOffer({ offerId, summary = null, source = "unknown" } = {}) {
    if (!offerId) {
      return { applied: false, message: "Missing reward offer." };
    }
    this.recordRewardedAdEvent("offer_clicked", { offerId, source, wave: summary?.wave ?? null });
    const ad = await showRewardedAd({ placement: offerId });
    this.recordRewardedAdEvent(ad.completed ? "ad_completed" : "ad_failed", {
      offerId,
      source,
      provider: ad.provider,
      wave: summary?.wave ?? null,
    });
    if (!ad.completed) {
      return { applied: false, message: "Rewarded ad unavailable. Try again later.", ad };
    }

    const result = applyRewardedOffer({ game: this, offerId, summary });
    if (result.applied) {
      this.save = persistFpsSave(this.save);
      this.raidScene.syncHud?.();
    }
    this.recordRewardedAdEvent(result.applied ? "reward_granted" : "reward_rejected", {
      offerId,
      source,
      provider: ad.provider,
      wave: summary?.wave ?? null,
      message: result.message,
      reward: result.reward ?? null,
    });
    return { ...result, ad };
  }

  reviveFromRewardedAd({ hp = 60, invulnerableSec = 3 } = {}) {
    this.clearOverlay();
    this.raidScene.revivePlayer?.({ hp, invulnerableSec });
    this.mode = "raid";
    this.audio.stopMusic();
    this.audio.startMusic("raid", { waveNumber: this.raidScene.waveDirector.waveNumber });
    this.mobileControls.show();
  }

  persistAudioSettings({ musicEnabled = this.save.musicEnabled, sfxEnabled = this.save.sfxEnabled } = {}) {
    this.save.musicEnabled = musicEnabled !== false;
    this.save.sfxEnabled = sfxEnabled !== false;
    this.save = persistFpsSave(this.save);
    this.audio.setSfxEnabled(this.save.sfxEnabled);
    this.audio.setMusicEnabled(this.save.musicEnabled);
    if (this.save.musicEnabled) {
      this.restartCurrentMusic();
    }
  }

  restartCurrentMusic() {
    if (!this.save.musicEnabled) {
      return;
    }
    if (this.mode === "raid") {
      this.audio.startMusic("raid", { waveNumber: this.raidScene.waveDirector.waveNumber });
      return;
    }
    const musicMode = this.mode === "shop" || this.mode === "summary" || this.mode === "game_over" ? this.mode : "menu";
    this.audio.startMusic(musicMode);
  }

  resumeAfterIntermission() {
    this.audio.unlockAudio?.();
    this.clearOverlay();
    this.raidScene.resumeAfterIntermission();
    this.mode = "raid";
    this.audio.stopMusic();
    this.audio.startMusic("raid", { waveNumber: this.raidScene.waveDirector.waveNumber });
    this.mobileControls.show();
  }

  openShop() {
    this.audio.unlockAudio?.();
    this.raidScene.pause();
    this.setMode("shop", { waveNumber: this.raidScene.waveDirector.waveNumber + 1 });
  }

  reloadSave() {
    this.save = loadFpsSave();
    this.audio.setMusicEnabled(this.save.musicEnabled);
    this.audio.setSfxEnabled(this.save.sfxEnabled);
  }

  setMode(mode, payload = {}) {
    if (mode === "menu") {
      this.raidScene.pause();
      this.clearOverlay();
      this.overlayScene = this.menuScene;
      this.menuScene.enter(payload);
      this.mode = "menu";
      this.mobileControls.hide();
      this.audio.stopMusic();
      this.audio.startMusic("menu");
      this.raidScene.hud && (this.raidScene.hud.style.display = "none");
      this.raidScene.crosshair && (this.raidScene.crosshair.style.display = "none");
      return;
    }

    if (mode === "shop") {
      this.clearOverlay();
      this.overlayScene = this.shopScene;
      this.shopScene.enter(payload);
      this.mode = "shop";
      this.mobileControls.hide();
      this.audio.stopMusic();
      this.audio.startMusic("shop");
      return;
    }

    if (mode === "summary") {
      this.clearOverlay();
      this.overlayScene = this.summaryScene;
      this.summaryScene.enter(payload);
      this.mode = "summary";
      this.mobileControls.hide();
      this.audio.stopMusic();
      this.audio.startMusic("summary");
      return;
    }

    if (mode === "game_over") {
      this.clearOverlay();
      this.overlayScene = this.gameOverScene;
      this.gameOverScene.enter(payload);
      this.mode = "game_over";
      this.mobileControls.hide();
      this.audio.stopMusic();
      this.audio.startMusic("game_over", payload);
      this.save = persistFpsSave(this.save);
    }
  }

  clearOverlay() {
    if (this.overlayScene && typeof this.overlayScene.exit === "function") {
      this.overlayScene.exit();
    }
    this.overlayScene = null;
  }

  renderGameToText() {
    if (this.mode === "raid") {
      return this.raidScene.renderGameToText("raid");
    }
    if (this.overlayScene && typeof this.overlayScene.renderGameToText === "function") {
      return this.overlayScene.renderGameToText();
    }
    return this.raidScene.renderGameToText(this.mode);
  }

  advanceTime(ms) {
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let i = 0; i < steps; i += 1) {
      this.fixedStep(FIXED_DT);
    }
    this.renderPipeline.render(FIXED_DT);
  }
}

export async function createFpsGame(root) {
  const game = new FpsGame(root);
  await game.start();

  // The shared boot overlay is also used by the PlayCanvas route. Hide it as
  // soon as the legacy/FPS menu is ready instead of waiting for the generic
  // four-second safety timeout to expire over a usable game screen.
  window.__ziBootHide?.();

  window.__fpsGame = game;
  window.render_game_to_text = () => game.renderGameToText();
  window.advanceTime = (ms) => game.advanceTime(ms);

  return game;
}
