# Emberwake — a lantern-warden survival

[![make.fun bounty](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![rank](https://make.fun/badge/best-game-01/Ikhsanul1/Best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard)
[![reward](https://make.fun/badge/best-game-01/Ikhsanul1/Best-game-01/reward.svg)](https://make.fun/bounty/best-game-01)

Built for the make.fun bounty [Make the best game](https://make.fun/bounty/best-game-01).

## The game

You are Wren, a little ember sprite keeping the last lantern lit in a dusk
wood. Shades and moths swarm the light for 10 waves; at wave 10 the Hollow
King comes. Kill him and dawn breaks. Fall, and the light goes out.

- **Move** with WASD or the arrow keys, **aim** with the mouse — ember bolts
  stream toward the cursor
- **Dash** on Space or Shift, with i-frames to slip through the swarm
- **Level up** and choose 1 of 3 blessings (11 stackable blessings: multishot,
  embers, haste, magnet, thorns, and more)
- 4 foe kinds plus a two-phase boss, XP shards, combo multiplier, escalating
  waves, score and best score kept in localStorage
- Particles, floating damage numbers, screen shake, hit-stop, hurt vignette,
  wave banners, and synthesized WebAudio sound and generative music — every
  sprite is drawn in code, no external assets, no network

## Play it locally

```sh
node serve.ts            # serves game/ at http://localhost:8080
```

Then open http://localhost:8080 in a desktop browser. The game is plain
static files under `game/` — any static server works, no build step.

## Layout

- `game/index.html` — the page
- `game/src/` — the game's own source, one job per file: `config` (tuning and
  palette), `random` (seeded RNG), `input`, `audio` (synth SFX and music),
  `particles`, `entities`, `waves` (the WaveDirector), `upgrades`
  (blessings), `world` (the simulation), `render` (canvas drawing and HUD),
  `shots` (deterministic screenshot scenes), `main` (boot and game loop)
- `main.ts` — the entry program: copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json` for the bounty
- `screenshots/` — real renders of the game in a browser: play, title, boss,
  and the dawn victory screen

## License

MIT — see `LICENSE`.
