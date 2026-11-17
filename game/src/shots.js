// The screenshot scenes behind ?shot=title|play|boss|end. Each stages the
// real game — a seeded world run forward under a simple autopilot — so the
// frame is what play actually looks like, and the same seed always deals the
// same frame. The autopilot kites packs, gathers shards and shoots the
// nearest shade; the play and boss scenes borrow a few blessings so they
// show a night already in progress.

import { ARENA, STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE, SCREEN_WON } from './render.js';
import { applyBlessing, BLESSINGS } from './upgrades.js';

function nearestFoe(world, x, y) {
  let best = null;
  let bestDist = Infinity;
  for (const foe of world.foes) {
    const d = Math.hypot(foe.x - x, foe.y - y);
    if (d < bestDist) {
      bestDist = d;
      best = foe;
    }
  }
  return best;
}

/** One step of autopilot control: flee crowds, gather shards, aim true. */
export function pilotControl(world) {
  const player = world.player;
  let mx = 0;
  let my = 0;
  for (const foe of world.foes) {
    const dx = player.x - foe.x;
    const dy = player.y - foe.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 180) {
      const weight = (180 - d) / 180 * (foe.kind === 'king' ? 1.6 : 1);
      mx += (dx / d) * weight;
      my += (dy / d) * weight;
    }
  }
  let shard = null;
  let shardDist = 340;
  for (const s of world.shards) {
    const d = Math.hypot(s.x - player.x, s.y - player.y);
    if (d < shardDist) {
      shardDist = d;
      shard = s;
    }
  }
  if (shard && Math.hypot(mx, my) < 0.7) {
    mx += (shard.x - player.x) / (shardDist || 1) * 0.8;
    my += (shard.y - player.y) / (shardDist || 1) * 0.8;
  }
  // Keep off the stones.
  const margin = 110;
  if (player.x < ARENA.left + margin) mx += 0.9;
  if (player.x > ARENA.right - margin) mx -= 0.9;
  if (player.y < ARENA.top + margin) my += 0.9;
  if (player.y > ARENA.bottom - margin) my -= 0.9;
  const len = Math.hypot(mx, my);
  const move = len > 0.15 ? { x: mx / len, y: my / len } : { x: 0, y: 0 };
  const target = nearestFoe(world, player.x, player.y);
  const aim = target ? { x: target.x, y: target.y } : { x: player.x + 120, y: player.y };
  const dash = target !== null && Math.hypot(target.x - player.x, target.y - player.y) < 62 && player.dashCooldownTimer <= 0;
  return { move, aim, dash };
}

function run(world, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, pilotControl(world));
    world.events.length = 0;
    if (world.state.over) break;
  }
}

function grant(world, ids) {
  for (const id of ids) {
    const blessing = BLESSINGS.find((b) => b.id === id);
    if (blessing) applyBlessing(world, blessing);
  }
}

/** Walk the director forward so the next wave it deals is `wave`. */
function advanceToWave(world, wave) {
  while (world.director.wave < wave - 1) {
    world.director.beginWave();
    world.director.queue.length = 0;
    world.director.events.length = 0;
    for (const foe of world.foes) foe.dead = true;
    world.foes = world.foes.filter((f) => !f.dead);
  }
  world.director.phase = 'breather';
  world.director.breatherTimer = 0.01;
}

/**
 * Stage the named scene in `world` and return the screen to draw and the
 * animation clock to draw it with.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    grant(world, ['sharper', 'twin', 'swift']);
    world.state.level = 4;
    advanceToWave(world, 4);
    run(world, 8);
    if (world.state.over) {
      world.reset();
      grant(world, ['sharper', 'twin', 'swift']);
      advanceToWave(world, 4);
      run(world, 5);
    }
    return { screen: SCREEN_PLAY, now: 4.2 };
  }
  if (name === 'boss') {
    grant(world, ['sharper', 'twin', 'quicker', 'piercing', 'wind']);
    world.state.level = 8;
    world.player.hp = 78;
    advanceToWave(world, 10);
    run(world, 9);
    const king = world.foes.find((f) => f.kind === 'king');
    if (king && !world.state.over) king.hp = Math.min(king.hp, Math.round(king.maxHp * 0.55));
    return { screen: SCREEN_PLAY, now: 6.9 };
  }
  if (name === 'end') {
    grant(world, ['sharper', 'twin', 'quicker', 'piercing', 'wind', 'vital']);
    world.state.level = 9;
    advanceToWave(world, 10);
    run(world, 9);
    const king = world.foes.find((f) => f.kind === 'king');
    if (king && !world.state.over) {
      king.hp = 1;
      world.killFoe(king);
      world.foes = world.foes.filter((f) => !f.dead);
      run(world, 0.6);
    }
    return { screen: SCREEN_WON, now: 8.4 };
  }
  // title: a calm attract drift — the warden wanders a quiet first wave.
  run(world, 6);
  return { screen: SCREEN_TITLE, now: 2.6 };
}
