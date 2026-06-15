window.__zombieInvasionVersion = "v2026.06.03.playcanvas";

const root = document.getElementById("app");
const params = new URLSearchParams(window.location.search);

// Boot overlay management — safety timeout always fires so the overlay never permanently
// blocks either route. ?boothold=1 suppresses the hide for screenshot capture only.
(function setupBootOverlay() {
  if (params.get("boothold") === "1") return;
  const el = document.getElementById("zi-boot");
  if (!el) return;
  function hideBootOverlay() {
    el.classList.add("is-hidden");
    setTimeout(() => el.classList.add("is-gone"), 450);
  }
  // Safety net: hide after 9 s regardless of which route loaded (protects legacy route)
  const safetyTimer = setTimeout(hideBootOverlay, 9000);
  // Exposed so the PlayCanvas route can signal readiness on first frame
  window.__ziBootHide = function () {
    clearTimeout(safetyTimer);
    hideBootOverlay();
  };
})();

if (params.get("legacy") === "1") {
  const { createFpsGame } = await import("./fps/app/FpsGame");
  await createFpsGame(root);
} else {
  const { createPlayCanvasGame } = await import("./playcanvas/main");
  createPlayCanvasGame(root);
}
