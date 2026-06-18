# Ontological Alignment Engine

A Feelings Wheel that performs the full ritual of emotional precision, then
deterministically hands you a Dinosaur Comic. Same emotions + same day =
same comic, every time — which is the entire trick.

## How it works

1. **Frontend** (`public/`) — a plain HTML/CSS/JS sunburst wheel. No
   build step, no framework. Selecting 1–3 granular emotions and clicking
   "Establish Ontological Alignment" sends them to `/api/comic`.
2. **Resolution logic** (`lib/resolveComic.js`) — alphabetizes the chosen
   emotions, appends today's date, hashes the string, and uses modulo
   against the current Dinosaur Comics archive size to pick a comic ID.
   It looks up the *current* archive size live from qwantz.com's homepage
   each time (cached 1 hour), so it never goes stale — no number to
   manually update.
3. **Backend** — the same `lib/resolveComic.js` is used by two different
   servers, so local dev and production behave identically:
   - `server.js` — a small Express server, for local testing in Claude Code.
   - `api/comic.js` — a Vercel serverless function, for production.

## Why Vercel and not GitHub Pages

GitHub Pages is static-only and can't run the server-side step that scrapes
qwantz.com (a browser can't fetch another site's HTML directly — that's a
CORS wall, not just a qwantz quirk). Vercel's free tier serves the static
frontend *and* runs the `/api` function in one deployment, so it's the
simplest single-service option here. Render or Railway would also work if
you'd rather consolidate hosting there later.

## Local development (Claude Code / Git Bash)

```bash
npm install
npm start
```

Then open `http://localhost:3000`. Click through a full session — select
emotions, click the alignment button, confirm a comic image actually loads.

> **One thing to verify on your end:** this sandbox's network egress is
> locked to a small allowlist of dev domains and doesn't include
> qwantz.com, so I could exercise every code path *except* the live
> scrape itself end-to-end. I fetched qwantz.com's real pages separately
> to confirm the markup my regexes target (`og:image`, `comic=NNNN` links)
> is correct as of today, and the request/response plumbing is tested —
> but please run it locally once before treating it as demo-ready.

## Deploying to Vercel

```bash
npm install -g vercel   # one-time
vercel login
vercel                  # deploys a preview
vercel --prod           # promotes to your production URL
```

Or connect the GitHub repo at vercel.com/new for auto-deploys on push.
No environment variables are required.

## If qwantz.com ever changes its markup

`fetchComicById()` in `lib/resolveComic.js` first tries the `og:image` meta
tag, falling back to the `<img class="comic">` tag. `fetchLatestComicId()`
just takes the highest `comic=NNNN` number found anywhere on the homepage.
Both are deliberately loose rather than tied to exact tag structure, but
if Ryan North redesigns the site, these are the two functions to revisit.

## Project structure

```
.
├── api/comic.js          # Vercel serverless function (production)
├── server.js             # Express server (local dev only)
├── lib/resolveComic.js   # shared logic used by both of the above
├── public/
│   ├── index.html
│   ├── styles.css
│   ├── emotions-data.js  # the 3-tier emotion taxonomy
│   ├── wheel.js           # SVG sunburst layout + rendering
│   └── app.js             # state machine, API calls, animations
└── vercel.json
```
