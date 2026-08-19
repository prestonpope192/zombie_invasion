window.__zombieInvasionVersion = "v2026.06.03.playcanvas";

const root = document.getElementById("app");
const params = new URLSearchParams(window.location.search);

// Mobile Safari can still trigger page zoom from rapid double taps or pinch
// gestures even with a locked viewport. Block those browser gestures at the
// document level so game controls cannot leave the player stuck zoomed in.
(function installMobileZoomGuards() {
  if (window.__ziMobileZoomGuardsInstalled) return;
  window.__ziMobileZoomGuardsInstalled = true;

  const preventZoomGesture = (event) => {
    event.preventDefault();
  };
  let lastTouchEndAt = Number.NEGATIVE_INFINITY;

  document.addEventListener("gesturestart", preventZoomGesture, { capture: true, passive: false });
  document.addEventListener("gesturechange", preventZoomGesture, { capture: true, passive: false });
  document.addEventListener("gestureend", preventZoomGesture, { capture: true, passive: false });
  document.addEventListener("dblclick", preventZoomGesture, { capture: true, passive: false });
  document.addEventListener(
    "touchmove",
    (event) => {
      if ((event.touches?.length ?? 0) > 1) {
        event.preventDefault();
      }
    },
    { capture: true, passive: false },
  );
  document.addEventListener(
    "touchend",
    (event) => {
      const now = performance.now();
      if (now - lastTouchEndAt < 360) {
        event.preventDefault();
      }
      lastTouchEndAt = now;
    },
    { capture: true, passive: false },
  );
})();

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
