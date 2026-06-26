# Dinosaur Comics Therapy

*a.k.a. the Maastrichtian Emotional Regulations Protocol (v1.3) — or the upgraded Holocene Gödelian Emotional Regulation Protocol (HGERP v2.1)*

A Feelings Wheel that performs the full ritual of emotional precision, then
deterministically hands you a curated comic. Select up to three emotions,
let the Maastrichtian emotional regulation protocol do its work, and receive
your comic. Same emotions + same day + same tier = same comic, every time.

**Live site:** https://emotional-regulation-protocol.vercel.app/

## How it works

1. **Frontend** (`public/`) — a plain HTML/CSS/JS sunburst wheel with three
   selectable rings. No build step, no framework. Selecting 1–3 emotions and
   clicking "Get Dino Therapy" sends them to `/api/comic`.
2. **Resolution logic** (`lib/seed.js`) — alphabetizes the chosen emotions,
   appends today's date and the active tier, and hashes the string (djb2).
   Including the tier in the seed means a given day + emotion set resolves
   to a fixed comic *per tier* — the same input always lands on the same
   Dinosaur Comics strip in standard mode, and the same xkcd strip in
   upgraded mode.
3. **Two comic sources, selectable as a tier:**
   - **Standard** (`lib/resolveComic.js`) — Dinosaur Comics. Looks up the
     *current* archive size live from qwantz.com's homepage each time
     (cached 1 hour), so it never goes stale.
   - **Upgraded** (`lib/resolveXkcd.js`) — xkcd, via its official
     `info.0.json` endpoint. Handles the one real gap in the archive
     (comic #404 intentionally 404s) by walking forward deterministically
     until it finds a real comic.
4. **Backend** — the same resolution logic is used by two different
   servers so local dev and production behave identically:
   - `server.js` — a small Express server, for local development.
   - `api/comic.js` — a Vercel serverless function, for production.

## Feedback & outcomes tracking

After receiving a comic, the user can respond whether it helped
(`yes` / `no`), or opt to try the upgraded tier (`upgrade_requested`).

- `api/feedback.js` validates (`lib/validateFeedback.js`) and persists
  (`lib/store.js`) each response.
- Storage is Vercel Blob in production (one independent JSON blob per
  response — no shared file gets read/modified/rewritten, so concurrent
  submissions never race). Local dev without a Blob token falls back to
  appending NDJSON under `local-data/` (gitignored). To test real Blob
  writes locally, run `vercel dev` instead of `npm start` — it injects the
  token automatically.
- `api/stats.js` aggregates all stored responses into totals (dino yes/no,
  upgraded yes/no, upgrade-requested count), surfaced at `/stats.html`
  ("Protocol Outcomes," linked from the site footer).

## Sharing a result

After a comic is revealed, a 🔗 button next to "view on qwantz.com" (or
xkcd.com) lets the user copy a shareable link.

- `POST /api/share` writes a small JSON payload (`emotions`, `tier`,
  `comicId`, `source`) to Vercel Blob under a random 6-character base62
  token and returns that token. For standard-tier shares, it also
  best-effort pre-computes the matching upgraded (xkcd) comic so
  recipients can try Upgraded Therapy without date drift breaking the
  match; if that pre-computation fails, the share is still created, just
  without the upgrade option for that link.
- The resulting URL is `https://.../share/TOKEN`. A `vercel.json` rewrite
  maps `/share/:token` to `public/share.html`, which fetches the payload
  via `GET /api/share/:token` (`api/share/[token].js`) and replays the
  exact same comic by ID — bypassing the date-sensitive hash via the
  `comicId` param now accepted by `POST /api/comic`.
- Share tokens are opaque; no emotion names ever appear in the URL.
- `public/share.html` / `public/share.js` are intentionally standalone —
  they don't load the wheel, since recipients only ever view a result.
- All asset references in `share.html` (`/styles.css`, `/share.js`) must
  stay absolute paths. Because the Vercel rewrite preserves the browser
  URL at `/share/TOKEN`, a relative path resolves against `/share/`
  instead of root and silently 404s.

## Local development

```bash
npm install
npm start
```

Then open `http://localhost:3000`. Select emotions, click "Get Dino Therapy",
and confirm a comic image loads. Feedback writes will fall back to a local
NDJSON file (see above) unless run via `vercel dev`.

## Deploying to Vercel

The repo is connected to Vercel for auto-deploys on push to `main`.

If setting up from scratch:
- Connect the repo at vercel.com/new
- Under **Settings → General → Framework Preset**, set to **Other**
- Connect a Vercel Blob store to the project (Storage tab → Create
  Database → Blob), with **Public** access — `@vercel/blob` 0.27.x only
  supports `access: 'public'` in `put()`, so a private store will reject
  every write with "access must be 'public'".
- Connecting a store does **not** automatically inject
  `BLOB_READ_WRITE_TOKEN` on this account/plan — only `BLOB_STORE_ID` and
  `BLOB_WEBHOOK_PUBLIC_KEY` show up by default, and the older
  `@vercel/blob` version in use here doesn't know how to authenticate
  with `BLOB_STORE_ID` alone. After creating the store, open its
  **`.env.local`** tab, copy the `BLOB_READ_WRITE_TOKEN` value, and add it
  manually under **Settings → Environment Variables**, then redeploy.

## If qwantz.com or xkcd.com ever change their markup

- `fetchComicById()` in `lib/resolveComic.js` first tries the `og:image`
  meta tag, falling back to the `<img class="comic">` tag.
  `fetchLatestComicId()` takes the highest `comic=NNNN` number found
  anywhere on the homepage. If Ryan North redesigns the site, these are
  the two functions to revisit.
- `lib/resolveXkcd.js` relies on xkcd's official JSON API
  (`/info.0.json`), which is far more stable than scraping — unlikely to
  need revisiting unless xkcd changes its API shape.

## Project structure

```
.
├── api/
│   ├── comic.js              # POST /api/comic — resolves a comic for given emotions + tier, or by comicId
│   ├── feedback.js           # POST /api/feedback — records a response
│   ├── stats.js              # GET /api/stats — aggregated feedback totals
│   ├── share.js              # POST /api/share — creates a share token
│   └── share/
│       └── [token].js        # GET /api/share/:token — retrieves a share payload
├── server.js                 # Express server (local dev only) — mirrors all api/ routes
├── lib/
│   ├── seed.js                # shared deterministic hash/seed logic
│   ├── resolveComic.js        # standard tier — Dinosaur Comics
│   ├── resolveXkcd.js         # upgraded tier — xkcd
│   ├── validateFeedback.js    # whitelists/validates feedback payloads
│   ├── store.js                # writes feedback (Vercel Blob, or local NDJSON fallback)
│   └── readFeedback.js        # reads all stored feedback, for stats
├── public/
│   ├── index.html
│   ├── stats.html             # "Protocol Outcomes" page
│   ├── about.html             # "About the Emotional Regulation Protocol" page
│   ├── share.html             # recipient view for a shared link (served at /share/:token)
│   ├── share.js               # standalone script for share.html — no wheel
│   ├── styles.css
│   ├── emotions-data.js       # 3-tier emotion taxonomy
│   ├── wheel.js               # SVG sunburst layout + rendering
│   └── app.js                 # state, API calls, animations
└── vercel.json                # outputDirectory + rewrite: /share/:token → /share.html
```

## Attributions

- Dinosaur Comics by [Ryan North](https://www.qwantz.com)
- xkcd by [Randall Munroe](https://xkcd.com)
- Feelings Wheel by [Geoffrey Roberts](https://feelingswheel.app/)
