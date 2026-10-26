import { useEffect, useState } from 'react'
import { brisbaneBounds } from '../content.js'

function randomSpot({ south, north, west, east }) {
  return {
    lat: south + Math.random() * (north - south),
    lng: west + Math.random() * (east - west),
  }
}

export default function FindMe() {
  // Picked after mount, not during render, so the prerendered HTML doesn't bake in one spot.
  const [location, setLocation] = useState(null)
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    setLocation(randomSpot(brisbaneBounds))
    const id = setInterval(() => setSeconds((s) => (s >= 4 ? 0 : s + 1)), 1000)
    return () => clearInterval(id)
  }, [])

  if (!location) {
    return (
      <article className="page tracker">
        <h1 className="page-title">Real-time tracking of Caleb Kautai</h1>
        <p className="tracker-status">
          <span className="live-dot" aria-hidden="true" /> Acquiring signal…
        </p>
      </article>
    )
  }

  return (
    <article className="page tracker">
      <h1 className="page-title">Real-time tracking of Caleb Kautai</h1>
      <p className="tracker-status">
        <span className="live-dot" aria-hidden="true" /> Signal acquired, last ping {seconds}s ago
      </p>
      <dl className="coords">
        <div>
          <dt>Latitude</dt>
          <dd>{location.lat.toFixed(6)}</dd>
        </div>
        <div>
          <dt>Longitude</dt>
          <dd>{location.lng.toFixed(6)}</dd>
        </div>
      </dl>
      <div className="map">
        <iframe
          title="Map of Caleb's current location"
          src={`https://www.google.com/maps?q=${location.lat},${location.lng}&z=15&output=embed`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
      <p className="muted">Accuracy within a few metres. Probably.</p>
    </article>
  )
}
