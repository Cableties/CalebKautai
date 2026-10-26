import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// The quiz's map question: drag the pin (or tap the map to move it), then lock it in.
// Loaded only when the quiz reaches it (FriendQuiz.jsx), so Leaflet stays out of the main bundle.
const pin = (className) => L.divIcon({ className: 'quiz-pin-wrap', html: `<span class="quiz-pin ${className}"></span>`, iconSize: [28, 36], iconAnchor: [14, 36] })

export default function QuizMap({ q, answered, onAnswer }) {
  const box = useRef(null)
  const map = useRef(null)
  const guess = useRef(null)

  useEffect(() => {
    const view = L.latLngBounds(q.view)
    map.current = L.map(box.current, { minZoom: 2, maxZoom: 9, zoomSnap: 0.5 })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map.current)
    map.current.fitBounds(view)
    // The pin starts in the middle of the starting view
    guess.current = L.marker(view.getCenter(), { draggable: true, icon: pin('guess'), keyboard: true, title: 'Your guess' }).addTo(
      map.current,
    )
    map.current.on('click', (e) => guess.current.setLatLng(e.latlng))
    return () => map.current.remove()
  }, [])

  function lockIn() {
    const km = map.current.distance(guess.current.getLatLng(), [q.place.lat, q.place.lng]) / 1000
    guess.current.dragging.disable()
    map.current.off('click')
    // Show where it really is
    L.marker([q.place.lat, q.place.lng], { icon: pin('answer'), title: q.place.name }).addTo(map.current)
    map.current.fitBounds(L.latLngBounds([guess.current.getLatLng(), [q.place.lat, q.place.lng]]).pad(0.4), { maxZoom: 6 })
    const close = km <= q.withinKm
    onAnswer(close, close ? `${Math.round(km)} km away. Close enough.` : `You were ${Math.round(km).toLocaleString()} km off.`)
  }

  return (
    <div className="quiz-map">
      <div className="quiz-map-box" ref={box} />
      {!answered && (
        <button type="button" className="button" onClick={lockIn}>
          Lock it in
        </button>
      )}
    </div>
  )
}
