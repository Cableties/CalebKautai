import { Link } from 'react-router-dom'
import { img } from '../content.js'

const choices = [
  { to: '/tattoo-work-thing', label: 'Work thing' },
  { to: '/tattoo-good-friend', label: 'A good friend' },
  { to: '/tattoo-love-interest', label: 'Love interest' },
]

export default function Tattoo() {
  return (
    <article className="page tattoo">
      <h1 className="page-title">Woah, you actually scanned it!</h1>
      <img className="tattoo-gif" {...img('tattooGif')} alt="Caleb waving" />
      <p className="lede">
        That's so amazing! While I steal your bank information, why not stick around and check out some stuff?
      </p>
      <h2 className="choice-prompt">Which of these best describes you?</h2>
      <div className="choices">
        {choices.map((c) => (
          <Link key={c.to} to={c.to} className="choice" viewTransition>
            {c.label}
          </Link>
        ))}
      </div>
    </article>
  )
}
