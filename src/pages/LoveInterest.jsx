import { useState } from 'react'
import { contact, img } from '../content.js'

const fields = [
  { name: 'firstName', label: 'First name', type: 'text', autoComplete: 'given-name' },
  { name: 'lastName', label: 'Last name', type: 'text', autoComplete: 'family-name' },
  { name: 'dob', label: 'Date of birth', type: 'date', autoComplete: 'bday' },
  { name: 'phone', label: 'Phone', type: 'tel', autoComplete: 'tel' },
  { name: 'startDate', label: 'Available start date', type: 'date' },
  { name: 'position', label: 'Position applying for', type: 'text' },
]

export default function LoveInterest() {
  // idle → sending → sent | error with Formspree; idle → mailto without it
  const [status, setStatus] = useState('idle')

  async function submit(e) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)

    if (!contact.formEndpoint) {
      // No form service set up: hand the application to the visitor's email app instead.
      const body = fields.map((f) => `${f.label}: ${data.get(f.name) || '—'}`).join('\n')
      window.location.href = `mailto:${contact.email}?subject=${encodeURIComponent(
        'Official application',
      )}&body=${encodeURIComponent(body)}`
      setStatus('mailto')
      return
    }

    setStatus('sending')
    try {
      const res = await fetch(contact.formEndpoint, {
        method: 'POST',
        body: data,
        headers: { Accept: 'application/json' },
      })
      setStatus(res.ok ? 'sent' : 'error')
    } catch {
      setStatus('error')
    }
  }

  return (
    <article className="page love">
      <p className="selected">Ooh la la! You have selected: “love interest”</p>
      <h1 className="page-title">Hey! My name's Caleb Kautai!</h1>
      <p className="lede">I'm a software engineer living in Brisbane, Australia.</p>

      <h2 className="section-title">Things I have going for me</h2>

      <section className="perk">
        <img {...img('car')} alt="Caleb's 2007 Hyundai Tucson" loading="lazy" />
        <div>
          <h3>I have a car</h3>
          <p>Jump into my 2007 Hyundai Tucson and let me drive my way into your heart.</p>
        </div>
      </section>

      <section className="perk perk-flip">
        <img {...img('linkedinShot')} alt="Caleb's LinkedIn profile" loading="lazy" />
        <div>
          <h3>I am employed</h3>
          <p>As the saying goes… “Mo money, mo nice expensive dinners.” At least that's how I remember it.</p>
          <p>In any case, I'm a very professional and responsible software engineer boy.</p>
        </div>
      </section>

      <section className="perk">
        <div className="perk-pair">
          <img {...img('cutie1')} alt="Caleb" loading="lazy" />
          <img {...img('cutie2')} alt="Caleb, again" loading="lazy" />
        </div>
        <div>
          <h3>I'm a cutie</h3>
          <p>Buddy… I do it all! Funny jokes, little brunches, thoughtful gifts!</p>
          <p>If you find a tiny little guy better than me, I'll kill him.</p>
        </div>
      </section>

      <section className="application" aria-labelledby="apply-heading">
        <h2 id="apply-heading" className="section-title">Official application</h2>
        <p>Please complete the form to apply for a position.</p>
        {status === 'sent' && (
          <p className="notice" role="status">
            Application received. Await further instructions.
          </p>
        )}
        {status === 'mailto' && (
          <p className="notice" role="status">
            Your email app should have opened with your application. Hit send and await further instructions. If
            nothing opened, email it to <a href={`mailto:${contact.email}`}>{contact.email}</a>.
          </p>
        )}
        {status === 'error' && (
          <p className="notice" role="alert">
            That didn't send. Try again, or email it to <a href={`mailto:${contact.email}`}>{contact.email}</a>.
          </p>
        )}
        {status !== 'sent' && status !== 'mailto' && (
          <form onSubmit={submit} className="form">
            {fields.map((f) => (
              <label key={f.name}>
                <span>{f.label}</span>
                <input name={f.name} type={f.type} autoComplete={f.autoComplete} required={f.name === 'firstName'} />
              </label>
            ))}
            <button type="submit" className="button" disabled={status === 'sending'}>
              {status === 'sending' ? 'Sending…' : 'Submit application'}
            </button>
          </form>
        )}
      </section>
    </article>
  )
}
