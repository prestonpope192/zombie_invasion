window.__zombieInvasionVersion = "v2026.06.03.playcanvas";

const root = document.getElementById("app");
const params = new URLSearchParams(window.location.search);

if (params.get("legacy") === "1") {
  const { createFpsGame } = await import("./fps/app/FpsGame");
  await createFpsGame(root);
} else {
  const { createPlayCanvasGame } = await import("./playcanvas/main");
  createPlayCanvasGame(root);
}
