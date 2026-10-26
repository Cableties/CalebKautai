import { useState } from 'react'
import { Link } from 'react-router-dom'
import { contact, githubProfile, img, projects, skills, testimonial } from '../content.js'

// Shown at /work, and at /tattoo-work-thing (with the banner) for people arriving from the tattoo.
export default function WorkThing({ fromTattoo = false }) {
  return (
    <article className="page work">
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
            identity platform replacement project, migrating services to on-prem ForgeRock.
          </p>
          <p>If you feel like giving me some money… let's get in touch!</p>
          <ContactActions />
        </div>
        <img className="portrait" {...img('workPhoto')} alt="Caleb" loading="lazy" />
      </div>

      <section aria-labelledby="projects-heading">
        <h2 id="projects-heading" className="section-title">
          Selected work
        </h2>
        <ul className="projects">
          {projects.map((p) => (
            <li key={p.name} className="project">
              {p.image && <img {...img(p.image)} alt="" loading="lazy" />}
              <div className="project-body">
                <p className="project-context">{p.context}</p>
                <h3>{p.name}</h3>
                <p>{p.summary}</p>
                <ul className="project-points">
                  {p.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
                <ul className="tags" aria-label="Skills used">
                  {p.tags.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                {p.link && (
                  <a className="project-link" href={p.link} target="_blank" rel="noreferrer">
                    {p.link.includes('github.com')
                      ? 'View on GitHub'
                      : `Visit ${p.link.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}`}{' '}
                    ↗
                  </a>
                )}
                {p.to && (
                  <Link className="project-link" to={p.to} viewTransition>
                    Have a listen →
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
        <p className="more-work">
          <a href={githubProfile} target="_blank" rel="noreferrer">
            More on GitHub ↗
          </a>
        </p>
      </section>

      <section aria-labelledby="skills-heading">
        <h2 id="skills-heading" className="section-title">
          Skills
        </h2>
        <div className="skills">
          {skills.map((s) => (
            <div key={s.group}>
              <h3>{s.group}</h3>
              <ul className="tags">
                {s.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <figure className="quote">
          <blockquote>“{testimonial.quote}”</blockquote>
          <figcaption>{testimonial.author}, a satisfied customer</figcaption>
        </figure>
      </section>

      <section className="contact-card" aria-labelledby="contact-heading">
        <h2 id="contact-heading" className="section-title">
          Get in touch
        </h2>
        <ContactActions />
      </section>
    </article>
  )
}

function ContactActions() {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(contact.email)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked: fall back to opening the email app
      location.href = `mailto:${contact.email}`
    }
  }

  return (
    <div className="contact-actions">
      <a className="button" href={`mailto:${contact.email}`}>
        Email me
      </a>
      <button type="button" className="button button-ghost" onClick={copy}>
        {copied ? 'Copied!' : 'Copy email'}
      </button>
      <a className="button button-ghost" href={contact.linkedin} target="_blank" rel="noreferrer">
        LinkedIn
      </a>
      <span className="visually-hidden" role="status">
        {copied ? 'Email address copied' : ''}
      </span>
    </div>
  )
}
