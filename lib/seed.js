'use strict';

/** djb2 string hash — deterministic, not cryptographic, spreads fine. */
function djb2Hash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

/** YYYY-MM-DD in UTC, so the seed doesn't shift with server timezone. */
function todayDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/**
 * Alphabetize + lowercase emotions, append the date and tier.
 *
 * Tier is included so a given day + emotion set resolves to a fixed comic
 * per tier — "anxious+curious, standard" always lands on the same qwantz
 * strip, and "..., upgraded" always lands on the same xkcd strip.
 */
function buildSeed(emotions, dateString, tier = 'standard') {
  const normalized = [...emotions]
    .map((e) => String(e).trim().toLowerCase())
    .filter(Boolean)
    .sort();
  return `${normalized.join('-')}-${dateString}-${tier}`;
}

module.exports = { djb2Hash, todayDateString, buildSeed };
