'use strict';

/**
 * Core resolution logic for the Ontological Alignment Engine.
 *
 * Given 1–3 selected emotions, this deterministically "hashes" them
 * (plus today's date) into a Dinosaur Comics ID, then scrapes qwantz.com
 * for that comic's image. Same emotions + same day = same comic, every
 * time — which is the entire trick.
 *
 * This file has no framework dependencies (no Express, no Vercel types)
 * so it can be required identically from server.js (local dev) and
 * api/comic.js (Vercel serverless function).
 */

const QWANTZ_BASE = 'https://www.qwantz.com';

// Last-resort floor if a live lookup of the newest comic ID ever fails
// (network hiccup, qwantz redesign, etc). Comic #4481 ran June 8, 2026.
// This number will get stale over time, but it's only a fallback —
// fetchLatestComicId() always tries the live site first.
const FALLBACK_LATEST_COMIC_ID = 4481;

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; OntologicalAlignmentEngine/1.0; +https://davidfacer.com)',
};

// Simple in-memory cache so a warm serverless instance doesn't hit
// qwantz.com's homepage on every single request just to learn the
// current comic count. Cold starts just re-fetch, which is fine.
let latestIdCache = { id: null, fetchedAt: 0 };
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * djb2 string hash. Doesn't need to be cryptographically anything —
 * just needs to be deterministic and spread reasonably across outputs.
 */
function djb2Hash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0; // force unsigned 32-bit
}

/** YYYY-MM-DD in UTC, so the seed doesn't shift with server timezone. */
function todayDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/** Alphabetize + lowercase emotions, then append the date, per the spec. */
function buildSeed(emotions, dateString) {
  const normalized = [...emotions]
    .map((e) => String(e).trim().toLowerCase())
    .filter(Boolean)
    .sort();
  return `${normalized.join('-')}-${dateString}`;
}

/**
 * Finds the highest comic ID referenced anywhere on qwantz.com's
 * homepage. The homepage always links to itself (og:url, share links,
 * permalink) using the *current* comic's ID, and to "previous comic"
 * using current-1 — so the maximum of every "comic=NNNN" match on the
 * page is reliably the latest comic. This is deliberately loose about
 * exact tag structure so it keeps working if qwantz.com's markup shifts.
 */
async function fetchLatestComicId() {
  const now = Date.now();
  if (latestIdCache.id && now - latestIdCache.fetchedAt < CACHE_TTL_MS) {
    return latestIdCache.id;
  }

  try {
    const res = await fetch(`${QWANTZ_BASE}/index.php`, { headers: FETCH_HEADERS });
    if (!res.ok) throw new Error(`qwantz homepage responded ${res.status}`);
    const html = await res.text();

    const matches = [...html.matchAll(/comic=(\d+)/g)].map((m) => parseInt(m[1], 10));
    const latest = matches.length ? Math.max(...matches) : null;

    if (latest && Number.isFinite(latest)) {
      latestIdCache = { id: latest, fetchedAt: now };
      return latest;
    }
    throw new Error('no comic=NNNN references found on homepage');
  } catch (err) {
    console.warn('[resolveComic] latest comic lookup failed, using fallback:', err.message);
    return FALLBACK_LATEST_COMIC_ID;
  }
}

/**
 * Fetches a single comic page and extracts the image URL + a couple of
 * display fields. Prefers the og:image meta tag (simple, stable) over
 * parsing the <img class="comic"> tag, since meta tags survive markup
 * changes better and qwantz.com keeps them in sync with the real image.
 */
async function fetchComicById(id) {
  const pageUrl = `${QWANTZ_BASE}/index.php?comic=${id}`;
  const res = await fetch(pageUrl, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`qwantz responded ${res.status} for comic ${id}`);
  const html = await res.text();

  const imageMatch =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<img[^>]+class=["']comic["'][^>]+src=["']([^"']+)["']/i);

  if (!imageMatch) throw new Error(`could not locate an image for comic ${id}`);

  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  const descMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);

  return {
    id,
    imageUrl: imageMatch[1],
    pageUrl,
    title: titleMatch ? titleMatch[1].trim() : null,
    blurb: descMatch ? descMatch[1].trim() : null,
  };
}

/**
 * The whole pipeline: emotions in, "diagnosis" out.
 */
async function resolveComicForEmotions(emotions, date = new Date()) {
  if (!Array.isArray(emotions) || emotions.length < 1 || emotions.length > 3) {
    throw new RangeError('Provide between 1 and 3 emotions.');
  }

  const dateString = todayDateString(date);
  const seed = buildSeed(emotions, dateString);
  const hash = djb2Hash(seed);
  const totalComics = await fetchLatestComicId();
  const comicId = (hash % totalComics) + 1; // 1-indexed

  const comic = await fetchComicById(comicId);

  return {
    emotions,
    seed,
    hash,
    totalComics,
    comic,
  };
}

module.exports = {
  resolveComicForEmotions,
  buildSeed,
  djb2Hash,
  todayDateString,
  fetchLatestComicId,
  fetchComicById,
};
