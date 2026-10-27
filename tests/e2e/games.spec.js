import { ROUND_MS } from "../../src/lib/bonk.js";
import { expect, openNavGroup, test } from "./fixtures.js";

test("the games page lists the games, and the menu leads there", async ({
	page,
}) => {
	await page.goto("/");
	await openNavGroup(page, "Fun stuff");
	await page
		.getByRole("navigation", { name: "Main" })
		.getByRole("link", { name: "Games" })
		.click();
	await expect(
		page.getByRole("heading", { name: "Games", level: 1 }),
	).toBeVisible();
	await page.getByRole("link", { name: /Flappy Head/ }).click();
	await expect(
		page.getByRole("heading", { name: "Flappy Head", level: 1 }),
	).toBeVisible();
	await page.getByRole("link", { name: "← All games" }).click();
	await page.getByRole("link", { name: /Bonk/ }).click();
	await expect(
		page.getByRole("heading", { name: "Bonk", level: 1 }),
	).toBeVisible();
});

test.describe("Flappy Head", () => {
	test("starts with a tap, and without flapping the head falls and splats", async ({
		page,
		api,
	}) => {
		api.scores["flappy-head"] = [{ initials: "CAL", score: 23 }];
		await page.goto("/games/flappy-head");
		await expect(
			page.getByRole("region", { name: "High scores" }),
		).toContainText("CAL");
		await expect(page.getByText("Tap to start")).toBeVisible();
		await page.locator(".game-stage").click();
		await expect(page.getByText("Tap to start")).toBeHidden();
		await expect(page.getByRole("heading", { name: "Splat!" })).toBeVisible({
			timeout: 5000,
		});
		await expect(page.getByText("Score: 0")).toBeVisible();
		// Nothing to put on the board for zero
		await expect(page.getByLabel("Your initials")).toHaveCount(0);
		await page.getByRole("button", { name: "Play again" }).click();
		await expect(page.getByRole("heading", { name: "Splat!" })).toBeHidden();
	});

	test("Space flaps (and starts it)", async ({ page }) => {
		await page.goto("/games/flappy-head");
		await page.keyboard.press("Space");
		await expect(page.getByText("Tap to start")).toBeHidden();
		// Keep flapping and it stays up for longer than a plain fall (which takes under a second)
		for (let i = 0; i < 8; i++) {
			await page.keyboard.press("Space");
			await page.waitForTimeout(150);
		}
		await expect(page.getByRole("heading", { name: "Splat!" })).toHaveCount(0);
	});
});

test.describe("Pinball", () => {
	test("launches with Space, and the game ends once all three balls drain", async ({
		page,
	}) => {
		// A whole game, drawn frame by frame: slow on a slow machine
		test.setTimeout(120_000);
		await page.clock.install();
		await page.goto("/games/pinball");
		const hud = page.locator(".pinball-hud");
		await expect(
			page.getByText("Tap to launch", { exact: true }),
		).toBeVisible();
		await page.keyboard.press("Space");
		await expect(page.getByText("Tap to launch", { exact: true })).toBeHidden();
		await expect(hud).toContainText("Ball 1 of 3");
		// Never flip: each ball drains, and the next waits in the lane for another launch
		for (
			let i = 0;
			i < 15 &&
			!(await page.getByRole("heading", { name: "Game over" }).isVisible());
			i++
		) {
			await page.clock.runFor(8000);
			if (await page.getByText("Tap to launch the next ball").isVisible())
				await page.keyboard.press("Space");
		}
		await expect(
			page.getByRole("heading", { name: "Game over" }),
		).toBeVisible();
		const score = (await hud.locator("strong").first().textContent()).trim();
		await expect(page.locator(".game-final")).toContainText(`Score: ${score}`);
		await page.getByRole("button", { name: "Play again" }).click();
		await expect(hud).toContainText("Score 0");
	});

	test("tables can be swapped, each with its own high scores", async ({
		page,
		api,
	}) => {
		api.scores["pinball-space"] = [{ initials: "ET", score: 9000 }];
		await page.goto("/games/pinball");
		const tables = page.getByRole("radiogroup", { name: "Table" });
		await expect(
			tables.getByRole("radio", { name: "Classic" }),
		).toHaveAttribute("aria-checked", "true");
		await expect(
			page.getByText("Light up the letters for a bonus."),
		).toBeVisible();
		await tables.getByRole("radio", { name: "Close Encounters" }).click();
		await expect(page).toHaveURL("/games/pinball?table=space");
		await expect(
			page.getByRole("region", { name: "High scores" }),
		).toContainText("ET");
		await expect(
			page.getByRole("img", { name: /Close Encounters pinball table/ }),
		).toBeVisible();
		// The link remembers the table
		await page.reload();
		await expect(
			tables.getByRole("radio", { name: "Close Encounters" }),
		).toHaveAttribute("aria-checked", "true");
		for (const name of ["Mainframe", "Dance Floor"]) {
			await tables.getByRole("radio", { name }).click();
			await expect(tables.getByRole("radio", { name })).toHaveAttribute(
				"aria-checked",
				"true",
			);
			await expect(
				page.getByRole("img", { name: new RegExp(`${name} pinball table`) }),
			).toBeVisible();
		}
	});

	test("a tap on the table launches the ball", async ({ page }) => {
		await page.goto("/games/pinball");
		const stage = page.locator(".pinball-stage");
		// A tap before the page has finished loading does nothing, so keep tapping until it launches
		await expect(async () => {
			const { width, height } = await stage.boundingBox();
			await stage.click({ position: { x: width * 0.25, y: height * 0.6 } });
			await expect(page.getByText("Tap to launch", { exact: true })).toBeHidden(
				{ timeout: 500 },
			);
		}).toPass();
		await expect(page.locator(".pinball-hud")).toContainText("Ball 1 of 3");
	});
});

test.describe("Bonk", () => {
	test("bonking heads scores, and the score goes on the board", async ({
		page,
		api,
	}) => {
		await page.clock.install();
		await page.goto("/games/bonk");
		await expect(page.getByText("No scores yet. Be the first!")).toBeVisible();
		await page.getByRole("button", { name: "Start" }).click();
		for (let i = 1; i <= 3; i++) {
			await page.clock.runFor(450);
			await page.getByRole("button", { name: "Bonk the head!" }).click();
			await expect(page.locator(".bonk-bar")).toContainText(`Score ${i}`);
			// A hole with no head in it does nothing
			await page
				.getByRole("button", { name: /^Hole / })
				.first()
				.click();
			await expect(page.locator(".bonk-bar")).toContainText(`Score ${i}`);
		}
		await page.clock.runFor(ROUND_MS);
		await expect(page.getByRole("heading", { name: "Time!" })).toBeVisible();
		await expect(page.getByText("Score: 3 · New best!")).toBeVisible();

		const initials = page.getByLabel("Your initials");
		await initials.fill("c4l!x");
		await expect(initials).toHaveValue("C4L");
		await page.getByRole("button", { name: "Save score" }).click();
		await expect(page.getByText("You're #1 on the board!")).toBeVisible();
		expect(api.scorePosts).toEqual([
			{ game: "bonk", initials: "C4L", score: 3, run: "run-bonk" },
		]);
		await expect(
			page.getByRole("region", { name: "High scores" }),
		).toContainText("C4L");
	});

	test("a rejected score explains itself", async ({ page, api }) => {
		api.scoreStatus = 400;
		await page.clock.install();
		await page.goto("/games/bonk");
		await page.getByRole("button", { name: "Start" }).click();
		await page.clock.runFor(450);
		await page.getByRole("button", { name: "Bonk the head!" }).click();
		await page.clock.runFor(ROUND_MS);
		await page.getByLabel("Your initials").fill("CAL");
		await page.getByRole("button", { name: "Save score" }).click();
		await expect(page.getByRole("alert")).toHaveText(
			"That score doesn't look right.",
		);
	});

	test("without the database the games still work, just with no board", async ({
		page,
		api,
	}) => {
		api.down = true;
		await page.clock.install();
		await page.goto("/games/bonk");
		await page.getByRole("button", { name: "Start" }).click();
		await page.clock.runFor(450);
		await page.getByRole("button", { name: "Bonk the head!" }).click();
		await page.clock.runFor(ROUND_MS);
		await expect(page.getByText("Score: 1")).toBeVisible();
		await expect(page.getByLabel("Your initials")).toHaveCount(0);
		await expect(page.getByRole("region", { name: "High scores" })).toHaveCount(
			0,
		);
	});
});

test.describe("tap feedback", () => {
	// Records each buzz and each sound effect note, so the test can see them
	test.beforeEach(async ({ page }) => {
		await page.addInitScript(() => {
			window.buzzes = [];
			window.notes = 0;
			Object.defineProperty(navigator, "vibrate", {
				value: (pattern) => (window.buzzes.push(pattern), true),
			});
			const Context = window.AudioContext ?? window.webkitAudioContext;
			if (Context) {
				for (const make of ["createOscillator", "createBufferSource"]) {
					const original = Context.prototype[make];
					Context.prototype[make] = function (...args) {
						window.notes++;
						return original.apply(this, args);
					};
				}
			}
		});
	});
	const buzzes = (page) => page.evaluate(() => window.buzzes.length);
	const notes = (page) => page.evaluate(() => window.notes);
	// Playwright's WebKit on Windows has no Web Audio (a real iPhone does), so sound is only checked
	// where there is some
	const hasAudio = (page) =>
		page.evaluate(() => !!(window.AudioContext ?? window.webkitAudioContext));

	for (const [path, surface] of [
		["/games/flappy-head", ".game-stage"],
		["/games/pinball", ".pinball-stage"],
		["/games/bonk", ".bonk-hole"],
	]) {
		test(`${path}: no blue flash on a tap`, async ({ page, browserName }) => {
			// Only Chromium's test build reports the tap highlight
			test.skip(browserName !== "chromium");
			await page.goto(path);
			const colour = await page
				.locator(surface)
				.first()
				.evaluate((el) => getComputedStyle(el).webkitTapHighlightColor);
			expect(colour).toBe("rgba(0, 0, 0, 0)");
		});
	}

	test("Flappy Head: each flap buzzes and whoops", async ({ page }) => {
		await page.goto("/games/flappy-head");
		await page.keyboard.press("Space");
		await page.keyboard.press("Space");
		await expect.poll(() => buzzes(page)).toBe(2);
		if (await hasAudio(page)) expect(await notes(page)).toBeGreaterThan(0);
	});

	test("Bonk: a hit thunks, and an empty hole whiffs with a puff of dust", async ({
		page,
	}) => {
		await page.clock.install();
		await page.goto("/games/bonk");
		await page.getByRole("button", { name: "Start" }).click();
		await page.clock.runFor(450);
		await page.getByRole("button", { name: "Bonk the head!" }).click();
		await expect.poll(() => page.evaluate(() => window.buzzes)).toEqual([18]);
		const empty = page.getByRole("button", { name: /^Hole / }).first();
		await empty.click();
		await expect(empty).toHaveClass(/missed/);
		await expect.poll(() => page.evaluate(() => window.buzzes)).toEqual([18, 5]);
		if (await hasAudio(page)) expect(await notes(page)).toBeGreaterThan(0);
	});

	test("Pinball: the plunger and flippers buzz and click", async ({ page }) => {
		await page.goto("/games/pinball");
		await expect(page.locator(".pinball-stage")).toBeVisible();
		await page.keyboard.press("Space");
		await page.keyboard.down("ArrowLeft");
		await page.keyboard.up("ArrowLeft");
		// (then the ball may well hit something and buzz again)
		await expect
			.poll(() => page.evaluate(() => window.buzzes.slice(0, 2)))
			.toEqual([20, 6]);
		if (await hasAudio(page)) expect(await notes(page)).toBeGreaterThan(0);
	});

	test("sound can be switched off, for every game, and stays off", async ({
		page,
	}) => {
		await page.goto("/games/flappy-head");
		const sound = page.getByRole("button", { name: "Sound" });
		await expect(sound).toHaveAttribute("aria-pressed", "true");
		await sound.click();
		await expect(sound).toHaveAttribute("aria-pressed", "false");
		// A tap on the game (Space would press the Sound button again, as it has focus)
		await page.locator(".game-stage").click();
		await expect.poll(() => buzzes(page)).toBe(1);
		// Still buzzes, but silently
		if (await hasAudio(page)) expect(await notes(page)).toBe(0);
		await page.goto("/games/bonk");
		await expect(page.getByRole("button", { name: "Sound" })).toHaveAttribute(
			"aria-pressed",
			"false",
		);
	});
});
