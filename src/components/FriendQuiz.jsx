import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { friendQuiz, friendRanks, img } from '../content.js'

// "How good a friend are you really?" on the good friend page. Questions live in content.js.
// The map question pulls in Leaflet only when someone gets that far.
const QuizMap = lazy(() => import('./QuizMap.jsx'))

const shuffle = (list) =>
  list
    .map((item) => [Math.random(), item])
    .sort((a, b) => a[0] - b[0])
    .map(([, item]) => item)

export default function FriendQuiz() {
  const questions = friendQuiz
  const [stage, setStage] = useState('start') // start | playing | done
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [result, setResult] = useState(null) // { correct, detail } once the current one's answered
  const [round, setRound] = useState(0) // bumps on Try again, to reshuffle and reset each question

  const q = questions[index]

  function answer(correct, detail) {
    setResult({ correct, detail })
    if (correct) setScore((s) => s + 1)
  }
  function next() {
    setResult(null)
    if (index + 1 < questions.length) setIndex(index + 1)
    else setStage('done')
  }
  function restart() {
    setIndex(0)
    setScore(0)
    setResult(null)
    setRound((r) => r + 1)
    setStage('playing')
  }

  if (stage === 'start') {
    return (
      <section className="quiz" aria-labelledby="quiz-heading">
        <h2 id="quiz-heading" className="section-title">
          How good a friend are you, really?
        </h2>
        <p>{questions.length} questions. No phoning a friend. (I'm the friend.)</p>
        <button type="button" className="button" onClick={() => setStage('playing')}>
          Start the quiz
        </button>
      </section>
    )
  }

  if (stage === 'done') {
    const rank = friendRanks.filter((r) => score / questions.length >= r.min).at(-1)
    return (
      <section className="quiz quiz-done" aria-labelledby="quiz-heading" aria-live="polite">
        <p className="quiz-score">
          {score}/{questions.length}
        </p>
        <h2 id="quiz-heading" className="section-title">
          {rank.title}
        </h2>
        <p>{rank.text}</p>
        <button type="button" className="button" onClick={restart}>
          Try again
        </button>
      </section>
    )
  }

  return (
    <section className="quiz" aria-labelledby="quiz-heading">
      <div className="quiz-progress" aria-hidden="true">
        <span style={{ width: `${((index + (result ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>
      <p className="quiz-count">
        Question {index + 1} of {questions.length}
      </p>
      <h2 id="quiz-heading" className="quiz-question">
        {q.question}
      </h2>

      <div key={`${round}-${index}`}>
        {q.type === 'choice' && <Choice q={q} answered={result} onAnswer={answer} />}
        {q.type === 'tictactoe' && <TicTacToe answered={result} onAnswer={answer} />}
        {q.type === 'draw' && <Drawing q={q} answered={result} onAnswer={answer} />}
        {q.type === 'map' && (
          <Suspense fallback={<p className="quiz-loading">Loading the map…</p>}>
            <QuizMap q={q} answered={result} onAnswer={answer} />
          </Suspense>
        )}
      </div>

      {result && (
        <div className={'quiz-result ' + (result.correct ? 'right' : 'wrong')} role="status">
          <p>
            <strong>{result.correct ? 'Correct!' : 'Nope.'}</strong> {result.detail} {q.after ?? ''}
          </p>
          <button type="button" className="button" onClick={next} autoFocus>
            {index + 1 < questions.length ? 'Next question' : 'See how you did'}
          </button>
        </div>
      )}
    </section>
  )
}

function Choice({ q, answered, onAnswer }) {
  const options = useMemo(() => shuffle([q.answer, ...q.options]), [q])
  const [picked, setPicked] = useState(null)
  return (
    <>
      <ul className="quiz-options">
        {options.map((option) => (
          <li key={option}>
            <button
              type="button"
              disabled={!!answered}
              className={answered ? (option === q.answer ? 'right' : option === picked ? 'wrong' : '') : ''}
              onClick={() => {
                setPicked(option)
                onAnswer(option === q.answer, option === q.answer ? '' : `It's ${q.answer}.`)
              }}
            >
              {option}
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

// Knots and crosses: you're X and go first. The computer takes a win if it sees one but never
// blocks yours, so it's beatable, as a friend should be.
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]
const winner = (b) => LINES.find(([a, c, d]) => b[a] && b[a] === b[c] && b[a] === b[d])

function TicTacToe({ answered, onAnswer }) {
  const [board, setBoard] = useState(Array(9).fill(null))
  const [thinking, setThinking] = useState(false)
  const line = winner(board)

  function settle(b) {
    const won = winner(b)
    if (won) onAnswer(b[won[0]] === 'X', b[won[0]] === 'X' ? 'You won.' : 'I won. Awkward.')
    else if (b.every(Boolean)) onAnswer(false, "A draw. That's not a win.")
    return Boolean(won) || b.every(Boolean)
  }

  function play(i) {
    if (board[i] || thinking || answered) return
    const b = [...board]
    b[i] = 'X'
    setBoard(b)
    if (settle(b)) return
    setThinking(true)
    setTimeout(() => {
      const empty = b.map((v, j) => (v ? null : j)).filter((j) => j !== null)
      const winning = empty.find((j) => winner(Object.assign([...b], { [j]: 'O' })))
      const move = winning ?? empty[Math.floor(Math.random() * empty.length)]
      const next = [...b]
      next[move] = 'O'
      setBoard(next)
      setThinking(false)
      settle(next)
    }, 350)
  }

  return (
    <div className="ttt" role="grid" aria-label="Knots and crosses board. You are X.">
      {board.map((v, i) => (
        <button
          key={i}
          type="button"
          role="gridcell"
          className={'ttt-cell' + (line?.includes(i) ? ' ttt-line' : '')}
          disabled={!!v || !!answered || thinking}
          aria-label={v ? `${v}` : `Empty square ${i + 1}`}
          onClick={() => play(i)}
        >
          {v === 'X' ? '✕' : v === 'O' ? '◯' : ''}
        </button>
      ))}
    </div>
  )
}

// Draw me: a little canvas with a few colours. Any attempt scores (only a blank one doesn't), and
// the reveal puts their drawing next to the real thing.
const INKS = [
  { name: 'Dark', colour: '#2e2a45' },
  { name: 'Hair brown', colour: '#5a3a24' },
  { name: 'Skin', colour: '#e8b896' },
  { name: 'Pink', colour: '#e0559a' },
  { name: 'Blue', colour: '#3a8fd0' },
]
const BRUSHES = [
  { name: 'Thin', size: 4 },
  { name: 'Thick', size: 12 },
]

function Drawing({ q, answered, onAnswer }) {
  const canvas = useRef(null)
  const strokes = useRef([]) // each: { colour, size, points: [[x, y], …] } in canvas units
  const [ink, setInk] = useState(INKS[0].colour)
  const [brush, setBrush] = useState(BRUSHES[0].size)
  const [count, setCount] = useState(0)
  const [picture, setPicture] = useState(null)
  const SIZE = 600 // drawn at 600×600, shown at whatever fits, so it's sharp on any screen

  function redraw() {
    const ctx = canvas.current.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, SIZE, SIZE)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const s of strokes.current) {
      ctx.strokeStyle = s.colour
      ctx.lineWidth = s.size
      ctx.beginPath()
      s.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
      if (s.points.length === 1) ctx.lineTo(s.points[0][0] + 0.1, s.points[0][1])
      ctx.stroke()
    }
  }
  useEffect(redraw, [])

  const at = (e) => {
    const box = canvas.current.getBoundingClientRect()
    return [((e.clientX - box.left) / box.width) * SIZE, ((e.clientY - box.top) / box.height) * SIZE]
  }
  function down(e) {
    if (answered) return
    canvas.current.setPointerCapture(e.pointerId)
    strokes.current.push({ colour: ink, size: brush * 2, points: [at(e)] })
    redraw()
  }
  function move(e) {
    const stroke = strokes.current.at(-1)
    if (answered || !canvas.current.hasPointerCapture(e.pointerId) || !stroke) return
    stroke.points.push(at(e))
    redraw()
  }
  function up() {
    setCount(strokes.current.length)
  }
  function undo() {
    strokes.current.pop()
    setCount(strokes.current.length)
    redraw()
  }
  function clear() {
    strokes.current = []
    setCount(0)
    redraw()
  }
  function done() {
    if (!strokes.current.length) {
      onAnswer(false, "You didn't draw anything. I'm hurt.")
      return
    }
    setPicture(canvas.current.toDataURL('image/png'))
    onAnswer(true, q.verdicts[Math.floor(Math.random() * q.verdicts.length)])
  }

  if (picture) {
    return (
      <div className="draw-reveal">
        <figure>
          <img src={picture} alt="Your drawing of Caleb" />
          <figcaption>Yours</figcaption>
        </figure>
        <figure>
          <img {...img(q.image)} alt="Caleb" />
          <figcaption>The real thing</figcaption>
        </figure>
      </div>
    )
  }

  return (
    <div className="draw">
      <canvas
        ref={canvas}
        width={SIZE}
        height={SIZE}
        className="draw-canvas"
        aria-label="Drawing canvas"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
      <div className="draw-tools">
        <div className="draw-inks" role="radiogroup" aria-label="Colour">
          {INKS.map((c) => (
            <button
              key={c.colour}
              type="button"
              role="radio"
              aria-checked={ink === c.colour}
              aria-label={c.name}
              className="draw-ink"
              style={{ '--ink-colour': c.colour }}
              onClick={() => setInk(c.colour)}
            />
          ))}
        </div>
        <div className="draw-brushes" role="radiogroup" aria-label="Brush">
          {BRUSHES.map((b) => (
            <button key={b.size} type="button" role="radio" aria-checked={brush === b.size} onClick={() => setBrush(b.size)}>
              {b.name}
            </button>
          ))}
        </div>
        <div className="draw-actions">
          <button type="button" onClick={undo} disabled={!count || !!answered}>
            Undo
          </button>
          <button type="button" onClick={clear} disabled={!count || !!answered}>
            Clear
          </button>
        </div>
      </div>
      {!answered && (
        <button type="button" className="button" onClick={done}>
          Done
        </button>
      )}
    </div>
  )
}
