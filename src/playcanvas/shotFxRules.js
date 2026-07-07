export function computeBallisticTracerDrop(ballistic, traceLengthMeters, visualScale = 3) {
  const actualDrop = Number(ballistic?.dropMeters ?? 0);
  const shotDistance = Number(ballistic?.distanceMeters ?? traceLengthMeters ?? 0);
  const traceLength = Number(traceLengthMeters ?? 0);
  const scale = Number(visualScale ?? 0);
  if (
    !Number.isFinite(actualDrop)
    || !Number.isFinite(shotDistance)
    || !Number.isFinite(traceLength)
    || !Number.isFinite(scale)
    || actualDrop <= 0
    || shotDistance <= 0
    || traceLength <= 0
    || scale <= 0
  ) {
    return 0;
  }
  const distanceRatio = Math.min(1, Math.max(0, traceLength / Math.max(0.001, shotDistance)));
  const visualDrop = actualDrop * distanceRatio * distanceRatio * scale;
  return Number(Math.min(1.6, Math.max(0, visualDrop)).toFixed(3));
}
