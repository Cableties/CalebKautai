import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <article className="page">
      <h1 className="page-title">This page doesn't exist</h1>
      <p className="lede">Either the link is old, or the aliens took it. Head back home and try from there.</p>
      <Link className="button" to="/" viewTransition>
        Back to home
      </Link>
    </article>
  )
}
