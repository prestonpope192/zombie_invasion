import Phaser from "phaser";

export function buildInputSnapshot({ keys, mobile, pointer, scene }) {
  const mobileState = mobile.snapshot();
  const left = keys.left.isDown || keys.a.isDown || mobileState.moveX < -0.25;
  const right = keys.right.isDown || keys.d.isDown || mobileState.moveX > 0.25;
  const jump = keys.space.isDown || keys.up.isDown || keys.w.isDown || mobileState.jump;
  const crouch = keys.down.isDown || keys.s.isDown || mobileState.crouch || mobileState.moveY > 0.35;
  const fire = pointer.leftButtonDown() || keys.j.isDown || mobileState.fire;
  const secondary = pointer.rightButtonDown() || keys.k.isDown || keys.b.isDown || mobileState.secondary;

  return {
    left,
    right,
    jump,
    crouch,
    fire,
    secondary,
    swapPressed: Phaser.Input.Keyboard.JustDown(keys.q) || mobile.consume("swap"),
    interactPressed:
      Phaser.Input.Keyboard.JustDown(keys.e) ||
      Phaser.Input.Keyboard.JustDown(keys.enter) ||
      mobile.consume("interact"),
    pausePressed: Phaser.Input.Keyboard.JustDown(keys.esc) || mobile.consume("pause"),
    fullscreenPressed: Phaser.Input.Keyboard.JustDown(keys.f),
    pointerWorldX: pointer.worldX + scene.cameras.main.scrollX,
    pointerWorldY: pointer.worldY + scene.cameras.main.scrollY,
  };
}

export function setupKeys(scene) {
  return {
    left: scene.input.keyboard.addKey("LEFT"),
    right: scene.input.keyboard.addKey("RIGHT"),
    up: scene.input.keyboard.addKey("UP"),
    down: scene.input.keyboard.addKey("DOWN"),
    a: scene.input.keyboard.addKey("A"),
    d: scene.input.keyboard.addKey("D"),
    w: scene.input.keyboard.addKey("W"),
    s: scene.input.keyboard.addKey("S"),
    q: scene.input.keyboard.addKey("Q"),
    e: scene.input.keyboard.addKey("E"),
    f: scene.input.keyboard.addKey("F"),
    j: scene.input.keyboard.addKey("J"),
    k: scene.input.keyboard.addKey("K"),
    b: scene.input.keyboard.addKey("B"),
    space: scene.input.keyboard.addKey("SPACE"),
    esc: scene.input.keyboard.addKey("ESC"),
    enter: scene.input.keyboard.addKey("ENTER"),
    one: scene.input.keyboard.addKey("ONE"),
    two: scene.input.keyboard.addKey("TWO"),
    three: scene.input.keyboard.addKey("THREE"),
    four: scene.input.keyboard.addKey("FOUR"),
    five: scene.input.keyboard.addKey("FIVE"),
    six: scene.input.keyboard.addKey("SIX"),
    seven: scene.input.keyboard.addKey("SEVEN"),
    eight: scene.input.keyboard.addKey("EIGHT"),
    nine: scene.input.keyboard.addKey("NINE"),
  };
}
