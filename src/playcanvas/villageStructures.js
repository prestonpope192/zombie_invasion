export const BASE_VILLAGE_MAX_HP = 700;
export const VILLAGE_FENCE_X = 7.2;

export const VILLAGE_FENCE_GATES = [
  { id: "north", z: -22, halfWidth: 2.7 },
  { id: "middle", z: -12.4, halfWidth: 2.7 },
  { id: "south", z: 0.4, halfWidth: 2.7 },
];

export const VILLAGE_FENCE_SEGMENTS = createFenceSegments(-58, 22, VILLAGE_FENCE_GATES);

export const VILLAGE_STRUCTURE_DEFS = [
  {
    id: "bell_tower",
    label: "Bell Tower",
    kind: "tower",
    x: 0,
    z: -24,
    sx: 3.3,
    sy: 6,
    sz: 2.8,
    hpShare: 0.17,
    gateZ: -22,
  },
  {
    id: "north_lodge",
    label: "North Lodge",
    kind: "house",
    visualIndex: 0,
    x: -9.5,
    z: -22,
    sx: 5.8,
    sy: 3.2,
    sz: 5.8,
    hpShare: 0.13,
    gateZ: -22,
  },
  {
    id: "blacksmith",
    label: "Blacksmith",
    kind: "house",
    visualIndex: 1,
    x: 9.4,
    z: -20.8,
    sx: 5.6,
    sy: 3,
    sz: 5.4,
    hpShare: 0.14,
    gateZ: -22,
  },
  {
    id: "safe_house",
    label: "Safe House",
    kind: "house",
    visualIndex: 2,
    x: -13.2,
    z: -13,
    sx: 6.4,
    sy: 3.5,
    sz: 5.2,
    hpShare: 0.14,
    gateZ: -12.4,
  },
  {
    id: "barn",
    label: "Barn",
    kind: "house",
    visualIndex: 3,
    x: 13.4,
    z: -11.8,
    sx: 6.2,
    sy: 3.4,
    sz: 5.4,
    hpShare: 0.15,
    gateZ: -12.4,
  },
  {
    id: "west_homestead",
    label: "West Homestead",
    kind: "house",
    visualIndex: 4,
    x: -15.4,
    z: 0.6,
    sx: 7.2,
    sy: 3.7,
    sz: 6.8,
    hpShare: 0.13,
    gateZ: 0.4,
  },
  {
    id: "east_homestead",
    label: "East Homestead",
    kind: "house",
    visualIndex: 5,
    x: 15.8,
    z: 0.2,
    sx: 7.4,
    sy: 3.8,
    sz: 7,
    hpShare: 0.14,
    gateZ: 0.4,
  },
];

const STRUCTURE_DEF_BY_ID = new Map(VILLAGE_STRUCTURE_DEFS.map((structure) => [structure.id, structure]));

export function getVillageStructureDef(structureId) {
  return STRUCTURE_DEF_BY_ID.get(structureId) ?? null;
}

export function createVillageStructureStates(totalMaxHp = BASE_VILLAGE_MAX_HP) {
  const total = Math.max(VILLAGE_STRUCTURE_DEFS.length, Math.round(Number(totalMaxHp) || BASE_VILLAGE_MAX_HP));
  let assigned = 0;
  return VILLAGE_STRUCTURE_DEFS.map((definition, index) => {
    const maxHp = index === VILLAGE_STRUCTURE_DEFS.length - 1
      ? total - assigned
      : Math.max(1, Math.round(total * definition.hpShare));
    assigned += maxHp;
    return {
      id: definition.id,
      hp: maxHp,
      maxHp,
      underAttackSec: 0,
      attackerCount: 0,
      lastDamageSec: -1,
      destroyedAtWave: null,
    };
  });
}

export function resizeVillageStructureStates(structures, totalMaxHp, { repair = false } = {}) {
  const source = new Map((structures ?? []).map((structure) => [structure.id, structure]));
  const resized = createVillageStructureStates(totalMaxHp);
  for (const structure of resized) {
    const previous = source.get(structure.id);
    if (!previous || repair) continue;
    const previousMaxHp = Math.max(1, Number(previous.maxHp) || 1);
    const ratio = Math.max(0, Math.min(1, (Number(previous.hp) || 0) / previousMaxHp));
    structure.hp = structure.maxHp * ratio;
    structure.underAttackSec = Math.max(0, Number(previous.underAttackSec) || 0);
    structure.attackerCount = Math.max(0, Math.round(Number(previous.attackerCount) || 0));
    structure.lastDamageSec = Number(previous.lastDamageSec) || -1;
    structure.destroyedAtWave = ratio <= 0 ? (previous.destroyedAtWave ?? null) : null;
  }
  return resized;
}

export function syncVillageHealthAggregate(state) {
  const structures = state.villageStructures ?? [];
  state.maxVillageHp = structures.reduce((total, structure) => total + Math.max(0, Number(structure.maxHp) || 0), 0);
  state.villageHp = structures.reduce((total, structure) => total + Math.max(0, Number(structure.hp) || 0), 0);
  return state.villageHp;
}

export function getVillageStructureDamageTier(structure) {
  const maxHp = Math.max(1, Number(structure?.maxHp) || 1);
  const hp = Math.max(0, Number(structure?.hp) || 0);
  if (hp <= 0) return 4;
  const ratio = hp / maxHp;
  if (ratio <= 0.18) return 3;
  if (ratio <= 0.42) return 2;
  if (ratio <= 0.72) return 1;
  return 0;
}

export function selectNearestLiveVillageStructure(structures, origin, preferredId = null) {
  const live = (structures ?? []).filter((structure) => Number(structure.hp) > 0);
  if (!live.length) return null;
  const preferred = preferredId ? live.find((structure) => structure.id === preferredId) : null;
  if (preferred) return preferred;
  let best = null;
  let bestDistanceSq = Infinity;
  for (const structure of live) {
    const definition = getVillageStructureDef(structure.id);
    if (!definition) continue;
    const point = getVillageStructureAttackPoint(definition, origin);
    const dx = point.x - origin.x;
    const dz = point.z - origin.z;
    const distanceSq = dx * dx + dz * dz;
    if (
      distanceSq < bestDistanceSq - 1e-8 ||
      (Math.abs(distanceSq - bestDistanceSq) <= 1e-8 && structure.id.localeCompare(best?.id ?? "") < 0)
    ) {
      best = structure;
      bestDistanceSq = distanceSq;
    }
  }
  return best;
}

export function getVillageStructureAttackPoint(definition, origin) {
  const halfX = definition.sx * 0.5;
  const halfZ = definition.sz * 0.5;
  const minX = definition.x - halfX;
  const maxX = definition.x + halfX;
  const minZ = definition.z - halfZ;
  const maxZ = definition.z + halfZ;
  let x = clamp(origin.x, minX, maxX);
  let z = clamp(origin.z, minZ, maxZ);

  if (origin.x >= minX && origin.x <= maxX && origin.z >= minZ && origin.z <= maxZ) {
    const distances = [
      { value: origin.x - minX, x: minX, z: origin.z },
      { value: maxX - origin.x, x: maxX, z: origin.z },
      { value: origin.z - minZ, x: origin.x, z: minZ },
      { value: maxZ - origin.z, x: origin.x, z: maxZ },
    ].sort((a, b) => a.value - b.value);
    x = distances[0].x;
    z = distances[0].z;
  }

  return { x, z };
}

export function getVillageStructureNavigationPoint(definition, origin, { flyer = false } = {}) {
  const attackPoint = getVillageStructureAttackPoint(definition, origin);
  if (flyer || Math.abs(definition.x) <= VILLAGE_FENCE_X + 0.25) return attackPoint;

  const side = Math.sign(definition.x) || 1;
  const isInsideFence = side > 0
    ? origin.x < VILLAGE_FENCE_X + 0.55
    : origin.x > -VILLAGE_FENCE_X - 0.55;
  if (!isInsideFence) return attackPoint;

  return {
    x: side * (VILLAGE_FENCE_X + 0.9),
    z: definition.gateZ,
  };
}

function createFenceSegments(minZ, maxZ, gates) {
  const sorted = [...gates].sort((a, b) => a.z - b.z);
  const segments = [];
  let cursor = minZ;
  for (const gate of sorted) {
    const gateStart = Math.max(minZ, gate.z - gate.halfWidth);
    const gateEnd = Math.min(maxZ, gate.z + gate.halfWidth);
    if (gateStart > cursor) segments.push({ minZ: cursor, maxZ: gateStart });
    cursor = Math.max(cursor, gateEnd);
  }
  if (cursor < maxZ) segments.push({ minZ: cursor, maxZ });
  return segments;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
