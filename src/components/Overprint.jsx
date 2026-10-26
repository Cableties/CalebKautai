// Two ink layers printed slightly out of register, like a risograph.
// They drift into near-alignment once on load (skipped for reduced motion).
export default function Overprint({ text, delay = false }) {
  return (
    <span className={'overprint' + (delay ? ' overprint-delay' : '')}>
      <span className="ink ink-blue" aria-hidden="true">{text}</span>
      <span className="ink ink-pink">{text}</span>
    </span>
  )
}
