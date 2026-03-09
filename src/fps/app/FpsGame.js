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
import { defaultFpsSave, loadFpsSave, persistFpsSave } from "../systems/saveFps";

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
    this.bossDef = boss;
    this.materialDefs = new Map(materials.map((item) => [item.material, item]));
    this.qualityProfiles = qualityProfiles;

    this.save = loadFpsSave();
    this.defaultSaveFactory = defaultFpsSave;

    this.qualityPreset = this.save.graphicsPreset in qualityProfiles ? this.save.graphicsPreset : chooseGraphicsPreset(qualityProfiles);
    this.qualityProfile = qualityProfiles[this.qualityPreset];

    this.scene3d = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 180);
    this.scene3d.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * this.qualityProfile.renderScale);
    this.root.innerHTML = "";
    this.root.appendChild(this.renderer.domElement);

    this.physics = new PhysicsWorld();
    this.audio = new Audio3D(this.camera);
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

    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * this.qualityProfile.renderScale);
      this.renderPipeline.resize(window.innerWidth, window.innerHeight);
      this.applyOrientationClass();
    });

    document.body.classList.toggle("touch-device", window.matchMedia("(pointer: coarse)").matches);
    this.applyOrientationClass();
  }

  applyOrientationClass() {
    const portrait = window.matchMedia("(orientation: portrait)").matches;
    document.body.classList.toggle("portrait", portrait);
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
    this.clearOverlay();
    this.raidScene.enter();
    this.mode = "raid";
    this.mobileControls.show();
  }

  resumeAfterIntermission() {
    this.clearOverlay();
    this.raidScene.resumeAfterIntermission();
    this.mode = "raid";
    this.mobileControls.show();
  }

  openShop() {
    this.raidScene.pause();
    this.setMode("shop", { waveNumber: this.raidScene.waveDirector.waveNumber + 1 });
  }

  reloadSave() {
    this.save = loadFpsSave();
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
      this.audio.startMusic("menu");
      return;
    }

    if (mode === "summary") {
      this.clearOverlay();
      this.overlayScene = this.summaryScene;
      this.summaryScene.enter(payload);
      this.mode = "summary";
      this.mobileControls.hide();
      this.audio.stopMusic();
      this.audio.startMusic("menu");
      return;
    }

    if (mode === "game_over") {
      this.clearOverlay();
      this.overlayScene = this.gameOverScene;
      this.gameOverScene.enter(payload);
      this.mode = "game_over";
      this.mobileControls.hide();
      this.audio.stopMusic();
      this.audio.startMusic("menu");
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

  window.__fpsGame = game;
  window.render_game_to_text = () => game.renderGameToText();
  window.advanceTime = (ms) => game.advanceTime(ms);

  return game;
}
