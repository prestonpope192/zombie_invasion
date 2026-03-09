function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const DEFAULT_HEADSHOT_MULTIPLIER = 1.5;
const RENDERED_HEAD_LOWER_FRACTION = 0.62;

const HEADSHOT_RATIO_BY_PROFILE = {
  crawler: 0.82,
  slim: 0.74,
  human: 0.72,
  leaper: 0.7,
  large: 0.68,
  armor: 0.66,
  flyer: 0.72,
  mega: 0.66,
  boss: 0.64,
};

export function computeHeadshotResult({
  hitPointY,
  bodyY,
  halfHeight,
  radius,
  hitboxProfile,
  renderedHeadY = null,
  renderedHeadRadius = null,
  multiplier = DEFAULT_HEADSHOT_MULTIPLIER,
}) {
  const hitY = Number(hitPointY) || 0;
  const headY = Number(renderedHeadY);
  const headRadius = Number(renderedHeadRadius);
  let headMinY;
  if (Number.isFinite(headY) && Number.isFinite(headRadius) && headRadius > 0.03) {
    headMinY = headY - headRadius * RENDERED_HEAD_LOWER_FRACTION;
  } else {
    const safeHalfHeight = Math.max(0.05, Number(halfHeight) || 0.5);
    const safeRadius = Math.max(0.05, Number(radius) || 0.2);
    const baseY = Number(bodyY) || 0;
    const totalHeight = safeHalfHeight * 2 + safeRadius * 2;
    const ratio = clamp(HEADSHOT_RATIO_BY_PROFILE[hitboxProfile] ?? 0.72, 0.55, 0.9);
    headMinY = baseY - safeHalfHeight - safeRadius + totalHeight * ratio;
  }
  const isHeadshot = hitY >= headMinY;
  return {
    isHeadshot,
    multiplier: isHeadshot ? multiplier : 1,
    headMinY,
  };
}

export function getDefaultHeadshotMultiplier() {
  return DEFAULT_HEADSHOT_MULTIPLIER;
}
