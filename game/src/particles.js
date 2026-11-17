// The juice: a pooled particle system (sparks, glows, embers), expanding
// shockwave rings and floating combat text. Everything is pre-allocated and
// recycled, so a crowded wave never allocates in the hot loop.

const MAX_PARTICLES = 900;
const MAX_TEXTS = 48;
const MAX_RINGS = 24;

export function createParticles(random) {
  const pool = [];
  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    pool.push({ live: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff', drag: 1, gravity: 0, glow: false });
  }
  const texts = [];
  for (let i = 0; i < MAX_TEXTS; i += 1) {
    texts.push({ live: false, x: 0, y: 0, life: 0, maxLife: 1, value: '', color: '#fff', size: 15 });
  }
  const rings = [];
  for (let i = 0; i < MAX_RINGS; i += 1) {
    rings.push({ live: false, x: 0, y: 0, life: 0, maxLife: 1, radius: 10, color: '#fff', width: 3 });
  }
  let cursor = 0;

  function spawn(fields) {
    const p = pool[cursor];
    cursor = (cursor + 1) % MAX_PARTICLES;
    Object.assign(p, fields, { live: true, life: 0 });
  }

  return {
    /** A radial burst of sparks and one soft glow, the standard death punctuation. */
    burst(x, y, color, count = 14, speed = 190, size = 3) {
      for (let i = 0; i < count; i += 1) {
        const angle = random() * Math.PI * 2;
        const v = speed * (0.3 + random() * 0.9);
        spawn({
          x, y,
          vx: Math.cos(angle) * v, vy: Math.sin(angle) * v,
          maxLife: 0.35 + random() * 0.4, size: size * (0.6 + random() * 0.8),
          color, drag: 4.5, gravity: 0, glow: false,
        });
      }
      spawn({ x, y, vx: 0, vy: 0, maxLife: 0.22, size: 26, color, drag: 1, gravity: 0, glow: true });
    },
    /** A thin ring that expands and fades — level-ups, boss deaths, dawn. */
    ring(x, y, color, radius = 90, width = 3) {
      for (const r of rings) {
        if (r.live) continue;
        Object.assign(r, { live: true, x, y, life: 0, maxLife: 0.5, radius, color, width });
        return;
      }
    },
    /** A few embers drifting up, for dashes, the lantern and ambient fire. */
    embers(x, y, count = 3, color = '#ffb347') {
      for (let i = 0; i < count; i += 1) {
        spawn({
          x: x + (random() - 0.5) * 16, y: y + (random() - 0.5) * 16,
          vx: (random() - 0.5) * 30, vy: -30 - random() * 50,
          maxLife: 0.5 + random() * 0.6, size: 1.6 + random() * 2,
          color, drag: 0.4, gravity: -30, glow: true,
        });
      }
    },
    /** A straight spark streak, for muzzle flashes and dash trails. */
    streak(x, y, angle, color, count = 4) {
      for (let i = 0; i < count; i += 1) {
        const v = 240 + random() * 200;
        spawn({
          x, y,
          vx: Math.cos(angle) * v + (random() - 0.5) * 60,
          vy: Math.sin(angle) * v + (random() - 0.5) * 60,
          maxLife: 0.1 + random() * 0.1, size: 2, color, drag: 6, gravity: 0, glow: true,
        });
      }
    },
    /** Floating text that rises and fades: damage numbers, pickups, calls. */
    text(x, y, value, color = '#f5ecd7', size = 15) {
      for (const t of texts) {
        if (t.live) continue;
        Object.assign(t, { live: true, x, y, life: 0, maxLife: 0.8, value, color, size });
        return;
      }
    },
    update(dt) {
      for (const p of pool) {
        if (!p.live) continue;
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.live = false;
          continue;
        }
        const dragK = Math.max(0, 1 - p.drag * dt);
        p.vx *= dragK;
        p.vy = p.vy * dragK + p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      for (const t of texts) {
        if (!t.live) continue;
        t.life += dt;
        if (t.life >= t.maxLife) t.live = false;
        else t.y -= 34 * dt;
      }
      for (const r of rings) {
        if (!r.live) continue;
        r.life += dt;
        if (r.life >= r.maxLife) r.live = false;
      }
    },
    /** Paint order is the caller's: glows additive, sparks plain, texts last. */
    draw(ctx) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const p of pool) {
        if (!p.live || !p.glow) continue;
        const fade = 1 - p.life / p.maxLife;
        ctx.globalAlpha = fade * 0.5;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + fade * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      for (const p of pool) {
        if (!p.live || p.glow) continue;
        const fade = 1 - p.life / p.maxLife;
        ctx.globalAlpha = fade;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * fade + 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (const r of rings) {
        if (!r.live) continue;
        const k = r.life / r.maxLife;
        ctx.globalAlpha = (1 - k) * 0.7;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = r.width * (1 - k) + 0.5;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius * (0.2 + 0.8 * k), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      for (const t of texts) {
        if (!t.live) continue;
        const fade = 1 - t.life / t.maxLife;
        ctx.globalAlpha = Math.min(1, fade * 2);
        ctx.font = `700 ${t.size}px system-ui, sans-serif`;
        ctx.fillStyle = t.color;
        ctx.fillText(t.value, t.x, t.y);
      }
      ctx.globalAlpha = 1;
    },
    clear() {
      for (const p of pool) p.live = false;
      for (const t of texts) t.live = false;
      for (const r of rings) r.live = false;
    },
  };
}
