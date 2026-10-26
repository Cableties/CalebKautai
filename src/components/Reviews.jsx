import { useEffect, useState } from "react";
import { oldReviews } from "../content.js";

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

// The old site's ratings count towards the average alongside the API's
function combine(data) {
	const count = (data?.count ?? 0) + oldReviews.length;
	const total =
		(data?.average ?? 0) * (data?.count ?? 0) +
		oldReviews.reduce((sum, r) => sum + r.rating, 0);
	return { count, average: Math.round((total / count) * 10) / 10 };
}

export default function Reviews() {
	// null while loading or if the API isn't available; old reviews show either way
	const [data, setData] = useState(null);
	const [rating, setRating] = useState(0);
	const [hover, setHover] = useState(0);
	const [status, setStatus] = useState("idle"); // idle | sending | approved | pending | error
	const [error, setError] = useState("");

	useEffect(() => {
		fetch("/api/reviews")
			.then((r) => (r.ok ? r.json() : Promise.reject()))
			.then(setData)
			.catch(() => setData(null));
	}, []);

	async function submit(e) {
		e.preventDefault();
		if (!rating) {
			setStatus("error");
			setError("Pick how many stars first.");
			return;
		}
		const form = new FormData(e.currentTarget);
		setStatus("sending");
		try {
			const res = await fetch("/api/reviews", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ rating, ...Object.fromEntries(form) }),
			});
			const body = await res.json().catch(() => ({}));
			// 404: no API at all (local dev); 503: the database isn't connected yet
			if (res.status === 404 || res.status === 503)
				throw new Error("Reviews aren't switched on yet. Try again soon!");
			if (!res.ok)
				throw new Error(body.error || "That didn't send. Try again in a bit.");
			setStatus(body.approved ? "approved" : "pending");
			// Refresh the average (and the list, if it went straight up)
			fetch("/api/reviews")
				.then((r) => r.json())
				.then(setData)
				.catch(() => {});
		} catch (err) {
			setStatus("error");
			setError(err.message);
		}
	}

	const sent = status === "approved" || status === "pending";
	const summary = combine(data);

	return (
		<section className="reviews" aria-labelledby="reviews-heading">
			<h2 id="reviews-heading" className="section-title">
				Rate your experience
			</h2>
			<p className="reviews-summary">
				<Stars rating={summary.average} />{" "}
				<strong>{summary.average.toFixed(1)}</strong> from {summary.count}{" "}
				{summary.count === 1 ? "rating" : "ratings"}
			</p>

			{!sent && (
				<form className="review-form" onSubmit={submit}>
					<fieldset className="star-input" onMouseLeave={() => setHover(0)}>
						<legend>Your rating</legend>
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
							placeholder="Anonymous victim"
						/>
					</label>
					<label className="review-comment">
						<span>Comment (optional)</span>
						<textarea name="comment" maxLength={LIMITS.comment} rows={3} />
					</label>
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
						{status === "sending" ? "Sending…" : "Submit review"}
					</button>
					{status === "error" && (
						<p className="notice" role="alert">
							{error}
						</p>
					)}
				</form>
			)}
			{sent && (
				<p className="notice" role="status">
					{status === "approved"
						? "Thanks! Your rating is in."
						: "Thanks! Your rating is in, and your comment will show up once I've read it."}
				</p>
			)}

			<ul className="review-list">
				{data?.reviews?.map((r) => (
					<li key={r.id}>
						<p className="review-head">
							<strong>{r.name}</strong> <Stars rating={r.rating} />
						</p>
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
