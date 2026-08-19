// Minimap canvas renderer — pure 2D drawing, no PlayCanvas API and no game
// class state. Extracted from main.js so it can be unit-tested with a
// recording context stub. All world→map math comes from the shared
// minimapUtils projection helpers.
import { worldRadiusToMiniMapPx, worldToMiniMapPoint } from "../fps/systems/minimapUtils";

export const MINIMAP_PADDING_PX = 10;

// Dot/marker colors mirror the HUD legend (playcanvas.css --zi tokens):
// player --zi-stamina, enemy --zi-accent, village --zi-village.
export const MINIMAP_COLORS = {
  player: "rgba(74,168,232,0.98)",
  zombie: "rgba(124,255,79,0.9)",
  heavyZombie: "rgba(255,116,76,0.96)",
  villageFill: "rgba(240,168,56,0.16)",
  villageStroke: "rgba(240,168,56,0.72)",
  villageDamage1Fill: "rgba(255,190,64,0.22)",
  villageDamage1Stroke: "rgba(255,190,64,0.88)",
  villageDamage2Fill: "rgba(255,126,36,0.3)",
  villageDamage2Stroke: "rgba(255,126,36,0.95)",
  villageDamage3Fill: "rgba(214,52,42,0.38)",
  villageDamage3Stroke: "rgba(214,52,42,1)",
  villageDestroyedFill: "rgba(89,24,31,0.72)",
  villageDestroyedStroke: "rgba(145,38,45,0.98)",
  villageAttackMarker: "rgba(255,220,108,0.98)",
  villageDestroyedMarker: "rgba(255,92,76,1)",
};

const VILLAGE_DAMAGE_COLORS = [
  { fill: "rgba(93,108,121,0.58)", stroke: "rgba(216,255,125,0.16)" },
  { fill: MINIMAP_COLORS.villageDamage1Fill, stroke: MINIMAP_COLORS.villageDamage1Stroke },
  { fill: MINIMAP_COLORS.villageDamage2Fill, stroke: MINIMAP_COLORS.villageDamage2Stroke },
  { fill: MINIMAP_COLORS.villageDamage3Fill, stroke: MINIMAP_COLORS.villageDamage3Stroke },
];

/**
 * Draw one minimap frame.
 * @param ctx           CanvasRenderingContext2D (or a recording stub)
 * @param size          canvas width/height in px (square)
 * @param snapshot      getPlayCanvasMiniMapSnapshot(state) result
 * @param structures    static structure rects [{x, z, sx, sz}]
 * @param gradientCache mutable {gradient, size} object owned by the caller so
 *                      the background gradient survives across frames
 */
export function renderMiniMap(ctx, { size, snapshot, structures, gradientCache }) {
  const pad = MINIMAP_PADDING_PX;
  const drawSize = size - pad * 2;
  const toMap = (point) =>
    worldToMiniMapPoint({
      x: point.x,
      z: point.z,
      worldHalfExtent: snapshot.worldHalfExtent,
      mapSizePx: size,
      paddingPx: pad,
    });

  ctx.clearRect(0, 0, size, size);
  // Lazy-cache the background gradient — args are constant (size never changes).
  if (!gradientCache.gradient || gradientCache.size !== size) {
    const bg = ctx.createLinearGradient(0, 0, 0, size);
    bg.addColorStop(0, "rgba(9,23,27,0.94)");
    bg.addColorStop(1, "rgba(5,10,16,0.96)");
    gradientCache.gradient = bg;
    gradientCache.size = size;
  }
  ctx.fillStyle = gradientCache.gradient;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "rgba(216,255,125,0.26)";
  ctx.lineWidth = 1;
  ctx.strokeRect(pad, pad, drawSize, drawSize);

  for (const building of snapshot.buildings) {
    const point = toMap(building.exteriorDoor);
    ctx.fillStyle = building.opened ? "rgba(216,255,125,0.86)" : "rgba(188,235,135,0.58)";
    ctx.fillRect(point.x - 2, point.y - 2, 4, 4);
  }

  const villageStructures = new Map((snapshot.villageStructures ?? []).map((structure) => [structure.id, structure]));
  for (const structure of structures) {
    const center = toMap(structure);
    const halfW = worldRadiusToMiniMapPx({
      radius: structure.sx * 0.5,
      worldHalfExtent: snapshot.worldHalfExtent,
      mapSizePx: size,
      paddingPx: pad,
      minPx: 2,
      maxPx: 20,
    });
    const halfH = worldRadiusToMiniMapPx({
      radius: structure.sz * 0.5,
      worldHalfExtent: snapshot.worldHalfExtent,
      mapSizePx: size,
      paddingPx: pad,
      minPx: 2,
      maxPx: 20,
    });
    const status = villageStructures.get(structure.id);
    const colors = status?.destroyed
      ? { fill: MINIMAP_COLORS.villageDestroyedFill, stroke: MINIMAP_COLORS.villageDestroyedStroke }
      : VILLAGE_DAMAGE_COLORS[Math.max(0, Math.min(3, Number(status?.damageTier) || 0))];
    ctx.fillStyle = colors.fill;
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = 1;
    ctx.fillRect(center.x - halfW, center.y - halfH, halfW * 2, halfH * 2);
    ctx.strokeRect(center.x - halfW, center.y - halfH, halfW * 2, halfH * 2);

    if (status?.destroyed) {
      ctx.strokeStyle = MINIMAP_COLORS.villageDestroyedMarker;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(center.x - halfW, center.y - halfH);
      ctx.lineTo(center.x + halfW, center.y + halfH);
      ctx.moveTo(center.x + halfW, center.y - halfH);
      ctx.lineTo(center.x - halfW, center.y + halfH);
      ctx.stroke();
    } else if (Number(status?.underAttackSec) > 0) {
      ctx.strokeStyle = MINIMAP_COLORS.villageAttackMarker;
      ctx.lineWidth = 2.25;
      ctx.beginPath();
      ctx.arc(center.x, center.y, Math.max(halfW, halfH) + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = MINIMAP_COLORS.villageAttackMarker;
      ctx.beginPath();
      ctx.moveTo(center.x, center.y - halfH - 5);
      ctx.lineTo(center.x + 3, center.y - halfH - 2);
      ctx.lineTo(center.x, center.y - halfH + 1);
      ctx.lineTo(center.x - 3, center.y - halfH - 2);
      ctx.closePath();
      ctx.fill();
    }
  }

  const villagePoint = toMap(snapshot.village);
  const villageRadius = worldRadiusToMiniMapPx({
    radius: snapshot.village.radius,
    worldHalfExtent: snapshot.worldHalfExtent,
    mapSizePx: size,
    paddingPx: pad,
    minPx: 5,
    maxPx: 24,
  });
  ctx.fillStyle = MINIMAP_COLORS.villageFill;
  ctx.beginPath();
  ctx.arc(villagePoint.x, villagePoint.y, villageRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = MINIMAP_COLORS.villageStroke;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(villagePoint.x, villagePoint.y, villageRadius, 0, Math.PI * 2);
  ctx.stroke();

  for (const patch of snapshot.activeFirePatches) {
    const point = toMap(patch);
    const radiusPx = worldRadiusToMiniMapPx({
      radius: patch.radius,
      worldHalfExtent: snapshot.worldHalfExtent,
      mapSizePx: size,
      paddingPx: pad,
      minPx: 3,
      maxPx: 16,
    });
    ctx.fillStyle = "rgba(255,128,48,0.2)";
    ctx.beginPath();
    ctx.arc(point.x, point.y, radiusPx, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,178,99,0.95)";
    ctx.beginPath();
    ctx.arc(point.x, point.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const villager of snapshot.villagers) {
    if (villager.state !== "idle" && villager.state !== "escorting") {
      continue;
    }
    const point = toMap(villager);
    ctx.fillStyle = villager.state === "escorting" ? "rgba(104,187,255,0.98)" : "rgba(74,171,255,0.9)";
    ctx.beginPath();
    ctx.arc(point.x, point.y, villager.state === "escorting" ? 2.8 : 2.1, 0, Math.PI * 2);
    ctx.fill();
  }

  if (snapshot.escortDropoff) {
    const dropoffPoint = toMap(snapshot.escortDropoff);
    const dropoffRadius = worldRadiusToMiniMapPx({
      radius: snapshot.escortDropoff.radius,
      worldHalfExtent: snapshot.worldHalfExtent,
      mapSizePx: size,
      paddingPx: pad,
      minPx: 4,
      maxPx: 18,
    });
    const escort = snapshot.villagers.find((villager) => villager.state === "escorting");
    if (escort) {
      const escortPoint = toMap(escort);
      ctx.strokeStyle = "rgba(104,187,255,0.48)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(escortPoint.x, escortPoint.y);
      ctx.lineTo(dropoffPoint.x, dropoffPoint.y);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(240,168,56,0.86)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(dropoffPoint.x, dropoffPoint.y, dropoffRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(240,168,56,0.96)";
    ctx.beginPath();
    ctx.arc(dropoffPoint.x, dropoffPoint.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const zombie of snapshot.liveZombies) {
    const point = toMap(zombie);
    const isHeavy = zombie.type === "mega_zombie" || zombie.type === "secret_boss" || zombie.type === "mini_boss" || zombie.type === "juggernaut";
    ctx.fillStyle = isHeavy ? MINIMAP_COLORS.heavyZombie : MINIMAP_COLORS.zombie;
    ctx.beginPath();
    ctx.arc(point.x, point.y, isHeavy ? 3.2 : 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  const playerPoint = toMap(snapshot.player);
  ctx.save();
  ctx.translate(playerPoint.x, playerPoint.y);
  ctx.rotate(-snapshot.player.yaw);
  ctx.fillStyle = MINIMAP_COLORS.player;
  ctx.beginPath();
  ctx.moveTo(0, -5.2);
  ctx.lineTo(3.6, 4.4);
  ctx.lineTo(-3.6, 4.4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
