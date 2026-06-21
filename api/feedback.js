'use strict';

const { validateFeedback } = require('../lib/validateFeedback');
const { writeFeedback } = require('../lib/store');

/**
 * POST /api/feedback
 * Body: { sessionId, tier, emotions, comicSource, comicId,
 *         response: "yes" | "no" | "upgrade_requested" }
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const clean = validateFeedback(req.body);
    const stored = await writeFeedback(clean);
    return res.status(200).json({ ok: true, recordedAt: stored.recordedAt });
  } catch (err) {
    const status = err instanceof RangeError ? 400 : 502;
    return res.status(status).json({ error: err.message });
  }
};
