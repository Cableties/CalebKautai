import { useEffect, useState } from "react";
import { oldReviews } from "../content.js";
import DoodlePad, { Doodle } from "./DoodlePad.jsx";

const LIMITS = { name: 40, comment: 280 }; // matches api/_lib/reviews.js

function Stars({ rating }) {
	return (
		<span className="stars" role="img" aria-label={`${rating} out of 5 stars`}>
			{"★".repeat(Math.round(rating))}
			<span className="stars-empty">{"★".repeat(5 - Math.round(rating))}</span>
		</span>
	);
}

// UTC so the prerendered HTML and the browser agree on the day, whatever the visitor's time zone
const day = (iso) =>
	new Date(iso).toLocaleDateString("en-AU", {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: "UTC",
	});

// Entries from before the rename were saved as "Anonymous victim"
const displayName = (name) => (name === "Anonymous victim" ? "Anonymous" : name);

// The old site's ratings count towards the average alongside the API's
function combine(data) {
	const count = (data?.count ?? 0) + oldReviews.length;
	const total =
		(data?.average ?? 0) * (data?.count ?? 0) +
		oldReviews.reduce((sum, r) => sum + r.rating, 0);
	return { count, average: Math.round((total / count) * 10) / 10 };
}

// The guestbook: stars, a comment, a doodle, or any mix of them
export default function Reviews() {
	// null while loading or if the API isn't available; old reviews show either way
	const [data, setData] = useState(null);
	const [rating, setRating] = useState(0);
	const [hover, setHover] = useState(0);
	const [doodle, setDoodle] = useState([]);
	const [status, setStatus] = useState("idle"); // idle | sending | sent | error
	const [sent, setSent] = useState(null); // what went, for the thank-you message
	const [error, setError] = useState("");

	const load = () =>
		fetch("/api/reviews")
			.then((r) => (r.ok ? r.json() : Promise.reject()))
			.then(setData)
			.catch(() => setData(null));
	useEffect(() => {
		load();
	}, []);

	async function submit(e) {
		e.preventDefault();
		const form = Object.fromEntries(new FormData(e.currentTarget));
		if (!rating && !form.comment.trim() && !doodle.length) {
			setStatus("error");
			setError("Leave some stars, a comment or a doodle first.");
			return;
		}
		setStatus("sending");
		try {
			const res = await fetch("/api/reviews", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ...form, rating: rating || null, doodle }),
			});
			const body = await res.json().catch(() => ({}));
			// 404: no API at all (local dev); 503 with this message: the database isn't connected yet
			if (
				res.status === 404 ||
				(res.status === 503 && body.error === "Storage is not configured")
			)
				throw new Error("The guestbook isn't switched on yet. Try again soon!");
			if (!res.ok)
				throw new Error(body.error || "That didn't send. Try again in a bit.");
			setSent({ approved: body.approved, rated: !!rating });
			setStatus("sent");
			// Refresh the average (and the list, if it went straight up)
			load();
		} catch (err) {
			setStatus("error");
			setError(err.message);
		}
	}

	const summary = combine(data);
	const thanks = !sent
		? ""
		: sent.approved
			? "Thanks! You're in the guestbook."
			: sent.rated
				? "Thanks! Your stars are in, and the rest will show up once I've had a look."
				: "Thanks! It'll show up once I've had a look.";

	return (
		<section className="reviews" aria-labelledby="reviews-heading">
			<p className="reviews-kicker" aria-hidden="true">
				&gt; guestbook
			</p>
			<h2 id="reviews-heading" className="section-title">
				Sign the guestbook
			</h2>
			<p className="reviews-lede">
				Rate the experience, leave a note, or draw me something. Or all three.
			</p>
			<p className="reviews-summary">
				<Stars rating={summary.average} />{" "}
				<strong>{summary.average.toFixed(1)}</strong> from {summary.count}{" "}
				{summary.count === 1 ? "rating" : "ratings"}
			</p>

			{status !== "sent" ? (
				<form className="review-form" onSubmit={submit}>
					<fieldset className="star-input" onMouseLeave={() => setHover(0)}>
						<legend>Your rating (optional)</legend>
						{[1, 2, 3, 4, 5].map((n) => (
							<label
								key={n}
								className={n <= (hover || rating) ? "on" : ""}
								onMouseEnter={() => setHover(n)}
							>
								<input
									type="radio"
									name="rating-choice"
									value={n}
									checked={rating === n}
									onChange={() => setRating(n)}
									className="visually-hidden"
								/>
								<span aria-hidden="true">★</span>
								<span className="visually-hidden">
									{n} {n === 1 ? "star" : "stars"}
								</span>
							</label>
						))}
					</fieldset>
					<label>
						<span>Name (optional)</span>
						<input
							name="name"
							maxLength={LIMITS.name}
							autoComplete="nickname"
							placeholder="Anonymous"
						/>
					</label>
					<label className="review-comment">
						<span>Comment (optional)</span>
						<textarea name="comment" maxLength={LIMITS.comment} rows={3} />
					</label>
					<fieldset className="review-doodle">
						<legend>Doodle (optional)</legend>
						<DoodlePad
							strokes={doodle}
							onChange={setDoodle}
							disabled={status === "sending"}
						/>
					</fieldset>
					{/* Honeypot: hidden from people, filled in by spam bots */}
					<label className="visually-hidden" aria-hidden="true">
						Website
						<input name="website" tabIndex={-1} autoComplete="off" />
					</label>
					<button
						type="submit"
						className="button"
						disabled={status === "sending"}
					>
						{status === "sending" ? "Sending…" : "Sign the guestbook"}
					</button>
					{status === "error" && (
						<p className="notice" role="alert">
							{error}
						</p>
					)}
				</form>
			) : (
				<p className="notice" role="status">
					{thanks}
				</p>
			)}

			<ul className="review-list">
				{data?.reviews?.map((r) => (
					<li key={r.id}>
						<p className="review-head">
							<strong>{displayName(r.name)}</strong>{" "}
							{r.rating > 0 && <Stars rating={r.rating} />}
						</p>
						{r.doodle?.length > 0 && (
							<Doodle strokes={r.doodle} label={`Doodle by ${displayName(r.name)}`} />
						)}
						{r.comment && <p>{r.comment}</p>}
						<p className="review-date">{day(r.createdAt)}</p>
					</li>
				))}
				{oldReviews.map((r) => (
					<li key={r.name + r.date}>
						<p className="review-head">
							<strong>{r.name}</strong> <Stars rating={r.rating} />
						</p>
						<p>{r.comment}</p>
						<p className="review-date">{day(r.date)} · on the original site</p>
					</li>
				))}
			</ul>
		</section>
	);
}
