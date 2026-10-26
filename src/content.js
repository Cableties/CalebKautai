// All site copy and data lives here, so updating the site means editing this one file.

// Images were copied off Wix by `npm run fetch-images`, which also converts them to WebP.
// Set this to false to load the originals from Wix's CDN instead.
export const USE_LOCAL_IMAGES = true

// `file` is the downloaded original; the site serves the .webp made from it.
// width/height are the WebP's size, so the browser can reserve space before it loads.
const WIX = 'https://static.wixstatic.com/media/'
export const images = {
  avatar: { file: 'avatar.png', width: 1600, height: 1600, remote: WIX + 'a935b6_f410eaef65ae47a3adad09be75b69fa2~mv2.png' },
  tattooGif: { file: 'caleb-square.gif', width: 560, height: 560, remote: WIX + 'a935b6_95664e7ee0474c62b7882dc9593c077f~mv2.gif' },
  workPhoto: { file: 'work-photo.jpg', width: 600, height: 800, remote: WIX + 'a935b6_c4781f588cca4159a55e4a1b69a1e6ab~mv2.jpg' },
  car: { file: 'car.jpg', width: 919, height: 919, remote: WIX + 'a935b6_6ca540cdb6fe489081ab9683d2f8e42a~mv2.jpg' },
  linkedinShot: { file: 'linkedin.png', width: 826, height: 549, remote: WIX + 'a935b6_182bc101e91943a798181f80183cbb7e~mv2.png' },
  cutie1: { file: 'cutie-1.jpg', width: 1151, height: 1237, remote: WIX + 'a935b6_514ae2e2dfb9446289fc636da399ec4b~mv2.jpg' },
  cutie2: { file: 'cutie-2.jpg', width: 1600, height: 2351, remote: WIX + 'a935b6_7c3611063c1247a288a11cd58e4c0500~mv2.jpg' },
  alchemyBanner: { file: 'masters-of-alchemy.jpg', width: 1600, height: 879, remote: WIX + 'a935b6_e3356326cb29493cb9707d0db24f26b6~mv2.jpg' },
  loading: { file: 'loading.gif', width: 200, height: 202, remote: WIX + 'a935b6_dc5c045db50e408c92341afecba59608~mv2.gif' },
}
// Spread onto an <img>: src plus intrinsic width/height.
export const img = (key) => {
  const { file, width, height, remote } = images[key]
  return { src: USE_LOCAL_IMAGES ? '/images/' + file.replace(/\.\w+$/, '.webp') : remote, width, height }
}

export const contact = {
  email: 'CalebKautai@gmail.com',
  linkedin: 'https://www.linkedin.com/in/caleb-kautai/',
  // Formspree endpoint for the love-interest application, e.g. 'https://formspree.io/f/abcdwxyz'.
  // While it's empty, submitting opens the visitor's email app instead.
  formEndpoint: '',
}

export const socials = [
  { name: 'YouTube', href: 'https://www.youtube.com/@Cableties' },
  { name: 'Instagram', href: 'https://www.instagram.com/cableties/' },
  { name: 'Facebook', href: 'https://www.facebook.com/profile.php?id=100009349392477' },
  { name: 'LinkedIn', href: 'https://www.linkedin.com/in/caleb-kautai/' },
]

// Games and CoTG are left out until they exist; their old URLs still work.
export const nav = [
  { to: '/', label: 'Home' },
  { to: '/work', label: 'Work' },
  { to: '/about', label: 'About' },
  { to: '/tattoo', label: 'Tattoo' },
  { to: '/aliens', label: 'Aliens!' },
  { to: '/find-me', label: 'Find me' },
]

export const intro = 'Software engineer in Brisbane. Makes weird stuff on the side.'

export const thingsToDo = [
  { to: '/tattoo', label: 'My tattoo', note: 'Yes, it has a QR code. Yes, it works.' },
  { to: '/aliens', label: 'Alien podcast', note: 'Interviews with people who may not be people.' },
  { to: '/find-me', label: 'Find me', note: 'Real-time tracking. Totally real.' },
  { to: '/about', label: 'About me', note: 'Two things I learned about myself.' },
]

// Title and description for each page: used for the browser tab, search results and link previews.
// A null title shows the site name on its own.
export const pageMeta = {
  '/': { title: null, description: "Caleb Kautai's corner of the internet. Software engineer in Brisbane, maker of weird stuff." },
  '/work': { title: 'Work', description: 'Caleb Kautai is a software engineer in Brisbane, working in identity and access management.' },
  '/about': { title: 'About', description: "From Bendigo to Brisbane, and the two things I've learned along the way." },
  '/find-me': { title: 'Find Me', description: 'Real-time tracking of Caleb Kautai. Totally real.' },
  '/tattoo': { title: 'Tattoo', description: 'You scanned the tattoo. Now tell me who you are.' },
  '/tattoo-work-thing': { title: 'Work Thing', description: 'Caleb Kautai is a software engineer in Brisbane, working in identity and access management.' },
  '/tattoo-good-friend': { title: 'Good Friend', description: "It's me, Caleb! Your best friend." },
  '/tattoo-love-interest': { title: 'Love Interest', description: 'I have a car. I am employed. Apply within.' },
  '/aliens': { title: 'Aliens!', description: 'One question, asked of everyone: who here is secretly an alien?' },
  '/games': { title: 'Games', description: 'The games are being rebuilt. Check back soon.' },
  '/cotg-submission': { title: 'CoTG', description: "Submissions aren't open yet." },
}
export const notFoundMeta = { title: 'Not found', description: "This page doesn't exist." }
export const SITE_NAME = 'Caleb Kautai: The web experience'

export const testimonial = {
  quote:
    "You're an absolute rockstar. Thank you! I genuinely hope I get a call from Suncorp so I can just keep them on the line for like a 15 minute rant about how great you are and a savant of the technical arts.",
  author: 'Miek Nelligan',
}

export const alchemy = {
  href: 'https://www.mastersofalchemy.au/',
  tagline: "Melbourne's premier game masters for hire",
}

// "Find me" — a random spot inside this box (inner Brisbane, stopping short of the bay) on every load.
export const brisbaneBounds = { south: -27.56, north: -27.38, west: 152.94, east: 153.1 }

// Alien podcast. Originals live in audio-src/; `node scripts/compress-audio.mjs` makes the files in public/audio.
export const interviews = [
  { guest: 'Mika', suspect: 'Matt D', length: '22:33', audio: '/audio/mika.m4a' },
  { guest: 'Jacob', suspect: 'Tony', length: '13:09', audio: '/audio/jacob.m4a' },
  { guest: 'Georgia', suspect: 'Jashan', length: '05:19', audio: '/audio/georgia.m4a' },
  { guest: 'Aidan', suspect: 'Matt D', length: '19:48', audio: '/audio/aidan.m4a' },
  { guest: 'Tom', suspect: 'Matt D', length: '12:37', audio: '/audio/tom.m4a' },
  { guest: 'Matt L', suspect: 'Jason', length: '12:45', audio: '/audio/matt-lee.m4a' },
  { guest: 'Nick', suspect: 'Tony', length: '06:32', audio: '/audio/nick.m4a' },
  { guest: 'Chris', suspect: 'Matt D', length: '04:58', audio: '/audio/chris.m4a' },
  { guest: 'Harriet', suspect: 'Tom', length: '07:33', audio: '/audio/harriet.m4a' },
  { guest: 'Spandan', suspect: 'Aidan', length: '07:05', audio: '/audio/spandan.m4a' },
  { guest: 'Matt D', suspect: 'Tony', length: '12:43', audio: '/audio/matt-d.m4a' },
  { guest: 'Ray', suspect: 'Matt D', length: '16:33', audio: '/audio/ray.m4a' },
  { guest: 'Kiara', suspect: 'Jason', length: '07:59', audio: '/audio/kiara.m4a' },
  { guest: 'Pat', suspect: 'Georgia', length: '16:58', audio: '/audio/pat.m4a' },
  { guest: 'Tremaine', suspect: 'Thanakon', length: '08:49', audio: '/audio/tremaine.m4a' },
  { guest: 'Will', suspect: 'Tremaine', length: '08:13', audio: '/audio/will.m4a' },
  { guest: 'Jed', suspect: 'Matt D', length: '16:21', audio: '/audio/jed.m4a' },
  { guest: 'Caleb', suspect: 'Georgia', length: '26:30', audio: '/audio/caleb.m4a' },
]

export const alienIdentifiers = [
  ['Superior intelligence', 'Exhibits advanced cognitive processing, including rapid problem-solving, high retention of information, and efficient pattern recognition. May demonstrate an ability to learn new concepts at an accelerated rate.'],
  ['Inconsistent knowledge', 'Displays expertise in highly specialized fields such as mathematics, physics, or linguistics, yet lacks familiarity with common cultural references, idioms, or routine human activities.'],
  ['Curious & inquisitive', 'Engages in persistent information-gathering behaviors, frequently asking structured, analytical or personal questions to refine understanding of human customs and societal norms.'],
  ['Unusual thought patterns', 'Processes information through a highly logical, systematic, or structured framework. May exhibit difficulty with subjective reasoning, emotional inference, or abstract social concepts.'],
  ['Innate distinctiveness', 'Exhibits naturally unconventional behaviors, mannerisms, or ways of thinking that set them apart. This may manifest as an unusual sense of humor, unique interests, or an idiosyncratic approach to social interactions—ranging from charming eccentricity to an almost calculated distinctiveness.'],
  ['Unconventional social interactions', 'Exhibits social behaviors that may deviate from typical norms in either direction—ranging from difficulty with eye contact, personal space, or interpreting sarcasm, to an overly polished and precise social demeanor that may feel rehearsed or excessively charismatic.'],
  ['Atypical speech patterns', 'Speech may range from highly formal, structured, and grammatically rigid—lacking contractions and colloquialisms—to excessively loose, disjointed, or nonsensical, with unconventional word choices or unusual sentence structures.'],
  ['Mimicking human behavior', 'Observes and replicates human social behaviors with high accuracy but may exhibit overcorrection, resulting in interactions that appear rehearsed, exaggerated, or slightly asynchronous.'],
  ['Unusual emotional responses', 'Displays affective expressions that deviate from standard human expectations, such as delayed emotional reactions, muted distress responses, or an analytical rather than instinctive approach to humor or social bonding.'],
  ['Avoidance of personal history', 'Provides vague, non-specific, or inconsistently detailed accounts of past experiences. May exhibit a preference for present-focused discussions and a reluctance to engage in autobiographical recall.'],
]
