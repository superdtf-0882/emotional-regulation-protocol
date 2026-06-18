'use strict';

const { resolveComicForEmotions } = require('../lib/resolveComic');

/**
 * POST /api/comic
 * Body: { "emotions": ["Anxious", "Curious", "Hopeful"] }  (1–3 items)
 *
 * Vercel's Node runtime auto-parses a JSON request body into req.body
 * when Content-Type: application/json is set, so no extra parsing here.
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { emotions } = req.body || {};
    const result = await resolveComicForEmotions(emotions);
    return res.status(200).json(result);
  } catch (err) {
    const status = err instanceof RangeError ? 400 : 502;
    return res.status(status).json({ error: err.message });
  }
};
