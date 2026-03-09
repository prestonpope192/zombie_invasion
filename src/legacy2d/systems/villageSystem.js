export function tickVillageAttack(zombie, deltaSec) {
  zombie.attackTimer = (zombie.attackTimer ?? 0) + deltaSec;
  if (zombie.attackTimer < zombie.attackInterval) {
    return 0;
  }
  zombie.attackTimer -= zombie.attackInterval;
  return zombie.villageDamage;
}
