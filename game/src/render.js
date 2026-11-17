// The painter: everything the player sees, drawn on one canvas. Entity art is
// pre-rendered once into glow sprites (with a white flash twin for hit
// feedback), the backdrop is a seeded scatter of stones and petals inside a
// ring of standing stones, and the lantern light is a radial glow that
// follows the warden. Screens — title, blessing choice, pause, the light
// going out, dawn — are drawn over the world so the loop is always visible.

import { ARENA, FIELD, FINAL_WAVE, INK } from './config.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_CHOICE = 'choice';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WON = 'won';

const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = 'system-ui, "Segoe UI", sans-serif';

/** Draw `draw` onto a fresh canvas of `size`, centred. */
function makeSprite(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.translate(size / 2, size / 2);
  draw(ctx, size);
  return canvas;
}

/** A white silhouette of a sprite, for the flash a foe shows when struck. */
function flashTwin(sprite) {
  const canvas = document.createElement('canvas');
  canvas.width = sprite.width;
  canvas.height = sprite.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(sprite, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

function glowDot(ctx, radius, inner, outer) {
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.35, outer);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
}

function buildSprites() {
  const sprites = {};
  sprites.player = makeSprite(96, (ctx) => {
    glowDot(ctx, 46, 'rgba(255,190,90,0.55)', 'rgba(255,140,60,0.18)');
    // The hood: a soft cone of deep teal cloth.
    ctx.fillStyle = '#173f3a';
    ctx.beginPath();
    ctx.moveTo(0, -21);
    ctx.quadraticCurveTo(15, -6, 12, 13);
    ctx.quadraticCurveTo(0, 19, -12, 13);
    ctx.quadraticCurveTo(-15, -6, 0, -21);
    ctx.fill();
    // The ember face.
    const face = ctx.createRadialGradient(0, 1, 1, 0, 1, 12);
    face.addColorStop(0, '#fff3c4');
    face.addColorStop(0.6, '#ffb347');
    face.addColorStop(1, '#ff7847');
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.arc(0, 1, 10.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#40260d';
    ctx.beginPath();
    ctx.arc(-3.6, 0, 1.5, 0, Math.PI * 2);
    ctx.arc(3.6, 0, 1.5, 0, Math.PI * 2);
    ctx.fill();
  });
  sprites.moth = makeSprite(64, (ctx) => {
    glowDot(ctx, 30, 'rgba(87,230,201,0.30)', 'rgba(87,230,201,0.08)');
    ctx.fillStyle = 'rgba(87,230,201,0.85)';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * 10, -4, 11, 6.5, side * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(side * 8, 6, 8, 5, side * -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#0e4f43';
    ctx.beginPath();
    ctx.ellipse(0, 0, 5.5, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d9fff5';
    ctx.beginPath();
    ctx.arc(-2.4, -4, 1.6, 0, Math.PI * 2);
    ctx.arc(2.4, -4, 1.6, 0, Math.PI * 2);
    ctx.fill();
  });
  sprites.darter = makeSprite(56, (ctx) => {
    glowDot(ctx, 26, 'rgba(255,93,122,0.30)', 'rgba(255,93,122,0.08)');
    ctx.fillStyle = '#ff5d7a';
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.quadraticCurveTo(2, -8, -11, -6);
    ctx.quadraticCurveTo(-5, 0, -11, 6);
    ctx.quadraticCurveTo(2, 8, 14, 0);
    ctx.fill();
    ctx.fillStyle = '#7c1226';
    ctx.beginPath();
    ctx.arc(4, 0, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe3e9';
    ctx.beginPath();
    ctx.arc(5.4, 0, 1.4, 0, Math.PI * 2);
    ctx.fill();
  });
  sprites.spitter = makeSprite(68, (ctx) => {
    glowDot(ctx, 32, 'rgba(183,139,255,0.30)', 'rgba(183,139,255,0.08)');
    ctx.fillStyle = '#5b3a96';
    ctx.beginPath();
    ctx.arc(0, 0, 13.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b78bff';
    ctx.beginPath();
    ctx.arc(0, -2, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a1650';
    ctx.beginPath();
    ctx.arc(0, 2, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e9ddff';
    ctx.beginPath();
    ctx.arc(-5, -6, 1.7, 0, Math.PI * 2);
    ctx.arc(5, -6, 1.7, 0, Math.PI * 2);
    ctx.fill();
  });
  sprites.brute = makeSprite(120, (ctx) => {
    glowDot(ctx, 56, 'rgba(221,211,192,0.20)', 'rgba(221,211,192,0.05)');
    ctx.fillStyle = '#8d8271';
    ctx.beginPath();
    const spikes = 9;
    for (let i = 0; i < spikes; i += 1) {
      const angle = (i / spikes) * Math.PI * 2;
      const r = i % 2 === 0 ? 27 : 22;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ddd3c0';
    ctx.beginPath();
    ctx.arc(0, 0, 19, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,80,64,0.7)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-13, -8);
    ctx.lineTo(-3, 2);
    ctx.lineTo(-10, 11);
    ctx.moveTo(12, -11);
    ctx.lineTo(5, -1);
    ctx.lineTo(13, 7);
    ctx.stroke();
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.arc(-6.5, -3, 2.4, 0, Math.PI * 2);
    ctx.arc(6.5, -3, 2.4, 0, Math.PI * 2);
    ctx.fill();
  });
  sprites.king = makeSprite(220, (ctx) => {
    glowDot(ctx, 106, 'rgba(143,123,255,0.4)', 'rgba(90,60,200,0.10)');
    // Crown of spikes.
    ctx.fillStyle = '#241a4d';
    ctx.beginPath();
    for (let i = 0; i < 7; i += 1) {
      const angle = -Math.PI * 0.85 + (i / 6) * Math.PI * 0.7;
      const tip = 56;
      const base = 38;
      ctx.moveTo(Math.cos(angle - 0.11) * base, Math.sin(angle - 0.11) * base);
      ctx.lineTo(Math.cos(angle) * tip, Math.sin(angle) * tip);
      ctx.lineTo(Math.cos(angle + 0.11) * base, Math.sin(angle + 0.11) * base);
    }
    ctx.fill();
    // The shade's body: a torn cloak of deep violet.
    const body = ctx.createRadialGradient(0, -6, 6, 0, 0, 46);
    body.addColorStop(0, '#4b3485');
    body.addColorStop(0.7, '#2c1e5c');
    body.addColorStop(1, '#1a1138');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f0a26';
    ctx.beginPath();
    ctx.moveTo(-30, 30);
    ctx.lineTo(-18, 44);
    ctx.lineTo(-8, 31);
    ctx.lineTo(2, 46);
    ctx.lineTo(12, 32);
    ctx.lineTo(24, 45);
    ctx.lineTo(31, 29);
    ctx.quadraticCurveTo(0, 40, -30, 30);
    ctx.fill();
    // Hollow eyes.
    ctx.fillStyle = '#cfc2ff';
    ctx.beginPath();
    ctx.ellipse(-13, -6, 5.4, 7.6, 0.15, 0, Math.PI * 2);
    ctx.ellipse(13, -6, 5.4, 7.6, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8f7bff';
    ctx.beginPath();
    ctx.arc(-13, -6, 2.2, 0, Math.PI * 2);
    ctx.arc(13, -6, 2.2, 0, Math.PI * 2);
    ctx.fill();
  });
  sprites.shard = makeSprite(36, (ctx) => {
    glowDot(ctx, 17, 'rgba(141,245,210,0.5)', 'rgba(141,245,210,0.12)');
    ctx.fillStyle = '#8df5d2';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5.6, 0);
    ctx.lineTo(0, 8);
    ctx.lineTo(-5.6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#eafff7';
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(2.8, 0);
    ctx.lineTo(0, 4);
    ctx.lineTo(-2.8, 0);
    ctx.closePath();
    ctx.fill();
  });
  sprites.orb = makeSprite(44, (ctx) => {
    glowDot(ctx, 21, 'rgba(200,120,255,0.55)', 'rgba(150,60,255,0.15)');
    ctx.fillStyle = '#e7c8ff';
    ctx.beginPath();
    ctx.arc(0, 0, 5.4, 0, Math.PI * 2);
    ctx.fill();
  });
  for (const key of Object.keys(sprites)) sprites[key + 'Flash'] = flashTwin(sprites[key]);
  return sprites;
}

/** The seeded scatter of the clearing floor: stones, petals, grass tufts. */
function buildGround() {
  const random = createRandom(20261);
  const flecks = [];
  for (let i = 0; i < 210; i += 1) {
    flecks.push({
      x: ARENA.left + random() * (ARENA.right - ARENA.left),
      y: ARENA.top + random() * (ARENA.bottom - ARENA.top),
      r: 1 + random() * 2.6,
      kind: Math.floor(random() * 3),
      alpha: 0.05 + random() * 0.1,
    });
  }
  const fireflies = [];
  for (let i = 0; i < 22; i += 1) {
    fireflies.push({
      x: ARENA.left + random() * (ARENA.right - ARENA.left),
      y: ARENA.top + random() * (ARENA.bottom - ARENA.top),
      phase: random() * Math.PI * 2,
      drift: 0.2 + random() * 0.5,
    });
  }
  const posts = [];
  const stepX = (ARENA.right - ARENA.left) / 9;
  const stepY = (ARENA.bottom - ARENA.top) / 5;
  for (let i = 0; i <= 9; i += 1) {
    posts.push({ x: ARENA.left + i * stepX, y: ARENA.top - 8 });
    posts.push({ x: ARENA.left + i * stepX, y: ARENA.bottom + 8 });
  }
  for (let i = 1; i < 5; i += 1) {
    posts.push({ x: ARENA.left - 8, y: ARENA.top + i * stepY });
    posts.push({ x: ARENA.right + 8, y: ARENA.top + i * stepY });
  }
  return { flecks, fireflies, posts };
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line === '' ? word : `${line} ${word}`;
    if (ctx.measureText(test).width > maxWidth && line !== '') {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line !== '') ctx.fillText(line, x, yy);
  return yy;
}

function panel(ctx, x, y, w, h, alpha = 0.55) {
  ctx.fillStyle = `rgba(12,9,28,${alpha})`;
  ctx.strokeStyle = 'rgba(157,148,196,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.stroke();
}

function bar(ctx, x, y, w, h, frac, fill, back = 'rgba(255,255,255,0.13)') {
  ctx.fillStyle = back;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, Math.max(h, w * Math.min(1, frac)), h, h / 2);
    ctx.fill();
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const sprites = buildSprites();
  const ground = buildGround();
  const buttons = { primary: null, cards: [] };

  function drawSprite(name, x, y, size, rotation = 0, alpha = 1) {
    const sprite = sprites[name];
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    if (rotation !== 0) ctx.rotate(rotation);
    ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  function drawFoe(foe, now) {
    let size = foe.radius * 4.6;
    let rotation = 0;
    if (foe.kind === 'moth') {
      const flap = 1 + Math.sin(foe.wobble * 2.2) * 0.08;
      size *= flap;
    } else if (foe.kind === 'darter') {
      rotation = Math.atan2(foe.vy, foe.vx);
    } else if (foe.kind === 'king') {
      size = foe.radius * 4.8;
    }
    if (foe.telegraph > 0 && (foe.kind === 'darter' || foe.kind === 'king')) {
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(now * 40);
      ctx.fillStyle = '#ff5d7a';
      ctx.beginPath();
      ctx.arc(foe.x, foe.y, foe.radius + 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    drawSprite(foe.kind, foe.x, foe.y, size, rotation);
    if (foe.flash > 0) drawSprite(foe.kind + 'Flash', foe.x, foe.y, size, rotation, Math.min(1, foe.flash / 0.09) * 0.85);
    if ((foe.kind === 'brute' || foe.kind === 'spitter') && foe.hp < foe.maxHp) {
      bar(ctx, foe.x - 20, foe.y - foe.radius - 12, 40, 5, foe.hp / foe.maxHp, '#ffb347');
    }
  }

  function drawWorld(world, now, dim) {
    const state = world.state;
    // Night ground.
    const grad = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    grad.addColorStop(0, INK.nightTop);
    grad.addColorStop(1, INK.nightBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = INK.ground;
    ctx.beginPath();
    ctx.roundRect(ARENA.left - 14, ARENA.top - 14, ARENA.right - ARENA.left + 28, ARENA.bottom - ARENA.top + 28, 18);
    ctx.fill();
    for (const fleck of ground.flecks) {
      ctx.globalAlpha = fleck.alpha;
      ctx.fillStyle = fleck.kind === 0 ? '#8df5d2' : fleck.kind === 1 ? '#ff9db1' : '#cfc6f5';
      ctx.beginPath();
      ctx.arc(fleck.x, fleck.y, fleck.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Fireflies drift over the clearing.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const fly of ground.fireflies) {
      const fx = fly.x + Math.sin(now * fly.drift + fly.phase) * 16;
      const fy = fly.y + Math.cos(now * fly.drift * 0.8 + fly.phase) * 11;
      const pulse = 0.25 + 0.2 * Math.sin(now * 1.7 + fly.phase * 3);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(fx, fy, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(world.shakeX, world.shakeY);

    // The ring of standing stones, each with its little flame.
    for (const post of ground.posts) {
      ctx.fillStyle = INK.stone;
      ctx.beginPath();
      ctx.roundRect(post.x - 5, post.y - 9, 10, 18, 4);
      ctx.fill();
      ctx.fillStyle = INK.stoneLit;
      ctx.fillRect(post.x - 5, post.y - 9, 10, 3);
      const flick = 0.75 + 0.25 * Math.sin(now * 9 + post.x * 0.7 + post.y);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5 * flick;
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.arc(post.x, post.y - 13, 3.4 * flick + 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Fire-trail zones.
    for (const zone of world.trails) {
      const fade = zone.life / zone.maxLife;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.3 * fade;
      ctx.fillStyle = '#ff7847';
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Shards, orbs, foes, bolts, the warden.
    for (const shard of world.shards) {
      const bob = Math.sin(now * 3.4 + shard.phase) * 3;
      const size = shard.value >= 3 ? 34 : 27;
      drawSprite('shard', shard.x, shard.y + bob, size);
    }
    for (const foe of world.foes) drawFoe(foe, now);
    for (const orb of world.orbs) drawSprite('orb', orb.x, orb.y, 40);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const bolt of world.bolts) {
      const angle = Math.atan2(bolt.vy, bolt.vx);
      ctx.strokeStyle = '#ffb347';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(bolt.x - Math.cos(angle) * 13, bolt.y - Math.sin(angle) * 13);
      ctx.lineTo(bolt.x, bolt.y);
      ctx.stroke();
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.arc(bolt.x, bolt.y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // The lantern light, and the warden inside it.
    const player = world.player;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const light = ctx.createRadialGradient(player.x, player.y, 10, player.x, player.y, 300);
    light.addColorStop(0, 'rgba(255,170,80,0.20)');
    light.addColorStop(0.55, 'rgba(255,150,70,0.07)');
    light.addColorStop(1, 'rgba(255,150,70,0)');
    ctx.fillStyle = light;
    ctx.fillRect(player.x - 300, player.y - 300, 600, 600);
    ctx.restore();
    if (!state.over || state.won) {
      const hurt = player.hurtTimer > 0.2;
      drawSprite('player', player.x, player.y, 92);
      if (hurt) drawSprite('playerFlash', player.x, player.y, 92, 0, 0.5);
      // The lantern, held toward the aim.
      const lx = player.x + Math.cos(player.aim) * 17;
      const ly = player.y + Math.sin(player.aim) * 17;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(lx, ly, 3.6 + Math.sin(now * 11) * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    world.particles.draw(ctx);
    ctx.restore();

    if (dim > 0) {
      ctx.fillStyle = `rgba(8,6,20,${dim})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
  }

  function drawHud(world, view) {
    const state = world.state;
    const player = world.player;
    // Health and level, top-left.
    panel(ctx, 16, 14, 252, 62);
    ctx.textAlign = 'left';
    ctx.font = '700 13px ' + SANS;
    ctx.fillStyle = INK.blood;
    ctx.fillText('♥', 28, 39);
    bar(ctx, 48, 27, 168, 12, player.hp / player.maxHp, player.hp / player.maxHp > 0.3 ? '#ff7847' : '#ff4d5e');
    ctx.fillStyle = INK.cream;
    ctx.font = '700 13px ' + SANS;
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.ceil(player.hp)}`, 262, 39);
    ctx.textAlign = 'left';
    ctx.fillStyle = INK.shard;
    ctx.font = '700 12px ' + SANS;
    ctx.fillText(`LV ${state.level}`, 28, 63);
    bar(ctx, 76, 54, 140, 9, state.xp / state.xpNext, '#8df5d2');
    ctx.fillStyle = INK.dim;
    ctx.font = '11px ' + SANS;
    ctx.fillText(`${state.xp}/${state.xpNext}`, 222, 63);

    // Wave and the night left, top-centre.
    panel(ctx, 506, 14, 268, 58);
    ctx.textAlign = 'center';
    ctx.fillStyle = INK.cream;
    ctx.font = '700 17px ' + SERIF;
    const waveLabel = state.wave === 0 ? 'DUSK FALLS' : state.wave >= FINAL_WAVE ? 'THE HOLLOW KING' : `WAVE ${state.wave} / ${FINAL_WAVE}`;
    ctx.fillText(waveLabel, 640, 40);
    if (state.wave > 0 && !state.over) {
      ctx.fillStyle = INK.dim;
      ctx.font = '11px ' + SANS;
      const left = world.director.remaining(world.foes.length);
      ctx.fillText(left > 0 ? `${left} shades remain` : 'the wave is held', 640, 61);
    }

    // Score, top-right.
    panel(ctx, 1012, 14, 252, 62);
    ctx.textAlign = 'right';
    ctx.fillStyle = INK.amber;
    ctx.font = '700 21px ' + SANS;
    ctx.fillText(String(state.score).padStart(6, '0'), 1252, 42);
    ctx.fillStyle = INK.dim;
    ctx.font = '11px ' + SANS;
    ctx.fillText(`BEST ${Math.max(view.best, state.score)}`, 1252, 63);
    if (state.combo >= 3) {
      ctx.fillStyle = '#8df5d2';
      ctx.font = '700 14px ' + SANS;
      ctx.fillText(`COMBO ×${state.combo}`, 1252, 100);
      bar(ctx, 1132, 108, 120, 5, state.comboTimer / 2.5, '#8df5d2');
    }

    // Dash, bottom-left; hints, bottom-right.
    panel(ctx, 16, FIELD.height - 52, 168, 38);
    ctx.textAlign = 'left';
    ctx.fillStyle = player.dashCooldownTimer <= 0 ? INK.amber : INK.dim;
    ctx.font = '700 12px ' + SANS;
    ctx.fillText('DASH [SPACE]', 28, FIELD.height - 28);
    bar(ctx, 118, FIELD.height - 38, 54, 8, 1 - player.dashCooldownTimer / Math.max(0.01, world.stats.dashCooldown), '#ffb347');
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(157,148,196,0.8)';
    ctx.font = '11px ' + SANS;
    ctx.fillText(view.muted ? 'M — sound off' : 'M — sound on · P — pause', 1264, FIELD.height - 24);

    // The King's bar, bottom-centre.
    const king = world.foes.find((f) => f.kind === 'king');
    if (king) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#cfc2ff';
      ctx.font = '700 13px ' + SERIF;
      ctx.fillText('T H E   H O L L O W   K I N G', 640, FIELD.height - 66);
      bar(ctx, 440, FIELD.height - 58, 400, 11, king.hp / king.maxHp, '#8f7bff');
    }

    // The wave banner.
    if (state.bannerTimer > 0 && view.screen === SCREEN_PLAY) {
      const fade = Math.min(1, state.bannerTimer / 0.5, (2.2 - state.bannerTimer) / 0.4 + 0.4);
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, fade));
      ctx.textAlign = 'center';
      ctx.font = '700 44px ' + SERIF;
      ctx.fillStyle = INK.cream;
      ctx.shadowColor = 'rgba(255,179,71,0.8)';
      ctx.shadowBlur = 24;
      ctx.fillText(state.bannerText, 640, 168);
      ctx.restore();
    }

    // Low heart: the edges close in.
    if (player.hp / player.maxHp < 0.3 && !state.over) {
      const pulse = 0.16 + 0.1 * Math.sin(view.now * 5);
      const vig = ctx.createRadialGradient(640, 360, 300, 640, 360, 720);
      vig.addColorStop(0, 'rgba(255,40,60,0)');
      vig.addColorStop(1, `rgba(255,40,60,${pulse})`);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    // Hurt flash.
    if (player.hurtTimer > 0.22) {
      ctx.fillStyle = `rgba(255,60,80,${(player.hurtTimer - 0.22) * 0.9})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
  }

  function drawTitle(world, view) {
    ctx.textAlign = 'center';
    const flicker = 0.9 + 0.1 * Math.sin(view.now * 7);
    ctx.save();
    ctx.shadowColor = 'rgba(255,160,60,0.9)';
    ctx.shadowBlur = 34 * flicker;
    ctx.fillStyle = INK.amber;
    ctx.font = '700 92px ' + SERIF;
    ctx.fillText('EMBERWAKE', 640, 218);
    ctx.restore();
    ctx.fillStyle = INK.cream;
    ctx.font = 'italic 21px ' + SERIF;
    ctx.fillText('a lantern-warden survival', 640, 256);
    ctx.fillStyle = INK.dim;
    ctx.font = '15px ' + SANS;
    ctx.fillText('Night is falling on the Emberwood, and every shade in it wants your light.', 640, 308);
    ctx.fillText('Hold the clearing for ten waves. When the Hollow King comes, put him down — and dawn breaks.', 640, 332);

    panel(ctx, 390, 372, 500, 118, 0.62);
    ctx.fillStyle = INK.cream;
    ctx.font = '14px ' + SANS;
    ctx.textAlign = 'left';
    const lines = [
      ['W A S D / arrows', 'move through the dark'],
      ['Mouse', 'aim — your bolts stream to the cursor'],
      ['Space / Shift', 'dash — nothing can touch you mid-dash'],
      ['1 · 2 · 3', 'choose a blessing when you level up'],
    ];
    lines.forEach(([keys, what], i) => {
      ctx.fillStyle = INK.amber;
      ctx.font = '700 14px ' + SANS;
      ctx.fillText(keys, 420, 404 + i * 24);
      ctx.fillStyle = INK.cream;
      ctx.font = '14px ' + SANS;
      ctx.fillText(what, 580, 404 + i * 24);
    });

    const pulse = 0.72 + 0.28 * Math.sin(view.now * 3.4);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = INK.emberCore;
    ctx.font = '700 23px ' + SERIF;
    ctx.textAlign = 'center';
    ctx.fillText('Click, or press Enter, to take up the lantern', 640, 556);
    ctx.restore();
    if (view.best > 0) {
      ctx.fillStyle = INK.dim;
      ctx.font = '14px ' + SANS;
      ctx.fillText(`Best night so far: ${view.best}`, 640, 596);
    }
    buttons.primary = { x: 340, y: 150, w: 600, h: 430 };
  }

  function drawChoice(world, view) {
    ctx.fillStyle = 'rgba(8,6,20,0.62)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = INK.shard;
    ctx.font = '700 34px ' + SERIF;
    ctx.fillText('The lantern flares', 640, 168);
    ctx.fillStyle = INK.cream;
    ctx.font = '16px ' + SANS;
    ctx.fillText(`Level ${world.state.level} — choose a blessing`, 640, 200);
    buttons.cards = [];
    const cardW = 308;
    const cardH = 218;
    const gap = 26;
    const startX = 640 - (cardW * 3 + gap * 2) / 2;
    const y = 258;
    view.choices.forEach((choice, i) => {
      const x = startX + i * (cardW + gap);
      const hovered = view.hoverIndex === i;
      ctx.fillStyle = hovered ? 'rgba(46,36,86,0.95)' : 'rgba(22,17,46,0.95)';
      ctx.strokeStyle = hovered ? INK.amber : 'rgba(157,148,196,0.5)';
      ctx.lineWidth = hovered ? 2.4 : 1.2;
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, 14);
      ctx.fill();
      ctx.stroke();
      buttons.cards.push({ x, y, w: cardW, h: cardH });
      ctx.fillStyle = INK.amber;
      ctx.font = '700 15px ' + SANS;
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}`, x + 18, y + 32);
      const stacks = world.state.stacks[choice.id] ?? 0;
      if (stacks > 0 || choice.max !== Infinity) {
        ctx.textAlign = 'right';
        ctx.fillStyle = INK.teal;
        ctx.font = '13px ' + SANS;
        ctx.fillText('◆'.repeat(stacks) + '◇'.repeat(Math.max(0, Math.min(5, choice.max) - stacks)), x + cardW - 18, y + 32);
      }
      ctx.textAlign = 'center';
      ctx.fillStyle = INK.cream;
      ctx.font = '700 23px ' + SERIF;
      ctx.fillText(choice.name, x + cardW / 2, y + 82);
      ctx.fillStyle = INK.dim;
      ctx.font = '15px ' + SANS;
      wrapText(ctx, choice.blurb, x + cardW / 2, y + 122, cardW - 44, 21);
      ctx.fillStyle = 'rgba(157,148,196,0.75)';
      ctx.font = '12px ' + SANS;
      ctx.fillText(`press ${i + 1} or click`, x + cardW / 2, y + cardH - 18);
    });
  }

  function drawEnd(world, view, won) {
    const state = world.state;
    if (won) {
      const grad = ctx.createLinearGradient(0, 0, 0, FIELD.height);
      grad.addColorStop(0, 'rgba(58,43,87,0.55)');
      grad.addColorStop(1, 'rgba(201,111,63,0.5)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    } else {
      ctx.fillStyle = 'rgba(10,4,14,0.66)';
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    ctx.textAlign = 'center';
    ctx.save();
    ctx.shadowColor = won ? 'rgba(255,190,90,0.9)' : 'rgba(255,60,80,0.6)';
    ctx.shadowBlur = 28;
    ctx.fillStyle = won ? INK.amber : '#ff8091';
    ctx.font = '700 64px ' + SERIF;
    ctx.fillText(won ? 'DAWN BREAKS' : 'THE LIGHT GOES OUT', 640, 196);
    ctx.restore();
    ctx.fillStyle = INK.cream;
    ctx.font = 'italic 18px ' + SERIF;
    ctx.fillText(won ? 'The Hollow King is cinders, and the wood wakes up singing.' : 'The shades close over the clearing — but a lantern can always be lit again.', 640, 234);

    const rows = [
      ['Score', state.score],
      ['Best', Math.max(view.best, state.score)],
      ['Wave reached', `${Math.max(1, state.wave)} of ${FINAL_WAVE}`],
      ['Shades felled', state.kills],
      ['Level', state.level],
      ['Peak combo', `×${state.comboPeak}`],
      ['Time in the dark', `${Math.floor(state.time / 60)}:${String(Math.floor(state.time % 60)).padStart(2, '0')}`],
    ];
    panel(ctx, 465, 272, 350, rows.length * 31 + 26, 0.62);
    rows.forEach(([label, value], i) => {
      const y = 272 + 36 + i * 31;
      ctx.textAlign = 'left';
      ctx.fillStyle = INK.dim;
      ctx.font = '14px ' + SANS;
      ctx.fillText(label, 492, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = INK.cream;
      ctx.font = '700 15px ' + SANS;
      ctx.fillText(String(value), 788, y);
    });
    if (view.isNewBest && state.score > 0) {
      ctx.fillStyle = INK.shard;
      ctx.font = '700 16px ' + SANS;
      ctx.textAlign = 'center';
      ctx.fillText('— a new best night —', 640, 272 + rows.length * 31 + 52);
    }
    const by = 556;
    ctx.fillStyle = 'rgba(255,179,71,0.16)';
    ctx.strokeStyle = INK.amber;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(520, by, 240, 54, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK.emberCore;
    ctx.font = '700 20px ' + SERIF;
    ctx.textAlign = 'center';
    ctx.fillText(won ? 'WELCOME THE DAWN' : 'LIGHT IT AGAIN', 640, by + 35);
    ctx.fillStyle = INK.dim;
    ctx.font = '13px ' + SANS;
    ctx.fillText('or press Enter', 640, by + 82);
    buttons.primary = { x: 520, y: by, w: 240, h: 54 };
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(8,6,20,0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = INK.cream;
    ctx.font = '700 46px ' + SERIF;
    ctx.fillText('THE LANTERN RESTS', 640, 330);
    ctx.fillStyle = INK.dim;
    ctx.font = '16px ' + SANS;
    ctx.fillText('Press P, Esc or Enter to keep walking the dark', 640, 372);
  }

  function drawCursor(view) {
    if (!view.pointer.inside || view.screen !== SCREEN_PLAY) return;
    const { x, y } = view.pointer;
    ctx.strokeStyle = 'rgba(255,227,168,0.9)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(x, y, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  return {
    buttons,
    /**
     * Paint one frame. `view` carries the screen, the pointer, the dealt
     * blessing choices, the best score and the clock the animations run on.
     */
    draw(world, view) {
      buttons.primary = null;
      buttons.cards = [];
      const inGame = view.screen === SCREEN_PLAY || view.screen === SCREEN_CHOICE || view.screen === SCREEN_PAUSED;
      drawWorld(world, view.now, view.screen === SCREEN_TITLE ? 0.34 : 0);
      if (inGame || view.screen === SCREEN_OVER || view.screen === SCREEN_WON) drawHud(world, view);
      if (view.screen === SCREEN_TITLE) drawTitle(world, view);
      else if (view.screen === SCREEN_CHOICE) drawChoice(world, view);
      else if (view.screen === SCREEN_PAUSED) drawPaused();
      else if (view.screen === SCREEN_OVER) drawEnd(world, view, false);
      else if (view.screen === SCREEN_WON) drawEnd(world, view, true);
      drawCursor(view);
    },
  };
}
