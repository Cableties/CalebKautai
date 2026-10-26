import { Link } from 'react-router-dom'

export default function Placeholder({ title, blurb }) {
  return (
    <article className="page">
      <h1 className="page-title">{title}</h1>
      <p className="lede">{blurb}</p>
      <Link className="button" to="/aliens" viewTransition>
        Go to the alien podcast
      </Link>
    </article>
  )
}
