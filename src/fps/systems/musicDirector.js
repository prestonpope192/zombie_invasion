export const MUSIC_CUES = {
  menu_theme: {
    id: "menu_theme",
    src: "/audio/music/menu_theme.mp3",
    loop: true,
    volume: 0.16,
  },
  safe_house_intro: {
    id: "safe_house_intro",
    src: "/audio/music/safe_house_intro.mp3",
    loop: true,
    volume: 0.12,
  },
  shop_intermission: {
    id: "shop_intermission",
    src: "/audio/music/shop_intermission.mp3",
    loop: true,
    volume: 0.15,
  },
  raid_low: {
    id: "raid_low",
    src: "/audio/music/raid_low.mp3",
    loop: true,
    volume: 0.15,
  },
  raid_mid: {
    id: "raid_mid",
    src: "/audio/music/raid_mid.mp3",
    loop: true,
    volume: 0.17,
  },
  raid_high: {
    id: "raid_high",
    src: "/audio/music/raid_high.mp3",
    loop: true,
    volume: 0.18,
  },
  boss_battle: {
    id: "boss_battle",
    src: "/audio/music/boss_battle.mp3",
    loop: true,
    volume: 0.18,
  },
  victory_sting: {
    id: "victory_sting",
    src: "/audio/music/victory_sting.mp3",
    loop: false,
    volume: 0.18,
  },
  game_over_sting: {
    id: "game_over_sting",
    src: "/audio/music/game_over_sting.mp3",
    loop: false,
    volume: 0.18,
  },
};

const RAID_CUE_ORDER = ["raid_low", "raid_mid", "raid_high"];
const RAID_UP_THRESHOLDS = {
  raid_low: 0.42,
  raid_mid: 0.72,
};
const RAID_DOWN_THRESHOLDS = {
  raid_mid: 0.24,
  raid_high: 0.54,
};

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function numberOr(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function computeRaidThreatScore(snapshot = {}) {
  const wave = Math.max(1, Math.round(numberOr(snapshot.waveNumber ?? snapshot.wave, 1)));
  const enemyCount = Math.max(0, Math.round(numberOr(snapshot.aliveEnemies ?? snapshot.enemyCount, 0)));
  const closestThreatDistance = numberOr(snapshot.closestThreatDistance ?? snapshot.threatDistanceMin, Infinity);
  const playerHp = clamp01(numberOr(snapshot.playerHp, 100) / 100);
  const maxVillageHp = Math.max(1, numberOr(snapshot.maxVillageHp, 100));
  const villageHp = clamp01(numberOr(snapshot.villageHp, maxVillageHp) / maxVillageHp);
  const villageDamageRecent = clamp01(snapshot.villageDamageRecent);
  const playerDamageRecent = clamp01(snapshot.playerDamageRecent);

  const wavePressure = clamp01((wave - 1) / 11) * 0.22;
  const crowdPressure = clamp01(enemyCount / 14) * 0.38;
  const proximityPressure = Number.isFinite(closestThreatDistance)
    ? clamp01((18 - closestThreatDistance) / 18) * 0.22
    : 0;
  const damagePressure = Math.max(villageDamageRecent, playerDamageRecent) * 0.14;
  const survivalPressure = (1 - Math.min(playerHp, villageHp)) * 0.16;

  return clamp01(wavePressure + crowdPressure + proximityPressure + damagePressure + survivalPressure);
}

export function selectRaidMusicCue(snapshot = {}) {
  const phase = String(snapshot.phase ?? "").toLowerCase();
  if (phase === "house_intro") {
    return "safe_house_intro";
  }
  if (phase === "secret_boss" || snapshot.bossActive || snapshot.secretBossActive || snapshot.bossWave) {
    return "boss_battle";
  }

  const score = computeRaidThreatScore(snapshot);
  if (score >= RAID_UP_THRESHOLDS.raid_mid) {
    return "raid_high";
  }
  if (score >= RAID_UP_THRESHOLDS.raid_low) {
    return "raid_mid";
  }
  return "raid_low";
}

export function selectMusicCue(snapshot = {}) {
  const mode = String(snapshot.mode ?? "raid").toLowerCase();
  if (mode === "menu") {
    return "menu_theme";
  }
  if (mode === "shop" || mode === "summary") {
    return "shop_intermission";
  }
  if (mode === "game_over") {
    return snapshot.victory ? "victory_sting" : "game_over_sting";
  }
  return selectRaidMusicCue(snapshot);
}

export class AdaptiveMusicDirector {
  constructor({ minDwellSec = 4.2 } = {}) {
    this.minDwellSec = minDwellSec;
    this.currentCueId = "";
    this.dwellSec = 0;
  }

  reset() {
    this.currentCueId = "";
    this.dwellSec = 0;
  }

  update(snapshot = {}, dt = 0, { force = false } = {}) {
    const nextCueId = selectMusicCue(snapshot);
    const currentCueId = this.currentCueId;
    this.dwellSec += Math.max(0, numberOr(dt, 0));

    if (force || !currentCueId || currentCueId === nextCueId) {
      return this.commit(nextCueId);
    }

    if (!RAID_CUE_ORDER.includes(currentCueId) || !RAID_CUE_ORDER.includes(nextCueId)) {
      return this.commit(nextCueId);
    }

    if (this.dwellSec < this.minDwellSec) {
      return currentCueId;
    }

    const score = computeRaidThreatScore(snapshot);
    const currentIndex = RAID_CUE_ORDER.indexOf(currentCueId);
    const nextIndex = RAID_CUE_ORDER.indexOf(nextCueId);
    const rising = nextIndex > currentIndex;

    if (rising && score >= (RAID_UP_THRESHOLDS[currentCueId] ?? 1)) {
      return this.commit(nextCueId);
    }
    if (!rising && score <= (RAID_DOWN_THRESHOLDS[currentCueId] ?? 0)) {
      return this.commit(nextCueId);
    }

    return currentCueId;
  }

  commit(cueId) {
    if (this.currentCueId !== cueId) {
      this.currentCueId = cueId;
      this.dwellSec = 0;
    }
    return cueId;
  }
}
