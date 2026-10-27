import { useEffect, useMemo, useRef, useState } from "react";
import {
	MAX_OPTIONS,
	MAX_WEIGHT,
	landing,
	pick,
	sliceAt,
	slices,
} from "../lib/wheel.js";

// Decision wheel: type in the options, weight them, and hit SPIN. The wheel takes over the screen,
// ticks past each slice, and lands on a winner picked by weight (maths in lib/wheel.js).
// The question and options are remembered in this browser for next time.
const STORAGE_KEY = "decision-wheel";
const COLOURS = 8; // wheel slice colours, --wheel-0 … --wheel-7 in styles.css
const SPIN_MS = 6000;
const SPIN_MS_REDUCED = 1500;

// Quick presets. The first is the default. An option with an empty label is a blank spot to fill in
// (shown with its `placeholder`); blanks don't go on the wheel until they have a name.
export const PRESETS = [
	{
		name: "Yes / No",
		question: "Should I?",
		options: [
			{ label: "Yes", weight: 1 },
			{ label: "No", weight: 1 },
		],
	},
	{
		name: "Food",
		question: "Where should we eat?",
		options: [
			{ label: "Pizza", weight: 5 },
			{ label: "Sushi", weight: 5 },
			{ label: "Tacos", weight: 5 },
			{ label: "Burgers", weight: 5 },
			{ label: "Fried Chicken", weight: 5 },
			{ label: "Cook", weight: 1 },
		],
	},
	{
		name: "Book club",
		question: "Book club: what are we reading?",
		options: [1, 2, 3, 4, 5].map((n) => ({
			label: "",
			weight: 1,
			placeholder: `Book ${n}`,
		})),
	},
];
const STARTER = PRESETS[0];

let nextId = 1;
const withIds = (options) => options.map((o) => ({ ...o, id: nextId++ }));
// Neighbouring slices never share a colour, even where the wheel wraps round
const colourOf = (i, count) =>
	count % COLOURS === 1 && i === count - 1 ? 3 : i % COLOURS;

export default function DecisionWheel() {
	const [question, setQuestion] = useState(STARTER.question);
	const [options, setOptions] = useState(() => withIds(STARTER.options));
	const [spinning, setSpinning] = useState(false); // the full-screen stage is open
	const loaded = useRef(false);

	// Saved options load after mount, so the prerendered page matches the first render
	useEffect(() => {
		try {
			const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
			if (saved?.options?.length) {
				setQuestion(saved.question ?? "");
				setOptions(withIds(saved.options));
			}
		} catch {
			// Nothing saved, or storage blocked
		}
		loaded.current = true;
	}, []);
	useEffect(() => {
		if (!loaded.current) return;
		try {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({
					question,
					options: options.map(({ label, weight, placeholder }) => ({
						label,
						weight,
						placeholder,
					})),
				}),
			);
		} catch {
			// Storage blocked: it just won't be remembered
		}
	}, [question, options]);

	const ready = options.filter((o) => o.label.trim());
	const wheel = useMemo(
		() => slices(ready.length ? ready : [{ label: "", weight: 1 }]),
		[options],
	);
	const usePreset = (preset) => {
		setQuestion(preset.question);
		setOptions(withIds(preset.options));
	};
	const update = (id, change) =>
		setOptions((all) =>
			all.map((o) => (o.id === id ? { ...o, ...change } : o)),
		);
	const weigh = (id, by) =>
		setOptions((all) =>
			all.map((o) =>
				o.id === id
					? { ...o, weight: Math.min(MAX_WEIGHT, Math.max(1, o.weight + by)) }
					: o,
			),
		);

	return (
		<article className="page wheel-page">
			<h1 className="page-title">Decision wheel</h1>
			<p className="lede">
				Can't decide? Put the options in, weight the ones you're leaning
				towards, and let the wheel choose.
			</p>

			<div className="wheel-builder">
				<div className="wheel-editor">
					<div className="wheel-presets" role="group" aria-label="Presets">
						<span>Quick start:</span>
						{PRESETS.map((preset) => (
							<button
								key={preset.name}
								type="button"
								onClick={() => usePreset(preset)}
							>
								{preset.name}
							</button>
						))}
					</div>

					<label className="wheel-question">
						<span>What are we deciding?</span>
						<input
							value={question}
							maxLength={60}
							placeholder="Where should we eat?"
							onChange={(e) => setQuestion(e.target.value)}
						/>
					</label>

					<ol className="wheel-options">
						{options.map((o, i) => {
							const share = wheel.find((s) => s.id === o.id)?.chance;
							return (
								<li key={o.id}>
									<span
										className="wheel-swatch"
										style={{
											background: `var(--wheel-${colourOf(ready.indexOf(o), ready.length)})`,
										}}
										aria-hidden="true"
									/>
									<input
										aria-label={`Option ${i + 1}`}
										value={o.label}
										maxLength={40}
										placeholder={o.placeholder ?? `Option ${i + 1}`}
										onChange={(e) => update(o.id, { label: e.target.value })}
									/>
									<span
										className="wheel-weight"
										role="group"
										aria-label={`Weight for ${o.label || `option ${i + 1}`}`}
									>
										<button
											type="button"
											aria-label="Less likely"
											onClick={() => weigh(o.id, -1)}
											disabled={o.weight <= 1}
										>
											−
										</button>
										<output aria-label="Weight">{o.weight}</output>
										<button
											type="button"
											aria-label="More likely"
											onClick={() => weigh(o.id, 1)}
											disabled={o.weight >= MAX_WEIGHT}
										>
											+
										</button>
									</span>
									<span className="wheel-chance">
										{share ? `${Math.round(share * 100)}%` : "–"}
									</span>
									<button
										type="button"
										className="wheel-remove"
										aria-label={`Remove ${o.label || `option ${i + 1}`}`}
										onClick={() =>
											setOptions((all) => all.filter((x) => x.id !== o.id))
										}
									>
										×
									</button>
								</li>
							);
						})}
					</ol>
					<div className="wheel-editor-actions">
						<button
							type="button"
							className="button button-ghost"
							disabled={options.length >= MAX_OPTIONS}
							onClick={() =>
								setOptions((all) => [
									...all,
									...withIds([{ label: "", weight: 1 }]),
								])
							}
						>
							+ Add an option
						</button>
						<button
							type="button"
							className="wheel-reset"
							onClick={() => usePreset(STARTER)}
						>
							Start over
						</button>
					</div>
				</div>

				<div className="wheel-preview">
					<Wheel wheel={wheel} rotation={0} />
					<button
						type="button"
						className="wheel-spin"
						disabled={ready.length < 2}
						onClick={() => setSpinning(true)}
					>
						SPIN
					</button>
					{ready.length < 2 && (
						<p className="wheel-hint">Add at least two options to spin.</p>
					)}
				</div>
			</div>

			{spinning && (
				<Stage
					question={question}
					options={ready}
					onRemove={(id) => setOptions((all) => all.filter((o) => o.id !== id))}
					onClose={() => setSpinning(false)}
				/>
			)}
		</article>
	);
}

// The wheel itself, as SVG: one slice per option, labels running out from the middle
function Wheel({ wheel, rotation, spinMs = 0, turning, onStop }) {
	const count = wheel.length;
	const point = (angle, r) => [
		Math.sin((angle * Math.PI) / 180) * r,
		-Math.cos((angle * Math.PI) / 180) * r,
	];
	const size = count > 12 ? 7 : count > 7 ? 9 : 11;
	return (
		<svg
			className="wheel"
			viewBox="-110 -110 220 220"
			role="img"
			aria-label={`Wheel with ${count} options`}
		>
			<g
				ref={turning}
				className="wheel-turn"
				style={{
					transform: `rotate(${rotation}deg)`,
					transitionDuration: `${spinMs}ms`,
				}}
				onTransitionEnd={onStop}
			>
				{wheel.map((s, i) => {
					const [x1, y1] = point(s.start, 100);
					const [x2, y2] = point(s.end, 100);
					const large = s.end - s.start > 180 ? 1 : 0;
					const mid = (s.start + s.end) / 2;
					const label =
						s.label.length > 16 ? s.label.slice(0, 15) + "…" : s.label;
					return (
						<g key={s.id ?? i}>
							{count === 1 ? (
								<circle
									r="100"
									style={{ fill: `var(--wheel-${colourOf(i, count)})` }}
								/>
							) : (
								<path
									d={`M0 0 L${x1} ${y1} A100 100 0 ${large} 1 ${x2} ${y2} Z`}
									style={{ fill: `var(--wheel-${colourOf(i, count)})` }}
								/>
							)}
							<text
								// Labels run along the slice; any that will end up on the left half once the wheel stops are
								// turned round so they don't read upside down
								transform={`rotate(${mid}) translate(0 -58) rotate(${(((mid + rotation) % 360) + 360) % 360 > 180 ? 90 : -90})`}
								textAnchor="middle"
								dominantBaseline="middle"
								fontSize={size}
							>
								{label}
							</text>
						</g>
					);
				})}
			</g>
			<circle className="wheel-rim" r="101" />
			<circle className="wheel-hub" r="12" />
		</svg>
	);
}

// The full-screen spin. It starts spinning as soon as it opens.
function Stage({ question, options, onRemove, onClose }) {
	const wheel = useMemo(() => slices(options), [options]);
	const [rotation, setRotation] = useState(0);
	const [result, setResult] = useState(null);
	const [muted, setMuted] = useState(() => {
		try {
			return localStorage.getItem("wheel-muted") === "1";
		} catch {
			return false;
		}
	});
	// Read by the tick sound mid-spin, so muting takes effect straight away
	const mutedNow = useRef(muted);
	mutedNow.current = muted;
	const turning = useRef(null);
	const pointer = useRef(null);
	const audio = useRef(null);
	const winner = useRef(null);
	const reduced =
		typeof matchMedia !== "undefined" &&
		matchMedia("(prefers-reduced-motion: reduce)").matches;
	const spinMs = reduced ? SPIN_MS_REDUCED : SPIN_MS;

	function spin() {
		setResult(null);
		winner.current = pick(options);
		setRotation((r) => landing(wheel, winner.current, r));
	}

	// Spin straight away, and again whenever the options change (after "Remove it & spin again")
	useEffect(() => {
		const id = requestAnimationFrame(spin);
		return () => cancelAnimationFrame(id);
	}, [wheel]);

	// While it turns: tick and flick the pointer each time a slice goes past
	useEffect(() => {
		if (result || !rotation) return;
		let frame;
		let last = null;
		function watch() {
			const m = new DOMMatrix(getComputedStyle(turning.current).transform);
			const at = sliceAt(wheel, (Math.atan2(m.b, m.a) * 180) / Math.PI);
			if (last !== null && at !== last) {
				tick();
				pointer.current?.animate(
					[{ rotate: "0deg" }, { rotate: "-18deg" }, { rotate: "0deg" }],
					{ duration: 120 },
				);
			}
			last = at;
			frame = requestAnimationFrame(watch);
		}
		frame = requestAnimationFrame(watch);
		return () => cancelAnimationFrame(frame);
	}, [rotation, result]);

	function tick() {
		if (mutedNow.current) return;
		try {
			audio.current ??= new AudioContext();
			const ctx = audio.current;
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = "square";
			osc.frequency.value = 1700;
			gain.gain.setValueAtTime(0.05, ctx.currentTime);
			gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.035);
			osc.connect(gain).connect(ctx.destination);
			osc.start();
			osc.stop(ctx.currentTime + 0.04);
		} catch {
			// No sound available: the pointer still flicks
		}
	}

	function toggleMute() {
		setMuted((m) => {
			try {
				localStorage.setItem("wheel-muted", m ? "0" : "1");
			} catch {
				// Not remembered
			}
			return !m;
		});
	}

	useEffect(() => {
		const onKey = (e) => e.key === "Escape" && onClose();
		document.addEventListener("keydown", onKey);
		document.documentElement.classList.add("no-scroll");
		return () => {
			document.removeEventListener("keydown", onKey);
			document.documentElement.classList.remove("no-scroll");
		};
	}, []);

	const won = result !== null ? options[result] : null;

	return (
		<div
			className="wheel-stage"
			role="dialog"
			aria-modal="true"
			aria-label={question || "Decision wheel"}
		>
			<div className="wheel-stage-top">
				<button
					type="button"
					className="wheel-mute"
					onClick={toggleMute}
					aria-pressed={muted}
					aria-label="Mute ticks"
				>
					{muted ? "🔇" : "🔊"}
				</button>
				<button
					type="button"
					className="wheel-close"
					onClick={onClose}
					aria-label="Close"
				>
					×
				</button>
			</div>
			{question && <h2 className="wheel-stage-question">{question}</h2>}

			{/* The cell fills the space between question and result; the wheel inside is the biggest
			    square that fits it */}
			<div className="wheel-stage-cell">
				<div className="wheel-stage-wheel">
					<span className="wheel-pointer" ref={pointer} aria-hidden="true" />
					<Wheel
						wheel={wheel}
						rotation={rotation}
						spinMs={spinMs}
						turning={turning}
						onStop={(e) =>
							e.target === turning.current && setResult(winner.current)
						}
					/>
				</div>
			</div>

			<div className="wheel-result" aria-live="polite">
				{won ? (
					<>
						<p className="wheel-winner">{won.label}</p>
						{!reduced && <Confetti />}
						<div className="wheel-result-actions">
							<button type="button" className="button" onClick={spin}>
								Spin again
							</button>
							{options.length > 2 && (
								<button
									type="button"
									className="button button-ghost"
									onClick={() => onRemove(won.id)}
								>
									Remove it & spin again
								</button>
							)}
							<button
								type="button"
								className="button button-ghost"
								onClick={onClose}
							>
								Edit options
							</button>
						</div>
					</>
				) : (
					<p className="wheel-spinning">Spinning…</p>
				)}
			</div>
		</div>
	);
}

// A burst of confetti for the winner
function Confetti() {
	const pieces = useMemo(
		() =>
			Array.from({ length: 70 }, (_, i) => ({
				left: Math.random() * 100,
				delay: Math.random() * 0.35,
				drift: (Math.random() * 2 - 1) * 120,
				spin: (Math.random() * 2 - 1) * 720,
				colour: i % COLOURS,
				size: 6 + Math.random() * 6,
			})),
		[],
	);
	return (
		<div className="confetti" aria-hidden="true">
			{pieces.map((p, i) => (
				<span
					key={i}
					style={{
						left: `${p.left}%`,
						width: `${p.size}px`,
						height: `${p.size * 0.5}px`,
						background: `var(--wheel-${p.colour})`,
						animationDelay: `${p.delay}s`,
						"--drift": `${p.drift}px`,
						"--spin": `${p.spin}deg`,
					}}
				/>
			))}
		</div>
	);
}
