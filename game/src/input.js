// Keyboard and mouse, read as one control object a frame. Arrows or WASD fly the plane,
// Shift boosts, Space or Enter confirms, P or Escape pauses, M mutes. The mouse steers too:
// hold the pointer where you want to go and the plane banks and climbs toward it.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const KEY_BANK_LEFT = new Set(['ArrowLeft', 'a', 'A']);
const KEY_BANK_RIGHT = new Set(['ArrowRight', 'd', 'D']);
const KEY_PITCH_UP = new Set(['ArrowUp', 'w', 'W']);
const KEY_PITCH_DOWN = new Set(['ArrowDown', 's', 'S']);
const KEY_BOOST = new Set(['Shift']);
const KEY_CONFIRM = new Set([' ', 'Enter']);
const KEY_PAUSE = new Set(['p', 'P', 'Escape']);
const KEY_MUTE = new Set(['m', 'M']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  // Pointer position in canvas fractions (0..1), and whether it is held down.
  const pointer = { x: 0.5, y: 0.5, active: false, held: false };

  function keyOf(event) {
    return event.key.length === 1 ? event.key : event.key;
  }

  function onKeyDown(event) {
    const key = keyOf(event);
    if (KEY_CONFIRM.has(key) || KEY_PAUSE.has(key) || KEY_MUTE.has(key) || KEY_BANK_LEFT.has(key) || KEY_BANK_RIGHT.has(key) || KEY_PITCH_UP.has(key) || KEY_PITCH_DOWN.has(key)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    keys.add(key);
    if (KEY_CONFIRM.has(key)) actions |= ACTION_CONFIRM;
    if (KEY_PAUSE.has(key)) actions |= ACTION_PAUSE;
    if (KEY_MUTE.has(key)) actions |= ACTION_MUTE;
  }

  function onKeyUp(event) {
    keys.delete(keyOf(event));
  }

  function trackPointer(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    pointer.y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
  }

  function onPointerDown(event) {
    trackPointer(event);
    pointer.held = true;
    pointer.active = true;
    actions |= ACTION_CONFIRM;
  }

  function onPointerMove(event) {
    trackPointer(event);
    pointer.active = true;
  }

  function onPointerUp() {
    pointer.held = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointerleave', () => { pointer.active = false; });

  function held(set) {
    for (const key of set) if (keys.has(key)) return true;
    return false;
  }

  /** The flying controls for this frame: bank and pitch in -1..1, and boost. Speed is an
   * auto-throttle toward cruise in the world (climbing bleeds it, diving gains it), so the
   * arrows stay free for flying and Shift is the only speed control a player needs. */
  function control() {
    let bank = 0;
    let pitch = 0;
    if (held(KEY_BANK_LEFT)) bank -= 1;
    if (held(KEY_BANK_RIGHT)) bank += 1;
    if (held(KEY_PITCH_UP)) pitch += 1;
    if (held(KEY_PITCH_DOWN)) pitch -= 1;
    // The mouse steers when it is held: bank toward its x, climb toward its y.
    if (pointer.held) {
      const wantX = (pointer.x - 0.5) * 2;
      const wantPitch = (0.5 - pointer.y) * 2;
      bank = Math.max(-1, Math.min(1, wantX * 1.6));
      pitch = Math.max(-1, Math.min(1, wantPitch * 1.6));
    }
    return { bank, pitch, throttle: 0, boost: held(KEY_BOOST), pointerX: pointer.x, pointerY: pointer.y, pointerHeld: pointer.held };
  }

  /** One-shot actions since the last call (confirm / pause / mute), then cleared. */
  function takeActions() {
    const taken = actions;
    actions = 0;
    return taken;
  }

  return { control, takeActions };
}
