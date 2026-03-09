const TAP_KEYS = new Set(["interact", "swap", "pause"]);

class MobileControls {
  constructor() {
    this.state = {
      moveX: 0,
      moveY: 0,
      jump: false,
      fire: false,
      secondary: false,
      crouch: false,
    };
    this.edges = {
      interact: false,
      swap: false,
      pause: false,
    };

    this.root = document.createElement("div");
    this.root.className = "mobile-controls";

    this.stickZone = document.createElement("div");
    this.stickZone.className = "mobile-stick-zone";
    this.stickKnob = document.createElement("div");
    this.stickKnob.className = "mobile-stick-knob";
    this.stickZone.appendChild(this.stickKnob);
    this.root.appendChild(this.stickZone);

    this.actions = document.createElement("div");
    this.actions.className = "mobile-actions";
    this.root.appendChild(this.actions);

    this.buttons = new Map();
    this.buildButton("JMP", "jump");
    this.buildButton("FIRE", "fire");
    this.buildButton("ALT", "secondary");
    this.buildButton("SWAP", "swap");
    this.buildButton("USE", "interact");
    this.buildButton("PAUSE", "pause");

    document.body.appendChild(this.root);
    this.attachStickEvents();
  }

  buildButton(label, key) {
    const button = document.createElement("button");
    button.className = "mobile-button";
    button.type = "button";
    button.textContent = label;
    button.dataset.key = key;
    this.actions.appendChild(button);
    this.buttons.set(key, button);

    const activate = () => {
      button.classList.add("active");
      if (TAP_KEYS.has(key)) {
        this.edges[key] = true;
      } else {
        this.state[key] = true;
      }
    };

    const deactivate = () => {
      button.classList.remove("active");
      if (!TAP_KEYS.has(key)) {
        this.state[key] = false;
      }
    };

    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      activate();
      button.setPointerCapture(event.pointerId);
    });
    button.addEventListener("pointerup", deactivate);
    button.addEventListener("pointercancel", deactivate);
    button.addEventListener("pointerleave", deactivate);
  }

  attachStickEvents() {
    const radius = 48;
    let activeId = null;
    const center = () => {
      const rect = this.stickZone.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    };

    const setVector = (x, y) => {
      const mag = Math.hypot(x, y);
      if (mag < 4) {
        this.state.moveX = 0;
        this.state.moveY = 0;
        this.stickKnob.style.transform = "translate(-50%, -50%)";
        return;
      }
      const clampedMag = Math.min(radius, mag);
      const nx = (x / mag) * clampedMag;
      const ny = (y / mag) * clampedMag;
      this.state.moveX = nx / radius;
      this.state.moveY = ny / radius;
      this.stickKnob.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
    };

    const onDown = (event) => {
      event.preventDefault();
      activeId = event.pointerId;
      this.stickZone.setPointerCapture(event.pointerId);
      const c = center();
      setVector(event.clientX - c.x, event.clientY - c.y);
    };

    const onMove = (event) => {
      if (event.pointerId !== activeId) {
        return;
      }
      const c = center();
      setVector(event.clientX - c.x, event.clientY - c.y);
    };

    const onUp = (event) => {
      if (event.pointerId !== activeId) {
        return;
      }
      activeId = null;
      setVector(0, 0);
    };

    this.stickZone.addEventListener("pointerdown", onDown);
    this.stickZone.addEventListener("pointermove", onMove);
    this.stickZone.addEventListener("pointerup", onUp);
    this.stickZone.addEventListener("pointercancel", onUp);
  }

  consume(key) {
    if (!this.edges[key]) {
      return false;
    }
    this.edges[key] = false;
    return true;
  }

  snapshot() {
    return {
      ...this.state,
      moveX: Math.max(-1, Math.min(1, this.state.moveX)),
      moveY: Math.max(-1, Math.min(1, this.state.moveY)),
    };
  }

  hide() {
    this.root.style.display = "none";
  }

  show() {
    this.root.style.display = "block";
  }
}

let controls;

export function getMobileControls() {
  if (!controls) {
    controls = new MobileControls();
  }
  return controls;
}
