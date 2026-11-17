// Every sound is synthesized with WebAudio — no audio files. The SoundBank
// plays short shaped tones and noise bursts for each game event; the MusicBox
// runs a lookahead scheduler that plucks a slow pentatonic pattern over soft
// pad chords, so the night has a pulse that never repeats exactly.

/** Frequencies of the ember scale (A minor pentatonic, two octaves). */
const SCALE = [220, 261.63, 329.63, 392, 440, 523.25, 659.25, 783.99];
/** The pad's chord roots, one per bar: Am, F, C, G in low octaves. */
const CHORDS = [110, 87.31, 130.81, 98];

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let musicTimer = null;
  let nextNoteTime = 0;
  let step = 0;
  let bar = 0;

  /** Build the context on the first user gesture; safe to call every frame. */
  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    ctx = new AudioCtor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    startMusic();
  }

  function tone({ freq, end = null, type = 'sine', dur = 0.15, vol = 0.2, at = 0, curve = 0.001 }) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (end !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(curve, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise({ dur = 0.2, vol = 0.15, at = 0, freq = 1200, q = 0.8 }) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + at;
    const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t0);
  }

  /** One scheduled music note, placed by the lookahead timer. */
  function scheduleStep(when, index, barIndex) {
    const ahead = when - ctx.currentTime;
    if (index % 8 === 0) {
      const root = CHORDS[barIndex % CHORDS.length];
      for (const mult of [1, 1.5, 2]) {
        tone({ freq: root * mult, type: 'triangle', dur: 3.6, vol: 0.028, at: ahead, curve: 0.0005 });
      }
    }
    // A sparse melody: pluck on a seeded-feeling pattern of eighths, resting often.
    const pattern = [0, -1, 2, -1, 4, -1, 3, -1, 5, -1, 4, 2, -1, 1, -1, -1];
    const note = pattern[index % pattern.length];
    if (note >= 0) {
      tone({ freq: SCALE[note % SCALE.length], type: 'sine', dur: 0.5, vol: 0.05, at: ahead });
      tone({ freq: SCALE[note % SCALE.length] * 2, type: 'sine', dur: 0.22, vol: 0.012, at: ahead });
    }
    if (index % 4 === 2) tone({ freq: CHORDS[barIndex % CHORDS.length] / 2, type: 'sine', dur: 0.4, vol: 0.045, at: ahead });
  }

  function startMusic() {
    if (!ctx || musicTimer !== null) return;
    nextNoteTime = ctx.currentTime + 0.1;
    step = 0;
    bar = 0;
    const eighth = 60 / 92 / 2; // 92 bpm, eighth notes
    musicTimer = window.setInterval(() => {
      if (!ctx) return;
      while (nextNoteTime < ctx.currentTime + 0.18) {
        scheduleStep(nextNoteTime, step, bar);
        nextNoteTime += eighth;
        step += 1;
        if (step % 16 === 0) bar += 1;
      }
    }, 60);
  }

  return {
    unlock,
    /** Toggle the whole mix; returns the new muted state. */
    toggleMute() {
      muted = !muted;
      if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.02);
      return muted;
    },
    get muted() {
      return muted;
    },
    shoot() {
      tone({ freq: 840 + Math.random() * 120, end: 340, type: 'triangle', dur: 0.07, vol: 0.05 });
    },
    hit() {
      tone({ freq: 220 + Math.random() * 60, end: 140, type: 'square', dur: 0.05, vol: 0.045 });
    },
    die(big) {
      noise({ dur: big ? 0.3 : 0.16, vol: big ? 0.22 : 0.12, freq: big ? 500 : 900 });
      tone({ freq: big ? 160 : 300, end: 60, type: 'sawtooth', dur: big ? 0.3 : 0.16, vol: 0.08 });
    },
    pickup(streak) {
      const base = SCALE[Math.min(streak, 10) % SCALE.length] * 2;
      tone({ freq: base, type: 'sine', dur: 0.12, vol: 0.07 });
      tone({ freq: base * 1.5, type: 'sine', dur: 0.16, vol: 0.05, at: 0.04 });
    },
    hurt() {
      tone({ freq: 130, end: 55, type: 'sawtooth', dur: 0.22, vol: 0.2 });
      noise({ dur: 0.18, vol: 0.14, freq: 300 });
    },
    dash() {
      noise({ dur: 0.16, vol: 0.1, freq: 2400, q: 0.4 });
    },
    levelUp() {
      for (let i = 0; i < 4; i += 1) tone({ freq: SCALE[i + 2], type: 'triangle', dur: 0.34, vol: 0.1, at: i * 0.07 });
    },
    wave() {
      tone({ freq: 392, type: 'sine', dur: 0.5, vol: 0.09 });
      tone({ freq: 587.33, type: 'sine', dur: 0.6, vol: 0.07, at: 0.09 });
    },
    boss() {
      tone({ freq: 98, end: 49, type: 'sawtooth', dur: 0.9, vol: 0.16 });
      tone({ freq: 147, end: 73.5, type: 'sawtooth', dur: 0.9, vol: 0.1, at: 0.05 });
      noise({ dur: 0.7, vol: 0.08, freq: 220 });
    },
    victory() {
      const seq = [0, 2, 4, 5, 7];
      seq.forEach((n, i) => tone({ freq: SCALE[n], type: 'triangle', dur: 0.5, vol: 0.11, at: i * 0.13 }));
    },
    gameOver() {
      const seq = [4, 3, 2, 0];
      seq.forEach((n, i) => tone({ freq: SCALE[n] / 2, type: 'triangle', dur: 0.55, vol: 0.1, at: i * 0.16 }));
    },
    click() {
      tone({ freq: 660, type: 'sine', dur: 0.06, vol: 0.06 });
    },
  };
}
