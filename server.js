'use strict';

const path = require('path');
const express = require('express');
const { resolveComicForEmotions } = require('./lib/resolveComic');
const { resolveXkcdForEmotions } = require('./lib/resolveXkcd');
const { validateFeedback } = require('./lib/validateFeedback');
const { writeFeedback } = require('./lib/store');
const { readAllFeedback } = require('./lib/readFeedback');
const { fetchComicById, fetchLatestComicId } = require('./lib/resolveComic');
const { fetchXkcdById, fetchLatestXkcdNum } = require('./lib/resolveXkcd');
const crypto = require('crypto');
const { put, list } = require('@vercel/blob');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/comic', async (req, res) => {
  try {
    const { emotions, tier, comicId } = req.body || {};

    if (comicId !== undefined) {
      if (!Number.isInteger(comicId) || comicId < 1) {
        return res.status(400).json({ error: 'comicId must be a positive integer.' });
      }
      const resolvedTier = tier === 'upgraded' ? 'upgraded' : 'standard';
      let comic, totalComics;
      if (resolvedTier === 'upgraded') {
        [comic, totalComics] = await Promise.all([fetchXkcdById(comicId), fetchLatestXkcdNum()]);
      } else {
        [comic, totalComics] = await Promise.all([fetchComicById(comicId), fetchLatestComicId()]);
      }
      return res.json({ tier: resolvedTier, comic, totalComics, shared: true });
    }

    if (tier !== undefined && tier !== 'standard' && tier !== 'upgraded') {
      return res.status(400).json({ error: 'tier must be "standard" or "upgraded".' });
    }

    const result =
      tier === 'upgraded'
        ? await resolveXkcdForEmotions(emotions)
        : await resolveComicForEmotions(emotions);

    res.json({ ...result, tier: tier === 'upgraded' ? 'upgraded' : 'standard' });
  } catch (err) {
    const status = err instanceof RangeError ? 400 : 502;
    res.status(status).json({ error: err.message });
  }
});

const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function generateShareToken(length = 6) {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes).map(b => BASE62[b % 62]).join('');
}

app.post('/api/share', async (req, res) => {
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

  if (tier === 'standard') {
    try {
      const upgraded = await resolveXkcdForEmotions(emotions);
      payload.upgradedComicId = upgraded.comic.id;
    } catch (err) {
      console.warn('[share] upgraded pre-computation failed:', err.message);
    }
  }

  const token = generateShareToken();

  try {
    await put(`shares/${token}.json`, JSON.stringify(payload), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });
    res.json({ token });
  } catch (err) {
    console.error('[share] blob write failed:', err.message);
    res.status(502).json({ error: 'Failed to create share link.' });
  }
});

app.get('/api/share/:token', async (req, res) => {
  const { token } = req.params;
  if (!token || !/^[A-Za-z0-9]{6}$/.test(token)) {
    return res.status(400).json({ error: 'Invalid or missing token.' });
  }
  try {
    const { blobs } = await list({ prefix: `shares/${token}.json` });
    if (!blobs || blobs.length === 0) {
      return res.status(404).json({ error: 'Share link not found or expired.' });
    }
    const blobRes = await fetch(blobs[0].url);
    if (!blobRes.ok) throw new Error(`blob fetch responded ${blobRes.status}`);
    res.json(await blobRes.json());
  } catch (err) {
    console.error('[share/token] retrieval failed:', err.message);
    res.status(502).json({ error: 'Failed to retrieve share.' });
  }
});

app.post('/api/feedback', async (req, res) => {
  try {
    const clean = validateFeedback(req.body);
    const stored = await writeFeedback(clean);
    res.json({ ok: true, recordedAt: stored.recordedAt });
  } catch (err) {
    const status = err instanceof RangeError ? 400 : 502;
    res.status(status).json({ error: err.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const records = await readAllFeedback();
    const totals = { dino_yes: 0, dino_no: 0, upgraded_opted: 0, hgerp_yes: 0, hgerp_no: 0 };
    for (const r of records) {
      if (r.response === 'upgrade_requested') { totals.upgraded_opted++; continue; }
      if (r.tier === 'standard' && r.response === 'yes') { totals.dino_yes++; continue; }
      if (r.tier === 'standard' && r.response === 'no')  { totals.dino_no++;  continue; }
      if (r.tier === 'upgraded' && r.response === 'yes') { totals.hgerp_yes++; continue; }
      if (r.tier === 'upgraded' && r.response === 'no')  { totals.hgerp_no++;  continue; }
    }
    res.json({ totals, recordCount: records.length });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Holocene Gödelian Emotional Regulation Protocol running at http://localhost:${PORT}`);
});
