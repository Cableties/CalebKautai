import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { HEADS } from "../lib/bounce.js";
import { gameHead } from "../lib/gameHead.js";
import {
	BALL,
	BALLS,
	FLIPPERS,
	HEIGHT,
	LANE,
	TABLES,
	WIDTH,
	flipperTip,
	launch,
	start,
	step,
	tableById,
} from "../lib/pinball.js";
import {
	ScoreBoard,
	ScoreEntry,
	useBest,
	useRun,
} from "../components/Scores.jsx";
import SoundToggle from "../components/SoundToggle.jsx";
import { feedback } from "../lib/feedback.js";
import { useCheats } from "../components/Cheats.jsx";

// Pinball, with Caleb's pixel head as the ball, on a choice of themed tables. The physics, rules and
// table layouts are in lib/pinball.js; this draws them on a canvas and handles input: tap or hold
// either side of the table (or the arrow keys) to flip, and tap (or Space) to launch.
const LEFT_KEYS = ["ArrowLeft", "z", "Z", "a", "A", "Shift"];
const RIGHT_KEYS = ["ArrowRight", "m", "M", "/", "d", "D"];
const LAUNCH_KEYS = [" ", "Enter", "ArrowDown"];
export const gameKey = (table) => `pinball-${table}`;

// The same scattered points every time, for stars and the like
const scatter = (n, seed) =>
	Array.from({ length: n }, (_, i) => {
		const r = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
		const r2 = Math.sin(i * 39.3468 + seed * 11.135) * 24634.6345;
		return [
			(r - Math.floor(r)) * WIDTH,
			(r2 - Math.floor(r2)) * HEIGHT,
			(r * 7) % 1,
		];
	});
const STARS = scatter(70, 1);
const BITS = scatter(46, 2);
const hue = (h, s = 85, l = 72) => `hsl(${h % 360} ${s}% ${l}%)`;

// How each table looks. `bumper(i, time)` picks a bumper's colour; `decorate` draws the background.
const THEMES = {
	classic: {
		bg: ["#e4dcf7", "#fbe3ee"],
		lane: "#d9ccf5",
		wall: "#2e2a45",
		bumper: (i) => ["#f7b6d2", "#a9d4f2", "#fdeca0"][i % 3],
		core: "#2e2a45",
		flipper: "#f7b6d2",
		kicker: "#a9d4f2",
		letterOn: "#c2407e",
		letterOff: "#ffffff",
		letterText: ["#2e2a45", "#ffffff"],
	},
	mainframe: {
		bg: ["#0d0c16", "#1b1530"],
		lane: "#15131f",
		wall: "#7dffb2",
		glow: "#7dffb2",
		bumper: (i) => ["#f7b6d2", "#7fe7ff", "#7dffb2", "#ffe27a"][i % 4],
		core: "#0d0c16",
		flipper: "#7dffb2",
		kicker: "#f7b6d2",
		hole: "#f7b6d2",
		letterOn: "#7dffb2",
		letterOff: "#15131f",
		letterText: ["#7dffb2", "#0d0c16"],
		decorate(ctx) {
			ctx.font = "600 12px ui-monospace, Menlo, Consolas, monospace";
			ctx.fillStyle = "rgb(125 255 178 / 0.14)";
			for (const [x, y, r] of BITS) ctx.fillText(r > 0.5 ? "1" : "0", x, y);
			ctx.strokeStyle = "rgb(125 255 178 / 0.06)";
			ctx.lineWidth = 1;
			for (let y = 0; y < HEIGHT; y += 24) {
				ctx.beginPath();
				ctx.moveTo(0, y);
				ctx.lineTo(WIDTH, y);
				ctx.stroke();
			}
		},
	},
	space: {
		bg: ["#0b1030", "#2a1b4a"],
		lane: "#1a1840",
		wall: "#d9ccf5",
		bumper: (i) => ["#f7b6d2", "#a9d4f2", "#fdeca0"][i % 3],
		core: null, // planets: a ring instead of a centre
		flipper: "#a9d4f2",
		kicker: "#fdeca0",
		hole: "#b48cff",
		letterOn: "#7fe7ff",
		letterOff: "#1a1840",
		letterText: ["#d9ccf5", "#0b1030"],
		decorate(ctx, time) {
			for (const [x, y, r] of STARS) {
				ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(time * 1.5 + r * 10));
				ctx.fillStyle = "#fff";
				ctx.fillRect(x, y, r > 0.8 ? 2 : 1.3, r > 0.8 ? 2 : 1.3);
			}
			ctx.globalAlpha = 1;
			// A small moon in the open space above the flippers
			ctx.fillStyle = "rgb(253 236 160 / 0.22)";
			ctx.beginPath();
			ctx.arc(210, 455, 20, 0, Math.PI * 2);
			ctx.fill();
		},
	},
	disco: {
		bg: ["#1d1430", "#2b1840"],
		lane: "#24183a",
		wall: "#ffffff",
		bumper: (i, time) => hue(i * 72 + time * 120),
		core: "#1d1430",
		flipper: "#f7b6d2",
		kicker: "#ffe27a",
		letterOn: "#ffe27a",
		letterOff: "#24183a",
		letterText: ["#ffffff", "#1d1430"],
		decorate(ctx, time) {
			// A light-up dance floor across the lower table
			const size = 40;
			for (let y = 300; y < HEIGHT; y += size) {
				for (let x = 0; x < LANE.left; x += size) {
					const n = (x / size) * 3 + (y / size) * 5;
					ctx.fillStyle = hue(n * 40 + Math.floor(time * 2) * 60, 80, 60);
					ctx.globalAlpha = 0.1 + 0.08 * ((n + Math.floor(time * 2)) % 2);
					ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
				}
			}
			ctx.globalAlpha = 1;
			// The mirror ball
			ctx.fillStyle = "#d9ccf5";
			ctx.beginPath();
			ctx.arc(180, 150, 13, 0, Math.PI * 2);
			ctx.fill();
			ctx.strokeStyle = "#1d1430";
			ctx.lineWidth = 1;
			for (let i = -2; i <= 2; i++) {
				ctx.beginPath();
				ctx.moveTo(167, 150 + i * 5);
				ctx.lineTo(193, 150 + i * 5);
				ctx.stroke();
			}
		},
	},
};

const line = (ctx, [x1, y1, x2, y2]) => {
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2);
	ctx.stroke();
};

// The table's sounds (and buzzes), from what changed between one frame and the next
function effects(a, b) {
	if (b.balls < a.balls) return feedback("drain");
	if (b.multiplier > a.multiplier) feedback("bonus");
	else if (b.lit.filter(Boolean).length > a.lit.filter(Boolean).length)
		feedback("rollover");
	if (b.held && !a.held) feedback("hole");
	// A hit: its flash restarted (and it scored, so not a ball resting against it)
	const hit = (before, after) =>
		after.some((f, i) => f > before[i] && before[i] <= 0.05);
	if (hit(a.flash.bumpers, b.flash.bumpers)) feedback("bumper");
	if (hit(a.flash.kickers, b.flash.kickers)) feedback("kicker");
}

function draw(ctx, game, head, looks, table, time, held) {
	const theme = THEMES[table.theme];
	const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
	bg.addColorStop(0, theme.bg[0]);
	bg.addColorStop(1, theme.bg[1]);
	ctx.fillStyle = bg;
	ctx.fillRect(0, 0, WIDTH, HEIGHT);
	theme.decorate?.(ctx, time);
	ctx.fillStyle = theme.lane;
	ctx.fillRect(LANE.left, 180, LANE.right - LANE.left, HEIGHT - 180);

	ctx.lineCap = "round";
	ctx.lineWidth = 4;
	ctx.strokeStyle = theme.wall;
	if (theme.glow) {
		ctx.shadowColor = theme.glow;
		ctx.shadowBlur = 8;
	}
	table.walls.forEach((w) => line(ctx, w));
	ctx.shadowBlur = 0;

	// Slingshot faces: thicker, and they light up when hit
	table.kickers.forEach((k, i) => {
		ctx.lineWidth = game.flash.kickers[i] > 0 ? 9 : 7;
		ctx.strokeStyle = game.flash.kickers[i] > 0 ? "#ffffff" : theme.kicker;
		line(ctx, k);
	});

	table.holes.forEach((hole) => {
		ctx.fillStyle = "#000";
		ctx.beginPath();
		ctx.arc(hole.x, hole.y, hole.r, 0, Math.PI * 2);
		ctx.fill();
		ctx.lineWidth = 3;
		ctx.strokeStyle = theme.hole;
		for (const [r, a] of [
			[hole.r + 3, time * 3],
			[hole.r + 8, -time * 2],
		]) {
			ctx.beginPath();
			ctx.arc(hole.x, hole.y, r, a, a + Math.PI * 1.3);
			ctx.stroke();
		}
		ctx.font = "700 8px ui-monospace, Menlo, Consolas, monospace";
		ctx.fillStyle = theme.hole;
		ctx.textAlign = "center";
		ctx.fillText(hole.label, hole.x, hole.y + hole.r + 18);
	});

	// The top lanes' letters, lit as the ball rolls through
	ctx.font = "800 14px system-ui, sans-serif";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	table.rollovers.forEach((r, i) => {
		ctx.beginPath();
		ctx.arc(r.x, r.y, Math.min(11, r.w), 0, Math.PI * 2);
		ctx.fillStyle = game.lit[i] ? theme.letterOn : theme.letterOff;
		ctx.fill();
		ctx.lineWidth = 2.5;
		ctx.strokeStyle = theme.wall;
		ctx.stroke();
		ctx.fillStyle = theme.letterText[game.lit[i] ? 1 : 0];
		ctx.fillText(r.letter, r.x, r.y + 1);
	});
	ctx.textBaseline = "alphabetic";

	table.bumpers.forEach((b, i) => {
		const flash = game.flash.bumpers[i] > 0;
		ctx.beginPath();
		ctx.arc(b.x, b.y, b.r + (flash ? 3 : 0), 0, Math.PI * 2);
		ctx.fillStyle = flash ? "#fff" : theme.bumper(i, time);
		ctx.fill();
		ctx.lineWidth = 4;
		ctx.strokeStyle = theme.core ?? theme.wall;
		ctx.stroke();
		if (theme.core) {
			ctx.beginPath();
			ctx.arc(b.x, b.y, b.r * 0.45, 0, Math.PI * 2);
			ctx.fillStyle = theme.core;
			ctx.fill();
		} else {
			// A planet's ring
			ctx.lineWidth = 2.5;
			ctx.strokeStyle = "rgb(255 255 255 / 0.75)";
			ctx.beginPath();
			ctx.ellipse(b.x, b.y, b.r * 1.55, b.r * 0.42, -0.35, 0, Math.PI * 2);
			ctx.stroke();
		}
	});

	for (const name of ["left", "right"]) {
		const f = FLIPPERS[name];
		const [tx, ty] = flipperTip(f, game.flippers[name].angle);
		for (const [width, colour] of [
			[18, theme.core ?? "#0b1030"],
			[11, theme.flipper],
		]) {
			ctx.lineWidth = width;
			ctx.strokeStyle = colour;
			// A held flipper glows in the table's colours, so a tap shows on the flipper itself
			if (held[name] && width === 11) {
				ctx.shadowColor = theme.glow ?? theme.flipper;
				ctx.shadowBlur = 14;
			}
			line(ctx, [f.x, f.y, tx, ty]);
			ctx.shadowBlur = 0;
		}
	}

	// The ball: the head, facing the way it's rolling. Sized by the face, which is the ball: hair round
	// it (Amber's) and Big Head Mode's bobblehead are just for show
	if (!game.over) {
		const { x, y, vx, vy } = game.ball;
		looks.draw(ctx, head, {
			x,
			y,
			size: BALL * 2.6,
			facing:
				Math.hypot(vx, vy) > 40 ? (Math.atan2(vy, vx) * 180) / Math.PI : 0,
			time,
			alpha: game.held ? 0.5 : 1, // down the hole
		});
	}
}

export default function Pinball() {
	const [params, setParams] = useSearchParams();
	// The prerendered page is the first table, so the link's ?table= is only read once it's running
	// in the browser (reading it straight away wouldn't match the HTML it starts from)
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	const table = mounted ? tableById(params.get("table")) : TABLES[0];
	const GAME = gameKey(table.id);
	const canvas = useRef(null);
	const stage = useRef(null);
	const game = useRef(null);
	const tableRef = useRef(table);
	const held = useRef({ left: false, right: false });
	const pointers = useRef(new Map()); // pointer id → which flipper it holds
	const fresh = { score: 0, balls: BALLS, multiplier: 1, inLane: true };
	const [hud, setHud] = useState(fresh);
	const [phase, setPhase] = useState("ready"); // ready | playing | over
	const [newBest, setNewBest] = useState(false);
	const [scores, setScores] = useState(null);
	const [best, record] = useBest(GAME);
	const { run, begin } = useRun(GAME);
	const phaseRef = useRef(phase);
	phaseRef.current = phase;
	const hudRef = useRef(hud);
	hudRef.current = hud;
	const recordRef = useRef(record);
	recordRef.current = record;

	// A new table: a fresh game on it
	useEffect(() => {
		tableRef.current = table;
		game.current = start(table);
		setHud(fresh);
		setScores(null);
		setPhase("ready");
	}, [table.id]);

	// Whoever's playing: their sprite sheet and its frame size
	const { player } = useCheats();
	const head = useRef(null);
	const looks = useRef(null); // the cheats' effects on it (lib/gameHead.js)
	useEffect(() => {
		const sheet = new Image();
		sheet.src = HEADS[player].sheet;
		head.current = { sheet, sprite: HEADS[player].sprite };
	}, [player]);

	useEffect(() => {
		const el = canvas.current;
		const ctx = el.getContext("2d");
		looks.current = gameHead();
		let last = performance.now();
		let animation;

		function resize() {
			const ratio = devicePixelRatio || 1;
			el.width = Math.round(el.clientWidth * ratio);
			el.height = Math.round(el.clientHeight * ratio);
		}
		resize();
		const observer = new ResizeObserver(resize);
		observer.observe(el);

		function tick(now) {
			const dt = Math.min((now - last) / 1000, 1 / 30);
			last = now;
			const t = tableRef.current;
			if (phaseRef.current === "playing") {
				const before = game.current;
				game.current = step(before, dt, held.current, t);
				const g = game.current;
				effects(before, g);
				// Compared with what's on screen, not the last frame: a launch happens between frames
				const shown = hudRef.current;
				if (
					g.score !== shown.score ||
					g.balls !== shown.balls ||
					g.inLane !== shown.inLane ||
					g.multiplier !== shown.multiplier
				) {
					setHud({
						score: g.score,
						balls: g.balls,
						multiplier: g.multiplier,
						inLane: g.inLane,
					});
				}
				if (g.over) {
					setPhase("over");
					setNewBest(recordRef.current(g.score));
				}
			} else if (phaseRef.current === "ready") {
				// Flippers still move before the first launch, to try them out
				game.current = step(
					{ ...game.current, inLane: true },
					dt,
					held.current,
					t,
				);
			}
			ctx.setTransform(el.width / WIDTH, 0, 0, el.height / HEIGHT, 0, 0);
			draw(
				ctx,
				game.current,
				head.current,
				looks.current,
				t,
				now / 1000,
				held.current,
			);
			animation = requestAnimationFrame(tick);
		}
		animation = requestAnimationFrame(tick);
		return () => {
			cancelAnimationFrame(animation);
			observer.disconnect();
		};
	}, []);

	function play() {
		stage.current?.scrollIntoView({ block: "center", behavior: "smooth" });
		game.current = start(tableRef.current);
		setHud(fresh);
		setNewBest(false);
		setPhase("playing");
		begin();
	}
	function fire() {
		if (phaseRef.current === "ready") play();
		if (phaseRef.current === "over") return;
		if (game.current.inLane) feedback("launch");
		game.current = launch(game.current);
	}
	// Raise a flipper, with a click as it goes up (not again while it's held)
	function hold(side, on) {
		if (on && !held.current[side]) feedback("flip");
		held.current = { ...held.current, [side]: on };
	}

	// Each finger holds the flipper on its side of the table; a tap also launches a waiting ball
	function down(e) {
		if (phaseRef.current === "over") return;
		e.preventDefault();
		const box = stage.current.getBoundingClientRect();
		const side = e.clientX - box.left < box.width / 2 ? "left" : "right";
		pointers.current.set(e.pointerId, side);
		hold(side, true);
		if (game.current.inLane) fire();
	}
	function up(e) {
		const side = pointers.current.get(e.pointerId);
		if (!side) return;
		pointers.current.delete(e.pointerId);
		if (![...pointers.current.values()].includes(side))
			hold(side, false);
	}

	useEffect(() => {
		function key(e) {
			if (e.target.closest?.("input, textarea, button, a")) return;
			const side = LEFT_KEYS.includes(e.key)
				? "left"
				: RIGHT_KEYS.includes(e.key)
					? "right"
					: null;
			if (side) {
				e.preventDefault();
				hold(side, e.type === "keydown");
			} else if (LAUNCH_KEYS.includes(e.key) && e.type === "keydown") {
				e.preventDefault();
				fire();
			}
		}
		addEventListener("keydown", key);
		addEventListener("keyup", key);
		return () => {
			removeEventListener("keydown", key);
			removeEventListener("keyup", key);
		};
	}, []);

	const ball = Math.min(BALLS, BALLS - hud.balls + 1);
	return (
		<article className="page game-page">
			<p className="game-back">
				<Link to="/games" viewTransition>
					← All games
				</Link>
				<SoundToggle />
			</p>
			<h1 className="page-title">Pinball</h1>
			<p className="lede">
				Tap either side to flip (or use the arrow keys). Light up the letters
				for a bonus.
			</p>

			<div className="pinball-tables" role="radiogroup" aria-label="Table">
				{TABLES.map((t) => (
					<button
						key={t.id}
						type="button"
						role="radio"
						aria-checked={t.id === table.id}
						className={`pinball-table-${t.id}`}
						onClick={() =>
							setParams(t.id === TABLES[0].id ? {} : { table: t.id }, {
								replace: true,
							})
						}
					>
						{t.name}
					</button>
				))}
			</div>

			<div className="game-layout">
				<div>
					<p className="pinball-hud" aria-live="polite">
						<span>
							Score <strong>{hud.score.toLocaleString()}</strong>
						</span>
						{hud.multiplier > 1 && (
							<span className="pinball-multiplier">×{hud.multiplier}</span>
						)}
						<span>
							Ball <strong>{ball}</strong> of {BALLS}
						</span>
					</p>
					<div
						className="game-stage pinball-stage"
						ref={stage}
						onPointerDown={down}
						onPointerUp={up}
						onPointerCancel={up}
						onPointerLeave={up}
					>
						<canvas
							ref={canvas}
							className="game-canvas"
							role="img"
							aria-label={`${table.name} pinball table. Score: ${hud.score}`}
						/>
						{phase !== "over" && hud.inLane && (
							<div className="game-overlay game-overlay-hint">
								<p>
									{phase === "ready"
										? "Tap to launch"
										: "Tap to launch the next ball"}
								</p>
							</div>
						)}
						{phase === "over" && (
							<div
								className="game-overlay"
								onPointerDown={(e) => e.stopPropagation()}
							>
								<h2>Game over</h2>
								<p className="game-final" role="status">
									Score: <strong>{hud.score.toLocaleString()}</strong>
									{newBest
										? " · New best!"
										: best
											? ` · Best: ${best.toLocaleString()}`
											: ""}
								</p>
								<ScoreEntry
									key={GAME}
									game={GAME}
									score={hud.score}
									run={run}
									onSaved={setScores}
								/>
								<button type="button" className="button" onClick={play}>
									Play again
								</button>
							</div>
						)}
					</div>
				</div>
				<ScoreBoard game={GAME} scores={scores} />
			</div>
		</article>
	);
}
