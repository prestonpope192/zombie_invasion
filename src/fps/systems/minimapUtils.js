function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function worldToMiniMapPoint({
  x,
  z,
  worldHalfExtent,
  mapSizePx,
  paddingPx = 10,
}) {
  const span = Math.max(1, worldHalfExtent * 2);
  const drawSize = Math.max(1, mapSizePx - paddingPx * 2);
  const nx = clamp((x + worldHalfExtent) / span, 0, 1);
  const nz = clamp((z + worldHalfExtent) / span, 0, 1);
  return {
    x: paddingPx + nx * drawSize,
    y: paddingPx + nz * drawSize,
  };
}

export function worldRadiusToMiniMapPx({
  radius,
  worldHalfExtent,
  mapSizePx,
  paddingPx = 10,
  minPx = 1,
  maxPx = 26,
}) {
  const drawSize = Math.max(1, mapSizePx - paddingPx * 2);
  const px = (Math.max(0, radius) / Math.max(1, worldHalfExtent * 2)) * drawSize;
  return clamp(px, minPx, maxPx);
}
