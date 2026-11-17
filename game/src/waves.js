// The WaveDirector: it deals each wave's foes from the arena's edge in a
// trickle, waits while the warden fights them, and calls the next wave after
// a breath. Wave 10 sends the Hollow King and a slow rain of moths behind him.

import { ARENA, FINAL_WAVE, waveBudget } from './config.js';
import { range } from './random.js';

export function createDirector(random) {
  return {
    wave: 0,
    phase: 'breather', // breather | assault | done
    queue: [],
    spawnTimer: 1.2,
    breatherTimer: 1.6,
    events: [],

    /** Begin the next wave; returns false once the final wave is dealt. */
    beginWave() {
      this.wave += 1;
      const budget = waveBudget(this.wave);
      const queue = [];
      for (const kind of ['moth', 'darter', 'spitter', 'brute']) {
        for (let i = 0; i < (budget[kind] ?? 0); i += 1) queue.push(kind);
      }
      // Shuffle the deck so kinds arrive mixed, then deal the king first.
      for (let i = queue.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [queue[i], queue[j]] = [queue[j], queue[i]];
      }
      if (this.wave === FINAL_WAVE) queue.unshift('king');
      this.queue = queue;
      this.phase = 'assault';
      this.spawnTimer = 0.6;
      this.events.push(this.wave === FINAL_WAVE ? 'king-comes' : 'wave-start');
      return this.wave <= FINAL_WAVE;
    },

    /** A point just inside a random arena edge, kept away from the warden. */
    spawnPoint(player) {
      let best = null;
      let bestDist = -1;
      for (let tries = 0; tries < 6; tries += 1) {
        const side = Math.floor(random() * 4);
        let x;
        let y;
        if (side === 0) { x = range(random, ARENA.left + 20, ARENA.right - 20); y = ARENA.top + 16; }
        else if (side === 1) { x = range(random, ARENA.left + 20, ARENA.right - 20); y = ARENA.bottom - 16; }
        else if (side === 2) { x = ARENA.left + 16; y = range(random, ARENA.top + 20, ARENA.bottom - 20); }
        else { x = ARENA.right - 16; y = range(random, ARENA.top + 20, ARENA.bottom - 20); }
        const dist = Math.hypot(x - player.x, y - player.y);
        if (dist > bestDist) {
          bestDist = dist;
          best = { x, y };
        }
        if (dist > 300) break;
      }
      return best;
    },

    /**
     * Advance the dealing. `alive` is the foe count on the field. Returns the
     * foes to spawn this step as {kind, x, y}; wave events collect in events.
     */
    update(dt, alive, player) {
      const spawns = [];
      if (this.phase === 'breather') {
        this.breatherTimer -= dt;
        if (this.breatherTimer <= 0) {
          this.breatherTimer = 2.4;
          this.beginWave();
        }
        return spawns;
      }
      if (this.phase !== 'assault') return spawns;

      this.spawnTimer -= dt;
      const interval = Math.max(0.42, 1.1 - this.wave * 0.06);
      if (this.spawnTimer <= 0 && this.queue.length > 0) {
        this.spawnTimer = interval;
        const batch = this.wave === FINAL_WAVE && this.queue[0] !== 'king'
          ? 1
          : Math.min(this.queue.length, 1 + Math.floor(random() * 3));
        for (let i = 0; i < batch; i += 1) {
          const kind = this.queue.shift();
          const point = this.spawnPoint(player);
          spawns.push({ kind, x: point.x, y: point.y });
        }
      }
      if (this.queue.length === 0 && alive === 0) {
        if (this.wave >= FINAL_WAVE) {
          this.phase = 'done';
        } else {
          this.phase = 'breather';
          this.breatherTimer = 2.4;
          this.events.push('wave-clear');
        }
      }
      return spawns;
    },

    /** Foes still owed: in the queue plus the named count on the field. */
    remaining(alive) {
      return this.queue.length + alive;
    },
  };
}
