'use strict';

const path = require('path');
const express = require('express');
const { resolveComicForEmotions } = require('./lib/resolveComic');
const { resolveXkcdForEmotions } = require('./lib/resolveXkcd');
const { validateFeedback } = require('./lib/validateFeedback');
const { writeFeedback } = require('./lib/store');

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

app.listen(PORT, () => {
  console.log(`Holocene Gödelian Emotional Regulation Protocol running at http://localhost:${PORT}`);
});
