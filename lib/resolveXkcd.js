'use strict';

const { djb2Hash, todayDateString, buildSeed } = require('./seed');

/**
 * xkcd resolver for the "Upgraded Therapy" tier.
 *
 * xkcd publishes an official JSON endpoint for every comic:
 *   https://xkcd.com/{n}/info.0.json  → that comic's data
 *   https://xkcd.com/info.0.json      → the latest comic's data (num field)
 *
 * The one real wrinkle: comic #404 doesn't exist (the page 404s on purpose).
 * fetchXkcdByIdWithFallback() handles gaps by walking forward deterministically
 * until it finds a real comic.
 */

const XKCD_BASE = 'https://xkcd.com';
const TIER = 'upgraded';
const MAX_GAP_RETRIES = 5;

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; HoloceneGodelianProtocol/2.1; +https://davidfacer.com)',
};

let latestNumCache = { num: null, fetchedAt: 0 };
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Last-resort floor if the live "latest comic" lookup ever fails.
const FALLBACK_LATEST_NUM = 3260;

async function fetchLatestXkcdNum() {
  const now = Date.now();
  if (latestNumCache.num && now - latestNumCache.fetchedAt < CACHE_TTL_MS) {
    return latestNumCache.num;
  }

  try {
    const res = await fetch(`${XKCD_BASE}/info.0.json`, { headers: FETCH_HEADERS });
    if (!res.ok) throw new Error(`xkcd info.0.json responded ${res.status}`);
    const data = await res.json();
    if (!data.num) throw new Error('no num field in xkcd response');

    latestNumCache = { num: data.num, fetchedAt: now };
    return data.num;
  } catch (err) {
    console.warn('[resolveXkcd] latest comic lookup failed, using fallback:', err.message);
    return FALLBACK_LATEST_NUM;
  }
}

async function fetchXkcdById(num) {
  const res = await fetch(`${XKCD_BASE}/${num}/info.0.json`, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`xkcd responded ${res.status} for comic ${num}`);
  const data = await res.json();
  if (!data.img) throw new Error(`no image found for xkcd comic ${num}`);

  return {
    id: num,
    imageUrl: data.img,
    pageUrl: `${XKCD_BASE}/${num}/`,
    title: data.safe_title || data.title || null,
    blurb: data.alt || null,
  };
}

async function fetchXkcdByIdWithFallback(num, totalComics) {
  let attempt = num;
  for (let i = 0; i <= MAX_GAP_RETRIES; i++) {
    try {
      return await fetchXkcdById(attempt);
    } catch (err) {
      console.warn(`[resolveXkcd] comic ${attempt} unavailable (${err.message}), trying next`);
      attempt = (attempt % totalComics) + 1;
    }
  }
  return fetchXkcdById(1);
}

async function resolveXkcdForEmotions(emotions, date = new Date()) {
  if (!Array.isArray(emotions) || emotions.length < 1 || emotions.length > 3) {
    throw new RangeError('Provide between 1 and 3 emotions.');
  }

  const dateString = todayDateString(date);
  const seed = buildSeed(emotions, dateString, TIER);
  const hash = djb2Hash(seed);
  const totalComics = await fetchLatestXkcdNum();
  const comicId = (hash % totalComics) + 1;

  const comic = await fetchXkcdByIdWithFallback(comicId, totalComics);

  return { emotions, seed, hash, totalComics, comic };
}

module.exports = { resolveXkcdForEmotions, fetchLatestXkcdNum, fetchXkcdById };
