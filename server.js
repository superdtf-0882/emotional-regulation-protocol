'use strict';

const path = require('path');
const express = require('express');
const { resolveComicForEmotions } = require('./lib/resolveComic');
const { resolveXkcdForEmotions } = require('./lib/resolveXkcd');
const { validateFeedback } = require('./lib/validateFeedback');
const { writeFeedback } = require('./lib/store');
const { readAllFeedback } = require('./lib/readFeedback');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/comic', async (req, res) => {
  try {
    const { emotions, tier } = req.body || {};

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
