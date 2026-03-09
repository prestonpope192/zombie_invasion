import * as THREE from "three";

const JUMP_SPEED_MPS = 6.2;
const DOUBLE_JUMP_SPEED_MPS = 8.4;
const GRAVITY_MPS2 = 14.6;
const MAX_FALL_SPEED_MPS = 14;
const FALL_SNAP_SPEED_MPS = 4.8;
const KEYBOARD_LOOK_SPEED = 2.2;
const DOUBLE_JUMP_FLOAT_WINDOW_SEC = 0.36;
const DOUBLE_JUMP_ASCENT_GRAVITY_SCALE = 0.48;
const JUMP_STAMINA_COST = 12;
const DOUBLE_JUMP_STAMINA_COST = 16;

function key(code) {
  return code.toLowerCase();
}

export class PlayerControllerFps {
  constructor({ camera, canvas, sensitivity = 0.18 }) {
    this.camera = camera;
    this.canvas = canvas;
    this.sensitivity = sensitivity;
    this.keyState = new Map();
    this.pointerLocked = false;
    this.fireBufferedFrames = 0;

    this.state = {
      position: new THREE.Vector3(0, 1.7, 12),
      velocity: new THREE.Vector3(0, 0, 0),
      yaw: 0,
      pitch: 0,
      hp: 100,
      stamina: 100,
      grounded: false,
      crouching: false,
      fire: false,
      ads: false,
      reload: false,
      interact: false,
      grenade: false,
      jumpQueued: false,
      sprint: false,
      jumpHeldLast: false,
      jumpActive: false,
      canDoubleJump: false,
      doubleJumpActive: false,
      doubleJumpFloatTimer: 0,
    };

    this.bindEvents();
  }

  bindEvents() {
    window.addEventListener("keydown", (event) => {
      this.keyState.set(key(event.code), true);
      if (event.code === "KeyF") {
        this.fireBufferedFrames = Math.max(this.fireBufferedFrames, 8);
      }
    });
    window.addEventListener("keyup", (event) => this.keyState.set(key(event.code), false));

    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    });

    this.canvas.addEventListener("click", () => {
      if (!window.matchMedia("(pointer: coarse)").matches) {
        if (navigator.webdriver) {
          return;
        }
        if (!this.canvas.isConnected || typeof this.canvas.requestPointerLock !== "function") {
          return;
        }
        try {
          const maybePromise = this.canvas.requestPointerLock();
          if (maybePromise && typeof maybePromise.catch === "function") {
            maybePromise.catch(() => {});
          }
        } catch {
          // Pointer lock may be unavailable in automated/headless contexts.
        }
      }
    });

    window.addEventListener("mousedown", (event) => {
      if (event.button === 0) {
        this.keyState.set("mouse0", true);
        this.fireBufferedFrames = Math.max(this.fireBufferedFrames, 8);
      }
      if (event.button === 2) {
        this.keyState.set("mouse1", true);
      }
    });
    window.addEventListener("mouseup", (event) => {
      if (event.button === 0) {
        this.keyState.set("mouse0", false);
      }
      if (event.button === 2) {
        this.keyState.set("mouse1", false);
      }
    });

    window.addEventListener("mousemove", (event) => {
      if (!this.pointerLocked) {
        return;
      }
      const lookSpeed = this.sensitivity * 0.0027;
      this.state.yaw -= event.movementX * lookSpeed;
      this.state.pitch -= event.movementY * lookSpeed;
      this.state.pitch = THREE.MathUtils.clamp(this.state.pitch, -1.2, 1.2);
    });
  }

  setSensitivity(value) {
    this.sensitivity = value;
  }

  snapshotDesktopInput() {
    const down = (code) => this.keyState.get(key(code)) === true;
    const fireBuffered = this.fireBufferedFrames > 0;
    if (this.fireBufferedFrames > 0) {
      this.fireBufferedFrames -= 1;
    }
    return {
      moveX: (down("KeyD") || down("ArrowRight") ? 1 : 0) - (down("KeyA") || down("ArrowLeft") ? 1 : 0),
      moveY: (down("KeyW") || down("ArrowUp") ? 1 : 0) - (down("KeyS") || down("ArrowDown") ? 1 : 0),
      lookX: (down("KeyL") ? 1 : 0) - (down("KeyJ") ? 1 : 0),
      lookY: (down("KeyI") || down("PageUp") ? 1 : 0) - (down("KeyK") || down("PageDown") ? 1 : 0),
      fire: down("Mouse0") || this.keyState.get("mouse0") === true || down("KeyF") || fireBuffered,
      ads: this.keyState.get("mouse1") === true || down("ShiftRight"),
      jump: down("Space"),
      crouch: down("ControlLeft") || down("KeyC"),
      sprint: down("ShiftLeft"),
      reload: down("KeyR"),
      interact: down("KeyE"),
      grenade: down("KeyG"),
    };
  }

  updateLookFromMobile(mobile) {
    const lookSpeed = 0.029;
    this.state.yaw -= mobile.lookX * lookSpeed;
    this.state.pitch -= mobile.lookY * lookSpeed;
    this.state.pitch = THREE.MathUtils.clamp(this.state.pitch, -1.2, 1.2);
  }

  updateLookFromKeyboard(desktop, dt) {
    if (Math.abs(desktop.lookX) < 0.001 && Math.abs(desktop.lookY) < 0.001) {
      return;
    }
    this.state.yaw -= desktop.lookX * KEYBOARD_LOOK_SPEED * dt;
    this.state.pitch += desktop.lookY * KEYBOARD_LOOK_SPEED * dt;
    this.state.pitch = THREE.MathUtils.clamp(this.state.pitch, -1.2, 1.2);
  }

  computeMovementVector(input) {
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const move = new THREE.Vector3();
    move.addScaledVector(forward, input.moveY);
    move.addScaledVector(right, input.moveX);
    if (move.lengthSq() > 1) {
      move.normalize();
    }
    return move;
  }

  update({ dt, mobileSnapshot, physics, playerBody }) {
    const desktop = this.snapshotDesktopInput();
    const mobile = mobileSnapshot || {
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

    if (window.matchMedia("(pointer: coarse)").matches) {
      this.updateLookFromMobile(mobile);
    }
    this.updateLookFromKeyboard(desktop, dt);

    const combined = {
      moveX: Math.abs(mobile.moveX) > 0.05 ? mobile.moveX : desktop.moveX,
      // Mobile stick Y is screen-space (+down), invert so up = forward.
      moveY: Math.abs(mobile.moveY) > 0.05 ? -mobile.moveY : desktop.moveY,
      fire: mobile.fire || desktop.fire,
      ads: mobile.ads || desktop.ads,
      jump: mobile.jump || desktop.jump,
      crouch: mobile.crouch || desktop.crouch,
      sprint: mobile.sprint || desktop.sprint,
      reload: mobile.reload || desktop.reload,
      interact: mobile.interact || desktop.interact,
      grenade: mobile.grenade || desktop.grenade,
    };

    const moveDirection = this.computeMovementVector(combined);
    const sprintAllowed = combined.sprint && this.state.stamina > 10 && !combined.crouch;
    const targetSpeed = combined.crouch ? 2.2 : sprintAllowed ? 6 : 4.2;

    this.state.crouching = combined.crouch;
    this.state.fire = combined.fire;
    this.state.ads = combined.ads;
    this.state.reload = combined.reload;
    this.state.interact = combined.interact;
    this.state.grenade = combined.grenade;
    this.state.sprint = sprintAllowed;

    if (sprintAllowed) {
      this.state.stamina = Math.max(0, this.state.stamina - dt * 12);
    } else {
      this.state.stamina = Math.min(100, this.state.stamina + dt * 8);
    }

    const desiredHorizontal = moveDirection.multiplyScalar(targetSpeed * dt);
    const useDoubleJumpFloat =
      this.state.doubleJumpActive &&
      this.state.velocity.y > 0 &&
      this.state.doubleJumpFloatTimer < DOUBLE_JUMP_FLOAT_WINDOW_SEC;
    const gravityScale = useDoubleJumpFloat ? DOUBLE_JUMP_ASCENT_GRAVITY_SCALE : 1;
    this.state.velocity.y -= GRAVITY_MPS2 * gravityScale * dt;
    if (this.state.doubleJumpActive) {
      this.state.doubleJumpFloatTimer += dt;
    }
    this.state.velocity.y = Math.max(-MAX_FALL_SPEED_MPS, this.state.velocity.y);

    const jumpPressed = combined.jump && !this.state.jumpHeldLast;
    this.state.jumpHeldLast = combined.jump;

    if (this.state.grounded && jumpPressed) {
      this.state.stamina = Math.max(0, this.state.stamina - JUMP_STAMINA_COST);
      this.state.velocity.y = JUMP_SPEED_MPS;
      this.state.grounded = false;
      this.state.jumpActive = true;
      this.state.canDoubleJump = true;
      this.state.doubleJumpActive = false;
      this.state.doubleJumpFloatTimer = 0;
    } else if (!this.state.grounded && this.state.canDoubleJump && jumpPressed) {
      this.state.stamina = Math.max(0, this.state.stamina - DOUBLE_JUMP_STAMINA_COST);
      this.state.velocity.y = DOUBLE_JUMP_SPEED_MPS;
      this.state.jumpActive = true;
      this.state.canDoubleJump = false;
      this.state.doubleJumpActive = true;
      this.state.doubleJumpFloatTimer = 0;
    }

    // Keep descent predictable while avoiding a sudden fast drop right after apex.
    if (this.state.jumpActive && this.state.velocity.y < 0 && this.state.velocity.y > -FALL_SNAP_SPEED_MPS) {
      this.state.velocity.y = -FALL_SNAP_SPEED_MPS;
    }

    const desiredTranslation = {
      x: desiredHorizontal.x,
      y: this.state.velocity.y * dt,
      z: desiredHorizontal.z,
    };

    const moveResult = physics.moveCharacter(playerBody, desiredTranslation);
    const correction = moveResult.correction;
    this.state.grounded = Boolean(moveResult.grounded);
    if (this.state.grounded && this.state.velocity.y < 0) {
      this.state.velocity.y = 0;
      this.state.jumpActive = false;
      this.state.canDoubleJump = false;
      this.state.doubleJumpActive = false;
      this.state.doubleJumpFloatTimer = 0;
    }

    const bodyPos = playerBody.body.translation();
    const eyeHeight = this.state.crouching ? 1.3 : 1.62;
    this.state.position.set(bodyPos.x, bodyPos.y + eyeHeight, bodyPos.z);

    this.camera.position.copy(this.state.position);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.state.yaw;
    this.camera.rotation.x = this.state.pitch;

    return combined;
  }
}
