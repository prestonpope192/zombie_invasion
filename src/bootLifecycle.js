export function createBootOverlayController({
  element,
  windowObject = window,
  contentRoot = null,
  retryButton = element.querySelector("[data-zi-boot-retry]"),
  message = element.querySelector("[data-zi-boot-message]"),
  hold = false,
  onRetry = () => windowObject.location.reload(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  let state = "loading";
  let generation = 0;
  let safetyTimer = null;
  let goneTimer = null;

  const clearScheduledHides = () => {
    clearTimer(safetyTimer);
    clearTimer(goneTimer);
    safetyTimer = null;
    goneTimer = null;
  };

  const hide = () => {
    if (hold || state !== "loading") return;
    state = "hidden";
    const transition = ++generation;
    clearTimer(safetyTimer);
    safetyTimer = null;
    element.classList.add("is-hidden");
    goneTimer = setTimer(() => {
      if (state !== "hidden" || transition !== generation) return;
      state = "gone";
      element.classList.add("is-gone");
      goneTimer = null;
    }, 450);
    windowObject.removeEventListener("pointerdown", dismiss, true);
    windowObject.removeEventListener("keydown", hide, true);
  };

  const dismiss = (event) => {
    if (event?.target?.closest?.("[data-zi-boot-retry]")) return;
    hide();
  };

  const retry = () => onRetry();
  if (retryButton) retryButton.addEventListener("click", retry);

  if (!hold) {
    safetyTimer = setTimer(hide, 4000);
    windowObject.addEventListener("pointerdown", dismiss, true);
    windowObject.addEventListener("keydown", hide, true);
  }

  return {
    get state() {
      return state;
    },
    hide,
    showFailure() {
      if (state === "failed") return;
      state = "failed";
      generation += 1;
      clearScheduledHides();
      element.classList.remove("is-hidden", "is-gone");
      element.classList.add("is-error");
      element.setAttribute("role", "alertdialog");
      element.setAttribute("aria-modal", "true");
      element.setAttribute("aria-hidden", "false");
      element.setAttribute("aria-label", "Zombie Invasion could not start");
      if (contentRoot) {
        contentRoot.inert = true;
        contentRoot.setAttribute("inert", "");
        contentRoot.setAttribute("aria-hidden", "true");
      }
      if (message) message.textContent = "The game couldn't start. Check your connection and retry.";
      windowObject.removeEventListener("pointerdown", dismiss, true);
      windowObject.removeEventListener("keydown", hide, true);
      windowObject.document?.addEventListener("keydown", (event) => {
        if (state !== "failed" || event.key !== "Tab") return;
        const focusable = Array.from(element.querySelectorAll(
          'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ));
        if (!focusable.length) {
          event.preventDefault();
          return;
        }
        const index = focusable.indexOf(windowObject.document.activeElement);
        if (index === -1 || (event.shiftKey && index === 0) || (!event.shiftKey && index === focusable.length - 1)) {
          event.preventDefault();
          focusable[event.shiftKey ? focusable.length - 1 : 0].focus();
        }
      }, true);
      retryButton?.focus();
    },
  };
}

export async function runBootAttempt({ load, start, onFailure }) {
  try {
    const module = await load();
    await start(module);
    return true;
  } catch (error) {
    onFailure(error);
    return false;
  }
}
