'use strict';

const crypto = require('crypto');
const { put } = require('@vercel/blob');
const { resolveXkcdForEmotions } = require('../lib/resolveXkcd');

/**
 * POST /api/share
 * Body: { emotions, tier, comicId, source }
 *
 * Writes the share payload as a small JSON blob under shares/{token}.json
 * and returns { token } — a 6-char base62 string. The share URL is then
 * constructed client-side as /share/{token}.
 *
 * For standard-tier shares, also pre-computes the xkcd comic for the
 * same emotions so recipients can "Try Upgraded Therapy" without a
 * date-drift problem. Pre-computation is best-effort — if it fails, the
 * share is created without upgradedComicId and the upgrade button is
 * hidden for recipients of that link.
 */

const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function generateToken(length = 6) {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes).map(b => BASE62[b % 62]).join('');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { emotions, tier, comicId, source } = req.body || {};

  if (!Array.isArray(emotions) || emotions.length < 1 || emotions.length > 3) {
    return res.status(400).json({ error: 'emotions must be 1-3 strings.' });
  }
  if (!['standard', 'upgraded'].includes(tier)) {
    return res.status(400).json({ error: 'Invalid tier.' });
  }
  if (!Number.isInteger(comicId) || comicId < 1) {
    return res.status(400).json({ error: 'Invalid comicId.' });
  }
  if (!['qwantz', 'xkcd'].includes(source)) {
    return res.status(400).json({ error: 'Invalid source.' });
  }

  const payload = { emotions, tier, comicId, source };

  // Pre-compute upgraded comic ID for standard shares — best-effort only.
  if (tier === 'standard') {
    try {
      const upgraded = await resolveXkcdForEmotions(emotions);
      payload.upgradedComicId = upgraded.comic.id;
    } catch (err) {
      // Non-fatal: share is created without upgradedComicId.
      // Recipients of this specific link won't see the upgrade button.
      console.warn('[share] upgraded pre-computation failed:', err.message);
    }
  }

  const token = generateToken();

  try {
    await put(`shares/${token}.json`, JSON.stringify(payload), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });
    return res.status(200).json({ token });
  } catch (err) {
    console.error('[share] blob write failed:', err.message);
    return res.status(502).json({ error: 'Failed to create share link.' });
  }
};
