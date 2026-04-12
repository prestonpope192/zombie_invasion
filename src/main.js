import { createFpsGame } from "./fps/app/FpsGame";

window.__zombieInvasionVersion = "v2026.04.02.1";

const root = document.getElementById("app");
createFpsGame(root);
