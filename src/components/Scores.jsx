import { useCallback, useEffect, useRef, useState } from 'react'

// Shared by the games: the high-score board, a personal best kept in this browser, and the
// arcade-style initials form once a game ends. Rules for what the server accepts: api/_lib/scores.js.

// Ask for a signed run token as a game starts; it goes back with the score
export function useRun(game) {
  const run = useRef(null)
  const begin = useCallback(() => {
    run.current = null
    fetch('/api/scores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start', game }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => (run.current = data?.run ?? null))
      .catch(() => {})
  }, [game])
  return { run, begin }
}

// The best score in this browser. Returns [best, record(score) → true if it's a new best].
export function useBest(game) {
  const storageKey = `best:${game}`
  const [best, setBest] = useState(0)
  // Also in a ref, so a game loop holding an old `record` still compares against the latest best
  const bestRef = useRef(0)
  useEffect(() => {
    try {
      bestRef.current = Number(localStorage.getItem(storageKey)) || 0
      setBest(bestRef.current)
    } catch {
      // Storage blocked: the best just isn't remembered
    }
  }, [storageKey])
  const record = useCallback(
    (score) => {
      if (score <= bestRef.current) return false
      bestRef.current = score
      setBest(score)
      try {
        localStorage.setItem(storageKey, String(score))
      } catch {
        // As above
      }
      return true
    },
    [storageKey],
  )
  return [best, record]
}

export function ScoreBoard({ game, scores: given }) {
  const [scores, setScores] = useState(null) // null while loading or without the API
  useEffect(() => {
    if (given) return setScores(given)
    fetch(`/api/scores?game=${game}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setScores(data.scores))
      .catch(() => setScores(null))
  }, [game, given])

  if (!scores) return null
  return (
    <section className="scoreboard" aria-labelledby={`${game}-scores`}>
      <h2 id={`${game}-scores`}>High scores</h2>
      {scores.length ? (
        <ol>
          {scores.map((s, i) => (
            <li key={i}>
              <span className="scoreboard-rank">{i + 1}</span>
              <span className="scoreboard-name">{s.initials}</span>
              <span className="scoreboard-score">{s.score}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p>No scores yet. Be the first!</p>
      )}
    </section>
  )
}

// After a game: put a score on the board with three initials. Not for an `easy` one (played with
// the secret Easy Mode cheat on, or another: `cheat` names it), which wouldn't be fair on everyone
// else.
export function ScoreEntry({ game, score, run, easy = false, cheat = 'Easy mode', onSaved }) {
  const [initials, setInitials] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | saved | error
  const [message, setMessage] = useState('')

  async function submit(e) {
    e.preventDefault()
    setStatus('sending')
    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game, initials, score, run: run.current }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "That didn't save. Try again in a bit.")
      setStatus('saved')
      setMessage(body.rank && body.rank <= 10 ? `You're #${body.rank} on the board!` : 'Saved. Not quite top ten, though.')
      onSaved?.(body.scores)
    } catch (err) {
      setStatus('error')
      setMessage(err.message)
    }
  }

  if (easy && score)
    return (
      <p className="score-saved" role="status">
        {cheat} was on, so this one's just for you.
      </p>
    )
  // No run token means the scores API isn't there (local dev, or the database is off)
  if (!score || !run.current) return null
  if (status === 'saved')
    return (
      <p className="score-saved" role="status">
        {message}
      </p>
    )
  return (
    <form className="score-entry" onSubmit={submit}>
      <label>
        <span>Your initials</span>
        <input
          value={initials}
          onChange={(e) => setInitials(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3))}
          maxLength={3}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="AAA"
          required
          pattern="[A-Z0-9]{3}"
        />
      </label>
      <button type="submit" className="button" disabled={initials.length !== 3 || status === 'sending'}>
        {status === 'sending' ? 'Saving…' : 'Save score'}
      </button>
      {status === 'error' && (
        <p className="notice" role="alert">
          {message}
        </p>
      )}
    </form>
  )
}
