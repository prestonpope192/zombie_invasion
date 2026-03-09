export function computeHealthRatio(current, max) {
  const parsedMax = Number(max);
  if (!Number.isFinite(parsedMax) || parsedMax <= 0) {
    return 0;
  }
  const parsedCurrent = Number(current);
  if (!Number.isFinite(parsedCurrent)) {
    return 0;
  }
  return Math.min(1, Math.max(0, parsedCurrent / parsedMax));
}

export function computeVillageDamageStage(currentHp, maxHp) {
  const ratio = computeHealthRatio(currentHp, maxHp);
  if (ratio <= 0.25) {
    return 3;
  }
  if (ratio <= 0.5) {
    return 2;
  }
  if (ratio <= 0.75) {
    return 1;
  }
  return 0;
}
