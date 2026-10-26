import { createContext, useContext, useEffect, useRef, useState } from 'react'

// One <audio> element for the whole site, owned by Layout, so an episode keeps playing while
// the visitor moves between pages. Pages call usePlayer().play(track) to start something.
const PlayerContext = createContext(null)
export const usePlayer = () => useContext(PlayerContext)

const SKIP = 15

export function PlayerProvider({ children }) {
  const audio = useRef(null)
  const [track, setTrack] = useState(null) // { src, title, artist }
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)

  function play(next) {
    const el = audio.current
    if (next && next.src !== track?.src) {
      setTrack(next)
      setTime(0)
      setDuration(0)
      el.src = next.src
    }
    // play() rejects if the browser blocks it or can't decode the file; the controls just stay paused
    el.play().catch(() => setPlaying(false))
  }
  const pause = () => audio.current.pause()
  const toggle = (next) => (playing && (!next || next.src === track?.src) ? pause() : play(next))
  const seek = (t) => {
    const el = audio.current
    el.currentTime = Math.max(0, Math.min(t, el.duration || t))
  }
  const close = () => {
    const el = audio.current
    el.pause()
    el.removeAttribute('src')
    el.load()
    setTrack(null)
  }

  // Lock-screen and headphone controls on phones
  useEffect(() => {
    if (!track || !('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({ title: track.title, artist: track.artist, album: 'Aliens!' })
    const handlers = {
      play: () => play(),
      pause,
      seekbackward: () => seek(audio.current.currentTime - SKIP),
      seekforward: () => seek(audio.current.currentTime + SKIP),
      seekto: (e) => seek(e.seekTime),
    }
    for (const [action, fn] of Object.entries(handlers)) {
      try {
        navigator.mediaSession.setActionHandler(action, fn)
      } catch {
        // Not every browser supports every action
      }
    }
  }, [track])

  const value = { track, playing, time, duration, play, pause, toggle, seek, close }
  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio
        ref={audio}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      />
    </PlayerContext.Provider>
  )
}

const clock = (s) => {
  if (!Number.isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

// The bar pinned to the bottom of the screen while something is loaded.
export function PlayerBar() {
  const { track, playing, time, duration, toggle, seek, close } = usePlayer()
  if (!track) return null

  return (
    <div className="player" role="region" aria-label="Podcast player">
      <button type="button" className="player-toggle" onClick={() => toggle()} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <div className="player-main">
        <p className="player-title">
          <strong>{track.title}</strong> <span className="muted">{track.artist}</span>
        </p>
        <div className="player-scrub">
          <span className="player-time">{clock(time)}</span>
          <input
            type="range"
            min="0"
            max={duration || 0}
            step="1"
            value={Math.min(time, duration || 0)}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Seek"
            aria-valuetext={`${clock(time)} of ${clock(duration)}`}
            disabled={!duration}
          />
          <span className="player-time">{clock(duration)}</span>
        </div>
      </div>
      <button type="button" className="player-skip" onClick={() => seek(time + SKIP)} aria-label={`Skip ahead ${SKIP} seconds`}>
        +{SKIP}s
      </button>
      <button type="button" className="player-close" onClick={close} aria-label="Close player">
        ×
      </button>
    </div>
  )
}

export const PlayIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
  </svg>
)
export const PauseIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" />
  </svg>
)
