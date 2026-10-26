import BouncingHead from '../components/BouncingHead.jsx'
import { useCheats } from '../components/Cheats.jsx'
import FriendQuiz from '../components/FriendQuiz.jsx'
import { img, socials } from '../content.js'

export default function GoodFriend() {
  // With Head Mode on, the site-wide head is already bouncing around
  const headMode = useCheats().isOn('head')
  return (
    <article className="page">
      {!headMode && <BouncingHead />}
      <p className="selected">You have selected: “a good friend”</p>
      <h1 className="page-title">Hey buddy!</h1>
      <p className="lede">It's me! Caleb! Your best friend… right?</p>
      <img className="friend-gif" {...img('tattooGif')} alt="Caleb waving" />
      <FriendQuiz />
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
