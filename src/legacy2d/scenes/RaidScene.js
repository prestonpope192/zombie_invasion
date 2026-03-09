import Phaser from "phaser";
import { setupKeys, buildInputSnapshot } from "../systems/inputSystem";
import { getMobileControls } from "../systems/mobileControls";
import { AudioSystem } from "../systems/audioSystem";
import { applyDamageNoIFrames, applyDamageWithIFrames, applyExplosion, findHitscanTargets } from "../systems/combatSystem";
import { buildSpawnQueue } from "../systems/waveSystem";
import { tickVillageAttack } from "../systems/villageSystem";

export class RaidScene extends Phaser.Scene {
  constructor() {
    super("RaidScene");
    this.worldWidth = 3360;
    this.worldHeight = 640;
    this.groundY = 540;
    this.lookAhead = 140;
    this.baseVillageX = 100;
  }

  create() {
    this.session = this.game.session;
    this.session.beginRaid();
    this.currentRaid = this.session.save.currentRaid;
    this.raidDef = this.session.getRaidDefinition(this.currentRaid);

    this.mobile = getMobileControls();
    this.mobile.show();
    this.audioSystem = new AudioSystem(this);
    this.audioSystem.startMusic("raid");

    this.keys = setupKeys(this);
    this.pointer = this.input.activePointer;

    this.physicsData = {
      moveSpeed: 230,
      jumpVelocity: -460,
      gravity: 1300,
      crouchFactor: 0.55,
      coyoteTime: 0.1,
      jumpBuffer: 0.12,
      playerIFrameMs: 650,
    };

    this.player = {
      x: 220,
      y: this.groundY,
      prevY: this.groundY,
      vx: 0,
      vy: 0,
      hp: 100,
      w: 34,
      h: 54,
      onGround: true,
      facing: 1,
      crouching: false,
      coyoteTimer: 0,
      jumpBufferTimer: 0,
      lastHitAt: -Infinity,
      flashTimer: 0,
      fireCooldown: 0,
      secondaryCooldown: 0,
    };

    this.spawnQueue = buildSpawnQueue(this.raidDef);
    this.spawnTimer = 0;
    this.enemies = [];
    this.projectiles = [];
    this.pendingExplosions = [];
    this.summary = null;

    this.background();
    this.createWorldGeometry();
    this.createHud();

    this.playerSprite = this.add.sprite(this.player.x, this.player.y, "player").setOrigin(0.5, 1);

    this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);
    this.cameras.main.setScroll(0, 0);

    this.events.on("shutdown", () => this.audioSystem.stopMusic());
  }

  background() {
    this.add.rectangle(0, 0, this.worldWidth, this.worldHeight, 0x0c0f1c).setOrigin(0, 0);
    this.add.rectangle(0, 0, this.worldWidth, 250, 0x1b2238).setOrigin(0, 0);
    this.add.rectangle(0, this.groundY + 20, this.worldWidth, 170, 0x2f313b).setOrigin(0, 0);

    for (let i = 0; i < 22; i += 1) {
      const x = 160 + i * 150;
      this.add.rectangle(x, this.groundY - 115, 22, 210, 0x151b2a).setOrigin(0.5, 1).setAlpha(0.55);
    }

    this.villageSprite = this.add.rectangle(this.baseVillageX, this.groundY - 45, 170, 120, 0x694432).setOrigin(0.5, 1);
    this.villageZone = this.add.rectangle(this.baseVillageX + 70, this.groundY - 40, 70, 85, 0xb86455, 0.22).setOrigin(0.5, 1);
  }

  createWorldGeometry() {
    this.obstacles = [
      { x: 760, y: this.groundY, w: 80, h: 20 },
      { x: 1420, y: this.groundY, w: 70, h: 28 },
      { x: 1990, y: this.groundY, w: 78, h: 24 },
      { x: 2560, y: this.groundY, w: 64, h: 30 },
    ];

    this.platforms = [
      { x: 1180, y: this.groundY - 90, w: 170, h: 12, oneWay: true },
      { x: 2300, y: this.groundY - 110, w: 220, h: 12, oneWay: true },
    ];

    for (const obs of this.obstacles) {
      this.add.rectangle(obs.x, obs.y - obs.h / 2, obs.w, obs.h, 0x5a4d40).setOrigin(0.5, 0.5);
    }
    for (const pf of this.platforms) {
      this.add.rectangle(pf.x, pf.y, pf.w, pf.h, 0x3b5f73).setOrigin(0.5, 0.5);
    }
  }

  createHud() {
    const textStyle = { fontSize: "20px", color: "#ffffff" };
    this.hud = {
      raid: this.add.text(16, 10, "", textStyle).setScrollFactor(0),
      coins: this.add.text(16, 36, "", textStyle).setScrollFactor(0),
      weapon: this.add.text(16, 62, "", textStyle).setScrollFactor(0),
      ammo: this.add.text(16, 88, "", textStyle).setScrollFactor(0),
      remaining: this.add.text(16, 114, "", textStyle).setScrollFactor(0),
      hint: this.add.text(16, 608, "Q swap | E interact | Esc pause", {
        fontSize: "18px",
        color: "#e7f0ff",
      }).setScrollFactor(0).setOrigin(0, 1),
    };

    this.playerBarBg = this.add.rectangle(430, 26, 240, 16, 0x000000, 0.45).setScrollFactor(0);
    this.playerBar = this.add.rectangle(430, 26, 236, 12, 0x5ce17a).setScrollFactor(0);
    this.villageBarBg = this.add.rectangle(430, 52, 240, 16, 0x000000, 0.45).setScrollFactor(0);
    this.villageBar = this.add.rectangle(430, 52, 236, 12, 0xf89653).setScrollFactor(0);

    this.playerBarLabel = this.add.text(560, 18, "Player", { fontSize: "16px", color: "#d8efdc" }).setScrollFactor(0);
    this.villageBarLabel = this.add.text(560, 44, "Village", { fontSize: "16px", color: "#ffe0cb" }).setScrollFactor(0);

    this.summaryLayer = this.add.container(0, 0).setScrollFactor(0).setVisible(false);
    this.summaryLayer.add(this.add.rectangle(480, 320, 960, 640, 0x000000, 0.76));
    this.summaryPanel = this.add.rectangle(480, 320, 700, 420, 0x1a2338, 0.98).setStrokeStyle(3, 0xff9f43);
    this.summaryLayer.add(this.summaryPanel);
    this.summaryTitle = this.add.text(480, 168, "Raid Clear", {
      fontSize: "50px",
      color: "#ffcd7d",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.summaryLayer.add(this.summaryTitle);
    this.summaryBody = this.add.text(480, 260, "", {
      fontSize: "26px",
      align: "center",
      color: "#ffffff",
    }).setOrigin(0.5);
    this.summaryLayer.add(this.summaryBody);
    this.summaryActions = this.add.text(480, 452, "C Continue   O Shop   V Save", {
      fontSize: "24px",
      color: "#d2e6ff",
    }).setOrigin(0.5);
    this.summaryLayer.add(this.summaryActions);

    this.summaryKeys = this.input.keyboard.addKeys({ c: "C", o: "O", v: "V" });
  }

  update(_time, deltaMs) {
    this.simulate(deltaMs / 1000);
  }

  simulate(dt) {
    if (this.summary) {
      this.handleSummaryInput();
      return;
    }

    const input = buildInputSnapshot({ keys: this.keys, mobile: this.mobile, pointer: this.pointer, scene: this });

    if (input.pausePressed) {
      this.scene.launch("PauseOverlay", { parentSceneKey: "RaidScene" });
      this.scene.pause();
      return;
    }

    if (input.fullscreenPressed) {
      this.toggleFullscreen();
    }

    this.handleWeaponHotkeys();

    if (input.swapPressed) {
      this.session.cycleWeapon(1);
    }

    this.stepPlayer(input, dt);
    this.stepCombat(input, dt);
    this.stepSpawns(dt);
    this.stepProjectiles(dt);
    this.stepEnemies(dt);
    this.resolveQueuedExplosions();
    this.cleanupDeadEnemies();

    this.syncCamera();
    this.syncHud();
    this.checkEndConditions();
  }

  stepPlayer(input, dt) {
    if (input.left) {
      this.player.vx = -this.physicsData.moveSpeed;
      this.player.facing = -1;
    } else if (input.right) {
      this.player.vx = this.physicsData.moveSpeed;
      this.player.facing = 1;
    } else {
      this.player.vx = 0;
    }

    if (Math.abs(input.pointerWorldX - this.player.x) > 6 && this.pointer.isDown) {
      this.player.facing = input.pointerWorldX >= this.player.x ? 1 : -1;
    }

    this.player.crouching = this.player.onGround && input.crouch;
    if (this.player.crouching) {
      this.player.vx *= this.physicsData.crouchFactor;
    }

    if (input.jump) {
      this.player.jumpBufferTimer = this.physicsData.jumpBuffer;
    } else {
      this.player.jumpBufferTimer = Math.max(0, this.player.jumpBufferTimer - dt);
    }

    if (this.player.onGround) {
      this.player.coyoteTimer = this.physicsData.coyoteTime;
    } else {
      this.player.coyoteTimer = Math.max(0, this.player.coyoteTimer - dt);
    }

    if (this.player.jumpBufferTimer > 0 && this.player.coyoteTimer > 0 && !this.player.crouching) {
      this.player.vy = this.physicsData.jumpVelocity;
      this.player.onGround = false;
      this.player.jumpBufferTimer = 0;
      this.player.coyoteTimer = 0;
    }

    this.player.prevY = this.player.y;
    this.player.vy += this.physicsData.gravity * dt;
    this.player.x += this.player.vx * dt;
    this.player.y += this.player.vy * dt;

    if (this.player.y >= this.groundY) {
      this.player.y = this.groundY;
      this.player.vy = 0;
      this.player.onGround = true;
    } else {
      this.player.onGround = false;
    }

    for (const platform of this.platforms) {
      const left = platform.x - platform.w / 2;
      const right = platform.x + platform.w / 2;
      const within = this.player.x > left - this.player.w / 2 && this.player.x < right + this.player.w / 2;
      const crossing = this.player.prevY <= platform.y - 6 && this.player.y >= platform.y - 6;
      if (within && crossing && this.player.vy >= 0 && !this.player.crouching) {
        this.player.y = platform.y - 6;
        this.player.vy = 0;
        this.player.onGround = true;
      }
    }

    this.player.x = Phaser.Math.Clamp(this.player.x, 40, this.worldWidth - 50);

    this.playerSprite.setPosition(this.player.x, this.player.y);
    this.playerSprite.setFlipX(this.player.facing < 0);
    this.playerSprite.setScale(1, this.player.crouching ? 0.65 : 1);

    if (this.player.flashTimer > 0) {
      this.player.flashTimer -= dt;
      this.playerSprite.setAlpha(Math.sin(this.time.now * 0.05) > 0 ? 0.2 : 1);
    } else {
      this.playerSprite.setAlpha(1);
    }
  }

  stepCombat(input, dt) {
    this.player.fireCooldown = Math.max(0, this.player.fireCooldown - dt);
    this.player.secondaryCooldown = Math.max(0, this.player.secondaryCooldown - dt);

    if (input.fire && this.player.fireCooldown <= 0) {
      this.firePrimary(input.pointerWorldX, input.pointerWorldY);
    }

    if (input.secondary && this.player.secondaryCooldown <= 0) {
      this.fireSecondary(input.pointerWorldX, input.pointerWorldY);
    }
  }

  firePrimary(targetX, targetY) {
    const weapon = this.session.getEquippedWeapon();
    const directionX = this.player.facing;
    const originX = this.player.x + directionX * 18;
    const originY = this.player.y - (this.player.crouching ? 22 : 32);

    if (weapon.category === "gun") {
      const targets = findHitscanTargets({
        enemies: this.enemies,
        originX,
        originY,
        directionX,
        maxDistance: 920,
        verticalTolerance: 58,
        pierce: weapon.pierce,
      });

      for (const enemy of targets) {
        applyDamageNoIFrames(enemy, weapon.damage);
        enemy.flashTimer = 0.08;
        enemy.knockbackVX = (enemy.knockbackVX ?? 0) + directionX * weapon.knockback;
      }

      const tracerX = directionX > 0 ? originX + 300 : originX - 300;
      const tracer = this.add.line(0, 0, originX, originY, tracerX, originY, 0xffef99, 0.9).setLineWidth(3);
      this.time.delayedCall(45, () => tracer.destroy());
      this.audioSystem.playWeapon("gun");
      this.player.fireCooldown = weapon.fireRate;
      return;
    }

    if (weapon.ammoType === "rpg" && !this.session.consumeRpgAmmo()) {
      return;
    }

    const directionY = Phaser.Math.Clamp((targetY - originY) / 350, -0.5, 0.35);
    const vx = directionX * weapon.projectileSpeed;
    const vy = directionY * weapon.projectileSpeed;

    this.spawnProjectile({
      x: originX,
      y: originY,
      vx,
      vy,
      gravity: weapon.id === "bow" ? 580 : 0,
      damage: weapon.damage,
      aoeRadius: weapon.aoeRadius,
      knockback: weapon.knockback,
      kind: weapon.id,
      life: weapon.id === "bow" ? 1.8 : 2.4,
    });

    this.audioSystem.playWeapon("projectile");
    this.player.fireCooldown = weapon.fireRate;
  }

  fireSecondary(targetX, targetY) {
    const weapon = this.session.getEquippedWeapon();

    if (this.session.save.grenades > 0 && this.session.consumeGrenade()) {
      const direction = this.player.facing;
      this.spawnProjectile({
        x: this.player.x + direction * 16,
        y: this.player.y - 30,
        vx: direction * 260,
        vy: -360,
        gravity: 900,
        damage: 70,
        aoeRadius: 95,
        knockback: 105,
        kind: "grenade",
        life: 0.95,
      });
      this.player.secondaryCooldown = 0.5;
      return;
    }

    if (weapon.ammoType === "rpg" && this.session.consumeRpgAmmo()) {
      const directionX = this.player.facing;
      const originY = this.player.y - 30;
      const vy = Phaser.Math.Clamp((targetY - originY) / 350, -0.45, 0.4) * weapon.projectileSpeed;
      this.spawnProjectile({
        x: this.player.x + directionX * 14,
        y: originY,
        vx: directionX * weapon.projectileSpeed,
        vy,
        gravity: 0,
        damage: weapon.damage,
        aoeRadius: weapon.aoeRadius,
        knockback: weapon.knockback,
        kind: "rpg_secondary",
        life: 2.3,
      });
      this.player.secondaryCooldown = 0.75;
    }
  }

  spawnProjectile(projectile) {
    const sprite = this.add.image(projectile.x, projectile.y, "projectile").setScale(projectile.kind === "grenade" ? 1 : 0.8);
    projectile.sprite = sprite;
    projectile.r = projectile.kind === "grenade" ? 10 : 7;
    this.projectiles.push(projectile);
  }

  stepSpawns(dt) {
    if (this.spawnQueue.length <= 0) {
      return;
    }
    this.spawnTimer += dt;
    if (this.spawnTimer < this.raidDef.spawnCadence) {
      return;
    }
    this.spawnTimer = 0;

    const type = this.spawnQueue.shift();
    const base = this.session.enemyMap.get(type) ?? this.session.enemyMap.get("normal");
    const spawnX = this.worldWidth - 80 + Phaser.Math.Between(0, 70);

    const enemy = {
      id: `${type}_${Math.random().toString(36).slice(2, 9)}`,
      type,
      hp: base.hp,
      maxHp: base.hp,
      contactDamage: base.contactDamage,
      villageDamage: base.villageDamage,
      speed: base.speed,
      sizeScale: base.sizeScale,
      coinReward: base.coinReward,
      attackInterval: base.attackInterval,
      attackTimer: 0,
      state: "walk",
      x: spawnX,
      y: this.groundY,
      w: Math.round(30 * base.sizeScale),
      h: Math.round(48 * base.sizeScale),
      knockbackVX: 0,
      flashTimer: 0,
    };

    if (type === "boss") {
      const tier = this.currentRaid / 5;
      enemy.hp = 60 + (tier - 1) * 45;
      enemy.maxHp = enemy.hp;
      enemy.coinReward = 250 + tier * 25;
      enemy.speed = 22;
      enemy.w = 96;
      enemy.h = 132;
    }

    enemy.sprite = this.add
      .sprite(enemy.x, enemy.y, type === "normal" ? "zombie" : type === "super" ? "superZombie" : "bossZombie")
      .setOrigin(0.5, 1);

    this.enemies.push(enemy);
  }

  stepProjectiles(dt) {
    for (const projectile of this.projectiles) {
      projectile.life -= dt;
      projectile.vy += (projectile.gravity || 0) * dt;
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.sprite.setPosition(projectile.x, projectile.y);
      projectile.sprite.rotation += dt * 8;

      let exploded = false;

      for (const enemy of this.enemies) {
        if (enemy.hp <= 0) {
          continue;
        }
        const distance = Math.hypot(projectile.x - enemy.x, projectile.y - (enemy.y - enemy.h * 0.5));
        if (distance > projectile.r + enemy.w * 0.45) {
          continue;
        }

        if (projectile.aoeRadius > 0) {
          this.pendingExplosions.push({
            x: projectile.x,
            y: projectile.y,
            radius: projectile.aoeRadius,
            damage: projectile.damage,
            knockback: projectile.knockback,
          });
          exploded = true;
        } else {
          applyDamageNoIFrames(enemy, projectile.damage);
          enemy.knockbackVX += Math.sign(projectile.vx || this.player.facing) * projectile.knockback;
        }
        projectile.life = 0;
        break;
      }

      if (!exploded && projectile.kind === "grenade" && projectile.life <= 0) {
        this.pendingExplosions.push({
          x: projectile.x,
          y: Math.min(projectile.y, this.groundY - 10),
          radius: projectile.aoeRadius,
          damage: projectile.damage,
          knockback: projectile.knockback,
        });
      }

      if (projectile.y > this.worldHeight + 80 || projectile.x < -80 || projectile.x > this.worldWidth + 80) {
        projectile.life = 0;
      }
    }

    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      if (this.projectiles[i].life > 0) {
        continue;
      }
      this.projectiles[i].sprite.destroy();
      this.projectiles.splice(i, 1);
    }
  }

  stepEnemies(dt) {
    const now = this.time.now;

    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) {
        continue;
      }

      enemy.flashTimer = Math.max(0, enemy.flashTimer - dt);
      enemy.sprite.setTint(enemy.flashTimer > 0 ? 0xffffff : 0xfff8d1);

      if (enemy.state === "attack_village") {
        const dmg = tickVillageAttack(enemy, dt);
        if (dmg > 0) {
          this.session.applyVillageDamage(dmg);
          this.audioSystem.playZombieAttack();
        }
        enemy.sprite.setScale(1 + Math.sin(this.time.now * 0.008) * 0.02, 1);
      } else if (Math.abs(enemy.x - this.player.x) < 44 && Math.abs(enemy.y - this.player.y) < 64) {
        enemy.attackTimer += dt;
        if (enemy.attackTimer >= enemy.attackInterval) {
          enemy.attackTimer = 0;
          const hit = applyDamageWithIFrames(this.player, enemy.contactDamage, now, this.physicsData.playerIFrameMs);
          if (hit.applied > 0) {
            this.player.flashTimer = 0.32;
            this.audioSystem.playZombieAttack();
          }
        }
      } else {
        enemy.attackTimer = 0;
        const baseMove = -enemy.speed;
        enemy.knockbackVX *= 0.88;
        const velocity = baseMove + enemy.knockbackVX;
        enemy.x += velocity * dt;

        for (const obstacle of this.obstacles) {
          const obstacleLeft = obstacle.x - obstacle.w / 2;
          const nearObstacle = enemy.x < obstacleLeft + 12 && enemy.x > obstacleLeft - 35;
          if (!nearObstacle) {
            continue;
          }
          if (obstacle.h <= 32) {
            enemy.y = this.groundY - obstacle.h;
          }
        }

        if (enemy.x <= this.villageZone.x - this.villageZone.width / 2 + 8) {
          enemy.state = "attack_village";
          enemy.attackTimer = 0;
          enemy.x = this.villageZone.x - this.villageZone.width / 2 + 8;
        }
      }

      enemy.sprite.setPosition(enemy.x, enemy.y);
      enemy.sprite.setFlipX(true);
      const wobble = 1 + Math.sin((this.time.now + enemy.x) * 0.01) * 0.04;
      enemy.sprite.setScale(wobble, 1 / wobble);
    }
  }

  resolveQueuedExplosions() {
    if (!this.pendingExplosions.length) {
      return;
    }
    while (this.pendingExplosions.length) {
      const blast = this.pendingExplosions.shift();
      const puff = this.add.circle(blast.x, blast.y, blast.radius, 0xff9f43, 0.35);
      this.tweens.add({ targets: puff, alpha: 0, scale: 1.2, duration: 160, onComplete: () => puff.destroy() });
      this.cameras.main.shake(90, 0.0038);
      this.audioSystem.playExplosion();
      applyExplosion({
        enemies: this.enemies,
        centerX: blast.x,
        centerY: blast.y,
        radius: blast.radius,
        damage: blast.damage,
        knockback: blast.knockback,
      });
    }
  }

  cleanupDeadEnemies() {
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = this.enemies[i];
      if (enemy.hp > 0) {
        continue;
      }

      this.session.onEnemyKilled(enemy.type, Math.round(enemy.coinReward));
      this.audioSystem.playZombieDeath();
      this.tweens.add({
        targets: enemy.sprite,
        scaleY: 0.1,
        alpha: 0,
        duration: 160,
        onComplete: () => enemy.sprite.destroy(),
      });
      this.enemies.splice(i, 1);
    }
  }

  checkEndConditions() {
    if (this.player.hp <= 0) {
      this.scene.start("GameOverScene", { reason: "You were overrun." });
      return;
    }
    if (this.session.run.villageHp <= 0) {
      this.scene.start("GameOverScene", { reason: "Village destroyed." });
      return;
    }

    if (this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.summary = this.session.completeRaid(this.currentRaid);
      this.showSummary();
    }
  }

  showSummary() {
    this.summaryLayer.setVisible(true);
    this.summaryBody.setText(
      [
        `Raid ${this.summary.raidNumber} complete`,
        `Kills: ${this.summary.kills}   Supers: ${this.summary.supersKilled}   Boss: ${this.summary.bossKilled}`,
        `Clear Bonus: ${this.summary.clearBonus}`,
        `Perfect Defense: ${this.summary.perfectBonus}`,
        `Coins Earned: ${this.summary.coinsAwarded}`,
      ].join("\n"),
    );
    this.summaryActions.setText("C Continue   O Shop   V Save");
  }

  handleSummaryInput() {
    if (Phaser.Input.Keyboard.JustDown(this.summaryKeys.v)) {
      this.session.manualSave();
      this.summaryActions.setText("Saved! C Continue   O Shop   V Save Again");
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.summaryKeys.o)) {
      this.session.pendingOpenShop = true;
      this.goToPostRaidScene();
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.summaryKeys.c) || this.mobile.consume("interact")) {
      this.goToPostRaidScene();
    }
  }

  goToPostRaidScene() {
    if (this.summary.victory) {
      this.scene.start("VictoryScene", { summary: this.summary });
      return;
    }
    this.scene.start("HubScene");
  }

  syncCamera() {
    const cam = this.cameras.main;
    const targetX = Phaser.Math.Clamp(
      this.player.x - this.scale.width / 2 + this.lookAhead * this.player.facing,
      0,
      this.worldWidth - this.scale.width,
    );
    cam.scrollX += (targetX - cam.scrollX) * 0.11;
  }

  syncHud() {
    const weapon = this.session.getEquippedWeapon();
    const maxVillage = this.session.getVillageMaxHp(this.currentRaid);
    const remaining = this.spawnQueue.length + this.enemies.length;

    this.hud.raid.setText(`Raid ${this.currentRaid}/50`);
    this.hud.coins.setText(`Raid Coins: ${this.session.run.raidCoins}`);
    this.hud.weapon.setText(`Weapon: ${weapon.label}`);
    this.hud.ammo.setText(`Grenades: ${this.session.save.grenades}   RPG: ${this.session.save.rpgAmmo}`);
    this.hud.remaining.setText(`Wave Remaining: ${remaining}`);

    const playerRatio = Phaser.Math.Clamp(this.player.hp / 100, 0, 1);
    const villageRatio = Phaser.Math.Clamp(this.session.run.villageHp / maxVillage, 0, 1);
    this.playerBar.width = 236 * playerRatio;
    this.villageBar.width = 236 * villageRatio;
    this.playerBar.x = 430 - (236 - this.playerBar.width) / 2;
    this.villageBar.x = 430 - (236 - this.villageBar.width) / 2;
  }

  handleWeaponHotkeys() {
    const keyMap = [
      [this.keys.one, 0],
      [this.keys.two, 1],
      [this.keys.three, 2],
      [this.keys.four, 3],
      [this.keys.five, 4],
      [this.keys.six, 5],
      [this.keys.seven, 6],
      [this.keys.eight, 7],
      [this.keys.nine, 8],
    ];
    const owned = this.session.getOwnedWeapons();
    for (const [key, index] of keyMap) {
      if (Phaser.Input.Keyboard.JustDown(key) && owned[index]) {
        this.session.equipWeapon(owned[index].id);
      }
    }
  }

  renderGameToText() {
    const payload = {
      coordinateSystem: "origin top-left, +x right, +y down",
      mode: this.summary ? "raid_summary" : "raid",
      raid: this.currentRaid,
      player: {
        x: Math.round(this.player.x),
        y: Math.round(this.player.y),
        vx: Math.round(this.player.vx),
        vy: Math.round(this.player.vy),
        hp: this.player.hp,
        facing: this.player.facing,
      },
      village: {
        hp: Math.round(this.session.run.villageHp),
        maxHp: this.session.getVillageMaxHp(this.currentRaid),
      },
      weapon: this.session.getEquippedWeapon().id,
      consumables: { grenades: this.session.save.grenades, rpgAmmo: this.session.save.rpgAmmo },
      counters: {
        queueRemaining: this.spawnQueue.length,
        aliveEnemies: this.enemies.length,
        waveRemaining: this.spawnQueue.length + this.enemies.length,
        raidCoins: this.session.run.raidCoins,
      },
      enemies: this.enemies.slice(0, 15).map((enemy) => ({
        type: enemy.type,
        x: Math.round(enemy.x),
        y: Math.round(enemy.y),
        hp: Math.round(enemy.hp),
        state: enemy.state,
      })),
      projectiles: this.projectiles.slice(0, 10).map((projectile) => ({
        kind: projectile.kind,
        x: Math.round(projectile.x),
        y: Math.round(projectile.y),
      })),
      summary: this.summary,
    };
    return JSON.stringify(payload);
  }

  advanceSimulation(ms) {
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let i = 0; i < steps; i += 1) {
      this.simulate(1 / 60);
    }
  }

  toggleFullscreen() {
    if (this.scale.isFullscreen) {
      this.scale.stopFullscreen();
      return;
    }
    this.scale.startFullscreen();
  }
}
