import { persistFpsSave } from "../systems/saveFps";
import {
  applyArmorBuyOrEquip,
  applyGrenadePackBuy,
  applyMedKitBuy,
  applyVillageUpgradePurchase,
  applyWeaponBuyOrEquip,
  getArmorShopState,
  getGrenadePackShopState,
  getMedKitShopState,
  getVillageUpgradeState,
  getWeaponShopState,
} from "../systems/shopRules";
import { getActiveGrenadeId, getGrenadeCount } from "../systems/grenadeLoadout";
import { escapeHtml } from "../systems/safeHtml";
import { computeDiscountedCost, getVillagerPerkModifiers } from "../systems/villagerEscortRules";

export class ShopScene3D {
  constructor(game) {
    this.game = game;
    this.root = null;
    this.avatarYaw = 0;
    this.avatarDragPointer = null;
    this.avatarDragLastX = 0;
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
        <div class="fps-shop-columns">
          <div class="fps-shop-main">
            <h3>Weapons</h3>
            <div class="fps-shop-list" data-bind="weapons"></div>
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
	              <div class="fps-player-avatar armor-cloth" data-bind="avatar">
	                <div class="avatar-shadow"></div>
	                <div class="avatar-coat-tail"></div>
	                <div class="avatar-neck"></div>
	                <div class="avatar-collar"></div>
	                <div class="avatar-hood"></div>
	                <div class="avatar-helmet-shell"></div>
	                <div class="avatar-helmet-rim"></div>
	                <div class="avatar-visor"></div>
	                <div class="avatar-headset left"></div>
	                <div class="avatar-headset right"></div>
	                <div class="avatar-mask"></div>
	                <div class="avatar-respirator"></div>
	                <div class="avatar-canister left"></div>
	                <div class="avatar-canister right"></div>
	                <div class="avatar-head">
	                  <div class="avatar-hair"></div>
	                  <div class="avatar-ear left"></div>
	                  <div class="avatar-ear right"></div>
	                  <div class="avatar-eye left"></div>
	                  <div class="avatar-eye right"></div>
	                  <div class="avatar-nose"></div>
	                  <div class="avatar-mouth"></div>
	                </div>
	                <div class="avatar-shoulder left"></div>
	                <div class="avatar-shoulder right"></div>
	                <div class="avatar-chain-overlay"></div>
	                <div class="avatar-chest-rig"></div>
	                <div class="avatar-torso"></div>
	                <div class="avatar-belt"></div>
	                <div class="avatar-pouch left"></div>
	                <div class="avatar-pouch right"></div>
	                <div class="avatar-arm left"></div>
	                <div class="avatar-arm right"></div>
	                <div class="avatar-kneepad left"></div>
	                <div class="avatar-kneepad right"></div>
	                <div class="avatar-leg left"></div>
	                <div class="avatar-leg right"></div>
	              </div>
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

  getShopCostMultiplier() {
    return getVillagerPerkModifiers(this.game.save).shopCostMultiplier;
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

  getMedKitDef() {
    const def = this.game.economy?.medKit;
    return {
      label: typeof def?.label === "string" && def.label ? def.label : "Med Kit (Full Heal)",
      cost: Math.max(0, Math.round(Number(def?.cost ?? 20))),
    };
  }

  buyMedKit() {
    const hp = this.game.raidScene?.playerController?.state?.hp ?? 100;
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
    avatar.style.setProperty("--avatar-yaw", `${this.avatarYaw.toFixed(1)}deg`);

    const armorDefs = this.getArmorDefs();
    const equippedArmor = armorDefs.find((entry) => entry.id === this.game.save.equippedArmorId) ?? armorDefs[0];
    avatar.className = `fps-player-avatar armor-${equippedArmor.id}`;
    avatar.dataset.armorId = equippedArmor.id;
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
    const weaponsEl = this.root.querySelector('[data-bind="weapons"]');
    const ordnanceEl = this.root.querySelector('[data-bind="ordnance"]');
    const armorsEl = this.root.querySelector('[data-bind="armors"]');
    const villageUpgradeEl = this.root.querySelector('[data-bind="village-upgrade"]');
    coinsEl.textContent = String(this.game.save.coins);
    grenadesEl.textContent = this.grenadeInventorySummary();

    const costMultiplier = this.getShopCostMultiplier();

    weaponsEl.innerHTML = "";
    for (const weapon of this.game.weapons.filter((entry) => entry.id !== "pipe")) {
      const row = document.createElement("div");
      row.className = "fps-shop-row";

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

    ordnanceEl.innerHTML = "";
    for (const pack of this.game.economy?.grenadePacks ?? []) {
      const packRow = document.createElement("div");
      packRow.className = "fps-shop-row";
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
          <strong>${escapeHtml(pack.label)}</strong>
          <small>${escapeHtml(this.grenadePackDescription(pack))}</small>
        </span>
        <button data-pack="${escapeHtml(pack.id)}" ${state.disabled ? "disabled" : ""}>${escapeHtml(state.status)}</button>
      `;
      ordnanceEl.appendChild(packRow);
    }

    const medKit = this.getMedKitDef();
    const medKitState = getMedKitShopState({
      save: this.game.save,
      currentHp: this.game.raidScene?.playerController?.state?.hp ?? 100,
      maxHp: 100,
      cost: medKit.cost,
    });
    const medKitRow = document.createElement("div");
    medKitRow.className = "fps-shop-row";
    if (medKitState.disabled) {
      medKitRow.classList.add("is-unavailable");
    }
    medKitRow.innerHTML = `
      <span class="fps-shop-weapon-meta">
        <strong>${escapeHtml(medKit.label)}</strong>
        <small>Restores health to full</small>
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
      if (state.disabled) {
        row.classList.add("is-unavailable");
      }
      row.innerHTML = `
        <span class="fps-shop-weapon-meta">
          <span class="fps-shop-title-row">
            <strong>${escapeHtml(armor.label)}</strong>
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
    if (villageUpgrade.disabled && !villageUpgrade.atMax) {
      villageRow.classList.add("is-unavailable");
    }
    villageRow.innerHTML = `
      <span class="fps-shop-weapon-meta">
        <span class="fps-shop-title-row">
          <strong>${escapeHtml(villageUpgrade.label)}</strong>
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
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
    this.avatarDragPointer = null;
  }

  renderGameToText() {
    return JSON.stringify({
      mode: "shop",
      wave: this.waveNumber,
      coins: this.game.save.coins,
      equippedWeapon: this.game.save.equippedWeaponId,
      ownedWeapons: this.game.save.ownedWeapons,
      equippedArmor: this.game.save.equippedArmorId,
      villageLevel: this.game.save.villageLevel ?? 1,
      avatarYaw: Number(this.avatarYaw.toFixed(1)),
    });
  }

  advanceSimulation() {}
}
