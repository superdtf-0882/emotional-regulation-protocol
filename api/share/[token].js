'use strict';

const { list } = require('@vercel/blob');

/**
 * GET /api/share/:token
 *
 * Retrieves the share payload stored at shares/{token}.json.
 * Returns the same object that POST /api/share stored:
 * { emotions, tier, comicId, source, upgradedComicId? }
 *
 * The share.html page calls this on load, then runs the animation and
 * fetches the comic directly by ID via POST /api/comic.
 */
module.exports = async function handler(req, res) {
  const { token } = req.query;

  if (!token || !/^[A-Za-z0-9]{6}$/.test(token)) {
    return res.status(400).json({ error: 'Invalid or missing token.' });
  }

  try {
    const { blobs } = await list({ prefix: `shares/${token}.json` });
    if (!blobs || blobs.length === 0) {
      return res.status(404).json({ error: 'Share link not found or expired.' });
    }

    // Fetch the blob content from its public URL
    const blobRes = await fetch(blobs[0].url);
    if (!blobRes.ok) {
      throw new Error(`blob fetch responded ${blobRes.status}`);
    }
    const payload = await blobRes.json();
    return res.status(200).json(payload);
  } catch (err) {
    console.error('[share/token] retrieval failed:', err.message);
    return res.status(502).json({ error: 'Failed to retrieve share.' });
  }
};
