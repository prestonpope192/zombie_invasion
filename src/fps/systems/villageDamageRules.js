const STRUCTURE_PREFIXES = ["village_", "interior_", "lamp_"];
const STRUCTURE_IDS = new Set([
  "village_core",
]);

export function isVillageStructureHit(entityId) {
  if (typeof entityId !== "string" || !entityId) {
    return false;
  }
  if (STRUCTURE_IDS.has(entityId)) {
    return true;
  }
  return STRUCTURE_PREFIXES.some((prefix) => entityId.startsWith(prefix));
}

export function computeVillageStructureDamage({
  projectileDamage,
  weaponCategory,
  materialId,
  windowShattered = false,
} = {}) {
  const damage = Math.max(0, Number(projectileDamage ?? 0));
  if (damage <= 0) {
    return 0;
  }

  const material = typeof materialId === "string" ? materialId : "concrete";
  const baseByMaterial = {
    glass: 4.8,
    wood: 3.4,
    concrete: 2.8,
    steel: 2.3,
    soil: 1.6,
  };
  const ratioByMaterial = {
    glass: 0.13,
    wood: 0.09,
    concrete: 0.08,
    steel: 0.06,
    soil: 0.05,
  };
  const base = baseByMaterial[material] ?? 2.6;
  const ratio = ratioByMaterial[material] ?? 0.075;
  const explosiveBoost = weaponCategory === "explosive" ? 1.55 : 1;
  const shatteredBonus = windowShattered ? 3.5 : 0;

  return Number(
    Math.min(40, (base + damage * ratio) * explosiveBoost + shatteredBonus).toFixed(2),
  );
}
