export function getRaidDefinition(raids, raidNumber) {
  const fallback = raids[0];
  return raids.find((raid) => raid.raid === raidNumber) ?? fallback;
}

export function buildSpawnQueue(raidDef) {
  const queue = [];
  const total = raidDef.normals + raidDef.supers;
  const superInterval = raidDef.supers > 0 ? Math.max(2, Math.floor(total / raidDef.supers)) : Infinity;

  let normalsLeft = raidDef.normals;
  let supersLeft = raidDef.supers;
  for (let i = 0; i < total; i += 1) {
    const shouldSpawnSuper = supersLeft > 0 && (i % superInterval === 0 || normalsLeft <= 0);
    if (shouldSpawnSuper) {
      queue.push("super");
      supersLeft -= 1;
    } else {
      queue.push("normal");
      normalsLeft -= 1;
    }
  }

  if (raidDef.hasBoss) {
    queue.push("boss");
  }
  return queue;
}
