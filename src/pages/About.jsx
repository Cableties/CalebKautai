import { img } from '../content.js'

export default function About() {
  return (
    <article className="page page-split">
      <div className="prose">
        <h1 className="page-title">About</h1>
        <p className="lede">
          Hi! Not much to say here really. In case you haven't guessed, my name is Caleb Kautai.
        </p>
        <p>
          I come from the “City of Greater Bendigo”, studied IT and App Development at Deakin University in
          Melbourne, and now live in Brisbane, where I work as a software engineer.
        </p>
        <p>Throughout my life, I've uncovered two things about myself:</p>
        <ol className="two-things">
          <li>
            I'm pretty okay at creative problem solving. Since this discovery it has become something of a passion
            of mine. Having a set of tools and a problem to solve is where I feel I'm at my best.
          </li>
          <li>
            I love to create things: writing, drawing, video and image editing, animating and programming, you name
            it, I'm into it. Once I have an idea in my head, I will put everything else in my life on hold while I
            churn out some hyper-specific piece of shit that likely no one else will ever see.
          </li>
        </ol>
        <p>
          Keeping these two things in mind, it's easy to see why I've been drawn into the programming side of IT, as
          well as picked up hobbies like Dungeons &amp; Dragons, and making this website that no one will probably
          ever see.
        </p>
      </div>
      <img className="portrait round" {...img('avatar')} alt="Caleb" loading="lazy" />
    </article>
  )
}
