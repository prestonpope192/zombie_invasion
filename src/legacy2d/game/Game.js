import Phaser from "phaser";
import { BootScene } from "../scenes/BootScene";
import { TitleScene } from "../scenes/TitleScene";
import { HubScene } from "../scenes/HubScene";
import { RaidScene } from "../scenes/RaidScene";
import { ShopScene } from "../scenes/ShopScene";
import { PauseOverlay } from "../scenes/PauseOverlay";
import { GameOverScene } from "../scenes/GameOverScene";
import { VictoryScene } from "../scenes/VictoryScene";

const GAME_WIDTH = 960;
const GAME_HEIGHT = 640;

function getActiveGameScene(game) {
  const scenes = game.scene.getScenes(true);
  return (
    scenes.find((scene) => scene.scene.key === "RaidScene") ||
    scenes.find((scene) => scene.scene.key === "HubScene") ||
    scenes.find((scene) => scene.scene.key === "TitleScene") ||
    scenes[0]
  );
}

export function createZombieGame(parent) {
  const game = new Phaser.Game({
    type: Phaser.CANVAS,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent,
    backgroundColor: "#101522",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    scene: [BootScene, TitleScene, HubScene, RaidScene, ShopScene, PauseOverlay, GameOverScene, VictoryScene],
  });

  window.render_game_to_text = () => {
    const scene = getActiveGameScene(game);
    if (scene && typeof scene.renderGameToText === "function") {
      return scene.renderGameToText();
    }
    return JSON.stringify({ mode: "booting" });
  };

  window.advanceTime = (ms) => {
    const scene = getActiveGameScene(game);
    if (scene && typeof scene.advanceSimulation === "function") {
      scene.advanceSimulation(ms);
    }
  };

  return game;
}
