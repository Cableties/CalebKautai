import { useEffect, useState } from 'react'

// Wide windows (a desktop or laptop) get a wider game than a phone's tall one: an arcade-shaped
// board, about 4 : 3, the same height, so there's more to see either side. Each game picks its board
// when it starts, so turning a tablet round mid-game doesn't change the game in play. False to start
// with, like the prerendered page.
export const WIDE = '(min-width: 900px) and (min-aspect-ratio: 5/4)'
export const WIDE_WIDTH = 840 // × 640: 21 : 16

export default function useWide() {
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const query = matchMedia(WIDE)
    const update = () => setWide(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return wide
}
