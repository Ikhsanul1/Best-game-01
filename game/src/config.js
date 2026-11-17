// Emberwake's tuning table: the field, the palette and every number the rules
// run on, in one place so the balance can be read at a glance.

/** The logical size of the arena; the canvas scales it to the window. */
export const FIELD = { width: 1280, height: 720 };
/** The wall of standing stones around the arena, in logical pixels. */
export const ARENA = { left: 34, top: 74, right: FIELD.width - 34, bottom: FIELD.height - 30 };
/** The fixed simulation step: 60 updates a second, whatever the display does. */
export const STEP = 1 / 60;
/** localStorage key for the best score. */
export const BEST_KEY = 'emberwake-best-score';
/** The wave the Hollow King arrives on; killing him wins the game. */
export const FINAL_WAVE = 10;

/** The one palette: ink-indigo night, amber lantern light, and a colour per foe. */
export const INK = {
  nightTop: '#100d24',
  nightBottom: '#1e1838',
  ground: '#191430',
  stone: '#2c2450',
  stoneLit: '#4a3d7a',
  amber: '#ffb347',
  amberHot: '#ff7847',
  emberCore: '#fff3c4',
  teal: '#57e6c9',
  rose: '#ff5d7a',
  violet: '#b78bff',
  bone: '#ddd3c0',
  shard: '#8df5d2',
  cream: '#f5ecd7',
  dim: '#9d94c4',
  blood: '#ff4d5e',
  dawnTop: '#3a2b57',
  dawnBottom: '#c96f3f',
};

/** The warden the player drives. */
export const PLAYER = {
  radius: 14,
  speed: 238,
  maxHp: 100,
  fireInterval: 0.24,
  boltDamage: 12,
  boltSpeed: 640,
  dashTime: 0.17,
  dashSpeed: 880,
  dashCooldown: 2.1,
  pickupRadius: 54,
  hurtCooldown: 0.35,
};

/** One row per foe kind: body, temper and worth. Score and xp are what a kill pays. */
export const FOES = {
  moth: { radius: 13, hp: 18, speed: 104, damage: 10, score: 10, xp: 1, knock: 1 },
  darter: { radius: 10, hp: 10, speed: 158, damage: 8, score: 15, xp: 1, knock: 1 },
  spitter: { radius: 14, hp: 26, speed: 82, damage: 9, score: 25, xp: 2, knock: 0.9 },
  brute: { radius: 26, hp: 100, speed: 52, damage: 18, score: 40, xp: 3, knock: 0.12 },
  king: { radius: 46, hp: 1500, speed: 60, damage: 24, score: 1000, xp: 30, knock: 0 },
};

/** How many foes of each kind a wave sends, by wave number (the king is extra). */
export function waveBudget(wave) {
  return {
    moth: 6 + wave * 3,
    darter: wave >= 2 ? 2 + wave * 2 : 0,
    spitter: wave >= 3 ? Math.floor(wave * 1.4) : 0,
    brute: wave >= 4 ? Math.floor((wave - 2) * 0.9) : 0,
  };
}

/** Foe hit points grow a little each wave, so early blessings stay meaningful. */
export function waveHpScale(wave) {
  return 1 + (wave - 1) * 0.07;
}

/** Experience needed to leave a level: level 1 asks 6, each next asks 5 more. */
export function xpForLevel(level) {
  return 6 + (level - 1) * 5;
}
