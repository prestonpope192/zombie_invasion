import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { PlayerControllerFps } from "../src/fps/systems/playerControllerFps";

function ensureBrowserStubs() {
  if (!globalThis.window) {
    globalThis.window = {};
  }
  if (!globalThis.document) {
    globalThis.document = {};
  }
  if (!window.addEventListener) {
    window.addEventListener = () => {};
  }
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false });
  }
  if (!document.addEventListener) {
    document.addEventListener = () => {};
  }
  if (!("pointerLockElement" in document)) {
    document.pointerLockElement = null;
  }
}

function createHarness() {
  ensureBrowserStubs();
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 100);
  const canvas = {
    isConnected: false,
    addEventListener() {},
  };
  const controller = new PlayerControllerFps({ camera, canvas, sensitivity: 0.18 });

  const playerBody = {
    body: {
      _pos: { x: 0, y: 0, z: 0 },
      translation() {
        return this._pos;
      },
      setNextKinematicTranslation(next) {
        this._pos = { ...next };
      },
      setTranslation(next) {
        this._pos = { ...next };
      },
    },
  };

  const physics = {
    moveCharacter(body, desiredTranslation) {
      const p = body.body._pos;
      body.body._pos = {
        x: p.x + desiredTranslation.x,
        y: p.y + desiredTranslation.y,
        z: p.z + desiredTranslation.z,
      };
      return { correction: desiredTranslation, grounded: false };
    },
  };

  return { controller, playerBody, physics };
}

function zeroMobile() {
  return {
    moveX: 0,
    moveY: 0,
    lookX: 0,
    lookY: 0,
    fire: false,
    ads: false,
    jump: false,
    crouch: false,
    sprint: false,
    reload: false,
    interact: false,
    grenade: false,
  };
}

describe("player controller jump tuning", () => {
  it("spends stamina on jump and double jump", () => {
    const { controller, playerBody, physics } = createHarness();
    const dt = 0;

    controller.state.stamina = 100;
    controller.state.grounded = true;
    controller.keyState.set("space", true);
    controller.update({ dt, mobileSnapshot: zeroMobile(), physics, playerBody });

    expect(controller.state.stamina).toBe(88);

    controller.keyState.set("space", false);
    controller.update({ dt, mobileSnapshot: zeroMobile(), physics, playerBody });

    controller.keyState.set("space", true);
    controller.update({ dt, mobileSnapshot: zeroMobile(), physics, playerBody });

    expect(controller.state.doubleJumpActive).toBe(true);
    expect(controller.state.stamina).toBe(72);
  });

  it("allows a stronger second jump at any point while airborne", () => {
    const { controller, playerBody, physics } = createHarness();
    const dt = 1 / 60;

    controller.state.grounded = true;
    controller.keyState.set("space", true);
    controller.update({ dt, mobileSnapshot: zeroMobile(), physics, playerBody });
    const firstJumpVelocity = controller.state.velocity.y;

    controller.keyState.set("space", false);
    for (let i = 0; i < 18; i += 1) {
      controller.update({ dt, mobileSnapshot: zeroMobile(), physics, playerBody });
    }

    controller.keyState.set("space", true);
    controller.update({ dt, mobileSnapshot: zeroMobile(), physics, playerBody });

    expect(controller.state.doubleJumpActive).toBe(true);
    expect(controller.state.velocity.y).toBeGreaterThan(firstJumpVelocity + 1.5);
  });

  it("permits only one double jump per airtime", () => {
    const { controller, playerBody, physics } = createHarness();
    const dt = 1 / 60;

    controller.state.grounded = true;
    controller.keyState.set("space", true);
    controller.update({ dt, mobileSnapshot: zeroMobile(), physics, playerBody });

    controller.keyState.set("space", false);
    controller.update({ dt, mobileSnapshot: zeroMobile(), physics, playerBody });

    controller.keyState.set("space", true);
    controller.update({ dt, mobileSnapshot: zeroMobile(), physics, playerBody });
    expect(controller.state.canDoubleJump).toBe(false);
    const velocityAfterDoubleJump = controller.state.velocity.y;

    controller.keyState.set("space", false);
    controller.update({ dt, mobileSnapshot: zeroMobile(), physics, playerBody });
    const beforeThirdJumpPress = controller.state.velocity.y;

    controller.keyState.set("space", true);
    controller.update({ dt, mobileSnapshot: zeroMobile(), physics, playerBody });

    expect(controller.state.velocity.y).toBeLessThanOrEqual(beforeThirdJumpPress);
    expect(controller.state.velocity.y).toBeLessThanOrEqual(velocityAfterDoubleJump);
    expect(controller.state.canDoubleJump).toBe(false);
  });

  it("uses reduced gravity during early double-jump ascent", () => {
    const dt = 1 / 60;

    const floatHarness = createHarness();
    floatHarness.controller.state.grounded = false;
    floatHarness.controller.state.velocity.y = 8.4;
    floatHarness.controller.state.doubleJumpActive = true;
    floatHarness.controller.state.doubleJumpFloatTimer = 0;
    floatHarness.controller.update({
      dt,
      mobileSnapshot: zeroMobile(),
      physics: floatHarness.physics,
      playerBody: floatHarness.playerBody,
    });

    const normalHarness = createHarness();
    normalHarness.controller.state.grounded = false;
    normalHarness.controller.state.velocity.y = 8.4;
    normalHarness.controller.state.doubleJumpActive = false;
    normalHarness.controller.update({
      dt,
      mobileSnapshot: zeroMobile(),
      physics: normalHarness.physics,
      playerBody: normalHarness.playerBody,
    });

    expect(floatHarness.controller.state.velocity.y).toBeGreaterThan(
      normalHarness.controller.state.velocity.y,
    );
  });
});
