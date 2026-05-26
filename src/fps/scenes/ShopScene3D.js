import * as THREE from "three";
import { persistFpsSave } from "../systems/saveFps";
import {
  applyArmorBuyOrEquip,
  applyGearBuy,
  applyGrenadePackBuy,
  applyMedKitBuy,
  applyVillageUpgradePurchase,
  applyWeaponBuyOrEquip,
  getArmorShopState,
  getGearShopState,
  getGrenadePackShopState,
  getMedKitShopState,
  getVillageUpgradeState,
  getWeaponShopState,
} from "../systems/shopRules";
import { getActiveGrenadeId, getGrenadeCount } from "../systems/grenadeLoadout";
import { escapeHtml } from "../systems/safeHtml";
import { computeDiscountedCost, getVillagerPerkModifiers } from "../systems/villagerEscortRules";
import { getFirstSessionShopRecommendation } from "../systems/firstSessionRules";

const ARMOR_PREVIEW_STYLES = {
  cloth: {
    primary: 0x6f7765,
    secondary: 0x55604d,
    accent: 0xb9bd91,
    gear: 0x2a3031,
    visor: 0x7fb0c7,
    skinHidden: false,
    helmet: false,
    hood: false,
    shoulders: false,
    chestRig: false,
    belt: false,
    pouches: false,
    kneepads: false,
    canisters: false,
  },
  leather: {
    primary: 0x8a5f42,
    secondary: 0x633e2b,
    accent: 0xc59a69,
    gear: 0x2a1e18,
    visor: 0x7fb0c7,
    skinHidden: false,
    helmet: false,
    hood: true,
    shoulders: true,
    chestRig: true,
    belt: true,
    pouches: true,
    kneepads: false,
    canisters: false,
  },
  kevlar: {
    primary: 0x3f5c73,
    secondary: 0x283f51,
    accent: 0x7f9fb8,
    gear: 0x26333c,
    visor: 0x95d4ff,
    skinHidden: false,
    helmet: true,
    hood: false,
    shoulders: false,
    chestRig: true,
    belt: true,
    pouches: false,
    kneepads: true,
    canisters: false,
  },
  reinforced: {
    primary: 0x6e7279,
    secondary: 0x4e545d,
    accent: 0xc0c7d0,
    gear: 0x38424a,
    visor: 0x9dd8ff,
    skinHidden: false,
    helmet: true,
    hood: false,
    shoulders: true,
    chestRig: true,
    belt: true,
    pouches: false,
    kneepads: true,
    canisters: false,
  },
  chainmail: {
    primary: 0x7f857e,
    secondary: 0x5c645d,
    accent: 0xc8ccc5,
    gear: 0x333a36,
    visor: 0x7fb0c7,
    skinHidden: false,
    helmet: false,
    hood: true,
    shoulders: false,
    chestRig: false,
    belt: true,
    pouches: false,
    kneepads: false,
    canisters: false,
  },
  tactical: {
    primary: 0x4d5b66,
    secondary: 0x36424d,
    accent: 0x9aa6ae,
    gear: 0x222c34,
    visor: 0x8dccf6,
    skinHidden: false,
    helmet: true,
    hood: false,
    shoulders: false,
    chestRig: true,
    belt: true,
    pouches: true,
    kneepads: true,
    canisters: false,
  },
  hazmat: {
    primary: 0x7a8b49,
    secondary: 0x536032,
    accent: 0xd7e383,
    gear: 0x28311e,
    visor: 0xffe47c,
    skinHidden: true,
    helmet: false,
    hood: true,
    shoulders: false,
    chestRig: false,
    belt: true,
    pouches: true,
    kneepads: false,
    canisters: true,
  },
  juggernaut: {
    primary: 0x7b7f86,
    secondary: 0x515660,
    accent: 0xdde2ea,
    gear: 0x303842,
    visor: 0xbfe7ff,
    skinHidden: true,
    helmet: true,
    hood: false,
    shoulders: true,
    chestRig: true,
    belt: true,
    pouches: false,
    kneepads: true,
    canisters: false,
    bulk: 1.12,
  },
};

export class ShopScene3D {
  constructor(game) {
    this.game = game;
    this.root = null;
    this.avatarYaw = 0;
    this.avatarDragPointer = null;
    this.avatarDragLastX = 0;
    this.avatarRenderer = null;
    this.avatarScene = null;
    this.avatarCamera = null;
    this.avatarModel = null;
    this.avatarResizeObserver = null;
    this.avatarElapsed = 0;
  }

  enter({ waveNumber }) {
    this.waveNumber = Math.max(1, Number.parseInt(waveNumber, 10) || 1);
    this.avatarYaw = 0;
    this.root = document.createElement("div");
    this.root.className = "fps-overlay shop";
    this.root.innerHTML = `
      <div class="fps-panel shop">
        <div class="fps-shop-header">
          <h2>Intermission Shop (Wave ${this.waveNumber})</h2>
          <button type="button" class="fps-shop-exit-top" data-action="close-shop" aria-label="Exit shop">Exit</button>
        </div>
        <p>Coins: <span data-bind="coins"></span> | Grenades: <span data-bind="grenades"></span></p>
        <div class="fps-shop-recommendation" data-bind="recommendation"></div>
        <div class="fps-shop-columns">
          <div class="fps-shop-main">
            <h3>Weapons</h3>
            <div class="fps-shop-list" data-bind="weapons"></div>
            <h3>Gear</h3>
            <div class="fps-shop-list" data-bind="gear"></div>
            <h3>Ordnance</h3>
            <div class="fps-shop-list" data-bind="ordnance"></div>
            <h3>Armor</h3>
            <div class="fps-shop-list" data-bind="armors"></div>
            <h3>Village</h3>
            <div class="fps-shop-list" data-bind="village-upgrade"></div>
          </div>
	          <aside class="fps-shop-avatar-panel">
	            <h3>Survivor</h3>
	            <div class="fps-avatar-stage" data-bind="avatar-stage">
	              <canvas class="fps-player-avatar-3d armor-cloth" data-bind="avatar" aria-label="3D survivor armor preview"></canvas>
	            </div>
            <div class="fps-avatar-controls">
              <button type="button" data-action="avatar-left">Rotate Left</button>
              <button type="button" data-action="avatar-right">Rotate Right</button>
            </div>
            <p class="fps-avatar-caption" data-bind="armor-caption">Armor: Cloth Jacket</p>
          </aside>
        </div>
        <div class="fps-shop-actions">
          <button data-action="continue">Continue</button>
        </div>
      </div>
    `;

    this.root.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) {
        return;
      }
      this.game.audio?.unlockAudio?.();
      const action = button.dataset.action;
      if (action === "continue" || action === "close-shop") {
        this.game.save = persistFpsSave(this.game.save);
        this.game.resumeAfterIntermission();
      }
      if (action === "avatar-left") {
        this.rotateAvatar(-20);
      }
      if (action === "avatar-right") {
        this.rotateAvatar(20);
      }
      if (button.dataset.weapon) {
        this.buyOrEquip(button.dataset.weapon);
      }
      if (button.dataset.pack) {
        this.buyGrenadePack(button.dataset.pack);
      }
      if (button.dataset.gear) {
        this.buyGear(button.dataset.gear);
      }
      if (button.dataset.medkit) {
        this.buyMedKit();
      }
      if (button.dataset.armor) {
        this.buyOrEquipArmor(button.dataset.armor);
      }
      if (button.dataset.villageUpgrade) {
        this.buyVillageUpgrade();
      }
    });

    document.body.appendChild(this.root);
    this.initAvatarPreview();
    this.attachAvatarDrag();
    this.refresh();
  }

  getArmorDefs() {
    const defs = this.game.economy?.armorUpgrades;
    if (Array.isArray(defs) && defs.length) {
      return defs;
    }
    return [{ id: "cloth", label: "Cloth Jacket", cost: 0, damageReduction: 0, style: "Starter outfit" }];
  }

  getGearDefs() {
    const defs = this.game.economy?.gearItems;
    if (Array.isArray(defs) && defs.length) {
      return defs;
    }
    return [];
  }

  getShopCostMultiplier() {
    return getVillagerPerkModifiers(this.game.save).shopCostMultiplier;
  }

  getRecommendation() {
    return getFirstSessionShopRecommendation({
      save: this.game.save,
      waveNumber: this.waveNumber,
      weapons: this.game.weapons,
      economy: this.game.economy,
      currentHp: this.getCurrentPlayerHp(),
      costMultiplier: this.getShopCostMultiplier(),
    });
  }

  buyOrEquip(weaponId) {
    const weapon = this.game.weaponMap.get(weaponId);
    if (!weapon) {
      return;
    }
    const result = applyWeaponBuyOrEquip({
      weapon,
      waveNumber: this.waveNumber,
      save: this.game.save,
      costMultiplier: this.getShopCostMultiplier(),
    });
    if (result.changed) {
      this.game.save = persistFpsSave(this.game.save);
    }
    this.refresh();
  }

  buyOrEquipArmor(armorId) {
    const armor = this.getArmorDefs().find((entry) => entry.id === armorId);
    if (!armor) {
      return;
    }
    const result = applyArmorBuyOrEquip({
      armor,
      save: this.game.save,
      costMultiplier: this.getShopCostMultiplier(),
    });
    if (result.changed) {
      this.game.save = persistFpsSave(this.game.save);
    }
    this.refresh();
  }

  buyGrenadePack(packId) {
    const pack = (this.game.economy?.grenadePacks ?? []).find((entry) => entry.id === packId);
    const result = applyGrenadePackBuy({
      pack,
      waveNumber: this.waveNumber,
      save: this.game.save,
      costMultiplier: this.getShopCostMultiplier(),
    });
    if (result.changed) {
      this.game.save = persistFpsSave(this.game.save);
    }
    this.refresh();
  }

  buyGear(gearId) {
    const gear = this.getGearDefs().find((entry) => entry.id === gearId);
    const result = applyGearBuy({
      gear,
      waveNumber: this.waveNumber,
      save: this.game.save,
      costMultiplier: this.getShopCostMultiplier(),
    });
    if (result.changed) {
      this.game.save = persistFpsSave(this.game.save);
    }
    this.refresh();
  }

  getMedKitDef() {
    const def = this.game.economy?.medKit;
    return {
      label: typeof def?.label === "string" && def.label ? def.label : "Med Kit (Full Heal)",
      cost: Math.max(0, Math.round(Number(def?.cost ?? 20))),
    };
  }

  getCurrentPlayerHp() {
    return Math.max(0, Math.min(100, Number(this.game.raidScene?.playerController?.state?.hp ?? 100) || 0));
  }

  medKitDescription(currentHp, medKitState) {
    const hp = Math.round(currentHp);
    const missingHp = Math.max(0, 100 - hp);
    if (medKitState.atFullHealth) {
      return `Health ${hp}/100 · No treatment needed`;
    }
    const restoreLabel = missingHp > 0 ? `Restores +${missingHp} HP` : "Restores health";
    return `Health ${hp}/100 · ${restoreLabel} · Seals wounds before the next wave`;
  }

  buyMedKit() {
    const hp = this.getCurrentPlayerHp();
    const medKit = this.getMedKitDef();
    const result = applyMedKitBuy({
      save: this.game.save,
      currentHp: hp,
      maxHp: 100,
      cost: medKit.cost,
    });
    if (result.changed) {
      if (this.game.raidScene?.playerController?.state) {
        this.game.raidScene.playerController.state.hp = result.newHp;
      }
      this.game.save = persistFpsSave(this.game.save);
    }
    this.refresh();
  }

  buyVillageUpgrade() {
    const result = applyVillageUpgradePurchase({
      save: this.game.save,
      economy: this.game.economy,
      costMultiplier: this.getShopCostMultiplier(),
    });
    if (result.changed) {
      this.game.save = persistFpsSave(this.game.save);
      if (this.game.raidScene?.syncVillagerPerkModifiers) {
        this.game.raidScene.syncVillagerPerkModifiers({ applyVillageHealth: true });
      }
    }
    this.refresh();
  }

  weaponStyleLabel(weaponId) {
    const labels = {
      pipe: "Improvised melee",
      pistol: "15-round 9mm service pistol",
      revolver: ".357 magnum wheelgun",
      smg: "Compact 9mm roller-delay SMG",
      machine_pistol: "Select-fire auto sidearm",
      rifle: "Stamped 7.62 assault rifle",
      battle_rifle: "Full-power 7.62 NATO rifle",
      shotgun: "12-gauge pump bruiser",
      lmg: "Belt-fed support weapon",
      dmr: "Scoped 7.62 marksman rifle",
      sniper: "Bolt-action precision rifle",
      rpg: "Reusable anti-armor launcher",
      grenade_launcher: "Single-shot 40mm lobber",
      flamethrower: "Backpack fuel projector",
    };
    return labels[weaponId] ?? "General use";
  }

  weaponStatLabel(weapon) {
    const spread = Number(weapon.spreadMoa).toFixed(1);
    return `DMG ${weapon.damage} | RPM ${weapon.rpm} | Spread ${spread}`;
  }

  grenadeInventorySummary() {
    const activeGrenadeId = getActiveGrenadeId(this.game.save);
    return this.game.grenadeTypes
      .map((grenade) => {
        const count = getGrenadeCount(this.game.save, grenade.id);
        const active = grenade.id === activeGrenadeId ? "*" : "";
        return `${grenade.shortLabel}${active} ${count}`;
      })
      .join(" · ");
  }

  grenadePackDescription(pack) {
    const grenadeTypeId = pack.grenadeTypeId ?? "frag";
    const grenade = this.game.grenadeTypeMap.get(grenadeTypeId);
    const count = getGrenadeCount(this.game.save, grenadeTypeId);
    const active = getActiveGrenadeId(this.game.save) === grenadeTypeId;
    const parts = [
      grenade?.description ?? "Consumable explosive",
      `DMG ${Math.round(Number(grenade?.damage ?? 0))}`,
      `Blast ${Number(grenade?.radius ?? 0).toFixed(1)}m`,
      `Carrying ${count}`,
    ];
    if (active) {
      parts.push("Active");
    }
    return parts.join(" · ");
  }

  makeAvatarMaterial(color, { roughness = 0.72, metalness = 0.05, transparent = false, opacity = 1 } = {}) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      transparent,
      opacity,
    });
  }

  makeAvatarPart(geometry, material, position, scale = null, rotation = null) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position[0], position[1], position[2]);
    if (scale) {
      mesh.scale.set(scale[0], scale[1], scale[2]);
    }
    if (rotation) {
      mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  createAvatarModel() {
    const root = new THREE.Group();
    const materials = {
      primary: this.makeAvatarMaterial(0x6f7765),
      secondary: this.makeAvatarMaterial(0x55604d),
      accent: this.makeAvatarMaterial(0xb9bd91, { metalness: 0.12 }),
      gear: this.makeAvatarMaterial(0x263038, { roughness: 0.62, metalness: 0.18 }),
      skin: this.makeAvatarMaterial(0xefcbad, { roughness: 0.58 }),
      skinShadow: this.makeAvatarMaterial(0xd4ae8f, { roughness: 0.64 }),
      skinWarm: this.makeAvatarMaterial(0xc98f76, { roughness: 0.64 }),
      hair: this.makeAvatarMaterial(0x2a2626, { roughness: 0.82 }),
      eye: this.makeAvatarMaterial(0xeef4ff, { roughness: 0.3 }),
      pupil: this.makeAvatarMaterial(0x11151a, { roughness: 0.4 }),
      seam: this.makeAvatarMaterial(0x1a2024, { roughness: 0.86 }),
      boot: this.makeAvatarMaterial(0x111820, { roughness: 0.7 }),
      visor: this.makeAvatarMaterial(0x95d4ff, {
        roughness: 0.22,
        metalness: 0.08,
        transparent: true,
        opacity: 0.68,
      }),
      shadow: new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
    };

    const parts = {};
    const sphere = new THREE.SphereGeometry(0.5, 24, 18);
    const capsule = new THREE.CapsuleGeometry(0.5, 1, 6, 16);
    const cylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 20);
    const box = new THREE.BoxGeometry(1, 1, 1);
    const softBox = new THREE.BoxGeometry(1, 1, 1, 2, 2, 2);
    const taper = new THREE.CylinderGeometry(0.38, 0.48, 1, 24);

    parts.shadow = this.makeAvatarPart(new THREE.CircleGeometry(0.82, 32), materials.shadow, [0, 0.015, 0], [1.24, 0.62, 1], [-Math.PI / 2, 0, 0]);
    parts.shadow.castShadow = false;
    parts.shadow.receiveShadow = false;
    root.add(parts.shadow);

    parts.leftLeg = this.makeAvatarPart(capsule, materials.secondary, [-0.18, 0.6, 0], [0.14, 0.54, 0.13], [0.03, 0, -0.04]);
    parts.rightLeg = this.makeAvatarPart(capsule, materials.secondary, [0.18, 0.6, 0], [0.14, 0.54, 0.13], [0.03, 0, 0.04]);
    parts.leftBoot = this.makeAvatarPart(softBox, materials.boot, [-0.2, 0.16, 0.12], [0.23, 0.13, 0.43], [0.02, 0.08, -0.02]);
    parts.rightBoot = this.makeAvatarPart(softBox, materials.boot, [0.2, 0.16, 0.12], [0.23, 0.13, 0.43], [0.02, -0.08, 0.02]);
    parts.leftBootToe = this.makeAvatarPart(sphere, materials.boot, [-0.2, 0.15, 0.33], [0.22, 0.08, 0.16]);
    parts.rightBootToe = this.makeAvatarPart(sphere, materials.boot, [0.2, 0.15, 0.33], [0.22, 0.08, 0.16]);
    parts.torso = this.makeAvatarPart(taper, materials.primary, [0, 1.27, 0], [0.78, 0.86, 0.58]);
    parts.pelvis = this.makeAvatarPart(sphere, materials.secondary, [0, 0.83, 0.02], [0.34, 0.2, 0.26]);
    parts.chestPlate = this.makeAvatarPart(softBox, materials.accent, [0, 1.38, 0.27], [0.42, 0.3, 0.07]);
    parts.leftJacketPanel = this.makeAvatarPart(softBox, materials.primary, [-0.18, 1.19, 0.31], [0.2, 0.56, 0.045], [0, 0.02, -0.04]);
    parts.rightJacketPanel = this.makeAvatarPart(softBox, materials.primary, [0.18, 1.19, 0.31], [0.2, 0.56, 0.045], [0, -0.02, 0.04]);
    parts.jacketSeam = this.makeAvatarPart(box, materials.seam, [0, 1.18, 0.345], [0.022, 0.6, 0.018]);
    parts.belt = this.makeAvatarPart(softBox, materials.gear, [0, 0.9, 0.31], [0.58, 0.09, 0.1]);
    parts.buckle = this.makeAvatarPart(box, materials.accent, [0, 0.9, 0.37], [0.12, 0.075, 0.035]);
    parts.neck = this.makeAvatarPart(cylinder, materials.skinShadow, [0, 1.73, 0], [0.14, 0.18, 0.14]);
    parts.head = this.makeAvatarPart(sphere, materials.skin, [0, 2.04, 0.02], [0.32, 0.39, 0.3]);
    parts.chin = this.makeAvatarPart(sphere, materials.skinWarm, [0, 1.84, 0.18], [0.18, 0.09, 0.13]);
    parts.hair = this.makeAvatarPart(sphere, materials.hair, [0, 2.25, -0.01], [0.34, 0.16, 0.32]);
    parts.frontHair = this.makeAvatarPart(sphere, materials.hair, [-0.06, 2.18, 0.22], [0.24, 0.09, 0.12]);
    parts.leftEar = this.makeAvatarPart(sphere, materials.skinShadow, [-0.32, 2.03, 0.02], [0.055, 0.095, 0.04]);
    parts.rightEar = this.makeAvatarPart(sphere, materials.skinShadow, [0.32, 2.03, 0.02], [0.055, 0.095, 0.04]);

    parts.leftEye = this.makeAvatarPart(sphere, materials.eye, [-0.105, 2.07, 0.29], [0.047, 0.026, 0.015]);
    parts.rightEye = this.makeAvatarPart(sphere, materials.eye, [0.105, 2.07, 0.29], [0.047, 0.026, 0.015]);
    parts.leftPupil = this.makeAvatarPart(sphere, materials.pupil, [-0.105, 2.07, 0.305], [0.018, 0.018, 0.008]);
    parts.rightPupil = this.makeAvatarPart(sphere, materials.pupil, [0.105, 2.07, 0.305], [0.018, 0.018, 0.008]);
    parts.leftBrow = this.makeAvatarPart(box, materials.hair, [-0.105, 2.13, 0.295], [0.1, 0.018, 0.016], [0, 0, -0.08]);
    parts.rightBrow = this.makeAvatarPart(box, materials.hair, [0.105, 2.13, 0.295], [0.1, 0.018, 0.016], [0, 0, 0.08]);
    parts.nose = this.makeAvatarPart(sphere, materials.skinShadow, [0, 1.995, 0.315], [0.042, 0.075, 0.045]);
    parts.noseBridge = this.makeAvatarPart(box, materials.skinShadow, [0, 2.04, 0.295], [0.035, 0.1, 0.016]);
    parts.mouth = this.makeAvatarPart(box, materials.gear, [0, 1.9, 0.3], [0.14, 0.014, 0.014]);
    parts.lowerLip = this.makeAvatarPart(box, materials.skinWarm, [0, 1.875, 0.295], [0.1, 0.012, 0.014]);

    parts.leftArm = this.makeAvatarPart(capsule, materials.primary, [-0.49, 1.16, 0.02], [0.12, 0.48, 0.12], [0, 0.05, -0.14]);
    parts.rightArm = this.makeAvatarPart(capsule, materials.primary, [0.49, 1.16, 0.02], [0.12, 0.48, 0.12], [0, -0.05, 0.14]);
    parts.leftElbow = this.makeAvatarPart(sphere, materials.secondary, [-0.55, 1.03, 0.08], [0.12, 0.1, 0.11]);
    parts.rightElbow = this.makeAvatarPart(sphere, materials.secondary, [0.55, 1.03, 0.08], [0.12, 0.1, 0.11]);
    parts.leftCuff = this.makeAvatarPart(cylinder, materials.gear, [-0.6, 0.74, 0.1], [0.11, 0.07, 0.11], [0.2, 0, -0.12]);
    parts.rightCuff = this.makeAvatarPart(cylinder, materials.gear, [0.6, 0.74, 0.1], [0.11, 0.07, 0.11], [0.2, 0, 0.12]);
    parts.leftHand = this.makeAvatarPart(sphere, materials.skin, [-0.62, 0.65, 0.12], [0.095, 0.09, 0.08]);
    parts.rightHand = this.makeAvatarPart(sphere, materials.skin, [0.62, 0.65, 0.12], [0.095, 0.09, 0.08]);
    parts.leftThumb = this.makeAvatarPart(sphere, materials.skinShadow, [-0.56, 0.65, 0.18], [0.035, 0.03, 0.05]);
    parts.rightThumb = this.makeAvatarPart(sphere, materials.skinShadow, [0.56, 0.65, 0.18], [0.035, 0.03, 0.05]);

    parts.hood = this.makeAvatarPart(sphere, materials.primary, [0, 2.05, -0.01], [0.47, 0.54, 0.43]);
    parts.helmet = this.makeAvatarPart(sphere, materials.accent, [0, 2.18, 0.01], [0.45, 0.24, 0.42]);
    parts.helmetRim = this.makeAvatarPart(cylinder, materials.gear, [0, 2.06, 0.06], [0.47, 0.08, 0.42], [Math.PI / 2, 0, 0]);
    parts.visor = this.makeAvatarPart(box, materials.visor, [0, 2.05, 0.38], [0.32, 0.12, 0.035]);
    parts.leftShoulder = this.makeAvatarPart(sphere, materials.accent, [-0.48, 1.55, 0.02], [0.22, 0.16, 0.25]);
    parts.rightShoulder = this.makeAvatarPart(sphere, materials.accent, [0.48, 1.55, 0.02], [0.22, 0.16, 0.25]);
    parts.chestRig = this.makeAvatarPart(box, materials.gear, [0, 1.28, 0.37], [0.52, 0.42, 0.08]);
    parts.leftStrap = this.makeAvatarPart(box, materials.gear, [-0.19, 1.37, 0.39], [0.08, 0.58, 0.04], [0, 0, -0.35]);
    parts.rightStrap = this.makeAvatarPart(box, materials.gear, [0.19, 1.37, 0.39], [0.08, 0.58, 0.04], [0, 0, 0.35]);
    parts.leftPouch = this.makeAvatarPart(box, materials.secondary, [-0.36, 0.95, 0.34], [0.16, 0.22, 0.1]);
    parts.rightPouch = this.makeAvatarPart(box, materials.secondary, [0.36, 0.95, 0.34], [0.16, 0.22, 0.1]);
    parts.leftKneepad = this.makeAvatarPart(box, materials.gear, [-0.2, 0.52, 0.2], [0.2, 0.15, 0.06]);
    parts.rightKneepad = this.makeAvatarPart(box, materials.gear, [0.2, 0.52, 0.2], [0.2, 0.15, 0.06]);
    parts.leftPantSeam = this.makeAvatarPart(box, materials.seam, [-0.08, 0.56, 0.14], [0.018, 0.64, 0.014]);
    parts.rightPantSeam = this.makeAvatarPart(box, materials.seam, [0.08, 0.56, 0.14], [0.018, 0.64, 0.014]);
    parts.leftCanister = this.makeAvatarPart(cylinder, materials.accent, [-0.5, 1.06, -0.18], [0.08, 0.34, 0.08]);
    parts.rightCanister = this.makeAvatarPart(cylinder, materials.accent, [0.5, 1.06, -0.18], [0.08, 0.34, 0.08]);

    root.add(
      parts.leftLeg,
      parts.rightLeg,
      parts.leftBoot,
      parts.rightBoot,
      parts.leftBootToe,
      parts.rightBootToe,
      parts.torso,
      parts.pelvis,
      parts.chestPlate,
      parts.leftJacketPanel,
      parts.rightJacketPanel,
      parts.jacketSeam,
      parts.belt,
      parts.buckle,
      parts.neck,
      parts.head,
      parts.chin,
      parts.hair,
      parts.frontHair,
      parts.leftEar,
      parts.rightEar,
      parts.leftEye,
      parts.rightEye,
      parts.leftPupil,
      parts.rightPupil,
      parts.leftBrow,
      parts.rightBrow,
      parts.nose,
      parts.noseBridge,
      parts.mouth,
      parts.lowerLip,
      parts.leftArm,
      parts.rightArm,
      parts.leftElbow,
      parts.rightElbow,
      parts.leftCuff,
      parts.rightCuff,
      parts.leftHand,
      parts.rightHand,
      parts.leftThumb,
      parts.rightThumb,
      parts.hood,
      parts.helmet,
      parts.helmetRim,
      parts.visor,
      parts.leftShoulder,
      parts.rightShoulder,
      parts.chestRig,
      parts.leftStrap,
      parts.rightStrap,
      parts.leftPouch,
      parts.rightPouch,
      parts.leftKneepad,
      parts.rightKneepad,
      parts.leftPantSeam,
      parts.rightPantSeam,
      parts.leftCanister,
      parts.rightCanister,
    );

    root.position.y = -0.08;
    root.userData = { materials, parts };
    return root;
  }

  initAvatarPreview() {
    const canvas = this.root?.querySelector('[data-bind="avatar"]');
    const stage = this.root?.querySelector('[data-bind="avatar-stage"]');
    if (!canvas || !stage) {
      return;
    }

    this.avatarScene = new THREE.Scene();
    this.avatarCamera = new THREE.PerspectiveCamera(34, 1, 0.1, 24);
    this.avatarCamera.position.set(0, 1.28, 5.2);
    this.avatarCamera.lookAt(0, 1.22, 0);

    this.avatarRenderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    this.avatarRenderer.setClearColor(0x000000, 0);
    this.avatarRenderer.shadowMap.enabled = true;
    this.avatarRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(3.2, 4.2, 4.5);
    keyLight.castShadow = true;
    const fillLight = new THREE.HemisphereLight(0xcce6ff, 0x1c241a, 1.45);
    const rimLight = new THREE.DirectionalLight(0xa8ccff, 1.2);
    rimLight.position.set(-3.4, 2.5, -2.4);
    this.avatarScene.add(fillLight, keyLight, rimLight);

    this.avatarModel = this.createAvatarModel();
    this.avatarScene.add(this.avatarModel);

    if (typeof ResizeObserver !== "undefined") {
      this.avatarResizeObserver = new ResizeObserver(() => this.resizeAvatarPreview());
      this.avatarResizeObserver.observe(stage);
    }
    this.resizeAvatarPreview();
  }

  resizeAvatarPreview() {
    const stage = this.root?.querySelector('[data-bind="avatar-stage"]');
    if (!stage || !this.avatarRenderer || !this.avatarCamera) {
      return;
    }
    const rect = stage.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    this.avatarRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.avatarRenderer.setSize(width, height, false);
    this.avatarCamera.aspect = width / height;
    this.avatarCamera.updateProjectionMatrix();
    this.renderAvatarPreview();
  }

  syncAvatarArmorModel(armorId) {
    if (!this.avatarModel?.userData) {
      return;
    }
    const style = ARMOR_PREVIEW_STYLES[armorId] ?? ARMOR_PREVIEW_STYLES.cloth;
    const { materials, parts } = this.avatarModel.userData;
    materials.primary.color.setHex(style.primary);
    materials.secondary.color.setHex(style.secondary);
    materials.accent.color.setHex(style.accent);
    materials.gear.color.setHex(style.gear);
    materials.visor.color.setHex(style.visor);
    materials.skin.color.setHex(style.skinHidden ? style.gear : 0xefcbad);
    materials.skinShadow.color.setHex(style.skinHidden ? style.secondary : 0xd4ae8f);
    materials.skinWarm.color.setHex(style.skinHidden ? style.secondary : 0xc98f76);

    const showFace = !style.skinHidden;
    for (const key of [
      "hair",
      "frontHair",
      "leftEar",
      "rightEar",
      "leftEye",
      "rightEye",
      "leftPupil",
      "rightPupil",
      "leftBrow",
      "rightBrow",
      "nose",
      "noseBridge",
      "mouth",
      "lowerLip",
      "chin",
    ]) {
      parts[key].visible = showFace && !style.helmet && !style.hood;
    }
    parts.neck.visible = showFace;
    parts.leftHand.visible = showFace;
    parts.rightHand.visible = showFace;
    parts.leftThumb.visible = showFace;
    parts.rightThumb.visible = showFace;
    parts.hood.visible = Boolean(style.hood);
    parts.helmet.visible = Boolean(style.helmet);
    parts.helmetRim.visible = Boolean(style.helmet);
    parts.visor.visible = Boolean(style.helmet || style.skinHidden);
    parts.leftShoulder.visible = Boolean(style.shoulders);
    parts.rightShoulder.visible = Boolean(style.shoulders);
    parts.chestRig.visible = Boolean(style.chestRig);
    parts.leftStrap.visible = Boolean(style.chestRig);
    parts.rightStrap.visible = Boolean(style.chestRig);
    parts.belt.visible = Boolean(style.belt);
    parts.leftPouch.visible = Boolean(style.pouches);
    parts.rightPouch.visible = Boolean(style.pouches);
    parts.leftKneepad.visible = Boolean(style.kneepads);
    parts.rightKneepad.visible = Boolean(style.kneepads);
    parts.leftCanister.visible = Boolean(style.canisters);
    parts.rightCanister.visible = Boolean(style.canisters);

    const bulk = style.bulk ?? 1;
    parts.torso.scale.set(0.78 * bulk, 0.86 * bulk, 0.58 * bulk);
    parts.leftArm.scale.set(0.12 * bulk, 0.48 * bulk, 0.12 * bulk);
    parts.rightArm.scale.set(0.12 * bulk, 0.48 * bulk, 0.12 * bulk);
    parts.leftElbow.scale.set(0.12 * bulk, 0.1 * bulk, 0.11 * bulk);
    parts.rightElbow.scale.set(0.12 * bulk, 0.1 * bulk, 0.11 * bulk);
    this.renderAvatarPreview();
  }

  renderAvatarPreview() {
    if (!this.avatarRenderer || !this.avatarScene || !this.avatarCamera || !this.avatarModel) {
      return;
    }
    const idle = Math.sin(this.avatarElapsed * 2.4);
    this.avatarModel.rotation.y = THREE.MathUtils.degToRad(this.avatarYaw) + idle * 0.015;
    this.avatarModel.position.y = -0.08 + idle * 0.012;
    const parts = this.avatarModel.userData.parts;
    parts.leftArm.rotation.z = -0.18 + idle * 0.018;
    parts.rightArm.rotation.z = 0.18 - idle * 0.018;
    this.avatarRenderer.render(this.avatarScene, this.avatarCamera);
  }

  disposeAvatarPreview() {
    this.avatarResizeObserver?.disconnect();
    this.avatarResizeObserver = null;
    if (this.avatarModel) {
      this.avatarModel.traverse((node) => {
        if (node.geometry) {
          node.geometry.dispose();
        }
      });
      for (const material of Object.values(this.avatarModel.userData?.materials ?? {})) {
        material.dispose?.();
      }
    }
    this.avatarRenderer?.dispose();
    this.avatarRenderer = null;
    this.avatarScene = null;
    this.avatarCamera = null;
    this.avatarModel = null;
  }

  gearDescription(gear) {
    return typeof gear.description === "string" && gear.description
      ? gear.description
      : "Permanent field tool.";
  }

  rotateAvatar(deltaDegrees) {
    this.avatarYaw = (this.avatarYaw + deltaDegrees) % 360;
    this.syncAvatar();
  }

  attachAvatarDrag() {
    const stage = this.root.querySelector('[data-bind="avatar-stage"]');
    if (!stage) {
      return;
    }

    stage.addEventListener("pointerdown", (event) => {
      this.avatarDragPointer = event.pointerId;
      this.avatarDragLastX = event.clientX;
      stage.setPointerCapture(event.pointerId);
    });

    stage.addEventListener("pointermove", (event) => {
      if (event.pointerId !== this.avatarDragPointer) {
        return;
      }
      const deltaX = event.clientX - this.avatarDragLastX;
      this.avatarDragLastX = event.clientX;
      this.rotateAvatar(deltaX * 0.6);
    });

    const clearPointer = (event) => {
      if (event.pointerId !== this.avatarDragPointer) {
        return;
      }
      this.avatarDragPointer = null;
    };

    stage.addEventListener("pointerup", clearPointer);
    stage.addEventListener("pointercancel", clearPointer);
  }

  syncAvatar() {
    const avatar = this.root?.querySelector('[data-bind="avatar"]');
    if (!avatar) {
      return;
    }

    const armorDefs = this.getArmorDefs();
    const equippedArmor = armorDefs.find((entry) => entry.id === this.game.save.equippedArmorId) ?? armorDefs[0];
    avatar.className = `fps-player-avatar-3d armor-${equippedArmor.id}`;
    avatar.dataset.armorId = equippedArmor.id;
    this.syncAvatarArmorModel(equippedArmor.id);
    const caption = this.root.querySelector('[data-bind="armor-caption"]');
    if (caption) {
      const reduction = Math.round((Number(equippedArmor.damageReduction ?? 0) || 0) * 100);
      const style = equippedArmor.style ? ` · ${equippedArmor.style}` : "";
      caption.textContent = `Armor: ${equippedArmor.label} (${reduction}% damage resist)${style}`;
    }
  }

  refresh() {
    const coinsEl = this.root.querySelector('[data-bind="coins"]');
    const grenadesEl = this.root.querySelector('[data-bind="grenades"]');
    const recommendationEl = this.root.querySelector('[data-bind="recommendation"]');
    const weaponsEl = this.root.querySelector('[data-bind="weapons"]');
    const gearEl = this.root.querySelector('[data-bind="gear"]');
    const ordnanceEl = this.root.querySelector('[data-bind="ordnance"]');
    const armorsEl = this.root.querySelector('[data-bind="armors"]');
    const villageUpgradeEl = this.root.querySelector('[data-bind="village-upgrade"]');
    coinsEl.textContent = String(this.game.save.coins);
    grenadesEl.textContent = this.grenadeInventorySummary();

    const costMultiplier = this.getShopCostMultiplier();
    const recommendation = this.getRecommendation();
    if (recommendationEl) {
      recommendationEl.innerHTML = `
        <strong>${escapeHtml(recommendation.title)}</strong>
        <span>${escapeHtml(recommendation.reason)}</span>
      `;
    }

    weaponsEl.innerHTML = "";
    for (const weapon of this.game.weapons.filter((entry) => entry.id !== "pipe")) {
      const row = document.createElement("div");
      row.className = "fps-shop-row";
      if (recommendation.targetType === "weapon" && recommendation.targetId === weapon.id) {
        row.classList.add("is-recommended");
      }

      const state = getWeaponShopState({
        weapon,
        waveNumber: this.waveNumber,
        save: this.game.save,
        costMultiplier,
      });
      if (state.disabled) {
        row.classList.add("is-unavailable");
      }
      row.innerHTML = `
        <span class="fps-shop-weapon-meta">
          <span class="fps-shop-title-row">
            <strong>${escapeHtml(weapon.label)}</strong>
            ${recommendation.targetType === "weapon" && recommendation.targetId === weapon.id ? '<span class="fps-shop-badge recommended">Recommended</span>' : ""}
            ${state.owned ? '<span class="fps-shop-badge owned">Owned</span>' : ""}
            ${state.equipped ? '<span class="fps-shop-badge equipped">Equipped</span>' : ""}
          </span>
          <small>${escapeHtml(this.weaponStyleLabel(weapon.id))} · ${escapeHtml(this.weaponStatLabel(weapon))}</small>
        </span>
        <button data-weapon="${escapeHtml(weapon.id)}" ${state.disabled ? "disabled" : ""}>${escapeHtml(state.status)}</button>
      `;
      weaponsEl.appendChild(row);
    }

    const pipeRow = document.createElement("div");
    pipeRow.className = "fps-shop-row";
    const pipeEquipped = this.game.save.equippedWeaponId === "pipe";
    pipeRow.innerHTML = `
      <span class="fps-shop-weapon-meta">
        <span class="fps-shop-title-row">
          <strong>Pipe</strong>
          <span class="fps-shop-badge owned">Owned</span>
          ${pipeEquipped ? '<span class="fps-shop-badge equipped">Equipped</span>' : ""}
        </span>
        <small>${this.weaponStyleLabel("pipe")} · Starts equipped</small>
      </span>
      <button data-weapon="pipe">${pipeEquipped ? "Equipped" : "Equip"}</button>
    `;
    weaponsEl.prepend(pipeRow);

    gearEl.innerHTML = "";
    for (const gear of this.getGearDefs()) {
      const state = getGearShopState({
        gear,
        waveNumber: this.waveNumber,
        save: this.game.save,
        costMultiplier,
      });
      const row = document.createElement("div");
      row.className = "fps-shop-row";
      if (recommendation.targetType === "gear" && recommendation.targetId === gear.id) {
        row.classList.add("is-recommended");
      }
      if (state.disabled) {
        row.classList.add("is-unavailable");
      }
      row.innerHTML = `
        <span class="fps-shop-weapon-meta">
          <span class="fps-shop-title-row">
            <strong>${escapeHtml(gear.label)}</strong>
            ${recommendation.targetType === "gear" && recommendation.targetId === gear.id ? '<span class="fps-shop-badge recommended">Recommended</span>' : ""}
            ${state.owned ? '<span class="fps-shop-badge owned">Owned</span>' : ""}
          </span>
          <small>${escapeHtml(this.gearDescription(gear))}</small>
        </span>
        <button data-gear="${escapeHtml(gear.id)}" ${state.disabled || state.owned ? "disabled" : ""}>${escapeHtml(state.status)}</button>
      `;
      gearEl.appendChild(row);
    }

    ordnanceEl.innerHTML = "";
    for (const pack of this.game.economy?.grenadePacks ?? []) {
      const packRow = document.createElement("div");
      packRow.className = "fps-shop-row";
      if (recommendation.targetType === "pack" && recommendation.targetId === pack.id) {
        packRow.classList.add("is-recommended");
      }
      const state = getGrenadePackShopState({
        pack,
        waveNumber: this.waveNumber,
        save: this.game.save,
        costMultiplier,
      });
      if (state.disabled) {
        packRow.classList.add("is-unavailable");
      }
      packRow.innerHTML = `
        <span class="fps-shop-weapon-meta">
          <span class="fps-shop-title-row">
            <strong>${escapeHtml(pack.label)}</strong>
            ${recommendation.targetType === "pack" && recommendation.targetId === pack.id ? '<span class="fps-shop-badge recommended">Recommended</span>' : ""}
          </span>
          <small>${escapeHtml(this.grenadePackDescription(pack))}</small>
        </span>
        <button data-pack="${escapeHtml(pack.id)}" ${state.disabled ? "disabled" : ""}>${escapeHtml(state.status)}</button>
      `;
      ordnanceEl.appendChild(packRow);
    }

    const medKit = this.getMedKitDef();
    const currentHp = this.getCurrentPlayerHp();
    const medKitState = getMedKitShopState({
      save: this.game.save,
      currentHp,
      maxHp: 100,
      cost: medKit.cost,
    });
    const medKitRow = document.createElement("div");
    medKitRow.className = "fps-shop-row fps-medkit-row";
    if (recommendation.targetType === "medkit") {
      medKitRow.classList.add("is-recommended");
    }
    if (medKitState.disabled) {
      medKitRow.classList.add("is-unavailable");
    }
    medKitRow.innerHTML = `
      <span class="fps-shop-medkit-meta">
        <span class="fps-medkit-icon" aria-hidden="true">
          <span class="fps-medkit-handle"></span>
          <span class="fps-medkit-cross horizontal"></span>
          <span class="fps-medkit-cross vertical"></span>
        </span>
        <span class="fps-shop-weapon-meta">
          <span class="fps-shop-title-row">
            <strong>${escapeHtml(medKit.label)}</strong>
            ${recommendation.targetType === "medkit" ? '<span class="fps-shop-badge recommended">Recommended</span>' : ""}
            <span class="fps-shop-badge medkit">${escapeHtml(`${Math.round(currentHp)}/100 HP`)}</span>
          </span>
          <small>${escapeHtml(this.medKitDescription(currentHp, medKitState))}</small>
        </span>
      </span>
      <button data-medkit="1" ${medKitState.disabled ? "disabled" : ""}>${escapeHtml(medKitState.status)}</button>
    `;
    ordnanceEl.appendChild(medKitRow);

    armorsEl.innerHTML = "";
    for (const armor of this.getArmorDefs()) {
      const state = getArmorShopState({
        armor,
        save: this.game.save,
        costMultiplier,
      });
      const reduction = Math.round((Number(armor.damageReduction ?? 0) || 0) * 100);
      const row = document.createElement("div");
      row.className = "fps-shop-row";
      if (recommendation.targetType === "armor" && recommendation.targetId === armor.id) {
        row.classList.add("is-recommended");
      }
      if (state.disabled) {
        row.classList.add("is-unavailable");
      }
      row.innerHTML = `
        <span class="fps-shop-weapon-meta">
          <span class="fps-shop-title-row">
            <strong>${escapeHtml(armor.label)}</strong>
            ${recommendation.targetType === "armor" && recommendation.targetId === armor.id ? '<span class="fps-shop-badge recommended">Recommended</span>' : ""}
            ${state.owned ? '<span class="fps-shop-badge owned">Owned</span>' : ""}
            ${state.equipped ? '<span class="fps-shop-badge equipped">Equipped</span>' : ""}
          </span>
          <small>${escapeHtml(armor.style)} · ${escapeHtml(`${reduction}% damage resist`)}</small>
        </span>
        <button data-armor="${escapeHtml(armor.id)}" ${state.disabled ? "disabled" : ""}>${escapeHtml(state.status)}</button>
      `;
      armorsEl.appendChild(row);
    }

    const villageUpgrade = getVillageUpgradeState({
      save: this.game.save,
      economy: this.game.economy,
      costMultiplier,
    });
    villageUpgradeEl.innerHTML = "";
    const villageRow = document.createElement("div");
    villageRow.className = "fps-shop-row";
    if (recommendation.targetType === "village") {
      villageRow.classList.add("is-recommended");
    }
    if (villageUpgrade.disabled && !villageUpgrade.atMax) {
      villageRow.classList.add("is-unavailable");
    }
    villageRow.innerHTML = `
      <span class="fps-shop-weapon-meta">
        <span class="fps-shop-title-row">
          <strong>${escapeHtml(villageUpgrade.label)}</strong>
          ${recommendation.targetType === "village" ? '<span class="fps-shop-badge recommended">Recommended</span>' : ""}
          <span class="fps-shop-badge owned">Lv ${escapeHtml(villageUpgrade.level)}/${escapeHtml(villageUpgrade.maxLevel)}</span>
        </span>
        <small>
          Max village HP: +${escapeHtml(villageUpgrade.hpBonusPercent)}%${villageUpgrade.atMax ? "" : ` -> +${escapeHtml(villageUpgrade.nextHpBonusPercent)}%`}
        </small>
      </span>
      <button data-village-upgrade="1" ${villageUpgrade.disabled ? "disabled" : ""}>${escapeHtml(villageUpgrade.status)}</button>
    `;
    villageUpgradeEl.appendChild(villageRow);

    this.syncAvatar();
  }

  exit() {
    this.disposeAvatarPreview();
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
    this.avatarDragPointer = null;
  }

  renderGameToText() {
    const medKit = this.getMedKitDef();
    const medKitHp = this.getCurrentPlayerHp();
    const medKitState = getMedKitShopState({
      save: this.game.save,
      currentHp: medKitHp,
      maxHp: 100,
      cost: medKit.cost,
    });
    const recommendation = this.getRecommendation();
    return JSON.stringify({
      mode: "shop",
      wave: this.waveNumber,
      coins: this.game.save.coins,
      equippedWeapon: this.game.save.equippedWeaponId,
      ownedWeapons: this.game.save.ownedWeapons,
      equippedArmor: this.game.save.equippedArmorId,
      ownedGear: this.game.save.ownedGear ?? [],
      villageLevel: this.game.save.villageLevel ?? 1,
      avatarYaw: Number(this.avatarYaw.toFixed(1)),
      avatarPreview: "3d",
      medKit: {
        label: medKit.label,
        currentHp: Number(medKitHp.toFixed(1)),
        cost: medKitState.cost,
        disabled: medKitState.disabled,
        status: medKitState.status,
      },
      recommendation,
    });
  }

  advanceSimulation(ms = 0) {
    this.avatarElapsed += Math.max(0, Number(ms) || 0) / 1000;
    this.renderAvatarPreview();
  }
}
