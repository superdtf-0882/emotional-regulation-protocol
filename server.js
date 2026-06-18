'use strict';

const path = require('path');
const express = require('express');
const { resolveComicForEmotions } = require('./lib/resolveComic');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/comic', async (req, res) => {
  try {
    const { emotions } = req.body || {};
    const result = await resolveComicForEmotions(emotions);
    res.json(result);
  } catch (err) {
    const status = err instanceof RangeError ? 400 : 502;
    res.status(status).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Ontological Alignment Engine running at http://localhost:${PORT}`);
});
