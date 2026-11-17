// The actors: factories for the warden, the five foe kinds, bolts, orbs and
// glowshards, and the per-kind behaviour that steers each foe. Bodies are
// plain objects in the world's arrays; this file never reaches back into the
// world except through the host it is handed (spawn requests and the player).

import { FOES, PLAYER } from './config.js';
import { range } from './random.js';

export function createPlayer(x, y) {
  return {
    x, y, vx: 0, vy: 0,
    radius: PLAYER.radius,
    hp: PLAYER.maxHp,
    maxHp: PLAYER.maxHp,
    aim: 0,
    fireTimer: 0,
    dashTimer: 0,
    dashCooldownTimer: 0,
    dashDirX: 1,
    dashDirY: 0,
    hurtTimer: 0,
    stepPhase: 0,
  };
}

/** A foe of `kind` at a place, its hit points scaled for the wave it walks in. */
export function createFoe(kind, x, y, hpScale, random) {
  const base = FOES[kind];
  const hp = Math.round(base.hp * hpScale);
  return {
    kind, x, y,
    vx: 0, vy: 0,
    radius: base.radius,
    hp, maxHp: hp,
    speed: base.speed * range(random, 0.9, 1.1),
    damage: base.damage,
    score: base.score,
    xp: base.xp,
    knock: base.knock,
    flash: 0,
    attackTimer: 0,
    wobble: random() * Math.PI * 2,
    mode: 'stalk',
    modeTimer: range(random, 0.6, 1.2),
    fireTimer: range(random, 1.2, 2.4),
    burstTimer: 4.2,
    summonTimer: 6,
    telegraph: 0,
    dead: false,
  };
}

export function createBolt(x, y, angle, damage, pierce) {
  return {
    x, y,
    vx: Math.cos(angle) * 640,
    vy: Math.sin(angle) * 640,
    radius: 5,
    damage,
    pierce,
    life: 0.85,
    dead: false,
  };
}

export function createOrb(x, y, angle, speed, damage) {
  return {
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 7,
    damage,
    life: 4.5,
    dead: false,
  };
}

/** A glowshard: experience made visible, worth `value`, popped out of a foe. */
export function createShard(x, y, value, random) {
  const angle = random() * Math.PI * 2;
  const v = range(random, 30, 120);
  return {
    x, y,
    vx: Math.cos(angle) * v,
    vy: Math.sin(angle) * v,
    value,
    phase: random() * Math.PI * 2,
    magnet: false,
    dead: false,
  };
}

function seek(foe, tx, ty, speed, dt) {
  const dx = tx - foe.x;
  const dy = ty - foe.y;
  const dist = Math.hypot(dx, dy) || 1;
  foe.vx = (dx / dist) * speed;
  foe.vy = (dy / dist) * speed;
  foe.x += foe.vx * dt;
  foe.y += foe.vy * dt;
}

/**
 * Steer one foe for a step. `host` is the world: it offers the player and two
 * spawn requests (addOrb, addFoe). Contact and damage live in the world; this
 * is temper only.
 */
export function updateFoe(foe, host, dt, random) {
  const player = host.player;
  foe.flash = Math.max(0, foe.flash - dt);
  foe.attackTimer = Math.max(0, foe.attackTimer - dt);
  foe.telegraph = Math.max(0, foe.telegraph - dt);
  const dx = player.x - foe.x;
  const dy = player.y - foe.y;
  const dist = Math.hypot(dx, dy) || 1;

  switch (foe.kind) {
    case 'moth': {
      foe.wobble += dt * 6;
      const wob = Math.sin(foe.wobble) * 34;
      seek(foe, player.x - (dy / dist) * wob, player.y + (dx / dist) * wob, foe.speed, dt);
      break;
    }
    case 'darter': {
      foe.modeTimer -= dt;
      if (foe.mode === 'stalk') {
        seek(foe, player.x, player.y, foe.speed * 0.72, dt);
        if (foe.modeTimer <= 0 && dist < 340) {
          foe.mode = 'aim';
          foe.modeTimer = 0.24;
          foe.telegraph = 0.24;
        }
      } else if (foe.mode === 'aim') {
        foe.vx *= 0.8;
        foe.vy *= 0.8;
        foe.x += foe.vx * dt;
        foe.y += foe.vy * dt;
        if (foe.modeTimer <= 0) {
          foe.mode = 'lunge';
          foe.modeTimer = 0.32;
          foe.vx = (dx / dist) * foe.speed * 2.35;
          foe.vy = (dy / dist) * foe.speed * 2.35;
        }
      } else if (foe.mode === 'lunge') {
        foe.x += foe.vx * dt;
        foe.y += foe.vy * dt;
        if (foe.modeTimer <= 0) {
          foe.mode = 'rest';
          foe.modeTimer = 0.55;
        }
      } else {
        foe.vx *= 0.86;
        foe.vy *= 0.86;
        foe.x += foe.vx * dt;
        foe.y += foe.vy * dt;
        if (foe.modeTimer <= 0) {
          foe.mode = 'stalk';
          foe.modeTimer = range(random, 0.5, 1.1);
        }
      }
      break;
    }
    case 'spitter': {
      if (dist > 285) seek(foe, player.x, player.y, foe.speed, dt);
      else if (dist < 195) seek(foe, foe.x - dx, foe.y - dy, foe.speed * 0.8, dt);
      else {
        foe.wobble += dt * 1.4;
        const strafe = Math.sin(foe.wobble) > 0 ? 1 : -1;
        foe.x += (-dy / dist) * foe.speed * 0.4 * strafe * dt;
        foe.y += (dx / dist) * foe.speed * 0.4 * strafe * dt;
      }
      foe.fireTimer -= dt;
      if (foe.fireTimer <= 0 && dist < 430) {
        foe.fireTimer = 2.6;
        foe.telegraph = 0.3;
        host.addOrb(foe.x, foe.y, Math.atan2(dy, dx), 215, foe.damage);
      }
      break;
    }
    case 'brute': {
      seek(foe, player.x, player.y, foe.speed, dt);
      break;
    }
    case 'king': {
      const enraged = foe.hp < foe.maxHp * 0.3;
      if (foe.telegraph <= 0) seek(foe, player.x, player.y, foe.speed * (enraged ? 1.3 : 1), dt);
      foe.burstTimer -= dt;
      if (foe.burstTimer <= 0.55 && foe.telegraph <= 0 && foe.burstTimer > 0) foe.telegraph = 0.55;
      if (foe.burstTimer <= 0) {
        foe.burstTimer = enraged ? 3.4 : 4.4;
        const base = random() * Math.PI * 2;
        const count = enraged ? 18 : 14;
        for (let i = 0; i < count; i += 1) {
          host.addOrb(foe.x, foe.y, base + (i / count) * Math.PI * 2, 165, 12);
        }
        if (enraged) host.addOrb(foe.x, foe.y, Math.atan2(dy, dx), 250, 12);
        host.onKingBurst(foe);
      }
      foe.summonTimer -= dt;
      if (foe.summonTimer <= 0) {
        foe.summonTimer = 8.5;
        host.summonMoths(foe, 4);
      }
      break;
    }
    default:
      break;
  }
}
