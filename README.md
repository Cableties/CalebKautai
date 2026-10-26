# calebkautai.com

Custom React rebuild of the old Wix site. Vite + React + React Router, no backend, plain CSS.

## Run it

Needs Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/, one prerendered HTML file per page
npm run preview    # serve dist/ locally to check the build
```

## Where things live

- `src/content.js`: all copy, links, contact details, nav, page titles/descriptions, podcast interviews, images. Most edits happen here.
- `src/pages/`: one file per page. URLs match the old Wix paths (`/tattoo`, `/aliens`, `/tattoo-work-thing`…), so the tattoo QR code keeps working. `/work` is the same page as `/tattoo-work-thing`, without the "you have selected" banner.
- `src/styles.css`: the whole look. Colour tokens are at the top (light and dark mode).
- `images-src/`: original images, the master copies (not deployed). `public/images/` holds the WebPs the site serves.

## Adding a page

Add a route in `src/App.jsx` and an entry in `pageMeta` in `src/content.js`. The build only prerenders paths listed in `pageMeta`.

## Images

To add or replace one, put the original (jpg/png/gif) in `images-src/`, run `node scripts/optimize-images.mjs`, and add it to `images` in `src/content.js` with the width and height the script prints. The script also regenerates `public/og.png`, the preview image shown when the site is shared.

## Podcast audio

Original recordings go in `audio-src/`. `npm run compress-audio` turns them into small mono files in `public/audio/` (named in lowercase with dashes, e.g. `Matt D.m4a` becomes `matt-d.m4a`). Set the interview's `audio` field in `src/content.js` to match. `audio-src/` is too big for git, so it isn't committed: keep your own copy of the originals.

## Scan counter and reviews

The tattoo page's scan counter and star reviews run on two small Vercel functions in `api/`, storing data in Upstash Redis. To connect the database (once), run `vercel integration add upstash` in a terminal, create a free Redis database, and connect it to the `caleb-kautai` project. Vercel adds the credentials as environment variables; redeploy afterwards. Until then the site works without them: the counter and review form stay hidden, and the old Wix comments still show.

Star ratings count straight away. Written comments wait for approval:

```bash
vercel env pull .env.local         # once, to get the database credentials locally
npm run reviews                    # list comments waiting for approval
npm run reviews -- approve <id>    # publish one (or: approve all)
npm run reviews -- delete <id>     # remove a review and its rating
```

Set `REVIEWS_AUTO_APPROVE=1` in Vercel's environment variables to skip approval. Comments from the old Wix site are in `oldReviews` in `src/content.js`.

To try the functions locally, use `vercel dev` instead of `npm run dev`.

## Tests

```bash
npm run build && npm test   # unit tests, then browser tests on desktop Chrome and an iPhone
```

The browser tests (`tests/e2e/`) use fake API responses, so they don't touch the real database. They also run on GitHub for every push (`.github/workflows/checks.yml`). First time locally: `npx playwright install chromium webkit`.

## Still to do

1. **Application form**: create a free form at [formspree.io](https://formspree.io) and paste its endpoint into `contact.formEndpoint` in `src/content.js`. Until then, submitting opens the visitor's email app instead.
2. **Games** and **CoTG** are placeholder pages, hidden from the nav and home page. Their URLs still work.

## Deploy

It's a static site; any static host works. Unknown URLs fall back to `index.html`, which is already configured for:

- **Vercel**: `vercel.json`. Framework preset: Vite. Turn on Web Analytics in the project's dashboard to see visitor stats.
- **Netlify**: `public/_redirects`. Build command `npm run build`, publish dir `dist`. (The Vercel analytics script does nothing here.)

Then point the `calebkautai.com` DNS at the new host.
