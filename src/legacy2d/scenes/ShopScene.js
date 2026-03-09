import Phaser from "phaser";

export class ShopScene extends Phaser.Scene {
  constructor() {
    super("ShopScene");
    this.cursor = 0;
  }

  init(data) {
    this.from = data.from ?? "HubScene";
  }

  create() {
    this.session = this.game.session;
    this.backdrop = this.add.rectangle(480, 320, 960, 640, 0x000000, 0.72);
    this.panel = this.add.rectangle(480, 320, 860, 560, 0x1a2235, 0.95).setStrokeStyle(3, 0xff9f43);
    this.title = this.add
      .text(480, 62, "Village Shop", { fontSize: "44px", color: "#ffcf74", fontStyle: "bold" })
      .setOrigin(0.5);

    this.info = this.add.text(120, 104, "", { fontSize: "22px", color: "#ffffff" });
    this.help = this.add
      .text(480, 588, "Arrow keys + Enter to buy/equip. Esc closes shop.", {
        fontSize: "20px",
        color: "#d8ddf0",
      })
      .setOrigin(0.5);

    this.rows = [];
    this.buildRows();

    this.keys = this.input.keyboard.addKeys({
      up: "UP",
      down: "DOWN",
      enter: "ENTER",
      esc: "ESC",
    });

    this.input.keyboard.on("keydown-ESC", () => this.closeShop());
  }

  buildRows() {
    const weaponRows = this.session.weapons.map((weapon) => ({ type: "weapon", weapon }));
    const items = [
      ...weaponRows,
      { type: "consumable", id: "grenade_pack", label: "Grenade Pack (+2)", cost: 90 },
      { type: "consumable", id: "rpg_pack", label: "RPG Ammo Pack (+2)", cost: 170 },
      { type: "close", label: "Close Shop" },
    ];

    const startY = 142;
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const y = startY + i * 34;
      const rowBg = this.add
        .rectangle(480, y, 760, 30, 0x26324d, 0.4)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => {
          this.cursor = i;
          this.activateSelection();
        });
      const rowText = this.add.text(120, y - 12, "", { fontSize: "19px", color: "#ffffff" });
      this.rows.push({ item, rowBg, rowText });
    }

    this.refreshRows();
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.keys.up)) {
      this.cursor = (this.cursor - 1 + this.rows.length) % this.rows.length;
      this.refreshRows();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.down)) {
      this.cursor = (this.cursor + 1) % this.rows.length;
      this.refreshRows();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.enter)) {
      this.activateSelection();
    }
  }

  activateSelection() {
    const selected = this.rows[this.cursor].item;
    if (selected.type === "weapon") {
      if (this.session.save.ownedWeapons.includes(selected.weapon.id)) {
        this.session.equipWeapon(selected.weapon.id);
      } else {
        this.session.buyWeapon(selected.weapon.id);
      }
      this.session.manualSave();
    } else if (selected.type === "consumable") {
      this.session.buyConsumable(selected.id);
    } else if (selected.type === "close") {
      this.closeShop();
    }
    this.refreshRows();
  }

  refreshRows() {
    this.info.setText(
      `Coins: ${this.session.save.coins}   Equipped: ${this.session.getEquippedWeapon().label}   Grenades: ${this.session.save.grenades}   RPG: ${this.session.save.rpgAmmo}`,
    );

    this.rows.forEach((row, index) => {
      const selected = index === this.cursor;
      row.rowBg.setFillStyle(selected ? 0x416187 : 0x26324d, selected ? 0.8 : 0.4);
      if (row.item.type === "weapon") {
        row.rowText.setText(this.weaponRowText(row.item.weapon));
      } else if (row.item.type === "consumable") {
        row.rowText.setText(`${row.item.label} - ${row.item.cost} coins`);
      } else {
        row.rowText.setText(row.item.label);
      }
      row.rowText.setColor(selected ? "#ffe3aa" : "#ffffff");
    });
  }

  weaponRowText(weapon) {
    const owned = this.session.save.ownedWeapons.includes(weapon.id);
    const equipped = this.session.save.equippedWeaponId === weapon.id;
    if (owned && equipped) {
      return `${weapon.label} - Equipped`;
    }
    if (owned) {
      return `${weapon.label} - Owned (Select)`;
    }
    if (this.session.save.currentRaid < weapon.unlockRaid) {
      return `${weapon.label} - Unlocks Raid ${weapon.unlockRaid}`;
    }
    return `${weapon.label} - ${weapon.cost} coins`;
  }

  closeShop() {
    this.scene.stop();
    this.scene.resume(this.from);
  }

  renderGameToText() {
    return JSON.stringify({
      coordinateSystem: "origin top-left, +x right, +y down",
      mode: "shop",
      coins: this.session.save.coins,
      equippedWeapon: this.session.save.equippedWeaponId,
      grenades: this.session.save.grenades,
      rpgAmmo: this.session.save.rpgAmmo,
      selectedIndex: this.cursor,
      selectedLabel: this.rows[this.cursor]?.item?.label ?? this.rows[this.cursor]?.item?.weapon?.label ?? null,
    });
  }

  advanceSimulation(ms) {
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let i = 0; i < steps; i += 1) {
      this.update();
    }
  }
}
