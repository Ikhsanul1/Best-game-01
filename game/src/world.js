// The simulation: one fixed-step world holding the warden, the foes, bolts,
// orbs, shards and fire-trail zones, plus score, combo and experience. It
// owns the rules — movement, dashing, combat, pickups, level-ups, winning
// and losing — and reports what happened as events the shell turns into
// sound and shake. Particles live here so every effect is born in the rules.

import { ARENA, FINAL_WAVE, PLAYER, waveHpScale, xpForLevel } from './config.js';
import { createParticles } from './particles.js';
import { createBolt, createFoe, createOrb, createPlayer, createShard, updateFoe } from './entities.js';
import { createDirector } from './waves.js';

const FOE_COLORS = {
  moth: '#57e6c9',
  darter: '#ff5d7a',
  spitter: '#b78bff',
  brute: '#ddd3c0',
  king: '#8f7bff',
};

export function createWorld(random) {
  const world = {
    random,
    particles: createParticles(random),
    director: createDirector(random),
    player: createPlayer(ARENA.left + (ARENA.right - ARENA.left) / 2, (ARENA.top + ARENA.bottom) / 2),
    foes: [],
    bolts: [],
    orbs: [],
    shards: [],
    trails: [],
    events: [],
    shake: 0,
    shakeX: 0,
    shakeY: 0,
    freeze: 0,
    stats: null,
    state: null,

    reset() {
      this.director = createDirector(this.random);
      this.player = createPlayer(ARENA.left + (ARENA.right - ARENA.left) / 2, (ARENA.top + ARENA.bottom) / 2);
      this.foes = [];
      this.bolts = [];
      this.orbs = [];
      this.shards = [];
      this.trails = [];
      this.events = [];
      this.shake = 0;
      this.freeze = 0;
      this.particles.clear();
      this.stats = {
        damage: PLAYER.boltDamage,
        fireInterval: PLAYER.fireInterval,
        projectiles: 1,
        pierce: 0,
        speedMul: 1,
        pickupRadius: PLAYER.pickupRadius,
        dashCooldown: PLAYER.dashCooldown,
        regen: 0,
        armor: 0,
        trail: false,
        scoreMul: 1,
      };
      this.state = {
        score: 0,
        kills: 0,
        time: 0,
        level: 1,
        xp: 0,
        xpNext: xpForLevel(1),
        combo: 0,
        comboTimer: 0,
        comboPeak: 0,
        pickupStreak: 0,
        streakTimer: 0,
        stacks: {},
        wave: 0,
        pendingLevels: 0,
        bannerText: '',
        bannerTimer: 0,
        over: false,
        won: false,
      };
    },

    // --- the host the foe behaviours call back into -------------------------
    addOrb(x, y, angle, speed, damage) {
      this.orbs.push(createOrb(x, y, angle, speed, damage));
    },
    onKingBurst(foe) {
      this.shake = Math.max(this.shake, 6);
      this.particles.ring(foe.x, foe.y, FOE_COLORS.king, 120, 4);
      this.events.push('burst');
    },
    summonMoths(foe, count) {
      for (let i = 0; i < count && this.foes.length < 130; i += 1) {
        const angle = (i / count) * Math.PI * 2;
        const moth = createFoe('moth', foe.x + Math.cos(angle) * 60, foe.y + Math.sin(angle) * 60, waveHpScale(this.director.wave), this.random);
        this.foes.push(moth);
      }
    },

    banner(text, seconds = 2.2) {
      this.state.bannerText = text;
      this.state.bannerTimer = seconds;
    },

    damagePlayer(amount) {
      const player = this.player;
      if (this.state.over || player.dashTimer > 0 || player.hurtTimer > 0) return;
      player.hp -= amount * (1 - this.stats.armor);
      player.hurtTimer = PLAYER.hurtCooldown;
      this.shake = Math.max(this.shake, 7);
      this.particles.burst(player.x, player.y, '#ff4d5e', 10, 160, 2.6);
      this.events.push('hurt');
      if (player.hp <= 0) {
        player.hp = 0;
        this.state.over = true;
        this.particles.burst(player.x, player.y, '#ffb347', 42, 260, 3.4);
        this.particles.ring(player.x, player.y, '#ffb347', 130, 4);
        this.events.push('lose');
      }
    },

    killFoe(foe) {
      const state = this.state;
      foe.dead = true;
      state.kills += 1;
      state.combo += 1;
      state.comboTimer = 2.5;
      state.comboPeak = Math.max(state.comboPeak, state.combo);
      const comboMul = 1 + Math.min(20, state.combo) * 0.05;
      const gained = Math.round(foe.score * comboMul * this.stats.scoreMul);
      state.score += gained;
      this.particles.burst(foe.x, foe.y, FOE_COLORS[foe.kind], foe.kind === 'brute' || foe.kind === 'king' ? 26 : 13, 200, 3);
      this.particles.text(foe.x, foe.y - foe.radius - 4, `+${gained}`, '#f5ecd7', foe.kind === 'king' ? 26 : 14);
      if (foe.kind === 'king') {
        this.freeze = Math.max(this.freeze, 0.12);
        this.shake = Math.max(this.shake, 12);
        this.particles.ring(foe.x, foe.y, '#fff3c4', 220, 5);
        state.won = true;
        state.over = true;
        this.events.push('win');
      } else {
        if (foe.kind === 'brute') {
          this.freeze = Math.max(this.freeze, 0.03);
          this.shake = Math.max(this.shake, 5);
        }
        this.events.push(foe.kind === 'brute' ? 'bigdie' : 'die');
      }
      // Glowshards: the king spills a fountain, everyone else drops their worth.
      if (foe.kind === 'king') {
        for (let i = 0; i < 10; i += 1) this.shards.push(createShard(foe.x, foe.y, 3, this.random));
      } else if (foe.xp > 0) {
        this.shards.push(createShard(foe.x, foe.y, foe.xp, this.random));
      }
    },

    gainXp(value) {
      const state = this.state;
      state.xp += value;
      while (state.xp >= state.xpNext) {
        state.xp -= state.xpNext;
        state.level += 1;
        state.xpNext = xpForLevel(state.level);
        state.pendingLevels += 1;
        this.particles.ring(this.player.x, this.player.y, '#8df5d2', 90, 3);
        this.events.push('levelup');
      }
    },

    /**
     * Advance one fixed step. `control` is { move:{x,y}, aim:{x,y}, dash }.
     * Events collect in world.events for the shell to drain.
     */
    step(dt, control) {
      const state = this.state;
      const player = this.player;
      if (this.freeze > 0) {
        this.freeze -= dt;
        this.particles.update(dt);
        return;
      }
      this.particles.update(dt);
      if (state.bannerTimer > 0) state.bannerTimer -= dt;
      this.shake = Math.max(0, this.shake - dt * 26);
      this.shakeX = (this.random() - 0.5) * 2 * this.shake;
      this.shakeY = (this.random() - 0.5) * 2 * this.shake;
      if (state.over) return;
      state.time += dt;

      // --- the warden -------------------------------------------------------
      player.hurtTimer = Math.max(0, player.hurtTimer - dt);
      player.dashCooldownTimer = Math.max(0, player.dashCooldownTimer - dt);
      if (this.stats.regen > 0) player.hp = Math.min(player.maxHp, player.hp + this.stats.regen * dt);
      player.aim = Math.atan2(control.aim.y - player.y, control.aim.x - player.x);

      if (control.dash && player.dashTimer <= 0 && player.dashCooldownTimer <= 0) {
        player.dashTimer = PLAYER.dashTime;
        player.dashCooldownTimer = this.stats.dashCooldown;
        const dir = control.move.x !== 0 || control.move.y !== 0 ? control.move : { x: Math.cos(player.aim), y: Math.sin(player.aim) };
        player.dashDirX = dir.x;
        player.dashDirY = dir.y;
        this.events.push('dash');
      }
      if (player.dashTimer > 0) {
        player.dashTimer -= dt;
        player.x += player.dashDirX * PLAYER.dashSpeed * dt;
        player.y += player.dashDirY * PLAYER.dashSpeed * dt;
        this.particles.embers(player.x, player.y, 2);
        if (this.stats.trail) {
          this.trails.push({ x: player.x, y: player.y, life: 0.7, maxLife: 0.7 });
        }
      } else {
        const speed = PLAYER.speed * this.stats.speedMul;
        player.x += control.move.x * speed * dt;
        player.y += control.move.y * speed * dt;
        if (control.move.x !== 0 || control.move.y !== 0) {
          player.stepPhase += dt * 9;
          if (this.random() < 0.1) this.particles.embers(player.x, player.y + 8, 1);
        }
      }
      player.x = Math.min(ARENA.right - player.radius, Math.max(ARENA.left + player.radius, player.x));
      player.y = Math.min(ARENA.bottom - player.radius, Math.max(ARENA.top + player.radius, player.y));

      // Bolts stream toward the aim while the night lasts.
      player.fireTimer -= dt;
      while (player.fireTimer <= 0) {
        player.fireTimer += this.stats.fireInterval;
        const count = this.stats.projectiles;
        for (let i = 0; i < count; i += 1) {
          const spread = count === 1 ? 0 : (i - (count - 1) / 2) * 0.085;
          this.bolts.push(createBolt(
            player.x + Math.cos(player.aim) * (player.radius + 6),
            player.y + Math.sin(player.aim) * (player.radius + 6),
            player.aim + spread,
            this.stats.damage,
            this.stats.pierce,
          ));
        }
        this.particles.streak(player.x + Math.cos(player.aim) * 20, player.y + Math.sin(player.aim) * 20, player.aim, '#ffcf87', 2);
        this.events.push('shoot');
      }

      // --- the director deals the night --------------------------------------
      const spawns = this.director.update(dt, this.foes.length, player);
      for (const spawn of spawns) {
        this.foes.push(createFoe(spawn.kind, spawn.x, spawn.y, waveHpScale(this.director.wave), this.random));
        this.particles.burst(spawn.x, spawn.y, '#4a3d7a', 6, 90, 2.4);
      }
      for (const event of this.director.events.splice(0)) {
        if (event === 'wave-start') {
          this.banner(`Wave ${this.director.wave}`, 2);
          this.events.push('wave');
        } else if (event === 'king-comes') {
          this.banner('The Hollow King comes', 2.8);
          this.events.push('king');
        } else if (event === 'wave-clear') {
          state.score += 50 * this.director.wave;
          this.banner(`Wave ${this.director.wave} held — +${50 * this.director.wave}`, 2);
          this.events.push('clear');
        }
      }
      state.wave = this.director.wave;

      // --- foes ---------------------------------------------------------------
      for (const foe of this.foes) updateFoe(foe, this, dt, this.random);
      // Shoulder to shoulder: foes push off one another so packs stay readable.
      for (let i = 0; i < this.foes.length; i += 1) {
        const a = this.foes[i];
        for (let j = i + 1; j < this.foes.length; j += 1) {
          const b = this.foes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const min = a.radius + b.radius;
          const d2 = dx * dx + dy * dy;
          if (d2 > 0.01 && d2 < min * min) {
            const d = Math.sqrt(d2);
            const push = ((min - d) / d) * 0.5;
            a.x -= dx * push * 0.5;
            a.y -= dy * push * 0.5;
            b.x += dx * push * 0.5;
            b.y += dy * push * 0.5;
          }
        }
      }
      for (const foe of this.foes) {
        foe.x = Math.min(ARENA.right - foe.radius * 0.4, Math.max(ARENA.left + foe.radius * 0.4, foe.x));
        foe.y = Math.min(ARENA.bottom - foe.radius * 0.4, Math.max(ARENA.top + foe.radius * 0.4, foe.y));
      }

      // Fire-trail zones burn whatever stands in them.
      for (let i = this.trails.length - 1; i >= 0; i -= 1) {
        const zone = this.trails[i];
        zone.life -= dt;
        if (zone.life <= 0) {
          this.trails.splice(i, 1);
          continue;
        }
        for (const foe of this.foes) {
          if (foe.dead) continue;
          const d = Math.hypot(foe.x - zone.x, foe.y - zone.y);
          if (d < foe.radius + 16) {
            foe.hp -= 30 * dt;
            foe.flash = Math.max(foe.flash, 0.05);
            if (foe.hp <= 0) this.killFoe(foe);
          }
        }
      }

      // --- bolts ---------------------------------------------------------------
      for (const bolt of this.bolts) {
        bolt.x += bolt.vx * dt;
        bolt.y += bolt.vy * dt;
        bolt.life -= dt;
        if (bolt.life <= 0 || bolt.x < ARENA.left - 30 || bolt.x > ARENA.right + 30 || bolt.y < ARENA.top - 30 || bolt.y > ARENA.bottom + 30) {
          bolt.dead = true;
          continue;
        }
        if (!bolt.hitSet) bolt.hitSet = new Set();
        for (const foe of this.foes) {
          if (foe.dead || bolt.hitSet.has(foe)) continue;
          const d = Math.hypot(foe.x - bolt.x, foe.y - bolt.y);
          if (d < foe.radius + bolt.radius) {
            bolt.hitSet.add(foe);
            foe.hp -= bolt.damage;
            foe.flash = 0.09;
            const kb = 130 * foe.knock;
            foe.x += (bolt.vx / 640) * kb * dt * 8;
            foe.y += (bolt.vy / 640) * kb * dt * 8;
            this.particles.text(foe.x + (this.random() - 0.5) * 14, foe.y - foe.radius - 2, `${Math.round(bolt.damage)}`, '#ffd9a0', 12);
            this.events.push('hit');
            if (foe.hp <= 0) this.killFoe(foe);
            if (bolt.pierce > 0) bolt.pierce -= 1;
            else {
              bolt.dead = true;
              break;
            }
          }
        }
      }
      this.bolts = this.bolts.filter((b) => !b.dead);

      // --- orbs ------------------------------------------------------------------
      for (const orb of this.orbs) {
        orb.x += orb.vx * dt;
        orb.y += orb.vy * dt;
        orb.life -= dt;
        if (orb.life <= 0 || orb.x < ARENA.left - 20 || orb.x > ARENA.right + 20 || orb.y < ARENA.top - 20 || orb.y > ARENA.bottom + 20) {
          orb.dead = true;
          continue;
        }
        const d = Math.hypot(player.x - orb.x, player.y - orb.y);
        if (d < player.radius + orb.radius && player.dashTimer <= 0) {
          orb.dead = true;
          this.damagePlayer(orb.damage);
        }
      }
      this.orbs = this.orbs.filter((o) => !o.dead);

      // --- contact -----------------------------------------------------------------
      for (const foe of this.foes) {
        if (foe.dead) continue;
        const d = Math.hypot(player.x - foe.x, player.y - foe.y);
        if (d < player.radius + foe.radius * 0.85 && foe.attackTimer <= 0 && player.dashTimer <= 0) {
          foe.attackTimer = 0.9;
          this.damagePlayer(foe.damage);
        }
      }
      this.foes = this.foes.filter((f) => !f.dead);

      // --- shards --------------------------------------------------------------------
      state.streakTimer = Math.max(0, state.streakTimer - dt);
      if (state.streakTimer <= 0) state.pickupStreak = 0;
      for (const shard of this.shards) {
        shard.x += shard.vx * dt;
        shard.y += shard.vy * dt;
        shard.vx *= 1 - 5 * dt;
        shard.vy *= 1 - 5 * dt;
        const dx = player.x - shard.x;
        const dy = player.y - shard.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < this.stats.pickupRadius) shard.magnet = true;
        if (shard.magnet) {
          const pull = 560;
          shard.x += (dx / d) * pull * dt;
          shard.y += (dy / d) * pull * dt;
        }
        if (d < player.radius + 12) {
          shard.dead = true;
          state.pickupStreak += 1;
          state.streakTimer = 1.4;
          this.events.push('pickup');
          this.particles.burst(shard.x, shard.y, '#8df5d2', 4, 90, 2);
          this.gainXp(shard.value);
        }
      }
      this.shards = this.shards.filter((s) => !s.dead);

      // --- combo -----------------------------------------------------------------------
      state.comboTimer = Math.max(0, state.comboTimer - dt);
      if (state.comboTimer <= 0) state.combo = 0;
    },
  };
  world.reset();
  return world;
}
