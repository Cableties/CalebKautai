// All site copy and data lives here, so updating the site means editing this one file.

// Images were copied off Wix by `npm run fetch-images`, which also converts them to WebP.
// Set this to false to load the originals from Wix's CDN instead.
export const USE_LOCAL_IMAGES = true;

// `file` is the downloaded original; the site serves the .webp made from it.
// width/height are the WebP's size, so the browser can reserve space before it loads.
const WIX = "https://static.wixstatic.com/media/";
export const images = {
	// Head-on-a-plate at Illusions Sydney (replaced the old Wix avatar, so no Wix copy)
	avatar: {
		file: "avatar.png",
		width: 1371,
		height: 1398,
		remote: "/images/avatar.webp",
	},
	tattooGif: {
		file: "caleb-square.gif",
		width: 560,
		height: 560,
		remote: WIX + "a935b6_95664e7ee0474c62b7882dc9593c077f~mv2.gif",
	},
	// Spinning face on the tattoo page (transparent background). Never on Wix, so no remote.
	face: {
		file: "caleb-face.gif",
		width: 524,
		height: 574,
		remote: "/images/caleb-face.webp",
	},
	workPhoto: {
		file: "work-photo.jpg",
		width: 600,
		height: 800,
		remote: WIX + "a935b6_c4781f588cca4159a55e4a1b69a1e6ab~mv2.jpg",
	},
	car: {
		file: "car.jpg",
		width: 919,
		height: 919,
		remote: WIX + "a935b6_6ca540cdb6fe489081ab9683d2f8e42a~mv2.jpg",
	},
	linkedinShot: {
		file: "linkedin.png",
		width: 826,
		height: 549,
		remote: WIX + "a935b6_182bc101e91943a798181f80183cbb7e~mv2.png",
	},
	cutie1: {
		file: "cutie-1.jpg",
		width: 1151,
		height: 1237,
		remote: WIX + "a935b6_514ae2e2dfb9446289fc636da399ec4b~mv2.jpg",
	},
	cutie2: {
		file: "cutie-2.jpg",
		width: 1600,
		height: 2351,
		remote: WIX + "a935b6_7c3611063c1247a288a11cd58e4c0500~mv2.jpg",
	},
	alchemyBanner: {
		file: "masters-of-alchemy.jpg",
		width: 1600,
		height: 879,
		remote: WIX + "a935b6_e3356326cb29493cb9707d0db24f26b6~mv2.jpg",
	},
	loading: {
		file: "loading.gif",
		width: 200,
		height: 202,
		remote: WIX + "a935b6_dc5c045db50e408c92341afecba59608~mv2.gif",
	},
};
// Spread onto an <img>: src plus intrinsic width/height.
export const img = (key) => {
	const { file, width, height, remote } = images[key];
	return {
		src: USE_LOCAL_IMAGES
			? "/images/" + file.replace(/\.\w+$/, ".webp")
			: remote,
		width,
		height,
	};
};

export const contact = {
	email: "CalebKautai@gmail.com",
	linkedin: "https://www.linkedin.com/in/caleb-kautai/",
	// Formspree endpoint for the love-interest application, e.g. 'https://formspree.io/f/abcdwxyz'.
	// While it's empty, submitting opens the visitor's email app instead.
	formEndpoint: "https://formspree.io/f/mgaaavoy",
};

export const socials = [
	{ name: "YouTube", href: "https://www.youtube.com/@Cableties" },
	{ name: "Instagram", href: "https://www.instagram.com/cableties/" },
	{
		name: "Facebook",
		href: "https://www.facebook.com/profile.php?id=100009349392477",
	},
	{ name: "LinkedIn", href: "https://www.linkedin.com/in/caleb-kautai/" },
];

// Games and CoTG are left out until they exist; their old URLs still work.
export const nav = [
	{ to: "/", label: "Home" },
	{ to: "/work", label: "Work" },
	{ to: "/about", label: "About" },
	{ to: "/tattoo", label: "Tattoo" },
	{ to: "/aliens", label: "Aliens!" },
	{ to: "/find-me", label: "Find me" },
	{ to: "/cheat-codes", label: "Cheat codes" },
];

export const intro =
	"Software engineer in Brisbane. Makes weird stuff on the side.";

export const thingsToDo = [
	{
		to: "/tattoo",
		label: "My tattoo",
		note: "Yes, it has a QR code. Yes, it works.",
	},
	{
		to: "/aliens",
		label: "Alien podcast",
		note: "Interviews with people who may not be people.",
	},
	{
		to: "/find-me",
		label: "Find me",
		note: "Real-time tracking. Totally real.",
	},
	{
		to: "/about",
		label: "About me",
		note: "Two things I learned about myself.",
	},
];

// Title and description for each page: used for the browser tab, search results and link previews.
// A null title shows the site name on its own.
export const pageMeta = {
	"/": {
		title: null,
		description:
			"Caleb Kautai's corner of the internet. Software engineer in Brisbane, maker of weird stuff.",
	},
	"/work": {
		title: "Work",
		description:
			"Caleb Kautai is a software engineer in Brisbane, working in identity and access management.",
	},
	"/about": {
		title: "About",
		description:
			"From Bendigo to Brisbane, and the two things I've learned along the way.",
	},
	"/find-me": {
		title: "Find Me",
		description: "Real-time tracking of Caleb Kautai. Totally real.",
	},
	"/tattoo": {
		title: "Tattoo",
		description: "You scanned the tattoo. Now tell me who you are.",
	},
	"/tattoo-work-thing": {
		title: "Work Thing",
		description:
			"Caleb Kautai is a software engineer in Brisbane, working in identity and access management.",
	},
	"/tattoo-good-friend": {
		title: "Good Friend",
		description: "It's me, Caleb! Your best friend.",
	},
	"/tattoo-love-interest": {
		title: "Love Interest",
		description: "I have a car. I am employed. Apply within.",
	},
	"/aliens": {
		title: "Aliens!",
		description:
			"One question, asked of everyone: who here is secretly an alien?",
	},
	"/games": {
		title: "Games",
		description: "The games are being rebuilt. Check back soon.",
	},
	"/cotg-submission": {
		title: "CoTG",
		description: "Submissions aren't open yet.",
	},
	"/cheat-codes": {
		title: "Cheat codes",
		description: "Head Mode, Dance Mode, Australia Mode. Use responsibly.",
	},
};
export const notFoundMeta = {
	title: "Not found",
	description: "This page doesn't exist.",
};
export const SITE_NAME = "Caleb Kautai: The web experience";

export const testimonial = {
	quote:
		"You're an absolute rockstar. Thank you! I genuinely hope I get a call from Suncorp so I can just keep them on the line for like a 15 minute rant about how great you are and a savant of the technical arts.",
	author: "Miek Nelligan",
};

export const alchemy = {
	href: "https://www.mastersofalchemy.au/",
	tagline: "Melbourne's premier game masters for hire",
};

// Work page: what I can do, grouped.
export const skills = [
	{
		group: "Identity & access",
		items: [
			"ForgeRock Access Manager",
			"Identity Manager",
			"Identity Gateway",
			"Directory Services",
		],
	},
	{
		group: "Code",
		items: ["Java", "JavaScript", "React", "Python", "Kotlin"],
	},
	{
		group: "Design & media",
		items: [
			"Adobe Creative Cloud",
			"Photo editing",
			"Animation",
			"Video & VFX",
			"Audio editing",
		],
	},
];

// Work page: selected projects. `image` is a key from `images` above; `link` is optional.
export const projects = [
	{
		name: "Identity platform replacement",
		context: "Suncorp Bank · ForgeRock developer",
		summary:
			"Migrating the bank's identity services onto an on-prem ForgeRock platform.",
		points: [
			"Working across ForgeRock Identity Gateway, Identity Manager, Directory Services and Access Manager.",
			"Building and integrating custom Java extensions for Access Manager.",
		],
		tags: ["ForgeRock", "Java", "IAM"],
	},
	{
		name: "WristChord",
		context: "Galaxy Watch app · in progress",
		summary:
			"Guitar and ukulele chord charts on your wrist, scrolling along while you play.",
		points: [
			"Wear OS app with song search, hands-free scrolling controlled by the watch's rotating bezel, adjustable scroll speed and chord transposition.",
			"Works out ukulele chord shapes from music theory instead of a lookup table, so every key lands on the easiest fingering.",
			"Companion phone app that syncs saved songs to the watch, plus a small Go backend with caching that serves the chord data.",
		],
		tags: ["Kotlin", "Wear OS", "Jetpack Compose", "Go"],
		link: "https://github.com/Cableties/WristChord-WearOs",
	},
	{
		name: "brb",
		context: "Android app · in progress",
		summary:
			"Fakes an incoming phone call so you can escape a conversation.",
		points: [
			"Convincing call screens in two styles, a classic mobile call or a work video call, using the phone's own ringtone.",
			"Answering plays a muffled voice through the earpiece, with working mute and speaker buttons, and the screen switches off when the phone meets your ear.",
		],
		tags: ["Kotlin", "Android", "Jetpack Compose"],
		link: "https://github.com/Cableties/brb",
	},
	{
		name: "Masters of Alchemy",
		context: "Sole developer",
		summary: `Website for ${alchemy.tagline}: a service that books dungeon masters for Dungeons & Dragons games.`,
		points: [
			"Designed and built the whole site on my own.",
			"Still in use by the business today.",
		],
		tags: ["Web development", "Design"],
		image: "alchemyBanner",
		link: "https://www.mastersofalchemy.au/",
	},
	{
		name: "calebkautai.com",
		context: "Personal site · this one",
		summary:
			"Rebuilt from Wix as a custom React site, with a QR-code tattoo that lands on its own page.",
		points: [
			"Every page prerendered to static HTML for fast loads and proper link previews.",
			"Serverless scan counter and reviews, a podcast player that keeps playing between pages, and automated browser tests on every push.",
		],
		tags: ["React", "Vite", "Vercel", "Playwright"],
		link: "https://github.com/Cableties/CalebKautai",
	},
	{
		name: "Aliens! podcast",
		context: "Creative project",
		summary:
			"One question, asked of everyone: who here is secretly an alien?",
		points: [
			"18 recorded interviews and counting, with a running tally of the most suspected.",
		],
		tags: ["Audio", "Interviewing"],
		to: "/aliens",
	},
];

export const githubProfile = "https://github.com/Cableties";

// Good friend page: "How good a friend are you really?" (components/FriendQuiz.jsx).
// Question types:
//   choice    — `answer` plus wrong `options`, shuffled
//   tictactoe — beat the computer
//   map       — drag a pin onto `place`; within `withinKm` counts; `view` is the starting area
//   draw      — draw me; any attempt scores, and it's shown next to the real `image`
// `after` is the line shown once they've answered (for draw, one of `verdicts` at random).
export const friendQuiz = [
	{
		type: "choice",
		question: "What year was I born?",
		answer: "2001",
		options: ["1999", "2000", "2002"],
		after: "2001. A vintage year.",
	},
	{
		type: "choice",
		question: "How did I break my ankle?",
		answer: "Freak rollerskating accident",
		options: [
			"Fighting a kangaroo",
			"Tripped over a D&D dice",
			"Dancing too hard at a wedding",
		],
		after: "Rollerskates: 1, Caleb: 0.",
	},
	{
		type: "choice",
		question: "What's my middle name?",
		answer: "Teura",
		options: ["Teina", "Benjamin", "Taika"],
		after: "Teura. Not Taika, sadly.",
	},
	{
		type: "choice",
		question: "Is it a parma or a parmy?",
		answer: "Parma",
		options: ["Parmy"],
		after: "It's a parma. This is not up for debate.",
	},
	{
		type: "choice",
		question: "Who's my favourite Pokémon?",
		answer: "Turtwig",
		options: ["Chimchar", "Piplup", "Pikachu"],
		after: "Turtwig. A tree on a turtle. Perfect.",
	},
	{
		type: "choice",
		question: "Where did I get my degree?",
		answer: "Deakin Uni",
		options: ["Monash", "RMIT", "Uni of Melbourne"],
		after: "Deakin, IT with a focus on app development.",
	},
	{
		type: "tictactoe",
		question: "Win at knots and crosses",
		after: "Friendship requires sacrifice. Mostly mine.",
	},
	{
		type: "map",
		question: "Drop the pin on the city I was born in",
		place: { name: "Mt Isa", lat: -20.7256, lng: 139.4927 },
		withinKm: 200,
		// What the map shows to start with: Australia
		view: [
			[-43.7, 113],
			[-10.5, 153.7],
		],
		after: "Mount Isa, Queensland. Outback born.",
	},
	{
		type: "draw",
		question: "Finally: draw me",
		image: "workPhoto",
		verdicts: [
			"Uncanny. Are you a professional?",
			"Honestly better than my passport photo.",
			"My mum is going to frame this.",
			"I've never felt so seen.",
			"Gallery-worthy. Possibly a crime.",
		],
	},
];

// Quiz ranks, from the lowest score up: shown if they got at least `min` of the questions right
export const friendRanks = [
	{ min: 0, title: "Have we met?", text: "I'm going to pretend this didn't happen." },
	{ min: 0.4, title: "Acquaintance", text: "We've definitely nodded at each other once." },
	{ min: 0.6, title: "Mate", text: "Solid. You can come to the barbecue." },
	{ min: 0.8, title: "Good friend", text: "You know me better than my bank does." },
	{ min: 1, title: "Certified bestie", text: "Perfect score. Frankly, a little concerning." },
];

// Reviews left on the old Wix tattoo page (all 5 stars), shown under the new ones and counted in
// the average. Emails left out.
export const oldReviews = [
	{ name: "Silly McBilly", rating: 5, comment: "Shared 4105", date: "2025-12-10" },
	{ name: "Liam", rating: 5, comment: "Changed my life", date: "2025-02-08" },
	{ name: "Nick", rating: 5, comment: "Awesome", date: "2024-12-20" },
	{ name: "H", rating: 5, comment: "awesome", date: "2024-04-16" },
	{
		name: "Secret Admirer",
		rating: 5,
		comment: "I had a great time on this website! I love surfing the web",
		date: "2023-12-17",
	},
	{ name: "Kevin Zhou", rating: 5, comment: "🔥🔥", date: "2023-12-13" },
	{
		name: "Saima Hassan",
		rating: 5,
		comment: "So cool..🔥🔥👏🏼👏🏼",
		date: "2023-09-04",
	},
	{ name: "fringly slompo", rating: 5, comment: "You are cool", date: "2023-04-13" },
	{
		name: "Aunty Tania",
		rating: 5,
		comment: "This is pretty fukin cool nephew 👍😁",
		date: "2023-03-30",
	},
	{
		name: "Jimbles Blonkby",
		rating: 5,
		comment:
			"Very epic i love it so much i'm your biggest fan ❤❤😳😳😳😍😍😍😍😍😍😆😆😆😆😆😆😆😆😆",
		date: "2023-03-27",
	},
	{
		name: "Cableties",
		rating: 5,
		comment: "Wow great tattoo! I love it!❤",
		date: "2023-03-27",
	},
];

// "Find me" — a random spot inside this box (inner Brisbane, stopping short of the bay) on every load.
export const brisbaneBounds = {
	south: -27.56,
	north: -27.38,
	west: 152.94,
	east: 153.1,
};

// Alien podcast. Originals live in audio-src/; `node scripts/compress-audio.mjs` makes the files in public/audio.
export const interviews = [
	{
		guest: "Mika",
		suspect: "Matt D",
		length: "22:33",
		audio: "/audio/mika.m4a",
	},
	{
		guest: "Jacob",
		suspect: "Tony",
		length: "13:09",
		audio: "/audio/jacob.m4a",
	},
	{
		guest: "Georgia",
		suspect: "Jashan",
		length: "05:19",
		audio: "/audio/georgia.m4a",
	},
	{
		guest: "Aidan",
		suspect: "Matt D",
		length: "19:48",
		audio: "/audio/aidan.m4a",
	},
	{ guest: "Tom", suspect: "Matt D", length: "12:37", audio: "/audio/tom.m4a" },
	{
		guest: "Matt L",
		suspect: "Jason",
		length: "12:45",
		audio: "/audio/matt-lee.m4a",
	},
	{ guest: "Nick", suspect: "Tony", length: "06:32", audio: "/audio/nick.m4a" },
	{
		guest: "Chris",
		suspect: "Matt D",
		length: "04:58",
		audio: "/audio/chris.m4a",
	},
	{
		guest: "Harriet",
		suspect: "Tom",
		length: "07:33",
		audio: "/audio/harriet.m4a",
	},
	{
		guest: "Spandan",
		suspect: "Aidan",
		length: "07:05",
		audio: "/audio/spandan.m4a",
	},
	{
		guest: "Matt D",
		suspect: "Tony",
		length: "12:43",
		audio: "/audio/matt-d.m4a",
	},
	{ guest: "Ray", suspect: "Matt D", length: "16:33", audio: "/audio/ray.m4a" },
	{
		guest: "Kiara",
		suspect: "Jason",
		length: "07:59",
		audio: "/audio/kiara.m4a",
	},
	{
		guest: "Pat",
		suspect: "Georgia",
		length: "16:58",
		audio: "/audio/pat.m4a",
	},
	{
		guest: "Tremaine",
		suspect: "Thanakon",
		length: "08:49",
		audio: "/audio/tremaine.m4a",
	},
	{
		guest: "Will",
		suspect: "Tremaine",
		length: "08:13",
		audio: "/audio/will.m4a",
	},
	{ guest: "Jed", suspect: "Matt D", length: "16:21", audio: "/audio/jed.m4a" },
	{
		guest: "Caleb",
		suspect: "Georgia",
		length: "26:30",
		audio: "/audio/caleb.m4a",
	},
];

export const alienIdentifiers = [
	[
		"Superior intelligence",
		"Exhibits advanced cognitive processing, including rapid problem-solving, high retention of information, and efficient pattern recognition. May demonstrate an ability to learn new concepts at an accelerated rate.",
	],
	[
		"Inconsistent knowledge",
		"Displays expertise in highly specialized fields such as mathematics, physics, or linguistics, yet lacks familiarity with common cultural references, idioms, or routine human activities.",
	],
	[
		"Curious & inquisitive",
		"Engages in persistent information-gathering behaviors, frequently asking structured, analytical or personal questions to refine understanding of human customs and societal norms.",
	],
	[
		"Unusual thought patterns",
		"Processes information through a highly logical, systematic, or structured framework. May exhibit difficulty with subjective reasoning, emotional inference, or abstract social concepts.",
	],
	[
		"Innate distinctiveness",
		"Exhibits naturally unconventional behaviors, mannerisms, or ways of thinking that set them apart. This may manifest as an unusual sense of humor, unique interests, or an idiosyncratic approach to social interactions—ranging from charming eccentricity to an almost calculated distinctiveness.",
	],
	[
		"Unconventional social interactions",
		"Exhibits social behaviors that may deviate from typical norms in either direction—ranging from difficulty with eye contact, personal space, or interpreting sarcasm, to an overly polished and precise social demeanor that may feel rehearsed or excessively charismatic.",
	],
	[
		"Atypical speech patterns",
		"Speech may range from highly formal, structured, and grammatically rigid—lacking contractions and colloquialisms—to excessively loose, disjointed, or nonsensical, with unconventional word choices or unusual sentence structures.",
	],
	[
		"Mimicking human behavior",
		"Observes and replicates human social behaviors with high accuracy but may exhibit overcorrection, resulting in interactions that appear rehearsed, exaggerated, or slightly asynchronous.",
	],
	[
		"Unusual emotional responses",
		"Displays affective expressions that deviate from standard human expectations, such as delayed emotional reactions, muted distress responses, or an analytical rather than instinctive approach to humor or social bonding.",
	],
	[
		"Avoidance of personal history",
		"Provides vague, non-specific, or inconsistently detailed accounts of past experiences. May exhibit a preference for present-focused discussions and a reluctance to engage in autobiographical recall.",
	],
];
