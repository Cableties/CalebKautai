import { useEffect, useRef, useState } from 'react'
import { img, relationship } from '../content.js'

// Love interest page: a popup over the page saying I'm taken. Closing it (×, the button, Escape,
// or tapping outside) leaves the page exactly as it was. It's in the prerendered HTML so it's
// there from the first moment; index.html hides it if JavaScript is off, since closing needs it.
export default function Taken() {
  const [open, setOpen] = useState(true)
  const closeButton = useRef(null)
  const photos = relationship.photos

  useEffect(() => {
    if (!open) return
    closeButton.current?.focus()
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.documentElement.classList.add('no-scroll')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.documentElement.classList.remove('no-scroll')
    }
  }, [open])

  if (!open) return null
  const close = () => setOpen(false)

  return (
    <div
      className="taken"
      role="dialog"
      aria-modal="true"
      aria-labelledby="taken-title"
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div className="taken-card">
        <button type="button" className="taken-close" aria-label="Close" ref={closeButton} onClick={close}>
          ×
        </button>
        <p className="taken-heart" aria-hidden="true">
          💔
        </p>
        <h2 id="taken-title">I hate to break your heart but...</h2>
        <p>I am currently in a loving relationship{photos.length > 0 && ' (see photos below)'}</p>
        {photos.length > 0 && (
          <ul className="taken-photos">
            {photos.map((key, i) => (
              <li key={key} style={{ '--tilt': `${[-4, 3, -2, 4][i % 4]}deg` }}>
                <img {...img(key)} alt="" />
              </li>
            ))}
          </ul>
        )}
        <p>
          If you would still like to see the perks of dating me, feel free to exit off of this popup. But I'm afraid
          that I'm currently not taking applications xx
        </p>
        <button type="button" className="button" onClick={close}>
          Show me the perks anyway
        </button>
      </div>
    </div>
  )
}
