import { img, socials } from '../content.js'

export default function GoodFriend() {
  return (
    <article className="page">
      <p className="selected">You have selected: “a good friend”</p>
      <h1 className="page-title">Hey buddy!</h1>
      <p className="lede">It's me! Caleb! Your best friend… right?</p>
      <img className="friend-gif" {...img('tattooGif')} alt="Caleb waving" />
      <p>It's good to see you! Wanna check out my YouTube channel?</p>
      <ul className="socials">
        {socials.map((s) => (
          <li key={s.name}>
            <a href={s.href} target="_blank" rel="noreferrer">
              {s.name}
            </a>
          </li>
        ))}
      </ul>
    </article>
  )
}
