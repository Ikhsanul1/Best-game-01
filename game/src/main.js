// Emberwake's shell: boot, the screen state machine (title, play, blessing
// choice, pause, the light going out, dawn), the fixed-step loop, and the
// wire between the world's events and the sound bank. The simulation itself
// lives in world.js; this file only conducts it.
//
// ?seed=N fixes the night's randomness. ?shot=title|play|boss|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.

import { BEST_KEY, FIELD, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_DASH, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_CHOICE, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WON } from './render.js';
import { applyBlessing, rollChoices } from './upgrades.js';
import { pilotControl, stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
const world = createWorld(random);
const renderer = createRenderer(canvas);
const audio = createAudio();

/** Fit the canvas to the largest 16:9 box in the window, in device pixels. */
function fitCanvas() {
  const box = canvas.parentElement.getBoundingClientRect();
  const scale = Math.min(box.width / FIELD.width, box.height / FIELD.height);
  const cssW = Math.floor(FIELD.width * scale);
  const cssH = Math.floor(FIELD.height * scale);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(canvas.width / FIELD.width, 0, 0, canvas.height / FIELD.height, 0, 0);
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

function toLogical(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * FIELD.width,
    y: ((clientY - rect.top) / rect.height) * FIELD.height,
  };
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  const view = {
    screen: scene.screen,
    best: 0,
    choices: [],
    hoverIndex: -1,
    muted: false,
    now: scene.now,
    pointer: { x: 900, y: 240, inside: false },
    isNewBest: false,
  };
  let painted = 0;
  function paint() {
    renderer.draw(world, view);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, toLogical);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let isNewBest = false;
  let choices = [];
  let accumulator = 0;
  let last = performance.now();
  let clock = 0;
  let lastShotSound = 0;
  let lastHitSound = 0;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    isNewBest = false;
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.click();
    announce('Playing. Wave 1. Keep the lantern lit.');
  }

  function finishGame() {
    const won = world.state.won;
    if (won) audio.victory();
    else audio.gameOver();
    screen = won ? SCREEN_WON : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      isNewBest = true;
      saveBest(best);
    }
    announce(won ? `Dawn breaks. Score ${world.state.score}.` : `The light goes out. Score ${world.state.score}. Best ${best}.`);
  }

  function openChoice() {
    choices = rollChoices(random, world.state.stacks);
    screen = SCREEN_CHOICE;
    announce(`Level ${world.state.level}. Choose a blessing: ${choices.map((c) => c.name).join(', ')}.`);
  }

  function pickChoice(index) {
    if (index < 0 || index >= choices.length) return;
    applyBlessing(world, choices[index]);
    world.state.pendingLevels -= 1;
    audio.click();
    if (world.state.pendingLevels > 0) choices = rollChoices(random, world.state.stacks);
    else screen = SCREEN_PLAY;
  }

  function drainEvents() {
    for (const event of world.events.splice(0)) {
      switch (event) {
        case 'shoot':
          if (clock - lastShotSound > 0.045) { audio.shoot(); lastShotSound = clock; }
          break;
        case 'hit':
          if (clock - lastHitSound > 0.05) { audio.hit(); lastHitSound = clock; }
          break;
        case 'die': audio.die(false); break;
        case 'bigdie': audio.die(true); break;
        case 'pickup': audio.pickup(world.state.pickupStreak); break;
        case 'hurt': audio.hurt(); announce(`Struck. ${Math.ceil(world.player.hp)} heart left.`); break;
        case 'dash': audio.dash(); break;
        case 'levelup': audio.levelUp(); break;
        case 'wave': audio.wave(); break;
        case 'king': audio.boss(); break;
        case 'burst': audio.die(true); break;
        case 'clear': audio.wave(); break;
        default: break;
      }
    }
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) audio.toggleMute();
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (screen === SCREEN_OVER || screen === SCREEN_WON) {
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (screen === SCREEN_CHOICE) {
      const pick = input.takeChoice();
      if (pick > 0) pickChoice(pick - 1);
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (screen === SCREEN_PAUSED && (actions & ACTION_CONFIRM)) screen = SCREEN_PLAY;
  }

  function handleClicks() {
    const click = input.takeClick();
    if (!click) return;
    audio.unlock();
    if (screen === SCREEN_CHOICE) {
      const index = renderer.buttons.cards.findIndex((r) => click.x >= r.x && click.x <= r.x + r.w && click.y >= r.y && click.y <= r.y + r.h);
      if (index >= 0) pickChoice(index);
      return;
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WON) startGame();
  }

  function hoverIndex() {
    if (screen !== SCREEN_CHOICE) return -1;
    const p = input.pointer;
    return renderer.buttons.cards.findIndex((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
  }

  function step(dash) {
    if (screen === SCREEN_TITLE) {
      // Attract: the warden drifts a calm first wave behind the title.
      world.step(STEP, pilotControl(world));
      world.events.length = 0;
      if (world.state.over || world.director.wave > 2) world.reset();
      return;
    }
    const control = {
      move: input.direction(),
      aim: { x: input.pointer.x, y: input.pointer.y },
      dash,
    };
    world.step(STEP, control);
    drainEvents();
    if (world.state.over) finishGame();
    else if (world.state.pendingLevels > 0) openChoice();
  }

  function frame(nowMs) {
    requestAnimationFrame(frame);
    const dtReal = Math.min((nowMs - last) / 1000, MAX_FRAME);
    last = nowMs;
    clock += dtReal;
    const actions = input.takeActions();
    handleActions(actions);
    handleClicks();
    if (screen === SCREEN_PLAY || screen === SCREEN_TITLE) {
      accumulator += dtReal;
      // The frame's dash edge is spent on the first simulated step.
      let dash = (actions & ACTION_DASH) !== 0 && screen === SCREEN_PLAY;
      while (accumulator >= STEP && (screen === SCREEN_PLAY || screen === SCREEN_TITLE)) {
        step(dash);
        dash = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    canvas.style.cursor = screen === SCREEN_PLAY ? 'none' : 'default';
    renderer.draw(world, {
      screen,
      best,
      choices,
      hoverIndex: hoverIndex(),
      muted: audio.muted,
      now: clock,
      pointer: input.pointer,
      isNewBest,
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // A small handle for scripted playtests: the world, the screen, a starter.
  window.__emberwake = { world, start: startGame, screen: () => screen };

  announce('Emberwake. Press Enter or click to take up the lantern.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
