window.__zombieInvasionVersion = "v2026.06.03.playcanvas";

const root = document.getElementById("app");
const params = new URLSearchParams(window.location.search);

// Boot overlay management — safety timeout always fires so the overlay never permanently
// blocks either route. ?boothold=1 suppresses the hide for screenshot capture only.
(function setupBootOverlay() {
  if (params.get("boothold") === "1") return;
  const el = document.getElementById("zi-boot");
  if (!el) return;
  let hidden = false;
  function hideBootOverlay() {
    if (hidden) return;
    hidden = true;
    clearTimeout(safetyTimer);
    el.classList.add("is-hidden");
    setTimeout(() => el.classList.add("is-gone"), 450);
    window.removeEventListener("pointerdown", hideBootOverlay, true);
    window.removeEventListener("keydown", hideBootOverlay, true);
  }
  // Safety net: hide after 4 s regardless of which route loaded (protects legacy route).
  const safetyTimer = setTimeout(hideBootOverlay, 4000);
  // Manual escape hatch: any tap/click/key dismisses the loader so it can never trap a player.
  window.addEventListener("pointerdown", hideBootOverlay, true);
  window.addEventListener("keydown", hideBootOverlay, true);
  // Exposed so the PlayCanvas route can signal readiness on first frame.
  window.__ziBootHide = hideBootOverlay;
})();

if (params.get("legacy") === "1") {
  const { createFpsGame } = await import("./fps/app/FpsGame");
  await createFpsGame(root);
} else {
  const { createPlayCanvasGame } = await import("./playcanvas/main");
  createPlayCanvasGame(root);
}
