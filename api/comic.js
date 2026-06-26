'use strict';

const { resolveComicForEmotions } = require('../lib/resolveComic');
const { resolveXkcdForEmotions } = require('../lib/resolveXkcd');

/**
 * POST /api/comic
 * Body: { "emotions": ["Anxious", "Curious", "Hopeful"], "tier": "standard" }
 * tier defaults to "standard" (qwantz). Pass "upgraded" for the xkcd path.
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { emotions, tier, comicId } = req.body || {};

    // Direct fetch by ID — used by share.html to replay the exact same comic
    // the sharer saw, bypassing the date-sensitive hash entirely.
    if (comicId !== undefined) {
      if (!Number.isInteger(comicId) || comicId < 1) {
        return res.status(400).json({ error: 'comicId must be a positive integer.' });
      }
      const resolvedTier = tier === 'upgraded' ? 'upgraded' : 'standard';
      let comic, totalComics;
      if (resolvedTier === 'upgraded') {
        const { fetchXkcdById, fetchLatestXkcdNum } = require('../lib/resolveXkcd');
        [comic, totalComics] = await Promise.all([fetchXkcdById(comicId), fetchLatestXkcdNum()]);
      } else {
        const { fetchComicById, fetchLatestComicId } = require('../lib/resolveComic');
        [comic, totalComics] = await Promise.all([fetchComicById(comicId), fetchLatestComicId()]);
      }
      return res.status(200).json({ tier: resolvedTier, comic, totalComics, shared: true });
    }

    if (tier !== undefined && tier !== 'standard' && tier !== 'upgraded') {
      return res.status(400).json({ error: 'tier must be "standard" or "upgraded".' });
    }

    const result =
      tier === 'upgraded'
        ? await resolveXkcdForEmotions(emotions)
        : await resolveComicForEmotions(emotions);

    return res.status(200).json({ ...result, tier: tier === 'upgraded' ? 'upgraded' : 'standard' });
  } catch (err) {
    const status = err instanceof RangeError ? 400 : 502;
    return res.status(status).json({ error: err.message });
  }
};
