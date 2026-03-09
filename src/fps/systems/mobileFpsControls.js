const BUTTONS = [
  { key: "fire", label: "FIRE", hold: true },
  { key: "grenade", label: "GRENADE", hold: false },
  { key: "map", label: "MAP", hold: false },
  { key: "ads", label: "ADS", hold: true },
  { key: "jump", label: "JUMP", hold: false },
  { key: "crouch", label: "CROUCH", hold: false, toggle: true },
  { key: "interact", label: "USE", hold: false },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function applyStickResponse(value, { deadzone, exponent, gain }) {
  const sign = Math.sign(value);
  const abs = Math.abs(value);
  if (abs <= deadzone) {
    return 0;
  }
  const normalized = (abs - deadzone) / (1 - deadzone);
  const curved = Math.pow(clamp(normalized, 0, 1), exponent) * gain;
  return clamp(curved, 0, 1) * sign;
}

export class MobileFpsControls {
  constructor() {
    this.enabled = window.matchMedia("(pointer: coarse)").matches;
    this.state = {
      moveX: 0,
      moveY: 0,
      lookX: 0,
      lookY: 0,
      fire: false,
      ads: false,
      crouch: false,
      jump: false,
      interact: false,
      grenade: false,
      map: false,
      swap: false,
      shop: false,
    };
    this.fireBufferedFrames = 0;

    if (!this.enabled) {
      return;
    }

    this.root = document.createElement("div");
    this.root.className = "fps-mobile-controls";

    this.leftStick = this.createStick("left");
    this.rightStick = this.createStick("right");

    this.root.appendChild(this.leftStick.zone);
    this.root.appendChild(this.rightStick.zone);

    this.buttonsRoot = document.createElement("div");
    this.buttonsRoot.className = "fps-mobile-buttons";
    this.root.appendChild(this.buttonsRoot);

    this.buttons = new Map();
    for (const button of BUTTONS) {
      this.buildButton(button);
    }

    // Context action: only show USE when there is something actionable nearby.
    this.setButtonVisible("interact", false);

    document.body.appendChild(this.root);
  }

  createStick(side) {
    const zone = document.createElement("div");
    zone.className = `fps-stick-zone ${side}`;
    const knob = document.createElement("div");
    knob.className = "fps-stick-knob";
    zone.appendChild(knob);

    const pointer = { id: null, x: 0, y: 0 };
    const radius = 56;
    const response =
      side === "left"
        ? { deadzone: 0.18, exponent: 1.35, gain: 0.88 }
        : { deadzone: 0.24, exponent: 1.75, gain: 0.62 };

    const center = () => {
      const rect = zone.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    };

    const setVector = (x, y) => {
      const mag = Math.hypot(x, y);
      if (mag < 4) {
        if (side === "left") {
          this.state.moveX = 0;
          this.state.moveY = 0;
        } else {
          this.state.lookX = 0;
          this.state.lookY = 0;
        }
        knob.style.transform = "translate(-50%, -50%)";
        return;
      }

      const m = Math.min(radius, mag);
      const nx = (x / mag) * m;
      const ny = (y / mag) * m;
      knob.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;

      if (side === "left") {
        this.state.moveX = applyStickResponse(clamp(nx / radius, -1, 1), response);
        this.state.moveY = applyStickResponse(clamp(ny / radius, -1, 1), response);
      } else {
        this.state.lookX = applyStickResponse(clamp(nx / radius, -1, 1), response);
        this.state.lookY = applyStickResponse(clamp(ny / radius, -1, 1), response);
      }
    };

    zone.addEventListener("pointerdown", (event) => {
      pointer.id = event.pointerId;
      zone.setPointerCapture(event.pointerId);
      const c = center();
      setVector(event.clientX - c.x, event.clientY - c.y);
    });

    zone.addEventListener("pointermove", (event) => {
      if (event.pointerId !== pointer.id) {
        return;
      }
      const c = center();
      setVector(event.clientX - c.x, event.clientY - c.y);
    });

    const onUp = (event) => {
      if (event.pointerId !== pointer.id) {
        return;
      }
      pointer.id = null;
      setVector(0, 0);
    };

    zone.addEventListener("pointerup", onUp);
    zone.addEventListener("pointercancel", onUp);

    return { zone, knob };
  }

  buildButton(config) {
    const button = document.createElement("button");
    button.className = `fps-mobile-button fps-mobile-button-${config.key}`;
    button.type = "button";
    button.dataset.key = config.key;
    button.setAttribute("aria-label", config.label);
    button.textContent = config.label;

    const setActive = (active) => {
      button.classList.toggle("active", active);
      if (
        config.key === "jump" ||
        config.key === "interact" ||
        config.key === "grenade" ||
        config.key === "map" ||
        config.key === "swap" ||
        config.key === "shop"
      ) {
        if (active) {
          this.state[config.key] = true;
        }
      } else {
        this.state[config.key] = active;
      }
    };

    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      if (config.toggle) {
        const next = !this.state[config.key];
        this.state[config.key] = next;
        button.classList.toggle("active", next);
        return;
      }
      if (config.key === "fire") {
        this.fireBufferedFrames = Math.max(this.fireBufferedFrames, 8);
      }
      setActive(true);
    });

    if (!config.toggle) {
      button.addEventListener("pointerup", () => setActive(false));
      button.addEventListener("pointercancel", () => setActive(false));
      button.addEventListener("pointerleave", () => setActive(false));
    }

    this.buttonsRoot.appendChild(button);
    this.buttons.set(config.key, button);
  }

  snapshot() {
    const fireBuffered = this.fireBufferedFrames > 0;
    if (this.fireBufferedFrames > 0) {
      this.fireBufferedFrames -= 1;
    }
    const payload = {
      ...this.state,
      fire: this.state.fire || fireBuffered,
    };

    this.state.jump = false;
    this.state.interact = false;
    this.state.grenade = false;
    this.state.map = false;
    this.state.swap = false;
    this.state.shop = false;

    return payload;
  }

  setButtonVisible(key, visible) {
    const button = this.buttons.get(key);
    if (!button) {
      return;
    }
    button.style.display = visible ? "inline-flex" : "none";
    if (!visible) {
      this.state[key] = false;
      button.classList.remove("active");
    }
  }

  show() {
    if (this.root) {
      this.root.style.display = "block";
    }
  }

  hide() {
    if (this.root) {
      this.root.style.display = "none";
    }
  }
}
