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
    const { emotions, tier } = req.body || {};

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
