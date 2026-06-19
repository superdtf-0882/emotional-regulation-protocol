# Dinosaur Comics Therapy

A Feelings Wheel that performs the full ritual of emotional precision, then
deterministically hands you a Dinosaur Comic. Select up to three emotions,
let the Maastrichtian emotional regulation protocol do its work, and receive
your curated comic. Same emotions + same day = same comic, every time.

**Live site:** https://emotional-regulation-protocol.vercel.app/

## How it works

1. **Frontend** (`public/`) — a plain HTML/CSS/JS sunburst wheel with three
   selectable rings. No build step, no framework. Selecting 1–3 emotions and
   clicking "Get Dino Therapy" sends them to `/api/comic`.
2. **Resolution logic** (`lib/resolveComic.js`) — alphabetizes the chosen
   emotions, appends today's date, hashes the string (djb2), and uses modulo
   against the current Dinosaur Comics archive size to pick a comic ID.
   It looks up the *current* archive size live from qwantz.com's homepage
   each time (cached 1 hour), so it never goes stale.
3. **Backend** — the same `lib/resolveComic.js` is used by two different
   servers so local dev and production behave identically:
   - `server.js` — a small Express server, for local development.
   - `api/comic.js` — a Vercel serverless function, for production.

## Local development

```bash
npm install
npm start
```

Then open `http://localhost:3000`. Select emotions, click "Get Dino Therapy",
and confirm a comic image loads.

## Deploying to Vercel

The repo is connected to Vercel for auto-deploys on push to `main`.

If setting up from scratch:
- Connect the repo at vercel.com/new
- Under **Settings → General → Framework Preset**, set to **Other**
- No environment variables are required

## If qwantz.com ever changes its markup

`fetchComicById()` in `lib/resolveComic.js` first tries the `og:image` meta
tag, falling back to the `<img class="comic">` tag. `fetchLatestComicId()`
takes the highest `comic=NNNN` number found anywhere on the homepage.
If Ryan North redesigns the site, these are the two functions to revisit.

## Project structure

```
.
├── api/comic.js          # Vercel serverless function (production)
├── server.js             # Express server (local dev only)
├── lib/resolveComic.js   # shared resolution logic
├── public/
│   ├── index.html
│   ├── styles.css
│   ├── emotions-data.js  # 3-tier emotion taxonomy
│   ├── wheel.js          # SVG sunburst layout + rendering
│   └── app.js            # state, API calls, animations
└── vercel.json
```

## Attributions

- Dinosaur Comics by [Ryan North](https://www.qwantz.com)
- Feelings Wheel by [Geoffrey Roberts](https://feelingswheel.app/)
