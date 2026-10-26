import { useMemo, useState } from 'react'
import { alienIdentifiers, interviews } from '../content.js'

const unique = (key) => [...new Set(interviews.map((i) => i[key]))].sort()

export default function Aliens() {
  const [guest, setGuest] = useState('')
  const [suspect, setSuspect] = useState('')

  const shown = interviews.filter((i) => (!guest || i.guest === guest) && (!suspect || i.suspect === suspect))

  const tally = useMemo(() => {
    const counts = {}
    interviews.forEach((i) => (counts[i.suspect] = (counts[i.suspect] || 0) + 1))
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [])
  const max = tally[0][1]
  // Until any recordings are uploaded, show the verdicts on their own rather than a column of empty players.
  const hasAudio = interviews.some((i) => i.audio)

  return (
    <article className="page aliens">
      <h1 className="page-title">Aliens!</h1>
      <p className="lede">
        One question, asked of everyone: who here is secretly an alien? {interviews.length} interviews and counting.
      </p>

      <section aria-labelledby="tally-heading" className="tally">
        <h2 id="tally-heading" className="section-title">Most suspected</h2>
        <ol>
          {tally.map(([name, n]) => (
            <li key={name}>
              <button
                type="button"
                className={suspect === name ? 'active' : ''}
                onClick={() => setSuspect(suspect === name ? '' : name)}
                aria-pressed={suspect === name}
              >
                <span className="tally-name">{name}</span>
                <span className="tally-bar" style={{ '--w': `${(n / max) * 100}%` }} />
                <span className="tally-n">{n}</span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="interviews-heading">
        <h2 id="interviews-heading" className="section-title">Interviews</h2>
        <div className="filters">
          <label>
            <span>Interviewee</span>
            <select value={guest} onChange={(e) => setGuest(e.target.value)}>
              <option value="">Everyone</option>
              {unique('guest').map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Suspected alien</span>
            <select value={suspect} onChange={(e) => setSuspect(e.target.value)}>
              <option value="">Anyone</option>
              {unique('suspect').map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>

        {!hasAudio && (
          <p className="notice">The recordings are being moved to the new site. The verdicts are in, though.</p>
        )}
        {shown.length === 0 ? (
          <p className="notice">Nobody has accused anyone matching both filters. Yet.</p>
        ) : (
          <ul className={'interviews' + (hasAudio ? '' : ' no-audio')}>
            {shown.map((i) => (
              <li key={i.guest + i.suspect}>
                <div className="interview-who">
                  <span className="interview-guest">{i.guest}</span>
                  <span className="interview-accuses">
                    suspects <strong>{i.suspect}</strong>
                  </span>
                </div>
                {hasAudio &&
                  (i.audio ? (
                    <audio controls preload="none" src={i.audio} />
                  ) : (
                    <span className="muted">Audio coming soon</span>
                  ))}
                <span className="interview-length">{i.length}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="ids-heading">
        <h2 id="ids-heading" className="section-title">Alien identifiers</h2>
        <div className="prose">
          <p>
            The following traits are agreed upon by alien enthusiasts to indicate a high likelihood that an
            individual is an alien disguised as a human.
          </p>
          <p>
            While these traits can sometimes be found in eccentric geniuses, highly analytical thinkers, or general
            weirdos, I think the more likely answer is that they're an alien.
          </p>
        </div>
        <dl className="identifiers">
          {alienIdentifiers.map(([term, desc]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{desc}</dd>
            </div>
          ))}
        </dl>
      </section>
    </article>
  )
}
