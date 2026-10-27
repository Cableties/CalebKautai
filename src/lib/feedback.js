// Feedback for the games when you tap, in place of the browser's blue tap flash: little synthesised
// sound effects (made on the fly with Web Audio, so there are no sound files to download) and a
// short buzz on phones that can vibrate from a web page (Android; iPhones can't). Sound can be
// switched off on any game page, and that's remembered.
const KEY = 'games-sound'
let muted = null // read from storage the first time it's needed
let audio = null
let master = null

export function soundOn() {
  if (muted === null) {
    try {
      muted = localStorage.getItem(KEY) === 'off'
    } catch {
      muted = false
    }
  }
  return !muted
}

export function setSoundOn(on) {
  muted = !on
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    // Storage blocked: it just won't be remembered
  }
}

// Browsers only start sound after a tap or key press, which is where the first effect comes from
function context() {
  if (!audio) {
    const Context = window.AudioContext ?? window.webkitAudioContext
    if (!Context) return null
    audio = new Context()
    master = audio.createGain()
    master.gain.value = 0.16
    master.connect(audio.destination)
  }
  if (audio.state === 'suspended') audio.resume()
  return audio
}

// One note: a `wave` sliding from `from` to `to` Hz over `ms`, fading out, starting `delay` ms from
// now. `noise` swaps the wave for a burst of hiss through a filter at `from` Hz (thuds and whooshes).
function note(ctx, { wave = 'square', from, to = from, ms = 80, gain = 1, delay = 0, noise = false }) {
  const start = ctx.currentTime + delay / 1000
  const end = start + ms / 1000
  const level = ctx.createGain()
  level.gain.setValueAtTime(gain, start)
  level.gain.exponentialRampToValueAtTime(0.001, end)
  level.connect(master)
  let source
  if (noise) {
    const buffer = ctx.createBuffer(1, Math.ceil((ctx.sampleRate * ms) / 1000), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    source = ctx.createBufferSource()
    source.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(from, start)
    filter.frequency.exponentialRampToValueAtTime(to, end)
    source.connect(filter).connect(level)
  } else {
    source = ctx.createOscillator()
    source.type = wave
    source.frequency.setValueAtTime(from, start)
    source.frequency.exponentialRampToValueAtTime(to, end)
    source.connect(level)
  }
  source.start(start)
  source.stop(end)
}

// Each effect: its notes, and how long to buzz (ms, or an on/off pattern)
export const EFFECTS = {
  // Flappy Head: a breathy whoop for each flap, a chime per pipe, a squelchy splat
  flap: { notes: [{ wave: 'triangle', from: 330, to: 660, ms: 90, gain: 0.7 }], buzz: 8 },
  point: { notes: [{ from: 988, ms: 70, gain: 0.35 }, { from: 1319, ms: 140, gain: 0.35, delay: 70 }] },
  splat: {
    notes: [
      { wave: 'sawtooth', from: 200, to: 45, ms: 280, gain: 0.6 },
      { noise: true, from: 1800, to: 200, ms: 220, gain: 0.8 },
    ],
    buzz: [40, 30, 60],
  },
  // Bonk: a cartoony thunk for a hit, a soft whiff for an empty hole, a bell when time's up
  bonk: {
    notes: [
      { wave: 'sine', from: 260, to: 90, ms: 140, gain: 1 },
      { noise: true, from: 3000, to: 600, ms: 40, gain: 0.6 },
    ],
    buzz: 18,
  },
  whiff: { notes: [{ noise: true, from: 900, to: 300, ms: 90, gain: 0.35 }], buzz: 5 },
  time: { notes: [880, 660, 440].map((from, i) => ({ wave: 'triangle', from, ms: 220, gain: 0.5, delay: i * 140 })), buzz: [30, 60, 30] },
  // Pinball: a click for the flippers, a plunger whoosh, dings and blips off the table
  flip: { notes: [{ from: 140, to: 90, ms: 35, gain: 0.35 }], buzz: 6 },
  launch: { notes: [{ noise: true, from: 300, to: 2500, ms: 260, gain: 0.6 }], buzz: 20 },
  bumper: { notes: [{ wave: 'sine', from: 784, ms: 160, gain: 0.6 }, { wave: 'sine', from: 1175, ms: 120, gain: 0.3 }], buzz: 10 },
  kicker: { notes: [{ wave: 'triangle', from: 520, to: 260, ms: 70, gain: 0.6 }], buzz: 8 },
  rollover: { notes: [{ from: 1568, ms: 50, gain: 0.25 }] },
  hole: { notes: [{ wave: 'sine', from: 600, to: 150, ms: 300, gain: 0.6 }], buzz: 25 },
  bonus: { notes: [523, 659, 784, 1047].map((from, i) => ({ from, ms: 120, gain: 0.3, delay: i * 80 })), buzz: [20, 40, 20, 40, 20] },
  drain: { notes: [{ wave: 'sawtooth', from: 330, to: 70, ms: 500, gain: 0.45 }], buzz: 70 },
}

export function feedback(name) {
  const { notes = [], buzz } = EFFECTS[name]
  if (buzz) {
    try {
      navigator.vibrate?.(buzz)
    } catch {
      // Not allowed here: no buzz
    }
  }
  if (!soundOn()) return
  try {
    const ctx = context()
    if (ctx) for (const n of notes) note(ctx, n)
  } catch {
    // No sound on this browser: the game still works
  }
}
