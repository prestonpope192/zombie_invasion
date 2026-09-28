window.__zombieInvasionVersion = "v2026.06.03.playcanvas";

import { createBootOverlayController, runBootAttempt } from "./bootLifecycle";

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

// Normal dismissal stays click-through; boot failures can restore the overlay as a modal.
(function setupBootOverlay() {
  const el = document.getElementById("zi-boot");
  if (!el) return null;
  const controller = createBootOverlayController({
    element: el,
    hold: params.get("boothold") === "1",
  });
  window.__ziBootHide = controller.hide;
  window.__ziBootFailure = controller.showFailure;
  return controller;
})();

const legacy = params.get("legacy") === "1";
await runBootAttempt({
  load: () => legacy ? import("./fps/app/FpsGame") : import("./playcanvas/main"),
  start: async (gameModule) => {
    if (legacy) {
      await gameModule.createFpsGame(root);
    } else {
      gameModule.createPlayCanvasGame(root);
    }
  },
  onFailure: (error) => {
    console.error("Zombie Invasion failed to boot.", error);
    window.__ziBootFailure?.();
  },
});
