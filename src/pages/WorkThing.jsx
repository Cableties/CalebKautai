import { alchemy, contact, img } from '../content.js'

// Shown at /work, and at /tattoo-work-thing (with the banner) for people arriving from the tattoo.
export default function WorkThing({ fromTattoo = false }) {
  return (
    <article className="page">
      {fromTattoo && <p className="selected">You have selected: “work thing”</p>}
      <div className="page-split">
        <div className="prose">
          <h1 className="page-title">Hey! My name is Caleb Kautai.</h1>
          <p className="lede">
            I have a degree in Information Technology, with a focus in Application Development, from Deakin
            University.
          </p>
          <p>
            I currently work at Suncorp Bank, a subsidiary of ANZ, as a ForgeRock developer. I'm working on an
            identity platform replacement project, migrating services to on-prem ForgeRock, including FR Identity
            Gateway, FR Identity Manager, FR Directory Services and FR Access Manager (including integrating custom
            Java extensions).
          </p>
          <p>
            I've dabbled in plenty of other languages: Python, JavaScript, Kotlin. I'm not an expert, but I can hold
            my own when needed.
          </p>
          <p>
            I've worked as a web developer! I was the sole developer for{' '}
            <a href={alchemy.href} target="_blank" rel="noreferrer">
              Masters of Alchemy
            </a>
            , Melbourne's premier D&amp;D dungeon master hiring service, and built the site that's still being used
            today.
          </p>
          <p>
            And I'm passionate about graphic design: photo editing, animation, video editing, VFX and audio editing.
            I've experience across the complete Adobe Suite, and am confident enough in my abilities to never shy
            away from a project.
          </p>
          <p>If you feel like giving me some money… let's get in touch!</p>
        </div>
        <img className="portrait" {...img('workPhoto')} alt="Caleb" loading="lazy" />
      </div>

      <section className="contact-card" aria-labelledby="contact-heading">
        <h2 id="contact-heading" className="section-title">Get in touch</h2>
        <ul>
          <li>
            <a href={`mailto:${contact.email}`}>{contact.email}</a>
          </li>
          <li>
            <a href={contact.linkedin} target="_blank" rel="noreferrer">
              LinkedIn
            </a>
          </li>
        </ul>
      </section>
    </article>
  )
}
