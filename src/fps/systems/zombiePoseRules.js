export function computeForwardArmPose({ state, time, variant }) {
  if (state !== "advance" && state !== "attack_player" && state !== "attack_village") {
    return null;
  }

  // Variant is intentionally accepted for future tuning while preserving
  // consistent forward-arm readability across all zombie types today.
  void variant;

  const t = Number(time) || 0;
  if (state === "advance") {
    const sway = Math.sin(t * 3.1) * 0.1;
    const forearmSway = Math.sin(t * 3.1) * 0.06;
    return {
      leftArmPivot: { x: -1.05 + sway, y: 0, z: 0.08 },
      rightArmPivot: { x: -1.05 - sway, y: 0, z: -0.08 },
      leftForearmPivotX: -0.45 + forearmSway,
      rightForearmPivotX: -0.45 - forearmSway,
    };
  }

  const swipe = Math.sin(t * 6.2) * 0.26;
  const forearmSwipe = Math.sin(t * 6.2) * 0.16;
  return {
    leftArmPivot: { x: -1.3 + swipe, y: 0.1, z: 0.08 },
    rightArmPivot: { x: -1.3 - swipe, y: -0.1, z: -0.08 },
    leftForearmPivotX: -0.72 + forearmSwipe,
    rightForearmPivotX: -0.72 - forearmSwipe,
  };
}
