import { CHEATS, KONAMI, useCheats } from '../components/Cheats.jsx'

const ARROWS = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' }

export default function CheatCodes() {
  const { isOn, toggle, reset, active, runKonami } = useCheats()

  return (
    <article className="page cheats">
      <h1 className="page-title">Cheat codes</h1>
      <p className="lede">
        Flip a switch, or type the code anywhere on the site if you've got a keyboard. They stay on until you close
        your browser.
      </p>

      <ul className="cheat-list">
        {CHEATS.filter((c) => !c.hidden).map((cheat) => {
          const on = isOn(cheat.id)
          return (
            <li key={cheat.id} className={on ? 'on' : ''}>
              <div className="cheat-text">
                <h2 id={`cheat-${cheat.id}`}>{cheat.name}</h2>
                <p>{cheat.description}</p>
                <p className="cheat-code">
                  Code: <kbd>{cheat.code}</kbd>
                </p>
              </div>
              <button
                type="button"
                role="switch"
                className="cheat-switch"
                aria-checked={on}
                aria-labelledby={`cheat-${cheat.id}`}
                onClick={() => toggle(cheat.id)}
              >
                <span className="cheat-switch-label" aria-hidden="true">
                  {on ? 'ON' : 'OFF'}
                </span>
              </button>
            </li>
          )
        })}
        <li className="cheat-secret">
          <div className="cheat-text">
            <h2 id="cheat-konami">Konami code</h2>
            <p>The classic. Try it and see.</p>
            <p className="cheat-code">
              Code:{' '}
              <kbd>
                {KONAMI.map((k) => ARROWS[k] ?? k.toUpperCase()).join(' ')}
              </kbd>
            </p>
          </div>
          <button type="button" className="cheat-run" aria-describedby="cheat-konami" onClick={runKonami}>
            Run
          </button>
        </li>
      </ul>

      <button type="button" className="button button-ghost" onClick={reset} disabled={active.length === 0}>
        Turn everything off
      </button>
    </article>
  )
}
