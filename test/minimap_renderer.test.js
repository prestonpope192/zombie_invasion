import { describe, expect, it } from "vitest";
import { renderMiniMap, MINIMAP_COLORS, MINIMAP_PADDING_PX } from "../src/playcanvas/minimapRenderer";
import { worldToMiniMapPoint } from "../src/fps/systems/minimapUtils";

// Recording 2D-context stub: logs every draw call together with the
// fillStyle/strokeStyle active at the time, so tests can assert what was
// drawn, where, and in which color — without a real canvas.
function createRecordingCtx() {
  const calls = [];
  const ctx = {
    fillStyle: null,
    strokeStyle: null,
    lineWidth: 1,
    createLinearGradient: () => ({ addColorStop: () => {} }),
  };
  for (const method of [
    "clearRect", "fillRect", "strokeRect", "beginPath", "arc", "fill",
    "stroke", "moveTo", "lineTo", "closePath", "save", "restore",
    "translate", "rotate",
  ]) {
    ctx[method] = (...args) => {
      calls.push({ method, args, fillStyle: ctx.fillStyle, strokeStyle: ctx.strokeStyle, lineWidth: ctx.lineWidth });
    };
  }
  return { ctx, calls };
}

const SIZE = 132;

function baseSnapshot(overrides = {}) {
  return {
    worldHalfExtent: 38,
    player: { x: 0, z: 12, yaw: 0 },
    village: { x: 0, z: -12, radius: 4.4 },
    buildings: [],
    villagers: [],
    liveZombies: [],
    activeFirePatches: [],
    escortDropoff: null,
    villageStructures: [],
    ...overrides,
  };
}

function render(snapshot) {
  const { ctx, calls } = createRecordingCtx();
  renderMiniMap(ctx, { size: SIZE, snapshot, structures: [], gradientCache: {} });
  return calls;
}

describe("minimap renderer", () => {
  it("draws the player triangle in the legend player color at the projected point", () => {
    const snapshot = baseSnapshot();
    const calls = render(snapshot);

    const translate = calls.find((c) => c.method === "translate");
    const expected = worldToMiniMapPoint({
      x: snapshot.player.x,
      z: snapshot.player.z,
      worldHalfExtent: snapshot.worldHalfExtent,
      mapSizePx: SIZE,
      paddingPx: MINIMAP_PADDING_PX,
    });
    expect(translate.args[0]).toBeCloseTo(expected.x, 5);
    expect(translate.args[1]).toBeCloseTo(expected.y, 5);

    // The triangle fill after the translate uses the player legend color.
    const triangleFill = calls.filter((c) => c.method === "fill").at(-1);
    expect(triangleFill.fillStyle).toBe(MINIMAP_COLORS.player);
  });

  it("draws normal and heavy zombies with legend-matching colors and sizes", () => {
    const calls = render(baseSnapshot({
      liveZombies: [
        { x: 2, z: -4, type: "walker" },
        { x: -3, z: -6, type: "mini_boss" },
      ],
    }));

    const zombieArcs = calls.filter((c) => c.method === "arc" &&
      (c.fillStyle === MINIMAP_COLORS.zombie || c.fillStyle === MINIMAP_COLORS.heavyZombie));
    expect(zombieArcs).toHaveLength(2);

    const normal = zombieArcs.find((c) => c.fillStyle === MINIMAP_COLORS.zombie);
    const heavy = zombieArcs.find((c) => c.fillStyle === MINIMAP_COLORS.heavyZombie);
    expect(normal.args[2]).toBeCloseTo(2.2);
    expect(heavy.args[2]).toBeCloseTo(3.2);

    const expected = worldToMiniMapPoint({
      x: 2, z: -4, worldHalfExtent: 38, mapSizePx: SIZE, paddingPx: MINIMAP_PADDING_PX,
    });
    expect(normal.args[0]).toBeCloseTo(expected.x, 5);
    expect(normal.args[1]).toBeCloseTo(expected.y, 5);
  });

  it("draws the village ring with the legend village colors", () => {
    const calls = render(baseSnapshot());
    const villageFill = calls.find((c) => c.method === "arc" && c.fillStyle === MINIMAP_COLORS.villageFill);
    const villageStroke = calls.find((c) => c.method === "arc" && c.strokeStyle === MINIMAP_COLORS.villageStroke);
    expect(villageFill).toBeTruthy();
    expect(villageStroke).toBeTruthy();
  });

  it("reuses the cached background gradient across frames of the same size", () => {
    const { ctx, calls } = createRecordingCtx();
    let created = 0;
    ctx.createLinearGradient = () => { created += 1; return { addColorStop: () => {} }; };
    const cache = {};
    renderMiniMap(ctx, { size: SIZE, snapshot: baseSnapshot(), structures: [], gradientCache: cache });
    renderMiniMap(ctx, { size: SIZE, snapshot: baseSnapshot(), structures: [], gradientCache: cache });
    expect(created).toBe(1);
    expect(calls.filter((c) => c.method === "clearRect")).toHaveLength(2);
  });

  it("draws healthy and damaged structure footprints by matching id", () => {
    const structures = [
      { id: "healthy", x: -8, z: -10, sx: 4, sz: 4 },
      { id: "damaged", x: 8, z: -10, sx: 4, sz: 4 },
    ];
    const calls = createRecordingCtx();
    renderMiniMap(calls.ctx, { size: SIZE, snapshot: baseSnapshot({
      villageStructures: [{ id: "healthy", damageTier: 0 }, { id: "damaged", damageTier: 2 }],
    }), structures, gradientCache: {} });
    const footprints = calls.calls.filter((call) => call.method === "fillRect").slice(-2);
    expect(footprints.map((call) => call.fillStyle)).toEqual([
      "rgba(93,108,121,0.58)", MINIMAP_COLORS.villageDamage2Fill,
    ]);
    expect(calls.calls.filter((call) => call.method === "strokeRect").at(-1).strokeStyle)
      .toBe(MINIMAP_COLORS.villageDamage2Stroke);
  });

  it("draws an attack ring and a destroyed dark footprint with an X", () => {
    const { ctx, calls } = createRecordingCtx();
    renderMiniMap(ctx, { size: SIZE, snapshot: baseSnapshot({ villageStructures: [
      { id: "attacked", damageTier: 1, underAttackSec: 0.5 },
      { id: "destroyed", damageTier: 3, destroyed: true, underAttackSec: 2 },
    ] }), structures: [
      { id: "attacked", x: -8, z: -10, sx: 4, sz: 4 },
      { id: "destroyed", x: 8, z: -10, sx: 4, sz: 4 },
    ], gradientCache: {} });
    const attackArc = calls.find((call) => call.method === "arc" && call.strokeStyle === MINIMAP_COLORS.villageAttackMarker);
    expect(attackArc).toBeTruthy();
    expect(attackArc.args[2]).toBeGreaterThan(2);
    expect(attackArc.lineWidth).toBe(2.25);
    const attackGlyph = calls.find((call) => call.method === "fill" && call.fillStyle === MINIMAP_COLORS.villageAttackMarker);
    expect(attackGlyph).toBeTruthy();
    const destroyed = calls.filter((call) => call.method === "fillRect" && call.fillStyle === MINIMAP_COLORS.villageDestroyedFill);
    expect(destroyed).toHaveLength(1);
    const cross = calls.filter((call) => call.method === "lineTo" && call.strokeStyle === MINIMAP_COLORS.villageDestroyedMarker);
    expect(cross).toHaveLength(2);
    expect(cross.every((call) => call.lineWidth === 2)).toBe(true);
    const villageRing = calls.find((call) => call.method === "arc" && call.strokeStyle === MINIMAP_COLORS.villageStroke);
    expect(villageRing.lineWidth).toBe(1);
  });
});
