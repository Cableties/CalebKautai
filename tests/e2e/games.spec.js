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
	for (const name of ["Snake", "Invaders", "Bricks", "Bubbles"]) {
		await page.getByRole("link", { name: "← All games" }).click();
		await page.getByRole("link", { name: new RegExp(name) }).click();
		await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
	}
});

test.describe("Pausing", () => {
	test("the pause button and P stop the game, and it carries on where it was", async ({
		page,
	}) => {
		await page.goto("/games/snake");
		await page.keyboard.press("ArrowUp");
		await page.getByRole("button", { name: "Pause" }).click();
		await expect(page.getByRole("heading", { name: "Paused" })).toBeVisible();
		// Left alone it would hit the wall in about two seconds; paused, it doesn't
		await page.waitForTimeout(3000);
		await expect(page.getByRole("heading", { name: "Ouch!" })).toHaveCount(0);
		// No settings mid-game
		await expect(page.getByRole("button", { name: /^Settings/ })).toHaveCount(0);
		await page.keyboard.press("p");
		await expect(page.getByRole("heading", { name: "Paused" })).toBeHidden();
		await page.keyboard.press("p");
		await expect(page.getByRole("heading", { name: "Paused" })).toBeVisible();
		await page.getByRole("button", { name: "Resume" }).click();
		await expect(page.getByRole("heading", { name: "Ouch!" })).toBeVisible({
			timeout: 5000,
		});
	});

	test("switching away from the tab pauses it", async ({ page }) => {
		await page.goto("/games/flappy-head");
		await page.keyboard.press("Space");
		await page.evaluate(() => {
			Object.defineProperty(document, "hidden", { value: true, configurable: true });
			document.dispatchEvent(new Event("visibilitychange"));
		});
		await expect(page.getByRole("heading", { name: "Paused" })).toBeVisible();
	});

	test("Bonk's clock stops while it's paused", async ({ page }) => {
		await page.clock.install();
		await page.goto("/games/bonk");
		await page.getByRole("button", { name: "Start" }).click();
		await page.clock.runFor(2000);
		await page.getByRole("button", { name: "Pause" }).click();
		const seconds = page.locator(".bonk-bar strong").nth(1);
		const left = await seconds.innerText();
		await page.clock.runFor(10_000);
		await expect(seconds).toHaveText(left);
		await expect(page.getByRole("button", { name: "Bonk the head!" })).toHaveCount(0);
		await page.getByRole("button", { name: "Resume" }).click();
		await page.clock.runFor(2000);
		await expect(seconds).not.toHaveText(left);
		await expect(page.getByRole("heading", { name: "Time!" })).toHaveCount(0);
	});
});

test.describe("Snake", () => {
	test("an arrow key starts it, and left alone it runs into the wall", async ({
		page,
	}) => {
		// The fruit in the bottom corner, out of its way (by chance it was sometimes eaten on the way
		// up, scoring a point)
		await page.addInitScript(() => {
			Math.random = () => 0.99;
		});
		await page.goto("/games/snake");
		await expect(page.getByText("Swipe to start")).toBeVisible();
		await page.keyboard.press("ArrowUp");
		await expect(page.getByText("Swipe to start")).toBeHidden();
		await expect(page.getByRole("heading", { name: "Ouch!" })).toBeVisible({
			timeout: 5000,
		});
		await expect(page.getByLabel("Your initials")).toHaveCount(0);
	});

	test("settings are remembered, and each mix has its own high scores", async ({
		page,
		api,
	}) => {
		api.scores["snake-portals"] = [{ initials: "POR", score: 9 }];
		await page.goto("/games/snake");
		const board = page.getByRole("region", { name: "High scores" });
		await expect(board).toContainText("No scores yet");
		// Behind the cog in the corner of the game
		await page.getByRole("button", { name: "Settings" }).click();
		const portals = page.getByRole("switch", { name: /Portals/ });
		await portals.click();
		await expect(portals).toHaveAttribute("aria-checked", "true");
		await expect(board).toContainText("POR");
		await page.getByRole("button", { name: "Done" }).click();
		await expect(portals).toBeHidden();
		// Still waiting to start: changing settings didn't start a game
		await expect(page.getByText("Swipe to start")).toBeVisible();
		await page.reload();
		await expect(page.getByRole("button", { name: "Settings (1 on)" })).toBeVisible();
		await expect(board).toContainText("POR");
		// Not while a game's going
		await page.keyboard.press("ArrowUp");
		await expect(page.getByRole("button", { name: /^Settings/ })).toHaveCount(0);
	});

	test("arrow keys in the settings panel don't steer the game behind it", async ({
		page,
	}) => {
		await page.goto("/games/snake");
		await page.getByRole("button", { name: "Settings" }).click();
		await page.keyboard.press("ArrowUp");
		await page.keyboard.press("Escape");
		await expect(page.getByRole("dialog", { name: "Settings" })).toBeHidden();
		await expect(page.getByText("Swipe to start")).toBeVisible();
	});

	test("a swipe on the board starts it", async ({ page }) => {
		await page.goto("/games/snake");
		const stage = page.locator(".game-stage");
		await stage.scrollIntoViewIfNeeded();
		const box = await stage.boundingBox();
		const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
		await page.mouse.move(x, y);
		await page.mouse.down();
		await page.mouse.move(x, y - 60, { steps: 4 });
		await page.mouse.up();
		await expect(page.getByText("Swipe to start")).toBeHidden();
		await expect(page.getByRole("heading", { name: "Ouch!" })).toBeVisible({
			timeout: 5000,
		});
	});
});

test.describe("Bricks", () => {
	test("Space starts it and launches the ball, which knocks out bricks", async ({
		page,
	}) => {
		await page.goto("/games/bricks");
		await expect(page.getByText("Tap to start")).toBeVisible();
		await page.keyboard.press(" ");
		await expect(page.getByText("Tap to start")).toBeHidden();
		await expect(page.getByRole("img", { name: /Bricks. Score: [1-9]/ })).toBeVisible({
			timeout: 5000,
		});
	});
});

test.describe("Bubbles", () => {
	test("Space starts it and fires, and a match pops", async ({ page }) => {
		// Every bubble the same colour, so the first shot makes a match
		await page.addInitScript(() => {
			Math.random = () => 0;
		});
		await page.goto("/games/bubbles");
		await page.keyboard.press(" ");
		await expect(page.getByText("Tap to start")).toBeHidden();
		await page.keyboard.press(" ");
		await expect(page.getByRole("img", { name: /Bubbles. Score: [1-9]/ })).toBeVisible({
			timeout: 5000,
		});
	});

	test("the aiming guide switches on and off mid-game, and stays as it was left", async ({ page }) => {
		await page.goto("/games/bubbles");
		const guide = page.getByRole("button", { name: "Aiming guide" });
		await expect(guide).toHaveAttribute("aria-pressed", "true");
		await page.keyboard.press(" ");
		await expect(page.getByText("Tap to start")).toBeHidden();
		await guide.click();
		await expect(guide).toHaveAttribute("aria-pressed", "false");
		// Still playing: the click didn't fire or pause
		await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
		await page.keyboard.press("g");
		await expect(guide).toHaveAttribute("aria-pressed", "true");
		await page.keyboard.press("g");
		await page.reload();
		await expect(page.getByRole("button", { name: "Aiming guide" })).toHaveAttribute("aria-pressed", "false");
	});

	test("a wide window gets a wider board, and a phone a tall one", async ({ page }) => {
		await page.goto("/games/bubbles");
		const { width, height } = await page.locator(".game-stage").boundingBox();
		const wide = await page.evaluate(() => matchMedia("(min-width: 900px) and (min-aspect-ratio: 5/4)").matches);
		expect(width / height > 1).toBe(wide);
	});
});

test.describe("Invaders", () => {
	test("holding a finger down slides the cannon under it and fires, and hits score", async ({
		page,
	}) => {
		await page.goto("/games/invaders");
		const stage = page.locator(".game-stage");
		await stage.scrollIntoViewIfNeeded();
		const box = await stage.boundingBox();
		// Under the third column of aliens, which starts at x = 157 of 360
		await page.mouse.move(box.x + box.width * (157 / 360), box.y + box.height * 0.85);
		await page.mouse.down();
		await expect(page.getByText("Tap to start")).toBeHidden();
		await expect(page.getByRole("img", { name: /Invaders. Score: [1-9]/ })).toBeVisible({
			timeout: 5000,
		});
		await page.mouse.up();
	});

	test("Space starts it and fires", async ({ page }) => {
		await page.goto("/games/invaders");
		await page.keyboard.down(" ");
		await expect(page.getByText("Tap to start")).toBeHidden();
		await expect(page.getByRole("img", { name: /Invaders. Score: [1-9]/ })).toBeVisible({
			timeout: 5000,
		});
		await page.keyboard.up(" ");
	});
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
	test("with Easy Mode on, a score stays off the board and the personal best", async ({
		page,
		api,
	}) => {
		await page.addInitScript(() =>
			sessionStorage.setItem("cheats", JSON.stringify(["easy"])),
		);
		await page.clock.install();
		await page.goto("/games/bonk");
		await expect(page.getByText("Easy mode", { exact: true })).toBeVisible();
		await page.getByRole("button", { name: "Start" }).click();
		await page.clock.runFor(450);
		await page.getByRole("button", { name: "Bonk the head!" }).click();
		await page.clock.runFor(ROUND_MS);
		await expect(page.getByRole("heading", { name: "Time!" })).toBeVisible();
		await expect(page.getByText("Score: 1", { exact: true })).toBeVisible();
		await expect(
			page.getByText("Easy mode was on, so this one's just for you."),
		).toBeVisible();
		await expect(page.getByLabel("Your initials")).toHaveCount(0);
		expect(api.scorePosts).toEqual([]);
	});

	test("with Decoys on, bonking the other head costs points (never below zero)", async ({
		page,
	}) => {
		// Every head that pops up is a decoy
		await page.addInitScript(() => {
			Math.random = () => 0;
		});
		await page.clock.install();
		await page.goto("/games/bonk");
		await page.getByRole("button", { name: "Settings" }).click();
		await page.getByRole("switch", { name: /Decoys/ }).click();
		await page.getByRole("button", { name: "Done" }).click();
		await page.getByRole("button", { name: "Start" }).click();
		await page.clock.runFor(450);
		const decoy = page.getByRole("button", { name: "Don't bonk Amber!" });
		await decoy.click();
		await expect(page.locator(".bonk-hole.oops")).toHaveCount(1);
		await expect(page.locator(".bonk-bar")).toContainText("Score 0");
	});

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
		["/games/snake", ".game-stage"],
		["/games/invaders", ".game-stage"],
		["/games/bricks", ".game-stage"],
		["/games/bubbles", ".game-stage"],
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

test.describe("Full screen", () => {
	for (const game of ["flappy-head", "bonk", "pinball"]) {
		test(`on a phone, ${game} fills the screen and comes back`, async ({ page, isMobile }) => {
			// The button's only on touch screens
			test.skip(!isMobile, "phones only");
			await page.goto(`/games/${game}`);
			await page.getByRole("button", { name: "Full screen" }).click();
			await expect(page.locator(".page-title")).toBeHidden();
			await expect(page.locator(".scoreboard")).toBeHidden();
			const board = page.locator(".game-stage, .bonk").first();
			const box = await board.boundingBox();
			const screen = page.viewportSize();
			// As big as fits: the whole width, or (a short screen) the whole height
			expect(box.width > screen.width * 0.9 || box.height > screen.height * 0.8).toBe(true);
			expect(box.y + box.height).toBeLessThanOrEqual(screen.height + 1);
			await page.getByRole("button", { name: "Exit full screen" }).click();
			await expect(page.locator(".page-title")).toBeVisible();
		});
	}

	test("the button stays out of the way on a desktop", async ({ page, isMobile }) => {
		test.skip(isMobile, "desktops only");
		await page.goto("/games/snake");
		await expect(page.getByRole("button", { name: "Full screen" })).toBeHidden();
	});
});
