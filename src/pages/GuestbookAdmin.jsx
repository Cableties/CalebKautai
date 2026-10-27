import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Doodle } from '../components/DoodlePad.jsx'

// Approving guestbook entries from a phone. Opened from the notification email: a "Review it" link
// (?id=…&sig=…) shows one entry, "See everything waiting" (?key=…) shows them all. The signature or
// key goes along with every request; api/moderate.js checks it.
const day = (iso) => new Date(iso).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

function Entry({ entry, auth, initialState }) {
  const [state, setState] = useState(initialState) // pending | published | deleted
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function act(action) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id: entry.id, ...auth }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "That didn't work. Try again.")
      setState(body.state)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className={`admin-entry admin-${state}`}>
      <p className="admin-head">
        <strong>{entry.name}</strong>
        {entry.rating > 0 && (
          <span className="stars" role="img" aria-label={`${entry.rating} out of 5 stars`}>
            {'★'.repeat(entry.rating)}
          </span>
        )}
        <span className="admin-date">{day(entry.createdAt)}</span>
      </p>
      {entry.doodle?.length > 0 && <Doodle strokes={entry.doodle} label={`Doodle by ${entry.name}`} />}
      {entry.comment && <p className="admin-comment">{entry.comment}</p>}
      {state === 'pending' ? (
        <div className="admin-actions">
          <button type="button" className="button" disabled={busy} onClick={() => act('approve')}>
            Approve
          </button>
          <button type="button" className="admin-delete" disabled={busy} onClick={() => act('delete')}>
            Delete
          </button>
        </div>
      ) : (
        <p className="admin-state" role="status">
          {state === 'published' ? '✓ Approved. It’s on the tattoo page.' : 'Deleted.'}
          {state === 'published' && (
            <button type="button" className="admin-delete" disabled={busy} onClick={() => act('delete')}>
              Delete it after all
            </button>
          )}
        </p>
      )}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
    </li>
  )
}

export default function GuestbookAdmin() {
  const [params] = useSearchParams()
  const [id, sig, key] = ['id', 'sig', 'key'].map((k) => params.get(k))
  const auth = key ? { key } : { sig }
  const [data, setData] = useState(null) // { entries: [{ entry, state }] } once loaded
  const [error, setError] = useState('')
  // The prerendered page has no link details, so it reads them only once it's running in the browser
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(true)
    if (!(id && sig) && !key) return
    const query = key ? `key=${encodeURIComponent(key)}` : `id=${encodeURIComponent(id)}&sig=${encodeURIComponent(sig)}`
    fetch(`/api/moderate?${query}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error || "Couldn't load that. Try again in a bit.")
        setData(key && !id ? { entries: body.entries.map((entry) => ({ entry, state: 'pending' })) } : { entries: [body] })
      })
      .catch((err) => setError(err.message))
  }, [id, sig, key])

  return (
    <article className="page guestbook-admin">
      <meta name="robots" content="noindex" />
      <h1 className="page-title">Guestbook</h1>
      {!ready ? (
        <p className="lede">Loading…</p>
      ) : !(id && sig) && !key ? (
        <p className="lede">Open this page from a guestbook email.</p>
      ) : error ? (
        <p className="notice" role="alert">
          {error}
        </p>
      ) : !data ? (
        <p className="lede">Loading…</p>
      ) : (
        <>
          <p className="lede">
            {key && !id
              ? data.entries.length
                ? `${data.entries.length} waiting for approval.`
                : 'Nothing waiting. All caught up!'
              : 'Someone signed the guestbook.'}
          </p>
          <ul className="admin-list">
            {data.entries.map(({ entry, state }) => (
              <Entry key={entry.id} entry={entry} auth={auth} initialState={state} />
            ))}
          </ul>
        </>
      )}
    </article>
  )
}
