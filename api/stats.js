'use strict';

const { readAllFeedback } = require('../lib/readFeedback');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    const records = await readAllFeedback();

    const totals = {
      dino_yes: 0,
      dino_no: 0,
      upgraded_opted: 0,
      hgerp_yes: 0,
      hgerp_no: 0,
    };

    for (const r of records) {
      if (r.response === 'upgrade_requested') { totals.upgraded_opted++; continue; }
      if (r.tier === 'standard' && r.response === 'yes') { totals.dino_yes++; continue; }
      if (r.tier === 'standard' && r.response === 'no')  { totals.dino_no++;  continue; }
      if (r.tier === 'upgraded' && r.response === 'yes') { totals.hgerp_yes++; continue; }
      if (r.tier === 'upgraded' && r.response === 'no')  { totals.hgerp_no++;  continue; }
    }

    return res.status(200).json({ totals, recordCount: records.length });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
};
