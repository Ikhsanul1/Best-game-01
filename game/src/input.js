// Keyboard and mouse, read as a state the simulation can poll: held movement
// keys, the pointer's place in logical field coordinates, and one-shot action
// edges (confirm, pause, dash, mute, choice picks) that fire once per press.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DASH = 4;
export const ACTION_MUTE = 8;

const MOVE_KEYS = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

export function createInput(canvas, toLogical) {
  const held = new Set();
  const pressed = new Set();
  let actions = 0;
  let choice = 0;
  const pointer = { x: 640, y: 300, down: false, inside: false };
  let clicked = null;

  function edge(code) {
    if (pressed.has(code)) return;
    pressed.add(code);
    if (code === 'Enter' || code === 'Space') actions |= ACTION_CONFIRM;
    if (code === 'Escape' || code === 'KeyP') actions |= ACTION_PAUSE;
    if (code === 'Space' || code === 'ShiftLeft' || code === 'ShiftRight') actions |= ACTION_DASH;
    if (code === 'KeyM') actions |= ACTION_MUTE;
    if (code === 'Digit1') choice = 1;
    if (code === 'Digit2') choice = 2;
    if (code === 'Digit3') choice = 3;
  }

  window.addEventListener('keydown', (event) => {
    if (MOVE_KEYS[event.code] || event.code === 'Space') event.preventDefault();
    held.add(event.code);
    edge(event.code);
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
    pressed.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
    pressed.clear();
    pointer.down = false;
  });

  function trackPointer(event) {
    const point = toLogical(event.clientX, event.clientY);
    pointer.x = point.x;
    pointer.y = point.y;
    pointer.inside = true;
  }
  canvas.addEventListener('pointermove', trackPointer);
  canvas.addEventListener('pointerdown', (event) => {
    trackPointer(event);
    pointer.down = true;
    clicked = { x: pointer.x, y: pointer.y };
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    pointer.down = false;
  });
  canvas.addEventListener('pointerleave', () => {
    pointer.inside = false;
  });

  return {
    /** The held movement direction as a unit vector (diagonals normalised). */
    direction() {
      let x = 0;
      let y = 0;
      for (const code of held) {
        const move = MOVE_KEYS[code];
        if (move === 'left') x -= 1;
        else if (move === 'right') x += 1;
        else if (move === 'up') y -= 1;
        else if (move === 'down') y += 1;
      }
      if (x !== 0 && y !== 0) {
        const inv = Math.SQRT1_2;
        return { x: x * inv, y: y * inv };
      }
      return { x, y };
    },
    /** True while a movement key is held (the attract pilot idles without it). */
    moving() {
      for (const code of held) if (MOVE_KEYS[code]) return true;
      return false;
    },
    pointer,
    /** The actions pressed since the last call; reading clears them. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The level-up card picked by number key since the last call, or 0. */
    takeChoice() {
      const taken = choice;
      choice = 0;
      return taken;
    },
    /** The last pointer press in logical coordinates, or null; reading clears it. */
    takeClick() {
      const taken = clicked;
      clicked = null;
      return taken;
    },
  };
}
