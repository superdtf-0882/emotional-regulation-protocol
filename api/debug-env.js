'use strict';

module.exports = async function handler(req, res) {
  const blobKeys = Object.keys(process.env).filter(k => k.includes('BLOB') || k.includes('VERCEL_OIDC'));

  let blobListResult = null;
  let blobListError = null;
  try {
    const { list } = await import('@vercel/blob');
    const page = await list({ prefix: 'responses/', limit: 5 });
    blobListResult = { blobCount: page.blobs.length, hasMore: page.hasMore };
  } catch (err) {
    blobListError = err.message;
  }

  res.status(200).json({
    blobKeys,
    hasBlobReadWriteToken: !!process.env.BLOB_READ_WRITE_TOKEN,
    hasVercelOidc: !!process.env.VERCEL_OIDC_TOKEN,
    hasBlobStoreId: !!process.env.BLOB_STORE_ID,
    blobListResult,
    blobListError,
  });
};
