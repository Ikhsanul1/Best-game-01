// Blessings: the choices offered each level-up. Each blessing is a small
// named promise with a stack cap; three distinct ones are dealt, and the
// warden's build grows by what the player picks. When the pool runs dry the
// deal falls back to mending and tribute, so a choice always matters.

export const BLESSINGS = [
  {
    id: 'sharper', name: 'Sharper Embers', max: 5,
    blurb: 'Your bolts bite 20% deeper.',
    apply(world) { world.stats.damage *= 1.2; },
  },
  {
    id: 'quicker', name: 'Quicker Hands', max: 5,
    blurb: 'You loose bolts 15% faster.',
    apply(world) { world.stats.fireInterval *= 0.85; },
  },
  {
    id: 'twin', name: 'Twin Flame', max: 3,
    blurb: 'One more bolt in every volley, fanned wide.',
    apply(world) { world.stats.projectiles += 1; },
  },
  {
    id: 'piercing', name: 'Piercing Light', max: 3,
    blurb: 'Bolts pass through one more foe.',
    apply(world) { world.stats.pierce += 1; },
  },
  {
    id: 'swift', name: 'Swift Steps', max: 4,
    blurb: 'You move 10% faster through the dark.',
    apply(world) { world.stats.speedMul *= 1.1; },
  },
  {
    id: 'lantern', name: 'Wide Lantern', max: 3,
    blurb: 'Your light gathers shards from 45% farther.',
    apply(world) { world.stats.pickupRadius *= 1.45; },
  },
  {
    id: 'wind', name: 'Second Wind', max: 4,
    blurb: 'Gain 25 heart, and mend 40 at once.',
    apply(world) {
      world.player.maxHp += 25;
      world.player.hp = Math.min(world.player.maxHp, world.player.hp + 40);
    },
  },
  {
    id: 'vital', name: 'Vital Glow', max: 3,
    blurb: 'Your wounds close: 0.6 heart a second.',
    apply(world) { world.stats.regen += 0.6; },
  },
  {
    id: 'bulwark', name: 'Bulwark Bark', max: 3,
    blurb: 'Blows land 12% softer on you.',
    apply(world) { world.stats.armor += 0.12; },
  },
  {
    id: 'quickstep', name: 'Quickstep', max: 3,
    blurb: 'Your dash returns 22% sooner.',
    apply(world) { world.stats.dashCooldown *= 0.78; },
  },
  {
    id: 'trail', name: 'Kindled Trail', max: 1,
    blurb: 'Dashing leaves fire that burns foes standing in it.',
    apply(world) { world.stats.trail = true; },
  },
  {
    id: 'greedy', name: 'Gilded Glow', max: 3,
    blurb: 'Everything you fell is worth 25% more score.',
    apply(world) { world.stats.scoreMul *= 1.25; },
  },
];

/** The always-available cards that fill a deal when blessings run out. */
const FALLBACKS = [
  {
    id: 'mend', name: 'Field Dressing', max: Infinity,
    blurb: 'Mend 35 heart, here and now.',
    apply(world) { world.player.hp = Math.min(world.player.maxHp, world.player.hp + 35); },
  },
  {
    id: 'tribute', name: 'Tribute of Sparks', max: Infinity,
    blurb: 'The night pays you 150 score.',
    apply(world) { world.state.score += 150; },
  },
];

/** Deal three distinct blessings the warden can still take. */
export function rollChoices(random, stacks) {
  const open = BLESSINGS.filter((b) => (stacks[b.id] ?? 0) < b.max);
  const dealt = [];
  const pool = [...open];
  while (dealt.length < 3 && pool.length > 0) {
    const index = Math.floor(random() * pool.length);
    dealt.push(pool.splice(index, 1)[0]);
  }
  for (const fallback of FALLBACKS) {
    if (dealt.length >= 3) break;
    dealt.push(fallback);
  }
  return dealt;
}

/** Apply a dealt blessing and record the stack. */
export function applyBlessing(world, blessing) {
  blessing.apply(world);
  world.state.stacks[blessing.id] = (world.state.stacks[blessing.id] ?? 0) + 1;
}
