export function applyDamageWithIFrames(entity, damage, nowMs, iFrameMs = 650) {
  if (entity.hp <= 0) {
    return { applied: 0, defeated: true };
  }
  const sinceLast = nowMs - (entity.lastHitAt ?? -Infinity);
  if (sinceLast < iFrameMs) {
    return { applied: 0, defeated: false };
  }
  const applied = Math.max(0, Math.min(entity.hp, damage));
  entity.hp -= applied;
  entity.lastHitAt = nowMs;
  return { applied, defeated: entity.hp <= 0 };
}

export function applyDamageNoIFrames(entity, damage) {
  if (entity.hp <= 0) {
    return { applied: 0, defeated: true };
  }
  const applied = Math.max(0, Math.min(entity.hp, damage));
  entity.hp -= applied;
  return { applied, defeated: entity.hp <= 0 };
}

export function findHitscanTargets({ enemies, originX, originY, directionX, maxDistance, verticalTolerance, pierce }) {
  const candidates = enemies
    .filter((enemy) => {
      if (enemy.hp <= 0) {
        return false;
      }
      const dx = enemy.x - originX;
      if (Math.sign(dx || 1) !== Math.sign(directionX || 1)) {
        return false;
      }
      if (Math.abs(dx) > maxDistance) {
        return false;
      }
      return Math.abs(enemy.y - originY) <= verticalTolerance + enemy.h * 0.5;
    })
    .sort((a, b) => Math.abs(a.x - originX) - Math.abs(b.x - originX));

  const maxHits = Math.max(1, 1 + (pierce || 0));
  return candidates.slice(0, maxHits);
}

export function explosionFalloff(distance, radius) {
  if (distance > radius) {
    return 0;
  }
  return 1 - distance / radius;
}

export function applyExplosion({ enemies, centerX, centerY, radius, damage, knockback }) {
  const affected = [];
  for (const enemy of enemies) {
    if (enemy.hp <= 0) {
      continue;
    }
    const dx = enemy.x - centerX;
    const dy = enemy.y - centerY;
    const dist = Math.hypot(dx, dy);
    const scale = explosionFalloff(dist, radius);
    if (scale <= 0) {
      continue;
    }
    const dmg = Math.max(1, Math.round(damage * scale));
    enemy.hp -= dmg;
    const force = knockback * scale;
    enemy.knockbackVX = (enemy.knockbackVX ?? 0) + (dx === 0 ? force : Math.sign(dx) * force);
    affected.push({ enemy, damage: dmg, defeated: enemy.hp <= 0 });
  }
  return affected;
}
