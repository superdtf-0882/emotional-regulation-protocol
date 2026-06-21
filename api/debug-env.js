'use strict';

module.exports = function handler(req, res) {
  const blobKeys = Object.keys(process.env).filter(k => k.includes('BLOB') || k.includes('VERCEL_OIDC'));
  res.status(200).json({
    blobKeys,
    hasBlobReadWriteToken: !!process.env.BLOB_READ_WRITE_TOKEN,
    hasVercelOidc: !!process.env.VERCEL_OIDC_TOKEN,
  });
};
