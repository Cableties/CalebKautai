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

## Still to do

1. **Application form**: create a free form at [formspree.io](https://formspree.io) and paste its endpoint into `contact.formEndpoint` in `src/content.js`. Until then, submitting opens the visitor's email app instead.
2. **Podcast audio** isn't migrated. Download the mp3s from the Wix editor, put them in `public/audio/`, and set each interview's `audio` field, e.g. `audio: '/audio/mika.mp3'`. The players appear once any interview has audio.
3. **Games** and **CoTG** are placeholder pages, hidden from the nav and home page. Their URLs still work.

## Deploy

It's a static site; any static host works. Unknown URLs fall back to `index.html`, which is already configured for:

- **Vercel**: `vercel.json`. Framework preset: Vite. Turn on Web Analytics in the project's dashboard to see visitor stats.
- **Netlify**: `public/_redirects`. Build command `npm run build`, publish dir `dist`. (The Vercel analytics script does nothing here.)

Then point the `calebkautai.com` DNS at the new host.
